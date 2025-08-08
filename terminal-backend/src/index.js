import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import bodyParser from 'body-parser'
import config from './config/config.js'
import logger from './utils/logger.js'
import terminalRoutes from './routes/terminal.js'
import authRoutes from './routes/auth.js'
import commandsRoutes from './routes/commands.js'
import claudeRoutes from './routes/claude.js'
import sseRoutes from './routes/sse.js'
import previewRoutes from './routes/preview.js'
import { setupSocketHandlers } from './services/socketService.js'
import websocketService from './services/websocketService.js'
// import { preventCommandInjection, limitRequestSize, auditLog, rateLimit } from './middleware/security.js'
// import { verifyToken, optionalAuth } from './middleware/auth.js'

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      // 允许所有配置的源以及常见的本地地址
      if (!origin || 
          config.cors.origins.includes(origin) ||
          origin?.startsWith('http://127.0.0.1:') ||
          origin?.startsWith('http://localhost:') ||
          origin?.startsWith('http://0.0.0.0:') ||
          origin?.startsWith('http://192.168.') ||     // 局域网地址
          origin?.startsWith('http://10.') ||          // 局域网地址
          origin?.startsWith('http://172.') ||         // 局域网地址
          origin === 'http://8.130.86.152' ||          // 云服务器IP
          origin === 'http://8.130.86.152:5173' ||     // 云服务器IP:端口
          origin === 'http://188.8.9.99:5173') {       // 本地IP
        callback(null, true)
      } else {
        logger.warn(`Socket.IO CORS rejected origin: ${origin}`)
        callback(new Error('Not allowed by CORS'))
      }
    },
    credentials: true,
    methods: ['GET', 'POST']
  },
  transports: ['polling', 'websocket'],
  allowEIO3: true
})

// 中间件
app.use(cors({
  origin: (origin, callback) => {
    // 记录所有 CORS 请求
    if (origin) {
      logger.debug(`CORS check for origin: ${origin}`)
    }
    
    // 允许所有配置的源以及常见的本地地址
    if (!origin || 
        config.cors.origins.includes(origin) ||
        origin?.startsWith('http://127.0.0.1:') ||
        origin?.startsWith('http://localhost:') ||
        origin?.startsWith('http://0.0.0.0:') ||
        origin?.startsWith('http://192.168.') ||     // 局域网地址
        origin?.startsWith('http://10.') ||          // 局域网地址
        origin?.startsWith('http://172.') ||         // 局域网地址
        origin === 'http://8.130.86.152' ||          // 云服务器IP
        origin === 'http://8.130.86.152:5173' ||     // 云服务器IP:端口
        origin === 'http://188.8.9.99:5173') {       // 本地IP
      callback(null, true)
    } else {
      logger.warn(`CORS rejected origin: ${origin}`)
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true
}))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

// 安全中间件 - 暂时禁用，调试完成后启用
// app.use(limitRequestSize)
// app.use(auditLog)
// app.use(rateLimit)
// app.use(preventCommandInjection)

// 路由 - 暂时禁用认证，调试完成后启用
app.use('/api/auth', authRoutes) // 认证路由不需要token
app.use('/api/terminal', terminalRoutes) // terminal路由 - 暂时移除optionalAuth
app.use('/api/commands', commandsRoutes) // 暂时移除verifyToken
app.use('/api/claude', claudeRoutes) // 暂时移除verifyToken
app.use('/api/sse', sseRoutes) // SSE实时事件流
app.use('/api/preview', previewRoutes) // 预览服务

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Socket.io 处理 (保留作为备选)
setupSocketHandlers(io)

// 原生 WebSocket 处理 (用于阿里云FC)
websocketService.initialize(httpServer, {
  path: '/ws/terminal'
})
websocketService.startHeartbeat()

// WebSocket 状态路由
app.get('/api/ws/status', (req, res) => {
  res.json({
    status: 'ok',
    stats: websocketService.getStats(),
    endpoints: {
      socketio: 'ws://[host]/socket.io',
      native: 'ws://[host]/ws/terminal'
    }
  })
})

// 错误处理中间件
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err)
  res.status(500).json({
    code: 500,
    message: '服务器内部错误',
    error: config.nodeEnv === 'development' ? err.message : undefined
  })
})

// 启动服务器 - 监听所有网络接口
const HOST = '0.0.0.0'  // 监听所有接口，而不是只监听localhost
httpServer.listen(config.port, HOST, () => {
  logger.info(`Server running on ${HOST}:${config.port} in ${config.nodeEnv} mode`)
  logger.info(`Server is accessible from any network interface`)
})

export { io }