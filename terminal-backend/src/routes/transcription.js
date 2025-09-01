import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { promises as fsPromises } from 'fs'
import transcriptionService from '../services/transcriptionService.js'
import logger from '../utils/logger.js'

const router = express.Router()

// 配置文件上传
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'data', 'uploads', 'transcription')
    await fsPromises.mkdir(uploadDir, { recursive: true })
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    const ext = path.extname(file.originalname)
    cb(null, `audio-${uniqueSuffix}${ext}`)
  }
})

// 文件过滤器
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '')
  if (transcriptionService.getSupportedFormats().includes(ext)) {
    cb(null, true)
  } else {
    cb(new Error(`Unsupported file format: ${ext}`), false)
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB
  }
})

/**
 * POST /api/transcription/file
 * 上传音频/视频文件并转录为文字
 */
router.post('/file', upload.single('file'), async (req, res) => {
  let filePath = null
  
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      })
    }

    filePath = req.file.path
    logger.info(`Processing transcription for file: ${req.file.originalname}`)

    // 解析选项
    const options = {
      format: req.body.format,
      sampleRate: req.body.sampleRate ? parseInt(req.body.sampleRate) : undefined,
      languages: req.body.languages ? JSON.parse(req.body.languages) : undefined,
      enableWords: req.body.enableWords === 'true',
      enableTimestamp: req.body.enableTimestamp !== 'false',
      removeDisfluency: req.body.removeDisfluency === 'true',
      enablePunctuation: req.body.enablePunctuation !== 'false'
    }

    // 调用转录服务
    const result = await transcriptionService.transcribe(filePath, options)

    // 删除临时文件
    await fsPromises.unlink(filePath).catch(err => {
      logger.error(`Failed to delete temp file: ${err.message}`)
    })

    res.json(result)
  } catch (error) {
    logger.error('Transcription route error:', error)
    
    // 清理临时文件
    if (filePath && fs.existsSync(filePath)) {
      await fsPromises.unlink(filePath).catch(err => {
        logger.error(`Failed to delete temp file after error: ${err.message}`)
      })
    }

    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Transcription failed'
    })
  }
})

/**
 * POST /api/transcription/url
 * 从URL转录音频/视频
 */
router.post('/url', async (req, res) => {
  try {
    const { url, ...options } = req.body

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      })
    }

    logger.info(`Processing transcription from URL: ${url}`)

    // 调用转录服务
    const result = await transcriptionService.transcribeFromUrl(url, options)

    res.json(result)
  } catch (error) {
    logger.error('URL transcription route error:', error)
    
    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Transcription failed'
    })
  }
})

/**
 * GET /api/transcription/formats
 * 获取支持的文件格式
 */
router.get('/formats', (req, res) => {
  res.json({
    success: true,
    formats: transcriptionService.getSupportedFormats(),
    maxFileSize: '100MB'
  })
})

/**
 * POST /api/transcription/batch
 * 批量转录多个文件
 */
router.post('/batch', upload.array('files', 10), async (req, res) => {
  const results = []
  const errors = []
  
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      })
    }

    logger.info(`Processing batch transcription for ${req.files.length} files`)

    // 解析选项
    const options = {
      format: req.body.format,
      sampleRate: req.body.sampleRate ? parseInt(req.body.sampleRate) : undefined,
      languages: req.body.languages ? JSON.parse(req.body.languages) : undefined,
      enableWords: req.body.enableWords === 'true',
      enableTimestamp: req.body.enableTimestamp !== 'false',
      removeDisfluency: req.body.removeDisfluency === 'true',
      enablePunctuation: req.body.enablePunctuation !== 'false'
    }

    // 并行处理所有文件
    const promises = req.files.map(async (file) => {
      try {
        const result = await transcriptionService.transcribe(file.path, options)
        results.push({
          filename: file.originalname,
          ...result
        })
      } catch (error) {
        errors.push({
          filename: file.originalname,
          error: error.message
        })
      } finally {
        // 删除临时文件
        await fsPromises.unlink(file.path).catch(err => {
          logger.error(`Failed to delete temp file: ${err.message}`)
        })
      }
    })

    await Promise.all(promises)

    res.json({
      success: true,
      total: req.files.length,
      successful: results.length,
      failed: errors.length,
      results,
      errors
    })
  } catch (error) {
    logger.error('Batch transcription route error:', error)
    
    // 清理所有临时文件
    if (req.files) {
      await Promise.all(req.files.map(file => 
        fsPromises.unlink(file.path).catch(err => {
          logger.error(`Failed to delete temp file: ${err.message}`)
        })
      ))
    }

    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Batch transcription failed'
    })
  }
})

/**
 * POST /api/transcription/stream
 * 实时流式转录（用于实时音频流）
 * 注意：这需要WebSocket支持，这里只是占位
 */
router.post('/stream', (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Real-time streaming transcription not implemented yet',
    message: 'Please use WebSocket endpoint for real-time transcription'
  })
})

export default router