import websocketService from './websocket'
import { useTerminalStore } from '../store/terminal'

class SharedTerminalService {
  constructor() {
    this.sessionId = null
    this.isInitialized = false
    this.isInitializing = false // 添加正在初始化标志
    this.listenersSetup = false // 添加监听器是否已设置标志
    this.terminalCreated = false // 标记终端是否已在后端创建
    this.commandQueue = []
    this.outputBuffer = []
    this.eventHandlers = new Map()
  }

  // 初始化共享终端会话
  async initialize() {
    if (this.isInitialized) {
      console.log('[SharedTerminal] Already initialized with session:', this.sessionId)
      return this.sessionId
    }
    
    // 如果正在初始化，等待完成
    if (this.isInitializing) {
      console.log('[SharedTerminal] Already initializing, waiting...')
      // 等待初始化完成
      while (this.isInitializing && !this.isInitialized) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      return this.sessionId
    }
    
    this.isInitializing = true

    // 连接WebSocket
    if (!websocketService.connected) {
      websocketService.connect()
      
      // 等待连接建立
      await new Promise((resolve) => {
        const checkConnection = setInterval(() => {
          if (websocketService.connected) {
            clearInterval(checkConnection)
            resolve()
          }
        }, 100)
        
        // 10秒超时
        setTimeout(() => {
          clearInterval(checkConnection)
          resolve()
        }, 10000)
      })
    }
    
    // 只在第一次创建终端会话
    if (!this.terminalCreated) {
      try {
        const response = await websocketService.createTerminal({
          cols: 120,
          rows: 30
        })
        
        this.sessionId = response.sessionId
        this.terminalCreated = true // 标记终端已创建
        console.log('[SharedTerminal] Terminal session created:', this.sessionId)
      } catch (error) {
        // 如果会话已存在，这是正常的，直接使用现有会话
        if (error.message && error.message.includes('already exists')) {
          this.sessionId = websocketService.socket?.id
          this.terminalCreated = true // 标记终端已存在
          console.log('[SharedTerminal] Using existing session:', this.sessionId)
        } else {
          this.isInitializing = false
          throw error
        }
      }
    } else {
      // 如果终端已创建，直接使用现有会话ID
      this.sessionId = this.sessionId || websocketService.socket?.id
      console.log('[SharedTerminal] Reusing terminal session:', this.sessionId)
    }
    
    this.isInitialized = true
    this.isInitializing = false
    
    // 只在第一次设置监听器
    if (!this.listenersSetup) {
      // 设置输出监听器，保存到缓冲区
      const outputListener = (data) => {
        console.log('[SharedTerminal] Received output:', data ? data.substring(0, 100) : 'empty')
        
        this.outputBuffer.push({
          type: 'output',
          data,
          timestamp: Date.now()
        })
        
        // 触发自定义事件处理器
        this.emit('output', data)
        
        // 保存到store
        const terminalStore = useTerminalStore()
        terminalStore.addOutputLog({
          type: 'output',
          data
        })
      }
      
      // 移除旧监听器，避免重复
      websocketService.off('terminal:output')
      websocketService.on('terminal:output', outputListener)
    
      const errorListener = (data) => {
        console.log('[SharedTerminal] Received error:', data)
        
        this.outputBuffer.push({
          type: 'error',
          data: data.message || data.error || data,
          timestamp: Date.now()
        })
        
        this.emit('error', data)
      }
      
      websocketService.off('terminal:error')
      websocketService.on('terminal:error', errorListener)
      
      const exitListener = (data) => {
        console.log('[SharedTerminal] Terminal exit:', data)
        
        this.outputBuffer.push({
          type: 'exit',
          data: `Terminal exited with code ${data.exitCode}`,
          timestamp: Date.now()
        })
        
        this.emit('exit', data)
      }
      
      websocketService.off('terminal:exit')
      websocketService.on('terminal:exit', exitListener)
      
      this.listenersSetup = true
    }
    
    return this.sessionId
  }
  
  // 发送命令到终端
  async sendCommand(command) {
    if (!this.isInitialized) {
      await this.initialize()
    }
    
    console.log('[SharedTerminal] Sending command:', command)
    
    // 记录命令
    this.commandQueue.push({
      command,
      timestamp: Date.now()
    })
    
    // 发送命令
    websocketService.sendInput(command)
  }
  
  // 等待特定输出出现
  async waitForOutput(pattern, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now()
      
      // 检查现有缓冲区
      const checkExisting = () => {
        for (const item of this.outputBuffer) {
          if (item.type === 'output' && item.data) {
            const content = typeof item.data === 'string' ? item.data : JSON.stringify(item.data)
            if (pattern instanceof RegExp ? pattern.test(content) : content.includes(pattern)) {
              resolve(true)
              return true
            }
          }
        }
        return false
      }
      
      // 如果已存在，立即返回
      if (checkExisting()) return
      
      // 监听新输出
      const handler = (data) => {
        const content = typeof data === 'string' ? data : JSON.stringify(data)
        if (pattern instanceof RegExp ? pattern.test(content) : content.includes(pattern)) {
          this.off('output', handler)
          resolve(true)
        } else if (Date.now() - startTime > timeout) {
          this.off('output', handler)
          reject(new Error(`Timeout waiting for pattern: ${pattern}`))
        }
      }
      
      this.on('output', handler)
      
      // 设置超时
      setTimeout(() => {
        this.off('output', handler)
        reject(new Error(`Timeout waiting for pattern: ${pattern}`))
      }, timeout)
    })
  }
  
  // 获取输出缓冲
  getOutputBuffer() {
    return [...this.outputBuffer]
  }
  
  // 清空输出缓冲
  clearOutputBuffer() {
    this.outputBuffer = []
  }
  
  // 获取命令队列
  getCommandQueue() {
    return [...this.commandQueue]
  }
  
  // 事件处理
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, [])
    }
    this.eventHandlers.get(event).push(handler)
  }
  
  off(event, handler) {
    if (this.eventHandlers.has(event)) {
      const handlers = this.eventHandlers.get(event)
      const index = handlers.indexOf(handler)
      if (index > -1) {
        handlers.splice(index, 1)
      }
    }
  }
  
  emit(event, data) {
    if (this.eventHandlers.has(event)) {
      const handlers = this.eventHandlers.get(event)
      console.log(`[SharedTerminal] Emitting ${event} to ${handlers.length} handlers`)
      handlers.forEach(handler => {
        try {
          handler(data)
        } catch (err) {
          console.error(`[SharedTerminal] Error in ${event} handler:`, err)
        }
      })
    } else {
      console.log(`[SharedTerminal] No handlers for event: ${event}`)
    }
  }
  
  // 检查是否已初始化
  isReady() {
    return this.isInitialized
  }
  
  // 获取会话ID
  getSessionId() {
    return this.sessionId
  }
  
  // 销毁会话
  destroy() {
    this.sessionId = null
    this.isInitialized = false
    this.isInitializing = false
    this.listenersSetup = false
    this.terminalCreated = false // 重置终端创建标志
    this.commandQueue = []
    this.outputBuffer = []
    this.eventHandlers.clear()
    
    // 清理WebSocket监听器
    websocketService.off('terminal:output')
    websocketService.off('terminal:error')
    websocketService.off('terminal:exit')
  }
}

export default new SharedTerminalService()