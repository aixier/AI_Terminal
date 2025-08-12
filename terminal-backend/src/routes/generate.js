import express from 'express'
import path from 'path'
import fs from 'fs/promises'
import apiTerminalService from '../utils/apiTerminalService.js'

const router = express.Router()

/**
 * 生成卡片并返回JSON内容
 * POST /api/generate/card
 * 
 * 请求体:
 * {
 *   "topic": "主题名称",
 *   "templateName": "模板文件名" (可选，默认使用 daily-knowledge-card-template.md)
 * }
 */
router.post('/card', async (req, res) => {
  try {
    const { topic, templateName = 'daily-knowledge-card-template.md' } = req.body
    
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
    
    // 构建模板路径
    const templatePath = isDocker 
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
    
    // 构建输出路径
    const userCardPath = isDocker
      ? `/app/data/users/default/folders/default-folder/cards/${sanitizedTopic}`
      : path.join(dataPath, 'users/default/folders/default-folder/cards', sanitizedTopic)
    
    // 确保输出目录存在
    await fs.mkdir(userCardPath, { recursive: true })
    
    // 构建Claude命令
    const prompt = `根据[${templatePath}]文档的规范，就以下命题，生成一组卡片的json文档在[${userCardPath}]：${topic}`
    
    console.log('[GenerateCard API] Starting generation for topic:', topic)
    console.log('[GenerateCard API] Template path:', templatePath)
    console.log('[GenerateCard API] Output path:', userCardPath)
    console.log('[GenerateCard API] Prompt:', prompt)
    
    // 设置超时时间（3分钟）
    const timeout = 180000
    const startTime = Date.now()
    
    // 创建Promise来等待文件生成
    const waitForFile = new Promise((resolve, reject) => {
      let checkInterval
      let timeoutTimer
      
      // 定时检查文件是否生成
      const checkFile = async () => {
        try {
          const files = await fs.readdir(userCardPath)
          const jsonFiles = files.filter(f => f.endsWith('.json') && !f.includes('-response'))
          
          if (jsonFiles.length > 0) {
            // 找到生成的JSON文件
            clearInterval(checkInterval)
            clearTimeout(timeoutTimer)
            
            // 读取第一个JSON文件
            const jsonPath = path.join(userCardPath, jsonFiles[0])
            const content = await fs.readFile(jsonPath, 'utf-8')
            
            try {
              const jsonContent = JSON.parse(content)
              resolve({
                success: true,
                fileName: jsonFiles[0],
                path: jsonPath,
                content: jsonContent
              })
            } catch (parseError) {
              reject(new Error('生成的JSON文件格式错误: ' + parseError.message))
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
    const apiId = `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    console.log(`[GenerateCard API] >>> Starting unified terminal processing: ${apiId}`)
    
    try {
      // 步骤1: 初始化Claude（与前端initializeClaude完全一致）
      console.log(`[GenerateCard API] Step 1: Initializing Claude for ${apiId}`)
      await apiTerminalService.initializeClaude(apiId)
      console.log(`[GenerateCard API] ✅ Claude initialized for ${apiId}`)
      
      // 步骤2: 发送命令（与前端sendTextAndControl完全一致）
      console.log(`[GenerateCard API] Step 2: Sending command to ${apiId}`)
      await apiTerminalService.sendTextAndControl(apiId, prompt, '\r', 100)
      console.log(`[GenerateCard API] ✅ Command sent to ${apiId}`)
      
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
router.get('/templates', async (req, res) => {
  try {
    const dataPath = process.env.DATA_PATH || path.join(process.cwd(), 'data')
    const templatesPath = path.join(dataPath, 'public_template')
    
    const files = await fs.readdir(templatesPath)
    const templates = files
      .filter(f => f.endsWith('.md'))
      .map(f => ({
        fileName: f,
        displayName: f.replace('.md', '').replace(/-/g, ' ')
      }))
    
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
router.get('/status/:topic', async (req, res) => {
  try {
    const { topic } = req.params
    const sanitizedTopic = topic.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')
    
    const dataPath = process.env.DATA_PATH || path.join(process.cwd(), 'data')
    const userCardPath = path.join(dataPath, 'users/default/folders/default-folder/cards', sanitizedTopic)
    
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
 *   "templateName": "模板文件名" (可选，默认使用 daily-knowledge-card-template.md)
 * }
 */
router.post('/card/stream', async (req, res) => {
  try {
    const { topic, templateName = 'daily-knowledge-card-template.md' } = req.body
    
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
    
    // 构建路径
    const templatePath = isDocker 
      ? path.join('/app/data/public_template', templateName)
      : path.join(dataPath, 'public_template', templateName)
    
    const userCardPath = isDocker
      ? `/app/data/users/default/folders/default-folder/cards/${sanitizedTopic}`
      : path.join(dataPath, 'users/default/folders/default-folder/cards', sanitizedTopic)
    
    try {
      // 检查模板文件
      await fs.access(templatePath)
      await fs.mkdir(userCardPath, { recursive: true })
      
      sendSSE('start', { topic, sanitizedTopic, templatePath, userCardPath })
      
      // 构建Claude命令
      const prompt = `根据[${templatePath}]文档的规范，就以下命题，生成一组卡片的json文档在[${userCardPath}]：${topic}`
      const timeout = 180000
      const startTime = Date.now()
      
      sendSSE('command', { prompt })
      
      // 创建API会话
      const apiId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
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
            const jsonFiles = files.filter(f => f.endsWith('.json') && !f.includes('-response'))
            
            if (jsonFiles.length > 0) {
              clearInterval(checkInterval)
              clearTimeout(timeoutTimer)
              
              const jsonPath = path.join(userCardPath, jsonFiles[0])
              const content = await fs.readFile(jsonPath, 'utf-8')
              
              try {
                const jsonContent = JSON.parse(content)
                resolve({
                  success: true,
                  fileName: jsonFiles[0],
                  path: jsonPath,
                  content: jsonContent
                })
              } catch (parseError) {
                reject(new Error('生成的JSON文件格式错误: ' + parseError.message))
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
        // 初始化Claude
        sendSSE('status', { step: 'initializing_claude' })
        await apiTerminalService.initializeClaude(apiId)
        sendSSE('status', { step: 'claude_initialized' })
        
        // 发送命令
        sendSSE('status', { step: 'sending_command' })
        await apiTerminalService.sendTextAndControl(apiId, prompt, '\r', 1000)
        sendSSE('status', { step: 'command_sent' })
        
        // 等待执行完成
        sendSSE('status', { step: 'waiting_completion' })
        const [output, fileResult] = await Promise.allSettled([
          apiTerminalService.waitForCompletion(apiId, timeout),
          waitForFile
        ])
        
        const elapsedTime = Date.now() - startTime
        
        // 发送最终结果
        if (fileResult.status === 'fulfilled') {
          sendSSE('success', {
            topic,
            sanitizedTopic,
            templateName,
            fileName: fileResult.value.fileName,
            filePath: fileResult.value.path,
            generationTime: elapsedTime,
            content: fileResult.value.content,
            apiId
          })
        } else {
          sendSSE('error', {
            message: fileResult.reason?.message || '生成失败',
            apiId,
            elapsedTime
          })
        }
        
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
 * 流式生成卡片（支持实时回显）
 * POST /api/generate/card/stream
 * 
 * 返回Server-Sent Events流，实时显示Claude执行过程
 */
router.post('/card/stream', async (req, res) => {
  try {
    const { topic, templateName = 'daily-knowledge-card-template.md' } = req.body
    
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
    
    // 清理主题名称
    const sanitizedTopic = topic.trim().replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')
    
    // 构建路径
    const isDocker = process.env.NODE_ENV === 'production' || process.env.DATA_PATH
    const dataPath = process.env.DATA_PATH || path.join(process.cwd(), 'data')
    const templatePath = isDocker 
      ? path.join('/app/data/public_template', templateName)
      : path.join(dataPath, 'public_template', templateName)
    const userCardPath = isDocker
      ? `/app/data/users/default/folders/default-folder/cards/${sanitizedTopic}`
      : path.join(dataPath, 'users/default/folders/default-folder/cards', sanitizedTopic)
    
    // 检查模板文件
    try {
      await fs.access(templatePath)
    } catch {
      sendSSE('error', { message: `模板文件不存在: ${templateName}` })
      return res.end()
    }
    
    // 确保输出目录存在
    await fs.mkdir(userCardPath, { recursive: true })
    
    // 构建Claude命令
    const prompt = `根据[${templatePath}]文档的规范，就以下命题，生成一组卡片的json文档在[${userCardPath}]：${topic}`
    
    sendSSE('start', { 
      topic, 
      sanitizedTopic, 
      templateName, 
      prompt: prompt.substring(0, 100) + '...'
    })
    
    // 设置超时时间
    const timeout = 180000
    const startTime = Date.now()
    const apiId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    try {
      // 初始化Claude
      sendSSE('status', { message: '正在初始化Claude...' })
      await apiTerminalService.initializeClaude(apiId)
      sendSSE('status', { message: 'Claude初始化完成，准备发送命令...' })
      
      // 监听终端输出
      const outputListener = (data) => {
        if (data.apiId === apiId) {
          sendSSE('output', { 
            data: data.data,
            timestamp: Date.now()
          })
        }
      }
      
      apiTerminalService.on('output', outputListener)
      
      // 发送命令
      sendSSE('status', { message: '正在发送生成命令...' })
      await apiTerminalService.sendTextAndControl(apiId, prompt, '\r', 100)
      sendSSE('status', { message: '命令已发送，Claude正在生成卡片...' })
      
      // 创建文件监控
      const fileCheckInterval = setInterval(async () => {
        try {
          const files = await fs.readdir(userCardPath)
          const jsonFiles = files.filter(f => f.endsWith('.json') && !f.includes('-response'))
          
          if (jsonFiles.length > 0) {
            // 找到生成的文件
            clearInterval(fileCheckInterval)
            apiTerminalService.removeListener('output', outputListener)
            
            const jsonPath = path.join(userCardPath, jsonFiles[0])
            const content = await fs.readFile(jsonPath, 'utf-8')
            
            try {
              const jsonContent = JSON.parse(content)
              const elapsedTime = Date.now() - startTime
              
              sendSSE('completed', {
                success: true,
                fileName: jsonFiles[0],
                filePath: jsonPath,
                content: jsonContent,
                generationTime: elapsedTime
              })
              
              // 清理会话
              await apiTerminalService.destroySession(apiId)
              res.end()
              
            } catch (parseError) {
              sendSSE('error', { message: '生成的JSON文件格式错误: ' + parseError.message })
              await apiTerminalService.destroySession(apiId)
              res.end()
            }
          }
        } catch (error) {
          // 目录可能还不存在，继续等待
        }
      }, 2000)
      
      // 设置超时
      setTimeout(async () => {
        clearInterval(fileCheckInterval)
        apiTerminalService.removeListener('output', outputListener)
        
        sendSSE('timeout', { 
          message: `生成超时，已等待${timeout/1000}秒`,
          output: apiTerminalService.getOutput(apiId)
        })
        
        await apiTerminalService.destroySession(apiId)
        res.end()
      }, timeout)
      
    } catch (error) {
      sendSSE('error', { message: error.message })
      await apiTerminalService.destroySession(apiId)
      res.end()
    }
    
  } catch (error) {
    console.error('[Stream Generate API] Error:', error)
    res.write(`event: error\n`)
    res.write(`data: ${JSON.stringify({ message: '服务器内部错误: ' + error.message })}\n\n`)
    res.end()
  }
})

export default router