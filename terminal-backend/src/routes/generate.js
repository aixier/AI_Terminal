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
      await apiTerminalService.sendTextAndControl(apiId, prompt, '\r', 1000)
      console.log(`[GenerateCard API] ✅ Command sent to ${apiId}`)
      
      // 步骤3: 等待命令执行完成
      console.log(`[GenerateCard API] Step 3: Waiting for completion ${apiId}`)
      const output = await apiTerminalService.waitForCompletion(apiId)
      console.log(`[GenerateCard API] ✅ Command execution completed for ${apiId}`)
      console.log(`[GenerateCard API] Output length: ${output.length} characters`)
      
    } catch (executeError) {
      console.error('[GenerateCard API] Command execution error:', executeError)
      // 清理会话
      await apiTerminalService.destroySession(apiId)
      throw executeError
    }
    
    // 等待文件生成完成
    try {
      const result = await waitForFile
      
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

export default router