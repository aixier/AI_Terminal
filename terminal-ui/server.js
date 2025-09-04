import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import compression from 'compression'
import { createProxyMiddleware } from 'http-proxy-middleware'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 80

// 启用gzip压缩
app.use(compression())

// API代理配置 - 默认启用（设置 ENABLE_PROXY=false 可关闭）
const API_TARGET = process.env.API_TARGET || 'http://localhost:6009'
const ENABLE_PROXY = process.env.ENABLE_PROXY !== 'false'
if (ENABLE_PROXY) {
  app.use('/api', createProxyMiddleware({
    target: API_TARGET,
    changeOrigin: true,
    ws: true,
    logLevel: 'debug'
  }))
  
  // WebSocket代理
  app.use('/socket.io', createProxyMiddleware({
    target: API_TARGET,
    changeOrigin: true,
    ws: true
  }))
  
  app.use('/ws', createProxyMiddleware({
    target: API_TARGET,
    changeOrigin: true,
    ws: true
  }))
}

// 设置静态文件目录
app.use(express.static(path.join(__dirname, 'dist'), {
  maxAge: '1d',
  setHeaders: (res, path) => {
    // 对HTML文件禁用缓存
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    }
    // 对JS和CSS文件设置长期缓存
    else if (path.endsWith('.js') || path.endsWith('.css')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000')
    }
  }
}))

// 处理Vue Router的history模式
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Frontend server is running on port ${PORT}`)
  console.log(`API Proxy: ${ENABLE_PROXY ? `Enabled -> ${API_TARGET}` : 'Disabled'}`)
  console.log(`Environment: ${process.env.NODE_ENV || 'production'}`)
})