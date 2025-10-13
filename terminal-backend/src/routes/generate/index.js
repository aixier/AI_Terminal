import express from 'express'
import cardRoutes from './card.js'
import cardAsyncRoutes from './cardAsync.js'
import cardStreamRoutes from './cardStream.js'
import cardQueryRoutes from './cardQuery.js'
import cardContentRoutes from './cardContent.js'
import customAsyncRoutes from './customAsync.js'
import customStatusRoutes from './customStatus.js'
import customOssAsyncRoutes from './customOssAsync.js'
import customOssStatusRoutes from './customOssStatus.js'
import pod2postAsyncRoutes from './pod2postAsync.js'
import pod2postStatusRoutes from './pod2postStatus.js'
import pod2postContentRoutes from './pod2postContent.js'
import pod2postCdnRoutes from './pod2postCdn.js'
import pod2postPicRoutes from './pod2postPic.js'
import pod2postResourcesRoutes from './pod2postResources.js'
import pod2postWriteTextRoutes from './pod2postWriteText.js'
import pod2postUploadAndReturnUrlRoutes from './pod2postUploadAndReturnUrl.js'
import templateRoutes from './templates.js'
import statusRoutes from './status.js'
import claudeRoutes from './claude.js'
import shareRoutes from './share.js'

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
router.use('/card/query', cardQueryRoutes) // GET /api/generate/card/query/:folderName (通用目录查询)
router.use('/card/content', cardContentRoutes) // GET /api/generate/card/content/:folderName (特殊格式化内容查询)

// 自定义模板路由
router.use('/custom/async', customAsyncRoutes) // POST /api/generate/custom/async
router.use('/custom/status', customStatusRoutes) // GET /api/generate/custom/status/:taskId
router.use('/custom/ossasync', customOssAsyncRoutes) // POST /api/generate/custom/ossasync
router.use('/custom/ossstatus', customOssStatusRoutes) // GET /api/generate/custom/ossstatus/:taskId

// Pod2Post播客卡片路由
router.use('/pod2post/async', pod2postAsyncRoutes) // POST /api/generate/pod2post/async
router.use('/pod2post/status', pod2postStatusRoutes) // GET /api/generate/pod2post/status/:taskId
router.use('/pod2post/content', pod2postContentRoutes) // GET /api/generate/pod2post/content/:folderName
router.use('/pod2post/cdn', pod2postCdnRoutes) // POST /api/generate/pod2post/cdn (CDN图片上传)
router.use('/pod2post/pic', pod2postPicRoutes) // POST /api/generate/pod2post/pic (照片上传)
router.use('/pod2post/resources', pod2postResourcesRoutes) // POST /api/generate/pod2post/resources (参考文档上传)
router.use('/pod2post/write-text', pod2postWriteTextRoutes) // POST /api/generate/pod2post/write-text (文本文件写入)
router.use('/pod2post/upload-and-return-url', pod2postUploadAndReturnUrlRoutes) // POST /api/generate/pod2post/upload-and-return-url (上传并返回OSS URL)

// 模板和状态路由
router.use('/templates', templateRoutes)   // GET /api/generate/templates
router.use('/status', statusRoutes)        // GET /api/generate/status/:topic

// Claude执行路由
router.use('/cc', claudeRoutes)           // POST /api/generate/cc

// 分享路由
router.use('/share', shareRoutes)         // POST /api/generate/share/xiaohongshu

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
      customAsync: 'active',
      customOssAsync: 'active',
      pod2postAsync: 'active',
      pod2postCdn: 'active',
      pod2postPic: 'active',
      pod2postResources: 'active',
      pod2postWriteText: 'active',
      pod2postUploadAndReturnUrl: 'active',
      templates: 'active',
      status: 'active',
      claude: 'active'
    }
  })
})

export default router