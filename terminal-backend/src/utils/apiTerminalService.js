/**
 * API Terminal Service - 为API提供统一的终端服务
 * 最佳实践：复用现有的WebSocket终端基础设施
 */

import terminalManager from '../services/terminalManager.js'
import { EventEmitter } from 'events'

class ApiTerminalService extends EventEmitter {
  constructor() {
    super()
    this.terminals = new Map() // apiId -> terminal info
    this.outputBuffers = new Map() // apiId -> output buffer
  }

  /**
   * 为API请求创建专用终端会话
   */
  async createTerminalSession(apiId) {
    console.log(`[ApiTerminalService] Creating terminal session for API: ${apiId}`)
    
    // 检查是否已存在
    if (this.terminals.has(apiId)) {
      console.log(`[ApiTerminalService] Reusing existing session: ${apiId}`)
      return this.terminals.get(apiId)
    }
    
    try {
      // 创建终端实例（与前端完全相同的环境）
      const terminalId = `api_${apiId}`
      const pty = terminalManager.create(terminalId, {
        cols: 120,
        rows: 30,
        env: {
          ...process.env,
          ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN,
          ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL
        }
      })
      
      // 创建输出缓冲区
      const outputBuffer = []
      this.outputBuffers.set(apiId, outputBuffer)
      
      // 监听输出（与前端socketHandler相同的处理方式）
      const dataHandler = (data) => {
        outputBuffer.push({
          data: data,
          timestamp: Date.now()
        })
        
        // 限制缓冲区大小
        if (outputBuffer.length > 1000) {
          outputBuffer.shift()
        }
        
        // 发射输出事件
        this.emit('output', { apiId, data })
        
        console.log(`[ApiTerminalService] ${apiId} output:`, data.substring(0, 100))
      }
      
      pty.onData(dataHandler)
      
      // 保存终端信息
      const terminalInfo = {
        id: terminalId,
        pty: pty,
        dataHandler: dataHandler,
        created: Date.now(),
        lastActivity: Date.now()
      }
      
      this.terminals.set(apiId, terminalInfo)
      
      console.log(`[ApiTerminalService] ✅ Terminal session created: ${terminalId}`)
      return terminalInfo
      
    } catch (error) {
      console.error(`[ApiTerminalService] Failed to create terminal session:`, error)
      throw error
    }
  }

  /**
   * 初始化Claude (与前端initializeClaude完全一致)
   */
  async initializeClaude(apiId) {
    const terminal = await this.createTerminalSession(apiId)
    
    console.log(`[ApiTerminalService] Initializing Claude for API: ${apiId}`)
    
    // 发送claude --dangerously-skip-permissions
    console.log(`[ApiTerminalService] Sending claude command...`)
    terminal.pty.write('claude --dangerously-skip-permissions\r')
    
    // 等待Claude启动（与前端一致的3秒等待）
    console.log(`[ApiTerminalService] Waiting 3 seconds for Claude to initialize...`)
    await this.delay(3000)
    
    // 发送回车激活Claude shell
    console.log(`[ApiTerminalService] Sending carriage return to activate Claude...`)
    terminal.pty.write('\r')
    
    // 更新活动时间
    terminal.lastActivity = Date.now()
    
    console.log(`[ApiTerminalService] ✅ Claude initialized for API: ${apiId}`)
    return true
  }

  /**
   * 发送命令到Claude (与前端sendTextAndControl完全一致)
   */
  async sendTextAndControl(apiId, text, control = '\r', delay = 1000) {
    const terminal = this.terminals.get(apiId)
    if (!terminal) {
      throw new Error(`Terminal session not found for API: ${apiId}`)
    }
    
    console.log(`[ApiTerminalService] Sending text to ${apiId}:`, text.substring(0, 100))
    
    // 发送文本
    terminal.pty.write(text)
    
    // 等待指定延迟后发送控制字符
    await this.delay(delay)
    
    console.log(`[ApiTerminalService] Sending control character to ${apiId}:`, JSON.stringify(control))
    terminal.pty.write(control)
    
    // 更新活动时间
    terminal.lastActivity = Date.now()
    
    return true
  }

  /**
   * 等待命令执行完成
   */
  async waitForCompletion(apiId, timeout = 60000) {
    console.log(`[ApiTerminalService] Waiting for completion: ${apiId}`)
    
    return new Promise((resolve) => {
      const startTime = Date.now()
      const checkInterval = setInterval(() => {
        // 检查是否超时
        if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval)
          console.log(`[ApiTerminalService] Completion timeout for ${apiId}`)
          resolve(this.getOutput(apiId))
        }
      }, 1000)
      
      // 30秒后自动完成（与原实现一致）
      setTimeout(() => {
        clearInterval(checkInterval)
        console.log(`[ApiTerminalService] Auto completion after 30s: ${apiId}`)
        resolve(this.getOutput(apiId))
      }, 30000)
    })
  }

  /**
   * 获取输出内容
   */
  getOutput(apiId) {
    const buffer = this.outputBuffers.get(apiId)
    if (!buffer) return ''
    
    return buffer.map(item => item.data).join('')
  }

  /**
   * 清理终端会话
   */
  async destroySession(apiId) {
    const terminal = this.terminals.get(apiId)
    if (!terminal) return
    
    console.log(`[ApiTerminalService] Destroying session: ${apiId}`)
    
    // 移除数据监听器
    if (terminal.dataHandler) {
      terminal.pty.removeListener('data', terminal.dataHandler)
    }
    
    // 销毁终端
    terminalManager.destroy(terminal.id)
    
    // 清理缓存
    this.terminals.delete(apiId)
    this.outputBuffers.delete(apiId)
    
    console.log(`[ApiTerminalService] ✅ Session destroyed: ${apiId}`)
  }

  /**
   * 延迟函数
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 获取所有活跃会话
   */
  getActiveSessions() {
    return Array.from(this.terminals.keys())
  }

  /**
   * 清理过期会话
   */
  cleanupExpiredSessions(maxAge = 300000) { // 5分钟
    const now = Date.now()
    for (const [apiId, terminal] of this.terminals) {
      if (now - terminal.lastActivity > maxAge) {
        console.log(`[ApiTerminalService] Cleaning up expired session: ${apiId}`)
        this.destroySession(apiId)
      }
    }
  }
}

export default new ApiTerminalService()