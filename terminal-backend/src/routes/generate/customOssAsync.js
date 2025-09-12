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
import resourceUploader from '../../utils/resourceUploader.js'
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
 * 自定义模板OSS异步处理接口
 * POST /api/generate/custom/ossasync
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
  const { prompt, templateName = 'custom-oss-template', token } = req.body
  
  console.log('[CustomOssAsync] ==================== NEW REQUEST ====================')
  console.log('[CustomOssAsync] User:', req.user.username)
  console.log('[CustomOssAsync] Template:', templateName)
  console.log('[CustomOssAsync] ZIP file:', zipFile?.originalname)
  console.log('[CustomOssAsync] Prompt length:', prompt?.length)
  
  try {
    // 1. 参数验证
    if (!zipFile) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: 'ZIP文件是必需的'
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
      console.log(`[CustomOssAsync] User token provided: ${token}`)
      const tokenUser = await userService.findUserByToken(token)
      if (tokenUser) {
        targetUser = tokenUser
        console.log(`[CustomOssAsync] Using token-specified user: ${tokenUser.username}`)
      }
    }

    // 3. 生成任务ID和文件夹结构
    const timestamp = Date.now()  // 使用同一个时间戳
    const taskId = `custom_oss_${timestamp}_${Math.random().toString(36).substring(2, 9)}`
    const folderName = `custom_oss_template_${timestamp}`
    const userCardPath = userService.getUserCardPath(targetUser.username, folderName)
    const userTemplatesPath = path.join(
      path.dirname(userCardPath), 
      '..', 
      'templates'
    )
    const templatePath = path.join(userTemplatesPath, `custom_oss_${timestamp}`)

    console.log('[CustomOssAsync] Task ID:', taskId)
    console.log('[CustomOssAsync] Folder name:', folderName)
    console.log('[CustomOssAsync] Card path:', userCardPath)
    console.log('[CustomOssAsync] Template path:', templatePath)
    
    // 4. 验证ZIP文件安全性
    await zipProcessor.validateSecurity(zipFile.path)
    
    // 5. 解压ZIP并分析结构
    console.log('[CustomOssAsync] Extracting ZIP file...')
    console.log('[CustomOssAsync] Extract target path:', templatePath)
    const extractedStructure = await zipProcessor.extract(zipFile.path, templatePath)
    console.log('[CustomOssAsync] Extraction complete:')
    console.log('[CustomOssAsync]   - Files:', extractedStructure.totalFiles)
    console.log('[CustomOssAsync]   - Directories:', extractedStructure.directories.length)
    console.log('[CustomOssAsync]   - Total size:', extractedStructure.totalSize, 'bytes')
    
    // 5.1 立即处理Prompt路径替换（在返回响应前）
    console.log('[CustomOssAsync] ==================== PROMPT PROCESSING ====================')
    console.log('[CustomOssAsync] Original prompt:')
    console.log('[CustomOssAsync]', prompt)
    console.log('[CustomOssAsync] Template path:', templatePath)
    console.log('[CustomOssAsync] User card path:', userCardPath)
    
    let processedPrompt
    try {
      processedPrompt = await promptProcessor.processPrompt(
        prompt,
        templatePath,
        userCardPath
      )
      console.log('[CustomOssAsync] ==================== PROCESSED PROMPT ====================')
      console.log('[CustomOssAsync] Processed prompt:')
      console.log('[CustomOssAsync]', processedPrompt)
      console.log('[CustomOssAsync] ============================================================')
    } catch (error) {
      console.warn('[CustomOssAsync] Prompt processing failed:', error.message)
      console.warn('[CustomOssAsync] Using original prompt')
      processedPrompt = prompt
    }
    
    // 6. 创建任务文件夹和元数据
    await ensureCardFolder(userCardPath, folderName, folderName)
    
    const metadata = new SessionMetadata(
      targetUser.username,
      'custom_oss_template',  // topic
      templateName,
      '/api/generate/custom/ossasync',
      taskId
    )
    
    // 添加自定义字段到metadata
    metadata.data.custom = {
      templatePath,
      mode: 'oss',  // OSS模式标识
      phases: {
        extraction: 'completed',
        promptProcessing: 'completed',
        ossUpload: 'pending',
        aiGeneration: 'pending',
        pathReplacement: 'pending',
        base64Fallback: 'pending'
      },
      ossStatistics: {
        totalFiles: extractedStructure.totalFiles,
        uploadedFiles: 0,
        replacedPaths: 0,
        ossSize: '0MB'
      }
    }

    await metadata.save(userCardPath)
    await updateFolderStatus(userCardPath, 'processing', { 
      taskId,
      templateName  // 使用传入的模板名称
    })
    
    // 7. 立即返回响应
    res.json({
      code: 200,
      success: true,
      data: {
        taskId,
        folderName,
        folderPath: userCardPath,
        topic: `自定义OSS模板: ${templateName}`,
        templateName,
        mode: 'oss',
        status: 'submitted',
        extractedStructure,
        statusUrl: `/api/generate/custom/status/${taskId}`
      },
      message: '任务已提交，正在后台处理（OSS模式）'
    })

    console.log('[CustomOssAsync] Response sent, starting background processing...')
    
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
      console.error(`[CustomOssAsync] Background processing failed for ${taskId}:`, error)
    })
    
    // 9. 清理临时文件
    setTimeout(() => {
      zipProcessor.cleanup(zipFile.path).catch(err => {
        console.warn('[CustomOssAsync] Failed to cleanup temp file:', err.message)
      })
    }, 5000)

    
  } catch (error) {
    console.error('[CustomOssAsync] Request failed:', error)
    
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
 * 后台处理函数 - OSS三阶段处理
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
  console.log(`[CustomOssAsync Background] Starting processing for task ${taskId}`)
  
  // 创建共享的API会话ID
  const apiId = uuidv4()
  console.log(`[CustomOssAsync Background] Creating shared session: ${apiId}`)
  
  try {
    // 创建API终端会话
    await apiTerminalService.createTerminalSession(apiId)
    
    // ========== Phase 1: 资源上传到OSS ==========
    console.log('[CustomOssAsync Background] Phase 1: OSS upload')
    await updateFolderStatus(userCardPath, 'preparing', { taskId, phase: 'oss_upload' })
    metadata.data.custom.phases.ossUpload = 'processing'
    metadata.addLog('info', 'Phase 1: 开始OSS资源上传')
    await metadata.save(userCardPath)

    // 1.1 扫描并上传资源到OSS
    console.log('[CustomOssAsync Background] Scanning and uploading resources to OSS...')
    let uploadResults, mappingFilePath
    try {
      uploadResults = await resourceUploader.batchUploadToOSS(templatePath, {
        prefix: `custom-template/${taskId}/`,
        concurrency: 5,
        maxRetries: 3
      })
      
      // 1.2 创建资源映射文件
      console.log('[CustomOssAsync Background] Creating resource mapping file...')
      mappingFilePath = path.join(userCardPath, 'resources_mapping.jsonl')
      await createResourceMappingFile(uploadResults, mappingFilePath)
      
      // 更新统计信息
      metadata.data.custom.ossStatistics.uploadedFiles = uploadResults.length
      metadata.data.custom.ossStatistics.ossSize = formatFileSize(uploadResults.reduce((total, r) => total + r.size, 0))
      metadata.data.custom.phases.ossUpload = 'completed'
      metadata.addLog('info', `Phase 1完成: 上传${uploadResults.length}个资源到OSS`)
      await metadata.save(userCardPath)
    } catch (ossError) {
      console.warn('[CustomOssAsync Background] OSS upload failed, will fallback to base64 encoding:', ossError.message)
      // 如果OSS上传失败，标记需要base64回退，创建空映射文件
      uploadResults = []
      mappingFilePath = path.join(userCardPath, 'resources_mapping.jsonl')
      await fs.writeFile(mappingFilePath, '')
      metadata.data.custom.phases.ossUpload = 'failed_will_fallback'
      metadata.data.custom.fallbackReason = 'OSS upload failed: ' + ossError.message
      metadata.addLog('warn', 'Phase 1失败: OSS上传失败，将回退到base64编码模式')
      await metadata.save(userCardPath)
    }

    // ========== Phase 2: AI生成 ==========
    console.log('[CustomOssAsync Background] Phase 2: AI generation')
    await updateFolderStatus(userCardPath, 'generating', { taskId, phase: 'ai_generation' })
    metadata.data.custom.phases.aiGeneration = 'processing'
    metadata.addLog('info', 'Phase 2: 开始AI生成')
    await metadata.save(userCardPath)
    
    // AI生成HTML
    const result = await generateWithAI(processedPrompt, userCardPath, username, folderName, { apiId })
    
    if (!result.htmlContent) {
      throw new Error('AI生成未产生HTML文件')
    }
    
    metadata.data.custom.phases.aiGeneration = 'completed'
    metadata.addLog('info', 'Phase 2完成: AI生成HTML文件', { fileName: result.fileName })
    await metadata.save(userCardPath)

    // ========== Phase 3: 路径替换或Base64回退 ==========
    console.log('[CustomOssAsync Background] Phase 3: Path replacement or Base64 fallback')
    await updateFolderStatus(userCardPath, 'post_processing', { taskId })
    metadata.data.custom.phases.pathReplacement = 'processing'
    
    // 检查是否需要base64回退
    const needBase64Fallback = metadata.data.custom.phases.ossUpload === 'failed_will_fallback'
    
    if (needBase64Fallback) {
      console.log('[CustomOssAsync Background] Executing base64 fallback due to OSS failure')
      metadata.addLog('info', 'Phase 3: 执行base64回退机制')
      await metadata.save(userCardPath)
      
      // 执行base64回退
      await executeBase64Fallback(result, userCardPath, metadata, apiId)
      
    } else {
      console.log('[CustomOssAsync Background] Executing normal OSS path replacement')
      metadata.addLog('info', 'Phase 3: 开始OSS路径替换')
      await metadata.save(userCardPath)
      
      try {
        // 3.1 读取映射文件
        const resourceMappings = await readResourceMappingFile(mappingFilePath)
        
        // 3.2 替换HTML中的路径为OSS URL（如果有OSS资源）
        let ossHtml = result.htmlContent
        let replacedCount = 0
        
        if (resourceMappings.length > 0) {
          ossHtml = await htmlPathReplacer.replaceWithOSSUrls(
            result.htmlContent,
            resourceMappings,
            templatePath
          )
          replacedCount = countReplacedPaths(result.htmlContent, ossHtml)
        }
        
        // 3.3 保存两个版本的HTML文件
        const originalFileName = result.fileName
        const ossFileName = result.fileName.replace('.html', '_oss.html')
        
        await fs.writeFile(path.join(userCardPath, originalFileName), result.htmlContent)
        await fs.writeFile(path.join(userCardPath, ossFileName), ossHtml)
        
        metadata.data.custom.ossStatistics.replacedPaths = replacedCount
        metadata.data.custom.phases.pathReplacement = 'completed'
        metadata.addLog('info', `Phase 3完成: 替换${replacedCount}个路径为OSS URL`)
        
      } catch (replaceError) {
        console.warn('[CustomOssAsync Background] OSS path replacement failed, falling back to base64:', replaceError.message)
        
        // OSS路径替换失败，回退到base64
        metadata.data.custom.fallbackReason = 'Path replacement failed: ' + replaceError.message
        metadata.addLog('warn', 'Phase 3: OSS路径替换失败，回退到base64编码')
        await metadata.save(userCardPath)
        
        await executeBase64Fallback(result, userCardPath, metadata, apiId)
      }
    }
    
    // ========== 完成处理 ==========
    metadata.complete('success')
    const finalMode = needBase64Fallback || metadata.data.custom.phases.pathReplacement === 'fallback_completed' ? 'base64_fallback' : 'oss'
    metadata.addLog('info', `处理流程完成 (${finalMode} 模式)`)
    metadata.data.custom.endTime = new Date().toISOString()
    metadata.data.custom.finalMode = finalMode
    
    // 根据最终模式设置生成的文件信息
    if (finalMode === 'base64_fallback') {
      metadata.data.custom.generatedFiles = {
        original: result.fileName,
        base64Version: result.fileName.replace('.html', '_with_base64.html'),
        mapping: 'resources_mapping.jsonl'
      }
    } else {
      metadata.data.custom.generatedFiles = {
        original: result.fileName,
        ossVersion: result.fileName.replace('.html', '_oss.html'),
        mapping: 'resources_mapping.jsonl'
      }
    }
    
    await metadata.save(userCardPath)
    
    await updateFolderStatus(userCardPath, 'completed', {
      taskId,
      completedAt: new Date()
    })
    
    console.log(`[CustomOssAsync Background] Task ${taskId} completed successfully (${finalMode} mode)`)
    console.log(`[CustomOssAsync Background] Files generated:`)
    console.log(`[CustomOssAsync Background]   - Original: ${result.fileName}`)
    if (finalMode === 'base64_fallback') {
      console.log(`[CustomOssAsync Background]   - Base64 Version: ${result.fileName.replace('.html', '_with_base64.html')}`)
    } else {
      console.log(`[CustomOssAsync Background]   - OSS Version: ${result.fileName.replace('.html', '_oss.html')}`)
    }
    console.log(`[CustomOssAsync Background]   - Mapping: resources_mapping.jsonl`)
    
    // 所有任务完成后，销毁共享的session
    console.log(`[CustomOssAsync Background] All tasks completed, destroying shared session ${apiId}`)
    await apiTerminalService.destroySession(apiId)
    
  } catch (error) {
    console.error(`[CustomOssAsync Background] Task ${taskId} failed:`, error)
    
    // 错误时也要清理共享的session
    if (apiId) {
      console.log(`[CustomOssAsync Background] Error occurred, cleaning up shared session ${apiId}`)
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
 * 调用AI生成内容
 */
async function generateWithAI(prompt, userCardPath, username, folderName, options = {}) {
  console.log('[CustomOssAsync AI] Starting AI generation (using apiTerminalService)')
  
  const apiId = options.apiId || uuidv4()
  const isSharedSession = !!options.apiId
  
  if (isSharedSession) {
    console.log(`[CustomOssAsync AI] Using shared session: ${apiId}`)
  } else {
    console.log(`[CustomOssAsync AI] Creating new session: ${apiId}`)
    await apiTerminalService.createTerminalSession(apiId)
  }
  
  try {
    // 输出提示词信息
    console.log('\n🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥')
    console.log('🎯 [CustomOssAsync AI] ============ ASSEMBLED PROMPT ============')
    console.log(`📝 [CustomOssAsync AI] Prompt Length: ${prompt.length} chars`)
    console.log('💬 [CustomOssAsync AI] ========== PROMPT BEGIN ==========')
    console.log(prompt)
    console.log('🎯 [CustomOssAsync AI] =========== PROMPT END ===========')
    console.log('🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥')
    
    // 发送到Claude执行
    apiTerminalService.executeClaude(apiId, prompt).catch(error => {
      console.error(`[CustomOssAsync AI] Claude execution error:`, error)
    })
    
    // 等待文件生成
    console.log('[CustomOssAsync AI] Waiting for file generation...')
    console.log(`[CustomOssAsync AI] Monitoring directory: ${userCardPath}`)
    const startTime = Date.now()
    
    // 记录初始文件列表
    const initialFiles = await fs.readdir(userCardPath)
    console.log(`[CustomOssAsync AI] Initial files in directory: ${initialFiles.length}`)
    
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
            console.log(`[CustomOssAsync AI] File count changed: ${lastFileCount} -> ${files.length}`)
            const newFiles = files.filter(f => !initialFiles.includes(f))
            console.log(`[CustomOssAsync AI] New files detected:`, newFiles)
            lastFileCount = files.length
          }
          
          // 过滤出生成的HTML文件（与customAsync.js一致的逻辑）
          const htmlFiles = files.filter(f => 
            f.endsWith('.html') && 
            !f.startsWith('.') &&
            !f.includes('_meta') &&
            !f.includes('_base64') &&
            !f.includes('_with_base64') &&
            !f.includes('_oss')
          )
          
          if (htmlFiles.length > 0) {
            console.log(`[CustomOssAsync AI] HTML file detected: ${htmlFiles[0]}`)
            console.log(`[CustomOssAsync AI] All HTML files:`, htmlFiles)
            console.log(`[CustomOssAsync AI] Detection time: ${(Date.now() - startTime) / 1000}s`)
            clearInterval(checkInterval)
            resolve(htmlFiles[0])
          }
          
          if (checkCount >= maxChecks) {
            console.log(`[CustomOssAsync AI] Max checks reached (${maxChecks})`)
            console.log(`[CustomOssAsync AI] Final directory contents:`, files)
            console.log(`[CustomOssAsync AI] No HTML files found after ${maxChecks * 2}s`)
            clearInterval(checkInterval)
            resolve(null)
          }
          if (checkCount % 30 === 0) {
            console.log(`[CustomOssAsync AI] Check #${checkCount}: Still waiting... (${checkCount * 2}s elapsed)`)
            console.log(`[CustomOssAsync AI] Current directory contents:`, files)
          }
        } catch (error) {
          console.error(`[CustomOssAsync AI] Check error at count ${checkCount}:`, error)
        }
      }, 5000) // 改为每5秒检查一次，与customAsync.js一致
    })
    
    const duration = Date.now() - startTime
    
    if (!fileDetected) {
      // 超时时只有非共享session才清理
      if (!isSharedSession) {
        console.log(`[CustomOssAsync AI] Generation timeout, cleaning up session ${apiId}`)
        await apiTerminalService.destroySession(apiId)
      } else {
        console.log(`[CustomOssAsync AI] Generation timeout, keeping shared session ${apiId}`)
      }
      throw new Error('生成超时：未检测到HTML文件')
    }
    
    console.log(`[CustomOssAsync AI] Generation completed in ${duration}ms`)
    
    // 读取生成的HTML内容
    const htmlPath = path.join(userCardPath, fileDetected)
    const htmlContent = await fs.readFile(htmlPath, 'utf-8')
    
    if (!isSharedSession) {
      console.log(`[CustomOssAsync AI] File generated successfully, cleaning up session ${apiId}`)
      await apiTerminalService.destroySession(apiId)
    } else {
      console.log(`[CustomOssAsync AI] File generated successfully, keeping shared session ${apiId}`)
    }
    
    return { 
      htmlContent,
      fileName: fileDetected
    }
    
  } catch (error) {
    console.error('[CustomOssAsync AI] Generation error:', error)
    if (!isSharedSession) {
      await apiTerminalService.destroySession(apiId)
    }
    throw error
  }
}

/**
 * 执行Base64回退机制 - 使用专用组件
 */
async function executeBase64Fallback(result, userCardPath, metadata, apiId) {
  try {
    console.log('[CustomOssAsync Fallback] Starting base64 encoding fallback using component')
    metadata.data.custom.phases.base64Fallback = 'processing'
    await metadata.save(userCardPath)
    
    const htmlFilePath = path.join(userCardPath, result.fileName)
    const templatePath = metadata.data.custom.templatePath
    
    console.log('[CustomOssAsync Fallback] Converting HTML to base64:', htmlFilePath)
    console.log('[CustomOssAsync Fallback] Template path for reference:', templatePath)
    
    // 使用专用组件进行转换
    const conversionResult = await htmlProcessor.convertHtmlToBase64(
      htmlFilePath,
      templatePath  // 模板基础路径用于解析相对路径
    )
    
    if (conversionResult.success) {
      console.log('[CustomOssAsync Fallback] Base64 conversion completed successfully')
      console.log(`[CustomOssAsync Fallback] Output file: ${conversionResult.outputFile}`)
      console.log(`[CustomOssAsync Fallback] Stats:`, conversionResult.stats)
      
      metadata.data.custom.phases.base64Fallback = 'completed'
      metadata.data.custom.phases.pathReplacement = 'fallback_completed'
      metadata.addLog('info', 'Base64回退完成: 图片已嵌入HTML文件', { 
        base64File: path.basename(conversionResult.outputFile),
        stats: conversionResult.stats
      })
      
      // 保存原始文件
      await fs.writeFile(path.join(userCardPath, result.fileName), result.htmlContent)
      
    } else {
      console.error('[CustomOssAsync Fallback] Base64 conversion failed:', conversionResult.error)
      metadata.data.custom.phases.base64Fallback = 'failed'
      metadata.data.custom.phases.pathReplacement = 'fallback_failed'
      metadata.addLog('error', 'Base64回退失败: ' + conversionResult.error)
      
      // 转换失败时，复制原文件作为fallback
      const fallbackFileName = result.fileName.replace('.html', '_with_base64.html')
      const fallbackPath = path.join(userCardPath, fallbackFileName)
      await fs.copyFile(htmlFilePath, fallbackPath)
      
      // 保存原始文件
      await fs.writeFile(path.join(userCardPath, result.fileName), result.htmlContent)
    }
    
    await metadata.save(userCardPath)
    
  } catch (fallbackError) {
    console.error('[CustomOssAsync Fallback] Base64 fallback failed:', fallbackError.message)
    metadata.data.custom.phases.base64Fallback = 'failed'
    metadata.data.custom.phases.pathReplacement = 'fallback_failed'
    metadata.addLog('error', 'Base64回退失败: ' + fallbackError.message)
    
    // 确保至少保存原始文件
    try {
      await fs.writeFile(path.join(userCardPath, result.fileName), result.htmlContent)
    } catch (writeError) {
      console.error('[CustomOssAsync Fallback] Failed to save original file:', writeError.message)
    }
    
    await metadata.save(userCardPath)
  }
}

// ========== 辅助函数 ==========

/**
 * 创建资源映射文件
 */
async function createResourceMappingFile(uploadResults, filePath) {
  try {
    const lines = uploadResults.map(result => JSON.stringify({
      localPath: result.localPath,
      absolutePath: result.absolutePath,
      ossUrl: result.ossUrl,
      size: result.size,
      type: result.type,
      md5: result.md5,
      uploadTime: result.uploadTime
    }))
    
    await fs.writeFile(filePath, lines.join('\n'))
    console.log(`[CustomOssAsync] Resource mapping saved: ${lines.length} entries`)
  } catch (error) {
    console.error('[CustomOssAsync] Failed to create resource mapping file:', error.message)
    // 创建空文件以避免后续读取错误
    await fs.writeFile(filePath, '')
    throw error
  }
}

/**
 * 读取资源映射文件
 */
async function readResourceMappingFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    if (!content.trim()) {
      console.log('[CustomOssAsync] Resource mapping file is empty')
      return []
    }
    
    const mappings = content.split('\n').filter(line => line.trim()).map(line => {
      try {
        return JSON.parse(line)
      } catch (parseError) {
        console.warn('[CustomOssAsync] Failed to parse mapping line:', line)
        return null
      }
    }).filter(Boolean)
    
    console.log(`[CustomOssAsync] Loaded ${mappings.length} resource mappings`)
    return mappings
  } catch (error) {
    console.error('[CustomOssAsync] Failed to read resource mapping file:', error.message)
    return []
  }
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + 'B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + 'KB'
  return (bytes / 1024 / 1024).toFixed(2) + 'MB'
}

/**
 * 统计替换的路径数量
 */
function countReplacedPaths(originalHtml, ossHtml) {
  try {
    const originalPaths = (originalHtml.match(/src="[^"]*"/g) || []).length
    const ossPaths = (ossHtml.match(/https:\/\/[^"]*"/g) || []).length
    console.log(`[CustomOssAsync] Path replacement stats: ${originalPaths} original paths, ${ossPaths} OSS URLs`)
    return ossPaths // OSS URL的数量即为替换的数量
  } catch (error) {
    console.warn('[CustomOssAsync] Failed to count replaced paths:', error.message)
    return 0
  }
}

export default router