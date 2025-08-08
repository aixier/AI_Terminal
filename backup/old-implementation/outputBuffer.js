import logger from '../utils/logger.js'

class OutputBuffer {
  constructor(options = {}) {
    this.bufferTimeout = options.bufferTimeout || 50 // 缓冲时间（毫秒）
    this.maxBufferSize = options.maxBufferSize || 10000 // 最大缓冲大小
    this.buffers = new Map() // 每个会话的缓冲区
    this.timers = new Map() // 每个会话的定时器
    this.outputHistory = new Map() // 记录最近的输出历史，用于更好的去重
    this.historySize = 20 // 保留最近20条历史记录
    this.duplicateCount = new Map() // 记录重复次数
  }

  /**
   * 缓冲输出数据
   * @param {string} sessionId - 会话ID
   * @param {string} data - 输出数据
   * @param {Function} callback - 输出回调函数
   */
  buffer(sessionId, data, callback) {
    // 获取或创建缓冲区
    if (!this.buffers.has(sessionId)) {
      this.buffers.set(sessionId, [])
      this.outputHistory.set(sessionId, [])
      this.duplicateCount.set(sessionId, 0)
    }

    const buffer = this.buffers.get(sessionId)
    const history = this.outputHistory.get(sessionId)
    
    // 详细日志：记录收到的数据
    const preview = data.substring(0, 100).replace(/\n/g, '\\n').replace(/\r/g, '\\r')
    logger.debug(`[OutputBuffer] Received for ${sessionId}, len:${data.length}, data:"${preview}"`)

    // 智能去重
    if (this.isDuplicate(sessionId, data, history)) {
      const count = this.duplicateCount.get(sessionId) + 1
      this.duplicateCount.set(sessionId, count)
      logger.debug(`[OutputBuffer] Skipping duplicate #${count} for ${sessionId}`)
      return
    }

    // 重置重复计数
    this.duplicateCount.set(sessionId, 0)

    // 添加到缓冲区
    buffer.push(data)
    
    // 更新历史记录（用于去重）
    this.updateHistory(sessionId, data)

    // 如果缓冲区过大，立即刷新
    const totalSize = buffer.reduce((sum, item) => sum + item.length, 0)
    if (totalSize >= this.maxBufferSize) {
      logger.debug(`[OutputBuffer] Buffer size exceeded for ${sessionId}, flushing immediately`)
      this.flush(sessionId, callback)
      return
    }

    // 清除现有定时器
    if (this.timers.has(sessionId)) {
      clearTimeout(this.timers.get(sessionId))
    }

    // 设置新的定时器
    const timer = setTimeout(() => {
      this.flush(sessionId, callback)
    }, this.bufferTimeout)

    this.timers.set(sessionId, timer)
  }

  /**
   * 更新历史记录
   */
  updateHistory(sessionId, data) {
    const history = this.outputHistory.get(sessionId)
    const trimmed = data.trim()
    
    if (trimmed) {
      // 创建历史记录项（包含原始数据和特征）
      const historyItem = {
        raw: trimmed,
        hash: this.simpleHash(trimmed),
        pattern: this.extractPattern(trimmed),
        timestamp: Date.now()
      }
      
      history.push(historyItem)
      
      // 保持历史大小，移除旧记录
      while (history.length > this.historySize) {
        history.shift()
      }
    }
  }

  /**
   * 检查是否是重复输出
   */
  isDuplicate(sessionId, data, history) {
    const trimmed = data.trim()
    
    // 空数据不算重复
    if (!trimmed) {
      return false
    }
    
    const currentHash = this.simpleHash(trimmed)
    const currentPattern = this.extractPattern(trimmed)
    
    // 检查历史记录
    for (let i = history.length - 1; i >= 0; i--) {
      const item = history[i]
      
      // 精确匹配
      if (item.raw === trimmed) {
        logger.debug(`[OutputBuffer] Exact match found in history`)
        return true
      }
      
      // 哈希匹配（快速比较）
      if (item.hash === currentHash) {
        logger.debug(`[OutputBuffer] Hash match found in history`)
        return true
      }
      
      // 模式匹配（用于边框等重复模式）
      if (currentPattern && item.pattern === currentPattern) {
        // 检查是否都是边框字符
        if (this.isBorderPattern(trimmed)) {
          logger.debug(`[OutputBuffer] Border pattern match found`)
          return true
        }
      }
      
      // 只检查最近5条记录的模式匹配
      if (i < history.length - 5) break
    }
    
    return false
  }

  /**
   * 提取文本模式（用于识别重复的边框等）
   */
  extractPattern(text) {
    // 提取前10个字符作为模式
    const pattern = text.substring(0, 10)
    
    // 如果全是相同字符或边框字符，返回模式
    if (this.isBorderPattern(pattern) || this.isRepeatingChar(pattern)) {
      return pattern
    }
    
    return null
  }

  /**
   * 检查是否是边框模式
   */
  isBorderPattern(text) {
    // 扩展的边框字符集
    const borderRegex = /^[╭╮╰╯─│┌┐└┘├┤┬┴┼━┃┏┓┗┛┣┫┳┻╋║═╔╗╚╝╠╬╣╦╩╪\-\|\+\*]+$/
    return borderRegex.test(text)
  }

  /**
   * 检查是否是重复字符
   */
  isRepeatingChar(text) {
    if (!text || text.length < 2) return false
    const firstChar = text[0]
    return text.split('').every(char => char === firstChar)
  }

  /**
   * 简单哈希函数（用于快速比较）
   */
  simpleHash(str) {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return hash
  }

  /**
   * 刷新缓冲区
   */
  flush(sessionId, callback) {
    const buffer = this.buffers.get(sessionId)
    
    if (!buffer || buffer.length === 0) {
      return
    }

    // 合并缓冲区内容
    const combined = buffer.join('')
    
    logger.debug(`[OutputBuffer] Flushing ${buffer.length} items (${combined.length} bytes) for ${sessionId}`)
    
    // 清空缓冲区
    this.buffers.set(sessionId, [])
    
    // 清除定时器
    if (this.timers.has(sessionId)) {
      clearTimeout(this.timers.get(sessionId))
      this.timers.delete(sessionId)
    }

    // 调用回调
    if (callback) {
      callback(combined)
    }
  }

  /**
   * 强制刷新（立即发送所有缓冲数据）
   */
  forceFlush(sessionId, callback) {
    this.flush(sessionId, callback)
  }

  /**
   * 清理会话的缓冲区
   */
  cleanup(sessionId) {
    // 刷新剩余数据
    if (this.buffers.has(sessionId)) {
      const buffer = this.buffers.get(sessionId)
      if (buffer.length > 0) {
        logger.info(`[OutputBuffer] Cleaning up ${buffer.length} buffered items for ${sessionId}`)
      }
    }

    // 清理所有资源
    this.buffers.delete(sessionId)
    this.outputHistory.delete(sessionId)
    this.duplicateCount.delete(sessionId)
    
    if (this.timers.has(sessionId)) {
      clearTimeout(this.timers.get(sessionId))
      this.timers.delete(sessionId)
    }
    
    logger.debug(`[OutputBuffer] Cleaned up session ${sessionId}`)
  }

  /**
   * 获取统计信息
   */
  getStats(sessionId) {
    return {
      bufferSize: this.buffers.get(sessionId)?.length || 0,
      historySize: this.outputHistory.get(sessionId)?.length || 0,
      duplicateCount: this.duplicateCount.get(sessionId) || 0
    }
  }
}

export default new OutputBuffer()