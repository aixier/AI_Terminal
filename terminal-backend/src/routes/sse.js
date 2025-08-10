/**
 * SSE (Server-Sent Events) Route
 * 实时推送文件系统变化到前端
 */

import express from 'express'
import fs from 'fs'
import { promises as fsPromises } from 'fs'
import path from 'path'
import chokidar from 'chokidar'
import logger from '../utils/logger.js'

const router = express.Router()

// 存储所有SSE连接
const clients = new Set()

// 监控的目录 - 精确到cards目录
// 支持Docker环境：优先使用DATA_PATH环境变量
const dataPath = process.env.DATA_PATH || path.join(process.cwd(), 'data')
const WATCH_DIR = path.join(dataPath, 'users/default/folders/default-folder/cards')

// 文件系统监控器
let watcher = null

// 文件系统状态缓存
let fileSystemCache = new Map()

// 定期检查定时器
let healthCheckInterval = null

/**
 * 扫描目录并更新缓存
 */
const scanDirectory = async (dir) => {
  const files = new Map()
  
  const scan = async (currentDir, depth = 0) => {
    if (depth > 3) return // cards目录下最多3层深度就够了
    
    try {
      const items = await fsPromises.readdir(currentDir, { withFileTypes: true })
      
      for (const item of items) {
        const fullPath = path.join(currentDir, item.name)
        
        // 跳过隐藏文件和node_modules
        if (item.name.startsWith('.') || item.name === 'node_modules') continue
        
        if (item.isDirectory()) {
          files.set(fullPath, 'directory')
          await scan(fullPath, depth + 1)
        } else {
          files.set(fullPath, 'file')
        }
      }
    } catch (err) {
      console.error(`[SSE] Error scanning ${currentDir}:`, err.message)
    }
  }
  
  await scan(dir)
  return files
}

/**
 * 定期健康检查
 */
const startHealthCheck = () => {
  if (healthCheckInterval) return
  
  healthCheckInterval = setInterval(async () => {
    console.log('[SSE] Running health check...')
    
    try {
      const currentFiles = await scanDirectory(WATCH_DIR)
      
      // 检查新增的文件/文件夹
      for (const [path, type] of currentFiles) {
        if (!fileSystemCache.has(path)) {
          console.log(`[SSE] Health check found new ${type}:`, path)
          
          // 手动触发事件
          if (type === 'file') {
            broadcastEvent('file:added', {
              path: path,
              type: 'file',
              action: 'add',
              source: 'health-check'
            })
          } else {
            broadcastEvent('folder:added', {
              path: path,
              type: 'folder',
              action: 'add',
              source: 'health-check'
            })
          }
        }
      }
      
      // 检查删除的文件/文件夹
      for (const [path, type] of fileSystemCache) {
        if (!currentFiles.has(path)) {
          console.log(`[SSE] Health check found deleted ${type}:`, path)
          
          // 手动触发事件
          if (type === 'file') {
            broadcastEvent('file:deleted', {
              path: path,
              type: 'file',
              action: 'delete',
              source: 'health-check'
            })
          } else {
            broadcastEvent('folder:deleted', {
              path: path,
              type: 'folder',
              action: 'delete',
              source: 'health-check'
            })
          }
        }
      }
      
      // 更新缓存
      fileSystemCache = currentFiles
    } catch (error) {
      console.error('[SSE] Health check error:', error)
    }
  }, 2000) // 每2秒检查一次（更及时）
  
  console.log('[SSE] Health check started (2s interval)')
}

/**
 * 初始化文件系统监控
 */
const initWatcher = () => {
  if (watcher) return

  // 检测是否在WSL或/mnt 挂载盘（Windows 文件系统）
  const isWSL = process.platform === 'linux' && process.env.WSL_DISTRO_NAME
  const isMnt = WATCH_DIR.startsWith('/mnt/')
  
  watcher = chokidar.watch(WATCH_DIR, {
    persistent: true,
    ignoreInitial: true,  // 忽略初始扫描，只监控新的变化
    depth: 3,  // cards目录下3层深度足够
    awaitWriteFinish: {
      stabilityThreshold: 400,  // 稍作等待，确保写入完成
      pollInterval: 100
    },
    // WSL/挂载盘使用轮询模式，缩短轮询间隔以更及时
    usePolling: isWSL || isMnt || process.env.USE_POLLING === 'true',
    interval: (isWSL || isMnt) ? 300 : 100,   // 挂载盘/WSL下更快轮询
    binaryInterval: (isWSL || isMnt) ? 500 : 300,
    alwaysStat: false,  // 不总是获取文件状态
    followSymlinks: false,  // 不跟踪符号链接
    ignorePermissionErrors: true  // 忽略权限错误
  })

  // 文件添加
  watcher.on('add', (filePath) => {
    console.log(`[SSE] File added detected: ${filePath}`)
    logger.info(`[SSE] File added: ${filePath}`)
    
    // 更新缓存
    fileSystemCache.set(filePath, 'file')
    
    broadcastEvent('file:added', {
      path: filePath,
      type: 'file',
      action: 'add'
    })
  })

  // 文件修改
  watcher.on('change', (filePath) => {
    logger.info(`[SSE] File changed: ${filePath}`)
    broadcastEvent('file:changed', {
      path: filePath,
      type: 'file',
      action: 'change'
    })
  })

  // 文件删除
  watcher.on('unlink', (filePath) => {
    logger.info(`[SSE] File deleted: ${filePath}`)
    
    // 更新缓存
    fileSystemCache.delete(filePath)
    
    broadcastEvent('file:deleted', {
      path: filePath,
      type: 'file',
      action: 'delete'
    })
  })

  // 目录添加
  watcher.on('addDir', (dirPath) => {
    console.log(`[SSE] Directory added detected: ${dirPath}`)
    logger.info(`[SSE] Directory added: ${dirPath}`)
    
    // 更新缓存
    fileSystemCache.set(dirPath, 'directory')
    
    broadcastEvent('folder:added', {
      path: dirPath,
      type: 'folder',
      action: 'add'
    })
  })

  // 目录删除
  watcher.on('unlinkDir', (dirPath) => {
    logger.info(`[SSE] Directory deleted: ${dirPath}`)
    
    // 更新缓存
    fileSystemCache.delete(dirPath)
    
    broadcastEvent('folder:deleted', {
      path: dirPath,
      type: 'folder',
      action: 'delete'
    })
  })

  // 监控器准备就绪
  watcher.on('ready', async () => {
    const isWSL = process.platform === 'linux' && process.env.WSL_DISTRO_NAME
    const isMnt = WATCH_DIR.startsWith('/mnt/')
    console.log('[SSE] File watcher is ready and monitoring:', WATCH_DIR)
    console.log('[SSE] Watcher mode:', (isWSL || isMnt) ? 'POLLING (WSL/mnt)' : 'EVENTS')
    console.log('[SSE] Watched paths:', watcher.getWatched())
    logger.info('[SSE] File watcher ready')
    
    // 初始化文件系统缓存
    fileSystemCache = await scanDirectory(WATCH_DIR)
    console.log(`[SSE] Initial scan found ${fileSystemCache.size} items`)
    
    // 启动健康检查
    startHealthCheck()

    // 通知前端进行一次目录刷新（确保初始状态立即同步）
    broadcastEvent('refresh', { source: 'watcher-ready', timestamp: Date.now() })
  })

  // 错误处理
  watcher.on('error', (error) => {
    console.error('[SSE] Watcher error:', error)
    logger.error('[SSE] Watcher error:', error)
  })

  logger.info('[SSE] File system watcher initialized')
}

/**
 * 广播事件到所有连接的客户端
 */
const broadcastEvent = (eventType, data) => {
  const message = JSON.stringify({
    type: eventType,
    data: data,
    timestamp: new Date().toISOString()
  })

  const sseMessage = `event: ${eventType}\ndata: ${message}\n\n`

  // 发送给所有客户端
  clients.forEach(client => {
    try {
      client.write(sseMessage)
    } catch (error) {
      logger.error('[SSE] Failed to send message to client:', error)
      // 移除失败的客户端
      clients.delete(client)
    }
  })

  logger.debug(`[SSE] Broadcasted ${eventType} to ${clients.size} clients`)
}

/**
 * SSE连接端点
 */
router.get('/stream', (req, res) => {
  logger.info('[SSE] New client connected')

  // 设置SSE响应头
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'X-Accel-Buffering': 'no' // 禁用Nginx缓冲
  })

  // 发送初始连接成功消息
  res.write(`event: connected\ndata: {"message": "SSE connected successfully"}\n\n`)

  // 添加到客户端列表
  clients.add(res)

  // 发送心跳保持连接
  const heartbeat = setInterval(() => {
    try {
      res.write(':heartbeat\n\n')
    } catch (error) {
      clearInterval(heartbeat)
      clients.delete(res)
    }
  }, 30000) // 每30秒发送一次心跳

  // 客户端断开连接时清理
  req.on('close', () => {
    logger.info('[SSE] Client disconnected')
    clearInterval(heartbeat)
    clients.delete(res)
  })

  // 初始化文件监控器（如果还没有初始化）
  if (!watcher) {
    initWatcher()
  }

  // 新连接后，立即触发一次仅对该客户端的刷新事件，确保首屏同步
  try {
    const initialMessage = JSON.stringify({ type: 'refresh', data: { source: 'on-connect' }, timestamp: new Date().toISOString() })
    res.write(`event: refresh\ndata: ${initialMessage}\n\n`)
  } catch {}
})

/**
 * 手动触发刷新事件（用于测试或手动刷新）
 */
router.post('/refresh', (req, res) => {
  logger.info('[SSE] Manual refresh triggered')
  
  broadcastEvent('refresh', {
    message: 'Manual refresh requested',
    timestamp: new Date().toISOString()
  })

  res.json({
    success: true,
    message: 'Refresh event sent',
    clients: clients.size
  })
})

/**
 * 获取当前连接状态
 */
router.get('/status', (req, res) => {
  res.json({
    connected_clients: clients.size,
    watcher_active: watcher !== null,
    watch_dir: WATCH_DIR
  })
})

// 清理函数
export const cleanup = () => {
  // 停止健康检查
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval)
    healthCheckInterval = null
    logger.info('[SSE] Health check stopped')
  }
  
  // 关闭文件监控器
  if (watcher) {
    watcher.close()
    watcher = null
    logger.info('[SSE] File watcher closed')
  }
  
  // 清空缓存
  fileSystemCache.clear()
  
  // 关闭所有客户端连接
  clients.forEach(client => {
    try {
      client.end()
    } catch (error) {
      // 忽略错误
    }
  })
  clients.clear()
}

// 进程退出时清理
process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)

export default router