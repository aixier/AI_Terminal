import express from 'express'
import fs from 'fs/promises'
import path from 'path'
import userService from '../../services/userService.js'
import { authenticateUserOrDefault } from '../../middleware/userAuth.js'
import { SessionMetadata } from './utils/sessionMetadata.js'

const router = express.Router()

/**
 * 计算任务进度百分比
 * @param {string} status - 任务状态
 * @param {Object} phases - 阶段信息
 * @returns {number} 进度百分比 (0-100)
 */
function calculateProgress(status, phases = {}) {
  // 如果任务已完成
  if (status === 'completed') {
    return 100
  }
  
  // 如果任务失败
  if (status === 'failed' || status === 'error') {
    return 0
  }
  
  // 根据阶段计算进度
  let progress = 0
  const phaseWeights = {
    promptProcessing: 10,    // Prompt处理占10%
    firstGeneration: 60,     // 第一次AI生成占60%
    base64Embedding: 30      // Base64嵌入占30%
  }
  
  // 计算每个阶段的进度
  Object.entries(phaseWeights).forEach(([phase, weight]) => {
    const phaseStatus = phases[phase]
    if (phaseStatus === 'completed') {
      progress += weight
    } else if (phaseStatus === 'processing' || phaseStatus === 'in_progress') {
      progress += weight * 0.5  // 正在处理的阶段算50%
    }
    // pending或其他状态不加分
  })
  
  // 如果没有阶段信息但状态是processing，至少显示5%
  if (progress === 0 && status === 'processing') {
    progress = 5
  }
  
  return Math.min(Math.round(progress), 99)  // 最多显示99%，直到真正完成
}

/**
 * 查询Pod2Post任务状态
 * GET /api/generate/pod2post/status/:taskId
 * 
 * 参数:
 * - taskId: 任务ID，格式为 pod2post_{timestamp}_{random}
 * 
 * 查询参数:
 * - token: 用户token（可选）
 */
router.get('/:taskId', 
  authenticateUserOrDefault,
  async (req, res) => {
    
  const { taskId } = req.params
  const { token } = req.query
  
  console.log(`[Pod2PostStatus] ==================== STATUS REQUEST ====================`)
  console.log(`[Pod2PostStatus] Task ID: ${taskId}`)
  console.log(`[Pod2PostStatus] User: ${req.user.username}`)
  console.log(`[Pod2PostStatus] Token provided: ${!!token}`)
  
  try {
    // 1. 验证taskId格式
    if (!taskId || !taskId.startsWith('pod2post_')) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '无效的任务ID格式'
      })
    }
    
    // 2. 处理用户token
    let targetUser = req.user
    if (token) {
      const tokenUser = await userService.findUserByToken(token)
      if (tokenUser) {
        targetUser = tokenUser
        console.log(`[Pod2PostStatus] Using token-specified user: ${targetUser.username}`)
      }
    }
    
    // 3. 使用完整的taskId作为文件夹名
    // 新的命名规则：文件夹名就是完整的taskId
    const expectedFolderName = taskId
    
    console.log(`[Pod2PostStatus] Expected folder name: ${expectedFolderName}`)
    
    // 4. 构建用户卡片路径
    const userCardPath = userService.getUserCardPath(targetUser.username, expectedFolderName)
    console.log(`[Pod2PostStatus] User card path: ${userCardPath}`)
    
    // 5. 检查文件夹是否存在
    try {
      await fs.access(userCardPath)
    } catch {
      return res.status(404).json({
        code: 404,
        success: false,
        message: '任务不存在或已被删除'
      })
    }
    
    // 6. 读取元数据
    let metadata
    try {
      metadata = await SessionMetadata.load(userCardPath)
      console.log(`[Pod2PostStatus] Metadata loaded successfully`)
    } catch (error) {
      console.warn(`[Pod2PostStatus] Failed to load metadata:`, error.message)
      // 如果元数据不存在，尝试从文件夹内容推断状态
      metadata = await inferStatusFromFiles(userCardPath, taskId)
    }
    
    // 7. 获取文件夹内容
    const files = await fs.readdir(userCardPath)
    const htmlFiles = files.filter(f => 
      f.endsWith('.html') && 
      !f.includes('-response') && 
      !f.includes('_meta')
    )
    const jsonFiles = files.filter(f => 
      f.endsWith('.json') && 
      !f.includes('-response') && 
      !f.includes('_meta')
    )
    
    // 8. 计算进度
    const progress = calculateProgress(metadata.status, metadata.data.custom?.phases)
    
    // 9. 构建响应数据
    const responseData = {
      taskId,
      folderName: expectedFolderName,
      folderPath: userCardPath,
      status: metadata.status || 'unknown',
      progress,  // 添加进度字段
      topic: metadata.data.topic || `播客小红书图文卡片`,
      templateName: metadata.data.templateName || 'pod2post-template',
      
      // 处理阶段信息
      phases: metadata.data.custom?.phases || {},
      
      // 生成的文件
      generatedFiles: {
        html: htmlFiles,
        json: jsonFiles,
        total: files.length
      },
      
      // 特定的Pod2Post文件信息
      pod2postFiles: metadata.data.custom?.generatedFiles || null,
      
      // 时间信息
      createdAt: metadata.data.createdAt,
      startedAt: metadata.data.startedAt,
      completedAt: metadata.data.completedAt || metadata.data.custom?.endTime,
      
      // 错误信息
      error: metadata.error || null,
      
      // 日志信息（最近10条）
      logs: metadata.logs ? metadata.logs.slice(-10) : []
    }
    
    console.log(`[Pod2PostStatus] Task status: ${responseData.status}`)
    console.log(`[Pod2PostStatus] Generated files: HTML=${htmlFiles.length}, JSON=${jsonFiles.length}`)
    
    res.json({
      code: 200,
      success: true,
      data: responseData
    })
    
  } catch (error) {
    console.error(`[Pod2PostStatus] Status query failed:`, error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: error.message || '状态查询失败'
    })
  }
})

/**
 * 从文件夹内容推断任务状态（当元数据不可用时）
 * @param {string} userCardPath - 用户卡片路径
 * @param {string} taskId - 任务ID
 * @returns {Promise<Object>} 推断的元数据对象
 */
async function inferStatusFromFiles(userCardPath, taskId) {
  console.log(`[Pod2PostStatus] Inferring status from files in: ${userCardPath}`)
  
  try {
    const files = await fs.readdir(userCardPath)
    
    // 检查HTML文件
    const htmlFiles = files.filter(f => f.endsWith('.html') && !f.includes('_meta'))
    const base64HtmlFiles = files.filter(f => f.endsWith('_with_base64.html'))
    
    let status = 'unknown'
    let phases = {
      promptProcessing: 'unknown',
      firstGeneration: 'unknown',
      base64Embedding: 'unknown'
    }
    
    if (base64HtmlFiles.length > 0) {
      // 有Base64版本的HTML文件，说明任务完成
      status = 'completed'
      phases = {
        promptProcessing: 'completed',
        firstGeneration: 'completed',
        base64Embedding: 'completed'
      }
    } else if (htmlFiles.length > 0) {
      // 有原始HTML文件，但没有Base64版本
      status = 'processing'
      phases = {
        promptProcessing: 'completed',
        firstGeneration: 'completed',
        base64Embedding: 'processing'
      }
    } else {
      // 没有HTML文件，可能还在生成中或失败了
      status = 'processing'
      phases = {
        promptProcessing: 'completed',
        firstGeneration: 'processing',
        base64Embedding: 'pending'
      }
    }
    
    console.log(`[Pod2PostStatus] Inferred status: ${status}`)
    
    return {
      status,
      data: {
        topic: 'Pod2Post卡片生成',
        templateName: 'pod2post-template',
        custom: {
          phases,
          generatedFiles: base64HtmlFiles.length > 0 ? {
            original: htmlFiles[0] || null,
            withBase64: base64HtmlFiles[0] || null
          } : null
        }
      },
      logs: [{
        level: 'info',
        message: '从文件推断任务状态',
        timestamp: new Date().toISOString()
      }],
      error: null
    }
    
  } catch (error) {
    console.error(`[Pod2PostStatus] Failed to infer status:`, error)
    return {
      status: 'error',
      data: {
        topic: 'Pod2Post卡片生成',
        templateName: 'pod2post-template'
      },
      logs: [],
      error: {
        message: '无法读取任务状态',
        time: new Date().toISOString()
      }
    }
  }
}

/**
 * 获取所有Pod2Post任务列表（可选功能）
 * GET /api/generate/pod2post/status
 */
router.get('/', 
  authenticateUserOrDefault,
  async (req, res) => {
    
  const { token, limit = 10 } = req.query
  
  try {
    // 处理用户token
    let targetUser = req.user
    if (token) {
      const tokenUser = await userService.findUserByToken(token)
      if (tokenUser) {
        targetUser = tokenUser
      }
    }
    
    // 获取用户的workspace路径
    const { cardPath } = userService.getUserWorkspacePath(targetUser.username)
    
    // 读取所有文件夹
    const folders = await fs.readdir(cardPath)
    
    // 筛选出Pod2Post相关的文件夹
    const pod2postFolders = folders
      .filter(folder => folder.startsWith('pod2post_'))
      .sort((a, b) => {
        // 按时间戳排序，最新的在前
        const timestampA = parseInt(a.match(/pod2post_(\d+)/)?.[1] || '0')
        const timestampB = parseInt(b.match(/pod2post_(\d+)/)?.[1] || '0')
        return timestampB - timestampA
      })
      .slice(0, parseInt(limit))
    
    const tasks = []
    
    for (const folderName of pod2postFolders) {
      try {
        const folderPath = path.join(cardPath, folderName)
        
        // 尝试读取元数据
        let metadata
        try {
          metadata = await SessionMetadata.load(folderPath)
        } catch {
          // 如果元数据不存在，创建基本信息
          metadata = {
            status: 'unknown',
            data: {
              topic: 'Pod2Post卡片生成',
              templateName: 'pod2post-template'
            }
          }
        }
        
        // 构建任务信息
        const timestampMatch = folderName.match(/pod2post_(\d+)/)
        const timestamp = timestampMatch ? timestampMatch[1] : Date.now().toString()
        
        tasks.push({
          taskId: `pod2post_${timestamp}_${Math.random().toString(36).substring(2, 9)}`,
          folderName,
          folderPath,
          status: metadata.status,
          topic: metadata.data.topic || 'Pod2Post卡片生成',
          templateName: metadata.data.templateName || 'pod2post-template',
          createdAt: metadata.data.createdAt || new Date(parseInt(timestamp)).toISOString(),
          completedAt: metadata.data.completedAt || metadata.data.custom?.endTime || null
        })
      } catch (error) {
        console.warn(`[Pod2PostStatus] Failed to process folder ${folderName}:`, error.message)
      }
    }
    
    res.json({
      code: 200,
      success: true,
      data: {
        tasks,
        total: tasks.length,
        limit: parseInt(limit)
      }
    })
    
  } catch (error) {
    console.error(`[Pod2PostStatus] Task list query failed:`, error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: error.message || '任务列表查询失败'
    })
  }
})

export default router