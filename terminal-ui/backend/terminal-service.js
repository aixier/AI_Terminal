/**
 * Terminal Service with Logging
 * 集成日志功能的终端服务
 */

const pty = require('node-pty')
const TerminalLogger = require('./terminal-logger')

class TerminalService {
  constructor(io) {
    this.io = io
    this.terminals = new Map()
    
    // 初始化日志服务
    this.logger = new TerminalLogger({
      logDir: './logs',
      enableConsole: process.env.NODE_ENV === 'development',
      enableFile: true
    })
    
    // 定期清理旧日志
    setInterval(() => {
      this.logger.cleanOldLogs(7)
    }, 24 * 60 * 60 * 1000) // 每天清理一次
  }
  
  /**
   * 处理客户端连接
   */
  handleConnection(socket) {
    console.log(`[Terminal] Client connected: ${socket.id}`)
    
    // 创建终端
    socket.on('terminal:create', (options) => {
      this.createTerminal(socket, options)
    })
    
    // 输入处理
    socket.on('terminal:input', (data) => {
      const terminal = this.terminals.get(socket.id)
      if (terminal) {
        // 记录输入日志
        this.logger.logInput(socket.id, data)
        
        // 写入 PTY
        terminal.pty.write(data)
      }
    })
    
    // 调整大小
    socket.on('terminal:resize', ({ cols, rows }) => {
      const terminal = this.terminals.get(socket.id)
      if (terminal && terminal.pty) {
        terminal.pty.resize(cols, rows)
        this.logger.log(socket.id, 'resize', { cols, rows })
      }
    })
    
    // 断开连接
    socket.on('disconnect', () => {
      this.destroyTerminal(socket.id)
    })
  }
  
  /**
   * 创建终端
   */
  createTerminal(socket, options = {}) {
    const { cols = 120, rows = 30 } = options
    
    try {
      // 创建日志会话
      this.logger.createSession(socket.id, {
        clientId: socket.id,
        cols,
        rows,
        timestamp: new Date().toISOString()
      })
      
      // 创建 PTY 进程
      const ptyProcess = pty.spawn('bash', [], {
        name: 'xterm-color',
        cols,
        rows,
        cwd: process.env.HOME || process.cwd(),
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor'
        }
      })
      
      console.log(`[Terminal] Created PTY for ${socket.id}, PID: ${ptyProcess.pid}`)
      
      // 处理 PTY 输出
      ptyProcess.onData((data) => {
        // 记录输出日志
        this.logger.logOutput(socket.id, data)
        
        // 检测流式输出
        const session = this.logger.sessions.get(socket.id)
        if (session) {
          // 检测流式开始
          if (!session.streamState.isStreaming && this.logger.detectStreamStart(data)) {
            if (this.logger.startStream(socket.id)) {
              socket.emit('terminal:stream:start')
              console.log(`[Terminal] Stream started for ${socket.id}`)
            }
          }
          
          // 检测流式结束
          if (session.streamState.isStreaming) {
            session.streamState.streamBuffer += data
            if (this.logger.detectStreamEnd(session.streamState.streamBuffer)) {
              if (this.logger.endStream(socket.id)) {
                socket.emit('terminal:stream:end')
                console.log(`[Terminal] Stream ended for ${socket.id}`)
              }
            }
          }
        }
        
        // 发送到前端
        socket.emit('terminal:output', data)
      })
      
      // 处理 PTY 退出
      ptyProcess.onExit(({ exitCode, signal }) => {
        console.log(`[Terminal] PTY exited for ${socket.id}, code: ${exitCode}, signal: ${signal}`)
        this.logger.log(socket.id, 'exit', { exitCode, signal })
        socket.emit('terminal:exit', { exitCode, signal })
        this.destroyTerminal(socket.id)
      })
      
      // 保存终端实例
      this.terminals.set(socket.id, {
        pty: ptyProcess,
        socket,
        created: Date.now()
      })
      
      // 通知客户端终端已就绪
      socket.emit('terminal:ready', {
        success: true,
        terminalId: socket.id
      })
      
    } catch (error) {
      console.error(`[Terminal] Failed to create terminal:`, error)
      this.logger.logError(socket.id, error)
      
      socket.emit('terminal:ready', {
        success: false,
        error: error.message
      })
      
      socket.emit('terminal:error', {
        message: `Failed to create terminal: ${error.message}`
      })
    }
  }
  
  /**
   * 销毁终端
   */
  destroyTerminal(socketId) {
    const terminal = this.terminals.get(socketId)
    if (!terminal) return
    
    console.log(`[Terminal] Destroying terminal for ${socketId}`)
    
    // 关闭日志会话
    this.logger.closeSession(socketId)
    
    // 杀死 PTY 进程
    if (terminal.pty) {
      try {
        terminal.pty.kill()
      } catch (error) {
        console.error(`[Terminal] Error killing PTY:`, error)
      }
    }
    
    // 删除终端实例
    this.terminals.delete(socketId)
  }
  
  /**
   * 获取终端统计信息
   */
  getStats() {
    const stats = {
      activeTerminals: this.terminals.size,
      terminals: []
    }
    
    for (const [id, terminal] of this.terminals) {
      const sessionStats = this.logger.getSessionStats(id)
      stats.terminals.push({
        id,
        created: terminal.created,
        uptime: Date.now() - terminal.created,
        ...sessionStats
      })
    }
    
    return stats
  }
  
  /**
   * 获取会话日志 API
   */
  async getSessionLogs(sessionId, options) {
    return await this.logger.getSessionLogs(sessionId, options)
  }
}

module.exports = TerminalService