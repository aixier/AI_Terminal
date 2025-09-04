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

      // 生成终端ID
      const terminalId = `term_${Date.now()}_${Math.random().toString(36).substring(7)}`
      
      // 创建终端 - 使用terminalManager的create方法
      const terminal = terminalManager.create(terminalId, {
        cols: options.cols || 80,
        rows: options.rows || 24,
        cwd: options.cwd || process.env.HOME,
        shell: options.shell
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
        ws.close()
      })

      // 发送成功消息
      this.sendMessage(ws, {
        type: 'ready',
        terminalId: terminalId,
        pid: terminal.pid
      })

      console.log(`[WebSocketService] ✅ Terminal ${terminalId} created for ${clientId}`)

    } catch (error) {
      logger.error(`[WebSocketService] Failed to create terminal:`, error)
      this.sendMessage(ws, {
        type: 'error',
        error: `Failed to create terminal: ${error.message}`
      })
    }
  }

  /**
   * 处理终端输入
   */
  handleInput(ws, clientId, data) {
    console.log(`[WebSocketService] Received input from ${clientId}:`, data, 'Length:', data.length)
    const terminalId = this.wsToTerminal.get(ws)
    if (terminalId) {
      console.log(`[WebSocketService] Found terminal ${terminalId} for client ${clientId}`)
      const terminal = terminalManager.get(terminalId)  // 使用get方法
      if (terminal) {
        console.log(`[WebSocketService] Writing to terminal: "${data}" (charCode: ${data.charCodeAt(0)})`)
        terminal.write(data)
      } else {
        console.error(`[WebSocketService] Terminal instance not found for ${terminalId}`)
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
      const terminal = terminalManager.get(terminalId)  // 使用get方法
      if (terminal) {
        terminal.resize(cols, rows)
        console.log(`[WebSocketService] Terminal ${terminalId} resized to ${cols}x${rows}`)
      }
    }
  }

  /**
   * 处理连接断开
   */
  handleDisconnect(ws, clientId) {
    // 清理终端
    const terminalId = this.wsToTerminal.get(ws)
    if (terminalId) {
      terminalManager.destroy(terminalId)  // 使用destroy方法
      this.terminalToWs.delete(terminalId)
    }

    // 清理映射
    this.wsToTerminal.delete(ws)
    this.connections.delete(ws)

    console.log(`[WebSocketService] Cleaned up resources for ${clientId}`)
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