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
      <style>
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        #terminal-cursor {
          display: inline-block;
          width: 8px;
          height: 16px;
          background-color: #00ff00;
          animation: blink 1s infinite;
          vertical-align: text-bottom;
          margin-left: 2px;
        }
      </style>
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
    
    // 添加初始提示信息
    this.content = 'AI Terminal v3.0\r\nConnecting to terminal server...\r\n'
    this.updateDisplay()
    
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
    
    console.log('[Terminal] Connecting to WebSocket:', wsUrl)
    this.websocket = new WebSocket(wsUrl)
    
    this.websocket.onopen = () => {
      console.log('[Terminal] WebSocket connected')
      this.write('Connected to terminal server\r\n')
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
      this.write('\r\n[连接错误: 请检查终端服务是否运行]\r\n')
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
        this.write('Terminal ready. Type commands to interact.\r\n$ ')
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
    
    // 处理数据中的每个字符
    for (let i = 0; i < data.length; i++) {
      const char = data[i]
      const charCode = char.charCodeAt(0)
      
      // 处理控制字符
      if (charCode === 8) { // Backspace (\b)
        // 删除最后一个字符
        if (this.content.length > 0) {
          this.content = this.content.slice(0, -1)
        }
      } else if (charCode === 13) { // Carriage Return (\r)
        // 回车符：回到行首
        const lines = this.content.split('\n')
        if (lines.length > 0) {
          lines[lines.length - 1] = ''
          this.content = lines.join('\n')
        }
      } else if (charCode === 10) { // Line Feed (\n)
        // 换行符：添加新行
        this.content += '\n'
      } else if (charCode === 9) { // Tab (\t)
        // Tab字符：添加4个空格
        this.content += '    '
      } else if (charCode === 27) { // ESC - ANSI转义序列开始
        // 查找ANSI转义序列的结束
        let escapeSequence = char
        let j = i + 1
        while (j < data.length) {
          const nextChar = data[j]
          escapeSequence += nextChar
          j++
          // ANSI序列通常以字母结束
          if (/[a-zA-Z]/.test(nextChar)) {
            break
          }
        }
        i = j - 1 // 跳过整个转义序列
        
        // 简单处理：忽略颜色控制序列
        if (!/\[[0-9;]*m/.test(escapeSequence)) {
          // 如果不是颜色序列，可能需要特殊处理
          // 这里暂时忽略
        }
      } else if (charCode >= 32 && charCode <= 126) {
        // 可打印ASCII字符
        this.content += char
      } else if (charCode > 127) {
        // Unicode字符
        this.content += char
      }
      // 其他控制字符暂时忽略
    }
    
    // 更新显示内容
    this.updateDisplay()
  }
  
  updateDisplay() {
    if (!this.contentEl) return
    
    // 显示内容 + 光标
    this.contentEl.innerHTML = this.content.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '<span id="terminal-cursor"></span>'
    
    // 滚动到底部
    this.contentEl.scrollTop = this.contentEl.scrollHeight
  }
  
  clear() {
    this.content = ''
    this.updateDisplay()
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