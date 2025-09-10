import express from 'express'
import path from 'path'
import fs from 'fs/promises'
import { v4 as uuidv4 } from 'uuid'
import apiTerminalService from '../../utils/apiTerminalService.js'
import { authenticateUserOrDefault, ensureUserFolder } from '../../middleware/userAuth.js'
import userService from '../../services/userService.js'
import { ensureCardFolder, updateFolderStatus } from './utils/folderManager.js'
import { SessionMetadata } from './utils/sessionMetadata.js'
import promptProcessor from '../../utils/promptProcessor.js'
import htmlToBase64Converter from '../../utils/htmlToBase64Converter.js'

const router = express.Router()

// 用户任务状态跟踪 - 支持多任务并发
const userTaskStatus = new Map() // key: username, value: Set of taskIds

/**
 * 获取用户的Pod2Post模板路径
 * @param {string} username - 用户名
 * @returns {string} 用户Pod2Post模板的绝对路径
 */
function getUserPod2PostTemplatePath(username) {
  return userService.getUserTemplatePath(username, 'pod2post')
}

/**
 * 验证Pod2Post模板路径是否存在并包含必要文件
 * @param {string} templatePath - 模板路径
 * @throws {Error} 如果模板缺少必要文件
 */
async function validateTemplatePath(templatePath) {
  console.log(`[Pod2PostAsync] Validating template path: ${templatePath}`)
  
  // 检查基础路径是否存在
  try {
    await fs.access(templatePath)
  } catch {
    throw new Error(`Pod2Post模板路径不存在: ${templatePath}`)
  }
  
  // 检查必要的文件和目录
  const requiredItems = [
    'CDN',
    'photos',
    '播客小红书图文卡片需求文档.md',
    '内容页模板规范.md',
    '新闻感封面.md'
  ]
  
  for (const item of requiredItems) {
    const itemPath = path.join(templatePath, item)
    try {
      await fs.access(itemPath)
    } catch {
      throw new Error(`Pod2Post模板缺少必要文件或目录: ${item}`)
    }
  }
  
  console.log(`[Pod2PostAsync] Template validation passed`)
}

/**
 * 播客小红书图文卡片生成接口
 * POST /api/generate/pod2post/async
 * 
 * 请求体 (Content-Type: application/json):
 * {
 *   "prompt": "string",           // 必需，提示词内容
 *   "templateName": "string",     // 可选，默认 "pod2post-template" 
 *   "taskId": "string",           // 可选，任务ID（格式: pod2post_{timestamp}_{random}）
 *   "token": "string"             // 可选，用户token
 * }
 */
router.post('/', 
  authenticateUserOrDefault, 
  ensureUserFolder,
  async (req, res) => {
    
  const { prompt, templateName = 'pod2post-template', token, taskId: clientTaskId } = req.body
  
  console.log('[Pod2PostAsync] ==================== NEW REQUEST ====================')
  console.log('[Pod2PostAsync] User:', req.user.username)
  console.log('[Pod2PostAsync] Template:', templateName)
  console.log('[Pod2PostAsync] Client TaskId:', clientTaskId || 'none (will generate new)')
  console.log('[Pod2PostAsync] Prompt length:', prompt?.length)
  
  try {
    // 1. 参数验证
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: 'prompt参数不能为空'
      })
    }
    
    // 2. 处理用户token（支持传入token切换用户）
    let targetUser = req.user  // 默认使用认证用户（通常是default）
    if (token) {
      console.log(`[Pod2PostAsync] User token provided: ${token}`)
      const tokenUser = await userService.findUserByToken(token)
      if (tokenUser) {
        targetUser = tokenUser  // 使用token对应的实际用户
        console.log(`[Pod2PostAsync] Using token-specified user: ${tokenUser.username}`)
      } else {
        console.log(`[Pod2PostAsync] Token user not found, using default user: ${req.user.username}`)
      }
    }
    
    // 3. 处理任务ID
    let taskId = clientTaskId
    let folderName
    
    // 如果客户端提供了taskId，验证格式
    if (taskId) {
      if (!taskId.startsWith('pod2post_')) {
        return res.status(400).json({
          code: 400,
          success: false,
          message: 'Invalid taskId format. Expected format: pod2post_{timestamp}_{random}'
        })
      }
      // 使用完整的taskId作为文件夹名
      folderName = taskId
      console.log(`[Pod2PostAsync] Using client-provided taskId: ${taskId}`)
    } else {
      // 生成新的taskId
      const timestamp = Date.now()
      taskId = `pod2post_${timestamp}_${Math.random().toString(36).substring(2, 9)}`
      folderName = taskId  // 使用完整的taskId作为文件夹名
      console.log(`[Pod2PostAsync] Generated new taskId: ${taskId}`)
    }
    
    // 4. 更新用户任务跟踪（支持多任务）
    if (!userTaskStatus.has(targetUser.username)) {
      userTaskStatus.set(targetUser.username, new Set())
    }
    const userTasks = userTaskStatus.get(targetUser.username)
    
    // 可选：检查并发数量限制（软限制，可配置）
    const MAX_CONCURRENT_TASKS = 5
    if (userTasks.size >= MAX_CONCURRENT_TASKS) {
      console.log(`[Pod2PostAsync] User ${targetUser.username} reached max concurrent tasks: ${userTasks.size}`)
      return res.status(429).json({
        code: 429,
        success: false,
        message: `已达到最大并发任务数限制（${MAX_CONCURRENT_TASKS}个），请等待部分任务完成后再试`,
        data: {
          currentTasks: Array.from(userTasks),
          maxConcurrent: MAX_CONCURRENT_TASKS
        }
      })
    }
    
    userTasks.add(taskId)
    console.log(`[Pod2PostAsync] User ${targetUser.username} now has ${userTasks.size} active task(s)`)
    
    // 使用目标用户生成路径
    const userCardPath = userService.getUserCardPath(targetUser.username, folderName)
    const templatePath = getUserPod2PostTemplatePath(targetUser.username)
    
    // 确保输出目录存在
    await fs.mkdir(userCardPath, { recursive: true })
    console.log('[Pod2PostAsync] Created output directory:', userCardPath)
    
    // 任务已经在前面添加到Set中了，这里删除旧的Map设置逻辑
    
    console.log('[Pod2PostAsync] Task ID:', taskId)
    console.log('[Pod2PostAsync] Target user:', targetUser.username)
    console.log('[Pod2PostAsync] Card path:', userCardPath)
    console.log('[Pod2PostAsync] Template path:', templatePath)
    
    // 4. 验证模板路径存在
    await validateTemplatePath(templatePath)
    
    // 5. 立即处理Prompt路径替换（传入taskId）
    console.log('[Pod2PostAsync] ==================== PROMPT PROCESSING ====================')
    console.log('[Pod2PostAsync] Original prompt:')
    console.log('[Pod2PostAsync]', prompt.substring(0, 200) + (prompt.length > 200 ? '...' : ''))
    console.log('[Pod2PostAsync] Template path:', templatePath)
    console.log('[Pod2PostAsync] User card path:', userCardPath)
    console.log('[Pod2PostAsync] Task ID for prompt processing:', taskId)
    
    const processedPrompt = await promptProcessor.processPrompt(
      prompt,
      templatePath,    // Pod2Post固定模板路径
      userCardPath,    // 用户输出路径
      taskId          // 传入taskId以使用任务特定资源路径
    )
    
    console.log('[Pod2PostAsync] ==================== PROCESSED PROMPT ====================')
    console.log('[Pod2PostAsync] Processed prompt:')
    console.log('[Pod2PostAsync]', processedPrompt.substring(0, 300) + (processedPrompt.length > 300 ? '...' : ''))
    console.log('[Pod2PostAsync] ============================================================')
    
    // 6. 创建任务文件夹和元数据
    await ensureCardFolder(userCardPath, folderName, folderName)
    
    const metadata = new SessionMetadata(
      targetUser.username,
      'pod2post_template',
      templateName,
      '/api/generate/pod2post/async',
      taskId
    )
    
    // 添加自定义字段到metadata
    metadata.data.custom = {
      templatePath,
      phases: {
        promptProcessing: 'completed',
        firstGeneration: 'pending',
        base64Embedding: 'pending'  // Base64处理阶段
      }
    }
    
    // 设置初始状态为processing
    metadata.status = 'processing'
    
    await metadata.save(userCardPath)
    await updateFolderStatus(userCardPath, 'processing', { 
      taskId,
      templateName
    })
    
    // 7. 立即返回响应
    const responseData = {
      taskId,
      folderName,
      folderPath: userCardPath,
      topic: `播客小红书图文卡片: ${templateName}`,
      templateName,
      status: 'submitted',
      statusUrl: `/api/generate/pod2post/status/${taskId}`
    }
    
    res.json({
      code: 200,
      success: true,
      data: responseData,
      message: '任务已提交，正在后台处理'
    })
    
    console.log('[Pod2PostAsync] Response sent, starting background processing...')
    
    // 8. 后台异步处理【包含完整Base64处理】
    processInBackground(
      taskId,
      userCardPath,
      templatePath,
      processedPrompt,
      metadata,
      targetUser.username,
      folderName
    ).catch(error => {
      console.error(`[Pod2PostAsync] Background processing failed for ${taskId}:`, error)
    })
    
  } catch (error) {
    console.error('[Pod2PostAsync] Request failed:', error)
    
    // 请求失败时也要清理用户任务状态
    if (targetUser && userTaskStatus.has(targetUser.username)) {
      const userTasks = userTaskStatus.get(targetUser.username)
      if (userTasks && taskId) {
        userTasks.delete(taskId)
        if (userTasks.size === 0) {
          userTaskStatus.delete(targetUser.username)
        }
        console.log(`[Pod2PostAsync] Request failed, removed taskId ${taskId} for user: ${targetUser.username}`)
      }
    }
    
    return res.status(500).json({
      code: 500,
      success: false,
      message: error.message || '处理失败'
    })
  }
})

/**
 * 后台处理函数 - 包含完整的Base64嵌入流程
 * @param {string} taskId - 任务ID
 * @param {string} userCardPath - 用户卡片路径
 * @param {string} templatePath - 模板路径
 * @param {string} processedPrompt - 处理后的提示词
 * @param {SessionMetadata} metadata - 元数据对象
 * @param {string} username - 用户名
 * @param {string} folderName - 文件夹名称
 */
async function processInBackground(
  taskId,
  userCardPath,
  templatePath,
  processedPrompt,
  metadata,
  username,
  folderName
) {
  console.log(`[Pod2PostAsync Background] Starting processing for task ${taskId}`)
  
  // 创建共享API会话
  const apiId = uuidv4()
  console.log(`[Pod2PostAsync Background] Creating shared session: ${apiId}`)
  
  try {
    await apiTerminalService.createTerminalSession(apiId)
    
    // =============== 阶段1：AI生成HTML ===============
    console.log('[Pod2PostAsync Background] Phase 1: First AI generation (HTML creation)')
    await updateFolderStatus(userCardPath, 'generating', { taskId, phase: 'first_generation' })
    metadata.data.custom.phases.firstGeneration = 'processing'
    metadata.status = 'processing'  // 更新整体状态
    await metadata.save(userCardPath)
    
    const firstResult = await generateWithAI(processedPrompt, userCardPath, username, folderName, { apiId })
    
    if (!firstResult.htmlContent) {
      throw new Error('第一次生成未产生HTML文件')
    }
    
    metadata.data.custom.phases.firstGeneration = 'completed'
    metadata.addLog('info', '第一次AI生成完成', { fileName: firstResult.fileName })
    await metadata.save(userCardPath)
    
    // =============== 阶段2：Base64图片嵌入【不能遗漏】===============
    console.log('[Pod2PostAsync Background] Phase 2: Base64 conversion using component')
    await updateFolderStatus(userCardPath, 'embedding', { taskId })
    metadata.data.custom.phases.base64Embedding = 'processing'
    metadata.status = 'processing'  // 保持processing状态
    await metadata.save(userCardPath)
    
    const htmlFilePath = path.join(userCardPath, firstResult.fileName)
    console.log('[Pod2PostAsync Background] Converting HTML to base64:', htmlFilePath)
    console.log('[Pod2PostAsync Background] Template path for reference:', templatePath)
    
    // 【关键调用】使用专用组件进行Base64转换
    const conversionResult = await htmlToBase64Converter.convertHtmlToBase64(
      htmlFilePath,
      templatePath  // Pod2Post模板路径，用于解析相对路径
    )
    
    let secondResult
    
    if (conversionResult.success) {
      console.log('[Pod2PostAsync Background] Base64 conversion successful!')
      console.log(`[Pod2PostAsync Background] Output file: ${conversionResult.outputFile}`)
      console.log(`[Pod2PostAsync Background] Stats:`, conversionResult.stats)
      
      metadata.data.custom.phases.base64Embedding = 'completed'
      metadata.addLog('info', 'Base64图片嵌入完成', { 
        originalFile: firstResult.fileName,
        base64File: path.basename(conversionResult.outputFile),
        stats: conversionResult.stats
      })
      
      // 创建与原来相同格式的结果对象
      secondResult = {
        htmlContent: await fs.readFile(conversionResult.outputFile, 'utf-8'),
        fileName: path.basename(conversionResult.outputFile)
      }
      
    } else {
      console.error('[Pod2PostAsync Background] Base64 conversion failed:', conversionResult.error)
      metadata.data.custom.phases.base64Embedding = 'failed'
      metadata.addLog('error', 'Base64图片嵌入失败: ' + conversionResult.error)
      
      // 转换失败时，复制原文件作为fallback
      const fallbackFileName = firstResult.fileName.replace('.html', '_with_base64.html')
      const fallbackPath = path.join(userCardPath, fallbackFileName)
      await fs.copyFile(htmlFilePath, fallbackPath)
      
      secondResult = {
        htmlContent: firstResult.htmlContent,
        fileName: fallbackFileName
      }
    }
    
    await metadata.save(userCardPath)
    
    // =============== 阶段3：清理任务资源 ===============
    console.log('[Pod2PostAsync Background] Phase 3: Cleaning task resources')
    try {
      await cleanUserTemplateResources(username, taskId)
      console.log('[Pod2PostAsync Background] Task resources cleaned successfully')
    } catch (error) {
      console.warn('[Pod2PostAsync Background] Failed to clean task resources:', error.message)
    }
    
    // =============== 阶段4：任务完成 ===============
    metadata.complete('success')
    metadata.addLog('info', '任务处理完成')
    metadata.data.custom.endTime = new Date().toISOString()
    
    // 清理用户任务状态（从Set中删除taskId）
    if (userTaskStatus.has(username)) {
      const userTasks = userTaskStatus.get(username)
      if (userTasks) {
        userTasks.delete(taskId)
        if (userTasks.size === 0) {
          userTaskStatus.delete(username)
        }
        console.log(`[Pod2PostAsync Background] Task ${taskId} completed, user ${username} has ${userTasks.size} remaining task(s)`)
      }
    }
    metadata.data.custom.generatedFiles = {
      original: firstResult.fileName,
      withBase64: secondResult.fileName
    }
    await metadata.save(userCardPath)
    
    await updateFolderStatus(userCardPath, 'completed', {
      taskId,
      completedAt: new Date()
    })
    
    console.log(`[Pod2PostAsync Background] Task ${taskId} completed successfully`)
    console.log(`[Pod2PostAsync Background] Files generated:`)
    console.log(`[Pod2PostAsync Background]   - Original: ${firstResult.fileName}`)
    console.log(`[Pod2PostAsync Background]   - With Base64: ${secondResult.fileName}`)
    
    // 清理共享session
    console.log(`[Pod2PostAsync Background] All tasks completed, destroying shared session ${apiId}`)
    await apiTerminalService.destroySession(apiId)
    
  } catch (error) {
    console.error(`[Pod2PostAsync Background] Task ${taskId} failed:`, error)
    
    // 错误时清理用户任务状态（从Set中删除taskId）
    if (userTaskStatus.has(username)) {
      const userTasks = userTaskStatus.get(username)
      if (userTasks) {
        userTasks.delete(taskId)
        if (userTasks.size === 0) {
          userTaskStatus.delete(username)
        }
        console.log(`[Pod2PostAsync Background] Task ${taskId} failed, user ${username} has ${userTasks.size} remaining task(s)`)
      }
    }
    
    // 错误时也要清理共享session
    if (apiId) {
      console.log(`[Pod2PostAsync Background] Error occurred, cleaning up shared session ${apiId}`)
      await apiTerminalService.destroySession(apiId)
    }
    
    // 错误处理
    metadata.complete('error')
    metadata.addLog('error', error.message)
    metadata.error = {
      message: error.message,
      stack: error.stack,
      time: new Date().toISOString()
    }
    await metadata.save(userCardPath)
    
    await updateFolderStatus(userCardPath, 'failed', {
      taskId,
      error: error.message
    })
  }
}

/**
 * 调用AI生成内容 - 使用与cardAsync相同的apiTerminalService
 * @param {string} prompt - 提示词
 * @param {string} userCardPath - 用户卡片路径
 * @param {string} username - 用户名
 * @param {string} folderName - 文件夹名称
 * @param {Object} options - 可选参数
 * @param {string} options.filePattern - 要检测的文件模式，如 '_with_base64'
 * @param {string} options.apiId - 外部传入的API会话ID，用于复用session
 * @returns {Promise<{htmlContent: string, fileName: string}>} 生成结果
 */
async function generateWithAI(prompt, userCardPath, username, folderName, options = {}) {
  console.log('[Pod2PostAsync AI] Starting AI generation (using apiTerminalService)')
  
  // 使用传入的apiId或创建新的
  const apiId = options.apiId || uuidv4()
  const isSharedSession = !!options.apiId
  
  if (isSharedSession) {
    console.log(`[Pod2PostAsync AI] Using shared session: ${apiId}`)
  } else {
    console.log(`[Pod2PostAsync AI] Creating new session: ${apiId}`)
    await apiTerminalService.createTerminalSession(apiId)
  }
  
  try {
    // 输出完整组装后的提示词
    console.log('\n🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥')
    console.log('🎯 [Pod2PostAsync AI] ============ ASSEMBLED PROMPT ============')
    console.log('📝 [Pod2PostAsync AI] Prompt Length:', prompt.length, 'chars')
    console.log('💬 [Pod2PostAsync AI] ========== PROMPT BEGIN ==========')
    console.log(prompt)
    console.log('\n💬 [Pod2PostAsync AI] ========== PROMPT END ==========')
    console.log('🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥\n')
    
    // 执行Claude命令（异步执行，不等待）
    console.log(`[Pod2PostAsync AI] Executing Claude with API ID: ${apiId}`)
    apiTerminalService.executeClaude(apiId, prompt).catch(error => {
      console.error(`[Pod2PostAsync AI] Claude execution error:`, error)
    })
    
    // 等待文件生成
    console.log('[Pod2PostAsync AI] Waiting for file generation...')
    console.log(`[Pod2PostAsync AI] Monitoring directory: ${userCardPath}`)
    console.log(`[Pod2PostAsync AI] Looking for files with pattern: ${options.filePattern || 'normal HTML (no _base64)'}`)
    const startTime = Date.now()
    
    // 记录初始文件列表
    const initialFiles = await fs.readdir(userCardPath)
    console.log(`[Pod2PostAsync AI] Initial files in directory: ${initialFiles.length}`)
    console.log(`[Pod2PostAsync AI] Initial files:`, initialFiles)
    
    // 等待文件生成
    const fileDetected = await new Promise((resolve) => {
      let checkCount = 0
      const maxChecks = 600 // 最多检查600次（20分钟）
      let lastFileCount = initialFiles.length
      
      const checkInterval = setInterval(async () => {
        checkCount++
        try {
          const files = await fs.readdir(userCardPath)
          
          // 检查是否有新文件
          if (files.length !== lastFileCount) {
            console.log(`[Pod2PostAsync AI] File count changed: ${lastFileCount} -> ${files.length}`)
            const newFiles = files.filter(f => !initialFiles.includes(f))
            console.log(`[Pod2PostAsync AI] New files detected:`, newFiles)
            lastFileCount = files.length
          }
          
          // 根据选项决定检测哪种文件
          let htmlFiles
          if (options.filePattern === '_with_base64') {
            // 第二次生成：检测带 _with_base64 后缀的文件
            htmlFiles = files.filter(f => 
              f.endsWith('_with_base64.html') && 
              !f.startsWith('.')
            )
          } else {
            // 第一次生成：检测普通HTML文件（排除带 _base64 的）
            htmlFiles = files.filter(f => 
              f.endsWith('.html') && 
              !f.startsWith('.') &&
              !f.includes('_meta') &&
              !f.includes('_base64') &&
              !f.includes('_with_base64')
            )
          }
          
          if (htmlFiles.length > 0) {
            console.log(`[Pod2PostAsync AI] HTML file detected: ${htmlFiles[0]}`)
            console.log(`[Pod2PostAsync AI] All HTML files:`, htmlFiles)
            console.log(`[Pod2PostAsync AI] Detection time: ${(Date.now() - startTime) / 1000}s`)
            clearInterval(checkInterval)
            resolve(htmlFiles[0])
          }
          
          if (checkCount >= maxChecks) {
            console.log(`[Pod2PostAsync AI] Max checks reached (${maxChecks})`)
            console.log(`[Pod2PostAsync AI] Final directory contents:`, files)
            console.log(`[Pod2PostAsync AI] No HTML files found after ${maxChecks * 2}s`)
            clearInterval(checkInterval)
            resolve(null)
          }
          
          if (checkCount % 30 === 0) {
            console.log(`[Pod2PostAsync AI] Check #${checkCount}: Still waiting... (${checkCount * 2}s elapsed)`)
            console.log(`[Pod2PostAsync AI] Current directory contents:`, files)
          }
        } catch (error) {
          console.error(`[Pod2PostAsync AI] Check error at count ${checkCount}:`, error)
        }
      }, 5000) // 每5秒检查一次
    })
    
    const duration = Date.now() - startTime
    
    if (!fileDetected) {
      // 超时时只有非共享session才清理
      if (!isSharedSession) {
        console.log(`[Pod2PostAsync AI] Generation timeout, cleaning up session ${apiId}`)
        await apiTerminalService.destroySession(apiId)
      } else {
        console.log(`[Pod2PostAsync AI] Generation timeout, keeping shared session ${apiId}`)
      }
      throw new Error('生成超时：未检测到HTML文件')
    }
    
    console.log(`[Pod2PostAsync AI] Generation completed in ${duration}ms`)
    
    // 读取生成的HTML内容
    const htmlPath = path.join(userCardPath, fileDetected)
    const htmlContent = await fs.readFile(htmlPath, 'utf-8')
    
    // 只有在不是共享session时才清理会话
    if (!isSharedSession) {
      console.log(`[Pod2PostAsync AI] File generated successfully, cleaning up session ${apiId}`)
      await apiTerminalService.destroySession(apiId)
    } else {
      console.log(`[Pod2PostAsync AI] File generated successfully, keeping shared session ${apiId}`)
    }
    
    return { 
      htmlContent,
      fileName: fileDetected
    }
    
  } catch (error) {
    console.error('[Pod2PostAsync AI] Generation error:', error)
    // 发生错误时只有非共享session才清理
    if (!isSharedSession) {
      await apiTerminalService.destroySession(apiId)
    }
    throw error
  }
}

/**
 * 清理用户模板资源
 * Base64生成完成后清理上传的资源文件，确保下次生成不受影响
 * @param {string} username - 用户名
 * @param {string} taskId - 任务ID（可选）
 */
async function cleanUserTemplateResources(username, taskId = null) {
  const userService = await import('../../services/userService.js')
  const templatePath = userService.default.getUserTemplatePath(username, 'pod2post')
  
  // 如果有taskId，清理任务特定目录
  if (taskId && taskId.startsWith('pod2post_')) {
    const taskPath = path.join(templatePath, 'tasks', taskId)
    
    try {
      // 检查任务目录是否存在
      const taskDirExists = await fs.access(taskPath).then(() => true).catch(() => false)
      if (taskDirExists) {
        // 删除整个任务目录及其内容
        await fs.rm(taskPath, { recursive: true, force: true })
        console.log(`[Pod2PostAsync] Cleaned task directory: ${taskPath}`)
      }
    } catch (error) {
      console.warn(`[Pod2PostAsync] Failed to clean task directory ${taskPath}:`, error.message)
    }
    
    return // 任务特定清理完成，直接返回
  }
  
  // 默认清理逻辑（无taskId时）
  const dirsToClean = ['CDN', 'photos', 'resources']
  
  for (const dir of dirsToClean) {
    const dirPath = path.join(templatePath, dir)
    
    try {
      // 检查目录是否存在
      const dirExists = await fs.access(dirPath).then(() => true).catch(() => false)
      if (!dirExists) {
        continue
      }
      
      // 读取目录内容
      const files = await fs.readdir(dirPath)
      
      // 删除所有文件
      for (const file of files) {
        const filePath = path.join(dirPath, file)
        const stats = await fs.stat(filePath)
        
        if (stats.isFile()) {
          await fs.unlink(filePath)
          console.log(`[Pod2PostAsync] Cleaned file: ${filePath}`)
        }
      }
      
      console.log(`[Pod2PostAsync] Cleaned directory: ${dirPath} (${files.length} files)`)
      
    } catch (error) {
      console.warn(`[Pod2PostAsync] Failed to clean directory ${dirPath}:`, error.message)
    }
  }
}

export default router