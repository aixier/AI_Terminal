/**
 * Claude Executor Direct Service - 使用子进程直接执行
 * 避免 PTY 环境的兼容性问题
 */

import { spawn } from 'child_process'

class ClaudeExecutorDirectService {
  /**
   * 直接执行 Claude 命令（不通过 PTY）
   */
  async executePrompt(prompt, timeout = 30000, purpose = 'general') {
    const startTime = Date.now()
    
    console.log(`\n[ClaudeExecutorDirect] ==================== START ====================`)
    console.log(`[ClaudeExecutorDirect] Purpose: ${purpose}`)
    console.log(`[ClaudeExecutorDirect] Timeout: ${timeout}ms`)
    console.log(`[ClaudeExecutorDirect] Prompt: ${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}`)
    console.log(`[ClaudeExecutorDirect] ==============================================`)
    
    return new Promise((resolve) => {
      let output = ''
      let errorOutput = ''
      let processExited = false
      
      // 使用经过测试验证的 echo pipe 方法
      // 测试证明这种方式在容器中 100% 成功
      const escapedPrompt = prompt.replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/`/g, '\\`')
      const command = `echo "${escapedPrompt}" | claude --dangerously-skip-permissions`
      
      console.log(`[ClaudeExecutorDirect] Using echo pipe method`)
      console.log(`[ClaudeExecutorDirect] Command: sh -c "${command.substring(0, 100)}..."`)
      console.log(`[ClaudeExecutorDirect] Auth token present:`, !!process.env.ANTHROPIC_AUTH_TOKEN)
      
      const child = spawn('sh', ['-c', command], {
        env: {
          ...process.env,
          ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN,
          ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL,
          PATH: process.env.PATH,
          HOME: process.env.HOME || '/home/node'
        },
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd()
      })
      
      console.log(`[ClaudeExecutorDirect] Process spawned with PID:`, child.pid)
      
      // 收集标准输出
      child.stdout.on('data', (data) => {
        output += data.toString()
        console.log(`[ClaudeExecutorDirect] Output chunk: ${data.toString().substring(0, 100)}`)
      })
      
      // 收集错误输出
      child.stderr.on('data', (data) => {
        errorOutput += data.toString()
        console.log(`[ClaudeExecutorDirect] Error: ${data.toString()}`)
      })
      
      // 处理进程退出
      child.on('exit', (code) => {
        processExited = true
        const executionTime = Date.now() - startTime
        
        if (code === 0 && output) {
          console.log(`[ClaudeExecutorDirect] ==================== SUCCESS ====================`)
          console.log(`[ClaudeExecutorDirect] Execution time: ${executionTime}ms`)
          console.log(`[ClaudeExecutorDirect] Output length: ${output.length} bytes`)
          console.log(`[ClaudeExecutorDirect] Output: ${output.substring(0, 200)}${output.length > 200 ? '...' : ''}`)
          console.log(`[ClaudeExecutorDirect] =================================================\n`)
          
          resolve({
            success: true,
            output: output.trim(),
            executionTime: executionTime
          })
        } else {
          console.log(`[ClaudeExecutorDirect] ==================== FAILED ====================`)
          console.log(`[ClaudeExecutorDirect] Exit code: ${code}`)
          console.log(`[ClaudeExecutorDirect] Error: ${errorOutput}`)
          console.log(`[ClaudeExecutorDirect] ================================================\n`)
          
          resolve({
            success: false,
            output: '',
            executionTime: executionTime,
            error: errorOutput || `Process exited with code ${code}`
          })
        }
      })
      
      // 处理错误
      child.on('error', (error) => {
        if (!processExited) {
          const executionTime = Date.now() - startTime
          console.error(`[ClaudeExecutorDirect] Process error: ${error.message}`)
          
          resolve({
            success: false,
            output: '',
            executionTime: executionTime,
            error: error.message
          })
        }
      })
      
      // 超时处理
      setTimeout(() => {
        if (!processExited) {
          console.log(`[ClaudeExecutorDirect] Killing process due to timeout`)
          child.kill('SIGTERM')
          
          resolve({
            success: false,
            output: output,
            executionTime: timeout,
            error: 'Execution timeout'
          })
        }
      }, timeout)
    })
  }
  
  /**
   * 生成卡片参数（与原实现相同）
   */
  async generateCardParameters(topic, templateName) {
    console.log(`\n[ClaudeExecutorDirect] ========== GENERATING CARD PARAMETERS ==========`)
    console.log(`[ClaudeExecutorDirect] Topic: ${topic}`)
    console.log(`[ClaudeExecutorDirect] Template: ${templateName}`)
    
    if (templateName !== 'cardplanet-Sandra') {
      return { style: '', language: '', reference: '' }
    }
    
    try {
      // 合并生成
      const mergedPrompt = `对于主题"${topic}"，请生成以下三个参数：

1. 风格：根据主题类别(心理/知识/创意等)按CLAUDE.md第五点（风格选择指南）自动匹配原则选择合适风格
2. 语言：判断主题语言，如果包含中文返回"中文"，纯英文返回"英文"，混合返回"中英双语"
3. 参考：检索主题相关内容，返回核心要点（100字以内）

请以JSON格式返回，格式如下：
{
  "style": "风格描述",
  "language": "语言类型",
  "reference": "参考要点"
}`

      const result = await this.executePrompt(mergedPrompt, 15000, 'generate_card_params')
      
      if (result.success && result.output) {
        try {
          const params = JSON.parse(result.output)
          console.log(`[ClaudeExecutorDirect] Parameters generated successfully`)
          return {
            style: params.style || '根据主题理解其精神内核',
            language: params.language || '根据主题的语言确定',
            reference: params.reference || '检索主题相关内容'
          }
        } catch (e) {
          console.log(`[ClaudeExecutorDirect] JSON parse failed, using defaults`)
        }
      }
    } catch (error) {
      console.error(`[ClaudeExecutorDirect] Error generating parameters:`, error)
    }
    
    // 返回默认值
    return {
      style: '根据主题理解其精神内核，自动选择合适的风格',
      language: '根据主题的语言确定语言类型',
      reference: '如果提供了链接但无法访问，请自行检索主题获取更多内容进行生成'
    }
  }
}

export default new ClaudeExecutorDirectService()