import axios from 'axios'
import FormData from 'form-data'
import fs from 'fs'
import logger from '../utils/logger.js'
import config from '../config/config.js'

class TranscriptionService {
  constructor() {
    this.baseUrl = 'https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription'
    this.apiKey = process.env.ALIYUN_API_KEY || config.aliyun?.apiKey
  }

  /**
   * 转录音频或视频文件为文字
   * @param {string} filePath - 音频/视频文件路径
   * @param {Object} options - 转录选项
   * @returns {Promise<Object>} 转录结果
   */
  async transcribe(filePath, options = {}) {
    try {
      if (!this.apiKey) {
        throw new Error('Aliyun API key not configured')
      }

      // 验证文件存在
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`)
      }

      // 获取文件大小
      const stats = fs.statSync(filePath)
      const fileSizeInMB = stats.size / (1024 * 1024)
      
      // 检查文件大小限制（假设限制为100MB）
      if (fileSizeInMB > 100) {
        throw new Error(`File size exceeds limit: ${fileSizeInMB.toFixed(2)}MB`)
      }

      // 准备表单数据
      const formData = new FormData()
      formData.append('file', fs.createReadStream(filePath))
      
      // 添加可选参数
      const parameters = {
        format: options.format || 'auto', // 自动识别格式
        sample_rate: options.sampleRate || 16000,
        language_hints: options.languages || ['zh', 'en'], // 支持中英文
        enable_words: options.enableWords !== false, // 默认开启词级别时间戳
        enable_timestamp: options.enableTimestamp !== false, // 默认开启时间戳
        disfluency_removal: options.removeDisfluency || false, // 是否去除语气词
        enable_punctuation: options.enablePunctuation !== false, // 默认开启标点
      }

      formData.append('model', 'sensevoice-v1')
      formData.append('parameters', JSON.stringify(parameters))

      // 发送请求
      logger.info(`Starting transcription for file: ${filePath}`)
      
      const response = await axios.post(this.baseUrl, formData, {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${this.apiKey}`,
          'X-DashScope-Async': 'enable' // 启用异步模式
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      })

      // 处理异步任务
      if (response.data.output?.task_id) {
        return await this.waitForResult(response.data.output.task_id)
      }

      return this.formatResponse(response.data)
    } catch (error) {
      logger.error('Transcription error:', error)
      throw this.handleError(error)
    }
  }

  /**
   * 等待异步任务完成并获取结果
   * @param {string} taskId - 任务ID
   * @returns {Promise<Object>} 转录结果
   */
  async waitForResult(taskId) {
    const maxAttempts = 60 // 最多等待5分钟
    const interval = 5000 // 每5秒查询一次
    
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await axios.get(
          `${this.baseUrl}/${taskId}`,
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`
            }
          }
        )

        const status = response.data.output?.task_status

        if (status === 'SUCCEEDED') {
          return this.formatResponse(response.data)
        } else if (status === 'FAILED') {
          throw new Error(`Transcription task failed: ${response.data.output?.message}`)
        }

        // 任务仍在进行中，等待后重试
        logger.info(`Task ${taskId} is ${status}, waiting...`)
        await new Promise(resolve => setTimeout(resolve, interval))
      } catch (error) {
        logger.error(`Error checking task status: ${error.message}`)
        if (i === maxAttempts - 1) throw error
      }
    }

    throw new Error('Transcription timeout: task took too long to complete')
  }

  /**
   * 格式化响应数据
   * @param {Object} data - API响应数据
   * @returns {Object} 格式化后的结果
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
      success: true,
      taskId: data.output?.task_id,
      fullText,
      sentences,
      language: results[0]?.language || 'unknown',
      duration: results[results.length - 1]?.end_time || 0,
      metadata: {
        model: 'sensevoice-v1',
        processedAt: new Date().toISOString()
      }
    }
  }

  /**
   * 处理错误
   * @param {Error} error - 错误对象
   * @returns {Error} 格式化的错误
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
   * 从URL转录音频/视频
   * @param {string} url - 音频/视频URL
   * @param {Object} options - 转录选项
   * @returns {Promise<Object>} 转录结果
   */
  async transcribeFromUrl(url, options = {}) {
    try {
      if (!this.apiKey) {
        throw new Error('Aliyun API key not configured')
      }

      logger.info(`Starting transcription from URL: ${url}`)

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
        return await this.waitForResult(response.data.output.task_id)
      }

      return this.formatResponse(response.data)
    } catch (error) {
      logger.error('URL transcription error:', error)
      throw this.handleError(error)
    }
  }

  /**
   * 获取支持的文件格式
   * @returns {Array} 支持的格式列表
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
   * @param {string} filePath - 文件路径
   * @returns {boolean} 是否支持
   */
  isFormatSupported(filePath) {
    const extension = filePath.split('.').pop().toLowerCase()
    return this.getSupportedFormats().includes(extension)
  }
}

export default new TranscriptionService()