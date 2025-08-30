import express from 'express'
import fs from 'fs/promises'
import path from 'path'
import { authenticateUserOrDefault } from '../../middleware/userAuth.js'
import userService from '../../services/userService.js'
import { checkGenerationCompletion } from '../../utils/templateRegistry.js'
import { getAllFoldersMetadata } from './utils/workspaceMetadata.js'

const router = express.Router()

/**
 * 检查生成状态（用于轮询）
 * GET /api/generate/status/:topic
 */
router.get('/:topic', authenticateUserOrDefault, async (req, res) => {
  try {
    const { topic } = req.params
    const username = req.user.username
    
    const userCardPath = userService.getUserCardPath(username, topic)
    
    try {
      const files = await fs.readdir(userCardPath)
      const jsonFiles = files.filter(f => f.endsWith('.json') && !f.includes('-response') && !f.includes('_meta'))
      const htmlFiles = files.filter(f => f.endsWith('.html') && !f.includes('-response'))
      
      // 尝试从元数据获取模板信息
      let templateName = null
      try {
        const userCardBasePath = userService.getUserCardBasePath(username)
        const folders = await getAllFoldersMetadata(userCardBasePath)
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
      const completionCheck = await checkGenerationCompletion(templateName, jsonFiles, htmlFiles)
      
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

export default router