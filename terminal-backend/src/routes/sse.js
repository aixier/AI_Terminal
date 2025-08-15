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
import { authenticateUser, authenticateSSE } from '../middleware/userAuth.js'

const router = express.Router()

// 存储用户特定的SSE连接和监控器
const userClients = new Map() // username -> Set of clients
const userWatchers = new Map() // username -> watcher instance
const userFileSystemCache = new Map() // username -> Map of files

// 支持Docker环境：优先使用DATA_PATH环境变量
const dataPath = process.env.DATA_PATH || path.join(process.cwd(), 'data')

// 用户健康检查定时器
const userHealthCheckIntervals = new Map() // username -> interval

/**
 * 获取用户的监控目录
 */
const getUserWatchDir = (username) => {
  return path.join(dataPath, 'users', username, 'folders', 'default-folder', 'cards')
}

/**
 * 获取或创建用户客户端集合
 */
const getUserClients = (username) => {
  if (!userClients.has(username)) {
    userClients.set(username, new Set())
  }
  return userClients.get(username)
}

/**
 * 获取或创建用户文件缓存
 */
const getUserFileCache = (username) => {
  if (!userFileSystemCache.has(username)) {
    userFileSystemCache.set(username, new Map())
  }
  return userFileSystemCache.get(username)
}

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
 * 为特定用户启动健康检查
 */
const startUserHealthCheck = (username) => {
  if (userHealthCheckIntervals.has(username)) return
  
  const watchDir = getUserWatchDir(username)
  let lastHealthLogTime = 0
  
  const interval = setInterval(async () => {
    // 每60秒打印一次健康检查tick，避免日志刷屏
    const now = Date.now()
    if (now - lastHealthLogTime > 60000) {
      logger.debug(`[SSE] Health check tick for user ${username}`)
      lastHealthLogTime = now
    }
    
    try {
      const currentFiles = await scanDirectory(watchDir)
      const fileCache = getUserFileCache(username)
      
      // 检查新增的文件/文件夹
      for (const [path, type] of currentFiles) {
        if (!fileCache.has(path)) {
          console.log(`[SSE] Health check found new ${type} for ${username}:`, path)
          
          // 手动触发事件
          if (type === 'file') {
            broadcastEventToUser(username, 'file:added', {
              path: path,
              type: 'file',
              action: 'add',
              source: 'health-check'
            })
          } else {
            broadcastEventToUser(username, 'folder:added', {
              path: path,
              type: 'folder',
              action: 'add',
              source: 'health-check'
            })
          }
        }
      }
      
      // 检查删除的文件/文件夹
      for (const [path, type] of fileCache) {
        if (!currentFiles.has(path)) {
          console.log(`[SSE] Health check found deleted ${type} for ${username}:`, path)
          
          // 手动触发事件
          if (type === 'file') {
            broadcastEventToUser(username, 'file:deleted', {
              path: path,
              type: 'file',
              action: 'delete',
              source: 'health-check'
            })
          } else {
            broadcastEventToUser(username, 'folder:deleted', {
              path: path,
              type: 'folder',
              action: 'delete',
              source: 'health-check'
            })
          }
        }
      }
      
      // 更新缓存
      userFileSystemCache.set(username, currentFiles)
    } catch (error) {
      console.error(`[SSE] Health check error for ${username}:`, error)
    }
  }, 2000) // 每2秒检查一次（更及时）
  
  userHealthCheckIntervals.set(username, interval)
  console.log(`[SSE] Health check started for user ${username} (2s interval)`)
}

/**
 * 为特定用户初始化文件系统监控
 */
const initUserWatcher = (username) => {
  if (userWatchers.has(username)) return

  const watchDir = getUserWatchDir(username)
  const fileCache = getUserFileCache(username)

  // 检测是否在WSL或/mnt 挂载盘（Windows 文件系统）
  const isWSL = process.platform === 'linux' && process.env.WSL_DISTRO_NAME
  const isMnt = watchDir.startsWith('/mnt/')
  
  const watcher = chokidar.watch(watchDir, {
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
    console.log(`[SSE] File added detected for ${username}: ${filePath}`)
    logger.info(`[SSE] File added for ${username}: ${filePath}`)
    
    // 更新缓存
    fileCache.set(filePath, 'file')
    
    broadcastEventToUser(username, 'file:added', {
      path: filePath,
      type: 'file',
      action: 'add'
    })
  })

  // 文件修改
  watcher.on('change', (filePath) => {
    logger.info(`[SSE] File changed for ${username}: ${filePath}`)
    broadcastEventToUser(username, 'file:changed', {
      path: filePath,
      type: 'file',
      action: 'change'
    })
  })

  // 文件删除
  watcher.on('unlink', (filePath) => {
    logger.info(`[SSE] File deleted for ${username}: ${filePath}`)
    
    // 更新缓存
    fileCache.delete(filePath)
    
    broadcastEventToUser(username, 'file:deleted', {
      path: filePath,
      type: 'file',
      action: 'delete'
    })
  })

  // 目录添加
  watcher.on('addDir', (dirPath) => {
    console.log(`[SSE] Directory added detected for ${username}: ${dirPath}`)
    logger.info(`[SSE] Directory added for ${username}: ${dirPath}`)
    
    // 更新缓存
    fileCache.set(dirPath, 'directory')
    
    broadcastEventToUser(username, 'folder:added', {
      path: dirPath,
      type: 'folder',
      action: 'add'
    })
  })

  // 目录删除
  watcher.on('unlinkDir', (dirPath) => {
    logger.info(`[SSE] Directory deleted for ${username}: ${dirPath}`)
    
    // 更新缓存
    fileCache.delete(dirPath)
    
    broadcastEventToUser(username, 'folder:deleted', {
      path: dirPath,
      type: 'folder',
      action: 'delete'
    })
  })

  // 监控器准备就绪
  watcher.on('ready', async () => {
    const isWSL = process.platform === 'linux' && process.env.WSL_DISTRO_NAME
    const isMnt = watchDir.startsWith('/mnt/')
    console.log(`[SSE] File watcher is ready for ${username}, monitoring:`, watchDir)
    console.log(`[SSE] Watcher mode for ${username}:`, (isWSL || isMnt) ? 'POLLING (WSL/mnt)' : 'EVENTS')
    logger.info(`[SSE] File watcher ready for ${username}`)
    
    // 初始化文件系统缓存
    const initialFiles = await scanDirectory(watchDir)
    userFileSystemCache.set(username, initialFiles)
    console.log(`[SSE] Initial scan for ${username} found ${initialFiles.size} items`)
    
    // 启动健康检查
    startUserHealthCheck(username)

    // 通知前端进行一次目录刷新（确保初始状态立即同步）
    broadcastEventToUser(username, 'refresh', { 
      source: 'watcher-ready', 
      timestamp: Date.now(),
      username: username
    })
  })

  // 错误处理
  watcher.on('error', (error) => {
    console.error(`[SSE] Watcher error for ${username}:`, error)
    logger.error(`[SSE] Watcher error for ${username}:`, error)
  })

  userWatchers.set(username, watcher)
  logger.info(`[SSE] File system watcher initialized for ${username}`)
}

/**
 * 广播事件到特定用户的所有连接客户端
 */
const broadcastEventToUser = (username, eventType, data) => {
  const clients = getUserClients(username)
  
  const message = JSON.stringify({
    type: eventType,
    data: data,
    timestamp: new Date().toISOString()
  })

  const sseMessage = `event: ${eventType}\ndata: ${message}\n\n`

  // 发送给该用户的所有客户端
  clients.forEach(client => {
    try {
      client.write(sseMessage)
    } catch (error) {
      logger.error(`[SSE] Failed to send message to user ${username}:`, error)
      // 移除失败的客户端
      clients.delete(client)
    }
  })

  logger.debug(`[SSE] Broadcasted ${eventType} to ${clients.size} clients of user ${username}`)
}

/**
 * SSE连接端点 - 需要用户认证（支持查询参数token）
 */
router.get('/stream', authenticateSSE, (req, res) => {
  const username = req.user.username
  logger.info(`[SSE] New client connected for user: ${username}`)

  // 设置SSE响应头
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'X-Accel-Buffering': 'no' // 禁用Nginx缓冲
  })

  // 发送初始连接成功消息
  res.write(`event: connected\ndata: {"message": "SSE connected successfully", "username": "${username}"}\n\n`)

  // 添加到用户特定的客户端列表
  const userClientSet = getUserClients(username)
  userClientSet.add(res)

  // 发送心跳保持连接
  const heartbeat = setInterval(() => {
    try {
      res.write(':heartbeat\n\n')
    } catch (error) {
      clearInterval(heartbeat)
      userClientSet.delete(res)
    }
  }, 30000) // 每30秒发送一次心跳

  // 客户端断开连接时清理
  req.on('close', () => {
    logger.info(`[SSE] Client disconnected for user: ${username}`)
    clearInterval(heartbeat)
    userClientSet.delete(res)
    
    // 如果该用户没有客户端连接了，清理监控器
    if (userClientSet.size === 0) {
      const watcher = userWatchers.get(username)
      if (watcher) {
        watcher.close()
        userWatchers.delete(username)
        logger.info(`[SSE] Watcher closed for user: ${username}`)
      }
      
      // 清理健康检查
      const interval = userHealthCheckIntervals.get(username)
      if (interval) {
        clearInterval(interval)
        userHealthCheckIntervals.delete(username)
        logger.info(`[SSE] Health check stopped for user: ${username}`)
      }
      
      // 清理缓存
      userFileSystemCache.delete(username)
      userClients.delete(username)
    }
  })

  // 初始化用户特定的文件监控器
  if (!userWatchers.has(username)) {
    initUserWatcher(username)
  }

  // 新连接后，立即触发一次仅对该客户端的刷新事件，确保首屏同步
  try {
    const initialMessage = JSON.stringify({ 
      type: 'refresh', 
      data: { source: 'on-connect', username: username }, 
      timestamp: new Date().toISOString() 
    })
    res.write(`event: refresh\ndata: ${initialMessage}\n\n`)
  } catch {}
})

/**
 * 手动触发刷新事件（用于测试或手动刷新）
 */
router.post('/refresh', authenticateUser, (req, res) => {
  const username = req.user.username
  logger.info(`[SSE] Manual refresh triggered for user: ${username}`)
  
  broadcastEventToUser(username, 'refresh', {
    message: 'Manual refresh requested',
    timestamp: new Date().toISOString(),
    username: username
  })

  const userClientSet = getUserClients(username)
  res.json({
    success: true,
    message: 'Refresh event sent',
    clients: userClientSet.size,
    username: username
  })
})

/**
 * 获取当前连接状态
 */
router.get('/status', authenticateUser, (req, res) => {
  const username = req.user.username
  const userClientSet = getUserClients(username)
  const watchDir = getUserWatchDir(username)
  
  res.json({
    connected_clients: userClientSet.size,
    watcher_active: userWatchers.has(username),
    watch_dir: watchDir,
    username: username
  })
})

// 清理函数
export const cleanup = () => {
  // 停止所有用户的健康检查
  for (const [username, interval] of userHealthCheckIntervals) {
    clearInterval(interval)
    logger.info(`[SSE] Health check stopped for user: ${username}`)
  }
  userHealthCheckIntervals.clear()
  
  // 关闭所有用户的文件监控器
  for (const [username, watcher] of userWatchers) {
    watcher.close()
    logger.info(`[SSE] File watcher closed for user: ${username}`)
  }
  userWatchers.clear()
  
  // 清空所有缓存
  userFileSystemCache.clear()
  
  // 关闭所有客户端连接
  for (const [username, clientSet] of userClients) {
    clientSet.forEach(client => {
      try {
        client.end()
      } catch (error) {
        // 忽略错误
      }
    })
    logger.info(`[SSE] All clients closed for user: ${username}`)
  }
  userClients.clear()
}

// 进程退出时清理
process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)

export default router