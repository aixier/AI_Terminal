import express from 'express'
import path from 'path'
import fs from 'fs/promises'
import apiTerminalService from '../../utils/apiTerminalService.js'
import claudeExecutorDirect from '../../services/claudeExecutorDirect.js'
import { authenticateUserOrDefault, ensureUserFolder } from '../../middleware/userAuth.js'
import userService from '../../services/userService.js'
import { ensureCardFolder, updateFolderStatus, recordGeneratedFiles } from './utils/folderManager.js'
import { SessionMetadata } from './utils/sessionMetadata.js'
import { generateFourFiles, isDailyKnowledgeTemplate } from './utils/fileGenerator.js'

// 任务优化 #2: 并发处理优化 - 添加请求队列管理
const activeRequests = new Map(); // 活跃请求跟踪
const MAX_CONCURRENT_REQUESTS = 7; // 基于测试结果，最多同时处理7个请求

// 任务优化 #3: 错误处理增强 - 错误码分类
const ERROR_CODES = {
  CONCURRENT_LIMIT: 'E001_CONCURRENT_LIMIT',
  RESOURCE_UNAVAILABLE: 'E002_RESOURCE_UNAVAILABLE', 
  TIMEOUT: 'E003_TIMEOUT',
  CLAUDE_API_ERROR: 'E004_CLAUDE_API_ERROR',
  FILE_GENERATION_ERROR: 'E005_FILE_GENERATION_ERROR',
  PARAMETER_GENERATION_ERROR: 'E006_PARAMETER_GENERATION_ERROR',
  TEMPLATE_NOT_FOUND: 'E007_TEMPLATE_NOT_FOUND'
};

// 任务优化 #3: 自动重试机制
const retryWithBackoff = async (fn, maxRetries = 2, baseDelay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      const delay = baseDelay * Math.pow(2, i);
      console.log(`[Retry] Attempt ${i + 1}/${maxRetries} failed, retrying in ${delay}ms:`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

const router = express.Router()

/**
 * 生成卡片并返回JSON内容 (简化版 v3.33+)
 * POST /card
 * 
 * 新架构: 直接使用 claude --dangerously-skip-permissions -p "[prompt]"
 * 无需复杂的Claude初始化流程
 */
router.post('/', authenticateUserOrDefault, ensureUserFolder, async (req, res) => {
  // 任务优化 #7: 性能监控 - 请求开始时间
  const requestStartTime = Date.now();
  const requestId = `card_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  
  console.log(`[Card API] Request ${requestId} started at ${new Date().toISOString()}`);
  console.log(`[Card API] Current active requests: ${activeRequests.size}`);
  
  // 任务优化 #2: 并发处理优化 - 检查并发限制
  if (activeRequests.size >= MAX_CONCURRENT_REQUESTS) {
    console.warn(`[Card API] Concurrent limit reached: ${activeRequests.size}/${MAX_CONCURRENT_REQUESTS}`);
    return res.status(429).json({
      code: 429,
      success: false,
      message: '服务器繁忙，请稍后重试或使用异步接口',
      error: {
        errorCode: ERROR_CODES.CONCURRENT_LIMIT,
        activeRequests: activeRequests.size,
        maxConcurrent: MAX_CONCURRENT_REQUESTS,
        suggestion: 'Please use POST /api/generate/card/async for better concurrency support'
      },
      retryAfter: 30
    });
  }
  
  // 添加到活跃请求跟踪
  activeRequests.set(requestId, {
    startTime: requestStartTime,
    topic: req.body.topic,
    templateName: req.body.templateName
  });
  
  try {
    const { 
      topic, 
      templateName = 'daily-knowledge-card-template.md',
      style: userStyle,      // 用户传入的风格参数（可选）
      language: userLanguage, // 用户传入的语言参数（可选）
      reference: userReference, // 用户传入的参考参数（可选）
      token: userToken         // 用户传入的token（可选），用于指定生成到特定用户
    } = req.body
    
    // 任务优化 #3: 错误处理增强 - 参数验证改进
    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      activeRequests.delete(requestId); // 清理请求跟踪
      return res.status(400).json({
        code: 400,
        success: false,
        message: '主题(topic)参数不能为空',
        error: {
          errorCode: ERROR_CODES.PARAMETER_GENERATION_ERROR,
          field: 'topic',
          received: typeof topic,
          expected: 'non-empty string'
        }
      })
    }
    
    // 额外的输入验证
    if (topic.length > 100) {
      activeRequests.delete(requestId);
      return res.status(400).json({
        code: 400,
        success: false,
        message: '主题名称不能超过100个字符',
        error: {
          errorCode: ERROR_CODES.PARAMETER_GENERATION_ERROR,
          field: 'topic',
          length: topic.length,
          maxLength: 100
        }
      })
    }
    
    // 清理主题名称，用于文件夹命名
    const sanitizedTopic = topic.trim().replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')
    
    // 根据环境确定路径
    const isDocker = process.env.NODE_ENV === 'production' || process.env.DATA_PATH
    const dataPath = process.env.DATA_PATH || path.join(process.cwd(), 'data')
    
    // 判断模板类型
    const isFolder = !templateName.includes('.md')
    
    // 处理用户token参数，如果传入了token，尝试查找对应用户
    let targetUser = req.user; // 默认使用认证中间件设置的用户
    if (userToken) {
      console.log(`[Card API] User token provided in request: ${userToken}`);
      const tokenUser = await userService.findUserByToken(userToken);
      if (tokenUser) {
        targetUser = tokenUser;
        console.log(`[Card API] Using token-specified user: ${tokenUser.username}`);
      } else {
        console.log(`[Card API] Token user not found, using default: ${req.user.username}`);
      }
    }
    
    // 使用目标用户的路径
    const userCardPath = userService.getUserCardPath(targetUser.username, topic)
    
    // 立即创建文件夹（在生成参数之前）
    console.log(`[GenerateCard API] Creating folder immediately for topic: ${topic}`)
    console.log(`[GenerateCard API] Target user: ${targetUser.username}`)
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
      // 检查是否有用户传入的参数
      const hasUserParams = userStyle || userLanguage || userReference;
      
      if (hasUserParams) {
        console.log(`[Card API] ${requestId}: Using user-provided parameters`);
        console.log(`[Card API] User Style: ${userStyle || 'not provided'}`);
        console.log(`[Card API] User Language: ${userLanguage || 'not provided'}`);
        console.log(`[Card API] User Reference: ${userReference ? userReference.substring(0, 100) + '...' : 'not provided'}`);
      }
      
      // 任务优化 #3: 自动重试机制 - 参数生成重试
      console.log(`[Card API] ${requestId}: Generating parameters with retry mechanism`);
      parameters = await retryWithBackoff(
        () => claudeExecutorDirect.generateCardParameters(topic, templateName, {
          style: userStyle,
          language: userLanguage,
          reference: userReference
        }),
        2, // 最多重试2次
        2000 // 起始延迟2秒
      );
      console.log(`[Card API] ${requestId}: Parameters generated successfully`);
    } catch (paramError) {
      console.error(`[Card API] ${requestId}: Failed to generate parameters after retries:`, paramError)
      activeRequests.delete(requestId); // 清理请求跟踪
      clearTimeout(responseTimeout)
      if (!res.headersSent) {
        return res.status(500).json({
          code: 500,
          success: false,
          message: '生成参数失败，已重试多次',
          error: {
            errorCode: ERROR_CODES.PARAMETER_GENERATION_ERROR,
            step: 'parameter_generation',
            requestId: requestId,
            details: paramError.message,
            retryCount: 2
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
      
      // 任务优化 #3: 错误处理增强 - 模板验证改进
      try {
        const stats = await fs.stat(templatePath)
        if (!stats.isDirectory()) {
          throw new Error('不是有效的模板文件夹')
        }
      } catch (statError) {
        activeRequests.delete(requestId); // 清理请求跟踪
        return res.status(404).json({
          code: 404,
          success: false,
          message: `模板文件夹不存在: ${templateName}`,
          error: {
            errorCode: ERROR_CODES.TEMPLATE_NOT_FOUND,
            templateName: templateName,
            templatePath: templatePath,
            requestId: requestId,
            details: statError.message
          }
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
      
      // 任务优化 #3: 错误处理增强 - 单文件模板验证改进
      try {
        await fs.access(templatePath)
      } catch (accessError) {
        activeRequests.delete(requestId); // 清理请求跟踪
        return res.status(404).json({
          code: 404,
          success: false,
          message: `模板文件不存在: ${templateName}`,
          error: {
            errorCode: ERROR_CODES.TEMPLATE_NOT_FOUND,
            templateName: templateName,
            templatePath: templatePath,
            requestId: requestId,
            details: accessError.message
          }
        })
      }
      
      // 原有的提示词
      prompt = `根据[${templatePath}]文档的规范，就以下命题：${topic}，生成一组卡片的json文档在[${userCardPath}]文件夹下`
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
                  filePath: htmlFilePath,
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
                    filePath: jsonFilePath,
                    path: jsonFilePath,
                    content: parsedJson,
                    fileType: 'json'
                  })
                  console.log(`[GenerateCard API] JSON file read and parsed successfully: ${jsonFileName}`)
                } catch (parseError) {
                  // JSON解析失败，返回原始内容
                  result.files.push({
                    fileName: jsonFileName,
                    filePath: jsonFilePath,
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
                filePath: htmlFile ? htmlFile.filePath : result.files[0].filePath,
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
                    filePath: filePath,
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
                    filePath: filePath,
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
                  filePath: filePath,
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
    
    // 任务优化 #4: 统一会话管理 - 使用requestId作为apiId确保一致性
    const apiId = requestId; // 使用同一个ID确保追踪一致性
    console.log(`[GenerateCard API] >>> Starting unified terminal processing: ${apiId}`)
    console.log(`[GenerateCard API] Memory usage before Claude execution:`, process.memoryUsage())
    
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
      console.error(`[GenerateCard API] ${requestId}: Command execution error:`, executeError)
      activeRequests.delete(requestId); // 清理请求跟踪
      clearTimeout(responseTimeout)
      
      // 清理会话
      try {
        await apiTerminalService.destroySession(apiId)
        console.log(`[GenerateCard API] ${requestId}: Session cleaned up after execute error`)
      } catch (cleanupError) {
        console.error(`[GenerateCard API] ${requestId}: Failed to cleanup session:`, cleanupError)
      }
      
      // 检查是否还能发送响应
      if (!res.headersSent && !connectionClosed) {
        return res.status(500).json({
          code: 500,
          success: false,
          message: 'Claude执行失败',
          error: {
            errorCode: ERROR_CODES.CLAUDE_API_ERROR,
            step: 'claude_execution',
            requestId: requestId,
            apiId: apiId,
            details: executeError.message,
            memoryUsage: process.memoryUsage()
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
      const totalRequestTime = Date.now() - requestStartTime
      console.log(`[GenerateCard API] ${requestId}: Generation completed in ${elapsedTime/1000}s (total request time: ${totalRequestTime/1000}s)`)
      console.log(`[GenerateCard API] ${requestId}: Memory usage after completion:`, process.memoryUsage())
      
      // 准备响应数据 - 放在元数据处理之前
      const responseData = {
        topic: topic,
        sanitizedTopic: sanitizedTopic,
        templateName: templateName,
        fileName: result.fileName,
        filePath: result.path,
        path: result.path,
        generationTime: elapsedTime,
        content: result.content,
        apiId: apiId
      }
      
      // === 新增：通用元数据记录和daily模板特殊处理 ===
      try {
        console.log(`[GenerateCard API] ${requestId}: Starting meta processing`)
        
        // 1. 创建会话元数据
        const metadata = new SessionMetadata(targetUser.username, topic, templateName, '/api/generate/card', requestId)
        
        // 设置请求参数
        if (cover || style || language || referenceContent) {
          metadata.setUserParameters({ 
            cover, 
            style, 
            language, 
            reference: referenceContent 
          })
        }
        
        // 设置处理信息
        metadata.setPaths(templatePath, userCardPath)
        metadata.setAssembledPrompt(prompt)
        
        // 记录主要生成步骤
        metadata.logStep('json_generation', 'completed', {
          fileName: result.fileName,
          filePath: result.path,
          fileSize: result.content?.length || 0
        })
        
        // 2. 记录生成的文件
        if (result.allFiles && result.allFiles.length > 0) {
          for (const file of result.allFiles) {
            await metadata.addFile(file.fileName, file.path, file.fileType)
          }
        } else {
          await metadata.addFile(result.fileName, result.path, result.fileType)
        }
        
        // 3. 检查是否为daily模板，需要四文件生成
        if (isDailyKnowledgeTemplate(templateName)) {
          console.log(`[GenerateCard API] ${requestId}: Daily template detected, starting four-file generation`)
          
          try {
            // 执行四文件生成流程
            const fourFileResult = await generateFourFiles({
              userId: targetUser.username,
              topic,
              templateName,
              outputDir: userCardPath,
              jsonFilePath: result.path,
              baseName: sanitizedTopic, // 使用清理后的主题名作为基础文件名
              requestId,
              apiEndpoint: '/api/generate/card'
            })
            
            if (fourFileResult.success) {
              console.log(`[GenerateCard API] ${requestId}: Four-file generation completed`)
              // 更新响应数据以包含所有生成的文件
              responseData.fourFileGeneration = {
                success: true,
                files: fourFileResult.files
              }
            } else {
              console.warn(`[GenerateCard API] ${requestId}: Four-file generation failed:`, fourFileResult.errors)
              responseData.fourFileGeneration = {
                success: false,
                errors: fourFileResult.errors
              }
            }
          } catch (fourFileError) {
            console.error(`[GenerateCard API] ${requestId}: Four-file generation error:`, fourFileError)
            responseData.fourFileGeneration = {
              success: false,
              error: fourFileError.message
            }
          }
        } else {
          // 非daily模板，只记录完成并保存元数据
          metadata.complete('success')
          const metaFilePath = await metadata.save(userCardPath)
          console.log(`[GenerateCard API] ${requestId}: Meta file saved: ${metaFilePath}`)
        }
        
      } catch (metaError) {
        console.error(`[GenerateCard API] ${requestId}: Meta processing error:`, metaError)
        // 元数据处理失败不影响主流程
      }
      
      // 任务优化 #4: 统一会话管理 - 改进清理逻辑
      try {
        await apiTerminalService.destroySession(apiId)
        console.log(`[GenerateCard API] ${requestId}: ✅ Session cleaned up successfully`)
      } catch (cleanupError) {
        console.error(`[GenerateCard API] ${requestId}: Session cleanup error:`, cleanupError)
      } finally {
        // 无论如何都要清理请求跟踪
        activeRequests.delete(requestId);
        console.log(`[GenerateCard API] ${requestId}: Request tracking cleaned up, active requests: ${activeRequests.size}`);
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
      
      // 响应数据已在元数据处理前准备好
      
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
      console.error(`[GenerateCard API] ${requestId}: Generation failed:`, error)
      activeRequests.delete(requestId); // 清理请求跟踪
      clearTimeout(responseTimeout)
      
      // 清理API终端会话
      try {
        await apiTerminalService.destroySession(apiId)
        console.log(`[GenerateCard API] ${requestId}: Session cleaned up after generation error`)
      } catch (cleanupError) {
        console.error(`[GenerateCard API] ${requestId}: Cleanup error:`, cleanupError)
      }
      
      // 任务优化 #3: 错误处理增强 - 根据错误类型返回相应错误码
      const isTimeout = error.message && error.message.includes('超时');
      const errorCode = isTimeout ? ERROR_CODES.TIMEOUT : ERROR_CODES.FILE_GENERATION_ERROR;
      
      // 检查是否还能发送错误响应
      if (!res.headersSent && !connectionClosed) {
        res.status(500).json({
          code: 500,
          success: false,
          message: error.message || '生成失败',
          error: {
            errorCode: errorCode,
            topic: topic,
            templateName: templateName,
            requestId: requestId,
            apiId: apiId,
            step: 'file_generation',
            details: error.toString(),
            totalRequestTime: Date.now() - requestStartTime,
            activeRequestsCount: activeRequests.size
          }
        })
      } else {
        console.warn(`[GenerateCard API] ${requestId}: Cannot send error response - connection closed or response sent`)
      }
    }
    
  } catch (error) {
    console.error(`[GenerateCard API] ${requestId}: Unexpected error:`, error)
    
    // 任务优化: 确保清理所有资源
    activeRequests.delete(requestId); // 清理请求跟踪
    
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
          errorCode: ERROR_CODES.RESOURCE_UNAVAILABLE,
          requestId: requestId,
          message: error.message,
          totalRequestTime: Date.now() - requestStartTime,
          activeRequestsCount: activeRequests.size,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }
      })
    } else {
      console.error(`[GenerateCard API] ${requestId}: Cannot send error - response already sent`)
    }
  }
})

export default router