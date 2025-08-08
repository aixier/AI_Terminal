import { io } from 'socket.io-client'
import { useTerminalStore } from '../store/terminal'

class WebSocketService {
  constructor() {
    this.socket = null
    this.connected = false
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 5
    this.terminalSessionId = null // 跟踪终端会话ID
  }

  connect() {
    // 如果已经连接或正在连接，直接返回
    if (this.socket && (this.socket.connected || this.socket.connecting)) {
      console.log('[WebSocket] Already connected or connecting')
      return this.socket
    }
    
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3000'
    
    console.log('[WebSocket] Creating new connection to:', wsUrl)
    this.socket = io(wsUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts
    })

    this.setupEventHandlers()
    return this.socket
  }

  setupEventHandlers() {
    const terminalStore = useTerminalStore()

    // 连接成功
    this.socket.on('connect', () => {
      console.log('WebSocket connected')
      this.connected = true
      this.reconnectAttempts = 0
      terminalStore.setWsConnected(true)
    })

    // 连接断开
    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason)
      this.connected = false
      terminalStore.setWsConnected(false)
    })

    // 连接错误
    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error)
      this.reconnectAttempts++
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached')
      }
    })

    // 终端输出
    this.socket.on('terminal:output', (data) => {
      terminalStore.addOutputLog({
        type: 'output',
        data
      })
    })

    // 终端退出
    this.socket.on('terminal:exit', ({ exitCode, signal }) => {
      terminalStore.addOutputLog({
        type: 'system',
        data: `Terminal exited with code ${exitCode}, signal: ${signal}`
      })
      terminalStore.setCurrentCommand(null)
    })

    // 终端错误
    this.socket.on('terminal:error', ({ message }) => {
      terminalStore.addOutputLog({
        type: 'error',
        data: message
      })
    })
  }

  // 创建终端会话
  createTerminal(options = {}) {
    return new Promise((resolve, reject) => {
      // 如果已经有会话ID，直接返回
      if (this.terminalSessionId) {
        console.log('[WebSocket] Terminal session already exists:', this.terminalSessionId)
        resolve({ success: true, sessionId: this.terminalSessionId })
        return
      }
      
      this.socket.emit('terminal:create', options, (response) => {
        if (response.success) {
          this.terminalSessionId = response.sessionId // 保存会话ID
          console.log('[WebSocket] Terminal session created:', response.sessionId)
          resolve(response)
        } else {
          console.error('[WebSocket] Failed to create terminal:', response.error)
          reject(new Error(response.error))
        }
      })
    })
  }

  // 发送输入到终端
  sendInput(data) {
    if (this.connected) {
      this.socket.emit('terminal:input', data)
    }
  }

  // 调整终端大小
  resizeTerminal(cols, rows) {
    if (this.connected) {
      this.socket.emit('terminal:resize', { cols, rows })
    }
  }

  // 执行命令
  executeCommand(command) {
    return new Promise((resolve, reject) => {
      this.socket.emit('command:execute', command, (response) => {
        if (response.success) {
          resolve(response)
        } else {
          reject(new Error(response.error))
        }
      })
    })
  }

  // 断开连接
  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.connected = false
      this.terminalSessionId = null // 清理会话ID
    }
  }

  // 监听事件
  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback)
    }
  }

  // 发送事件
  emit(event, data, callback) {
    if (this.socket) {
      if (callback) {
        this.socket.emit(event, data, callback)
      } else {
        this.socket.emit(event, data)
      }
    }
  }

  // 移除监听器
  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback)
    }
  }
}

export default new WebSocketService()