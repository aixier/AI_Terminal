/**
 * Claude Initialization Service
 * 统一的Claude初始化服务，提供标准化的初始化流程
 * 参考了前端StartupInitializer和后端apiTerminalService的最佳实践
 */

import { EventEmitter } from 'events'

class ClaudeInitializationService extends EventEmitter {
  constructor() {
    super()
    this.initializationCache = new Map() // 缓存已初始化的会话
  }

  /**
   * 初始化Claude的完整流程
   * @param {Object} terminal - 终端实例（包含pty）
   * @param {Array} outputBuffer - 输出缓冲区
   * @param {Object} options - 初始化选项
   * @returns {Promise<boolean>} 是否初始化成功
   */
  async initializeClaude(terminal, outputBuffer, options = {}) {
    const {
      timeout = 30000,        // 总超时时间（30秒）
      skipCache = false,      // 是否跳过缓存
      verbose = true          // 是否输出详细日志
    } = options

    const startTime = Date.now()
    const log = (msg) => {
      if (verbose) {
        console.log(`[ClaudeInit] ${msg}`)
        this.emit('log', { message: msg, timestamp: Date.now() })
      }
    }

    try {
      // 步骤1: 清空输出缓冲区
      log('Step 1: Clearing output buffer...')
      outputBuffer.length = 0

      // 步骤1.5: 确保Claude不在运行，先发送Ctrl+C退出可能存在的Claude会话
      log('Step 1.5: Ensuring clean state...')
      terminal.pty.write('\x03')  // Ctrl+C
      await this.delay(1000)
      terminal.pty.write('\x03')  // 再次Ctrl+C确保退出
      await this.delay(1000)
      
      // 清空缓冲区（清除上面操作的输出）
      outputBuffer.length = 0

      // 步骤2: 发送claude启动命令 - 确保命令完整发送
      log('Step 2: Sending claude command...')
      const claudeCommand = 'claude --dangerously-skip-permissions'
      terminal.pty.write(claudeCommand)
      await this.delay(100)  // 短暂延迟确保命令完整
      terminal.pty.write('\r')  // 发送回车执行命令
      
      // 等待Claude启动
      await this.delay(3000)
      
      // 步骤3: 处理初始化流程
      log('Step 3: Processing initialization sequence...')
      
      // 获取当前输出
      let fullOutput = this.getBufferContent(outputBuffer)
      log(`Current output length: ${fullOutput.length} chars`)
      
      // 处理主题选择（如果出现）
      if (fullOutput.includes('Choose the text style that looks best with your terminal')) {
        log('Theme selection detected, selecting option 1 (Dark mode)...')
        terminal.pty.write('1')
        await this.delay(500)
        terminal.pty.write('\r')
        await this.delay(2000)
        
        // 检查是否有安全提示
        fullOutput = this.getBufferContent(outputBuffer)
        if (fullOutput.includes('Press Enter to continue')) {
          log('Security notes detected, pressing Enter...')
          terminal.pty.write('\r')
          await this.delay(1000)
        }
        
        // 检查权限模式确认
        fullOutput = this.getBufferContent(outputBuffer)
        if (this.needsBypassConfirmation(fullOutput)) {
          log('Bypass permissions confirmation detected, selecting "Yes, I accept"...')
          terminal.pty.write('2')
          await this.delay(500)
          terminal.pty.write('\r')
          await this.delay(2000)
        }
      }
      // 可能直接进入权限模式确认
      else if (this.needsBypassConfirmation(fullOutput)) {
        log('Direct bypass mode confirmation detected...')
        terminal.pty.write('2')
        await this.delay(500)
        terminal.pty.write('\r')
        await this.delay(2000)
      }
      // Claude可能已经配置好了
      else if (this.isClaudeReady(fullOutput)) {
        log('Claude appears to be already configured')
      }
      
      // 步骤4: 等待Claude完全就绪
      log('Step 4: Waiting for Claude to be fully ready...')
      const isReady = await this.waitForClaudeReady(outputBuffer, timeout - (Date.now() - startTime))
      
      if (isReady) {
        log('✅ Claude initialization completed successfully!')
        
        // 额外等待确保稳定 - 与流式接口成功经验保持一致
        log('Waiting additional 5 seconds to ensure Claude is fully stable...')
        await this.delay(5000)
        
        // 再次验证Claude已准备好
        fullOutput = this.getBufferContent(outputBuffer)
        if (!this.isClaudeReady(fullOutput) && !this.hasClaudePrompt(fullOutput)) {
          log('Warning: Claude may not be fully ready after delay, proceeding anyway...')
        }
        
        this.emit('initialized', { 
          success: true, 
          duration: Date.now() - startTime 
        })
        return true
      } else {
        throw new Error('Claude failed to reach ready state within timeout')
      }
      
    } catch (error) {
      log(`❌ Claude initialization failed: ${error.message}`)
      this.emit('error', { 
        error: error.message, 
        duration: Date.now() - startTime 
      })
      return false
    }
  }

  /**
   * 等待Claude就绪
   */
  async waitForClaudeReady(outputBuffer, timeout = 15000) {
    const startTime = Date.now()
    let welcomeDetected = false
    let initPhaseComplete = false
    
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const fullOutput = this.getBufferContent(outputBuffer)
        const recentOutput = outputBuffer.slice(-10).map(o => o.data || '').join('')
        
        // 首先检测欢迎信息（这不是就绪状态！）
        if (!welcomeDetected && fullOutput.includes('Welcome to Claude')) {
          console.log('[ClaudeInit] Welcome message detected, but NOT ready yet - waiting for initialization to complete...')
          welcomeDetected = true
          // 等待一段时间让初始化完成
          setTimeout(() => {
            initPhaseComplete = true
            console.log('[ClaudeInit] Init phase timer complete, now checking for readiness...')
          }, 2000)
          return
        }
        
        // 真正的就绪检查 - 必须在欢迎信息之后且初始化阶段完成
        const hasRealPrompt = this.hasClaudePrompt(recentOutput)
        const isFullyReady = this.isClaudeReady(fullOutput)
        
        // 必须同时满足：有提示符 + 有就绪标志 + 初始化阶段已完成
        if (welcomeDetected && initPhaseComplete && (hasRealPrompt || isFullyReady)) {
          console.log('[ClaudeInit] Claude is TRULY ready (welcome complete + init phase done + ready indicators)')
          clearInterval(checkInterval)
          resolve(true)
        } else if (!welcomeDetected && isFullyReady && hasRealPrompt) {
          // 可能是已经配置好的Claude，直接就绪
          console.log('[ClaudeInit] Claude appears to be pre-configured and ready')
          clearInterval(checkInterval)
          resolve(true)
        }
        
        // 检查超时
        if (Date.now() - startTime > timeout) {
          console.log('[ClaudeInit] Timeout waiting for Claude ready state')
          clearInterval(checkInterval)
          
          // 如果有足够的输出且有Claude标识，可能已经准备好了
          if (fullOutput.length > 500 && (fullOutput.includes('bypass permissions on') || hasRealPrompt)) {
            console.log('[ClaudeInit] Assuming ready based on output content and indicators')
            resolve(true)
          } else {
            resolve(false)
          }
        }
      }, 500)
    })
  }

  /**
   * 检查是否需要确认bypass模式
   */
  needsBypassConfirmation(output) {
    return output.includes('Yes, I accept') || 
           output.includes('Bypass Permissions mode') ||
           output.includes('bypass permissions mode')
  }

  /**
   * 检查Claude是否就绪
   */
  isClaudeReady(output) {
    const readyIndicators = [
      'bypass permissions on',
      'Tips for getting started',
      'What would you like to know',
      'How can I help you today',
      'Type your message',
      'Human:',
      'Assistant:',
      'Ready'
    ]
    
    return readyIndicators.some(indicator => output.includes(indicator))
  }

  /**
   * 检查是否有Claude提示符
   */
  hasClaudePrompt(output) {
    const promptPatterns = [
      'Human:',
      'Human: ',
      '╭─ Human',
      '│ Human:',
      'claude>',
      '╭─',
      '│ >',
      '> ',
      '▌'
    ]
    
    return promptPatterns.some(pattern => output.includes(pattern))
  }

  /**
   * 获取缓冲区内容
   */
  getBufferContent(outputBuffer) {
    if (!outputBuffer || !Array.isArray(outputBuffer)) {
      return ''
    }
    return outputBuffer.map(item => {
      if (typeof item === 'string') return item
      if (item && item.data) return item.data
      return ''
    }).join('')
  }

  /**
   * 延迟函数
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 发送文本和控制字符
   */
  async sendTextAndControl(terminal, text, control = '\r', delayMs = 100) {
    console.log(`[ClaudeInit] Sending text: ${text.substring(0, 100)}...`)
    terminal.pty.write(text)
    
    await this.delay(delayMs)
    
    console.log(`[ClaudeInit] Sending control character: ${JSON.stringify(control)}`)
    terminal.pty.write(control)
    
    return true
  }
}

// 导出单例
export default new ClaudeInitializationService()