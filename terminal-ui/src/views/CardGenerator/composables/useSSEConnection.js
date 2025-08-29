import { ref, onUnmounted } from 'vue'
import sseService from '../../../services/sseService'

export function useSSEConnection(onFileUpdate, onRefresh) {
  const isConnected = ref(false)
  const reconnectAttempts = ref(0)
  const maxReconnectAttempts = 5
  
  // 建立SSE连接
  const connect = () => {
    try {
      sseService.connect()
      
      // 监听连接成功
      sseService.on('connected', () => {
        isConnected.value = true
        reconnectAttempts.value = 0
        console.log('[SSE] Connected successfully')
      })
      
      // 监听文件更新
      sseService.on('file-update', (data) => {
        console.log('[SSE] File update received:', data)
        if (onFileUpdate) {
          onFileUpdate(data)
        }
      })
      
      // 监听刷新事件
      sseService.on('refresh', (data) => {
        console.log('[SSE] Refresh event received:', data)
        if (onRefresh) {
          onRefresh(data)
        }
      })
      
      // 监听断开连接
      sseService.on('disconnected', () => {
        isConnected.value = false
        console.log('[SSE] Disconnected')
        handleReconnect()
      })
      
      // 监听错误
      sseService.on('error', (error) => {
        console.error('[SSE] Error:', error)
        isConnected.value = false
        handleReconnect()
      })
    } catch (error) {
      console.error('[SSE] Failed to connect:', error)
      isConnected.value = false
      handleReconnect()
    }
  }
  
  // 处理重连
  const handleReconnect = () => {
    if (reconnectAttempts.value < maxReconnectAttempts) {
      reconnectAttempts.value++
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.value), 30000)
      console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.value})`)
      
      setTimeout(() => {
        if (!isConnected.value) {
          connect()
        }
      }, delay)
    } else {
      console.error('[SSE] Max reconnect attempts reached')
    }
  }
  
  // 断开连接
  const disconnect = () => {
    try {
      sseService.disconnect()
      isConnected.value = false
      console.log('[SSE] Disconnected manually')
    } catch (error) {
      console.error('[SSE] Error during disconnect:', error)
    }
  }
  
  // 手动重连
  const reconnect = () => {
    disconnect()
    reconnectAttempts.value = 0
    connect()
  }
  
  // 组件卸载时断开连接
  onUnmounted(() => {
    disconnect()
  })
  
  return {
    isConnected,
    connect,
    disconnect,
    reconnect,
    reconnectAttempts
  }
}