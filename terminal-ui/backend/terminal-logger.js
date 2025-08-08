/**
 * Terminal Logger Service
 * 后端终端日志服务，记录所有输入输出以便调试
 */

const fs = require('fs')
const path = require('path')
const { EventEmitter } = require('events')

class TerminalLogger extends EventEmitter {
  constructor(options = {}) {
    super()
    
    // 配置选项
    this.logDir = options.logDir || path.join(__dirname, 'logs')
    this.maxLogSize = options.maxLogSize || 10 * 1024 * 1024 // 10MB
    this.enableConsole = options.enableConsole !== false
    this.enableFile = options.enableFile !== false
    
    // 会话存储
    this.sessions = new Map()
    
    // 确保日志目录存在
    this.ensureLogDir()
  }
  
  /**
   * 确保日志目录存在
   */
  ensureLogDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true })
      console.log(`[TerminalLogger] Created log directory: ${this.logDir}`)
    }
  }
  
  /**
   * 创建新的日志会话
   */
  createSession(sessionId, metadata = {}) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const logFileName = `terminal_${sessionId}_${timestamp}.log`
    const logFilePath = path.join(this.logDir, logFileName)
    
    // 创建日志流
    const logStream = this.enableFile ? 
      fs.createWriteStream(logFilePath, { flags: 'a' }) : null
    
    // 创建会话对象
    const session = {
      id: sessionId,
      startTime: Date.now(),
      logFile: logFilePath,
      logStream,
      metadata,
      stats: {
        inputCount: 0,
        outputCount: 0,
        errorCount: 0,
        totalInputBytes: 0,
        totalOutputBytes: 0
      },
      streamState: {
        isStreaming: false,
        streamBuffer: '',
        streamStartTime: null
      }
    }
    
    // 保存会话
    this.sessions.set(sessionId, session)
    
    // 写入会话开始日志
    this.log(sessionId, 'session:start', {
      sessionId,
      metadata,
      logFile: logFilePath
    })
    
    console.log(`[TerminalLogger] Session created: ${sessionId}`)
    return session
  }
  
  /**
   * 记录日志
   */
  log(sessionId, type, data) {
    const session = this.sessions.get(sessionId)
    if (!session) {
      console.error(`[TerminalLogger] Session not found: ${sessionId}`)
      return
    }
    
    const timestamp = new Date().toISOString()
    const dataStr = typeof data === 'string' ? data : JSON.stringify(data)
    
    // 构建日志条目
    const logEntry = {
      timestamp,
      sessionId,
      type,
      data: dataStr,
      elapsed: Date.now() - session.startTime
    }
    
    // 更新统计信息
    this.updateStats(session, type, dataStr)
    
    // 写入文件
    if (this.enableFile && session.logStream) {
      session.logStream.write(JSON.stringify(logEntry) + '\n')
    }
    
    // 输出到控制台（开发模式）
    if (this.enableConsole) {
      const preview = dataStr.length > 100 ? 
        dataStr.substring(0, 100) + '...' : dataStr
      console.log(`[${timestamp}] [${sessionId}] [${type}] ${preview}`)
    }
    
    // 触发事件
    this.emit('log', logEntry)
  }
  
  /**
   * 记录输入
   */
  logInput(sessionId, data) {
    this.log(sessionId, 'input', data)
    
    // 检测是否是命令
    if (this.isCommand(data)) {
      this.log(sessionId, 'command', data.trim())
    }
  }
  
  /**
   * 记录输出
   */
  logOutput(sessionId, data) {
    const session = this.sessions.get(sessionId)
    if (!session) return
    
    this.log(sessionId, 'output', data)
    
    // 检测流式输出
    if (this.detectStreamStart(data)) {
      this.startStream(sessionId)
    }
    
    // 累积流式缓冲
    if (session.streamState.isStreaming) {
      session.streamState.streamBuffer += data
      
      // 检测流式结束
      if (this.detectStreamEnd(session.streamState.streamBuffer)) {
        this.endStream(sessionId)
      }
    }
  }
  
  /**
   * 记录错误
   */
  logError(sessionId, error) {
    this.log(sessionId, 'error', {
      message: error.message,
      stack: error.stack
    })
  }
  
  /**
   * 开始流式输出
   */
  startStream(sessionId) {
    const session = this.sessions.get(sessionId)
    if (!session || session.streamState.isStreaming) return
    
    session.streamState.isStreaming = true
    session.streamState.streamStartTime = Date.now()
    session.streamState.streamBuffer = ''
    
    this.log(sessionId, 'stream:start', {
      timestamp: new Date().toISOString()
    })
    
    // 通知前端
    return true
  }
  
  /**
   * 结束流式输出
   */
  endStream(sessionId) {
    const session = this.sessions.get(sessionId)
    if (!session || !session.streamState.isStreaming) return
    
    const duration = Date.now() - session.streamState.streamStartTime
    const bufferLength = session.streamState.streamBuffer.length
    
    this.log(sessionId, 'stream:end', {
      duration,
      bufferLength,
      preview: session.streamState.streamBuffer.substring(0, 200)
    })
    
    // 重置流式状态
    session.streamState.isStreaming = false
    session.streamState.streamBuffer = ''
    session.streamState.streamStartTime = null
    
    return true
  }
  
  /**
   * 检测是否是命令
   */
  isCommand(data) {
    // 简单检测：以回车结尾且不是纯空白
    return data.includes('\r') || data.includes('\n')
  }
  
  /**
   * 检测流式输出开始
   */
  detectStreamStart(data) {
    // Claude 响应特征
    const patterns = [
      /^I'll help/i,
      /^Based on/i,
      /^Here's/i,
      /^Let me/i,
      /```/,
      /\{.*"cards".*:/  // JSON 输出
    ]
    
    return patterns.some(pattern => pattern.test(data))
  }
  
  /**
   * 检测流式输出结束
   */
  detectStreamEnd(buffer) {
    // 检测结束标记
    const endPatterns = [
      // JSON 代码块完成
      buffer.includes('```json') && 
      buffer.lastIndexOf('```') > buffer.indexOf('```json'),
      
      // 命令提示符返回
      /\n.*\$\s*$/.test(buffer),
      /\n.*#\s*$/.test(buffer),
      
      // Claude 结束标记
      /\n\n$/.test(buffer) && buffer.length > 500
    ]
    
    return endPatterns.some(condition => condition === true)
  }
  
  /**
   * 更新统计信息
   */
  updateStats(session, type, data) {
    const bytes = Buffer.byteLength(data)
    
    switch(type) {
      case 'input':
      case 'command':
        session.stats.inputCount++
        session.stats.totalInputBytes += bytes
        break
      case 'output':
        session.stats.outputCount++
        session.stats.totalOutputBytes += bytes
        break
      case 'error':
        session.stats.errorCount++
        break
    }
  }
  
  /**
   * 获取会话统计
   */
  getSessionStats(sessionId) {
    const session = this.sessions.get(sessionId)
    if (!session) return null
    
    return {
      ...session.stats,
      duration: Date.now() - session.startTime,
      isStreaming: session.streamState.isStreaming
    }
  }
  
  /**
   * 获取会话日志
   */
  async getSessionLogs(sessionId, options = {}) {
    const session = this.sessions.get(sessionId)
    if (!session || !session.logFile) return []
    
    const { limit = 100, type = null, tail = false } = options
    
    try {
      const content = await fs.promises.readFile(session.logFile, 'utf-8')
      let logs = content
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          try {
            return JSON.parse(line)
          } catch {
            return null
          }
        })
        .filter(log => log !== null)
      
      // 过滤类型
      if (type) {
        logs = logs.filter(log => log.type === type)
      }
      
      // 限制数量
      if (tail) {
        logs = logs.slice(-limit)
      } else {
        logs = logs.slice(0, limit)
      }
      
      return logs
    } catch (error) {
      console.error(`[TerminalLogger] Failed to read logs:`, error)
      return []
    }
  }
  
  /**
   * 关闭会话
   */
  closeSession(sessionId) {
    const session = this.sessions.get(sessionId)
    if (!session) return
    
    // 写入会话结束日志
    this.log(sessionId, 'session:end', {
      stats: session.stats,
      duration: Date.now() - session.startTime
    })
    
    // 关闭日志流
    if (session.logStream) {
      session.logStream.end()
    }
    
    // 删除会话
    this.sessions.delete(sessionId)
    
    console.log(`[TerminalLogger] Session closed: ${sessionId}`)
  }
  
  /**
   * 清理旧日志
   */
  async cleanOldLogs(daysToKeep = 7) {
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000)
    
    try {
      const files = await fs.promises.readdir(this.logDir)
      
      for (const file of files) {
        if (!file.startsWith('terminal_')) continue
        
        const filePath = path.join(this.logDir, file)
        const stats = await fs.promises.stat(filePath)
        
        if (stats.mtimeMs < cutoffTime) {
          await fs.promises.unlink(filePath)
          console.log(`[TerminalLogger] Deleted old log: ${file}`)
        }
      }
    } catch (error) {
      console.error(`[TerminalLogger] Failed to clean logs:`, error)
    }
  }
}

// 导出单例
module.exports = TerminalLogger