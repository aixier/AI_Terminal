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
    
    // 添加点击事件确保能聚焦
    this.contentEl.addEventListener('click', () => {
      this.contentEl.focus()
    })
    
    // 添加键盘事件监听
    this.setupKeyboardInput()
    
    // 连接WebSocket
    this.connectWebSocket()
  }
  
  setupKeyboardInput() {
    if (!this.contentEl) return
    
    // 保存事件处理器引用，用于清理
    this.keydownHandler = (e) => {
      // 聚焦到终端
      this.contentEl.focus()
      
      // 打印调试信息
      console.log('[Terminal] Key pressed:', e.key, 'WebSocket state:', this.websocket?.readyState)
      
      // 处理特殊键
      let data = ''
      
      if (e.key === 'Enter') {
        data = '\r'
      } else if (e.key === 'Backspace') {
        data = '\b'
        e.preventDefault() // 防止浏览器默认的后退行为
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
      } else if (e.ctrlKey && e.key === 'c') {
        // Ctrl+C
        data = '\x03'
        e.preventDefault()
      } else if (e.ctrlKey && e.key === 'd') {
        // Ctrl+D
        data = '\x04'
        e.preventDefault()
      } else if (e.ctrlKey && e.key === 'l') {
        // Ctrl+L (clear screen)
        this.clear()
        data = '\x0c'
        e.preventDefault()
      } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        // 普通字符输入
        data = e.key
      }
      
      if (data) {
        console.log('[Terminal] Sending input:', data.charCodeAt(0), data)
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
          this.sendInput(data)
          // 不做本地回显，让后端pty处理
        } else {
          console.warn('[Terminal] WebSocket not ready, state:', this.websocket?.readyState)
        }
      }
    }
    
    // 添加keydown事件监听
    this.contentEl.addEventListener('keydown', this.keydownHandler)
    
    // 添加keypress事件作为备用
    this.keypressHandler = (e) => {
      if (e.charCode && !e.ctrlKey && !e.altKey && !e.metaKey) {
        console.log('[Terminal] Keypress char:', String.fromCharCode(e.charCode))
      }
    }
    this.contentEl.addEventListener('keypress', this.keypressHandler)
    
    // 点击时聚焦
    this.clickHandler = () => {
      this.contentEl.focus()
      console.log('[Terminal] Element focused via click')
    }
    this.contentEl.addEventListener('click', this.clickHandler)
    
    // 失去焦点时提示
    this.blurHandler = () => {
      console.log('[Terminal] Lost focus')
    }
    this.contentEl.addEventListener('blur', this.blurHandler)
    
    // 获得焦点时提示
    this.focusHandler = () => {
      console.log('[Terminal] Got focus')
    }
    this.contentEl.addEventListener('focus', this.focusHandler)
    
    // 自动聚焦
    setTimeout(() => {
      this.contentEl.focus()
      console.log('[Terminal] Initial focus set')
    }, 100)
  }
  
  connectWebSocket() {
    // 根据环境决定WebSocket URL
    const isDev = import.meta.env.DEV
    const wsUrl = isDev
      ? `ws://${window.location.hostname}:6009/ws/terminal`  // 开发环境连接后端6009
      : `ws://${window.location.hostname}:${window.location.port}/ws/terminal`  // 生产环境

    console.log('[Terminal] Connecting to WebSocket:', wsUrl)
    this.websocket = new WebSocket(wsUrl)

    // 初始化超时处理
    let initTimeout = null

    this.websocket.onopen = () => {
      console.log('[Terminal] WebSocket connected')
      this.write('Connected to terminal server\r\n')

      // 立即发送init消息，不延迟
      console.log('[Terminal] Sending init message immediately...')
      this.createTerminalSession()

      // 设置初始化超时 - 10秒内必须收到 'ready' 消息
      initTimeout = setTimeout(() => {
        if (!this.terminalId) {
          console.error('[Terminal] ⏱️ Terminal initialization timeout (10s)')
          this.write('\r\n❌ [错误] 终端初始化超时 (10秒)\r\n')
          this.write('[提示] 请检查后端服务是否运行在6009端口\r\n')
          this.write('[提示] 请在终端运行 npm start 启动后端服务\r\n')
          this.websocket.close()
        }
      }, 10000)
    }

    this.websocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        console.log('[Terminal] Received message type:', message.type, 'data:', message)

        // 当接收到 'ready' 消息时，清除初始化超时
        if (message.type === 'ready' && !this.terminalId) {
          if (initTimeout) {
            clearTimeout(initTimeout)
            console.log('[Terminal] ✅ Cleared init timeout - terminal ready')
          }
        }

        this.handleMessage(message)
      } catch (error) {
        console.error('[Terminal] Message parse error:', error, 'event.data:', event.data)
      }
    }

    this.websocket.onclose = () => {
      console.log('[Terminal] WebSocket disconnected')
      if (initTimeout) {
        clearTimeout(initTimeout)
      }
      this.write('\r\n[连接已断开]\r\n')
    }

    this.websocket.onerror = (error) => {
      console.error('[Terminal] WebSocket error:', error)
      if (initTimeout) {
        clearTimeout(initTimeout)
      }
      this.write('\r\n❌ [连接错误: 请检查终端服务]\r\n')
      this.write('[提示] 确保后端服务运行在6009端口\r\n')
      this.write('[提示] 请在终端运行: npm start\r\n')
    }
  }
  
  createTerminalSession(retryCount = 0) {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      const state = this.websocket?.readyState
      const stateNames = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED']
      console.error(`[Terminal] WebSocket not open, state: ${state} (${stateNames[state] || 'UNKNOWN'})`)

      // 如果WebSocket还在连接中，等待再重试
      if (state === WebSocket.CONNECTING && retryCount < 5) {
        console.log(`[Terminal] Retrying init message (${retryCount + 1}/5)...`)
        setTimeout(() => this.createTerminalSession(retryCount + 1), 200)
        return
      }

      return
    }

    const message = {
      type: 'init',
      cols: 80,
      rows: 24
    }

    console.log('[Terminal] Sending init message:', message)
    try {
      this.websocket.send(JSON.stringify(message))
      console.log('[Terminal] Init message sent successfully')
    } catch (error) {
      console.error('[Terminal] Failed to send init message:', error)
    }
  }
  
  handleMessage(message) {
    console.log('[Terminal] Received message type:', message.type, 'full message:', message)
    switch (message.type) {
      case 'connected':
        console.log(`[Terminal] ✅ Connected: ${message.clientId}`)
        this.write(`Waiting for terminal initialization...\r\n`)
        break

      case 'ready':
        this.terminalId = message.terminalId
        console.log(`[Terminal] ✅ Terminal ready: ${this.terminalId} (PID: ${message.pid})`)
        this.write('\r\n' + '='.repeat(50) + '\r\n')
        this.write('🎉 Terminal ready. Type commands to interact.\r\n')
        this.write('='.repeat(50) + '\r\n')
        this.write('$ ')

        // 聚焦输入
        setTimeout(() => {
          if (this.contentEl) {
            this.contentEl.focus()
            console.log('[Terminal] ✅ Input focused after ready')
          }
        }, 100)
        break

      case 'output':
        this.write(message.data)
        break

      case 'exit':
        this.write(`\r\n[进程已退出，退出码: ${message.exitCode}]\r\n`)
        break

      case 'error':
        console.error('[Terminal] ❌ Server error:', message.error, message.details)
        this.write(`\r\n❌ [错误] ${message.error}\r\n`)

        // 如果是初始化错误，显示更详细的信息
        if (message.details && message.details.code) {
          this.write(`[错误代码] ${message.details.code}\r\n`)
          if (message.details.syscall) {
            this.write(`[系统调用] ${message.details.syscall}\r\n`)
          }
        }
        break

      default:
        console.warn('[Terminal] ⚠️ Unknown message type:', message.type)
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
      this.contentEl.removeEventListener('keypress', this.keypressHandler)
      this.contentEl.removeEventListener('click', this.clickHandler)
      this.contentEl.removeEventListener('blur', this.blurHandler)
      this.contentEl.removeEventListener('focus', this.focusHandler)
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