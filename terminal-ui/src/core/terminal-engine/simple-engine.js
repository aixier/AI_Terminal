/**
 * Simple Terminal Engine - 简化版本用于快速修复
 */

export class SimpleTerminalEngine {
  constructor(options = {}) {
    this.options = options
    this.container = options.container
    this.state = 'ready'
    this.content = ''
    this.websocket = null
    this.terminalId = null
    
    this.init()
  }
  
  init() {
    if (!this.container) return
    
    // 创建简单的终端界面
    this.container.innerHTML = `
      <div style="
        background: #000000;
        color: #00ff00;
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        padding: 20px;
        height: 100%;
        overflow-y: auto;
        white-space: pre-wrap;
        font-size: 14px;
        line-height: 1.4;
        box-sizing: border-box;
        outline: none;
      " id="terminal-content" tabindex="0"></div>
    `
    
    this.contentEl = this.container.querySelector('#terminal-content')
    
    // 添加键盘事件监听
    this.setupKeyboardInput()
    
    // 连接WebSocket
    this.connectWebSocket()
  }
  
  setupKeyboardInput() {
    if (!this.contentEl) return
    
    this.contentEl.addEventListener('keydown', (e) => {
      // 聚焦到终端
      this.contentEl.focus()
      
      // 处理特殊键
      let data = ''
      
      if (e.key === 'Enter') {
        data = '\r'
      } else if (e.key === 'Backspace') {
        data = '\b'
      } else if (e.key === 'Tab') {
        data = '\t'
        e.preventDefault()
      } else if (e.key === 'ArrowUp') {
        data = '\x1b[A'
        e.preventDefault()
      } else if (e.key === 'ArrowDown') {
        data = '\x1b[B'
        e.preventDefault()
      } else if (e.key === 'ArrowRight') {
        data = '\x1b[C'
        e.preventDefault()
      } else if (e.key === 'ArrowLeft') {
        data = '\x1b[D'
        e.preventDefault()
      } else if (e.key.length === 1) {
        data = e.key
      }
      
      if (data && this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        this.sendInput(data)
      }
    })
    
    // 点击时聚焦
    this.contentEl.addEventListener('click', () => {
      this.contentEl.focus()
    })
    
    // 自动聚焦
    this.contentEl.focus()
  }
  
  connectWebSocket() {
    const wsUrl = `ws://${window.location.hostname}:${window.location.port}/ws/terminal`
    
    this.websocket = new WebSocket(wsUrl)
    
    this.websocket.onopen = () => {
      console.log('[Terminal] WebSocket connected')
      // 创建新的终端会话
      this.createTerminalSession()
    }
    
    this.websocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        this.handleMessage(message)
      } catch (error) {
        console.error('[Terminal] Message parse error:', error)
      }
    }
    
    this.websocket.onclose = () => {
      console.log('[Terminal] WebSocket disconnected')
      this.write('\r\n[连接已断开]\r\n')
    }
    
    this.websocket.onerror = (error) => {
      console.error('[Terminal] WebSocket error:', error)
      this.write('\r\n[连接错误]\r\n')
    }
  }
  
  createTerminalSession() {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) return
    
    const message = {
      type: 'init',
      cols: 80,
      rows: 24
    }
    
    this.websocket.send(JSON.stringify(message))
  }
  
  handleMessage(message) {
    switch (message.type) {
      case 'connected':
        console.log(`[Terminal] Connected: ${message.clientId}`)
        break
        
      case 'ready':
        this.terminalId = message.terminalId
        console.log(`[Terminal] Terminal ready: ${this.terminalId}`)
        break
        
      case 'output':
        this.write(message.data)
        break
        
      case 'exit':
        this.write(`\r\n[进程已退出，退出码: ${message.exitCode}]\r\n`)
        break
        
      case 'error':
        console.error('[Terminal] Server error:', message.error)
        this.write(`\r\n[错误: ${message.error}]\r\n`)
        break
        
      default:
        console.log('[Terminal] Unknown message:', message)
    }
  }
  
  sendInput(data) {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      return
    }
    
    const message = {
      type: 'input',
      data: data
    }
    
    this.websocket.send(JSON.stringify(message))
  }
  
  write(data) {
    if (!this.contentEl) return
    
    // 简单处理ANSI转义序列（保留基本颜色）
    let processedData = data
      .replace(/\x1b\[[0-9;]*m/g, '') // 移除颜色代码
      .replace(/\r\n/g, '\n') // 规范化换行符
      .replace(/\r/g, '\n') // 处理回车符
    
    this.content += processedData
    this.contentEl.textContent = this.content
    
    // 滚动到底部
    this.contentEl.scrollTop = this.contentEl.scrollHeight
  }
  
  clear() {
    this.content = ''
    if (this.contentEl) {
      this.contentEl.textContent = ''
    }
  }
  
  destroy() {
    // 关闭WebSocket连接
    if (this.websocket) {
      this.websocket.close()
      this.websocket = null
    }
    
    // 清理DOM事件
    if (this.contentEl) {
      this.contentEl.removeEventListener('keydown', this.keydownHandler)
      this.contentEl.removeEventListener('click', this.clickHandler)
    }
  }
  
  on() {} // 空的事件监听
  emit() {} // 空的事件发射
  getPerformanceMetrics() { return {} }
  setTheme() {}
  setFeature() {}
}

// 创建简化的Terminal Engine
export function createSimpleTerminalEngine(options = {}) {
  return new SimpleTerminalEngine(options)
}