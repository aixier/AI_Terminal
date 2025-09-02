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
    // 检查是否已存在
    if (this.terminals.has(apiId)) {
      console.log(`[ApiTerminalService] Reusing existing session: ${apiId}`)
      return this.terminals.get(apiId)
    }
    
    console.log(`[ApiTerminalService] Creating new terminal session: ${apiId}`)
    
    try {
      // 创建终端实例（与前端完全相同的环境）
      const terminalId = `api_${apiId}`
      const ptyEnv = {
        ...process.env,
        ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN || "cr_54e6cbbcdc5711993b81e314ea6e470facb2b11b88d3c79b1be63619387199e3",
        ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL || "http://44.212.20.73:3000/api/"
      }
      
      const pty = terminalManager.create(terminalId, {
        cols: 120,
        rows: 30,
        env: ptyEnv
      })
      
      // 打印环境变量值
      console.log(`[ApiTerminalService] Terminal env - AUTH_TOKEN: ${ptyEnv.ANTHROPIC_AUTH_TOKEN?.substring(0, 20)}...`)
      console.log(`[ApiTerminalService] Terminal env - BASE_URL: ${ptyEnv.ANTHROPIC_BASE_URL}`)
      
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
        
        // 输出事件已发射，不需要额外日志
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
      
      console.log(`[ApiTerminalService] Session created: ${terminalId}`)
      return terminalInfo
      
    } catch (error) {
      console.error(`[ApiTerminalService] Failed to create terminal session:`, error)
      throw error
    }
  }

  /**
   * 执行Claude命令 - 使用环境变量直接执行
   */
  async executeClaude(apiId, prompt) {
    const terminal = await this.createTerminalSession(apiId)
    
    console.log(`[ApiTerminalService] Executing Claude: ${apiId}`)
    
    // 验证环境变量（调试用）
    const currentAuthToken = process.env.ANTHROPIC_AUTH_TOKEN || "cr_54e6cbbcdc5711993b81e314ea6e470facb2b11b88d3c79b1be63619387199e3"
    const currentBaseUrl = process.env.ANTHROPIC_BASE_URL || "http://44.212.20.73:3000/api/"
    console.log(`[ApiTerminalService] Current env - TOKEN: ${currentAuthToken.substring(0, 20)}..., URL: ${currentBaseUrl}`)
    
    // ========== MOCK PROMPT FOR TESTING ==========
    // 取消注释下面的代码来使用mock prompt进行测试
    // 这会在指定目录生成一个测试HTML文件
    /*
    // 选项1: 简单测试 - 在default用户的card目录生成
    const mockPrompt = `请创建一个简单的Hello World HTML页面，要求：
1. 文件名为：hello_test_${Date.now()}.html
2. 保存路径：/mnt/d/work/AI_Terminal/terminal-backend/data/users/default/workspace/card/
3. 页面内容包含：
   - 标题：Hello World Test
   - 一个居中的大标题显示"Hello from API Terminal Service"
   - 当前时间：${new Date().toLocaleString('zh-CN')}
   - 背景渐变色从蓝到紫
   - 添加一些简单的CSS动画效果
4. 请直接生成并保存文件，不需要其他操作

注意：这是一个测试prompt，用于验证API Terminal Service是否正常工作。`;
    */
    
    
    // 选项2: 复杂测试 - 带图片的HTML页面（用于测试base64嵌入）
    const timestamp = Date.now();
    const folderPath = `/mnt/d/work/AI_Terminal/terminal-backend/data/users/default/workspace/card/test_${timestamp}`;
    const mockPrompt = `请创建一个带图片的HTML展示页面：
1. 先创建文件夹：${folderPath}
2. 在文件夹中生成主HTML文件：index.html
3. 页面内容：
   - 标题：图片展示测试页面
   - 包含一个SVG图形（内联在HTML中）
   - 添加一些装饰性的CSS图案
   - 时间戳：${new Date().toISOString()}
4. 使用现代化的设计风格，添加阴影和圆角
5. 请确保所有内容都内嵌在HTML中

这是用于测试自定义模板异步处理的mock prompt。`;
    
    
    // 如果启用了mock，取消下面这行的注释
    // console.log('[ApiTerminalService] ⚠️ Using MOCK prompt for testing!');
    // prompt = mockPrompt;
    
    // ========== END MOCK PROMPT ==========
    
    // 简化的命令执行方式 - Claude会自动使用环境变量中的ANTHROPIC_AUTH_TOKEN
    // 注意：不转义内部的双引号，只转义外层的
    // 将内部双引号替换为单引号，避免冲突
    const processedForShell = prompt.replace(/"/g, "'")
    // 始终使用 --dangerously-skip-permissions（假设使用非root用户）
    const command = `claude --dangerously-skip-permissions -p "${processedForShell}"`
    
    // 调试时可取消注释查看完整提示词
    console.log(`[ApiTerminalService] Command: ${command}`)
    
    // 分开发送命令和回车，确保命令完整
    terminal.pty.write(command)
    await this.delay(100)  // 短暂延迟确保命令完整发送
    terminal.pty.write('\r')  // 发送回车执行命令
    
    terminal.lastActivity = Date.now()
    return true
  }

  /**
   * 获取终端会话的最后输出
   */
  async getLastOutput(apiId) {
    const terminal = this.terminals.get(apiId)
    if (!terminal) {
      // console.warn(`[ApiTerminalService] No terminal found for API: ${apiId}`)
      return ''
    }
    
    const outputBuffer = this.outputBuffers.get(apiId) || []
    
    // 获取最后的有意义输出（过滤掉控制字符和提示符）
    const lastOutput = outputBuffer
      .join('')
      .split('\n')
      .filter(line => {
        // 过滤掉空行、提示符和控制字符
        const cleanLine = line.replace(/\[.*?\]/g, '').trim()
        return cleanLine && 
               !cleanLine.startsWith('$') && 
               !cleanLine.startsWith('>') &&
               !cleanLine.includes('claude --dangerously-skip-permissions')
      })
      .slice(-10) // 取最后10行
      .join('\n')
      .trim()
    
    return lastOutput
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
   * 销毁终端会话
   */
  destroySession(apiId) {
    const terminal = this.terminals.get(apiId)
    if (terminal) {
      // 注意：node-pty 的 onData 不提供移除监听器的方法
      // 直接销毁终端即可，监听器会自动清理
      
      // 销毁终端
      if (terminal.pty) {
        try {
          terminal.pty.kill()
        } catch (error) {
          console.error(`[ApiTerminalService] Error killing terminal ${apiId}:`, error)
        }
      }
      
      // 删除记录
      this.terminals.delete(apiId)
      this.outputBuffers.delete(apiId)
      
      console.log(`[ApiTerminalService] Session destroyed: ${apiId}`)
    }
  }

  /**
   * 清理过期会话
   */
  cleanupExpiredSessions(maxAge = 1200000) { // 20分钟
    const now = Date.now()
    for (const [apiId, terminal] of this.terminals) {
      if (now - terminal.lastActivity > maxAge) {
        console.log(`[ApiTerminalService] Expired session cleaned: ${apiId}`)
        this.destroySession(apiId)
      }
    }
  }
}

export default new ApiTerminalService()