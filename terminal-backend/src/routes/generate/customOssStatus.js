import express from 'express'
import fs from 'fs/promises'
import path from 'path'
import { authenticateUserOrDefault } from '../../middleware/userAuth.js'
import userService from '../../services/userService.js'
import { getAllFoldersMetadata } from './utils/workspaceMetadata.js'

const router = express.Router()

/**
 * 根据任务ID检查自定义OSS模板生成状态
 * GET /api/generate/custom/ossstatus/:taskId
 */
router.get('/:taskId', authenticateUserOrDefault, async (req, res) => {
  try {
    const { taskId } = req.params
    const username = req.user.username
    
    console.log(`[CustomOssStatus] Checking status for task: ${taskId}, user: ${username}`)
    
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
      console.log(`[CustomOssStatus] Task not found: ${taskId}`)
      return res.json({
        code: 404,
        success: false,
        status: 'not_found',
        message: 'OSS任务不存在或已过期'
      })
    }
    
    console.log(`[CustomOssStatus] Found folder: ${foundFolderName}, status: ${foundFolder.status}`)
    
    // 根据元数据状态返回
    if (foundFolder.status === 'completed') {
      // 读取文件信息 - OSS模式特有的文件
      const userCardPath = userService.getUserCardPath(username, foundFolderName)
      try {
        const files = await fs.readdir(userCardPath)
        const htmlFiles = files.filter(f => f.endsWith('.html') && !f.includes('-response'))
        const mappingFile = files.find(f => f === 'resources_mapping.jsonl')
        
        // 区分原始HTML和OSS版本HTML
        const originalHtml = htmlFiles.filter(f => !f.includes('_oss'))
        const ossHtml = htmlFiles.filter(f => f.includes('_oss'))
        
        return res.json({
          code: 200,
          success: true,
          status: 'completed',
          taskId: taskId,
          folderName: foundFolderName,
          topic: foundFolder.topic || foundFolderName,
          mode: 'oss', // 标识为OSS模式
          files: {
            html: htmlFiles,
            original: originalHtml,
            oss: ossHtml,
            mapping: mappingFile ? [mappingFile] : [],
            total: htmlFiles.length + (mappingFile ? 1 : 0)
          },
          message: 'OSS生成完成',
          progress: { 
            html: htmlFiles.length, 
            oss: ossHtml.length,
            mapping: mappingFile ? 1 : 0
          },
          templateName: foundFolder.templateName,
          metadata: {
            ...foundFolder,
            ossInfo: foundFolder.ossInfo || {
              uploadedFiles: foundFolder.statistics?.uploadedFiles || 0,
              replacedPaths: foundFolder.statistics?.replacedPaths || 0,
              totalSize: foundFolder.statistics?.ossSize || '0MB'
            }
          }
        })
      } catch (error) {
        console.error(`[CustomOssStatus] Error reading files for ${foundFolderName}:`, error)
        return res.json({
          code: 200,
          success: true,
          status: 'completed',
          taskId: taskId,
          folderName: foundFolderName,
          topic: foundFolder.topic || foundFolderName,
          mode: 'oss',
          message: 'OSS生成完成',
          templateName: foundFolder.templateName,
          metadata: foundFolder
        })
      }
    } else if (foundFolder.status === 'generating') {
      // 正在生成中 - OSS模式的AI生成阶段
      let claudeOutput = null
      try {
        const apiTerminalService = (await import('../../utils/apiTerminalService.js')).default
        // 构造可能的API ID
        const apiIdParts = taskId.replace('custom_oss_', '').split('_')
        const apiId = apiIdParts[0] + '_' + apiIdParts.pop()
        claudeOutput = await apiTerminalService.getLastOutput(apiId)
      } catch (e) {
        console.log('[CustomOssStatus] Could not get Claude output:', e.message)
      }
      
      return res.json({
        code: 200,
        success: true,
        status: 'generating',
        taskId: taskId,
        folderName: foundFolderName,
        topic: foundFolder.topic || foundFolderName,
        mode: 'oss',
        message: '正在AI生成中',
        progress: { html: 0, oss: 0 },
        templateName: foundFolder.templateName,
        metadata: {
          ...foundFolder,
          phase: 'AI生成阶段'
        },
        claudeOutput: claudeOutput
      })
    } else if (foundFolder.status === 'preparing') {
      // OSS模式特有的资源准备阶段
      return res.json({
        code: 200,
        success: true,
        status: 'preparing',
        taskId: taskId,
        folderName: foundFolderName,
        topic: foundFolder.topic || foundFolderName,
        mode: 'oss',
        message: '正在准备资源和上传OSS',
        progress: { html: 0, oss: 0 },
        templateName: foundFolder.templateName,
        metadata: {
          ...foundFolder,
          phase: '资源处理阶段',
          uploadProgress: foundFolder.statistics?.uploadedFiles || 0
        }
      })
    } else if (foundFolder.status === 'post_processing') {
      // OSS模式特有的后处理阶段
      return res.json({
        code: 200,
        success: true,
        status: 'post_processing',
        taskId: taskId,
        folderName: foundFolderName,
        topic: foundFolder.topic || foundFolderName,
        mode: 'oss',
        message: '正在替换路径为OSS链接',
        progress: { html: 1, oss: 0 },
        templateName: foundFolder.templateName,
        metadata: {
          ...foundFolder,
          phase: '路径替换阶段'
        }
      })
    } else if (foundFolder.status === 'uploading') {
      // 向后兼容旧的uploading状态
      return res.json({
        code: 200,
        success: true,
        status: 'preparing', // 映射到新的preparing状态
        taskId: taskId,
        folderName: foundFolderName,
        topic: foundFolder.topic || foundFolderName,
        mode: 'oss',
        message: '正在上传资源到OSS',
        progress: { html: 0, oss: 0 },
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
        mode: 'oss',
        message: foundFolder.error || 'OSS生成失败',
        templateName: foundFolder.templateName,
        metadata: {
          ...foundFolder,
          errorDetails: foundFolder.logs?.filter(log => log.level === 'error') || []
        }
      })
    } else if (foundFolder.status === 'initialized' || foundFolder.status === 'submitted') {
      return res.json({
        code: 200,
        success: true,
        status: foundFolder.status,
        taskId: taskId,
        folderName: foundFolderName,
        topic: foundFolder.topic || foundFolderName,
        mode: 'oss',
        message: 'OSS任务已提交，等待处理',
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
        mode: 'oss',
        message: 'OSS任务状态未知',
        metadata: foundFolder
      })
    }
    
  } catch (error) {
    console.error(`[CustomOssStatus] Error checking status:`, error)
    res.status(500).json({
      code: 500,
      success: false,
      message: `检查OSS任务状态时发生错误: ${error.message}`
    })
  }
})

/**
 * 获取OSS任务的资源映射信息
 * GET /api/generate/custom/ossstatus/:taskId/mapping
 */
router.get('/:taskId/mapping', authenticateUserOrDefault, async (req, res) => {
  try {
    const { taskId } = req.params
    const username = req.user.username
    
    // 获取用户的workspace路径
    const { cardPath } = userService.getUserWorkspacePath(username)
    
    // 获取所有文件夹的元数据
    const allFolders = await getAllFoldersMetadata(cardPath)
    
    // 查找包含该taskId的文件夹
    let foundFolderName = null
    
    for (const [folderName, metadata] of Object.entries(allFolders || {})) {
      if (metadata.taskId === taskId) {
        foundFolderName = folderName
        break
      }
    }
    
    if (!foundFolderName) {
      return res.json({
        code: 404,
        success: false,
        message: '任务不存在'
      })
    }
    
    // 读取资源映射文件
    const userCardPath = userService.getUserCardPath(username, foundFolderName)
    const mappingFilePath = path.join(userCardPath, 'resources_mapping.jsonl')
    
    try {
      const mappingContent = await fs.readFile(mappingFilePath, 'utf-8')
      const mappings = mappingContent.split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line))
      
      return res.json({
        code: 200,
        success: true,
        data: {
          taskId,
          totalMappings: mappings.length,
          mappings: mappings
        },
        message: '获取资源映射成功'
      })
    } catch (error) {
      return res.json({
        code: 404,
        success: false,
        message: '资源映射文件不存在或任务未完成'
      })
    }
    
  } catch (error) {
    console.error(`[CustomOssStatus] Error getting mapping:`, error)
    res.status(500).json({
      code: 500,
      success: false,
      message: error.message
    })
  }
})

export default router