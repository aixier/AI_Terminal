/**
 * Native WebSocket Service
 * 原生WebSocket实现，用于阿里云FC等环境
 */

import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import 'xterm/css/xterm.css'
import { getCurrentServer } from '../config/api.config'

class NativeWebSocketService {
  constructor() {
    // WebSocket连接
    this.ws = null
    this.isConnected = false
    this.sessionId = null
    this.clientId = null
    
    // XTerm实例
    this.terminal = null
    this.fitAddon = null
    this.container = null
    
    // 事件处理
    this.outputHandlers = []
    this.outputBuffer = []
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 3
    
    // 获取WebSocket URL
    this.getWsUrl = () => {
      const server = getCurrentServer()
      // 转换为ws协议
      const wsUrl = server.url.replace('http://', 'ws://').replace('https://', 'wss://')
      return `${wsUrl}/ws/terminal`
    }
  }

  /**
   * 初始化并连接终端
   */
  async init(container, options = {}) {
    if (this.terminal) {
      console.warn('[NativeWebSocketService] Already initialized')
      return this.sessionId
    }

    this.container = container

    // 创建XTerm实例
    this.createTerminal(options)
    
    // 挂载到DOM
    this.mount()
    
    try {
      // 连接到服务器
      await this.connect()
      
      return this.sessionId
    } catch (error) {
      console.error('[NativeWebSocketService] Failed to connect:', error)
      // 显示错误信息
      if (this.terminal) {
        this.terminal.write('\r\n\x1b[31m⚠ 无法连接到WebSocket服务器\x1b[0m\r\n')
        this.terminal.write(`\x1b[33m尝试连接: ${this.getWsUrl()}\x1b[0m\r\n`)
      }
      throw error
    }
  }

  /**
   * 创建XTerm实例
   */
  createTerminal(options = {}) {
    this.terminal = new Terminal({
      theme: {
        background: '#0c0c0c',
        foreground: '#cccccc',
        cursor: '#ffffff',
        black: '#0c0c0c',
        red: '#c50f1f',
        green: '#13a10e',
        yellow: '#c19c00',
        blue: '#0037da',
        magenta: '#881798',
        cyan: '#3a96dd',
        white: '#cccccc',
        brightBlack: '#767676',
        brightRed: '#e74856',
        brightGreen: '#16c60c',
        brightYellow: '#f9f1a5',
        brightBlue: '#3b78ff',
        brightMagenta: '#b4009e',
        brightCyan: '#61d6d6',
        brightWhite: '#f2f2f2'
      },
      fontFamily: '"Cascadia Code", "Courier New", monospace',
      fontSize: 14,
      cursorBlink: true,
      ...options
    })

    // 添加插件
    this.fitAddon = new FitAddon()
    this.terminal.loadAddon(this.fitAddon)
    
    const webLinksAddon = new WebLinksAddon()
    this.terminal.loadAddon(webLinksAddon)
  }

  /**
   * 挂载终端到DOM
   */
  mount() {
    if (!this.container || !this.terminal) return
    
    this.terminal.open(this.container)
    this.fitAddon.fit()
    
    // 监听窗口大小变化
    window.addEventListener('resize', () => {
      this.fitAddon?.fit()
    })
  }

  /**
   * 连接WebSocket
   */
  async connect() {
    return new Promise((resolve, reject) => {
      const wsUrl = this.getWsUrl()
      console.log('[NativeWebSocketService] Connecting to:', wsUrl)
      
      // 设置超时
      const timeout = setTimeout(() => {
        if (!this.isConnected) {
          console.error('[NativeWebSocketService] Connection timeout')
          this.cleanup()
          reject(new Error('Connection timeout'))
        }
      }, 10000)

      try {
        // 创建原生WebSocket连接
        this.ws = new WebSocket(wsUrl)
        
        // 连接打开
        this.ws.onopen = () => {
          console.log('[NativeWebSocketService] ✅ WebSocket connected!')
          clearTimeout(timeout)
          this.isConnected = true
          this.reconnectAttempts = 0
        }
        
        // 接收消息
        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data)
            this.handleMessage(message, resolve, reject)
          } catch (error) {
            // 如果不是JSON，可能是二进制数据
            console.warn('[NativeWebSocketService] Non-JSON message:', event.data)
          }
        }
        
        // 连接关闭
        this.ws.onclose = (event) => {
          console.log('[NativeWebSocketService] Connection closed:', event.code, event.reason)
          this.isConnected = false
          
          // 尝试重连
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++
            console.log(`[NativeWebSocketService] Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts}`)
            setTimeout(() => this.reconnect(), 2000)
          }
        }
        
        // 连接错误
        this.ws.onerror = (error) => {
          console.error('[NativeWebSocketService] WebSocket error:', error)
          clearTimeout(timeout)
          reject(new Error('WebSocket connection failed'))
        }
        
      } catch (error) {
        console.error('[NativeWebSocketService] Failed to create WebSocket:', error)
        clearTimeout(timeout)
        reject(error)
      }
    })
  }

  /**
   * 处理服务器消息
   */
  handleMessage(message, resolve, reject) {
    const { type, ...data } = message
    
    switch (type) {
      case 'connected':
        console.log('[NativeWebSocketService] Connected, client ID:', data.clientId)
        this.clientId = data.clientId
        // 发送初始化消息
        this.send({
          type: 'init',
          cols: this.terminal?.cols || 80,
          rows: this.terminal?.rows || 24
        })
        break
        
      case 'ready':
        console.log('[NativeWebSocketService] Terminal ready:', data.terminalId)
        this.sessionId = data.terminalId
        this.setupDataFlow()
        if (resolve) resolve(this.sessionId)
        break
        
      case 'output':
        // 终端输出
        if (this.terminal) {
          this.terminal.write(data.data)
        }
        // 通知输出处理器
        this.outputHandlers.forEach(handler => handler(data.data))
        
        // 保存到缓冲区
        this.outputBuffer.push({
          data: data.data,
          timestamp: Date.now()
        })
        
        // 限制缓冲区大小
        if (this.outputBuffer.length > 1000) {
          this.outputBuffer.shift()
        }
        break
        
      case 'error':
        console.error('[NativeWebSocketService] Server error:', data.error)
        if (this.terminal) {
          this.terminal.write(`\r\n\x1b[31mError: ${data.error}\x1b[0m\r\n`)
        }
        if (reject) reject(new Error(data.error))
        break
        
      case 'exit':
        console.log('[NativeWebSocketService] Terminal exited:', data.exitCode)
        if (this.terminal) {
          this.terminal.write(`\r\n\x1b[33mTerminal exited (${data.exitCode})\x1b[0m\r\n`)
        }
        break
        
      case 'pong':
        // 心跳响应
        break
        
      default:
        console.log('[NativeWebSocketService] Unknown message type:', type)
    }
  }

  /**
   * 设置数据流
   */
  setupDataFlow() {
    if (!this.terminal || !this.ws) return

    // 终端输入 -> WebSocket
    this.terminal.onData((data) => {
      if (this.isConnected) {
        this.send({
          type: 'input',
          data: data
        })
      }
    })

    // 终端大小改变
    this.terminal.onResize(({ cols, rows }) => {
      if (this.isConnected) {
        this.send({
          type: 'resize',
          cols: cols,
          rows: rows
        })
      }
    })

    // 启动心跳
    this.startHeartbeat()
  }

  /**
   * 发送消息
   */
  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    }
  }

  /**
   * 发送命令
   */
  sendCommand(command) {
    if (!command) return
    
    // 确保命令以回车结束
    const cmd = command.endsWith('\r') ? command : command + '\r'
    this.send({
      type: 'input',
      data: cmd
    })
  }

  /**
   * 心跳检测
   */
  startHeartbeat() {
    setInterval(() => {
      if (this.isConnected) {
        this.send({ type: 'ping' })
      }
    }, 30000)
  }

  /**
   * 重新连接
   */
  async reconnect() {
    try {
      await this.connect()
      console.log('[NativeWebSocketService] Reconnected successfully')
    } catch (error) {
      console.error('[NativeWebSocketService] Reconnect failed:', error)
    }
  }

  /**
   * 添加输出处理器
   */
  onOutput(handler) {
    this.outputHandlers.push(handler)
  }

  /**
   * 清理资源
   */
  cleanup() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.isConnected = false
    this.sessionId = null
    this.clientId = null
  }

  /**
   * 销毁服务
   */
  destroy() {
    this.cleanup()
    if (this.terminal) {
      this.terminal.dispose()
      this.terminal = null
    }
    this.outputHandlers = []
  }

  /**
   * 获取连接状态
   */
  getStatus() {
    return {
      connected: this.isConnected,
      sessionId: this.sessionId,
      clientId: this.clientId,
      protocol: 'native-websocket'
    }
  }

  /**
   * 检查服务是否就绪
   */
  isReady() {
    return this.isConnected && this.terminal && this.ws && this.ws.readyState === WebSocket.OPEN
  }

  /**
   * 发送输入（兼容方法）
   */
  sendInput(data) {
    return this.sendCommand(data)
  }

  /**
   * 检查输出
   */
  async checkOutput(pattern, timeout = 5000) {
    return new Promise((resolve) => {
      const startTime = Date.now()
      
      const checkInterval = setInterval(() => {
        const recentOutput = this.outputBuffer
          .slice(-10)
          .map(item => item.data)
          .join('')
        
        if (pattern.test(recentOutput)) {
          clearInterval(checkInterval)
          resolve(true)
        } else if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval)
          resolve(false)
        }
      }, 100)
    })
  }

  /**
   * 发送文本和控制字符（兼容方法）
   */
  async sendTextAndControl(text, control = '\r', delay = 100) {
    this.sendCommand(text)
    
    return new Promise(resolve => {
      setTimeout(() => {
        this.sendCommand(control)
        resolve()
      }, delay)
    })
  }
}

// 导出单例
export default new NativeWebSocketService()