import express from 'express'
import path from 'path'
import fs from 'fs/promises'
import apiTerminalService from '../../utils/apiTerminalService.js'
import claudeExecutorDirect from '../../services/claudeExecutorDirect.js'
import { authenticateUserOrDefault, ensureUserFolder } from '../../middleware/userAuth.js'
import userService from '../../services/userService.js'
import { buildPromptForTemplate, waitForFileGeneration } from './utils/promptBuilder.js'
import { ensureCardFolder, updateFolderStatus, recordGeneratedFiles } from './utils/folderManager.js'

const router = express.Router()

/**
 * 实时流式生成卡片 (支持Server-Sent Events)
 * POST /api/generate/card/stream
 * 
 * 请求体:
 * {
 *   "topic": "主题名称",
 *   "templateName": "模板文件名" (可选，默认使用 daily-knowledge-card-template.md)
 * }
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
    
    // 设置SSE响应头
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    })
    
    const sendSSE = (event, data) => {
      res.write(`event: ${event}\n`)
      res.write(`data: ${JSON.stringify(data)}\n\n`)
    }
    
    const sanitizedTopic = topic.trim().replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')
    const isDocker = process.env.NODE_ENV === 'production' || process.env.DATA_PATH
    const dataPath = process.env.DATA_PATH || path.join(process.cwd(), 'data')
    
    // 判断模板类型
    const isFolder = !templateName.includes('.md')
    
    // 使用用户特定的路径
    const userCardPath = userService.getUserCardPath(req.user.username, topic)
    
    // 立即创建文件夹（在发送任何SSE事件之前）
    const folderInfo = await ensureCardFolder(userCardPath, topic, sanitizedTopic)
    sendSSE('folder_created', { 
      folderName: sanitizedTopic,
      folderPath: userCardPath,
      folderCreated: !folderInfo.existed,
      folderExisted: folderInfo.existed
    })
    
    try {
      // 使用前置提示词生成参数
      sendSSE('status', { step: 'generating_prompt_parameters' })
      
      console.log(`[Stream API] Step 1: Generating prompt parameters for topic: ${topic}`)
      console.log(`[Stream API] Template: ${templateName}`)
      
      // 发送参数生成开始事件
      if (templateName === 'cardplanet-Sandra' || templateName === 'cardplanet-Sandra-cover' || templateName === 'cardplanet-Sandra-json') {
        sendSSE('parameter_progress', { param: 'all', status: 'generating' })
      }
      
      // 使用直接执行服务生成参数（避免 PTY 兼容性问题）
      const parameters = await claudeExecutorDirect.generateCardParameters(topic, templateName)
      
      // 根据模板类型解构参数
      let cover, style, language, referenceContent
      if (templateName === 'cardplanet-Sandra-cover' || templateName === 'cardplanet-Sandra-json') {
        ({ cover, style, language, reference: referenceContent } = parameters)
        console.log(`[Stream API] ========== PARAMETERS RECEIVED (4-param) ==========`)
        console.log(`[Stream API] Cover: ${cover}`)
        console.log(`[Stream API] Style: ${style}`)
        console.log(`[Stream API] Language: ${language}`)
        console.log(`[Stream API] Reference: ${referenceContent.substring(0, 200)}${referenceContent.length > 200 ? '...' : ''}`)
      } else {
        ({ style, language, reference: referenceContent } = parameters)
        console.log(`[Stream API] ========== PARAMETERS RECEIVED (3-param) ==========`)
        console.log(`[Stream API] Style: ${style}`)
        console.log(`[Stream API] Language: ${language}`)
        console.log(`[Stream API] Reference: ${referenceContent.substring(0, 200)}${referenceContent.length > 200 ? '...' : ''}`)
      }
      
      // 发送参数生成完成事件
      if (templateName === 'cardplanet-Sandra') {
        sendSSE('parameters', { 
          style: style,
          language: language,
          reference: referenceContent.substring(0, 100) + (referenceContent.length > 100 ? '...' : '')
        })
      } else if (templateName === 'cardplanet-Sandra-cover' || templateName === 'cardplanet-Sandra-json') {
        sendSSE('parameters', { 
          cover: cover,
          style: style,
          language: language,
          reference: referenceContent.substring(0, 100) + (referenceContent.length > 100 ? '...' : '')
        })
      }
      
      let prompt
      let templatePath
      
      if (isFolder) {
        // 文件夹模式
        templatePath = isDocker 
          ? path.join('/app/data/public_template', templateName)
          : path.join(dataPath, 'public_template', templateName)
        
        // 检查文件夹是否存在
        const stats = await fs.stat(templatePath)
        if (!stats.isDirectory()) {
          throw new Error('不是有效的模板文件夹')
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

封面：${cover}（如未指定则使用cover.md文档中的默认封面）
风格：${style}（理解其精神内核，不只是表面元素）
语言：${language}
参考：${referenceContent}（如果没提供任何参考信息，请自行检索主题获取更多内容进行生成）（如果提供了链接但无法访问，请自行检索主题获取更多内容进行生成）

从${claudePath}文档开始，按其指引阅读全部6个文档获取创作框架。
特别注意：必须按照html_generation_workflow.md中的双文件输出规范，同时生成HTML文件（主题英文名_style.html）和JSON文件（主题英文名_data.json）。
生成的文件保存在[${userCardPath}]`
        } else if (templateName === 'cardplanet-Sandra-cover') {
          prompt = `你是一位海报设计师，要为"${topic}"创作一套收藏级卡片海报作品。

创作重点：
- 把每张卡片当作独立的艺术海报设计
- 深挖主题的趣味性和视觉潜力
- 用细节和创意打动人心

封面：${cover}（如未指定则使用cover.md文档中的默认封面）
风格：${style}（理解其精神内核，不只是表面元素）
语言：${language}
参考：${referenceContent}（如果没提供任何参考信息，请自行检索主题获取更多内容进行生成）（如果提供了链接但无法访问，请自行检索主题获取更多内容进行生成）

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

从${claudePath}文档开始，按其指引阅读全部4个文档获取创作框架。
记住：规范是创作的基础，但你的目标是艺术品，不是代码任务。
生成的json文档保存在[${userCardPath}]`
        }
        
      } else {
        // 单文件模式
        templatePath = isDocker 
          ? path.join('/app/data/public_template', templateName)
          : path.join(dataPath, 'public_template', templateName)
        
        // 检查模板文件是否存在
        await fs.access(templatePath)
        
        // 原有的提示词
        prompt = `根据[${templatePath}]文档的规范，就以下命题，生成一组卡片的json文档在[${userCardPath}]：${topic}`
      }
      
      await fs.mkdir(userCardPath, { recursive: true })
      
      sendSSE('start', { topic, sanitizedTopic, templatePath, userCardPath })
      
      // 使用构建好的提示词
      const timeout = 600000  // 10分钟超时，适应cardplanet-Sandra模板
      const startTime = Date.now()
      
      console.log('[Stream API] ============ COMPLETE PROMPT ============')
      console.log(prompt)
      console.log('[Stream API] ============ END PROMPT ============')
      
      sendSSE('command', { prompt })
      
      // 创建API会话
      const apiId = `stream_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      
      sendSSE('session', { apiId })
      
      // 监听实时输出
      const outputListener = ({ apiId: outputApiId, data }) => {
        if (outputApiId === apiId) {
          sendSSE('output', { data, timestamp: Date.now() })
        }
      }
      
      apiTerminalService.on('output', outputListener)
      
      // 文件监控Promise
      const waitForFile = new Promise((resolve, reject) => {
        let checkInterval
        let timeoutTimer
        
        const checkFile = async () => {
          try {
            const files = await fs.readdir(userCardPath)
            console.log(`[Stream API] Checking for generated files in ${userCardPath}, found:`, files)
            // 检测JSON和HTML文件
            const generatedFiles = files.filter(f => 
              (f.endsWith('.json') || f.endsWith('.html')) && 
              !f.includes('-response') &&
              !f.startsWith('.') &&  // 排除隐藏文件
              !f.includes('_meta')    // 排除元数据文件
            )
            console.log(`[Stream API] Filtered generated files:`, generatedFiles)
            
            // 对于 cardplanet-Sandra-json 模板，需要等待两个文件都生成
            if (templateName === 'cardplanet-Sandra-json') {
              const htmlFiles = generatedFiles.filter(f => f.endsWith('.html'))
              const jsonFiles = generatedFiles.filter(f => f.endsWith('.json'))
              
              // 必须两个文件都存在才认为完成
              if (htmlFiles.length > 0 && jsonFiles.length > 0) {
                clearInterval(checkInterval)
                clearTimeout(timeoutTimer)
                
                console.log(`[Stream API] Both HTML and JSON files detected for cardplanet-Sandra-json`)
                
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
                  console.log(`[Stream API] HTML file read successfully: ${htmlFileName}`)
                } catch (error) {
                  console.error(`[Stream API] Error reading HTML file:`, error)
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
                    console.log(`[Stream API] JSON file read and parsed successfully: ${jsonFileName}`)
                  } catch (parseError) {
                    // JSON解析失败，返回原始内容
                    result.files.push({
                      fileName: jsonFileName,
                      path: jsonFilePath,
                      content: jsonContent,
                      fileType: 'json',
                      parseError: true
                    })
                    console.log(`[Stream API] JSON file read (parse failed): ${jsonFileName}`)
                  }
                } catch (error) {
                  console.error(`[Stream API] Error reading JSON file:`, error)
                }
                
                // 返回主文件信息（优先返回JSON）
                const primaryFile = result.files.find(f => f.fileType === 'json') || result.files[0]
                resolve({
                  ...result,
                  ...primaryFile,
                  allFiles: result.files
                })
              } else {
                console.log(`[Stream API] Waiting for both files... HTML: ${htmlFiles.length}, JSON: ${jsonFiles.length}`)
              }
            } else {
              // 其他模板只需要一个文件
              if (generatedFiles.length > 0) {
                clearInterval(checkInterval)
                clearTimeout(timeoutTimer)
                
                const fileName = generatedFiles[0]
                const filePath = path.join(userCardPath, fileName)
                console.log(`[Stream API] Reading file: ${filePath}`)
                
                try {
                  const content = await fs.readFile(filePath, 'utf-8')
                  console.log(`[Stream API] File read successfully, length: ${content.length}`)
                  
                  // 根据文件类型处理
                  if (fileName.endsWith('.json')) {
                    try {
                      const jsonContent = JSON.parse(content)
                      console.log(`[Stream API] JSON parsed successfully`)
                      resolve({
                        success: true,
                        fileName: fileName,
                        path: filePath,
                        content: jsonContent,
                        fileType: 'json'
                      })
                    } catch (parseError) {
                      console.error(`[Stream API] JSON parse error, returning raw content:`, parseError.message)
                      // JSON解析失败时返回原始内容，让前端处理
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
                    console.log(`[Stream API] HTML file detected`)
                    resolve({
                      success: true,
                      fileName: fileName,
                      path: filePath,
                      content: content,
                      fileType: 'html'
                    })
                  }
                } catch (readError) {
                  console.error(`[Stream API] File read error:`, readError)
                  // 文件可能还在写入中，继续等待
                }
              }
            }
          } catch (error) {
            // 目录可能还不存在，继续等待
          }
        }
        
        checkInterval = setInterval(checkFile, 2000)
        timeoutTimer = setTimeout(() => {
          clearInterval(checkInterval)
          reject(new Error(`生成超时，已等待${timeout/1000}秒`))
        }, timeout)
        
        checkFile()
      })
      
      try {
        // 直接执行Claude命令
        sendSSE('status', { step: 'executing_claude' })
        await apiTerminalService.executeClaude(apiId, prompt)
        sendSSE('status', { step: 'claude_executed' })
        
        // 等待文件生成
        sendSSE('status', { step: 'waiting_file_generation' })
        
        // 只依赖文件检测，文件生成即视为成功
        const fileResult = await waitForFile
        console.log(`[Stream API] File detection completed, fileResult:`, fileResult.fileName)
        
        const elapsedTime = Date.now() - startTime
        console.log(`[Stream API] Elapsed time: ${elapsedTime}ms`)
        
        // 发送成功结果
        console.log(`[Stream API] Sending success event...`)
        const successData = {
          topic,
          sanitizedTopic,
          templateName,
          fileName: fileResult.fileName,
          filePath: fileResult.path,
          generationTime: elapsedTime,
          content: fileResult.content,
          apiId
        }
        
        // 如果有多文件，添加到响应中
        if (fileResult.allFiles) {
          successData.allFiles = fileResult.allFiles
        }
        
        sendSSE('success', successData)
        console.log(`[Stream API] Success event sent`)
        
        // 记录生成的文件
        const fileNames = fileResult.allFiles 
          ? fileResult.allFiles.map(f => f.fileName) 
          : [fileResult.fileName]
        await recordGeneratedFiles(userCardPath, fileNames)
        
        // 更新文件夹状态为完成
        await updateFolderStatus(userCardPath, 'completed', { 
          completedAt: new Date(),
          generationTime: elapsedTime
        })
        
      } catch (executeError) {
        sendSSE('error', { 
          message: executeError.message || '执行失败',
          apiId 
        })
        
        // 更新文件夹状态为失败
        await updateFolderStatus(userCardPath, 'failed', { 
          errorMessage: executeError.message,
          failedAt: new Date()
        })
      } finally {
        // 清理
        apiTerminalService.removeListener('output', outputListener)
        await apiTerminalService.destroySession(apiId)
        sendSSE('cleanup', { apiId })
        res.end()
      }
      
    } catch (error) {
      sendSSE('error', { message: error.message })
      res.end()
    }
    
  } catch (error) {
    console.error('[Stream Generate API] Unexpected error:', error)
    if (!res.headersSent) {
      res.status(500).json({
        code: 500,
        success: false,
        message: '服务器内部错误',
        error: error.message
      })
    }
  }
})

export default router