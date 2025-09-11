import express from 'express'
import { EventEmitter } from 'events'

const router = express.Router()

// SSE客户端管理
class SSEManager extends EventEmitter {
  constructor() {
    super()
    this.clients = new Map()
    this.userClients = new Map() // userId -> Set of clientIds
  }

  addClient(clientId, userId, res) {
    // 设置SSE响应头
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    })

    // 发送初始连接消息
    res.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`)

    // 保存客户端
    this.clients.set(clientId, { userId, res })

    // 添加到用户客户端列表
    if (!this.userClients.has(userId)) {
      this.userClients.set(userId, new Set())
    }
    this.userClients.get(userId).add(clientId)

    // 心跳保持连接
    const heartbeat = setInterval(() => {
      res.write(':heartbeat\n\n')
    }, 30000)

    // 客户端断开处理
    res.on('close', () => {
      clearInterval(heartbeat)
      this.removeClient(clientId, userId)
    })

    console.log(`[SSE] Client ${clientId} connected for user ${userId}`)
  }

  removeClient(clientId, userId) {
    this.clients.delete(clientId)
    
    const userSet = this.userClients.get(userId)
    if (userSet) {
      userSet.delete(clientId)
      if (userSet.size === 0) {
        this.userClients.delete(userId)
      }
    }

    console.log(`[SSE] Client ${clientId} disconnected`)
  }

  // 发送事件给特定用户
  sendToUser(userId, eventName, data) {
    const userSet = this.userClients.get(userId)
    if (!userSet) return

    const message = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`

    for (const clientId of userSet) {
      const client = this.clients.get(clientId)
      if (client) {
        try {
          client.res.write(message)
        } catch (error) {
          console.error(`[SSE] Failed to send to client ${clientId}:`, error)
          this.removeClient(clientId, userId)
        }
      }
    }
  }

  // 广播事件给所有用户
  broadcast(eventName, data) {
    const message = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`

    for (const [clientId, client] of this.clients) {
      try {
        client.res.write(message)
      } catch (error) {
        console.error(`[SSE] Failed to broadcast to client ${clientId}:`, error)
        this.removeClient(clientId, client.userId)
      }
    }
  }

  // 发送标准消息（不带事件名）
  sendMessage(userId, data) {
    const userSet = this.userClients.get(userId)
    if (!userSet) return

    const message = `data: ${JSON.stringify(data)}\n\n`

    for (const clientId of userSet) {
      const client = this.clients.get(clientId)
      if (client) {
        try {
          client.res.write(message)
        } catch (error) {
          console.error(`[SSE] Failed to send message to client ${clientId}:`, error)
          this.removeClient(clientId, userId)
        }
      }
    }
  }
}

// 创建全局SSE管理器实例
const sseManager = new SSEManager()

// SSE连接端点
router.get('/events/:userId', (req, res) => {
  const { userId } = req.params
  const clientId = `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  // 添加客户端
  sseManager.addClient(clientId, userId, res)
})

// 文件系统事件通知函数（供其他模块调用）
const notifyFileEvent = (userId, eventType, data) => {
  sseManager.sendToUser(userId, eventType, {
    timestamp: Date.now(),
    ...data
  })
}

// 批量事件通知
const notifyBatchEvents = (userId, events) => {
  sseManager.sendToUser(userId, 'batch', {
    timestamp: Date.now(),
    events
  })
}

// 导出路由和通知函数
export { router, sseManager, notifyFileEvent, notifyBatchEvents }