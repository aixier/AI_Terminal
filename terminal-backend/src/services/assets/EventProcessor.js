/**
 * EventProcessor 服务
 * 负责处理文件系统事件的批处理和分发
 */

import { EventEmitter } from 'eventemitter3'
import PQueue from 'p-queue'
import logger from '../../utils/logger.js'

class EventProcessor extends EventEmitter {
  constructor() {
    super()
    this.queue = new PQueue({ concurrency: 10 })
    this.batchSize = 50
    this.batchTimeout = 100
    this.eventHandlers = new Map()
    this.sseClients = new Map() // userId -> SSE response objects
  }

  /**
   * 注册SSE客户端
   */
  registerSSEClient(userId, res) {
    if (!this.sseClients.has(userId)) {
      this.sseClients.set(userId, new Set())
    }
    this.sseClients.get(userId).add(res)
    
    // 清理断开的连接
    res.on('close', () => {
      const clients = this.sseClients.get(userId)
      if (clients) {
        clients.delete(res)
        if (clients.size === 0) {
          this.sseClients.delete(userId)
        }
      }
    })
  }

  /**
   * 发送SSE事件
   */
  sendSSEEvent(userId, eventType, data) {
    const clients = this.sseClients.get(userId)
    if (!clients || clients.size === 0) return

    const eventData = JSON.stringify({
      type: eventType,
      data,
      timestamp: Date.now()
    })

    for (const res of clients) {
      try {
        res.write(`event: ${eventType}\n`)
        res.write(`data: ${eventData}\n\n`)
      } catch (error) {
        // 客户端可能已断开
        clients.delete(res)
      }
    }
  }

  /**
   * 处理批量事件
   */
  async processEvents(events) {
    try {
      // 事件去重
      const uniqueEvents = this.deduplicateEvents(events)
      
      // 事件分类
      const categorized = this.categorizeEvents(uniqueEvents)
      
      // 批量处理每种类型的事件
      for (const [type, typeEvents] of Object.entries(categorized)) {
        await this.queue.add(() => this.processBatch(type, typeEvents))
      }
    } catch (error) {
      logger.error('[EventProcessor] Failed to process events:', error)
      this.emit('error', error)
    }
  }

  /**
   * 事件去重
   */
  deduplicateEvents(events) {
    const eventMap = new Map()
    
    for (const event of events) {
      const key = `${event.type}:${event.path}:${event.userId}`
      const existing = eventMap.get(key)
      
      // 保留最新的事件
      if (!existing || event.timestamp > existing.timestamp) {
        eventMap.set(key, event)
      }
    }
    
    return Array.from(eventMap.values())
  }

  /**
   * 事件分类
   */
  categorizeEvents(events) {
    const categorized = {}
    
    for (const event of events) {
      if (!categorized[event.type]) {
        categorized[event.type] = []
      }
      categorized[event.type].push(event)
    }
    
    return categorized
  }

  /**
   * 处理特定类型的事件批次
   */
  async processBatch(type, events) {
    logger.info(`[EventProcessor] Processing batch of ${events.length} ${type} events`)
    
    try {
      switch(type) {
        case 'file:added':
          await this.handleFilesAdded(events)
          break
        case 'file:modified':
          await this.handleFilesModified(events)
          break
        case 'file:deleted':
          await this.handleFilesDeleted(events)
          break
        case 'folder:created':
          await this.handleFoldersCreated(events)
          break
        case 'folder:deleted':
          await this.handleFoldersDeleted(events)
          break
        default:
          logger.warn(`[EventProcessor] Unknown event type: ${type}`)
      }
      
      // 发送批处理完成事件
      this.emit('batch:completed', { type, count: events.length })
      
      // 通过SSE通知客户端
      for (const event of events) {
        this.sendSSEEvent(event.userId, event.type, {
          path: event.path,
          fullPath: event.fullPath,
          timestamp: event.timestamp
        })
      }
    } catch (error) {
      logger.error(`[EventProcessor] Failed to process batch ${type}:`, error)
      this.emit('batch:error', { type, error, events })
    }
  }

  /**
   * 处理文件添加事件
   */
  async handleFilesAdded(events) {
    for (const event of events) {
      try {
        // 触发文件添加处理器
        await this.executeHandlers('file:added', event)
        
        // 发送通知
        this.emit('file:added', event)
        
        logger.debug(`[EventProcessor] File added: ${event.path}`)
      } catch (error) {
        logger.error(`[EventProcessor] Failed to handle file added:`, error)
      }
    }
  }

  /**
   * 处理文件修改事件
   */
  async handleFilesModified(events) {
    for (const event of events) {
      try {
        await this.executeHandlers('file:modified', event)
        this.emit('file:modified', event)
        logger.debug(`[EventProcessor] File modified: ${event.path}`)
      } catch (error) {
        logger.error(`[EventProcessor] Failed to handle file modified:`, error)
      }
    }
  }

  /**
   * 处理文件删除事件
   */
  async handleFilesDeleted(events) {
    for (const event of events) {
      try {
        await this.executeHandlers('file:deleted', event)
        this.emit('file:deleted', event)
        logger.debug(`[EventProcessor] File deleted: ${event.path}`)
      } catch (error) {
        logger.error(`[EventProcessor] Failed to handle file deleted:`, error)
      }
    }
  }

  /**
   * 处理文件夹创建事件
   */
  async handleFoldersCreated(events) {
    for (const event of events) {
      try {
        await this.executeHandlers('folder:created', event)
        this.emit('folder:created', event)
        logger.debug(`[EventProcessor] Folder created: ${event.path}`)
      } catch (error) {
        logger.error(`[EventProcessor] Failed to handle folder created:`, error)
      }
    }
  }

  /**
   * 处理文件夹删除事件
   */
  async handleFoldersDeleted(events) {
    for (const event of events) {
      try {
        await this.executeHandlers('folder:deleted', event)
        this.emit('folder:deleted', event)
        logger.debug(`[EventProcessor] Folder deleted: ${event.path}`)
      } catch (error) {
        logger.error(`[EventProcessor] Failed to handle folder deleted:`, error)
      }
    }
  }

  /**
   * 注册事件处理器
   */
  registerHandler(eventType, handler) {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, [])
    }
    this.eventHandlers.get(eventType).push(handler)
  }

  /**
   * 执行事件处理器
   */
  async executeHandlers(eventType, event) {
    const handlers = this.eventHandlers.get(eventType)
    if (!handlers || handlers.length === 0) return

    for (const handler of handlers) {
      try {
        await handler(event)
      } catch (error) {
        logger.error(`[EventProcessor] Handler error for ${eventType}:`, error)
      }
    }
  }

  /**
   * 获取队列状态
   */
  getQueueStatus() {
    return {
      size: this.queue.size,
      pending: this.queue.pending,
      isPaused: this.queue.isPaused
    }
  }

  /**
   * 暂停处理
   */
  pause() {
    this.queue.pause()
    logger.info('[EventProcessor] Queue paused')
  }

  /**
   * 恢复处理
   */
  resume() {
    this.queue.start()
    logger.info('[EventProcessor] Queue resumed')
  }

  /**
   * 清空队列
   */
  clear() {
    this.queue.clear()
    logger.info('[EventProcessor] Queue cleared')
  }

  /**
   * 获取SSE客户端统计
   */
  getSSEStats() {
    const stats = {}
    for (const [userId, clients] of this.sseClients) {
      stats[userId] = clients.size
    }
    return stats
  }
}

// 导出单例
export default new EventProcessor()