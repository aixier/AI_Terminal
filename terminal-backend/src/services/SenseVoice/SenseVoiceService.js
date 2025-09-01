import axios from 'axios'
import FormData from 'form-data'
import fs from 'fs'
import path from 'path'
import { promises as fsPromises } from 'fs'
import logger from '../../utils/logger.js'
import config from '../../config/config.js'
import TaskManager from './TaskManager.js'

class SenseVoiceService {
  constructor() {
    this.baseUrl = 'https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription'
    this.apiKey = process.env.ALIYUN_API_KEY || config.aliyun?.apiKey
    this.taskManager = TaskManager
    
    // 启动定期清理任务
    this.startCleanupScheduler()
  }

  /**
   * 启动定期清理过期任务
   */
  startCleanupScheduler() {
    setInterval(() => {
      this.taskManager.cleanupOldTasks().catch(err => {
        logger.error('Task cleanup failed:', err)
      })
    }, 60 * 60 * 1000) // 每小时清理一次
  }

  /**
   * 提交转录任务（文件）
   */
  async submitTranscriptionTask(filePath, options = {}) {
    try {
      if (!this.apiKey) {
        throw new Error('Aliyun API key not configured')
      }

      // 验证文件
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`)
      }

      const stats = fs.statSync(filePath)
      const fileSizeInMB = stats.size / (1024 * 1024)
      
      if (fileSizeInMB > 100) {
        throw new Error(`File size exceeds limit: ${fileSizeInMB.toFixed(2)}MB`)
      }

      // 创建任务记录
      const taskId = await this.taskManager.createTask('file', {
        filePath,
        fileName: path.basename(filePath),
        fileSize: stats.size,
        options
      })

      // 更新任务状态为处理中
      await this.taskManager.updateTask(taskId, {
        status: 'processing',
        progress: 10,
        message: 'Uploading file to Aliyun'
      })

      // 准备请求数据
      const formData = new FormData()
      formData.append('file', fs.createReadStream(filePath))
      
      const parameters = {
        format: options.format || 'auto',
        sample_rate: options.sampleRate || 16000,
        language_hints: options.languages || ['zh', 'en'],
        enable_words: options.enableWords !== false,
        enable_timestamp: options.enableTimestamp !== false,
        disfluency_removal: options.removeDisfluency || false,
        enable_punctuation: options.enablePunctuation !== false,
      }

      formData.append('model', 'sensevoice-v1')
      formData.append('parameters', JSON.stringify(parameters))

      logger.info(`Submitting transcription task ${taskId} for file: ${filePath}`)

      // 发送请求
      const response = await axios.post(this.baseUrl, formData, {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${this.apiKey}`,
          'X-DashScope-Async': 'enable'
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      })

      // 更新任务信息
      if (response.data.output?.task_id) {
        await this.taskManager.updateTask(taskId, {
          aliyunTaskId: response.data.output.task_id,
          progress: 30,
          message: 'Task submitted to Aliyun, processing...'
        })

        // 启动异步轮询
        this.pollTaskStatus(taskId, response.data.output.task_id)
      } else {
        // 同步结果（小文件可能直接返回）
        const result = this.formatResponse(response.data)
        await this.taskManager.updateTask(taskId, {
          status: 'succeeded',
          progress: 100,
          result,
          message: 'Transcription completed'
        })
      }

      return {
        success: true,
        taskId,
        message: 'Task submitted successfully',
        status: 'processing'
      }
    } catch (error) {
      logger.error('Submit transcription task error:', error)
      
      // 如果任务已创建，更新为失败状态
      if (taskId) {
        await this.taskManager.updateTask(taskId, {
          status: 'failed',
          error: error.message,
          message: 'Task failed'
        })
      }
      
      throw this.handleError(error)
    }
  }

  /**
   * 提交URL转录任务
   */
  async submitUrlTranscriptionTask(url, options = {}) {
    try {
      if (!this.apiKey) {
        throw new Error('Aliyun API key not configured')
      }

      // 创建任务记录
      const taskId = await this.taskManager.createTask('url', {
        url,
        options
      })

      // 更新任务状态
      await this.taskManager.updateTask(taskId, {
        status: 'processing',
        progress: 10,
        message: 'Submitting URL to Aliyun'
      })

      const parameters = {
        file_urls: [url],
        format: options.format || 'auto',
        sample_rate: options.sampleRate || 16000,
        language_hints: options.languages || ['zh', 'en'],
        enable_words: options.enableWords !== false,
        enable_timestamp: options.enableTimestamp !== false,
        disfluency_removal: options.removeDisfluency || false,
        enable_punctuation: options.enablePunctuation !== false,
      }

      logger.info(`Submitting URL transcription task ${taskId} for: ${url}`)

      const response = await axios.post(
        this.baseUrl,
        {
          model: 'sensevoice-v1',
          input: {},
          parameters
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'X-DashScope-Async': 'enable'
          }
        }
      )

      if (response.data.output?.task_id) {
        await this.taskManager.updateTask(taskId, {
          aliyunTaskId: response.data.output.task_id,
          progress: 30,
          message: 'Task submitted to Aliyun, processing...'
        })

        // 启动异步轮询
        this.pollTaskStatus(taskId, response.data.output.task_id)
      } else {
        const result = this.formatResponse(response.data)
        await this.taskManager.updateTask(taskId, {
          status: 'succeeded',
          progress: 100,
          result,
          message: 'Transcription completed'
        })
      }

      return {
        success: true,
        taskId,
        message: 'Task submitted successfully',
        status: 'processing'
      }
    } catch (error) {
      logger.error('Submit URL transcription task error:', error)
      
      if (taskId) {
        await this.taskManager.updateTask(taskId, {
          status: 'failed',
          error: error.message,
          message: 'Task failed'
        })
      }
      
      throw this.handleError(error)
    }
  }

  /**
   * 轮询任务状态
   */
  async pollTaskStatus(taskId, aliyunTaskId) {
    const maxAttempts = 120 // 最多10分钟
    const interval = 5000 // 每5秒查询一次
    
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await axios.get(
          `${this.baseUrl}/${aliyunTaskId}`,
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`
            }
          }
        )

        const status = response.data.output?.task_status
        const progress = this.calculateProgress(status, i, maxAttempts)

        await this.taskManager.addLog(taskId, 'status_check', `Aliyun task status: ${status}`, {
          attempt: i + 1,
          aliyunStatus: status
        })

        if (status === 'SUCCEEDED') {
          const result = this.formatResponse(response.data)
          await this.taskManager.updateTask(taskId, {
            status: 'succeeded',
            progress: 100,
            result,
            message: 'Transcription completed successfully'
          })
          
          logger.info(`Task ${taskId} completed successfully`)
          return
        } else if (status === 'FAILED') {
          const errorMessage = response.data.output?.message || 'Unknown error'
          await this.taskManager.updateTask(taskId, {
            status: 'failed',
            error: errorMessage,
            message: `Transcription failed: ${errorMessage}`
          })
          
          logger.error(`Task ${taskId} failed: ${errorMessage}`)
          return
        } else {
          // 更新进度
          await this.taskManager.updateTask(taskId, {
            progress,
            message: `Processing... (${status})`
          })
        }

        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, interval))
      } catch (error) {
        logger.error(`Error checking task ${taskId} status:`, error)
        
        if (i === maxAttempts - 1) {
          await this.taskManager.updateTask(taskId, {
            status: 'failed',
            error: 'Polling timeout',
            message: 'Task status check timed out'
          })
        }
      }
    }
  }

  /**
   * 计算任务进度
   */
  calculateProgress(status, attempt, maxAttempts) {
    const baseProgress = 30 // 提交后的基础进度
    const maxProgress = 95 // 最大进度（保留5%给最终完成）
    
    if (status === 'RUNNING' || status === 'PENDING') {
      // 根据尝试次数线性增长
      const progressRange = maxProgress - baseProgress
      const progress = baseProgress + (progressRange * (attempt / maxAttempts))
      return Math.min(Math.round(progress), maxProgress)
    }
    
    return baseProgress
  }

  /**
   * 获取任务状态
   */
  async getTaskStatus(taskId) {
    const task = this.taskManager.getTask(taskId)
    
    if (!task) {
      throw new Error(`Task ${taskId} not found`)
    }
    
    return {
      success: true,
      taskId: task.taskId,
      status: task.status,
      progress: task.progress,
      type: task.type,
      message: task.message,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
      executionTime: task.executionTime,
      hasResult: !!task.result,
      error: task.error
    }
  }

  /**
   * 获取任务结果
   */
  async getTaskResult(taskId) {
    const task = this.taskManager.getTask(taskId)
    
    if (!task) {
      throw new Error(`Task ${taskId} not found`)
    }
    
    if (task.status !== 'succeeded') {
      return {
        success: false,
        taskId,
        status: task.status,
        message: task.status === 'failed' 
          ? `Task failed: ${task.error}` 
          : `Task is still ${task.status}`,
        error: task.error
      }
    }
    
    return {
      success: true,
      taskId,
      status: 'succeeded',
      ...task.result
    }
  }

  /**
   * 格式化响应数据
   */
  formatResponse(data) {
    if (!data.output?.results) {
      throw new Error('Invalid response format')
    }

    const results = data.output.results
    
    // 提取完整文本
    const fullText = results.map(r => r.text).join(' ')
    
    // 提取带时间戳的句子
    const sentences = results.map(result => ({
      text: result.text,
      startTime: result.begin_time,
      endTime: result.end_time,
      words: result.words || []
    }))

    return {
      fullText,
      sentences,
      language: results[0]?.language || 'unknown',
      duration: results[results.length - 1]?.end_time || 0,
      wordCount: fullText.split(/\s+/).length,
      sentenceCount: sentences.length,
      metadata: {
        model: 'sensevoice-v1',
        processedAt: new Date().toISOString()
      }
    }
  }

  /**
   * 处理错误
   */
  handleError(error) {
    if (error.response) {
      const status = error.response.status
      const message = error.response.data?.message || error.response.statusText

      switch (status) {
        case 400:
          return new Error(`Invalid request: ${message}`)
        case 401:
          return new Error('Authentication failed: Invalid API key')
        case 403:
          return new Error('Access denied: Insufficient permissions')
        case 413:
          return new Error('File too large for transcription')
        case 429:
          return new Error('Rate limit exceeded: Too many requests')
        case 500:
          return new Error('Server error: Please try again later')
        default:
          return new Error(`API error (${status}): ${message}`)
      }
    }
    
    return error
  }

  /**
   * 获取支持的格式
   */
  getSupportedFormats() {
    return [
      'wav', 'mp3', 'mp4', 'm4a', 'aac', 
      'opus', 'flac', 'ogg', 'amr', 'webm',
      'mov', 'avi', 'mkv', 'wmv', 'flv'
    ]
  }

  /**
   * 验证文件格式
   */
  isFormatSupported(filePath) {
    const extension = path.extname(filePath).toLowerCase().replace('.', '')
    return this.getSupportedFormats().includes(extension)
  }

  /**
   * 批量提交任务
   */
  async submitBatchTranscription(files, options = {}) {
    const batchTaskId = await this.taskManager.createTask('batch', {
      totalFiles: files.length,
      options
    })

    const subTasks = []

    for (const file of files) {
      try {
        const result = await this.submitTranscriptionTask(file.path, options)
        subTasks.push({
          filename: file.originalname || path.basename(file.path),
          taskId: result.taskId,
          status: 'submitted'
        })
      } catch (error) {
        subTasks.push({
          filename: file.originalname || path.basename(file.path),
          error: error.message,
          status: 'failed'
        })
      }
    }

    await this.taskManager.updateTask(batchTaskId, {
      status: 'processing',
      subTasks,
      message: `Submitted ${subTasks.filter(t => t.status === 'submitted').length}/${files.length} files`
    })

    return {
      success: true,
      batchTaskId,
      subTasks,
      message: 'Batch task submitted'
    }
  }
}

export default new SenseVoiceService()