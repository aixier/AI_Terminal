import express from 'express'
import claudeService from '../services/claudeService.js'
import logger from '../utils/logger.js'

const router = express.Router()

/**
 * 执行Terminal命令（两阶段流程）
 * POST /api/terminal/execute
 */
router.post('/execute', async (req, res) => {
  try {
    const { command, type, topic } = req.body
    const userId = req.session?.userId || 'default'

    if (!command || !type) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: command and type'
      })
    }

    logger.info(`Executing ${type} command for user ${userId}`)

    const result = await claudeService.executeCommand(userId, {
      command,
      type,
      topic
    })

    // 如果是生成卡片成功，保存元数据
    if (type === 'generate-card' && result.success && result.url && topic) {
      await claudeService.saveCardMetadata(userId, topic, result.url)
    }

    res.json(result)
  } catch (error) {
    logger.error('Terminal execution error:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * 获取用户的卡片文件夹列表
 * GET /api/terminal/folders
 */
router.get('/folders', async (req, res) => {
  try {
    const userId = req.session?.userId || 'default'
    const folders = await claudeService.getUserFolders(userId)
    
    res.json({
      success: true,
      folders
    })
  } catch (error) {
    logger.error('Error getting user folders:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * 健康检查 - 检查Claude会话状态
 * GET /api/terminal/health
 */
router.get('/health', (req, res) => {
  const userId = req.session?.userId || 'default'
  const hasSession = claudeService.claudeSessions.has(userId)
  
  res.json({
    success: true,
    hasActiveSession: hasSession,
    userId
  })
})

/**
 * 清理用户会话
 * POST /api/terminal/cleanup
 */
router.post('/cleanup', (req, res) => {
  const userId = req.session?.userId || 'default'
  claudeService.destroySession(userId)
  
  res.json({
    success: true,
    message: 'Session cleaned up'
  })
})

export default router