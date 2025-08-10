import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import bodyParser from 'body-parser'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
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

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ========================================
// 启动诊断日志
// ========================================
console.log('================================================================================')
console.log('🚀 TERMINAL BACKEND STARTING...')
console.log('================================================================================')
console.log(`📅 Startup Time: ${new Date().toISOString()}`)
console.log(`📂 Working Directory: ${process.cwd()}`)
console.log(`📁 Script Directory: ${__dirname}`)
console.log('--------------------------------------------------------------------------------')

// 打印所有环境变量（脱敏处理）
console.log('📋 ENVIRONMENT VARIABLES:')
const envVars = {
  // 基础配置
  NODE_ENV: process.env.NODE_ENV || 'not set',
  PORT: process.env.PORT || 'not set',
  HOST: process.env.HOST || 'not set',
  
  // 静态文件相关
  STATIC_PATH: process.env.STATIC_PATH || 'not set',
  SERVE_STATIC: process.env.SERVE_STATIC || 'not set',
  
  // 数据路径
  DATA_PATH: process.env.DATA_PATH || 'not set',
  LOG_PATH: process.env.LOG_PATH || 'not set',
  
  // CORS配置
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || 'not set',
  
  // 会话配置
  MAX_TERMINAL_SESSIONS: process.env.MAX_TERMINAL_SESSIONS || 'not set',
  TERMINAL_TIMEOUT: process.env.TERMINAL_TIMEOUT || 'not set',
  
  // JWT配置（脱敏）
  JWT_SECRET: process.env.JWT_SECRET ? '***SET***' : 'not set',
  JWT_EXPIRE_TIME: process.env.JWT_EXPIRE_TIME || 'not set',
  
  // API配置（脱敏）
  VITE_API_URL: process.env.VITE_API_URL || 'not set',
  API_TARGET: process.env.API_TARGET || 'not set',
  
  // Claude配置（脱敏）
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? '***SET***' : 'not set',
  ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN ? '***SET***' : 'not set',
  ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL || 'not set',
  
  // 其他
  LOG_LEVEL: process.env.LOG_LEVEL || 'not set',
  UV_THREADPOOL_SIZE: process.env.UV_THREADPOOL_SIZE || 'not set'
}

Object.entries(envVars).forEach(([key, value]) => {
  console.log(`  ${key}: ${value}`)
})
console.log('--------------------------------------------------------------------------------')

const app = express()
console.log('✅ Express app created')

const httpServer = createServer(app)
console.log('✅ HTTP server created')

const io = new Server(httpServer, {
  path: '/socket.io',
  perMessageDeflate: false,
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
          origin === 'http://188.8.9.99:5173' ||       // 本地IP
          origin === 'http://card.paitongai.com' ||    // 域名支持
          origin === 'https://card.paitongai.com' ||  // HTTPS域名支持
          origin === 'http://aicard.paitongai.com' ||  // 新域名支持
          origin === 'https://aicard.paitongai.com') { // 新域名HTTPS支持
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
console.log('✅ Socket.IO server created')

// ========================================
// 中间件注册（顺序很重要！）
// ========================================
console.log('📦 REGISTERING MIDDLEWARE:')

// 1. CORS中间件
console.log('  1️⃣ Registering CORS middleware...')
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
        origin === 'http://188.8.9.99:5173' ||       // 本地IP
        origin === 'http://card.paitongai.com' ||    // 域名支持
        origin === 'https://card.paitongai.com' ||  // HTTPS域名支持
        origin === 'http://aicard.paitongai.com' ||  // 新域名支持
        origin === 'https://aicard.paitongai.com') { // 新域名HTTPS支持
      callback(null, true)
    } else {
      logger.warn(`CORS rejected origin: ${origin}`)
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))
console.log('     ✓ CORS middleware registered')

// 2. Body Parser中间件
console.log('  2️⃣ Registering Body Parser middleware...')
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
console.log('     ✓ Body Parser middleware registered')

// 3. 安全中间件 - 暂时禁用，调试完成后启用
console.log('  3️⃣ Security middleware: DISABLED (for debugging)')
// app.use(limitRequestSize)
// app.use(auditLog)
// app.use(rateLimit)
// app.use(preventCommandInjection)

// ========================================
// API路由注册
// ========================================
console.log('🛣️ REGISTERING API ROUTES:')

// 4. API路由 - 暂时禁用认证，调试完成后启用
console.log('  4️⃣ Registering API routes...')
app.use('/api/auth', authRoutes)
console.log('     ✓ /api/auth route registered')

app.use('/api/terminal', terminalRoutes)
console.log('     ✓ /api/terminal route registered')

app.use('/api/commands', commandsRoutes)
console.log('     ✓ /api/commands route registered')

app.use('/api/claude', claudeRoutes)
console.log('     ✓ /api/claude route registered')

app.use('/api/sse', sseRoutes)
console.log('     ✓ /api/sse route registered')

app.use('/api/preview', previewRoutes)
console.log('     ✓ /api/preview route registered')

// 5. 健康检查路由
console.log('  5️⃣ Registering health check route...')
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})
console.log('     ✓ /health route registered')

// ========================================
// 静态文件服务配置
// ========================================
console.log('--------------------------------------------------------------------------------')
console.log('🌐 STATIC FILE SERVICE CONFIGURATION:')
console.log('--------------------------------------------------------------------------------')

// 调试日志 - 输出所有相关环境变量
console.log('📊 Static file environment check:')
console.log(`  NODE_ENV: "${process.env.NODE_ENV}"`)
console.log(`  SERVE_STATIC: "${process.env.SERVE_STATIC}"`)
console.log(`  STATIC_PATH: "${process.env.STATIC_PATH}"`)

console.log('🔍 Detecting static file path...')
let staticPath = process.env.STATIC_PATH
if (!staticPath) {
  console.log('  ⚠️ STATIC_PATH not set, checking fallback paths...')
  // Docker容器中的默认路径
  const dockerStaticPath = '/app/static'
  // 本地开发的相对路径
  const localStaticPath = path.join(__dirname, '../../terminal-ui/dist')
  
  console.log(`  Checking Docker path: ${dockerStaticPath}`)
  // 检查Docker路径是否存在
  if (fs.existsSync(dockerStaticPath)) {
    staticPath = dockerStaticPath
    console.log(`  ✅ Found Docker static path: ${dockerStaticPath}`)
  } else {
    console.log(`  ❌ Docker path not found`)
    console.log(`  Checking local path: ${localStaticPath}`)
    if (fs.existsSync(localStaticPath)) {
      staticPath = localStaticPath
      console.log(`  ✅ Found local static path: ${localStaticPath}`)
    } else {
      console.log(`  ❌ Local path not found`)
      // 默认使用Docker路径（即使不存在，让错误更明显）
      staticPath = dockerStaticPath
      console.log(`  ⚠️ Using default path (may not exist): ${dockerStaticPath}`)
    }
  }
} else {
  console.log(`  ✅ Using STATIC_PATH from environment: ${staticPath}`)
}

// 检查条件和路径
console.log('🎯 Static file service decision:')
console.log(`  NODE_ENV === 'production': ${process.env.NODE_ENV === 'production'}`)
console.log(`  SERVE_STATIC === 'true': ${process.env.SERVE_STATIC === 'true'}`)
const shouldServeStatic = process.env.NODE_ENV === 'production' || process.env.SERVE_STATIC === 'true'
console.log(`  Decision: ${shouldServeStatic ? '✅ WILL SERVE' : '❌ WILL NOT SERVE'} static files`)

if (shouldServeStatic) {
  console.log('  6️⃣ Registering static file middleware...')
  console.log(`     Path to check: ${staticPath}`)
  
  // 检查静态文件路径是否存在
  if (!fs.existsSync(staticPath)) {
    console.error(`     ❌ ERROR: Static directory not found at: ${staticPath}`)
    console.error(`     Please ensure frontend is built and files are in the correct location`)
  } else {
    // 列出静态目录内容以确认
    const files = fs.readdirSync(staticPath)
    console.log(`     📂 Directory exists with ${files.length} items:`)
    files.forEach(file => {
      const stats = fs.statSync(path.join(staticPath, file))
      const type = stats.isDirectory() ? 'DIR' : 'FILE'
      const size = stats.isDirectory() ? '' : ` (${stats.size} bytes)`
      console.log(`        - ${file} [${type}]${size}`)
    })
    
    // 注册静态文件中间件 - 必须在错误处理中间件之前
    console.log(`     Registering express.static middleware...`)
    app.use(express.static(staticPath, {
      setHeaders: (res, path) => {
        // 为静态文件设置合适的缓存头
        if (path.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
        } else if (path.endsWith('.js') || path.endsWith('.css')) {
          res.setHeader('Cache-Control', 'public, max-age=31536000')
        }
      }
    }))
    console.log(`     ✓ express.static middleware registered`)
    
    // 所有非API路由返回index.html (SPA路由支持)，排除 /api /socket.io /ws 前缀
    console.log(`     Registering SPA fallback route...`)
    app.get(/^\/(?!api|socket\.io|ws|health).*/, (req, res) => {
      const indexPath = path.join(staticPath, 'index.html')
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath)
      } else {
        console.error(`     ❌ index.html not found at: ${indexPath}`)
        res.status(404).json({ error: 'Frontend not found' })
      }
    })
    console.log(`     ✓ SPA fallback route registered`)
    
    console.log(`  ✅ Static file service ENABLED from: ${staticPath}`)
  }
} else {
  console.warn('  ⚠️ Static file service is DISABLED')
  console.warn('     To enable, set NODE_ENV=production or SERVE_STATIC=true')
}

// ========================================
// WebSocket服务配置
// ========================================
console.log('--------------------------------------------------------------------------------')
console.log('🔌 WEBSOCKET SERVICES:')

// Socket.io 处理 (保留作为备选)
console.log('  Initializing Socket.IO handlers...')
setupSocketHandlers(io)
console.log('  ✓ Socket.IO handlers initialized')

// 原生 WebSocket 处理 (用于阿里云FC)
console.log('  Initializing native WebSocket service...')
websocketService.initialize(httpServer, {
  path: '/ws/terminal'
})
websocketService.startHeartbeat()
console.log('  ✓ Native WebSocket service initialized at /ws/terminal')

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
console.log('  ✓ WebSocket status endpoint registered at /api/ws/status')

// ========================================
// 错误处理中间件（必须在最后）
// ========================================
console.log('--------------------------------------------------------------------------------')
console.log('⚠️ REGISTERING ERROR HANDLER (must be last):')

// 添加请求日志中间件（调试用）
app.use((req, res, next) => {
  // 只记录非静态资源请求
  if (!req.path.startsWith('/assets') && !req.path.endsWith('.js') && !req.path.endsWith('.css')) {
    console.log(`📥 [${new Date().toISOString()}] ${req.method} ${req.path}`)
  }
  next()
})

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(`❌ ERROR handling ${req.method} ${req.path}:`, err.message)
  logger.error('Unhandled error:', err)
  res.status(500).json({
    code: 500,
    message: '服务器内部错误',
    error: config.nodeEnv === 'development' ? err.message : undefined
  })
})
console.log('  ✓ Error handler middleware registered')

// ========================================
// 启动HTTP服务器
// ========================================
console.log('================================================================================')
console.log('🚀 STARTING HTTP SERVER:')
console.log('--------------------------------------------------------------------------------')

const HOST = '0.0.0.0'  // 监听所有接口，而不是只监听localhost
const PORT = config.port || process.env.PORT || 6000

console.log(`  Host: ${HOST}`)
console.log(`  Port: ${PORT}`)
console.log(`  Mode: ${config.nodeEnv || 'production'}`)

httpServer.listen(PORT, HOST, () => {
  console.log('================================================================================')
  console.log('✅ SERVER STARTED SUCCESSFULLY!')
  console.log('================================================================================')
  console.log(`📡 Server is running on http://${HOST}:${PORT}`)
  console.log(`🌍 Accessible from any network interface`)
  console.log(`🔧 Environment: ${config.nodeEnv || 'production'}`)
  console.log('--------------------------------------------------------------------------------')
  console.log('📌 Available endpoints:')
  console.log(`  Health Check: http://${HOST}:${PORT}/health`)
  console.log(`  API Base:     http://${HOST}:${PORT}/api`)
  console.log(`  WebSocket:    ws://${HOST}:${PORT}/ws/terminal`)
  console.log(`  Socket.IO:    ws://${HOST}:${PORT}/socket.io`)
  if (process.env.NODE_ENV === 'production' || process.env.SERVE_STATIC === 'true') {
    console.log(`  Frontend:     http://${HOST}:${PORT}/`)
  }
  console.log('================================================================================')
  
  // 使用logger记录到日志文件
  logger.info(`Server running on ${HOST}:${PORT} in ${config.nodeEnv} mode`)
  logger.info(`Server is accessible from any network interface`)
})

export { io }