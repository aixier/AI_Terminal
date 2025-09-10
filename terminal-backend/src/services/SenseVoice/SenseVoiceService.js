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
    this.apiKey = process.env.DASHSCOPE_API_KEY || process.env.ALIYUN_API_KEY || config.aliyun?.apiKey
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
   * 提交URL转录任务（同步模式） - 适用于短音频
   */
  async submitUrlTranscriptionTaskSync(url, options = {}) {
    let taskId = null
    
    try {
      logger.info('========================================')
      logger.info('SenseVoice服务 - 提交URL转录任务（同步模式）')
      logger.info('========================================')
      
      if (!this.apiKey) {
        throw new Error('Aliyun API key not configured')
      }

      // 创建任务记录
      taskId = await this.taskManager.createTask('url', {
        url,
        options,
        mode: 'sync'
      })
      
      logger.info(`创建本地任务ID: ${taskId}`)
      logger.info(`使用同步模式处理短音频`)

      // 更新任务状态
      await this.taskManager.updateTask(taskId, {
        status: 'processing',
        progress: 20,
        message: 'Submitting URL to Aliyun (Sync Mode)'
      })

      const parameters = {
        language_hints: options.languages || ['zh', 'en'],
        format: options.format || 'auto',
        sample_rate: options.sampleRate || 16000,
        enable_words: options.enableWords !== false,
        enable_timestamp: options.enableTimestamp !== false,
        disfluency_removal: options.removeDisfluency || false,
        enable_punctuation: options.enablePunctuation !== false,
      }

      logger.info('提交到阿里云API (同步模式):')
      logger.info(`  - API端点: ${this.baseUrl}`)
      logger.info(`  - 模型: sensevoice-v1`)
      logger.info(`  - URL: ${url.substring(0, 150)}...`)

      const startTime = Date.now()
      
      // 同步请求 - 不设置 X-DashScope-Async 头
      const response = await axios.post(
        this.baseUrl,
        {
          model: 'sensevoice-v1',
          input: {
            file_urls: [url]
          },
          parameters
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
            // 注意：不设置 'X-DashScope-Async' 头，使用同步模式
          },
          timeout: 120000 // 2分钟超时
        }
      )
      
      const processTime = ((Date.now() - startTime) / 1000).toFixed(2)
      logger.info(`同步处理完成，耗时: ${processTime}秒`)
      logger.info(`阿里云API响应:`)
      logger.info(`  - 状态码: ${response.status}`)
      logger.info(`  - 响应数据: ${JSON.stringify(response.data).substring(0, 200)}...`)

      // 直接处理同步响应
      if (response.data.output) {
        const result = this.formatSyncResponse(response.data)
        
        await this.taskManager.updateTask(taskId, {
          status: 'succeeded',
          progress: 100,
          result,
          message: 'Transcription completed (Sync Mode)'
        })

        logger.info(`同步任务 ${taskId} 完成，转录文本长度: ${result.transcription?.length || 0}`)
        
        return {
          success: true,
          taskId,
          message: 'Transcription completed successfully',
          status: 'succeeded',
          ...result
        }
      } else {
        throw new Error('Unexpected sync response format')
      }
    } catch (error) {
      logger.error('Submit sync URL transcription task error:', error)
      
      if (taskId) {
        await this.taskManager.updateTask(taskId, {
          status: 'failed',
          error: error.message,
          message: 'Sync task failed'
        })
      }
      
      throw this.handleError(error)
    }
  }

  /**
   * 格式化同步响应数据
   */
  formatSyncResponse(data) {
    if (!data.output) {
      throw new Error('Invalid sync response format')
    }

    const output = data.output
    
    // 提取文本
    let fullText = ''
    const sentences = []
    
    if (output.results && Array.isArray(output.results)) {
      output.results.forEach(result => {
        if (result.text) {
          // 清理标签
          const cleanText = result.text.replace(/<\|[^>]*\|>/g, '')
          fullText += cleanText + ' '
          
          sentences.push({
            text: cleanText,
            startTime: result.begin_time || 0,
            endTime: result.end_time || 0
          })
        }
      })
    } else if (output.text) {
      // 直接文本结果
      fullText = output.text.replace(/<\|[^>]*\|>/g, '')
    }

    fullText = fullText.trim()
    
    return {
      transcription: fullText,
      fullText,
      sentences,
      language: output.language || 'zh',
      duration: output.duration || 0,
      wordCount: fullText.length,
      sentenceCount: sentences.length,
      metadata: {
        model: 'sensevoice-v1',
        mode: 'sync',
        processedAt: new Date().toISOString()
      }
    }
  }

  /**
   * 提交URL转录任务（异步模式） - 默认模式
   */
  async submitUrlTranscriptionTask(url, options = {}) {
    try {
      logger.info('========================================')
      logger.info('SenseVoice服务 - 提交URL转录任务（异步模式）')
      logger.info('========================================')
      
      if (!this.apiKey) {
        throw new Error('Aliyun API key not configured')
      }

      // 创建任务记录
      const taskId = await this.taskManager.createTask('url', {
        url,
        options
      })
      
      logger.info(`创建本地任务ID: ${taskId}`)
      logger.info(`输入URL长度: ${url.length} 字符`)

      // 更新任务状态
      await this.taskManager.updateTask(taskId, {
        status: 'processing',
        progress: 10,
        message: 'Submitting URL to Aliyun'
      })

      const parameters = {
        language_hints: options.languages || ['zh', 'en'],
        format: options.format || 'auto',
        sample_rate: options.sampleRate || 16000,
        enable_words: options.enableWords !== false,
        enable_timestamp: options.enableTimestamp !== false,
        disfluency_removal: options.removeDisfluency || false,
        enable_punctuation: options.enablePunctuation !== false,
      }

      logger.info('提交到阿里云API:')
      logger.info(`  - API端点: ${this.baseUrl}`)
      logger.info(`  - 模型: sensevoice-v1`)
      logger.info(`  - URL: ${url.substring(0, 150)}...`)
      logger.info(`  - 参数: ${JSON.stringify(parameters)}`)

      const response = await axios.post(
        this.baseUrl,
        {
          model: 'sensevoice-v1',
          input: {
            file_urls: [url]
          },
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
      
      logger.info(`阿里云API响应:`)
      logger.info(`  - 状态码: ${response.status}`)
      logger.info(`  - 响应数据: ${JSON.stringify(response.data).substring(0, 200)}...`)

      if (response.data.output?.task_id) {
        const aliyunTaskId = response.data.output.task_id
        logger.info(`获得阿里云任务ID: ${aliyunTaskId}`)
        
        await this.taskManager.updateTask(taskId, {
          aliyunTaskId: aliyunTaskId,
          progress: 30,
          message: 'Task submitted to Aliyun, processing...'
        })

        logger.info(`启动异步轮询任务: ${taskId} -> ${aliyunTaskId}`)
        logger.info('========================================')
        
        // 启动异步轮询
        this.pollTaskStatus(taskId, aliyunTaskId)
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
    
    logger.info(`----------------------------------------`)
    logger.info(`开始轮询阿里云任务: ${aliyunTaskId}`)
    logger.info(`本地任务ID: ${taskId}`)
    logger.info(`----------------------------------------`)
    
    for (let i = 0; i < maxAttempts; i++) {
      try {
        if (i > 0 && i % 12 === 0) { // 每分钟记录一次
          logger.info(`轮询进行中... 已轮询 ${i * 5} 秒 (${i}/${maxAttempts})`)
        }
        
        const response = await axios.get(
          `https://dashscope.aliyuncs.com/api/v1/tasks/${aliyunTaskId}`,
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`
            }
          }
        )

        const status = response.data.output?.task_status
        const progress = this.calculateProgress(status, i, maxAttempts)
        
        // 记录状态变化
        if (!this.lastStatus || status !== this.lastStatus) {
          logger.info(`任务状态: ${this.lastStatus || 'INITIAL'} -> ${status} (进度: ${progress}%)`)
          this.lastStatus = status
        }

        await this.taskManager.addLog(taskId, 'status_check', `Aliyun task status: ${status}`, {
          attempt: i + 1,
          aliyunStatus: status
        })

        if (status === 'SUCCEEDED') {
          logger.info('✅ 转录任务成功')
          
          // 获取转录结果URL
          const transcriptionUrl = response.data.output?.results?.[0]?.transcription_url
          
          if (transcriptionUrl) {
            try {
              // 下载实际的转录结果
              logger.info(`下载转录结果: ${transcriptionUrl}`)
              const transcriptionResponse = await axios.get(transcriptionUrl)
              const transcriptionData = transcriptionResponse.data
              
              logger.info(`转录结果获取成功，原始数据大小: ${JSON.stringify(transcriptionData).length} 字符`)
              
              // 格式化转录数据
              const result = this.formatTranscriptionData(transcriptionData)
              
              logger.info(`格式化后文本长度: ${result.transcription ? result.transcription.length : 0} 字符`)
              if (result.transcription) {
                logger.info(`转录文本前200字符: ${result.transcription.substring(0, 200)}`)
              }
              
              await this.taskManager.updateTask(taskId, {
                status: 'succeeded',
                progress: 100,
                result,
                message: 'Transcription completed successfully'
              })
              
              logger.info(`----------------------------------------`)
              logger.info(`✅ 任务 ${taskId} 完成`)
              logger.info(`----------------------------------------`)
              return
            } catch (fetchError) {
              logger.error(`Failed to fetch transcription result: ${fetchError.message}`)
              // 如果获取失败，使用原始响应
              const result = this.formatResponse(response.data)
              await this.taskManager.updateTask(taskId, {
                status: 'succeeded',
                progress: 100,
                result,
                message: 'Transcription completed (result fetch failed)'
              })
              return
            }
          } else {
            // 如果没有URL，尝试使用原始响应
            const result = this.formatResponse(response.data)
            await this.taskManager.updateTask(taskId, {
              status: 'succeeded',
              progress: 100,
              result,
              message: 'Transcription completed successfully'
            })
            
            logger.info(`Task ${taskId} completed successfully`)
            return
          }
        } else if (status === 'FAILED') {
          const errorMessage = response.data.output?.message || response.data.output?.code || 'Unknown error'
          const errorCode = response.data.output?.code || 'UNKNOWN'
          
          logger.error(`❌ 转录任务失败`)
          logger.error(`  - 错误代码: ${errorCode}`)
          logger.error(`  - 错误信息: ${errorMessage}`)
          
          // 特别处理文件无法下载的错误
          if (errorMessage.includes('cannot be downloaded') || errorMessage.includes('download')) {
            logger.error('  - 提示: 文件无法被阿里云下载，可能原因：')
            logger.error('    1. OSS文件权限不足（需要设置public-read）')
            logger.error('    2. 签名URL已过期')
            logger.error('    3. OSS bucket的CORS配置问题')
          }
          
          await this.taskManager.updateTask(taskId, {
            status: 'failed',
            error: errorMessage,
            message: `Transcription failed: ${errorMessage}`
          })
          
          logger.error(`----------------------------------------`)
          logger.error(`❌ 任务 ${taskId} 失败`)
          logger.error(`----------------------------------------`)
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
   * 格式化从URL获取的转录数据
   */
  formatTranscriptionData(data) {
    logger.info('开始格式化转录数据...')
    logger.info(`原始数据结构: ${JSON.stringify(Object.keys(data))}`)
    
    // 打印数据结构帮助调试
    if (data.transcripts) {
      logger.info(`transcripts数组长度: ${data.transcripts.length}`)
      if (data.transcripts.length > 0) {
        const firstTranscript = data.transcripts[0]
        logger.info(`第一个transcript的键: ${JSON.stringify(Object.keys(firstTranscript))}`)
        logger.info(`transcript.text存在: ${!!firstTranscript.text}`)
        logger.info(`transcript.sentences数量: ${firstTranscript.sentences?.length || 0}`)
      }
    }
    
    // 处理从transcription_url获取的实际转录结果
    if (data.transcripts && data.transcripts.length > 0) {
      const transcript = data.transcripts[0]
      const sentences = transcript.sentences || []
      
      // 提取完整文本（清理标签）
      let fullText = transcript.text || ''
      fullText = fullText.replace(/<\|[^>]*\|>/g, '')
      
      logger.info(`提取的文本长度: ${fullText.length} 字符`)
      logger.info(`前100字符: ${fullText.substring(0, 100)}`)
      
      // 格式化句子
      const formattedSentences = sentences.map(sentence => ({
        text: (sentence.text || '').replace(/<\|[^>]*\|>/g, ''),
        startTime: sentence.begin_time || 0,
        endTime: sentence.end_time || 0,
        words: sentence.words || []
      }))
      
      const result = {
        transcription: fullText,  // 添加 transcription 字段
        fullText,
        sentences: formattedSentences,
        language: data.properties?.language || 'zh',
        duration: transcript.content_duration_in_milliseconds || 0,
        wordCount: fullText.length,
        sentenceCount: sentences.length,
        metadata: {
          model: 'sensevoice-v1',
          processedAt: new Date().toISOString(),
          audioFormat: data.properties?.audio_format,
          originalDuration: data.properties?.original_duration_in_milliseconds
        }
      }
      
      logger.info(`格式化完成，返回结果包含 transcription: ${!!result.transcription}`)
      return result
    }
    
    // 如果格式不匹配，尝试其他可能的数据结构
    logger.warn('数据不符合预期格式，尝试备用解析...')
    
    // 检查是否是直接的文本结果
    if (typeof data === 'string') {
      logger.info('数据是字符串，直接作为转录结果')
      return {
        transcription: data,
        fullText: data,
        sentences: [],
        language: 'zh',
        duration: 0,
        wordCount: data.length,
        sentenceCount: 0,
        metadata: {
          model: 'sensevoice-v1',
          processedAt: new Date().toISOString()
        }
      }
    }
    
    // 检查是否有text字段
    if (data.text) {
      logger.info('找到text字段，使用该字段作为转录结果')
      const text = data.text.replace(/<\|[^>]*\|>/g, '')
      return {
        transcription: text,
        fullText: text,
        sentences: [],
        language: data.language || 'zh',
        duration: data.duration || 0,
        wordCount: text.length,
        sentenceCount: 0,
        metadata: {
          model: 'sensevoice-v1',
          processedAt: new Date().toISOString()
        }
      }
    }
    
    // 最后的fallback
    logger.warn('无法解析数据，返回原始JSON')
    const jsonStr = JSON.stringify(data)
    return {
      transcription: jsonStr,
      fullText: jsonStr,
      sentences: [],
      language: 'unknown',
      duration: 0,
      wordCount: jsonStr.length,
      sentenceCount: 0,
      metadata: {
        model: 'sensevoice-v1',
        processedAt: new Date().toISOString(),
        rawData: true
      }
    }
  }

  /**
   * 格式化响应数据（旧方法，保留兼容）
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