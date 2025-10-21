/**
 * 原生 WebSocket 服务
 * 为阿里云函数计算优化的WebSocket实现
 * 
 * 特点：
 * 1. 使用原生 WebSocket 协议
 * 2. 兼容阿里云FC的WebSocket支持
 * 3. 与现有的terminalManager集成
 * 4. 简化的消息协议
 */

import { WebSocketServer } from 'ws'
import { Client } from 'ssh2'
import terminalManager from './terminalManager.js'
import logger from '../utils/logger.js'

class NativeWebSocketService {
  constructor() {
    this.wss = null
    this.connections = new Map() // ws -> connectionInfo
    this.wsToTerminal = new Map() // ws -> terminalId
    this.terminalToWs = new Map() // terminalId -> ws
  }

  /**
   * 初始化WebSocket服务器
   * @param {http.Server} server - HTTP服务器实例
   * @param {Object} options - 配置选项
   */
  initialize(server, options = {}) {
    const wsPath = options.path || '/ws/terminal'
    
    this.wss = new WebSocketServer({
      server,
      path: wsPath,
      // 阿里云FC相关配置
      perMessageDeflate: false, // 禁用压缩以减少延迟
      clientTracking: true,
      maxPayload: 10 * 1024 * 1024 // 10MB
    })

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req)
    })

    logger.info(`[WebSocketService] Native WebSocket server initialized at ${wsPath}`)
    console.log(`🚀 Native WebSocket endpoint: ws://[host]${wsPath}`)
  }

  /**
   * 处理新的WebSocket连接
   */
  handleConnection(ws, req) {
    const clientId = this.generateClientId()
    const clientIp = req.socket.remoteAddress
    
    console.log('========================================')
    console.log('[WebSocketService] ✅ NEW WEBSOCKET CONNECTION!')
    console.log('[WebSocketService] Client ID:', clientId)
    console.log('[WebSocketService] Client IP:', clientIp)
    console.log('[WebSocketService] Headers:', req.headers)
    console.log('[WebSocketService] Time:', new Date().toISOString())
    console.log('========================================')

    // 记录连接信息
    this.connections.set(ws, {
      id: clientId,
      ip: clientIp,
      connectedAt: new Date(),
      headers: req.headers
    })

    // 设置事件处理
    this.setupWebSocketEvents(ws, clientId)

    // 发送欢迎消息
    this.sendMessage(ws, {
      type: 'connected',
      clientId: clientId,
      message: 'WebSocket connection established'
    })
  }

  /**
   * 设置WebSocket事件处理器
   */
  setupWebSocketEvents(ws, clientId) {
    // 消息处理
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString())
        await this.handleMessage(ws, clientId, message)
      } catch (error) {
        logger.error(`[WebSocketService] Error parsing message:`, error)
        this.sendMessage(ws, {
          type: 'error',
          error: 'Invalid message format'
        })
      }
    })

    // 错误处理
    ws.on('error', (error) => {
      logger.error(`[WebSocketService] WebSocket error for ${clientId}:`, error)
    })

    // 连接关闭
    ws.on('close', (code, reason) => {
      console.log(`[WebSocketService] Connection closed: ${clientId} (${code}: ${reason})`)
      this.handleDisconnect(ws, clientId)
    })

    // Ping/Pong 心跳
    ws.on('pong', () => {
      const info = this.connections.get(ws)
      if (info) {
        info.lastPong = new Date()
      }
    })
  }

  /**
   * 处理客户端消息
   */
  async handleMessage(ws, clientId, message) {
    const { type, ...payload } = message

    switch (type) {
      case 'init':
        await this.handleInit(ws, clientId, payload)
        break
      
      case 'input':
        this.handleInput(ws, clientId, payload.data)
        break
      
      case 'resize':
        this.handleResize(ws, clientId, payload)
        break
      
      case 'ping':
        this.sendMessage(ws, { type: 'pong', timestamp: Date.now() })
        break
      
      default:
        logger.warn(`[WebSocketService] Unknown message type: ${type}`)
        this.sendMessage(ws, {
          type: 'error',
          error: `Unknown message type: ${type}`
        })
    }
  }

  /**
   * 初始化终端
   */
  async handleInit(ws, clientId, options) {
    try {
      console.log(`[WebSocketService] Initializing terminal for ${clientId}`)
      console.log('[WebSocketService] Options:', options)

      const mode = options.mode || 'local'

      if (mode === 'ssh' && options.ssh) {
        // SSH模式
        await this.handleSSHInit(ws, clientId, options)
      } else {
        // 本地PTY模式（默认）
        await this.handleLocalInit(ws, clientId, options)
      }
    } catch (error) {
      logger.error(`[WebSocketService] Failed to initialize terminal:`, error)
      this.sendMessage(ws, {
        type: 'error',
        error: `Failed to initialize terminal: ${error.message}`,
        details: {
          code: error.code,
          syscall: error.syscall
        }
      })
    }
  }

  /**
   * 初始化本地PTY终端
   */
  async handleLocalInit(ws, clientId, options) {
    try {
      console.log(`[WebSocketService] Initializing LOCAL PTY for ${clientId}`)

      // 生成终端ID
      const terminalId = `term_${Date.now()}_${Math.random().toString(36).substring(7)}`

      // 确定工作目录
      let cwd = options.cwd
      if (!cwd) {
        cwd = process.env.HOME || process.env.USERPROFILE
        if (!cwd) {
          cwd = process.cwd()
        }
      }

      // 确定shell
      let shell = options.shell
      if (!shell) {
        if (process.platform === 'win32') {
          shell = process.env.COMSPEC || 'cmd.exe'
        } else {
          shell = process.env.SHELL || '/bin/bash'
        }
      }

      console.log(`[WebSocketService] Using cwd: ${cwd}, shell: ${shell}`)

      // 创建本地PTY终端
      const terminal = terminalManager.create(terminalId, {
        cols: options.cols || 80,
        rows: options.rows || 24,
        cwd: cwd,
        shell: shell
      })

      // 建立映射关系
      this.wsToTerminal.set(ws, terminalId)
      this.terminalToWs.set(terminalId, ws)

      // 监听终端输出
      terminal.onData((data) => {
        if (ws.readyState === ws.OPEN) {
          this.sendMessage(ws, {
            type: 'output',
            data: data
          })
        }
      })

      // 监听终端退出
      terminal.onExit(({ exitCode, signal }) => {
        console.log(`[WebSocketService] Terminal ${terminalId} exited: ${exitCode}/${signal}`)
        this.sendMessage(ws, {
          type: 'exit',
          exitCode: exitCode,
          signal: signal
        })
        ws.close(1000, 'Terminal exited')
      })

      // 发送成功消息
      this.sendMessage(ws, {
        type: 'ready',
        mode: 'local',
        terminalId: terminalId,
        pid: terminal.pid,
        message: `Local terminal ready. PID: ${terminal.pid}`
      })

      console.log(`[WebSocketService] ✅ Local Terminal ${terminalId} created for ${clientId}, PID: ${terminal.pid}`)
    } catch (error) {
      logger.error(`[WebSocketService] Failed to create local terminal:`, error)
      throw error
    }
  }

  /**
   * 初始化SSH终端
   */
  async handleSSHInit(ws, clientId, options) {
    return new Promise((resolve, reject) => {
      try {
        console.log(`[WebSocketService] Initializing SSH for ${clientId}`)

        const sshConfig = options.ssh || {}
        const terminalId = `ssh_${Date.now()}_${Math.random().toString(36).substring(7)}`

        const sshClient = new Client()
        const clientConfig = {
          host: sshConfig.host,
          port: sshConfig.port || 22,
          username: sshConfig.username,
          readyTimeout: 30000,
          algorithms: {
            serverHostKey: ['ssh-rsa', 'ssh-dss'],
            cipher: ['aes128-ctr', 'aes192-ctr', 'aes256-ctr', 'aes128-cbc', 'aes192-cbc']
          }
        }

        // 支持密码或密钥认证
        if (sshConfig.privateKey) {
          clientConfig.privateKey = sshConfig.privateKey
        } else if (sshConfig.password) {
          clientConfig.password = sshConfig.password
        } else {
          throw new Error('SSH authentication requires password or privateKey')
        }

        sshClient.on('ready', () => {
          console.log(`[WebSocketService] SSH client ready for ${terminalId}`)

          // 请求PTY
          sshClient.shell({ term: 'xterm', cols: options.cols || 80, rows: options.rows || 24 }, (err, stream) => {
            if (err) {
              console.error('[WebSocketService] Failed to open SSH shell:', err)
              this.sendMessage(ws, {
                type: 'error',
                error: 'Failed to open SSH shell: ' + err.message
              })
              sshClient.end()
              reject(err)
              return
            }

            console.log(`[WebSocketService] ✅ SSH shell opened for ${terminalId}`)

            // 建立映射
            this.wsToTerminal.set(ws, terminalId)
            this.terminalToWs.set(terminalId, ws)

            // 存储SSH会话信息
            const sessionInfo = {
              type: 'ssh',
              sshClient,
              stream,
              terminalId
            }
            this.connections.set(ws, sessionInfo)

            // 监听SSH输出
            stream.on('data', (data) => {
              if (ws.readyState === ws.OPEN) {
                this.sendMessage(ws, {
                  type: 'output',
                  data: data.toString()
                })
              }
            })

            stream.on('close', () => {
              console.log(`[WebSocketService] SSH stream closed for ${terminalId}`)
              sshClient.end()
              ws.close(1000, 'SSH session ended')
            })

            stream.on('error', (err) => {
              console.error('[WebSocketService] SSH stream error:', err)
              this.sendMessage(ws, {
                type: 'error',
                error: 'SSH stream error: ' + err.message
              })
            })

            // 发送成功消息
            this.sendMessage(ws, {
              type: 'ready',
              mode: 'ssh',
              terminalId: terminalId,
              host: sshConfig.host,
              message: `SSH connection established to ${sshConfig.username}@${sshConfig.host}`
            })

            resolve()
          })
        })

        sshClient.on('error', (err) => {
          console.error('[WebSocketService] SSH connection error:', err)
          this.sendMessage(ws, {
            type: 'error',
            error: 'SSH connection error: ' + err.message
          })
          reject(err)
        })

        sshClient.on('close', () => {
          console.log('[WebSocketService] SSH client closed')
        })

        console.log('[WebSocketService] Attempting SSH connection to', clientConfig.host, clientConfig.username)
        sshClient.connect(clientConfig)

      } catch (error) {
        console.error('[WebSocketService] SSH initialization error:', error)
        this.sendMessage(ws, {
          type: 'error',
          error: 'SSH initialization error: ' + error.message
        })
        reject(error)
      }
    })
  }

  /**
   * 处理终端输入
   */
  handleInput(ws, clientId, data) {
    console.log(`[WebSocketService] Received input from ${clientId}:`, data.slice(0, 50), 'Length:', data.length)
    const terminalId = this.wsToTerminal.get(ws)
    if (terminalId) {
      console.log(`[WebSocketService] Found terminal ${terminalId} for client ${clientId}`)

      // 检查是否是SSH会话
      const connectionInfo = this.connections.get(ws)
      if (connectionInfo && connectionInfo.type === 'ssh' && connectionInfo.stream) {
        console.log(`[WebSocketService] Writing to SSH stream`)
        connectionInfo.stream.write(data)
      } else {
        // 本地PTY
        const terminal = terminalManager.get(terminalId)
        if (terminal) {
          console.log(`[WebSocketService] Writing to local PTY: charCode ${data.charCodeAt(0)}`)
          terminal.write(data)
        } else {
          console.error(`[WebSocketService] Terminal instance not found for ${terminalId}`)
        }
      }
    } else {
      console.error(`[WebSocketService] No terminal mapping for client ${clientId}`)
    }
  }

  /**
   * 处理终端大小调整
   */
  handleResize(ws, clientId, { cols, rows }) {
    const terminalId = this.wsToTerminal.get(ws)
    if (terminalId) {
      // 检查是否是SSH会话
      const connectionInfo = this.connections.get(ws)
      if (connectionInfo && connectionInfo.type === 'ssh' && connectionInfo.stream) {
        console.log(`[WebSocketService] Resizing SSH terminal to ${cols}x${rows}`)
        connectionInfo.stream.setWindow(rows, cols, 0, 0)
      } else {
        // 本地PTY
        const terminal = terminalManager.get(terminalId)
        if (terminal) {
          terminal.resize(cols, rows)
          console.log(`[WebSocketService] Local terminal ${terminalId} resized to ${cols}x${rows}`)
        }
      }
    }
  }

  /**
   * 处理连接断开
   */
  handleDisconnect(ws, clientId) {
    // 清理终端
    const terminalId = this.wsToTerminal.get(ws)
    const connectionInfo = this.connections.get(ws)

    if (connectionInfo && connectionInfo.type === 'ssh') {
      // SSH会话清理
      if (connectionInfo.stream) {
        connectionInfo.stream.end()
      }
      if (connectionInfo.sshClient) {
        connectionInfo.sshClient.end()
      }
      console.log(`[WebSocketService] Cleaned up SSH session for ${clientId}`)
    } else if (terminalId) {
      // 本地PTY清理
      terminalManager.destroy(terminalId)
      this.terminalToWs.delete(terminalId)
      console.log(`[WebSocketService] Destroyed local terminal ${terminalId} for ${clientId}`)
    }

    // 清理映射
    this.wsToTerminal.delete(ws)
    this.connections.delete(ws)

    console.log(`[WebSocketService] Cleaned up all resources for ${clientId}`)
  }

  /**
   * 发送消息到客户端
   */
  sendMessage(ws, message) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(message))
    }
  }

  /**
   * 生成客户端ID
   */
  generateClientId() {
    return `ws_${Date.now()}_${Math.random().toString(36).substring(7)}`
  }

  /**
   * 启动心跳检测
   */
  startHeartbeat() {
    setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (ws.readyState === ws.OPEN) {
          ws.ping()
        }
      })
    }, 30000) // 每30秒ping一次
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      connections: this.connections.size,
      terminals: this.wsToTerminal.size,
      clients: this.wss.clients.size
    }
  }
}

// 导出单例
export default new NativeWebSocketService()