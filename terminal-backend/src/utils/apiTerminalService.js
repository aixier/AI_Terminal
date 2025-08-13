/**
 * API Terminal Service - 为API提供统一的终端服务
 * 最佳实践：复用现有的WebSocket终端基础设施
 */

import terminalManager from '../services/terminalManager.js'
import claudeInitService from '../services/claudeInitializationService.js'
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
   * 初始化Claude - 使用统一的初始化服务
   */
  async initializeClaude(apiId) {
    const terminal = await this.createTerminalSession(apiId)
    const outputBuffer = this.outputBuffers.get(apiId) || []
    
    console.log(`[ApiTerminalService] Initializing Claude for API: ${apiId}`)
    
    // 使用统一的Claude初始化服务
    const success = await claudeInitService.initializeClaude(
      terminal, 
      outputBuffer, 
      { 
        verbose: true,
        timeout: 30000 
      }
    )
    
    if (success) {
      console.log(`[ApiTerminalService] ✅ Claude initialized successfully for ${apiId}`)
      terminal.lastActivity = Date.now()
      return true
    } else {
      throw new Error('Claude initialization failed')
    }
  }

  /**
   * 初始化Claude - 旧版本（已废弃，保留作为备份）
   */
  async initializeClaudeOld(apiId) {
    const terminal = await this.createTerminalSession(apiId)
    
    console.log(`[ApiTerminalService] Initializing Claude for API: ${apiId}`)
    
    // 清空之前的输出缓冲
    this.outputBuffers.set(apiId, [])
    
    // 步骤1: 发送claude --dangerously-skip-permissions
    console.log(`[ApiTerminalService] Step 1: Sending claude command...`)
    terminal.pty.write('claude --dangerously-skip-permissions\r')
    
    // 等待Claude启动（增加等待时间）
    await this.delay(3000)
    
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
    const promptReady = await this.waitForPrompt(apiId, 15000) // 增加等待时间到15秒
    
    if (!promptReady) {
      // 如果没有检测到提示符，可能Claude已经在等待输入了
      // 再次检查输出
      outputBuffer = this.outputBuffers.get(apiId) || []
      fullOutput = outputBuffer.map(o => o.data).join('')
      
      console.log(`[ApiTerminalService] No standard prompt detected, checking output for readiness indicators...`)
      console.log(`[ApiTerminalService] Output length: ${fullOutput.length} chars`)
      console.log(`[ApiTerminalService] Last 500 chars:`, fullOutput.slice(-500))
      
      // 更宽松的检查条件
      if (fullOutput.includes('bypass permissions on') || 
          fullOutput.includes('Tips for getting started') ||
          fullOutput.includes('Human:') || 
          fullOutput.includes('What would you like') ||
          fullOutput.includes('How can I help') ||
          fullOutput.includes('Type your message')) {
        // Claude可能已经准备好了，只是提示符格式不同
        console.log(`[ApiTerminalService] Claude appears to be ready (alternative detection)`)
        // 额外等待一下确保完全准备好
        await this.delay(2000)
        return true
      }
      
      console.warn(`[ApiTerminalService] Claude initialization unclear, waiting additional time...`)
      // 额外等待5秒再继续
      await this.delay(5000)
      return true
    }
    
    // 即使检测到提示符，也要确保Claude完全准备好
    console.log(`[ApiTerminalService] Prompt detected, waiting for Claude to stabilize...`)
    await this.delay(2000)
    
    // 更新活动时间
    terminal.lastActivity = Date.now()
    
    console.log(`[ApiTerminalService] ✅ Claude fully initialized and ready for API: ${apiId}`)
    return true
  }

  /**
   * 发送命令到Claude (使用统一服务的方法)
   */
  async sendTextAndControl(apiId, text, control = '\r', delay = 100) {
    const terminal = this.terminals.get(apiId)
    if (!terminal) {
      throw new Error(`Terminal session not found for API: ${apiId}`)
    }
    
    // 使用统一服务的发送方法
    const result = await claudeInitService.sendTextAndControl(terminal, text, control, delay)
    
    // 更新活动时间
    terminal.lastActivity = Date.now()
    
    return result
  }

  /**
   * 等待命令执行完成
   */
  async waitForCompletion(apiId, timeout = 420000) { // 默认7分钟，适应cardplanet-Sandra模板
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
        const recentOutput = outputBuffer.slice(-10).map(o => o.data).join('')
        const fullOutput = outputBuffer.map(o => o.data).join('')
        
        // 更全面的提示符检测 - 但要确保Claude真正准备好了
        // 不能只检测欢迎信息，要等待真正的输入提示符
        const promptPatterns = [
          'Human:',               // Claude对话模式的输入提示
          'Human: ',
          '╭─ Human',            // 带框的Human提示
          '│ Human:',
          'claude>',              // 直接的claude提示符
          '│\u001b[39m\u001b[22m > ', // 带ANSI码的提示符
          '> \u001b[7m',          // 反色提示符
        ]
        
        // 检查是否真正到了输入提示阶段（不是欢迎信息）
        const hasRealPrompt = promptPatterns.some(pattern => recentOutput.includes(pattern))
        
        // 检查是否Claude已经完全启动（出现了关键提示文字）
        const isFullyReady = fullOutput.includes('What would you like to know') ||
                            fullOutput.includes('How can I help you today') ||
                            fullOutput.includes('Type your message') ||
                            fullOutput.includes('Human:') ||
                            fullOutput.includes('Ready') ||
                            (fullOutput.includes('Claude') && fullOutput.includes('──────────────────────────'))
        
        if (hasRealPrompt && isFullyReady) {
          console.log(`[ApiTerminalService] Claude fully ready with prompt for ${apiId}`)
          clearInterval(checkInterval)
          resolve(true)
        } else if (hasRealPrompt) {
          console.log(`[ApiTerminalService] Prompt detected but waiting for full initialization for ${apiId}`)
          // 继续等待
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