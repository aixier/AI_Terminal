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
   * 初始化Claude - 完整流程处理
   */
  async initializeClaude(apiId) {
    const terminal = await this.createTerminalSession(apiId)
    
    console.log(`[ApiTerminalService] Initializing Claude for API: ${apiId}`)
    
    // 步骤1: 发送claude --dangerously-skip-permissions
    console.log(`[ApiTerminalService] Step 1: Sending claude command...`)
    terminal.pty.write('claude --dangerously-skip-permissions\r')
    
    // 等待响应
    await this.delay(2000)
    
    // 步骤2: 检查是否出现主题选择界面
    let outputBuffer = this.outputBuffers.get(apiId) || []
    let fullOutput = outputBuffer.map(o => o.data).join('')
    
    if (fullOutput.includes('Choose the text style that looks best with your terminal')) {
      console.log(`[ApiTerminalService] Step 2: Theme selection detected, selecting option 1 (Dark mode)...`)
      // 选择主题1并确认
      terminal.pty.write('1')
      await this.delay(500)
      terminal.pty.write('\r')
      await this.delay(2000) // 等待主题选择完成
      
      // 检查是否出现安全提示
      outputBuffer = this.outputBuffers.get(apiId) || []
      fullOutput = outputBuffer.map(o => o.data).join('')
      
      if (fullOutput.includes('Press Enter to continue')) {
        // 有安全提示，按回车继续
        console.log(`[ApiTerminalService] Step 3: Security notes detected, pressing Enter to continue...`)
        terminal.pty.write('\r')
        await this.delay(1000)
      }
      
      // 现在应该出现危险模式确认
      outputBuffer = this.outputBuffers.get(apiId) || []
      fullOutput = outputBuffer.map(o => o.data).join('')
      
      if (fullOutput.includes('Yes, I accept') || fullOutput.includes('Bypass Permissions mode')) {
        console.log(`[ApiTerminalService] Step 4: Bypass permissions confirmation detected...`)
        console.log(`[ApiTerminalService] Step 5: Selecting option 2 (Yes, I accept)...`)
        terminal.pty.write('2')
        await this.delay(500)
        terminal.pty.write('\r')
        await this.delay(2000)
      }
      
    } else if (fullOutput.includes('Yes, I accept') || fullOutput.includes('Bypass Permissions mode')) {
      // 直接进入了危险模式确认（没有主题选择）
      console.log(`[ApiTerminalService] Bypass mode confirmation detected, selecting option 2...`)
      terminal.pty.write('2')
      await this.delay(500)
      terminal.pty.write('\r')
      await this.delay(1000)
    } else if (fullOutput.includes('bypass permissions on') || fullOutput.includes('Tips for getting started')) {
      // Claude已经配置好了，直接进入了交互模式
      console.log(`[ApiTerminalService] Claude already configured, ready for commands...`)
      // 不需要额外操作，Claude已经准备好了
    }
    
    // 步骤7: 等待Claude命令提示符
    console.log(`[ApiTerminalService] Step 7: Waiting for Claude command prompt...`)
    const promptReady = await this.waitForPrompt(apiId, 10000)
    
    if (!promptReady) {
      // 如果没有检测到提示符，可能Claude已经在等待输入了
      // 再次检查输出
      outputBuffer = this.outputBuffers.get(apiId) || []
      fullOutput = outputBuffer.map(o => o.data).join('')
      
      if (fullOutput.includes('bypass permissions on') || fullOutput.includes('Tips for getting started')) {
        // Claude确实已经准备好了，只是提示符格式不同
        console.log(`[ApiTerminalService] Claude is ready (bypass permissions mode)`)
        return true
      }
      
      throw new Error('Claude failed to initialize - no prompt detected')
    }
    
    // 更新活动时间
    terminal.lastActivity = Date.now()
    
    console.log(`[ApiTerminalService] ✅ Claude fully initialized and ready for API: ${apiId}`)
    return true
  }

  /**
   * 发送命令到Claude (与前端sendTextAndControl完全一致)
   */
  async sendTextAndControl(apiId, text, control = '\r', delay = 100) {
    const terminal = this.terminals.get(apiId)
    if (!terminal) {
      throw new Error(`Terminal session not found for API: ${apiId}`)
    }
    
    console.log(`[ApiTerminalService] Sending text to ${apiId}:`, text.substring(0, 100))
    
    // 发送文本
    terminal.pty.write(text)
    
    // 短暂延迟后发送控制字符（100ms足够了，因为Claude已经准备好）
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
  async waitForCompletion(apiId, timeout = 180000) { // 默认3分钟
    console.log(`[ApiTerminalService] Waiting for completion: ${apiId} (timeout: ${timeout/1000}s)`)
    
    return new Promise((resolve) => {
      const startTime = Date.now()
      const checkInterval = setInterval(() => {
        // 检查是否超时
        if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval)
          console.log(`[ApiTerminalService] Completion timeout for ${apiId} after ${timeout/1000}s`)
          resolve(this.getOutput(apiId))
        }
      }, 1000)
      
      // 使用传入的timeout时间自动完成
      setTimeout(() => {
        clearInterval(checkInterval)
        console.log(`[ApiTerminalService] Auto completion after ${timeout/1000}s: ${apiId}`)
        resolve(this.getOutput(apiId))
      }, timeout)
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
   * 等待特定文本出现
   */
  async waitForText(apiId, text, timeout = 10000) {
    const startTime = Date.now()
    
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const outputBuffer = this.outputBuffers.get(apiId) || []
        const fullOutput = outputBuffer.map(o => o.data).join('')
        
        if (fullOutput.includes(text)) {
          console.log(`[ApiTerminalService] Text "${text}" detected for ${apiId}`)
          clearInterval(checkInterval)
          resolve(true)
        } else if (Date.now() - startTime > timeout) {
          console.log(`[ApiTerminalService] Timeout waiting for text "${text}" for ${apiId}`)
          clearInterval(checkInterval)
          resolve(false)
        }
      }, 500)
    })
  }
  
  /**
   * 等待Claude提示符出现
   */
  async waitForPrompt(apiId, timeout = 10000) {
    const startTime = Date.now()
    
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const outputBuffer = this.outputBuffers.get(apiId) || []
        const recentOutput = outputBuffer.slice(-5).map(o => o.data).join('')
        
        // 检查是否出现了Claude的命令提示符（> 符号）
        if (recentOutput.includes('> ') || recentOutput.includes('│\u001b[39m\u001b[22m > ') || recentOutput.includes('> \u001b[7m')) {
          console.log(`[ApiTerminalService] Claude prompt detected for ${apiId}`)
          clearInterval(checkInterval)
          resolve(true)
        } else if (Date.now() - startTime > timeout) {
          console.log(`[ApiTerminalService] Timeout waiting for prompt for ${apiId}`)
          clearInterval(checkInterval)
          resolve(false)
        }
      }, 500)
    })
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