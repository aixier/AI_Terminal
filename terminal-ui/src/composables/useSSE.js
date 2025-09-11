import { ref, onUnmounted } from 'vue'

export function useSSE() {
  const eventSources = ref(new Map())
  const listeners = ref(new Map())

  // 订阅SSE事件
  const subscribe = (url, callback, options = {}) => {
    // 如果已经有相同URL的连接，先关闭
    if (eventSources.value.has(url)) {
      unsubscribe(url)
    }

    // 创建新的EventSource
    const eventSource = new EventSource(url)
    eventSources.value.set(url, eventSource)

    // 处理连接打开
    eventSource.onopen = (event) => {
      console.log(`[SSE] Connected to ${url}`)
      if (options.onOpen) {
        options.onOpen(event)
      }
    }

    // 处理错误
    eventSource.onerror = (error) => {
      console.error(`[SSE] Error on ${url}:`, error)
      if (options.onError) {
        options.onError(error)
      }
      
      // 重连逻辑
      if (options.reconnect !== false) {
        setTimeout(() => {
          console.log(`[SSE] Reconnecting to ${url}...`)
          unsubscribe(url)
          subscribe(url, callback, options)
        }, options.reconnectDelay || 5000)
      }
    }

    // 处理消息
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        callback({
          type: event.type || 'message',
          data,
          raw: event
        })
      } catch (error) {
        console.error('[SSE] Failed to parse message:', error)
        callback({
          type: 'raw',
          data: event.data,
          raw: event
        })
      }
    }

    // 监听自定义事件
    if (options.events) {
      const eventListeners = new Map()
      
      for (const [eventName, handler] of Object.entries(options.events)) {
        const listener = (event) => {
          try {
            const data = JSON.parse(event.data)
            handler({
              type: eventName,
              data,
              raw: event
            })
          } catch (error) {
            handler({
              type: eventName,
              data: event.data,
              raw: event
            })
          }
        }
        
        eventSource.addEventListener(eventName, listener)
        eventListeners.set(eventName, listener)
      }
      
      listeners.value.set(url, eventListeners)
    }

    return eventSource
  }

  // 取消订阅
  const unsubscribe = (url) => {
    const eventSource = eventSources.value.get(url)
    if (eventSource) {
      // 移除自定义事件监听器
      const eventListeners = listeners.value.get(url)
      if (eventListeners) {
        for (const [eventName, listener] of eventListeners) {
          eventSource.removeEventListener(eventName, listener)
        }
        listeners.value.delete(url)
      }
      
      // 关闭连接
      eventSource.close()
      eventSources.value.delete(url)
      console.log(`[SSE] Disconnected from ${url}`)
    }
  }

  // 取消所有订阅
  const unsubscribeAll = () => {
    for (const url of eventSources.value.keys()) {
      unsubscribe(url)
    }
  }

  // 组件卸载时清理
  onUnmounted(() => {
    unsubscribeAll()
  })

  return {
    subscribe,
    unsubscribe,
    unsubscribeAll
  }
}

// 全局SSE管理器（单例）
let globalSSEManager = null

export function useGlobalSSE() {
  if (!globalSSEManager) {
    const eventSources = new Map()
    const listeners = new Map()
    const callbacks = new Map()

    globalSSEManager = {
      subscribe(url, callback, options = {}) {
        // 如果已经有连接，添加回调
        if (eventSources.has(url)) {
          const callbackList = callbacks.get(url) || []
          callbackList.push(callback)
          callbacks.set(url, callbackList)
          return eventSources.get(url)
        }

        // 创建新连接
        const eventSource = new EventSource(url)
        eventSources.set(url, eventSource)
        callbacks.set(url, [callback])

        // 连接打开
        eventSource.onopen = (event) => {
          console.log(`[Global SSE] Connected to ${url}`)
        }

        // 错误处理
        eventSource.onerror = (error) => {
          console.error(`[Global SSE] Error on ${url}:`, error)
          
          // 自动重连
          if (options.reconnect !== false) {
            setTimeout(() => {
              console.log(`[Global SSE] Reconnecting to ${url}...`)
              this.unsubscribe(url)
              this.subscribe(url, callback, options)
            }, options.reconnectDelay || 5000)
          }
        }

        // 消息处理
        eventSource.onmessage = (event) => {
          const callbackList = callbacks.get(url) || []
          for (const cb of callbackList) {
            try {
              const data = JSON.parse(event.data)
              cb({
                type: event.type || 'message',
                data,
                raw: event
              })
            } catch (error) {
              cb({
                type: 'raw',
                data: event.data,
                raw: event
              })
            }
          }
        }

        // 自定义事件
        if (options.events) {
          const eventListeners = new Map()
          
          for (const [eventName, handler] of Object.entries(options.events)) {
            const listener = (event) => {
              try {
                const data = JSON.parse(event.data)
                handler({
                  type: eventName,
                  data,
                  raw: event
                })
              } catch (error) {
                handler({
                  type: eventName,
                  data: event.data,
                  raw: event
                })
              }
            }
            
            eventSource.addEventListener(eventName, listener)
            eventListeners.set(eventName, listener)
          }
          
          listeners.set(url, eventListeners)
        }

        return eventSource
      },

      unsubscribe(url, callback) {
        if (callback) {
          // 只移除特定回调
          const callbackList = callbacks.get(url) || []
          const index = callbackList.indexOf(callback)
          if (index > -1) {
            callbackList.splice(index, 1)
          }
          
          // 如果没有回调了，关闭连接
          if (callbackList.length === 0) {
            this.close(url)
          }
        } else {
          // 关闭整个连接
          this.close(url)
        }
      },

      close(url) {
        const eventSource = eventSources.get(url)
        if (eventSource) {
          // 移除事件监听器
          const eventListeners = listeners.get(url)
          if (eventListeners) {
            for (const [eventName, listener] of eventListeners) {
              eventSource.removeEventListener(eventName, listener)
            }
            listeners.delete(url)
          }
          
          // 关闭连接
          eventSource.close()
          eventSources.delete(url)
          callbacks.delete(url)
          console.log(`[Global SSE] Disconnected from ${url}`)
        }
      },

      closeAll() {
        for (const url of eventSources.keys()) {
          this.close(url)
        }
      }
    }
  }

  return globalSSEManager
}