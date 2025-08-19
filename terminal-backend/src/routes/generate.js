import express from 'express'
import path from 'path'
import fs from 'fs/promises'
import apiTerminalService from '../utils/apiTerminalService.js'
import terminalManager from '../services/terminalManager.js'
import { authenticateUser, authenticateUserOrDefault, ensureUserFolder } from '../middleware/userAuth.js'
import userService from '../services/userService.js'

const router = express.Router()

/**
 * 生成卡片并返回JSON内容 (简化版 v3.33+)
 * POST /api/generate/card
 * 
 * 新架构: 直接使用 claude --dangerously-skip-permissions -p "[prompt]"
 * 无需复杂的Claude初始化流程
 * 
 * 请求体:
 * {
 *   "topic": "主题名称",
 *   "templateName": "模板文件名" (可选，默认使用 daily-knowledge-card-template.md),
 *   "style": "风格描述" (可选，默认为根据主题理解其精神内核),
 *   "language": "语言类型" (可选，默认根据主题的语言确定),
 *   "reference": "参考资料" (可选，默认为检索主题相关内容)
 * }
 */
router.post('/card', authenticateUserOrDefault, ensureUserFolder, async (req, res) => {
  try {
    const { 
      topic, 
      templateName = 'daily-knowledge-card-template.md'
      // style 和 language 参数将通过前置提示词生成
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
    
    // 构建模板路径和提示词
    let templatePath, prompt
    
    // 生成参考文档的函数
    const generateReferenceDoc = async (topic, sanitizedTopic) => {
      try {
        const { workspacePath } = userService.getUserWorkspacePath(req.user.username)
        const cardWorkspacePath = path.join(workspacePath, 'card')
        await fs.mkdir(cardWorkspacePath, { recursive: true })
        
        const refFileName = `${sanitizedTopic}_ref.md`
        const refFilePath = path.join(cardWorkspacePath, refFileName)
        
        // 检查文件是否已存在，如果存在就跳过生成
        try {
          await fs.access(refFilePath)
          console.log(`[GenerateCard API] Reference file already exists: ${refFilePath}`)
          const existingContent = await fs.readFile(refFilePath, 'utf-8')
          return existingContent.trim()
        } catch {
          // 文件不存在，需要生成
        }
        
        console.log(`[GenerateCard API] Generating reference document for: ${topic}`)
        console.log(`[GenerateCard API] Reference file path: ${refFilePath}`)
        console.log(`[GenerateCard API] Reference file name: ${refFileName}`)
        
        // 创建参考文档生成的API会话
        const refApiId = `ref_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
        
        // 使用Write命令格式生成参考文档，使用绝对路径
        const refGenerationPrompt = `如果没有任何参考信息，或参考信息中提供了链接但无法访问，请自行检索 ${topic}获取更多内容进行生成。生成的md文档保存在${refFilePath}`
        
        console.log(`[GenerateCard API] Full reference generation prompt:`)
        console.log(refGenerationPrompt)
        
        await apiTerminalService.executeClaude(refApiId, refGenerationPrompt)
        
        // 使用改进的文件检测逻辑
        const maxWaitTime = 120000 // 120秒超时
        const checkInterval = 1000 // 每秒检查一次
        const startTime = Date.now()
        let fileGenerated = false
        
        console.log(`[GenerateCard API] Waiting for reference document generation (max ${maxWaitTime/1000}s)...`)
        
        // 定期检查文件是否生成
        while (Date.now() - startTime < maxWaitTime) {
          try {
            // 检查文件是否存在
            await fs.access(refFilePath)
            
            // 读取文件内容
            const content = await fs.readFile(refFilePath, 'utf-8')
            
            // 确保文件有实际内容
            if (content.trim().length > 10) {
              const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1)
              console.log(`[GenerateCard API] Reference document generated successfully in ${elapsedTime}s: ${refFileName}`)
              console.log(`[GenerateCard API] Reference content preview: ${content.substring(0, 300)}...`)
              fileGenerated = true
              
              // 清理会话
              await apiTerminalService.destroySession(refApiId)
              return content.trim()
            }
          } catch (error) {
            // 文件还未生成或读取失败，继续等待
            if ((Date.now() - startTime) % 10000 === 0) {
              // 每10秒输出一次状态
              const elapsed = Math.floor((Date.now() - startTime) / 1000)
              console.log(`[GenerateCard API] Still waiting for reference document... (${elapsed}s elapsed)`)
            }
          }
          
          // 等待下一次检查
          await new Promise(resolve => setTimeout(resolve, checkInterval))
        }
        
        // 超时处理
        if (!fileGenerated) {
          console.warn(`[GenerateCard API] Reference document generation timeout after ${maxWaitTime/1000}s for: ${topic}`)
          // 清理会话
          await apiTerminalService.destroySession(refApiId)
        }
        
        console.warn(`[GenerateCard API] Reference document generation timeout for: ${topic}`)
        console.log(`[GenerateCard API] Returning default reference content`)
        return '暂未获取到相关参考资料'
        
      } catch (error) {
        console.error(`[GenerateCard API] Error generating reference document:`, error)
        console.log(`[GenerateCard API] Returning fallback reference content`)
        return '参考资料生成失败'
      }
    }
    
    // 使用前置提示词生成参数
    console.log(`[GenerateCard API] Step 1: Generating prompt parameters using pre-prompts for topic: ${topic}`)
    console.log(`[GenerateCard API] Sanitized topic: ${sanitizedTopic}`)
    
    // 生成三个参数的前置提示词
    let style = ''
    let language = ''
    let referenceContent = ''
    
    if (templateName === 'cardplanet-Sandra') {
      // 通过Claude生成三个参数
      const generatePromptParam = async (promptText) => {
        try {
          const paramApiId = `param_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
          await apiTerminalService.executeClaude(paramApiId, promptText)
          
          // 等待生成完成（最多10秒）
          await new Promise(resolve => setTimeout(resolve, 3000))
          
          // 获取输出
          const output = await apiTerminalService.getLastOutput(paramApiId)
          
          // 清理会话
          await apiTerminalService.destroySession(paramApiId)
          
          return output?.trim() || ''
        } catch (error) {
          console.error(`[GenerateCard API] Error generating parameter:`, error)
          return ''
        }
      }
      
      // 定义三个前置提示词
      const stylePrompt = `根据"${topic}"类别(心理/知识/创意等)按CLAUDE.md第五点（风格选择指南）自动匹配原则选择合适风格。直接返回风格描述，不要解释。`
      
      const languagePrompt = `请根据"${topic}"判断语言。如果包含中文返回"中文"，纯英文返回"英文"，混合返回"中英双语"。直接返回语言类型。`
      
      const referencePrompt = `如果没有任何参考信息，或参考信息中提供了链接但无法访问，请自行检索"${topic}"获取更多内容进行生成。返回核心要点（100字以内）。`
      
      console.log(`[GenerateCard API] ========== STYLE PROMPT ==========`)
      console.log(stylePrompt)
      console.log(`[GenerateCard API] ==================================`)
      style = await generatePromptParam(stylePrompt)
      if (!style) style = '根据主题理解其精神内核，自动选择合适的风格'
      console.log(`[GenerateCard API] Generated style: ${style}`)
      
      console.log(`[GenerateCard API] ========== LANGUAGE PROMPT ==========`)
      console.log(languagePrompt)
      console.log(`[GenerateCard API] =====================================`)
      language = await generatePromptParam(languagePrompt)
      if (!language) language = '根据主题的语言确定语言类型'
      console.log(`[GenerateCard API] Generated language: ${language}`)
      
      console.log(`[GenerateCard API] ========== REFERENCE PROMPT ==========`)
      console.log(referencePrompt)
      console.log(`[GenerateCard API] ======================================`)
      referenceContent = await generatePromptParam(referencePrompt)
      if (!referenceContent) referenceContent = '如果提供了链接但无法访问，请自行检索主题获取更多内容进行生成'
      console.log(`[GenerateCard API] Generated reference: ${referenceContent}`)
      
    } else {
      // 非cardplanet-Sandra模板不需要这些参数
      referenceContent = ''
    }
    
    console.log(`[GenerateCard API] Generated Style: ${style}`)
    console.log(`[GenerateCard API] Generated Language: ${language}`)
    console.log(`[GenerateCard API] Generated Reference: ${referenceContent.substring(0, 200)}...`)
    
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
    
    // 确保输出目录存在
    await fs.mkdir(userCardPath, { recursive: true })
    
    console.log('[GenerateCard API] Starting generation for topic:', topic)
    console.log('[GenerateCard API] Template path:', templatePath)
    console.log('[GenerateCard API] Output path:', userCardPath)
    console.log('[GenerateCard API] ============ COMPLETE PROMPT ============')
    console.log(prompt)
    console.log('[GenerateCard API] ============ END PROMPT ============')
    
    // 设置超时时间（7分钟）- cardplanet-Sandra模板需要更长时间
    const timeout = 420000
    const startTime = Date.now()
    
    // 创建Promise来等待文件生成
    const waitForFile = new Promise((resolve, reject) => {
      let checkInterval
      let timeoutTimer
      
      // 定时检查文件是否生成
      const checkFile = async () => {
        try {
          const files = await fs.readdir(userCardPath)
          console.log(`[Stream API] Checking for generated files in ${userCardPath}, found:`, files)
          // 检测JSON和HTML文件（cardplanet-Sandra模板生成HTML）
          const generatedFiles = files.filter(f => (f.endsWith('.json') || f.endsWith('.html')) && !f.includes('-response'))
          console.log(`[Stream API] Filtered generated files:`, generatedFiles)
          
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
        } catch (error) {
          // 目录可能还不存在，继续等待
        }
      }
      
      // 每2秒检查一次
      checkInterval = setInterval(checkFile, 2000)
      
      // 设置超时
      timeoutTimer = setTimeout(() => {
        clearInterval(checkInterval)
        reject(new Error(`生成超时，已等待${timeout/1000}秒`))
      }, timeout)
      
      // 立即检查一次（可能文件已存在）
      checkFile()
    })
    
    // 使用统一的终端服务（与前端完全相同的处理方式）
    const apiId = `card_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    console.log(`[GenerateCard API] >>> Starting unified terminal processing: ${apiId}`)
    
    try {
      // v3.33+ 简化架构: 直接执行 claude -p 命令，无需初始化
      console.log(`[GenerateCard API] Executing simplified Claude command for ${apiId}`)
      await apiTerminalService.executeClaude(apiId, prompt)
      console.log(`[GenerateCard API] ✅ Claude command executed (no initialization needed) for ${apiId}`)
      
    } catch (executeError) {
      console.error('[GenerateCard API] Command execution error:', executeError)
      // 清理会话
      await apiTerminalService.destroySession(apiId)
      throw executeError
    }
    
    // 步骤3: 并行等待文件生成和命令输出
    try {
      console.log(`[GenerateCard API] Step 3: Waiting for file generation ${apiId}`)
      
      // 使用Promise.race - 哪个先完成就用哪个
      const result = await Promise.race([
        waitForFile, // 文件生成检测
        // 添加超时保护
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`生成超时，已等待${timeout/1000}秒`)), timeout)
        )
      ])
      
      const elapsedTime = Date.now() - startTime
      console.log(`[GenerateCard API] Generation completed in ${elapsedTime/1000}s`)
      
      // 清理API终端会话
      await apiTerminalService.destroySession(apiId)
      console.log(`[GenerateCard API] ✅ Session cleaned up: ${apiId}`)
      
      // 返回成功响应
      res.json({
        code: 200,
        success: true,
        data: {
          topic: topic,
          sanitizedTopic: sanitizedTopic,
          templateName: templateName,
          fileName: result.fileName,
          filePath: result.path,
          generationTime: elapsedTime,
          content: result.content,
          apiId: apiId // 用于调试
        },
        message: '卡片生成成功'
      })
      
    } catch (error) {
      console.error('[GenerateCard API] Generation failed:', error)
      
      // 清理API终端会话
      await apiTerminalService.destroySession(apiId)
      
      res.status(500).json({
        code: 500,
        success: false,
        message: error.message || '生成失败',
        error: {
          topic: topic,
          templateName: templateName,
          apiId: apiId,
          details: error.toString()
        }
      })
    }
    
  } catch (error) {
    console.error('[GenerateCard API] Unexpected error:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '服务器内部错误',
      error: error.message
    })
  }
})

/**
 * 获取可用的模板列表
 * GET /api/generate/templates
 */
router.get('/templates', async (_req, res) => {
  try {
    const isDocker = process.env.NODE_ENV === 'production' || process.env.DATA_PATH
    const dataPath = process.env.DATA_PATH || path.join(process.cwd(), 'data')
    const templatesPath = isDocker
      ? '/app/data/public_template'
      : path.join(dataPath, 'public_template')
    
    const items = await fs.readdir(templatesPath, { withFileTypes: true })
    const templates = []
    
    for (const item of items) {
      if (item.isDirectory()) {
        // 文件夹模板
        templates.push({
          fileName: item.name,
          displayName: item.name,
          type: 'folder'
        })
      } else if (item.name.endsWith('.md')) {
        // 单文件模板
        templates.push({
          fileName: item.name,
          displayName: item.name.replace('.md', '').replace(/-/g, ' '),
          type: 'file'
        })
      }
    }
    
    res.json({
      code: 200,
      success: true,
      templates: templates,
      message: 'success'
    })
  } catch (error) {
    res.status(500).json({
      code: 500,
      success: false,
      message: error.message
    })
  }
})

/**
 * 检查生成状态（用于轮询）
 * GET /api/generate/status/:topic
 */
router.get('/status/:topic', authenticateUserOrDefault, async (req, res) => {
  try {
    const { topic } = req.params
    // sanitizedTopic 保留用于潜在的文件路径清理需求
    // const sanitizedTopic = topic.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')
    
    const userCardPath = userService.getUserCardPath(req.user.username, topic)
    
    try {
      const files = await fs.readdir(userCardPath)
      const jsonFiles = files.filter(f => f.endsWith('.json') && !f.includes('-response'))
      
      if (jsonFiles.length > 0) {
        res.json({
          code: 200,
          success: true,
          status: 'completed',
          files: jsonFiles,
          message: '生成完成'
        })
      } else {
        res.json({
          code: 200,
          success: true,
          status: 'generating',
          message: '正在生成中'
        })
      }
    } catch {
      res.json({
        code: 200,
        success: true,
        status: 'not_started',
        message: '尚未开始生成'
      })
    }
  } catch (error) {
    res.status(500).json({
      code: 500,
      success: false,
      message: error.message
    })
  }
})

/**
 * 实时流式生成卡片 (支持Server-Sent Events)
 * POST /api/generate/card/stream
 * 
 * 请求体:
 * {
 *   "topic": "主题名称",
 *   "templateName": "模板文件名" (可选，默认使用 daily-knowledge-card-template.md),
 *   "style": "风格描述" (可选，默认为根据主题理解其精神内核),
 *   "language": "语言类型" (可选，默认根据主题的语言确定),
 *   "reference": "参考资料" (可选，默认为检索主题相关内容)
 * }
 */
router.post('/card/stream', authenticateUserOrDefault, ensureUserFolder, async (req, res) => {
  try {
    const { 
      topic, 
      templateName = 'daily-knowledge-card-template.md'
      // style 和 language 参数将通过前置提示词生成
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
    
    // 构建模板路径和提示词
    let templatePath, prompt
    
    // 生成参考文档的函数
    const generateReferenceDoc = async (topic, sanitizedTopic) => {
      try {
        const { workspacePath } = userService.getUserWorkspacePath(req.user.username)
        const cardWorkspacePath = path.join(workspacePath, 'card')
        await fs.mkdir(cardWorkspacePath, { recursive: true })
        
        const refFileName = `${sanitizedTopic}_ref.md`
        const refFilePath = path.join(cardWorkspacePath, refFileName)
        
        // 检查文件是否已存在，如果存在就跳过生成
        try {
          await fs.access(refFilePath)
          sendSSE('reference_status', { status: 'existing', message: '参考文档已存在，直接使用' })
          const existingContent = await fs.readFile(refFilePath, 'utf-8')
          return existingContent.trim()
        } catch {
          // 文件不存在，需要生成
        }
        
        sendSSE('reference_status', { status: 'generating', message: '正在生成参考文档...' })
        
        // 创建参考文档生成的API会话
        const refApiId = `ref_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
        
        // 生成参考文档的提示词
        const refGenerationPrompt = `如果没有任何参考信息，或参考信息中提供了链接但无法访问，请自行检索${topic}获取更多内容进行生成。生成的md文档保存在[${refFilePath}]`
        
        await apiTerminalService.executeClaude(refApiId, refGenerationPrompt)
        
        // 使用改进的文件检测逻辑
        const maxWaitTime = 120000 // 120秒超时
        const checkInterval = 1000 // 每秒检查一次
        const startTime = Date.now()
        let fileGenerated = false
        
        // 定期检查文件是否生成
        while (Date.now() - startTime < maxWaitTime) {
          try {
            // 检查文件是否存在
            await fs.access(refFilePath)
            
            // 读取文件内容
            const content = await fs.readFile(refFilePath, 'utf-8')
            
            // 确保文件有实际内容
            if (content.trim().length > 10) {
              const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1)
              sendSSE('reference_status', { 
                status: 'completed', 
                message: `参考文档生成成功 (${elapsedTime}s)`,
                content: content.substring(0, 500) + '...'
              })
              fileGenerated = true
              
              // 清理会话
              await apiTerminalService.destroySession(refApiId)
              return content.trim()
            }
          } catch (error) {
            // 文件还未生成或读取失败，继续等待
            if ((Date.now() - startTime) % 10000 === 0) {
              // 每10秒通过SSE发送状态更新
              const elapsed = Math.floor((Date.now() - startTime) / 1000)
              sendSSE('reference_status', { 
                status: 'waiting', 
                message: `正在等待参考文档生成... (${elapsed}s)`
              })
            }
          }
          
          // 等待下一次检查
          await new Promise(resolve => setTimeout(resolve, checkInterval))
        }
        
        // 超时处理
        if (!fileGenerated) {
          sendSSE('reference_status', { 
            status: 'timeout', 
            message: `参考文档生成超时 (${maxWaitTime/1000}s)`
          })
          // 清理会话
          await apiTerminalService.destroySession(refApiId)
        }
        
        return '暂未获取到相关参考资料'
        
      } catch (error) {
        sendSSE('reference_status', { status: 'error', message: '参考文档生成失败', error: error.message })
        return '参考资料生成失败'
      }
    }
    
    try {
      // 使用前置提示词生成参数
      sendSSE('status', { step: 'generating_prompt_parameters' })
      
      let style = ''
      let language = ''
      let referenceContent = ''
      
      if (templateName === 'cardplanet-Sandra') {
        // 通过Claude生成三个参数
        const generatePromptParam = async (promptText, paramName) => {
          try {
            sendSSE('parameter_progress', { param: paramName, status: 'generating' })
            
            const paramApiId = `param_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
            await apiTerminalService.executeClaude(paramApiId, promptText)
            
            // 等待生成完成
            await new Promise(resolve => setTimeout(resolve, 3000))
            
            // 获取输出
            const output = await apiTerminalService.getLastOutput(paramApiId)
            
            // 清理会话
            await apiTerminalService.destroySession(paramApiId)
            
            sendSSE('parameter_progress', { param: paramName, status: 'completed', value: output })
            return output?.trim() || ''
          } catch (error) {
            console.error(`[Stream API] Error generating ${paramName}:`, error)
            sendSSE('parameter_progress', { param: paramName, status: 'error' })
            return ''
          }
        }
        
        // 定义三个前置提示词
        const stylePrompt = `根据"${topic}"类别(心理/知识/创意等)按CLAUDE.md第五点（风格选择指南）自动匹配原则选择合适风格。直接返回风格描述，不要解释。`
        
        const languagePrompt = `请根据"${topic}"判断语言。如果包含中文返回"中文"，纯英文返回"英文"，混合返回"中英双语"。直接返回语言类型。`
        
        const referencePrompt = `如果没有任何参考信息，或参考信息中提供了链接但无法访问，请自行检索"${topic}"获取更多内容进行生成。返回核心要点（100字以内）。`
        
        // 生成三个参数
        console.log(`[Stream API] ========== STYLE PROMPT ==========`)
        console.log(stylePrompt)
        console.log(`[Stream API] ==================================`)
        style = await generatePromptParam(stylePrompt, 'style')
        if (!style) style = '根据主题理解其精神内核，自动选择合适的风格'
        console.log(`[Stream API] Generated style: ${style}`)
        
        console.log(`[Stream API] ========== LANGUAGE PROMPT ==========`)
        console.log(languagePrompt)
        console.log(`[Stream API] =====================================`)
        language = await generatePromptParam(languagePrompt, 'language')
        if (!language) language = '根据主题的语言确定语言类型'
        console.log(`[Stream API] Generated language: ${language}`)
        
        console.log(`[Stream API] ========== REFERENCE PROMPT ==========`)
        console.log(referencePrompt)
        console.log(`[Stream API] ======================================`)
        referenceContent = await generatePromptParam(referencePrompt, 'reference')
        if (!referenceContent) referenceContent = '如果提供了链接但无法访问，请自行检索主题获取更多内容进行生成'
        console.log(`[Stream API] Generated reference: ${referenceContent}`)
        
        sendSSE('parameters', { 
          style: style,
          language: language,
          reference: referenceContent.substring(0, 100) + '...'
        })
      } else {
        // 非cardplanet-Sandra模板不需要这些参数
        referenceContent = ''
      }
      
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
      const timeout = 420000  // 7分钟超时，适应cardplanet-Sandra模板
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
            // 检测JSON和HTML文件（cardplanet-Sandra模板生成HTML）
          const generatedFiles = files.filter(f => (f.endsWith('.json') || f.endsWith('.html')) && !f.includes('-response'))
          console.log(`[Stream API] Filtered generated files:`, generatedFiles)
            
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
        sendSSE('success', {
          topic,
          sanitizedTopic,
          templateName,
          fileName: fileResult.fileName,
          filePath: fileResult.path,
          generationTime: elapsedTime,
          content: fileResult.content,
          apiId
        })
        console.log(`[Stream API] Success event sent`)
        
      } catch (executeError) {
        sendSSE('error', { 
          message: executeError.message || '执行失败',
          apiId 
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


/**
 * 简化的Claude执行API
 * POST /api/generate/cc
 * 
 * 请求体：
 * {
 *   "prompt": "提示词内容",
 *   "timeout": 30000 (可选，默认30秒)
 * }
 */
router.post('/cc', async (req, res) => {
  try {
    const { prompt, timeout = 30000 } = req.body
    
    // 参数验证
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: 'prompt参数不能为空'
      })
    }
    
    console.log(`[CC API] Received prompt: ${prompt.substring(0, 100)}...`)
    console.log(`[CC API] Timeout: ${timeout}ms`)
    
    // 创建临时终端会话
    const sessionId = `cc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const pty = await terminalManager.create(sessionId)
    
    if (!pty) {
      return res.status(500).json({
        code: 500,
        success: false,
        message: '创建终端会话失败'
      })
    }
    
    // 收集输出
    let output = ''
    let commandExecuted = false
    
    // 监听输出
    pty.onData((data) => {
      output += data
      
      // 检测命令是否执行完成（通过检测新的提示符）
      if (data.includes('$') && commandExecuted) {
        // 命令执行完成
      }
    })
    
    // 执行Claude命令
    const escapedPrompt = prompt.replace(/"/g, '\\"')
    const command = `claude --dangerously-skip-permissions -p "${escapedPrompt}"`
    
    console.log(`[CC API] Executing command: ${command.substring(0, 150)}...`)
    pty.write(command + '\r')
    commandExecuted = true
    
    // 等待执行完成或超时
    const startTime = Date.now()
    const checkInterval = 100 // 每100ms检查一次
    
    const waitForCompletion = new Promise((resolve) => {
      const intervalId = setInterval(() => {
        // 检查是否超时
        if (Date.now() - startTime >= timeout) {
          clearInterval(intervalId)
          resolve({ success: false, reason: 'timeout' })
        }
        
        // 检查输出中是否有结束标志
        const lines = output.split('\n')
        const lastLine = lines[lines.length - 1] || lines[lines.length - 2]
        
        // 检查Claude命令是否完成执行
        // Claude输出后会返回到提示符
        if (commandExecuted && output.includes('\r\n') && output.length > command.length + 20) {
          // 检查是否有新的提示符出现（命令执行完成）
          const outputAfterCommand = output.substring(output.indexOf(command) + command.length)
          if (outputAfterCommand.includes('$') && (outputAfterCommand.includes('\r\n') || outputAfterCommand.length > 50)) {
            clearInterval(intervalId)
            resolve({ success: true })
          }
        }
      }, checkInterval)
    })
    
    const result = await waitForCompletion
    
    // 清理终端会话
    terminalManager.destroy(sessionId)
    
    if (!result.success) {
      return res.json({
        code: 408,
        success: false,
        message: '执行超时',
        timeout: timeout,
        partialOutput: output
      })
    }
    
    // 简化的输出清理逻辑
    // 查找命令执行后的输出
    const commandPattern = /claude --dangerously-skip-permissions.*?\n/
    const commandMatch = output.match(commandPattern)
    
    let cleanOutput = ''
    if (commandMatch) {
      // 获取命令之后的所有内容
      const afterCommand = output.substring(output.indexOf(commandMatch[0]) + commandMatch[0].length)
      
      // 移除ANSI转义序列
      const cleaned = afterCommand
        .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')  // ANSI转义序列
        .replace(/\x1b\[\?[0-9]+[hl]/g, '')      // 特殊转义序列
        .replace(/\[[\?0-9]+[hl]/g, '')          // 未转义的特殊序列
        .replace(/\r/g, '')                      // 回车符
      
      // 按行分割并过滤
      const lines = cleaned.split('\n')
      const outputLines = []
      
      for (const line of lines) {
        const trimmed = line.trim()
        // 停止条件：遇到新的提示符
        if (trimmed.includes(':~$') || trimmed.match(/^[a-f0-9]+:~\$/)) {
          break
        }
        // 添加非空行
        if (trimmed) {
          outputLines.push(trimmed)
        }
      }
      
      cleanOutput = outputLines.join('\n').trim()
    }
    
    console.log(`[CC API] Command completed successfully`)
    
    return res.json({
      code: 200,
      success: true,
      output: cleanOutput,
      executionTime: Date.now() - startTime
    })
    
  } catch (error) {
    console.error('[CC API] Error:', error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: '执行失败',
      error: error.message
    })
  }
})

export default router