import express from 'express'
import fs from 'fs/promises'
import path from 'path'
import { authenticateUserOrDefault } from '../../middleware/userAuth.js'
import userService from '../../services/userService.js'
import { checkGenerationCompletion } from '../../utils/templateRegistry.js'
import { getAllFoldersMetadata, getFolderMetadata } from './utils/workspaceMetadata.js'

const router = express.Router()

/**
 * 检查生成状态（用于轮询）
 * GET /api/generate/status/:topic
 */
router.get('/:topic', authenticateUserOrDefault, async (req, res) => {
  try {
    let { topic } = req.params
    const username = req.user.username
    
    // 解码处理（兼容可能的URL编码）
    try {
      if (topic.includes('%')) {
        const decoded = decodeURIComponent(topic)
        console.log(`[Status API] URL decoded: ${topic} -> ${decoded}`)
        topic = decoded
      }
    } catch (e) {
      console.log(`[Status API] URL decode failed, using original: ${topic}`)
    }
    
    const userCardPath = userService.getUserCardPath(username, topic)
    
    // 首先检查元数据中的状态（持久化状态）
    const folderMetadata = await getFolderMetadata(userCardPath)
    console.log('[Status API] Folder metadata:', folderMetadata)
    
    // 如果元数据中有状态信息，优先使用
    if (folderMetadata && folderMetadata.status) {
      // 根据元数据状态判断
      if (folderMetadata.status === 'completed') {
        // 已完成，读取文件信息
        try {
          const files = await fs.readdir(userCardPath)
          const jsonFiles = files.filter(f => f.endsWith('.json') && !f.includes('-response') && !f.includes('_meta'))
          const htmlFiles = files.filter(f => f.endsWith('.html') && !f.includes('-response'))
          
          return res.json({
            code: 200,
            success: true,
            status: 'completed',
            files: {
              json: jsonFiles,
              html: htmlFiles,
              total: jsonFiles.length + htmlFiles.length
            },
            message: '生成完成',
            progress: { json: jsonFiles.length, html: htmlFiles.length },
            templateName: folderMetadata.templateName,
            taskId: folderMetadata.taskId,
            metadata: folderMetadata
          })
        } catch (error) {
          console.log('[Status API] Error reading files, but metadata shows completed:', error.message)
        }
      } else if (folderMetadata.status === 'generating' || folderMetadata.status === 'processing') {
        // 正在生成中
        return res.json({
          code: 200,
          success: true,
          status: 'generating',
          message: '正在生成中',
          progress: { json: 0, html: 0 },
          templateName: folderMetadata.templateName,
          taskId: folderMetadata.taskId,
          metadata: folderMetadata
        })
      } else if (folderMetadata.status === 'failed') {
        // 生成失败
        return res.json({
          code: 200,
          success: true,
          status: 'failed',
          message: folderMetadata.error || '生成失败',
          templateName: folderMetadata.templateName,
          taskId: folderMetadata.taskId,
          metadata: folderMetadata
        })
      }
    }
    
    // 如果没有元数据或元数据状态不明确，回退到文件检查逻辑
    try {
      const files = await fs.readdir(userCardPath)
      const jsonFiles = files.filter(f => f.endsWith('.json') && !f.includes('-response') && !f.includes('_meta'))
      const htmlFiles = files.filter(f => f.endsWith('.html') && !f.includes('-response'))
      
      // 尝试从元数据获取模板信息
      let templateName = null
      try {
        const { cardPath } = userService.getUserWorkspacePath(username)
        const folders = await getAllFoldersMetadata(cardPath)
        const folderInfo = folders?.[topic]
        templateName = folderInfo?.templateName
      } catch (err) {
        console.log('[Status API] Could not get template from metadata:', err.message)
      }
      
      // 如果没有从元数据获取到，尝试根据文件名推断
      if (!templateName) {
        if (jsonFiles.some(f => f.includes('知识卡片'))) {
          templateName = 'daily-knowledge-card-template.md'
        } else if (htmlFiles.length > 0 && jsonFiles.length > 0) {
          templateName = 'cardplanet-Sandra-json'
        }
      }
      
      // 使用模板注册信息检查完成状态
      console.log('[Status API] Template name:', templateName)
      console.log('[Status API] JSON files:', jsonFiles)
      console.log('[Status API] HTML files:', htmlFiles)
      const completionCheck = await checkGenerationCompletion(templateName, jsonFiles, htmlFiles)
      console.log('[Status API] Completion check:', completionCheck)
      
      if (completionCheck.isCompleted) {
        res.json({
          code: 200,
          success: true,
          status: 'completed',
          files: {
            json: jsonFiles,
            html: htmlFiles,
            total: jsonFiles.length + htmlFiles.length
          },
          message: completionCheck.message,
          progress: completionCheck.progress,
          templateName
        })
      } else if (jsonFiles.length > 0 || htmlFiles.length > 0) {
        // 部分文件已生成，但还未完成
        res.json({
          code: 200,
          success: true,
          status: 'generating',
          message: completionCheck.message,
          progress: completionCheck.progress,
          templateName
        })
      } else {
        res.json({
          code: 200,
          success: true,
          status: 'generating',
          message: '正在生成中',
          progress: { json: 0, html: 0 },
          templateName
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
 * 根据任务ID检查生成状态
 * GET /api/generate/status/task/:taskId
 */
router.get('/task/:taskId', authenticateUserOrDefault, async (req, res) => {
  try {
    const { taskId } = req.params
    const username = req.user.username
    
    console.log('[Status API] Checking status for taskId:', taskId)
    
    // 获取用户的workspace路径
    const { cardPath } = userService.getUserWorkspacePath(username)
    
    // 获取所有文件夹的元数据
    const allFolders = await getAllFoldersMetadata(cardPath)
    
    // 查找包含该taskId的文件夹
    let foundFolder = null
    let foundFolderName = null
    
    for (const [folderName, metadata] of Object.entries(allFolders)) {
      if (metadata.taskId === taskId) {
        foundFolder = metadata
        foundFolderName = folderName
        break
      }
    }
    
    if (!foundFolder) {
      return res.json({
        code: 404,
        success: false,
        status: 'not_found',
        message: '任务不存在或已过期'
      })
    }
    
    console.log('[Status API] Found task in folder:', foundFolderName, 'with status:', foundFolder.status)
    
    // 根据元数据状态返回
    if (foundFolder.status === 'completed') {
      // 读取文件信息
      const userCardPath = userService.getUserCardPath(username, foundFolderName)
      try {
        const files = await fs.readdir(userCardPath)
        const jsonFiles = files.filter(f => f.endsWith('.json') && !f.includes('-response') && !f.includes('_meta'))
        const htmlFiles = files.filter(f => f.endsWith('.html') && !f.includes('-response'))
        
        return res.json({
          code: 200,
          success: true,
          status: 'completed',
          taskId: taskId,
          topic: foundFolder.topic || foundFolderName,
          files: {
            json: jsonFiles,
            html: htmlFiles,
            total: jsonFiles.length + htmlFiles.length
          },
          message: '生成完成',
          progress: { json: jsonFiles.length, html: htmlFiles.length },
          templateName: foundFolder.templateName,
          metadata: foundFolder
        })
      } catch (error) {
        console.log('[Status API] Error reading files for completed task:', error.message)
      }
    } else if (foundFolder.status === 'generating' || foundFolder.status === 'processing') {
      return res.json({
        code: 200,
        success: true,
        status: 'processing',
        taskId: taskId,
        topic: foundFolder.topic || foundFolderName,
        message: '正在生成中',
        progress: { json: 0, html: 0 },
        templateName: foundFolder.templateName,
        metadata: foundFolder
      })
    } else if (foundFolder.status === 'failed') {
      return res.json({
        code: 200,
        success: true,
        status: 'failed',
        taskId: taskId,
        topic: foundFolder.topic || foundFolderName,
        message: foundFolder.error || '生成失败',
        templateName: foundFolder.templateName,
        metadata: foundFolder
      })
    } else {
      // 其他状态
      return res.json({
        code: 200,
        success: true,
        status: foundFolder.status || 'unknown',
        taskId: taskId,
        topic: foundFolder.topic || foundFolderName,
        message: '状态未知',
        metadata: foundFolder
      })
    }
    
  } catch (error) {
    console.error('[Status API] Error checking task status:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: error.message
    })
  }
})

export default router