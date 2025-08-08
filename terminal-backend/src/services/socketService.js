/**
 * Socket Service - 最佳实践版本
 * 
 * 这是符合Web Terminal最佳实践的实现
 * 特点：
 * 1. 无缓冲直接传输
 * 2. 清晰的连接管理
 * 3. 单一数据流
 * 4. 正确的错误处理
 */

import socketHandler from './socketHandler.js'
import terminalManager from './terminalManager.js'
import logger from '../utils/logger.js'

/**
 * 设置Socket.io处理器
 * @param {Server} io - Socket.io服务器实例
 */
export function setupSocketHandlers(io) {
  // 将io实例注入到handler中
  socketHandler.setIO(io)

  // 监听终端管理器事件
  terminalManager.on('terminal:created', ({ id, pid }) => {
    logger.info(`[SocketService] Terminal created event: ${id} (PID: ${pid})`)
  })

  terminalManager.on('terminal:exit', ({ id, exitCode, signal }) => {
    logger.info(`[SocketService] Terminal exit event: ${id} (${exitCode}/${signal})`)
    
    // 通知相关的Socket
    const socketId = socketHandler.terminalToSocket.get(id)
    if (socketId) {
      const socket = io.sockets.sockets.get(socketId)
      if (socket) {
        socket.emit('terminal:exit', { exitCode, signal })
      }
    }
  })

  // 处理Socket连接
  io.on('connection', (socket) => {
    socketHandler.handleConnection(socket)
  })

  // 定期报告状态（可选）
  if (process.env.NODE_ENV === 'development') {
    setInterval(() => {
      const stats = socketHandler.getStats()
      logger.debug('[SocketService] Stats:', stats)
    }, 60000) // 每分钟报告一次
  }

  // 优雅关闭处理
  process.on('SIGINT', () => {
    logger.info('[SocketService] Shutting down gracefully...')
    terminalManager.destroyAll()
    process.exit(0)
  })

  process.on('SIGTERM', () => {
    logger.info('[SocketService] Shutting down gracefully...')
    terminalManager.destroyAll()
    process.exit(0)
  })

  logger.info('[SocketService] Socket handlers initialized (best practice version)')
}

// 导出工具函数
export function getConnectionStats() {
  return socketHandler.getStats()
}

export function getTerminalStatus() {
  return terminalManager.getStatus()
}