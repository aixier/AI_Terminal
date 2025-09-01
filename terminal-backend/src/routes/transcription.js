import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { promises as fsPromises } from 'fs'
import senseVoiceService from '../services/SenseVoice/index.js'
import TaskManager from '../services/SenseVoice/TaskManager.js'
import logger from '../utils/logger.js'
import { OSSService } from '../services/oss/index.js'

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
  if (senseVoiceService.getSupportedFormats().includes(ext)) {
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
 * 流程：上传文件到OSS -> 获取外部访问URL -> 调用阿里云转录API
 */
router.post('/file', upload.single('file'), async (req, res) => {
  let filePath = null
  let ossService = null
  let ossPath = null
  
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      })
    }

    filePath = req.file.path
    logger.info(`Processing transcription for file: ${req.file.originalname}`)

    // 初始化OSS服务
    ossService = new OSSService('transcription', {
      baseDir: 'transcription',
      structure: {
        audio: 'audio',
        video: 'video',
        temp: 'temp'
      }
    })

    // 根据文件类型确定目录
    const ext = path.extname(req.file.originalname).toLowerCase()
    const isVideo = ['.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.webm'].includes(ext)
    const subDir = isVideo ? 'video' : 'audio'

    // 生成唯一文件名
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 8)
    const fileName = `${timestamp}-${randomStr}${ext}`
    ossPath = `transcription/${subDir}/${fileName}`

    logger.info(`Uploading file to OSS: ${ossPath}`)

    // 上传文件到OSS
    const uploadResult = await ossService.upload(filePath, {
      remotePath: ossPath,
      headers: {
        'Content-Type': isVideo ? 'video/*' : 'audio/*'
      }
    })

    if (!uploadResult.success) {
      throw new Error('Failed to upload file to OSS')
    }

    // 生成签名URL（有效期2小时，给转录任务充足时间）
    const signedUrl = await ossService.generateSignedUrl(ossPath, 7200)
    logger.info(`File uploaded to OSS, URL generated`)

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

    // 使用OSS URL提交转录任务
    const result = await senseVoiceService.submitUrlTranscriptionTask(signedUrl, {
      ...options,
      originalFileName: req.file.originalname,
      ossPath: ossPath
    })

    // 删除本地临时文件
    await fsPromises.unlink(filePath).catch(err => {
      logger.error(`Failed to delete temp file: ${err.message}`)
    })

    // 返回结果，包含OSS信息
    res.json({
      ...result,
      ossPath: ossPath
    })
  } catch (error) {
    logger.error('Transcription route error:', error)
    
    // 清理本地临时文件
    if (filePath && fs.existsSync(filePath)) {
      await fsPromises.unlink(filePath).catch(err => {
        logger.error(`Failed to delete temp file after error: ${err.message}`)
      })
    }

    // 如果已上传到OSS，可选择是否删除（建议保留以便调试）
    if (ossService && ossPath) {
      logger.info(`OSS file preserved for debugging: ${ossPath}`)
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

    // 提交URL转录任务
    const result = await senseVoiceService.submitUrlTranscriptionTask(url, options)

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
    formats: senseVoiceService.getSupportedFormats(),
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

    // 初始化OSS服务
    const ossService = new OSSService('transcription', {
      baseDir: 'transcription',
      structure: {
        audio: 'audio',
        video: 'video',
        batch: 'batch'
      }
    })

    // 批次ID用于组织文件
    const batchId = `batch-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
    const uploadedFiles = []

    // 并行处理所有文件
    const promises = req.files.map(async (file) => {
      try {
        // 确定文件类型和目录
        const ext = path.extname(file.originalname).toLowerCase()
        const isVideo = ['.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.webm'].includes(ext)
        const subDir = isVideo ? 'video' : 'audio'

        // 生成OSS路径
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`
        const ossPath = `transcription/batch/${batchId}/${subDir}/${fileName}`

        logger.info(`Uploading batch file to OSS: ${ossPath}`)

        // 上传到OSS
        const uploadResult = await ossService.upload(file.path, {
          remotePath: ossPath,
          headers: {
            'Content-Type': isVideo ? 'video/*' : 'audio/*'
          }
        })

        if (!uploadResult.success) {
          throw new Error('Failed to upload file to OSS')
        }

        // 生成签名URL
        const signedUrl = await ossService.generateSignedUrl(ossPath, 7200)
        uploadedFiles.push({ ossPath, originalName: file.originalname })

        // 提交转录任务
        const result = await senseVoiceService.submitUrlTranscriptionTask(signedUrl, {
          ...options,
          originalFileName: file.originalname,
          ossPath: ossPath,
          batchId: batchId
        })

        results.push({
          filename: file.originalname,
          ...result,
          ossPath: ossPath
        })
      } catch (error) {
        errors.push({
          filename: file.originalname,
          error: error.message
        })
      } finally {
        // 删除本地临时文件
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
      batchId: batchId,
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
 * GET /api/transcription/task/:taskId
 * 获取任务状态
 */
router.get('/task/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params
    const result = await senseVoiceService.getTaskStatus(taskId)
    res.json(result)
  } catch (error) {
    logger.error('Get task status error:', error)
    res.status(404).json({
      success: false,
      error: error.message || 'Task not found'
    })
  }
})

/**
 * GET /api/transcription/task/:taskId/result
 * 获取任务结果
 */
router.get('/task/:taskId/result', async (req, res) => {
  try {
    const { taskId } = req.params
    const result = await senseVoiceService.getTaskResult(taskId)
    
    if (!result.success && result.status !== 'succeeded') {
      return res.status(result.status === 'failed' ? 400 : 202).json(result)
    }
    
    res.json(result)
  } catch (error) {
    logger.error('Get task result error:', error)
    res.status(404).json({
      success: false,
      error: error.message || 'Task not found'
    })
  }
})

/**
 * GET /api/transcription/tasks
 * 获取任务列表
 */
router.get('/tasks', (req, res) => {
  try {
    const filter = {
      status: req.query.status,
      type: req.query.type,
      since: req.query.since,
      page: req.query.page ? parseInt(req.query.page) : 1,
      limit: req.query.limit ? parseInt(req.query.limit) : 20
    }
    
    const result = TaskManager.getAllTasks(filter)
    res.json({
      success: true,
      ...result
    })
  } catch (error) {
    logger.error('Get tasks list error:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get tasks'
    })
  }
})

/**
 * DELETE /api/transcription/task/:taskId
 * 删除任务
 */
router.delete('/task/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params
    await TaskManager.deleteTask(taskId)
    res.json({
      success: true,
      message: 'Task deleted successfully'
    })
  } catch (error) {
    logger.error('Delete task error:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete task'
    })
  }
})

/**
 * POST /api/transcription/task/:taskId/retry
 * 重试失败的任务
 */
router.post('/task/:taskId/retry', async (req, res) => {
  try {
    const { taskId } = req.params
    const newTaskId = await TaskManager.retryTask(taskId)
    res.json({
      success: true,
      newTaskId,
      message: 'Task retry submitted'
    })
  } catch (error) {
    logger.error('Retry task error:', error)
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to retry task'
    })
  }
})

/**
 * GET /api/transcription/statistics
 * 获取统计信息
 */
router.get('/statistics', (req, res) => {
  try {
    const stats = TaskManager.getStatistics()
    res.json({
      success: true,
      statistics: stats
    })
  } catch (error) {
    logger.error('Get statistics error:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get statistics'
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