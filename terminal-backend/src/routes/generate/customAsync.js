import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs/promises'
import { v4 as uuidv4 } from 'uuid'
import apiTerminalService from '../../utils/apiTerminalService.js'
import { authenticateUserOrDefault, ensureUserFolder } from '../../middleware/userAuth.js'
import userService from '../../services/userService.js'
import { ensureCardFolder, updateFolderStatus } from './utils/folderManager.js'
import { SessionMetadata } from './utils/sessionMetadata.js'
import zipProcessor from '../../utils/zipProcessor.js'
import promptProcessor from '../../utils/promptProcessor.js'
import htmlProcessor from '../../utils/UnifiedHtmlProcessor.js'

const router = express.Router()

// 配置multer用于文件上传
const upload = multer({
  dest: '/tmp/uploads/',
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB
  },
  fileFilter: (req, file, cb) => {
    // 只接受zip文件
    if (file.mimetype === 'application/zip' || 
        file.mimetype === 'application/x-zip-compressed' ||
        file.originalname.endsWith('.zip')) {
      cb(null, true)
    } else {
      cb(new Error('只支持ZIP文件'))
    }
  }
})

/**
 * 自定义模板异步处理接口
 * POST /api/generate/custom/async
 * 
 * 请求体:
 * - zipFile: ZIP压缩包
 * - prompt: 提示词
 * - templateName: 模板名称（可选）
 * - token: 用户token（可选）
 */
router.post('/', 
  authenticateUserOrDefault, 
  ensureUserFolder,
  upload.single('zipFile'),
  async (req, res) => {
    
  const zipFile = req.file
  const { prompt, templateName = 'podcast-template', token } = req.body  // 默认使用播客模板
  
  console.log('[CustomAsync] ==================== NEW REQUEST ====================')
  console.log('[CustomAsync] User:', req.user.username)
  console.log('[CustomAsync] Template:', templateName)
  console.log('[CustomAsync] ZIP file:', zipFile?.originalname)
  console.log('[CustomAsync] Prompt length:', prompt?.length)
  
  try {
    // 1. 参数验证
    if (!zipFile) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: 'ZIP文件不能为空'
      })
    }
    
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: 'prompt参数不能为空'
      })
    }
    
    // 2. 处理用户token（如果提供）
    let targetUser = req.user
    if (token) {
      console.log(`[CustomAsync] User token provided: ${token}`)
      const tokenUser = await userService.findUserByToken(token)
      if (tokenUser) {
        targetUser = tokenUser
        console.log(`[CustomAsync] Using token-specified user: ${tokenUser.username}`)
      }
    }
    
    // 3. 生成任务ID和路径
    const timestamp = Date.now()  // 使用同一个时间戳
    const taskId = `custom_${timestamp}_${Math.random().toString(36).substring(2, 9)}`
    const folderName = `custom_template_${timestamp}`
    const userCardPath = userService.getUserCardPath(targetUser.username, folderName)
    const userTemplatesPath = path.join(
      path.dirname(userCardPath), 
      '..', 
      'templates'
    )
    const templatePath = path.join(userTemplatesPath, `custom_${timestamp}`)
    
    console.log('[CustomAsync] Task ID:', taskId)
    console.log('[CustomAsync] Folder name:', folderName)
    console.log('[CustomAsync] Card path:', userCardPath)
    console.log('[CustomAsync] Template path:', templatePath)
    
    // 4. 验证ZIP文件安全性
    await zipProcessor.validateSecurity(zipFile.path)
    
    // 5. 解压ZIP并分析结构
    console.log('[CustomAsync] Extracting ZIP file...')
    console.log('[CustomAsync] Extract target path:', templatePath)
    const extractedStructure = await zipProcessor.extract(zipFile.path, templatePath)
    console.log('[CustomAsync] Extraction complete:')
    console.log('[CustomAsync]   - Files:', extractedStructure.totalFiles)
    console.log('[CustomAsync]   - Directories:', extractedStructure.directories.length)
    console.log('[CustomAsync]   - Total size:', extractedStructure.totalSize, 'bytes')
    
    // 5.1 立即处理Prompt路径替换（在返回响应前）
    console.log('[CustomAsync] ==================== PROMPT PROCESSING ====================')
    console.log('[CustomAsync] Original prompt:')
    console.log('[CustomAsync]', prompt)
    console.log('[CustomAsync] Template path:', templatePath)
    console.log('[CustomAsync] User card path:', userCardPath)
    
    const processedPrompt = await promptProcessor.processPrompt(
      prompt,
      templatePath,
      userCardPath
    )
    
    console.log('[CustomAsync] ==================== PROCESSED PROMPT ====================')
    console.log('[CustomAsync] Processed prompt:')
    console.log('[CustomAsync]', processedPrompt)
    console.log('[CustomAsync] ============================================================')
    
    // 6. 创建任务文件夹和元数据
    await ensureCardFolder(userCardPath, folderName, folderName)
    
    const metadata = new SessionMetadata(
      targetUser.username,
      'custom_template',  // topic
      templateName,
      '/api/generate/custom/async',
      taskId
    )
    
    // 添加自定义字段到metadata
    metadata.data.custom = {
      templatePath,
      phases: {
        extraction: 'completed',
        promptProcessing: 'completed',
        firstGeneration: 'pending',
        base64Embedding: 'pending'
      }
    }
    
    await metadata.save(userCardPath)
    await updateFolderStatus(userCardPath, 'processing', { 
      taskId,
      templateName  // 使用传入的模板名称
    })
    
    // 7. 立即返回响应
    const responseData = {
      taskId,
      folderName,
      folderPath: userCardPath,
      topic: `自定义模板: ${templateName}`,
      templateName,
      status: 'submitted',
      extractedStructure,
      statusUrl: `/api/generate/custom/status/${taskId}`
    }
    
    res.json({
      code: 200,
      success: true,
      data: responseData,
      message: '任务已提交，正在后台处理'
    })
    
    console.log('[CustomAsync] Response sent, starting background processing...')
    
    // 8. 后台异步处理
    processInBackground(
      taskId,
      userCardPath,
      templatePath,
      processedPrompt,  // 使用已处理的prompt
      metadata,
      targetUser.username,
      folderName
    ).catch(error => {
      console.error(`[CustomAsync] Background processing failed for ${taskId}:`, error)
    })
    
    // 9. 清理临时文件
    setTimeout(() => {
      zipProcessor.cleanup(zipFile.path).catch(err => {
        console.warn('[CustomAsync] Failed to cleanup temp file:', err.message)
      })
    }, 5000)
    
  } catch (error) {
    console.error('[CustomAsync] Request failed:', error)
    
    // 清理临时文件
    if (zipFile?.path) {
      zipProcessor.cleanup(zipFile.path).catch(() => {})
    }
    
    return res.status(500).json({
      code: 500,
      success: false,
      message: error.message || '处理失败'
    })
  }
})

/**
 * 后台处理函数
 */
async function processInBackground(
  taskId,
  userCardPath,
  templatePath,
  processedPrompt,  // 已经处理过的prompt
  metadata,
  username,
  folderName
) {
  console.log(`[CustomAsync Background] Starting processing for task ${taskId}`)
  
  // 创建一个共享的API会话ID，两次生成使用同一个session
  const apiId = uuidv4()
  console.log(`[CustomAsync Background] Creating shared session: ${apiId}`)
  
  try {
    // 创建API终端会话（只创建一次，两次生成共享）
    await apiTerminalService.createTerminalSession(apiId)
    
    // 1. 第一次AI生成 - 生成HTML内容
    console.log('[CustomAsync Background] Phase 1: First AI generation (HTML creation)')
    await updateFolderStatus(userCardPath, 'generating', { taskId, phase: 'first_generation' })
    metadata.data.custom.phases.firstGeneration = 'processing'
    await metadata.save(userCardPath)
    
    const firstResult = await generateWithAI(processedPrompt, userCardPath, username, folderName, { apiId })
    
    if (!firstResult.htmlContent) {
      throw new Error('第一次生成未产生HTML文件')
    }
    
    metadata.data.custom.phases.firstGeneration = 'completed'
    metadata.addLog('info', '第一次AI生成完成', { fileName: firstResult.fileName })
    await metadata.save(userCardPath)
    
    // 2. 直接使用组件进行Base64转换
    console.log('[CustomAsync Background] Phase 2: Base64 conversion using component')
    await updateFolderStatus(userCardPath, 'embedding', { taskId })
    metadata.data.custom.phases.base64Embedding = 'processing'
    await metadata.save(userCardPath)
    
    const htmlFilePath = path.join(userCardPath, firstResult.fileName)
    console.log('[CustomAsync Background] Converting HTML to base64:', htmlFilePath)
    console.log('[CustomAsync Background] Template path for reference:', templatePath)
    
    // 使用专用组件进行转换
    const conversionResult = await htmlProcessor.convertHtmlToBase64(
      htmlFilePath,
      templatePath  // 模板基础路径用于解析相对路径
    )
    
    let secondResult
    
    if (conversionResult.success) {
      console.log('[CustomAsync Background] Base64 conversion successful!')
      console.log(`[CustomAsync Background] Output file: ${conversionResult.outputFile}`)
      console.log(`[CustomAsync Background] Stats:`, conversionResult.stats)
      
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
      console.error('[CustomAsync Background] Base64 conversion failed:', conversionResult.error)
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
    
    // 3. 更新状态为完成
    metadata.complete('success')
    metadata.addLog('info', '任务处理完成')
    metadata.data.custom.endTime = new Date().toISOString()
    metadata.data.custom.generatedFiles = {
      original: firstResult.fileName,
      withBase64: secondResult.fileName
    }
    await metadata.save(userCardPath)
    
    await updateFolderStatus(userCardPath, 'completed', {
      taskId,
      completedAt: new Date()
    })
    
    console.log(`[CustomAsync Background] Task ${taskId} completed successfully`)
    console.log(`[CustomAsync Background] Files generated:`)
    console.log(`[CustomAsync Background]   - Original: ${firstResult.fileName}`)
    console.log(`[CustomAsync Background]   - With Base64: ${secondResult.fileName}`)
    
    // 所有任务完成后，销毁共享的session
    console.log(`[CustomAsync Background] All tasks completed, destroying shared session ${apiId}`)
    await apiTerminalService.destroySession(apiId)
    
  } catch (error) {
    console.error(`[CustomAsync Background] Task ${taskId} failed:`, error)
    
    // 错误时也要清理共享的session
    if (apiId) {
      console.log(`[CustomAsync Background] Error occurred, cleaning up shared session ${apiId}`)
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
 */
async function generateWithAI(prompt, userCardPath, username, folderName, options = {}) {
  console.log('[CustomAsync AI] Starting AI generation (using apiTerminalService)')
  
  // 使用传入的apiId或创建新的
  const apiId = options.apiId || uuidv4()
  const isSharedSession = !!options.apiId
  
  if (isSharedSession) {
    console.log(`[CustomAsync AI] Using shared session: ${apiId}`)
  } else {
    console.log(`[CustomAsync AI] Creating new session: ${apiId}`)
    // 只有在没有传入apiId时才创建新会话
    await apiTerminalService.createTerminalSession(apiId)
  }
  
  try {
    // 输出完整组装后的提示词（与cardAsync一样）
    console.log('\n🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥')
    console.log('🎯 [CustomAsync AI] ============ ASSEMBLED PROMPT ============')
    console.log('📝 [CustomAsync AI] Prompt Length:', prompt.length, 'chars')
    console.log('💬 [CustomAsync AI] ========== PROMPT BEGIN ==========')
    console.log(prompt)
    console.log('\n💬 [CustomAsync AI] ========== PROMPT END ==========')
    console.log('🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥\n')
    
    // 执行Claude命令（异步执行，不等待）
    console.log(`[CustomAsync AI] Executing Claude with API ID: ${apiId}`)
    apiTerminalService.executeClaude(apiId, prompt).catch(error => {
      console.error(`[CustomAsync AI] Claude execution error:`, error)
    })
    
    // 等待文件生成
    console.log('[CustomAsync AI] Waiting for file generation...')
    console.log(`[CustomAsync AI] Monitoring directory: ${userCardPath}`)
    console.log(`[CustomAsync AI] Looking for files with pattern: ${options.filePattern || 'normal HTML (no _base64)'}`)
    const startTime = Date.now()
    
    // 记录初始文件列表
    const initialFiles = await fs.readdir(userCardPath)
    console.log(`[CustomAsync AI] Initial files in directory: ${initialFiles.length}`)
    console.log(`[CustomAsync AI] Initial files:`, initialFiles)
    
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
            console.log(`[CustomAsync AI] File count changed: ${lastFileCount} -> ${files.length}`)
            const newFiles = files.filter(f => !initialFiles.includes(f))
            console.log(`[CustomAsync AI] New files detected:`, newFiles)
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
            console.log(`[CustomAsync AI] HTML file detected: ${htmlFiles[0]}`)
            console.log(`[CustomAsync AI] All HTML files:`, htmlFiles)
            console.log(`[CustomAsync AI] Detection time: ${(Date.now() - startTime) / 1000}s`)
            clearInterval(checkInterval)
            resolve(htmlFiles[0])
          }
          
          if (checkCount >= maxChecks) {
            console.log(`[CustomAsync AI] Max checks reached (${maxChecks})`)
            console.log(`[CustomAsync AI] Final directory contents:`, files)
            console.log(`[CustomAsync AI] No HTML files found after ${maxChecks * 2}s`)
            clearInterval(checkInterval)
            resolve(null)
          }
          if (checkCount % 30 === 0) {
            console.log(`[CustomAsync AI] Check #${checkCount}: Still waiting... (${checkCount * 2}s elapsed)`)
            console.log(`[CustomAsync AI] Current directory contents:`, files)
    
          }
        } catch (error) {
          console.error(`[CustomAsync AI] Check error at count ${checkCount}:`, error)
        }
      }, 5000) // 每5秒检查一次
    })
    
    const duration = Date.now() - startTime
    
    if (!fileDetected) {
      // 超时时只有非共享session才清理
      if (!isSharedSession) {
        console.log(`[CustomAsync AI] Generation timeout, cleaning up session ${apiId}`)
        await apiTerminalService.destroySession(apiId)
      } else {
        console.log(`[CustomAsync AI] Generation timeout, keeping shared session ${apiId}`)
      }
      throw new Error('生成超时：未检测到HTML文件')
    }
    
    console.log(`[CustomAsync AI] Generation completed in ${duration}ms`)
    
    // 读取生成的HTML内容
    const htmlPath = path.join(userCardPath, fileDetected)
    const htmlContent = await fs.readFile(htmlPath, 'utf-8')
    
    // 只有在不是共享session时才清理会话
    if (!isSharedSession) {
      console.log(`[CustomAsync AI] File generated successfully, cleaning up session ${apiId}`)
      await apiTerminalService.destroySession(apiId)
    } else {
      console.log(`[CustomAsync AI] File generated successfully, keeping shared session ${apiId}`)
    }
    
    return { 
      htmlContent,
      fileName: fileDetected
    }
    
  } catch (error) {
    console.error('[CustomAsync AI] Generation error:', error)
    // 发生错误时只有非共享session才清理
    if (!isSharedSession) {
      await apiTerminalService.destroySession(apiId)
    }
    throw error
  }
}

export default router