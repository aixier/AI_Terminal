/**
 * SSE (Server-Sent Events) Service
 * 用于接收后端实时推送的文件系统变化事件
 */

// 同源 /api

class SSEService {
  constructor() {
    this.eventSource = null
    this.listeners = new Map()
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 5
    this.reconnectDelay = 3000
    this.isConnected = false
  }

  /**
   * 连接到SSE流
   */
  connect() {
    if (this.eventSource) {
      console.warn('[SSE] Already connected')
      return
    }

    // 获取认证token
    const token = localStorage.getItem('token')
    if (!token) {
      console.error('[SSE] No authentication token found')
      this.emit('error', { message: 'No authentication token' })
      return
    }

    // 动态获取SSE URL（同源）- 包含认证token作为查询参数
    const sseUrl = `/api/sse/stream?token=${encodeURIComponent(token)}`
    console.log('[SSE] Connecting to:', '/api/sse/stream')

    try {
      this.eventSource = new EventSource(sseUrl)

      // 连接成功
      this.eventSource.addEventListener('connected', (event) => {
        console.log('[SSE] Connected successfully:', event.data)
        this.isConnected = true
        this.reconnectAttempts = 0
        this.emit('connected', JSON.parse(event.data))
      })

      // 文件添加事件
      this.eventSource.addEventListener('file:added', (event) => {
        const data = JSON.parse(event.data)
        console.log('[SSE] File added:', data.path || data)
        console.log('[SSE] File added data:', data)
        this.emit('file:added', data)
        this.emit('filesystem:changed', data)
      })

      // 文件修改事件
      this.eventSource.addEventListener('file:changed', (event) => {
        const data = JSON.parse(event.data)
        console.log('[SSE] File changed:', data.path || data)
        console.log('[SSE] File changed data:', data)
        this.emit('file:changed', data)
        this.emit('filesystem:changed', data)
      })

      // 文件删除事件
      this.eventSource.addEventListener('file:deleted', (event) => {
        const data = JSON.parse(event.data)
        console.log('[SSE] File deleted:', data.path || data)
        console.log('[SSE] File deleted data:', data)
        this.emit('file:deleted', data)
        this.emit('filesystem:changed', data)
      })

      // 文件夹添加事件
      this.eventSource.addEventListener('folder:added', (event) => {
        const data = JSON.parse(event.data)
        console.log('[SSE] Folder added:', data.path || data)
        console.log('[SSE] Folder added data:', data)
        this.emit('folder:added', data)
        this.emit('filesystem:changed', data)
      })

      // 文件夹删除事件
      this.eventSource.addEventListener('folder:deleted', (event) => {
        const data = JSON.parse(event.data)
        console.log('[SSE] Folder deleted:', data.path || data)
        console.log('[SSE] Folder deleted data:', data)
        this.emit('folder:deleted', data)
        this.emit('filesystem:changed', data)
      })

      // 手动刷新事件
      this.eventSource.addEventListener('refresh', (event) => {
        const data = JSON.parse(event.data)
        console.log('[SSE] Refresh requested:', data)
        this.emit('refresh', data)
      })

      // 连接错误处理
      this.eventSource.onerror = (error) => {
        console.error('[SSE] Connection error:', error)
        this.isConnected = false
        this.emit('error', error)

        // 自动重连逻辑
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++
          console.log(`[SSE] Reconnecting... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
          
          setTimeout(() => {
            this.disconnect()
            this.connect()
          }, this.reconnectDelay * this.reconnectAttempts)
        } else {
          console.error('[SSE] Max reconnection attempts reached')
          this.emit('connection:failed', { 
            message: 'Failed to establish SSE connection after multiple attempts' 
          })
        }
      }

      // 连接打开
      this.eventSource.onopen = () => {
        console.log('[SSE] Connection opened')
        this.isConnected = true
      }

    } catch (error) {
      console.error('[SSE] Failed to create EventSource:', error)
      this.emit('error', error)
    }
  }

  /**
   * 断开SSE连接
   */
  disconnect() {
    if (this.eventSource) {
      console.log('[SSE] Disconnecting...')
      this.eventSource.close()
      this.eventSource = null
      this.isConnected = false
      this.emit('disconnected')
    }
  }

  /**
   * 监听事件
   * @param {string} event - 事件名称
   * @param {Function} callback - 回调函数
   * @returns {Function} 取消监听的函数
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    
    this.listeners.get(event).add(callback)
    
    // 返回取消监听的函数
    return () => {
      const callbacks = this.listeners.get(event)
      if (callbacks) {
        callbacks.delete(callback)
        if (callbacks.size === 0) {
          this.listeners.delete(event)
        }
      }
    }
  }

  /**
   * 移除事件监听
   */
  off(event, callback) {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.delete(callback)
      if (callbacks.size === 0) {
        this.listeners.delete(event)
      }
    }
  }

  /**
   * 触发事件
   */
  emit(event, data) {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.error(`[SSE] Error in event handler for ${event}:`, error)
        }
      })
    }
  }

  /**
   * 手动触发刷新
   */
  async triggerRefresh() {
    try {
      const response = await fetch(`/api/sse/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      const result = await response.json()
      console.log('[SSE] Manual refresh triggered:', result)
      return result
    } catch (error) {
      console.error('[SSE] Failed to trigger refresh:', error)
      throw error
    }
  }

  /**
   * 获取连接状态
   */
  async getStatus() {
    try {
      const response = await fetch(`/api/sse/status`)
      const status = await response.json()
      console.log('[SSE] Status:', status)
      return status
    } catch (error) {
      console.error('[SSE] Failed to get status:', error)
      return null
    }
  }

  /**
   * 检查是否连接
   */
  isConnected() {
    return this.isConnected && this.eventSource && this.eventSource.readyState === EventSource.OPEN
  }
}

// 导出单例
export default new SSEService()