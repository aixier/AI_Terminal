import express from 'express'
import path from 'path'
import fs from 'fs/promises'
import apiTerminalService from '../../utils/apiTerminalService.js'
import claudeExecutorDirect from '../../services/claudeExecutorDirect.js'
import { authenticateUserOrDefault, ensureUserFolder } from '../../middleware/userAuth.js'
import userService from '../../services/userService.js'
import { ensureCardFolder, updateFolderStatus, recordGeneratedFiles } from './utils/folderManager.js'

const router = express.Router()

/**
 * 生成卡片并返回JSON内容 (简化版 v3.33+)
 * POST /card
 * 
 * 新架构: 直接使用 claude --dangerously-skip-permissions -p "[prompt]"
 * 无需复杂的Claude初始化流程
 */
router.post('/', authenticateUserOrDefault, ensureUserFolder, async (req, res) => {
  try {
    const { 
      topic, 
      templateName = 'daily-knowledge-card-template.md'
    } = req.body
    
    // 参数验证
    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '主题(topic)参数不能为空'
      })
    }
    
    // 清理主题名称，用于文件夹命名
    const sanitizedTopic = topic.trim().replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')
    
    // 根据环境确定路径
    const isDocker = process.env.NODE_ENV === 'production' || process.env.DATA_PATH
    const dataPath = process.env.DATA_PATH || path.join(process.cwd(), 'data')
    
    // 判断模板类型
    const isFolder = !templateName.includes('.md')
    
    // 使用用户特定的路径
    const userCardPath = userService.getUserCardPath(req.user.username, topic)
    
    // 立即创建文件夹（在生成参数之前）
    console.log(`[GenerateCard API] Creating folder immediately for topic: ${topic}`)
    const folderInfo = await ensureCardFolder(userCardPath, topic, sanitizedTopic)
    console.log(`[GenerateCard API] Folder ready:`, folderInfo)
    
    // 构建模板路径和提示词
    let templatePath, prompt
    
    // 使用前置提示词生成参数
    console.log(`[GenerateCard API] Step 1: Generating prompt parameters for topic: ${topic}`)
    console.log(`[GenerateCard API] Sanitized topic: ${sanitizedTopic}`)
    console.log(`[GenerateCard API] Template: ${templateName}`)
    
    // 添加响应超时保护
    const responseTimeout = setTimeout(() => {
      if (!res.headersSent) {
        console.error('[GenerateCard API] Response timeout - sending timeout error')
        res.status(504).json({
          code: 504,
          success: false,
          message: '请求处理超时，请使用异步接口或流式接口',
          error: 'Gateway Timeout'
        })
      }
    }, 590000) // 9分50秒超时（略小于10分钟）
    
    let parameters
    try {
      // 使用直接执行服务生成参数（避免 PTY 兼容性问题）
      parameters = await claudeExecutorDirect.generateCardParameters(topic, templateName)
    } catch (paramError) {
      console.error('[GenerateCard API] Failed to generate parameters:', paramError)
      clearTimeout(responseTimeout)
      if (!res.headersSent) {
        return res.status(500).json({
          code: 500,
          success: false,
          message: '生成参数失败',
          error: {
            step: 'parameter_generation',
            details: paramError.message
          }
        })
      }
      return
    }
    
    // 根据模板类型解构参数
    let cover, style, language, referenceContent
    if (templateName === 'cardplanet-Sandra-cover' || templateName === 'cardplanet-Sandra-json') {
      ({ cover, style, language, reference: referenceContent } = parameters)
      console.log(`[GenerateCard API] ========== PARAMETERS RECEIVED (4-param) ==========`)
      console.log(`[GenerateCard API] Cover: ${cover}`)
      console.log(`[GenerateCard API] Style: ${style}`)
      console.log(`[GenerateCard API] Language: ${language}`)
      console.log(`[GenerateCard API] Reference: ${referenceContent.substring(0, 200)}${referenceContent.length > 200 ? '...' : ''}`)
    } else {
      ({ style, language, reference: referenceContent } = parameters)
      console.log(`[GenerateCard API] ========== PARAMETERS RECEIVED (3-param) ==========`)
      console.log(`[GenerateCard API] Style: ${style}`)
      console.log(`[GenerateCard API] Language: ${language}`)
      console.log(`[GenerateCard API] Reference: ${referenceContent.substring(0, 200)}${referenceContent.length > 200 ? '...' : ''}`)
    }
    
    if (isFolder) {
      // 文件夹模式
      templatePath = isDocker 
        ? path.join('/app/data/public_template', templateName)
        : path.join(dataPath, 'public_template', templateName)
      
      // 检查文件夹是否存在
      try {
        const stats = await fs.stat(templatePath)
        if (!stats.isDirectory()) {
          throw new Error('不是有效的模板文件夹')
        }
      } catch {
        return res.status(404).json({
          code: 404,
          success: false,
          message: `模板文件夹不存在: ${templateName}`
        })
      }
      
      // 构建文件夹模式的提示词
      const claudePath = path.join(templatePath, 'CLAUDE.md')
      
      // 根据模板类型构建不同的提示词
      if (templateName === 'cardplanet-Sandra-json') {
        prompt = `你是一位海报设计师，要为"${topic}"创作一套收藏级卡片海报作品。

创作重点：
- 把每张卡片当作独立的艺术海报设计
- 深挖主题的趣味性和视觉潜力
- 用细节和创意打动人心
- 必须同时生成HTML和JSON两个文件

封面：${cover}
风格：${style}
语言：${language}
参考：${referenceContent}

从${claudePath}文档开始，按其指引阅读全部6个文档获取创作框架。
特别注意：必须按照html_generation_workflow.md中的双文件输出规范，同时生成HTML文件（主题英文名_style.html）和JSON文件（主题英文名_data.json）。
生成的文件保存在[${userCardPath}]`
      } else if (templateName === 'cardplanet-Sandra-cover') {
        prompt = `你是一位海报设计师，要为"${topic}"创作一套收藏级卡片海报作品。

创作重点：
- 把每张卡片当作独立的艺术海报设计
- 深挖主题的趣味性和视觉潜力
- 用细节和创意打动人心

封面：${cover}
风格：${style}
语言：${language}
参考：${referenceContent}

从${claudePath}文档开始，按其指引阅读全部6个文档获取创作框架。
记住：规范是创作的基础，但你的目标是艺术品，不是代码任务。
生成的json文档保存在[${userCardPath}]`
      } else {
        prompt = `你是一位海报设计师，要为"${topic}"创作一套收藏级卡片海报作品。

创作重点：
- 把每张卡片当作独立的艺术海报设计
- 深挖主题的趣味性和视觉潜力
- 用细节和创意打动人心

风格：${style}
语言：${language}
参考：${referenceContent}

从${claudePath}文档开始，按其指引阅读全部5个文档获取创作框架。
记住：规范是创作的基础，但你的目标是艺术品，不是代码任务。
生成的json文档保存在[${userCardPath}]`
      }
      
    } else {
      // 单文件模式（保持原有逻辑）
      templatePath = isDocker 
        ? path.join('/app/data/public_template', templateName)
        : path.join(dataPath, 'public_template', templateName)
      
      // 检查模板文件是否存在
      try {
        await fs.access(templatePath)
      } catch {
        return res.status(404).json({
          code: 404,
          success: false,
          message: `模板文件不存在: ${templateName}`
        })
      }
      
      // 原有的提示词
      prompt = `根据[${templatePath}]文档的规范，就以下命题，生成一组卡片的json文档在[${userCardPath}]：${topic}`
    }
    
    // 文件夹已经在前面创建，这里只更新状态
    await updateFolderStatus(userCardPath, 'generating', { templateName })
    
    console.log('[GenerateCard API] Starting generation for topic:', topic)
    console.log('[GenerateCard API] Template path:', templatePath)
    console.log('[GenerateCard API] Output path:', userCardPath)
    
    // 输出完整组装后的提示词
    console.log('\n🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥')
    console.log('🎯 [FINAL-PROMPT] ============ COMPLETE ASSEMBLED PROMPT ============')
    console.log('📋 [FINAL-PROMPT] Template:', templateName)
    console.log('📝 [FINAL-PROMPT] Topic:', topic)
    if (isFolder && (templateName === 'cardplanet-Sandra' || templateName === 'cardplanet-Sandra-cover' || templateName === 'cardplanet-Sandra-json')) {
      if (templateName === 'cardplanet-Sandra-cover' || templateName === 'cardplanet-Sandra-json') {
        console.log('📄 [FINAL-PROMPT] Cover:', cover)
      }
      console.log('🎨 [FINAL-PROMPT] Style:', style)
      console.log('🌐 [FINAL-PROMPT] Language:', language)
      console.log('📚 [FINAL-PROMPT] Reference:', referenceContent ? referenceContent.substring(0, 100) + '...' : 'N/A')
    }
    console.log('📐 [FINAL-PROMPT] Length:', prompt.length, 'chars')
    console.log('💬 [FINAL-PROMPT] ========== FULL PROMPT BEGIN ==========\n')
    console.log(prompt)
    console.log('\n💬 [FINAL-PROMPT] ========== FULL PROMPT END ==========')
    console.log('🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥\n')
    
    // 设置超时时间（10分钟）
    const timeout = 600000
    const startTime = Date.now()
    
    // 创建Promise来等待文件生成
    const waitForFile = new Promise((resolve, reject) => {
      let checkInterval
      let timeoutTimer
      
      // 定时检查文件是否生成
      const checkFile = async () => {
        try {
          const files = await fs.readdir(userCardPath)
          console.log(`[GenerateCard API] Checking for generated files in ${userCardPath}, found:`, files)
          // 检测JSON和HTML文件，排除元数据和响应文件
          const generatedFiles = files.filter(f => 
            (f.endsWith('.json') || f.endsWith('.html')) && 
            !f.includes('-response') &&
            !f.startsWith('.') &&  // 排除隐藏文件
            !f.includes('_meta')    // 排除元数据文件
          )
          console.log(`[GenerateCard API] Filtered generated files:`, generatedFiles)
          
          // 对于 cardplanet-Sandra-json 模板，需要等待两个文件都生成
          if (templateName === 'cardplanet-Sandra-json') {
            const htmlFiles = generatedFiles.filter(f => f.endsWith('.html'))
            const jsonFiles = generatedFiles.filter(f => f.endsWith('.json'))
            
            // 必须两个文件都存在才认为完成
            if (htmlFiles.length > 0 && jsonFiles.length > 0) {
              clearInterval(checkInterval)
              clearTimeout(timeoutTimer)
              
              console.log(`[GenerateCard API] Both HTML and JSON files detected for cardplanet-Sandra-json`)
              
              // 读取两个文件
              const result = {
                success: true,
                files: []
              }
              
              // 读取HTML文件
              const htmlFileName = htmlFiles[0]
              const htmlFilePath = path.join(userCardPath, htmlFileName)
              try {
                const htmlContent = await fs.readFile(htmlFilePath, 'utf-8')
                result.files.push({
                  fileName: htmlFileName,
                  path: htmlFilePath,
                  content: htmlContent,
                  fileType: 'html'
                })
                console.log(`[GenerateCard API] HTML file read successfully: ${htmlFileName}`)
              } catch (error) {
                console.error(`[GenerateCard API] Error reading HTML file:`, error)
              }
              
              // 读取JSON文件
              const jsonFileName = jsonFiles[0]
              const jsonFilePath = path.join(userCardPath, jsonFileName)
              try {
                const jsonContent = await fs.readFile(jsonFilePath, 'utf-8')
                try {
                  const parsedJson = JSON.parse(jsonContent)
                  result.files.push({
                    fileName: jsonFileName,
                    path: jsonFilePath,
                    content: parsedJson,
                    fileType: 'json'
                  })
                  console.log(`[GenerateCard API] JSON file read and parsed successfully: ${jsonFileName}`)
                } catch (parseError) {
                  // JSON解析失败，返回原始内容
                  result.files.push({
                    fileName: jsonFileName,
                    path: jsonFilePath,
                    content: jsonContent,
                    fileType: 'json',
                    parseError: true
                  })
                  console.log(`[GenerateCard API] JSON file read (parse failed): ${jsonFileName}`)
                }
              } catch (error) {
                console.error(`[GenerateCard API] Error reading JSON file:`, error)
              }
              
              // 对于 cardplanet-Sandra-json，HTML 是主文件，JSON 用于 pageinfo
              const htmlFile = result.files.find(f => f.fileType === 'html')
              const jsonFile = result.files.find(f => f.fileType === 'json')
              
              // 记录生成的文件到元数据
              await recordGeneratedFiles(userCardPath, [htmlFile?.fileName, jsonFile?.fileName].filter(Boolean))
              
              // 更新文件夹状态为完成
              await updateFolderStatus(userCardPath, 'completed', { 
                completedAt: new Date() 
              })
              
              resolve({
                success: true,
                fileName: htmlFile ? htmlFile.fileName : result.files[0].fileName,
                path: htmlFile ? htmlFile.path : result.files[0].path,
                content: htmlFile ? htmlFile.content : result.files[0].content,
                fileType: 'html',
                allFiles: result.files
              })
            } else {
              console.log(`[GenerateCard API] Waiting for both files... HTML: ${htmlFiles.length}, JSON: ${jsonFiles.length}`)
            }
          } else {
            // 其他模板只需要一个文件
            if (generatedFiles.length > 0) {
              // 找到生成的文件
              clearInterval(checkInterval)
              clearTimeout(timeoutTimer)
              
              const fileName = generatedFiles[0]
              const filePath = path.join(userCardPath, fileName)
              const content = await fs.readFile(filePath, 'utf-8')
              
              // 根据文件类型处理
              if (fileName.endsWith('.json')) {
                try {
                  const jsonContent = JSON.parse(content)
                  resolve({
                    success: true,
                    fileName: fileName,
                    path: filePath,
                    content: jsonContent,
                    fileType: 'json'
                  })
                } catch (parseError) {
                  console.error(`[GenerateCard API] JSON parse error, returning raw content:`, parseError.message)
                  // JSON解析失败时返回原始内容
                  resolve({
                    success: true,
                    fileName: fileName,
                    path: filePath,
                    content: content,  // 返回原始字符串
                    fileType: 'json',
                    parseError: true
                  })
                }
              } else if (fileName.endsWith('.html')) {
                // HTML文件直接返回内容
                resolve({
                  success: true,
                  fileName: fileName,
                  path: filePath,
                  content: content,
                  fileType: 'html'
                })
              }
            }
          }
        } catch (error) {
          // 目录可能还不存在，继续等待
        }
      }
      
      // 每5秒检查一次
      checkInterval = setInterval(checkFile, 5000)
      
      // 设置超时
      timeoutTimer = setTimeout(() => {
        clearInterval(checkInterval)
        reject(new Error(`生成超时，已等待${timeout/1000}秒`))
      }, timeout)
      
      // 立即检查一次（可能文件已存在）
      checkFile()
    })
    
    // 添加连接断开检测
    let connectionClosed = false
    res.on('close', () => {
      connectionClosed = true
      console.warn('[GenerateCard API] Client connection closed')
      clearTimeout(responseTimeout)
    })
    
    res.on('finish', () => {
      clearTimeout(responseTimeout)
    })
    
    // 使用统一的终端服务（与前端完全相同的处理方式）
    const apiId = `card_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    console.log(`[GenerateCard API] >>> Starting unified terminal processing: ${apiId}`)
    
    try {
      // v3.33+ 简化架构: 直接执行 claude -p 命令，无需初始化
      console.log(`[GenerateCard API] Executing simplified Claude command for ${apiId}`)
      
      // 检查连接是否已断开
      if (connectionClosed) {
        console.warn('[GenerateCard API] Connection already closed, aborting Claude execution')
        clearTimeout(responseTimeout)
        return
      }
      
      await apiTerminalService.executeClaude(apiId, prompt)
      console.log(`[GenerateCard API] ✅ Claude command executed (no initialization needed) for ${apiId}`)
      
    } catch (executeError) {
      console.error('[GenerateCard API] Command execution error:', executeError)
      clearTimeout(responseTimeout)
      
      // 清理会话
      try {
        await apiTerminalService.destroySession(apiId)
      } catch (cleanupError) {
        console.error('[GenerateCard API] Failed to cleanup session:', cleanupError)
      }
      
      // 检查是否还能发送响应
      if (!res.headersSent && !connectionClosed) {
        return res.status(500).json({
          code: 500,
          success: false,
          message: 'Claude执行失败',
          error: {
            step: 'claude_execution',
            apiId: apiId,
            details: executeError.message
          }
        })
      }
      return
    }
    
    // 步骤3: 并行等待文件生成和命令输出
    try {
      console.log(`[GenerateCard API] Step 3: Waiting for file generation ${apiId}`)
      
      // 检查连接状态
      if (connectionClosed) {
        console.warn('[GenerateCard API] Connection closed during file generation wait')
        clearTimeout(responseTimeout)
        await apiTerminalService.destroySession(apiId)
        return
      }
      
      // 使用Promise.race - 哪个先完成就用哪个
      const result = await Promise.race([
        waitForFile, // 文件生成检测
        // 添加超时保护
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`生成超时，已等待${timeout/1000}秒`)), timeout)
        ),
        // 添加连接断开检测
        new Promise((_, reject) => {
          const checkConnection = setInterval(() => {
            if (connectionClosed) {
              clearInterval(checkConnection)
              reject(new Error('客户端连接已断开'))
            }
          }, 5000) // 每5秒检查一次
        })
      ])
      
      const elapsedTime = Date.now() - startTime
      console.log(`[GenerateCard API] Generation completed in ${elapsedTime/1000}s`)
      
      // 清理API终端会话
      try {
        await apiTerminalService.destroySession(apiId)
        console.log(`[GenerateCard API] ✅ Session cleaned up: ${apiId}`)
      } catch (cleanupError) {
        console.error('[GenerateCard API] Session cleanup error:', cleanupError)
      }
      
      clearTimeout(responseTimeout)
      
      // 检查是否还能发送响应
      if (res.headersSent) {
        console.warn('[GenerateCard API] Response already sent, skipping')
        return
      }
      
      if (connectionClosed) {
        console.warn('[GenerateCard API] Connection closed, cannot send response')
        return
      }
      
      // 返回成功响应
      const responseData = {
        topic: topic,
        sanitizedTopic: sanitizedTopic,
        templateName: templateName,
        fileName: result.fileName,
        filePath: result.path,
        generationTime: elapsedTime,
        content: result.content,
        apiId: apiId // 用于调试
      }
      
      // 如果有多文件，添加到响应中
      if (result.allFiles) {
        responseData.allFiles = result.allFiles
        
        // 对于 cardplanet-Sandra-json 模板，添加 pageinfo 字段返回 JSON 内容
        if (templateName === 'cardplanet-Sandra-json') {
          const jsonFile = result.allFiles.find(f => f.fileType === 'json')
          if (jsonFile && jsonFile.content) {
            responseData.pageinfo = jsonFile.content
            console.log(`[GenerateCard API] Added pageinfo for cardplanet-Sandra-json template`)
          }
        }
      }
      
      // 最终发送响应前再次检查
      if (!res.headersSent && !connectionClosed) {
        res.json({
          code: 200,
          success: true,
          data: responseData,
          message: '卡片生成成功'
        })
      } else {
        console.warn('[GenerateCard API] Cannot send success response - connection state changed')
      }
      
    } catch (error) {
      console.error('[GenerateCard API] Generation failed:', error)
      clearTimeout(responseTimeout)
      
      // 清理API终端会话
      try {
        await apiTerminalService.destroySession(apiId)
      } catch (cleanupError) {
        console.error('[GenerateCard API] Cleanup error:', cleanupError)
      }
      
      // 检查是否还能发送错误响应
      if (!res.headersSent && !connectionClosed) {
        res.status(500).json({
          code: 500,
          success: false,
          message: error.message || '生成失败',
          error: {
            topic: topic,
            templateName: templateName,
            apiId: apiId,
            step: 'file_generation',
            details: error.toString()
          }
        })
      } else {
        console.warn('[GenerateCard API] Cannot send error response - connection closed or response sent')
      }
    }
    
  } catch (error) {
    console.error('[GenerateCard API] Unexpected error:', error)
    
    // 清理超时计时器（如果存在）
    if (typeof responseTimeout !== 'undefined') {
      clearTimeout(responseTimeout)
    }
    
    // 检查响应是否已发送
    if (!res.headersSent) {
      res.status(500).json({
        code: 500,
        success: false,
        message: '服务器内部错误',
        error: {
          message: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }
      })
    } else {
      console.error('[GenerateCard API] Cannot send error - response already sent')
    }
  }
})

export default router