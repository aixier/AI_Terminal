import terminalService from './terminalService.js'
import sessionManager from './sessionManager.js'
import outputBuffer from './outputBuffer.js'
import logger from '../utils/logger.js'

// 全局存储，避免重复创建监听器
const activeListeners = new Map()

// 清理会话监听器
function cleanupSessionListeners(sessionId) {
  const listeners = activeListeners.get(sessionId)
  if (listeners) {
    const { session, dataHandler, exitHandler } = listeners
    
    // 移除监听器
    if (session && session.pty) {
      if (dataHandler) {
        session.pty.removeListener('data', dataHandler)
      }
      if (exitHandler) {
        session.pty.removeListener('exit', exitHandler)
      }
    }
    
    // 从映射中删除
    activeListeners.delete(sessionId)
    logger.info(`Cleaned up listeners for session: ${sessionId}`)
  }
}

// 设置会话监听器（确保只设置一次）
function setupSessionListeners(session, socket) {
  const sessionId = socket.id
  
  // 如果监听器已存在，先清理
  if (activeListeners.has(sessionId)) {
    logger.warn(`Listeners already exist for ${sessionId}, cleaning up first`)
    cleanupSessionListeners(sessionId)
  }
  
  // 创建新的监听器函数（保存引用以便后续移除）
  const dataHandler = (data) => {
    // 使用输出缓冲器处理数据
    outputBuffer.buffer(sessionId, data, (bufferedData) => {
      socket.emit('terminal:output', bufferedData)
    })
  }
  
  const exitHandler = ({ exitCode, signal }) => {
    logger.info(`Terminal exited: ${sessionId}, code: ${exitCode}, signal: ${signal}`)
    socket.emit('terminal:exit', { exitCode, signal })
    cleanupSessionListeners(sessionId)
    terminalService.destroySession(sessionId)
  }
  
  // 添加监听器
  session.pty.on('data', dataHandler)
  session.pty.on('exit', exitHandler)
  
  // 保存监听器引用
  activeListeners.set(sessionId, {
    session,
    dataHandler,
    exitHandler
  })
  
  logger.info(`Set up listeners for session: ${sessionId}`)
}

export function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}`)

    // 创建终端会话
    socket.on('terminal:create', (options, callback) => {
      try {
        // 从socket获取用户信息
        const userId = socket.handshake.auth?.userId || 'anonymous'
        
        // 检查是否已经存在会话
        let session = terminalService.getSession(socket.id)
        
        if (!session) {
          // 创建新的终端会话
          session = terminalService.createSession(socket.id, options)
          
          // 注册到会话管理器
          sessionManager.createUserSession(userId, socket.id, {
            ipAddress: socket.handshake.address,
            userAgent: socket.handshake.headers['user-agent']
          })
          
          // 设置监听器（只设置一次）
          setupSessionListeners(session, socket)
          
          logger.info(`Created new terminal session for ${socket.id}`)
        } else {
          logger.info(`Reusing existing terminal session for ${socket.id}`)
          
          // 检查是否已经有监听器
          if (!activeListeners.has(socket.id)) {
            // 只有在没有监听器的情况下才设置
            setupSessionListeners(session, socket)
          } else {
            logger.info(`Listeners already active for ${socket.id}, skipping setup`)
          }
        }

        callback({ success: true, sessionId: socket.id })
      } catch (error) {
        logger.error(`Failed to create terminal: ${error.message}`)
        callback({ success: false, error: error.message })
      }
    })

    // 接收终端输入
    socket.on('terminal:input', (data) => {
      try {
        terminalService.writeToSession(socket.id, data)
      } catch (error) {
        logger.error(`Failed to write to terminal: ${error.message}`)
        socket.emit('terminal:error', { message: error.message })
      }
    })

    // 调整终端大小
    socket.on('terminal:resize', ({ cols, rows }) => {
      try {
        terminalService.resizeSession(socket.id, cols, rows)
      } catch (error) {
        logger.error(`Failed to resize terminal: ${error.message}`)
      }
    })

    // 执行命令（高级功能）
    socket.on('command:execute', (command, callback) => {
      try {
        // 这里可以添加命令验证和安全检查
        terminalService.writeToSession(socket.id, command + '\n')
        callback({ success: true })
      } catch (error) {
        callback({ success: false, error: error.message })
      }
    })

    // 断开连接时清理
    socket.on('disconnect', () => {
      logger.info(`Client disconnected: ${socket.id}`)
      
      // 先清理监听器
      cleanupSessionListeners(socket.id)
      
      // 清理输出缓冲器
      outputBuffer.cleanup(socket.id)
      
      // 然后销毁会话
      terminalService.destroySession(socket.id)
      sessionManager.removeSession(socket.id)
    })
  })
}