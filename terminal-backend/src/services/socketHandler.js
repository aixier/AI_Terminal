/**
 * Socket Handler - Web Terminal最佳实践
 * 
 * 核心原则：
 * 1. 直接流式传输：PTY output -> Socket，不缓冲
 * 2. 单一职责：只负责连接管理和数据传输
 * 3. 无状态：不存储终端输出历史
 * 4. 幂等性：重复连接不会创建多个终端
 */

import terminalManager from './terminalManager.js'
import logger from '../utils/logger.js'

class SocketHandler {
  constructor() {
    this.connections = new Map() // socketId -> connection info
    this.socketToTerminal = new Map() // socketId -> terminalId
    this.terminalToSocket = new Map() // terminalId -> socketId
  }

  /**
   * 处理新的Socket连接
   */
  handleConnection(socket) {
    const socketId = socket.id
    console.log('========================================')
    console.log('[SocketHandler] ✅ NEW CONNECTION!')
    console.log('[SocketHandler] Socket ID:', socketId)
    console.log('[SocketHandler] Transport:', socket.conn.transport.name)
    console.log('[SocketHandler] Origin:', socket.handshake.headers.origin)
    console.log('[SocketHandler] Time:', new Date().toISOString())
    console.log('========================================')
    logger.info(`[SocketHandler] New connection: ${socketId}`)

    // 记录连接信息
    this.connections.set(socketId, {
      id: socketId,
      connected: new Date(),
      remoteAddress: socket.handshake.address
    })

    // 设置Socket事件处理
    this.setupSocketEvents(socket)
  }

  /**
   * 设置Socket事件处理器
   * 最佳实践：清晰的事件命名和错误处理
   */
  setupSocketEvents(socket) {
    const socketId = socket.id

    // 创建或附加到终端
    socket.on('terminal:create', async (options) => {
      console.log('[SocketHandler] 📋 Terminal create request from:', socketId)
      console.log('[SocketHandler] Options:', options)
      try {
        const terminal = await this.createOrAttachTerminal(socketId, options)
        console.log('========================================')
        console.log('[SocketHandler] ✅ TERMINAL CREATED!')
        console.log('[SocketHandler] Terminal ID:', terminal.id)
        console.log('[SocketHandler] PID:', terminal.pid)
        console.log('========================================')
        socket.emit('terminal:ready', { 
          success: true, 
          terminalId: terminal.id 
        })
      } catch (error) {
        console.error('[SocketHandler] ❌ Failed to create terminal:', error)
        logger.error(`[SocketHandler] Failed to create terminal:`, error)
        socket.emit('terminal:ready', { 
          success: false, 
          error: error.message 
        })
      }
    })

    // 终端输入
    socket.on('terminal:input', (data) => {
      this.handleTerminalInput(socketId, data)
    })

    // 终端大小调整
    socket.on('terminal:resize', ({ cols, rows }) => {
      this.handleTerminalResize(socketId, cols, rows)
    })

    // 断开连接
    socket.on('disconnect', () => {
      this.handleDisconnect(socketId)
    })

    // 心跳检测（防止连接超时）
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() })
    })
  }

  /**
   * 创建或附加到终端
   * 最佳实践：一个Socket只能有一个终端
   */
  async createOrAttachTerminal(socketId, options = {}) {
    // 检查是否已有终端
    let terminalId = this.socketToTerminal.get(socketId)
    
    if (terminalId && terminalManager.get(terminalId)) {
      logger.info(`[SocketHandler] Reusing terminal ${terminalId} for socket ${socketId}`)
      return { id: terminalId, reused: true }
    }

    // 创建新终端
    terminalId = `term_${socketId}`
    
    // 检查是否达到最大限制
    if (terminalManager.isMaxReached()) {
      throw new Error('Maximum number of terminals reached')
    }

    // 创建PTY实例
    const pty = terminalManager.create(terminalId, options)
    
    // 建立映射关系
    this.socketToTerminal.set(socketId, terminalId)
    this.terminalToSocket.set(terminalId, socketId)

    // 设置数据流
    this.setupDataFlow(socketId, terminalId, pty)

    return { id: terminalId, reused: false }
  }

  /**
   * 设置数据流
   * 最佳实践：直接传输，不缓冲不修改
   */
  setupDataFlow(socketId, terminalId, pty) {
    const socket = this.getSocket(socketId)
    if (!socket) {
      logger.error(`[SocketHandler] Socket ${socketId} not found`)
      return
    }

    // PTY输出直接发送到Socket
    // 注意：这里使用onData而不是on('data')，因为node-pty的特殊API
    const dataHandler = (data) => {
      // 直接传输，不做任何处理
      socket.emit('terminal:output', data)
    }

    // 保存handler引用以便清理
    if (!this.dataHandlers) {
      this.dataHandlers = new Map()
    }
    this.dataHandlers.set(terminalId, dataHandler)

    // 开始监听
    pty.onData(dataHandler)

    logger.info(`[SocketHandler] Data flow established: ${terminalId} -> ${socketId}`)
  }

  /**
   * 处理终端输入
   * 最佳实践：验证后直接传递
   */
  handleTerminalInput(socketId, data) {
    const terminalId = this.socketToTerminal.get(socketId)
    if (!terminalId) {
      logger.warn(`[SocketHandler] No terminal for socket ${socketId}`)
      return
    }

    try {
      // 输入验证（可选）
      if (typeof data !== 'string') {
        logger.warn(`[SocketHandler] Invalid input type from ${socketId}`)
        return
      }

      // 直接写入终端
      terminalManager.write(terminalId, data)
    } catch (error) {
      logger.error(`[SocketHandler] Failed to write to terminal:`, error)
      this.sendError(socketId, 'Failed to write to terminal')
    }
  }

  /**
   * 处理终端大小调整
   */
  handleTerminalResize(socketId, cols, rows) {
    const terminalId = this.socketToTerminal.get(socketId)
    if (!terminalId) {
      return
    }

    try {
      // 验证尺寸参数
      cols = parseInt(cols) || 80
      rows = parseInt(rows) || 24
      
      // 限制合理范围
      cols = Math.max(10, Math.min(cols, 500))
      rows = Math.max(5, Math.min(rows, 200))

      terminalManager.resize(terminalId, cols, rows)
    } catch (error) {
      logger.error(`[SocketHandler] Failed to resize terminal:`, error)
    }
  }

  /**
   * 处理断开连接
   * 最佳实践：清理所有相关资源
   */
  handleDisconnect(socketId) {
    logger.info(`[SocketHandler] Disconnected: ${socketId}`)

    const terminalId = this.socketToTerminal.get(socketId)
    if (terminalId) {
      // 清理数据处理器
      const handler = this.dataHandlers?.get(terminalId)
      if (handler) {
        const pty = terminalManager.get(terminalId)
        if (pty) {
          // 移除监听器
          pty.removeListener('data', handler)
        }
        this.dataHandlers.delete(terminalId)
      }

      // 销毁终端
      terminalManager.destroy(terminalId)
      
      // 清理映射
      this.socketToTerminal.delete(socketId)
      this.terminalToSocket.delete(terminalId)
    }

    // 清理连接信息
    this.connections.delete(socketId)
  }

  /**
   * 获取Socket实例（需要从外部注入io实例）
   */
  getSocket(socketId) {
    // 这里需要访问io实例，通常通过构造函数注入
    return this.io?.sockets.sockets.get(socketId)
  }

  /**
   * 发送错误消息
   */
  sendError(socketId, message) {
    const socket = this.getSocket(socketId)
    if (socket) {
      socket.emit('terminal:error', { message })
    }
  }

  /**
   * 设置io实例（初始化时调用）
   */
  setIO(io) {
    this.io = io
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      connections: this.connections.size,
      terminals: this.socketToTerminal.size,
      terminalStatus: terminalManager.getStatus()
    }
  }
}

export default new SocketHandler()