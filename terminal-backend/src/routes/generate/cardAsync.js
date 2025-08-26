import express from 'express'
import path from 'path'
import fs from 'fs/promises'
import apiTerminalService from '../../utils/apiTerminalService.js'
import claudeExecutorDirect from '../../services/claudeExecutorDirect.js'
import { authenticateUserOrDefault, ensureUserFolder } from '../../middleware/userAuth.js'
import userService from '../../services/userService.js'
import { ensureCardFolder, updateFolderStatus } from './utils/folderManager.js'

const router = express.Router()

/**
 * 异步生成卡片接口 - 立即返回任务ID和文件夹名称
 * POST /api/generate/card/async
 * 
 * 请求体:
 * {
 *   "topic": "主题名称",
 *   "templateName": "模板文件名" (可选，默认使用 cardplanet-Sandra-json)
 * }
 * 
 * 响应:
 * {
 *   "code": 200,
 *   "success": true,
 *   "data": {
 *     "taskId": "task_xxx",
 *     "folderName": "sanitized_topic_name",
 *     "folderPath": "/path/to/user/folder",
 *     "topic": "原始主题",
 *     "templateName": "使用的模板"
 *   }
 * }
 */
router.post('/', authenticateUserOrDefault, ensureUserFolder, async (req, res) => {
  try {
    const { 
      topic, 
      templateName = 'cardplanet-Sandra-json'
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
    
    // 生成任务ID
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    
    // 使用用户特定的路径
    const userCardPath = userService.getUserCardPath(req.user.username, topic)
    
    // 立即创建文件夹并获取信息
    const folderInfo = await ensureCardFolder(userCardPath, topic, sanitizedTopic)
    
    console.log(`[Async Card API] ==================== ASYNC REQUEST ====================`)
    console.log(`[Async Card API] Task ID: ${taskId}`)
    console.log(`[Async Card API] Topic: ${topic}`)
    console.log(`[Async Card API] Sanitized Topic: ${sanitizedTopic}`)
    console.log(`[Async Card API] Template: ${templateName}`)
    console.log(`[Async Card API] User: ${req.user.username}`)
    console.log(`[Async Card API] Output Path: ${userCardPath}`)
    console.log(`[Async Card API] Folder Info:`, folderInfo)
    console.log(`[Async Card API] =======================================================`)
    
    // 立即返回任务信息，不等待生成完成
    const responseData = {
      taskId: taskId,
      folderName: sanitizedTopic,
      folderPath: userCardPath,
      topic: topic,
      templateName: templateName,
      status: 'submitted',
      submittedAt: new Date().toISOString(),
      folderCreated: !folderInfo.existed,
      folderExisted: folderInfo.existed
    }
    
    // 异步开始生成（不等待完成）
    setImmediate(async () => {
      try {
        console.log(`[Async Card API] Starting background generation for task: ${taskId}`)
        
        // 更新文件夹状态为生成中
        await updateFolderStatus(userCardPath, 'generating', { 
          taskId: taskId,
          templateName: templateName 
        })
        
        // 根据环境确定路径
        const isDocker = process.env.NODE_ENV === 'production' || process.env.DATA_PATH
        const dataPath = process.env.DATA_PATH || path.join(process.cwd(), 'data')
        
        // 判断模板类型
        const isFolder = !templateName.includes('.md')
        
        // 使用前置提示词生成参数
        const parameters = await claudeExecutorDirect.generateCardParameters(topic, templateName)
        
        // 根据模板类型解构参数
        let cover, style, language, referenceContent
        if (templateName === 'cardplanet-Sandra-cover' || templateName === 'cardplanet-Sandra-json') {
          ({ cover, style, language, reference: referenceContent } = parameters)
        } else {
          ({ style, language, reference: referenceContent } = parameters)
        }
        
        // 构建提示词
        let prompt
        if (isFolder) {
          const templatePath = isDocker 
            ? path.join('/app/data/public_template', templateName)
            : path.join(dataPath, 'public_template', templateName)
          
          const claudePath = path.join(templatePath, 'CLAUDE.md')
          
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
          }
        }
        
        // 使用统一的终端服务执行生成
        const apiId = `async_${taskId}`
        await apiTerminalService.executeClaude(apiId, prompt)
        
        console.log(`[Async Card API] Background generation completed for task: ${taskId}`)
        
        // 更新文件夹状态为完成
        await updateFolderStatus(userCardPath, 'completed', { 
          taskId: taskId,
          completedAt: new Date() 
        })
        
        // 清理会话
        await apiTerminalService.destroySession(apiId)
        
      } catch (error) {
        console.error(`[Async Card API] Background generation failed for task ${taskId}:`, error)
        
        // 更新文件夹状态为失败
        try {
          await updateFolderStatus(userCardPath, 'failed', { 
            taskId: taskId,
            errorMessage: error.message,
            failedAt: new Date() 
          })
        } catch (statusError) {
          console.error(`[Async Card API] Failed to update folder status:`, statusError)
        }
      }
    })
    
    // 立即返回响应
    res.json({
      code: 200,
      success: true,
      data: responseData,
      message: '任务已提交，正在后台生成'
    })
    
  } catch (error) {
    console.error('[Async Card API] Unexpected error:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '服务器内部错误',
      error: error.message
    })
  }
})

export default router