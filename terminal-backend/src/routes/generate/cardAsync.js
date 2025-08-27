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
        
        // 输出参数日志
        console.log(`[Async Card API] ========== PARAMETERS GENERATED ==========`)
        if (templateName === 'cardplanet-Sandra-cover' || templateName === 'cardplanet-Sandra-json') {
          console.log(`[Async Card API] Cover: ${cover}`)
          console.log(`[Async Card API] Style: ${style}`)
          console.log(`[Async Card API] Language: ${language}`)
          console.log(`[Async Card API] Reference: ${referenceContent ? referenceContent.substring(0, 200) + '...' : 'N/A'}`)
        } else {
          console.log(`[Async Card API] Style: ${style}`)
          console.log(`[Async Card API] Language: ${language}`)
          console.log(`[Async Card API] Reference: ${referenceContent ? referenceContent.substring(0, 200) + '...' : 'N/A'}`)
        }
        console.log(`[Async Card API] ==========================================`)
        
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
          } else {
            // 其他文件夹模板
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
          // 单文件模式（.md文件）
          const templatePath = isDocker 
            ? path.join('/app/data/public_template', templateName)
            : path.join(dataPath, 'public_template', templateName)
          
          // 原有的提示词
          prompt = `根据[${templatePath}]文档的规范，就以下命题，生成一组卡片的json文档在[${userCardPath}]：${topic}`
        }
        
        // 输出完整组装后的提示词
        console.log('\n🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥')
        console.log('🎯 [Async Card API] ============ ASSEMBLED PROMPT ============')
        console.log('📋 [Async Card API] Template:', templateName)
        console.log('📝 [Async Card API] Topic:', topic)
        console.log('📐 [Async Card API] Prompt Length:', prompt.length, 'chars')
        console.log('💬 [Async Card API] ========== PROMPT BEGIN ==========\n')
        console.log(prompt)
        console.log('\n💬 [Async Card API] ========== PROMPT END ==========')
        console.log('🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥\n')
        
        // 使用统一的终端服务执行生成
        const apiId = `async_${taskId}`
        console.log(`[Async Card API] Executing Claude with API ID: ${apiId}`)
        
        // 执行Claude命令（不等待）
        apiTerminalService.executeClaude(apiId, prompt).catch(error => {
          console.error(`[Async Card API] Claude execution error:`, error)
        })
        
        // 文件检测器 - 等待文件生成
        console.log(`[Async Card API] Starting file detection for task: ${taskId}`)
        const fileDetected = await new Promise((resolve) => {
          let checkCount = 0
          const maxChecks = 300 // 最多检查300次（10分钟）
          
          const checkInterval = setInterval(async () => {
            checkCount++
            try {
              const files = await fs.readdir(userCardPath)
              console.log(`[Async Card API] Check #${checkCount}: Found ${files.length} files in ${userCardPath}`)
              
              // 过滤出生成的文件
              const generatedFiles = files.filter(f => 
                (f.endsWith('.json') || f.endsWith('.html')) && 
                !f.includes('-response') &&
                !f.startsWith('.') &&
                !f.includes('_meta')
              )
              
              if (generatedFiles.length > 0) {
                console.log(`[Async Card API] Generated files detected:`, generatedFiles)
              }
              
              // 对于 cardplanet-Sandra-json 模板，需要两个文件
              if (templateName === 'cardplanet-Sandra-json') {
                const htmlFiles = generatedFiles.filter(f => f.endsWith('.html'))
                const jsonFiles = generatedFiles.filter(f => f.endsWith('.json'))
                
                if (htmlFiles.length > 0 && jsonFiles.length > 0) {
                  console.log(`[Async Card API] Both HTML and JSON files detected!`)
                  clearInterval(checkInterval)
                  resolve(true)
                } else if (htmlFiles.length > 0 || jsonFiles.length > 0) {
                  console.log(`[Async Card API] Waiting for both files... HTML: ${htmlFiles.length}, JSON: ${jsonFiles.length}`)
                }
              } else {
                // 其他模板只需要一个JSON文件
                if (generatedFiles.length > 0) {
                  console.log(`[Async Card API] File detected!`)
                  clearInterval(checkInterval)
                  resolve(true)
                }
              }
              
              // 超时检查
              if (checkCount >= maxChecks) {
                console.error(`[Async Card API] File detection timeout after ${maxChecks * 2} seconds`)
                clearInterval(checkInterval)
                resolve(false)
              }
            } catch (error) {
              console.error(`[Async Card API] Error checking files:`, error)
            }
          }, 2000) // 每2秒检查一次
        })
        
        if (fileDetected) {
          console.log(`[Async Card API] Background generation completed for task: ${taskId}`)
        } else {
          console.error(`[Async Card API] File generation timeout for task: ${taskId}`)
          throw new Error('File generation timeout')
        }
        
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