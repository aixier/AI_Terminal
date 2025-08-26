import express from 'express'
import cardRoutes from './card.js'
import cardAsyncRoutes from './cardAsync.js'
import cardStreamRoutes from './cardStream.js'
import cardQueryRoutes from './cardQuery.js'
import templateRoutes from './templates.js'
import statusRoutes from './status.js'
import claudeRoutes from './claude.js'

const router = express.Router()

/**
 * 生成路由模块
 * 将原来的单一 generate.js 文件拆分为多个模块化文件
 * 提高可维护性和可扩展性
 */

// 卡片生成相关路由
router.use('/card', cardRoutes)           // POST /api/generate/card
router.use('/card/async', cardAsyncRoutes) // POST /api/generate/card/async
router.use('/card/stream', cardStreamRoutes) // POST /api/generate/card/stream
router.use('/card/query', cardQueryRoutes) // GET /api/generate/card/query/:folderName

// 模板和状态路由
router.use('/templates', templateRoutes)   // GET /api/generate/templates
router.use('/status', statusRoutes)        // GET /api/generate/status/:topic

// Claude执行路由
router.use('/cc', claudeRoutes)           // POST /api/generate/cc

// 健康检查
router.get('/health', (req, res) => {
  res.json({
    code: 200,
    success: true,
    message: 'Generate module is healthy',
    modules: {
      card: 'active',
      cardAsync: 'active',
      cardStream: 'active',
      cardQuery: 'active',
      templates: 'active',
      status: 'active',
      claude: 'active'
    }
  })
})

export default router