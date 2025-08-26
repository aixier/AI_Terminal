/**
 * 连接处理工具
 * 防止空响应和连接断开问题
 */

/**
 * 设置连接保活机制
 * @param {Object} res - Express response 对象
 * @param {number} interval - 心跳间隔（毫秒）
 * @returns {Object} 包含清理函数的对象
 */
export function setupKeepAlive(res, interval = 30000) {
  let keepAliveTimer = null
  let connectionClosed = false
  
  // 监听连接关闭
  res.on('close', () => {
    connectionClosed = true
    if (keepAliveTimer) {
      clearInterval(keepAliveTimer)
    }
  })
  
  res.on('finish', () => {
    if (keepAliveTimer) {
      clearInterval(keepAliveTimer)
    }
  })
  
  // 设置心跳（通过发送注释保持连接）
  keepAliveTimer = setInterval(() => {
    if (!connectionClosed && !res.headersSent) {
      try {
        res.write(' ') // 发送空格保持连接
      } catch (error) {
        console.error('[KeepAlive] Failed to send heartbeat:', error)
        clearInterval(keepAliveTimer)
      }
    } else {
      clearInterval(keepAliveTimer)
    }
  }, interval)
  
  return {
    stop: () => {
      if (keepAliveTimer) {
        clearInterval(keepAliveTimer)
      }
    },
    isConnectionClosed: () => connectionClosed
  }
}

/**
 * 包装异步处理函数，添加错误处理
 * @param {Function} handler - 异步处理函数
 * @returns {Function} 包装后的函数
 */
export function wrapAsyncHandler(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next)
    } catch (error) {
      console.error('[AsyncHandler] Unhandled error:', error)
      
      // 检查响应是否已发送
      if (!res.headersSent) {
        res.status(500).json({
          code: 500,
          success: false,
          message: '处理请求时发生错误',
          error: {
            message: error.message,
            timestamp: new Date().toISOString()
          }
        })
      }
    }
  }
}

/**
 * 创建超时处理器
 * @param {Object} res - Express response 对象
 * @param {number} timeout - 超时时间（毫秒）
 * @param {string} message - 超时消息
 * @returns {Object} 包含计时器和清理函数
 */
export function createTimeoutHandler(res, timeout, message = '请求处理超时') {
  let timer = null
  let triggered = false
  
  timer = setTimeout(() => {
    triggered = true
    if (!res.headersSent) {
      console.warn('[TimeoutHandler] Request timeout after', timeout, 'ms')
      res.status(504).json({
        code: 504,
        success: false,
        message: message,
        timeout: timeout
      })
    }
  }, timeout)
  
  return {
    clear: () => {
      if (timer) {
        clearTimeout(timer)
      }
    },
    isTriggered: () => triggered
  }
}

/**
 * 创建连接监控器
 * @param {Object} res - Express response 对象
 * @param {string} apiId - API标识符
 * @returns {Object} 连接状态监控器
 */
export function createConnectionMonitor(res, apiId) {
  let connectionClosed = false
  let responsesSent = false
  
  // 监听连接事件
  res.on('close', () => {
    connectionClosed = true
    console.log(`[ConnectionMonitor][${apiId}] Client connection closed`)
  })
  
  res.on('finish', () => {
    responsesSent = true
    console.log(`[ConnectionMonitor][${apiId}] Response finished`)
  })
  
  return {
    isConnectionClosed: () => connectionClosed,
    isResponseSent: () => responsesSent || res.headersSent,
    canSendResponse: () => !connectionClosed && !responsesSent && !res.headersSent,
    
    // 安全发送响应
    safeSend: (statusCode, data) => {
      if (!connectionClosed && !responsesSent && !res.headersSent) {
        res.status(statusCode).json(data)
        return true
      } else {
        console.warn(`[ConnectionMonitor][${apiId}] Cannot send response - connection state:`, {
          connectionClosed,
          responsesSent,
          headersSent: res.headersSent
        })
        return false
      }
    },
    
    // 记录状态
    logState: () => {
      console.log(`[ConnectionMonitor][${apiId}] State:`, {
        connectionClosed,
        responsesSent,
        headersSent: res.headersSent
      })
    }
  }
}

export default {
  setupKeepAlive,
  wrapAsyncHandler,
  createTimeoutHandler,
  createConnectionMonitor
}