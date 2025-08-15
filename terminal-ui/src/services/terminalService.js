/**
 * Terminal Service - 统一的终端服务
 * 合并了terminalIntegration.js和terminal-best-practice.js的功能
 */

import { io } from 'socket.io-client'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import 'xterm/css/xterm.css'
import { getCurrentServer } from '../config/api.config'

class TerminalService {
  constructor() {
    // Socket连接
    this.socket = null
    this.isConnected = false
    this.sessionId = null
    
    // XTerm实例
    this.terminal = null
    this.fitAddon = null
    this.container = null
    
    // 事件处理
    this.outputHandlers = []
    this.outputBuffer = []
    
    // 重连相关
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 10
    this.reconnectDelay = 1000
    this.reconnectTimer = null
    this.isReconnecting = false
    
    // 连接状态回调
    this.onConnectionChange = null
    
    // 动态获取WebSocket URL
    this.getWsUrl = () => {
      const origin = window.location.origin
      console.log('[TerminalService] Using same-origin WebSocket base:', origin)
      console.log('[TerminalService] Current location:', {
        protocol: window.location.protocol,
        hostname: window.location.hostname,
        port: window.location.port,
        origin: window.location.origin
      })
      return origin
    }
  }

  /**
   * 初始化并连接终端
   */
  async init(container, options = {}) {
    if (this.terminal) {
      console.warn('[TerminalService] Already initialized')
      return this.sessionId
    }

    this.container = container

    // 创建XTerm实例
    this.createTerminal(options)
    
    // 先挂载到DOM
    this.mount()
    
    try {
      // 连接到服务器
      await this.connect()
      
      // 设置数据流
      this.setupDataFlow()
      
      return this.sessionId
    } catch (error) {
      console.error('[TerminalService] Failed to connect:', error)
      // 即使连接失败，terminal界面仍然可用
      // 显示错误信息
      if (this.terminal) {
        this.terminal.write('\r\n\x1b[31m⚠ 无法连接到后端服务器\x1b[0m\r\n')
        this.terminal.write('\x1b[33m请确保后端服务运行在 http://localhost:6000\x1b[0m\r\n')
        this.terminal.write('\r\n运行后端: cd terminal-backend && npm start\r\n')
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
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 10000,
      tabStopWidth: 4,
      ...options
    })

    // 添加插件
    this.fitAddon = new FitAddon()
    this.terminal.loadAddon(this.fitAddon)
    
    const webLinksAddon = new WebLinksAddon()
    this.terminal.loadAddon(webLinksAddon)
  }

  /**
   * 连接到WebSocket服务器
   */
  async connect() {
    return new Promise((resolve, reject) => {
      const wsUrl = this.getWsUrl()
      console.log('[TerminalService] Attempting to connect to:', wsUrl)
      
      // 设置超时
      const timeout = setTimeout(() => {
        if (!this.isConnected) {
          console.error('[TerminalService] Connection timeout after 15 seconds')
          this.cleanup()
          reject(new Error('Connection timeout'))
        }
      }, 15000)

      // 创建socket连接（同源默认设置）
      // 在云环境中，强制使用polling，避免WebSocket frame header问题
      console.log('[TerminalService] 开始创建Socket.IO连接:', {
        wsUrl,
        path: '/socket.io',
        transports: ['polling']
      })
      
      this.socket = io(wsUrl, {
        path: '/socket.io',
        transports: ['polling'], // 仅使用polling，避免云环境WebSocket问题
        perMessageDeflate: false,
        reconnection: true,
        reconnectionAttempts: 5,
        timeout: 30000, // 增加超时时间
        upgrade: false, // 禁止升级到websocket
        rememberUpgrade: false,
        forceNew: true // 强制新连接
      })
      
      console.log('[TerminalService] Socket.IO实例已创建:', this.socket)
      
      console.log('[TerminalService] Socket created, waiting for connection...')

      this.socket.on('connect', () => {
        console.log('========================================')
        console.log('[TerminalService] ✅ SOCKET CONNECTED!')
        console.log('[TerminalService] Socket ID:', this.socket.id)
        console.log('[TerminalService] Transport:', this.socket.io.engine.transport.name)
        console.log('========================================')
        
        this.isConnected = true
        clearTimeout(timeout)
        
        // 创建终端会话
        console.log('[TerminalService] Emitting terminal:create event...')
        this.socket.emit('terminal:create', {
          cols: this.terminal?.cols || 120,
          rows: this.terminal?.rows || 30
        })
      })

      this.socket.on('terminal:ready', (response) => {
        console.log('[TerminalService] Received terminal:ready event:', response)
        if (response.success) {
          this.sessionId = response.terminalId
          console.log('========================================')
          console.log('[TerminalService] ✅ TERMINAL SESSION READY!')
          console.log('[TerminalService] Terminal ID:', this.sessionId)
          console.log('[TerminalService] Ready for Claude initialization')
          console.log('========================================')
          resolve(this.sessionId)
        } else {
          console.error('[TerminalService] ❌ Failed to create terminal:', response.error)
          clearTimeout(timeout)
          reject(new Error(response.error || 'Failed to create terminal'))
        }
      })

      this.socket.on('connect_error', (error) => {
        console.error('[TerminalService] Connection error:', error.message)
        clearTimeout(timeout)
        this.cleanup()
        reject(error)
      })

      this.socket.on('disconnect', (reason) => {
        console.warn('[TerminalService] Disconnected:', reason)
        this.isConnected = false
        
        // 触发连接状态变更回调
        if (this.onConnectionChange) {
          this.onConnectionChange(false, reason)
        }
        
        // 尝试重连
        if (!this.isReconnecting && reason !== 'io client disconnect') {
          this.attemptReconnect()
        }
      })
    })
  }
  
  /**
   * 尝试重新连接
   */
  attemptReconnect() {
    if (this.isReconnecting || this.reconnectAttempts >= this.maxReconnectAttempts) {
      return
    }
    
    this.isReconnecting = true
    this.reconnectAttempts++
    
    console.log(`[TerminalService] Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`)
    
    if (this.terminal) {
      this.terminal.write(`\r\n\x1b[33m⟳ 尝试重新连接... (${this.reconnectAttempts}/${this.maxReconnectAttempts})\x1b[0m\r\n`)
    }
    
    // 清理现有连接
    if (this.socket) {
      this.socket.removeAllListeners()
      this.socket.disconnect()
      this.socket = null
    }
    
    // 延迟重连
    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect()
        
        // 重连成功
        this.reconnectAttempts = 0
        this.isReconnecting = false
        this.reconnectDelay = 1000 // 重置延迟
        
        if (this.terminal) {
          this.terminal.write(`\r\n\x1b[32m✓ 重新连接成功！\x1b[0m\r\n`)
        }
        
        // 重新设置数据流
        this.setupDataFlow()
        
        // 触发连接状态变更回调
        if (this.onConnectionChange) {
          this.onConnectionChange(true, 'reconnected')
        }
      } catch (error) {
        console.error('[TerminalService] Reconnect failed:', error)
        this.isReconnecting = false
        
        // 增加延迟时间（指数退避）
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000)
        
        // 继续尝试重连
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.attemptReconnect()
        } else {
          if (this.terminal) {
            this.terminal.write(`\r\n\x1b[31m✗ 重连失败，请检查后端服务\x1b[0m\r\n`)
          }
          
          // 触发连接失败回调
          if (this.onConnectionChange) {
            this.onConnectionChange(false, 'max_attempts_reached')
          }
        }
      }
    }, this.reconnectDelay)
  }
  
  /**
   * 检查连接状态
   */
  async checkConnection() {
    try {
      const response = await fetch(`${window.location.origin}/api/terminal/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        return data.success || data.code === 200
      }
      return false
    } catch (error) {
      console.error('[TerminalService] Health check failed:', error)
      return false
    }
  }

  /**
   * 设置数据流
   */
  setupDataFlow() {
    if (!this.terminal || !this.socket) return

    // Terminal -> Server (用户输入直接发送)
    this.terminal.onData((data) => {
      if (this.isConnected && this.sessionId) {
        // 后端期望直接接收数据字符串，不需要包装
        this.socket.emit('terminal:input', data)
        console.log('[TerminalService] Sent input to server:', data.charCodeAt(0))
      }
    })

    // Server -> Terminal (流式输出)
    this.socket.on('terminal:output', (data) => {
      if (this.terminal) {
        try {
          // 确保data是字符串
          const outputData = typeof data === 'string' ? data : String(data)
          
          // 直接写入终端，实现流式显示
          this.terminal.write(outputData)
          
          // 触发输出处理器
          this.outputHandlers.forEach(handler => handler(outputData))
          
          // 保存到缓冲区（用于checkOutput等功能）
          this.outputBuffer.push({
            data: outputData,
            timestamp: Date.now()
          })
          
          // 限制缓冲区大小
          if (this.outputBuffer.length > 1000) {
            this.outputBuffer.shift()
          }
        } catch (error) {
          console.error('[TerminalService] Error writing to terminal:', error)
        }
      }
    })

    // 处理错误
    this.socket.on('terminal:error', (error) => {
      console.error('[TerminalService] Terminal error:', error)
      if (this.terminal) {
        this.terminal.write(`\r\n\x1b[31mError: ${error.message || error}\x1b[0m\r\n`)
      }
    })
    
    // 处理终端退出
    this.socket.on('terminal:exit', ({ exitCode, signal }) => {
      console.log('[TerminalService] Terminal exited:', { exitCode, signal })
      if (this.terminal) {
        this.terminal.write(`\r\n\x1b[33m[Terminal exited with code ${exitCode}]\x1b[0m\r\n`)
      }
    })
  }

  /**
   * 挂载到DOM
   */
  mount() {
    if (this.terminal && this.container) {
      this.terminal.open(this.container)
      this.fitAddon.fit()
      console.log('[TerminalService] Terminal mounted')
    }
  }

  /**
   * 发送命令
   */
  sendCommand(command) {
    if (!this.isConnected || !this.sessionId) {
      console.error('[TerminalService] Not connected')
      return false
    }

    // 直接发送数据字符串，后端通过socketId知道对应的terminalId
    this.socket.emit('terminal:input', command)
    console.log('[TerminalService] Sent command:', command)
    return true
  }

  /**
   * 发送输入
   */
  sendInput(data) {
    return this.sendCommand(data)
  }

  /**
   * 发送文本和控制字符
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
   * 注册输出处理器
   */
  onOutput(handler) {
    this.outputHandlers.push(handler)
    
    // 返回取消注册函数
    return () => {
      const index = this.outputHandlers.indexOf(handler)
      if (index > -1) {
        this.outputHandlers.splice(index, 1)
      }
    }
  }

  /**
   * 调整大小
   */
  resize() {
    if (this.fitAddon) {
      this.fitAddon.fit()
      
      if (this.isConnected && this.sessionId) {
        // 后端通过socketId映射找到对应的terminal
        this.socket.emit('terminal:resize', {
          cols: this.terminal.cols,
          rows: this.terminal.rows
        })
      }
    }
  }

  /**
   * 清屏
   */
  clear() {
    if (this.terminal) {
      this.terminal.clear()
    }
  }

  /**
   * 检查是否就绪
   */
  isReady() {
    return this.isConnected && this.sessionId && this.terminal
  }

  /**
   * 获取状态信息
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      isReconnecting: this.isReconnecting,
      sessionId: this.sessionId,
      reconnectAttempts: this.reconnectAttempts,
      hasTerminal: !!this.terminal
    }
  }

  /**
   * 手动重连
   */
  async reconnect() {
    console.log('[TerminalService] Manual reconnect triggered')
    if (this.isReconnecting) {
      console.log('[TerminalService] Already reconnecting, skipping')
      return
    }
    
    // 重置重连次数
    this.reconnectAttempts = 0
    
    // 清理当前连接
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    
    this.isConnected = false
    this.sessionId = null
    
    // 尝试重新连接
    await this.attemptReconnect()
  }

  /**
   * 刷新光标
   */
  refreshCursor() {
    if (this.terminal) {
      // 发送显示光标的ANSI控制序列
      this.terminal.write('\x1b[?25h')
      console.log('[TerminalService] Cursor refreshed')
    }
  }

  /**
   * 聚焦终端
   */
  focus() {
    if (this.terminal) {
      this.terminal.focus()
      console.log('[TerminalService] Terminal focused')
    }
  }

  /**
   * 启用自动调整大小
   */
  enableAutoResize() {
    if (!this.fitAddon) {
      console.warn('[TerminalService] FitAddon not available')
      return
    }

    // 防抖函数
    let resizeTimeout
    const debouncedResize = () => {
      if (resizeTimeout) clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(() => {
        this.handleResize()
      }, 150) // 150ms防抖
    }

    // 监听窗口大小变化
    window.addEventListener('resize', debouncedResize)
    
    // 监听设备方向变化（移动端）
    window.addEventListener('orientationchange', () => {
      // orientationchange后需要延迟处理，等待布局完成
      setTimeout(() => {
        this.handleResize()
      }, 300)
    })

    // 监听视觉视口变化（虚拟键盘弹出/收起）
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', debouncedResize)
    }

    // 存储清理函数
    this.cleanupResize = () => {
      window.removeEventListener('resize', debouncedResize)
      window.removeEventListener('orientationchange', debouncedResize)
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', debouncedResize)
      }
      if (resizeTimeout) clearTimeout(resizeTimeout)
    }

    console.log('[TerminalService] Auto-resize enabled')
  }

  /**
   * 处理尺寸变化
   */
  handleResize() {
    if (!this.terminal || !this.fitAddon || !this.container) {
      return
    }

    try {
      // 检查容器是否可见
      const containerRect = this.container.getBoundingClientRect()
      if (containerRect.width === 0 || containerRect.height === 0) {
        console.log('[TerminalService] Container not visible, skipping resize')
        return
      }

      // 调整终端大小
      this.fitAddon.fit()
      
      // 强制刷新光标和聚焦（移动端特别需要）
      this.refreshCursor()
      
      // 发送resize事件到后端
      if (this.isConnected && this.sessionId && this.socket) {
        this.socket.emit('terminal:resize', {
          cols: this.terminal.cols,
          rows: this.terminal.rows
        })
      }

      console.log(`[TerminalService] Terminal resized to ${this.terminal.cols}x${this.terminal.rows}`)
    } catch (error) {
      console.error('[TerminalService] Resize error:', error)
    }
  }

  /**
   * 重新初始化终端（移动端专用）
   */
  reinitializeTerminal() {
    if (!this.terminal || !this.container) {
      console.error('[TerminalService] Terminal or container not available')
      return false
    }

    try {
      console.log('[TerminalService] Reinitializing terminal for mobile...')
      
      // 1. 重新调整大小
      this.handleResize()
      
      // 2. 强制重新聚焦
      setTimeout(() => {
        this.focus()
        this.refreshCursor()
      }, 100)
      
      // 3. 检查连接状态
      if (!this.isConnected) {
        console.log('[TerminalService] Connection lost, attempting reconnect...')
        this.reconnect()
      }
      
      return true
    } catch (error) {
      console.error('[TerminalService] Reinitialize failed:', error)
      return false
    }
  }

  /**
   * 清理资源
   */
  cleanup() {
    // 清理resize事件监听器
    if (this.cleanupResize) {
      this.cleanupResize()
      this.cleanupResize = null
    }
    
    if (this.terminal) {
      this.terminal.dispose()
      this.terminal = null
    }
    
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    
    this.isConnected = false
    this.sessionId = null
    this.outputHandlers = []
    this.outputBuffer = []
    this.fitAddon = null
    this.container = null
    
    console.log('[TerminalService] Cleaned up')
  }

  /**
   * 销毁服务
   */
  destroy() {
    this.cleanup()
  }
}

// 导出单例
export default new TerminalService()