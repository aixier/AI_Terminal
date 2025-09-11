/**
 * ChokidarWatcher 服务
 * 负责监控文件系统变化，提供统一的文件监控接口
 */

import chokidar from 'chokidar'
import { EventEmitter } from 'eventemitter3'
import path from 'path'
import logger from '../../utils/logger.js'

class ChokidarWatcher extends EventEmitter {
  constructor(config = {}) {
    super()
    this.watchers = new Map() // userId -> watcher instance
    this.eventQueue = []
    this.batchTimer = null
    this.config = {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100
      },
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/.DS_Store',
        '**/Thumbs.db',
        '**/*.tmp',
        '**/.cache/**',
        '**/.system/**'
      ],
      depth: 5,
      alwaysStat: true,
      atomic: true,
      ...config
    }
  }

  /**
   * 获取用户资产目录路径
   */
  getUserAssetPath(userId) {
    const dataPath = process.env.DATA_PATH || path.join(process.cwd(), 'data')
    return path.join(dataPath, 'users', userId, 'assets')
  }

  /**
   * 监控用户目录
   * @param {string} userId - 用户ID
   * @param {Function} callback - 事件回调
   */
  watchUserDirectory(userId, callback) {
    try {
      // 如果已经存在监控器，先停止
      if (this.watchers.has(userId)) {
        this.unwatchUserDirectory(userId)
      }

      const userPath = this.getUserAssetPath(userId)
      logger.info(`[ChokidarWatcher] Starting watch for user: ${userId}, path: ${userPath}`)

      const watcher = chokidar.watch(userPath, this.config)

      // 绑定事件
      watcher
        .on('add', path => this.handleEvent('file:added', path, userId))
        .on('change', path => this.handleEvent('file:modified', path, userId))
        .on('unlink', path => this.handleEvent('file:deleted', path, userId))
        .on('addDir', path => this.handleEvent('folder:created', path, userId))
        .on('unlinkDir', path => this.handleEvent('folder:deleted', path, userId))
        .on('error', error => this.handleError(error, userId))
        .on('ready', () => {
          logger.info(`[ChokidarWatcher] Watcher ready for user: ${userId}`)
          this.emit('ready', { userId })
        })

      this.watchers.set(userId, watcher)

      // 如果提供了回调，注册事件监听
      if (callback) {
        this.on(`user:${userId}`, callback)
      }

      return watcher
    } catch (error) {
      logger.error(`[ChokidarWatcher] Failed to start watcher for user ${userId}:`, error)
      throw error
    }
  }

  /**
   * 停止监控用户目录
   * @param {string} userId - 用户ID
   */
  async unwatchUserDirectory(userId) {
    const watcher = this.watchers.get(userId)
    if (watcher) {
      await watcher.close()
      this.watchers.delete(userId)
      this.removeAllListeners(`user:${userId}`)
      logger.info(`[ChokidarWatcher] Stopped watching for user: ${userId}`)
    }
  }

  /**
   * 处理文件系统事件
   */
  handleEvent(type, filePath, userId) {
    const userPath = this.getUserAssetPath(userId)
    const relativePath = path.relative(userPath, filePath)
    
    const event = {
      type,
      path: relativePath,
      fullPath: filePath,
      userId,
      timestamp: Date.now()
    }

    // 添加到事件队列
    this.eventQueue.push(event)
    
    // 触发批处理
    this.processBatch()
  }

  /**
   * 批处理事件
   */
  processBatch() {
    // 清除之前的定时器
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
    }

    // 设置新的定时器
    this.batchTimer = setTimeout(() => {
      if (this.eventQueue.length === 0) return

      // 复制事件队列并清空
      const events = [...this.eventQueue]
      this.eventQueue = []

      // 去重处理
      const uniqueEvents = this.deduplicateEvents(events)

      // 按用户分组事件
      const userEvents = new Map()
      for (const event of uniqueEvents) {
        if (!userEvents.has(event.userId)) {
          userEvents.set(event.userId, [])
        }
        userEvents.get(event.userId).push(event)
      }

      // 发送事件
      for (const [userId, events] of userEvents) {
        this.emit(`user:${userId}`, { userId, events })
        this.emit('batch', { userId, events })
      }
    }, 100) // 100ms 批处理间隔
  }

  /**
   * 事件去重
   */
  deduplicateEvents(events) {
    const eventMap = new Map()
    
    for (const event of events) {
      const key = `${event.userId}:${event.type}:${event.path}`
      const existing = eventMap.get(key)
      
      // 保留最新的事件
      if (!existing || event.timestamp > existing.timestamp) {
        eventMap.set(key, event)
      }
    }
    
    return Array.from(eventMap.values())
  }

  /**
   * 处理错误
   */
  handleError(error, userId) {
    logger.error(`[ChokidarWatcher] Error for user ${userId}:`, error)
    this.emit('error', { userId, error })
  }

  /**
   * 获取当前监控状态
   */
  getStatus(userId) {
    if (userId) {
      return {
        watching: this.watchers.has(userId),
        path: this.getUserAssetPath(userId)
      }
    }

    // 返回所有用户的状态
    const status = {}
    for (const [uid, watcher] of this.watchers) {
      status[uid] = {
        watching: true,
        path: this.getUserAssetPath(uid)
      }
    }
    return status
  }

  /**
   * 停止所有监控
   */
  async stopAll() {
    logger.info('[ChokidarWatcher] Stopping all watchers...')
    
    const promises = []
    for (const [userId, watcher] of this.watchers) {
      promises.push(watcher.close())
    }
    
    await Promise.all(promises)
    this.watchers.clear()
    this.removeAllListeners()
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = null
    }
    
    logger.info('[ChokidarWatcher] All watchers stopped')
  }
}

// 导出单例
export default new ChokidarWatcher()