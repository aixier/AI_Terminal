import express from 'express'
import fs from 'fs/promises'
import path from 'path'
import { authenticateUserOrDefault } from '../../middleware/userAuth.js'
import userService from '../../services/userService.js'
import { getAllFoldersMetadata } from './utils/workspaceMetadata.js'

const router = express.Router()

/**
 * 根据任务ID检查自定义模板生成状态
 * GET /api/generate/custom/status/:taskId
 */
router.get('/:taskId', authenticateUserOrDefault, async (req, res) => {
  try {
    const { taskId } = req.params
    const username = req.user.username
    
    
    // 获取用户的workspace路径
    const { cardPath } = userService.getUserWorkspacePath(username)
    
    // 获取所有文件夹的元数据
    const allFolders = await getAllFoldersMetadata(cardPath)
    
    // 查找包含该taskId的文件夹
    let foundFolder = null
    let foundFolderName = null
    
    for (const [folderName, metadata] of Object.entries(allFolders || {})) {
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
          folderName: foundFolderName,
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
        return res.json({
          code: 200,
          success: true,
          status: 'completed',
          taskId: taskId,
          folderName: foundFolderName,
          topic: foundFolder.topic || foundFolderName,
          message: '生成完成',
          templateName: foundFolder.templateName,
          metadata: foundFolder
        })
      }
    } else if (foundFolder.status === 'generating') {
      // 正在生成中 - 尝试获取Claude终端输出
      let claudeOutput = null
      try {
        const apiTerminalService = (await import('../../utils/apiTerminalService.js')).default
        const apiId = taskId.replace('custom_', '').split('_')[0] + '_' + 
                     taskId.split('_').pop()
        claudeOutput = await apiTerminalService.getLastOutput(apiId)
      } catch (e) {
        console.log('[Custom Status API] Could not get Claude output:', e.message)
      }
      
      return res.json({
        code: 200,
        success: true,
        status: 'generating',
        taskId: taskId,
        folderName: foundFolderName,
        topic: foundFolder.topic || foundFolderName,
        message: '正在生成中',
        progress: { json: 0, html: 0 },
        templateName: foundFolder.templateName,
        metadata: foundFolder,
        claudeOutput: claudeOutput
      })
    } else if (foundFolder.status === 'processing') {
      return res.json({
        code: 200,
        success: true,
        status: 'processing',
        taskId: taskId,
        folderName: foundFolderName,
        topic: foundFolder.topic || foundFolderName,
        message: '正在处理',
        progress: { json: 0, html: 0 },
        templateName: foundFolder.templateName,
        metadata: foundFolder
      })
    } else if (foundFolder.status === 'uploading') {
      return res.json({
        code: 200,
        success: true,
        status: 'uploading',
        taskId: taskId,
        folderName: foundFolderName,
        topic: foundFolder.topic || foundFolderName,
        message: '正在上传资源',
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
        folderName: foundFolderName,
        topic: foundFolder.topic || foundFolderName,
        message: foundFolder.error || '生成失败',
        templateName: foundFolder.templateName,
        metadata: foundFolder
      })
    } else if (foundFolder.status === 'initialized') {
      return res.json({
        code: 200,
        success: true,
        status: 'initialized',
        taskId: taskId,
        folderName: foundFolderName,
        topic: foundFolder.topic || foundFolderName,
        message: '已初始化，等待处理',
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
        folderName: foundFolderName,
        topic: foundFolder.topic || foundFolderName,
        message: '状态未知',
        metadata: foundFolder
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