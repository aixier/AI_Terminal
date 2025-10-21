/**
 * XTerm.js Terminal Engine - 基于真实xterm.js库的完整实现
 * 支持本地PTY和SSH远程连接
 */

import { Terminal } from 'xterm'

export class XTermEngine {
  constructor(options = {}) {
    this.options = options
    this.container = options.container
    this.terminal = null
    this.websocket = null
    this.terminalId = null
    this.connectionMode = 'local' // 'local' 或 'ssh'

    this.init()
  }

  init() {
    if (!this.container) return

    // 创建xterm实例
    this.terminal = new Terminal({
      fontFamily: "'Courier New', 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace",
      fontSize: this.options.fontSize || 14,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: 'block',
      theme: {
        background: '#000000',
        foreground: '#00ff00',
        cursor: '#00ff00',
        cursorAccent: '#000000'
      },
      scrollback: 1000,
      tabStopWidth: 8,
      convertEol: true,
      allowTransparency: false
    })


    // 挂载到容器
    this.terminal.open(this.container)

    // 调整终端大小
    this.fitTerminal()

    // 写入初始提示
    this.terminal.writeln('AI Terminal v4.0 - XTerm.js')
    this.terminal.writeln('Connecting to terminal server...\r\n')

    // 设置键盘输入处理
    this.setupKeyboardInput()

    // 连接WebSocket
    this.connectWebSocket()

    // 监听容器大小变化
    this.setupResizeObserver()

    // 保存contentEl用于兼容性
    this.contentEl = this.terminal.element
  }

  // 拟合终端大小到容器
  fitTerminal() {
    if (!this.container || !this.terminal) return

    const width = this.container.clientWidth
    const height = this.container.clientHeight

    // xterm.js默认字体大小
    const charWidth = 8
    const charHeight = 17

    const cols = Math.max(80, Math.floor(width / charWidth))
    const rows = Math.max(24, Math.floor(height / charHeight))

    try {
      this.terminal.resize(cols, rows)
      console.log('[XTerm] Terminal resized to', cols, 'x', rows)
    } catch (e) {
      console.error('[XTerm] Resize error:', e)
    }
  }

  setupKeyboardInput() {
    if (!this.terminal) return

    // xterm.js通过onData事件处理用户输入
    this.terminal.onData(data => {
      console.log('[XTerm] User input:', data, 'charCode:', data.charCodeAt(0))
      if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        this.sendInput(data)
      } else {
        console.warn('[XTerm] WebSocket not ready')
      }
    })

    // xterm.js通过onTitle事件处理标题变化
    this.terminal.onTitleChange(title => {
      console.log('[XTerm] Title changed:', title)
    })

    // xterm.js通过onResize事件处理大小变化
    this.terminal.onResize(({ cols, rows }) => {
      console.log('[XTerm] Terminal resized:', cols, 'x', rows)
      this.sendResize(cols, rows)
    })
  }

  setupResizeObserver() {
    if (!this.container) return

    const resizeObserver = new ResizeObserver(() => {
      try {
        this.fitTerminal()
        const { cols, rows } = this.terminal
        this.sendResize(cols, rows)
      } catch (e) {
        console.error('[XTerm] Resize observer error:', e)
      }
    })

    resizeObserver.observe(this.container)
  }

  connectWebSocket() {
    const isDev = import.meta.env.DEV
    const wsUrl = isDev
      ? `ws://${window.location.hostname}:6009/ws/terminal`
      : `ws://${window.location.hostname}:${window.location.port}/ws/terminal`

    console.log('[XTerm] Connecting to WebSocket:', wsUrl)
    this.websocket = new WebSocket(wsUrl)

    let initTimeout = null

    this.websocket.onopen = () => {
      console.log('[XTerm] WebSocket connected')
      this.terminal.write('\r\n✅ Connected to terminal server\r\n')

      // 获取终端尺寸
      const { cols, rows } = this.terminal
      this.createTerminalSession(cols, rows)

      // 设置初始化超时 - 10秒内必须收到 'ready' 消息
      initTimeout = setTimeout(() => {
        if (!this.terminalId) {
          console.error('[XTerm] ⏱️ Terminal initialization timeout (10s)')
          this.terminal.write('\r\n❌ [错误] 终端初始化超时 (10秒)\r\n')
          this.terminal.write('[提示] 请检查后端服务是否正常运行\r\n')
          this.websocket.close()
        }
      }, 10000)
    }

    this.websocket.onmessage = event => {
      try {
        const message = JSON.parse(event.data)
        console.log('[XTerm] Message received:', message.type)

        if (message.type === 'ready' && !this.terminalId) {
          if (initTimeout) {
            clearTimeout(initTimeout)
            console.log('[XTerm] ✅ Terminal ready')
          }
        }

        this.handleMessage(message)
      } catch (error) {
        console.error('[XTerm] Message parse error:', error)
      }
    }

    this.websocket.onclose = () => {
      console.log('[XTerm] WebSocket disconnected')
      if (initTimeout) clearTimeout(initTimeout)
      this.terminal.write('\r\n❌ [连接已断开]\r\n')
    }

    this.websocket.onerror = error => {
      console.error('[XTerm] WebSocket error:', error)
      if (initTimeout) clearTimeout(initTimeout)
      this.terminal.write('\r\n❌ [连接错误]\r\n')
    }
  }

  createTerminalSession(cols = 80, rows = 24, retryCount = 0) {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      const state = this.websocket?.readyState
      const stateNames = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED']
      console.error(`[XTerm] WebSocket not open, state: ${state} (${stateNames[state]})`)

      if (state === WebSocket.CONNECTING && retryCount < 5) {
        console.log(`[XTerm] Retrying init message (${retryCount + 1}/5)...`)
        setTimeout(() => this.createTerminalSession(cols, rows, retryCount + 1), 200)
        return
      }
      return
    }

    // 支持两种连接类型
    const message = {
      type: 'init',
      mode: this.connectionMode,
      cols,
      rows,
      // SSH连接时的可选参数（后续支持）
      ssh: {
        host: this.options.sshHost,
        port: this.options.sshPort || 22,
        username: this.options.sshUsername,
        // password或privateKey由后端安全处理
      }
    }

    console.log('[XTerm] Sending init message:', message.type)
    try {
      this.websocket.send(JSON.stringify(message))
      console.log('[XTerm] Init message sent')
    } catch (error) {
      console.error('[XTerm] Failed to send init:', error)
    }
  }

  handleMessage(message) {
    console.log('[XTerm] Handling message:', message.type)
    switch (message.type) {
      case 'connected':
        console.log('[XTerm] ✅ Connected:', message.clientId)
        break

      case 'ready':
        this.terminalId = message.terminalId
        this.connectionMode = message.mode || 'local'
        console.log('[XTerm] ✅ Terminal ready:', this.terminalId)
        this.terminal.writeln('')
        this.terminal.writeln('═'.repeat(50))
        this.terminal.writeln('🎉 Terminal ready. Type commands to interact.')
        this.terminal.writeln('═'.repeat(50))
        this.terminal.write('$ ')
        break

      case 'output':
        if (message.data) {
          this.terminal.write(message.data)
        }
        break

      case 'exit':
        this.terminal.writeln(`\r\n[进程已退出，退出码: ${message.exitCode}]`)
        break

      case 'error':
        console.error('[XTerm] Server error:', message.error)
        this.terminal.writeln(`\r\n❌ [错误] ${message.error}`)
        if (message.details) {
          this.terminal.writeln(`[详情] ${JSON.stringify(message.details)}`)
        }
        break

      default:
        console.warn('[XTerm] Unknown message type:', message.type)
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

  sendResize(cols, rows) {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      return
    }

    const message = {
      type: 'resize',
      cols: cols,
      rows: rows
    }

    try {
      this.websocket.send(JSON.stringify(message))
    } catch (error) {
      console.error('[XTerm] Failed to send resize:', error)
    }
  }

  write(data) {
    if (this.terminal) {
      this.terminal.write(data)
    }
  }

  writeln(data) {
    if (this.terminal) {
      this.terminal.writeln(data)
    }
  }

  clear() {
    if (this.terminal) {
      this.terminal.clear()
    }
  }

  // 设置SSH连接参数
  setSSHConfig(config) {
    this.connectionMode = 'ssh'
    this.options.sshHost = config.host
    this.options.sshPort = config.port || 22
    this.options.sshUsername = config.username
    this.options.sshPassword = config.password
    this.options.sshPrivateKey = config.privateKey
  }

  // 连接到SSH服务器
  connectSSH(config) {
    this.setSSHConfig(config)
    this.terminal.writeln(`\r\nConnecting to SSH: ${config.username}@${config.host}:${config.port || 22}...`)

    // 如果已连接，重新初始化
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      const { cols, rows } = this.terminal
      this.createTerminalSession(cols, rows)
    }
  }

  // 获取终端的行和列
  getSize() {
    if (this.terminal) {
      return {
        cols: this.terminal.cols,
        rows: this.terminal.rows
      }
    }
    return { cols: 80, rows: 24 }
  }

  destroy() {
    // 关闭WebSocket
    if (this.websocket) {
      this.websocket.close()
      this.websocket = null
    }

    // 销毁xterm实例
    if (this.terminal) {
      this.terminal.dispose()
      this.terminal = null
    }
  }

  // 兼容性方法
  sendCommand(command) {
    this.sendInput(command + '\r')
  }

  getStatus() {
    return {
      isConnected: this.websocket?.readyState === WebSocket.OPEN,
      terminalId: this.terminalId,
      mode: this.connectionMode
    }
  }
}

// 导出工厂函数，用于替换createSimpleTerminalEngine
export function createXTermEngine(options = {}) {
  return new XTermEngine(options)
}

// 兼容性导出
export function createSimpleTerminalEngine(options = {}) {
  return createXTermEngine(options)
}
