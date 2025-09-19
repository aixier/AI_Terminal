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
import generateRoutes from './routes/generate/index.js'
import uploadRoutes from './routes/upload.js'
import workspaceRoutes from './routes/workspace.js'
import transcriptionRoutes from './routes/transcription.js'
import assetsRoutes from './routes/v2/assets.js'
import { router as sseRouter } from './routes/v2/sse.js'
import stsRoutes from './routes/sts.js'
import ossDirectRoutes from './routes/oss-direct.js'
import htmlEditRoutes from './routes/htmlEdit.js'
import cardExtractorRoutes from './routes/cardExtractor.js'
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
      // 完全开放Socket.IO CORS - 允许所有来源
      // 支持所有域名包括 netlify.app 等
      if (origin && config.nodeEnv === 'development') {
        logger.debug(`Socket.IO CORS check for origin: ${origin}`)
      }
      callback(null, true)
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

// 1. 预处理中间件 - 处理静态资源的特殊情况
console.log('  0️⃣ Registering pre-processing middleware...')
app.use((req, res, next) => {
  // 为所有静态资源请求设置CORS头
  if (req.path.startsWith('/assets/') || req.path.endsWith('.js') || req.path.endsWith('.css') || req.path.endsWith('.ico')) {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.header('Access-Control-Allow-Credentials', 'true')
  }
  next()
})
console.log('     ✓ Pre-processing middleware registered')

// 1. CORS中间件
console.log('  1️⃣ Registering CORS middleware...')
app.use(cors({
  origin: (origin, callback) => {
    // 记录所有 CORS 请求（可选）
    if (origin && config.nodeEnv === 'development') {
      logger.debug(`CORS check for origin: ${origin}`)
    }
    
    // 完全开放CORS - 允许所有来源
    // 这样可以支持来自任何域名的请求，包括 netlify.app 等
    callback(null, true)
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Length', 'Content-Type', 'X-Request-Id'],
  maxAge: 86400 // 预检请求缓存24小时
}))
console.log('     ✓ CORS middleware registered (fully open)')

// 2. Body Parser中间件
console.log('  2️⃣ Registering Body Parser middleware...')
// 增加请求体大小限制到 10MB（用于处理大量选中元素的情况）
app.use(bodyParser.json({ limit: '10mb' }))
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }))
console.log('     ✓ Body Parser middleware registered (limit: 10MB)')

// 3. 请求日志中间件 - 已禁用以减少日志噪音
console.log('  3️⃣ Request Logging middleware disabled for cleaner output')
/*
app.use((req, res, next) => {
  const timestamp = new Date().toISOString()
  const logMessage = `[${timestamp}] ${req.method} ${req.url}`
  
  // 记录请求头和参数
  console.log('\n' + '='.repeat(80))
  console.log(`📥 [REQUEST] ${req.method} ${req.url}`)
  console.log(`📅 Time: ${timestamp}`)
  console.log(`🌐 Origin: ${req.get('Origin') || 'No Origin'}`)
  console.log(`🔑 Authorization: ${req.get('Authorization') ? 'Present' : 'Missing'}`)
  
  if (Object.keys(req.query).length > 0) {
    console.log(`🔍 Query Params:`, req.query)
  }
  
  if (req.body && Object.keys(req.body).length > 0) {
    console.log(`📦 Request Body:`, req.body)
  }
  
  // 记录响应
  const originalSend = res.send
  res.send = function(data) {
    console.log(`📤 [RESPONSE] Status: ${res.statusCode}`)
    if (data && typeof data === 'string' && data.length < 500) {
      try {
        const parsed = JSON.parse(data)
        console.log(`📋 Response Data:`, parsed)
      } catch (e) {
        console.log(`📋 Response Data (raw):`, data.substring(0, 200))
      }
    } else if (data) {
      console.log(`📋 Response Size: ${data.length} characters`)
    }
    console.log('='.repeat(80) + '\n')
    
    originalSend.call(this, data)
  }
  
  next()
})
*/
// console.log('     ✓ Request Logging middleware registered')

// 4. 安全中间件 - 暂时禁用，调试完成后启用
console.log('  4️⃣ Security middleware: DISABLED (for debugging)')
// app.use(limitRequestSize)
// app.use(auditLog)
// app.use(rateLimit)
// app.use(preventCommandInjection)

// ========================================
// 静态资源路由（优先处理）
// ========================================
console.log('📂 REGISTERING STATIC ASSET ROUTES:')

// 专门处理 /assets 路径
app.use('/assets', (req, res, next) => {
  const staticPath = process.env.STATIC_PATH || '/app/static'
  const assetPath = path.join(staticPath, 'assets', req.path)
  
  console.log(`  📁 Asset request: ${req.path}`)
  console.log(`  📁 Looking for: ${assetPath}`)
  
  if (fs.existsSync(assetPath)) {
    // 设置正确的Content-Type
    if (req.path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
    } else if (req.path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8')
    }
    
    // 设置CORS
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Cache-Control', 'public, max-age=31536000')
    
    // 发送文件
    return res.sendFile(assetPath)
  } else {
    console.log(`  ⚠️ Asset not found: ${assetPath}`)
    return res.status(404).send('Asset not found')
  }
})
console.log('     ✓ /assets route registered')

// ========================================
// API路由注册
// ========================================
console.log('🛣️ REGISTERING API ROUTES:')

// 5. API路由 - 暂时禁用认证，调试完成后启用
console.log('  5️⃣ Registering API routes...')
app.use('/api/auth', authRoutes)
console.log('     ✓ /api/auth route registered')

app.use('/api/terminal', terminalRoutes)
console.log('     ✓ /api/terminal route registered')

app.use('/api/commands', commandsRoutes)
console.log('     ✓ /api/commands route registered')

app.use('/api/claude', claudeRoutes)
console.log('     ✓ /api/claude route registered')

app.use('/api/generate', generateRoutes)
console.log('     ✓ /api/generate route registered')

app.use('/api/upload', uploadRoutes)
console.log('     ✓ /api/upload route registered')

app.use('/api/sse', sseRoutes)
console.log('     ✓ /api/sse route registered')

app.use('/api/preview', previewRoutes)
console.log('     ✓ /api/preview route registered')

app.use('/api/workspace', workspaceRoutes)
console.log('     ✓ /api/workspace route registered')

app.use('/api/transcription', transcriptionRoutes)
console.log('     ✓ /api/transcription route registered')
app.use('/api/sts', stsRoutes)
console.log('     ✓ /api/sts route registered')
app.use('/api/oss-direct', ossDirectRoutes)
console.log('     ✓ /api/oss-direct route registered')
// 确保HTML编辑路由正确注册
try {
  app.use('/api/html', htmlEditRoutes)
  console.log('     ✓ /api/html route registered successfully')
  console.log('     ✓ Available routes: GET /api/html/status/:taskId, POST /api/html/edit')
} catch (error) {
  console.error('     ✗ Failed to register /api/html routes:', error)
  throw error
}

app.use('/api', cardExtractorRoutes)
console.log('     ✓ /api/extract-cards routes registered')

// 临时兼容路由 - 直接读取文件
app.get('/api/files/read', async (req, res) => {
  const { path: filePath, username } = req.query

  if (!filePath || !username) {
    return res.status(400).json({ error: 'Missing path or username' })
  }

  try {
    const fs = await import('fs/promises')

    // 直接使用提供的绝对路径（如果是合法的）
    let fullPath = filePath

    // 验证路径在用户的workspace内
    const expectedPrefix = `/app/data/users/${username}/workspace/`
    if (!fullPath.startsWith(expectedPrefix)) {
      return res.status(403).json({ error: 'Invalid path' })
    }

    const content = await fs.default.readFile(fullPath, 'utf-8')

    // 返回兼容的响应格式
    res.json({
      success: true,
      content: content
    })
  } catch (error) {
    console.error('[api/files/read] Error:', error)
    res.status(404).json({
      success: false,
      error: 'File not found'
    })
  }
})
console.log('     ✓ /api/files/read compatibility route registered')

app.use('/api/v2/assets', assetsRoutes)
console.log('     ✓ /api/v2/assets route registered (Chokidar-based Real FileSystem)')
app.use('/api/v2/assets/events', sseRouter)
console.log('     ✓ /api/v2/assets/events SSE route registered')

// 5. API信息路由 (移到/api-info避免与静态文件冲突)
console.log('  6️⃣ Registering API info route...')
app.get('/api-info', (req, res) => {
  res.json({
    service: 'AI Terminal Backend',
    version: 'V3.5',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      api: {
        auth: '/api/auth',
        terminal: '/api/terminal',
        commands: '/api/commands',
        claude: '/api/claude',
        generate: '/api/generate',
        sse: '/api/sse',
        preview: '/api/preview',
        workspace: '/api/workspace',
        transcription: '/api/transcription',
        assets: '/api/assets'
      }
    },
    message: 'Welcome to AI Terminal Backend Service'
  })
})
console.log('     ✓ API info route registered')

// 6. 健康检查路由
console.log('  7️⃣ Registering health check route...')
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
  console.log('  8️⃣ Registering static file middleware...')
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
    
    // 添加静态文件错误处理
    app.use((req, res, next) => {
      // 只处理静态资源请求
      if (req.path.startsWith('/assets') || req.path.endsWith('.js') || req.path.endsWith('.css') || req.path.endsWith('.html')) {
        const filePath = path.join(staticPath, req.path)
        if (!fs.existsSync(filePath)) {
          console.log(`     ⚠️ Static file not found: ${req.path}`)
          // 对于.js和.css文件，返回404而不是500
          if (req.path.endsWith('.js') || req.path.endsWith('.css')) {
            return res.status(404).send('File not found')
          }
        }
      }
      next()
    })
    
    app.use(express.static(staticPath, {
      setHeaders: (res, path) => {
        // 为静态文件设置合适的缓存头和CORS
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
        
        if (path.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
        } else if (path.endsWith('.js')) {
          res.setHeader('Cache-Control', 'public, max-age=31536000')
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
        } else if (path.endsWith('.css')) {
          res.setHeader('Cache-Control', 'public, max-age=31536000')
          res.setHeader('Content-Type', 'text/css; charset=utf-8')
        }
      },
      fallthrough: true,  // 允许继续到下一个中间件
      index: false        // 不自动服务index.html
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
  // 设置HTTP服务器超时为10分钟，支持长时间运行的同步请求
  const TIMEOUT_MS = 10 * 60 * 1000 // 10分钟
  httpServer.timeout = TIMEOUT_MS
  httpServer.keepAliveTimeout = TIMEOUT_MS
  httpServer.headersTimeout = TIMEOUT_MS + 1000 // 比keepAlive多1秒
  
  console.log('================================================================================')
  console.log('✅ SERVER STARTED SUCCESSFULLY!')
  console.log('================================================================================')
  console.log(`📡 Server is running on http://${HOST}:${PORT}`)
  console.log(`🌍 Accessible from any network interface`)
  console.log(`🔧 Environment: ${config.nodeEnv || 'production'}`)
  console.log(`⏰ HTTP Timeout: ${TIMEOUT_MS/1000}s (${TIMEOUT_MS/60000}min) - supports long sync requests`)
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
  logger.info(`HTTP timeout set to ${TIMEOUT_MS/1000}s for long-running requests`)
})

export { io }