/**
 * Claude Executor Direct Service - 使用子进程直接执行
 * 避免 PTY 环境的兼容性问题
 */

import { spawn } from 'child_process'
import path from 'path'

class ClaudeExecutorDirectService {
  /**
   * 直接执行 Claude 命令（不通过 PTY）
   */
  async executePrompt(prompt, timeout = 30000, purpose = 'general') {
    const startTime = Date.now()
    const sessionId = `${purpose}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    
    console.log(`\n🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥`)
    console.log(`🚀 [PROMPT-SEND-${sessionId}] ========== SENDING PROMPT TO CLAUDE ==========`)
    console.log(`🎯 [PROMPT-SEND-${sessionId}] Purpose: ${purpose}`)
    console.log(`⏱️  [PROMPT-SEND-${sessionId}] Timeout: ${timeout}ms`)
    console.log(`📊 [PROMPT-SEND-${sessionId}] Prompt Length: ${prompt.length} chars`)
    console.log(`🕐 [PROMPT-SEND-${sessionId}] Timestamp: ${new Date().toISOString()}`)
    console.log(`\n💬 [PROMPT-CONTENT-${sessionId}] ====== FULL PROMPT BEGIN ======`)
    console.log(prompt)
    console.log(`💬 [PROMPT-CONTENT-${sessionId}] ====== FULL PROMPT END ======`)
    console.log(`🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥\n`)
    
    return new Promise((resolve) => {
      let output = ''
      let errorOutput = ''
      let processExited = false
      
      // 使用经过测试验证的 echo pipe 方法
      // 测试证明这种方式在容器中 100% 成功
      const escapedPrompt = prompt.replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/`/g, '\\`')
      const command = `echo "${escapedPrompt}" | claude --dangerously-skip-permissions`
      
      console.log(`🚀 [CLAUDE-EXEC-${sessionId}] Using echo pipe method`)
      console.log(`📌 [CLAUDE-EXEC-${sessionId}] Full Command: sh -c "${command}"`)
      console.log(`🔑 [CLAUDE-EXEC-${sessionId}] Auth token present:`, !!process.env.ANTHROPIC_AUTH_TOKEN)
      
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
      
      console.log(`🔧 [CLAUDE-EXEC-${sessionId}] Process spawned with PID:`, child.pid)
      
      // 收集标准输出
      child.stdout.on('data', (data) => {
        output += data.toString()
        console.log(`📥 [PROMPT-RESPONSE-${sessionId}] Received chunk: ${data.toString().substring(0, 100)}${data.toString().length > 100 ? '...' : ''}`)
      })
      
      // 收集错误输出
      child.stderr.on('data', (data) => {
        errorOutput += data.toString()
        console.log(`❌ [CLAUDE-EXEC-${sessionId}] Error: ${data.toString()}`)
      })
      
      // 处理进程退出
      child.on('exit', (code) => {
        processExited = true
        const executionTime = Date.now() - startTime
        
        if (code === 0 && output) {
          console.log(`\n✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅`)
          console.log(`🎉 [PROMPT-RETURN-${sessionId}] ========== CLAUDE RESPONSE RECEIVED ==========`)
          console.log(`⏱️  [PROMPT-RETURN-${sessionId}] Execution time: ${executionTime}ms`)
          console.log(`📊 [PROMPT-RETURN-${sessionId}] Response length: ${output.length} bytes`)
          console.log(`🕐 [PROMPT-RETURN-${sessionId}] Timestamp: ${new Date().toISOString()}`)
          console.log(`\n📄 [RESPONSE-CONTENT-${sessionId}] ====== RESPONSE BEGIN ======`)
          console.log(output.substring(0, 500) + (output.length > 500 ? '\n... [truncated]' : ''))
          console.log(`📄 [RESPONSE-CONTENT-${sessionId}] ====== RESPONSE END ======`)
          console.log(`✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅\n`)
          
          resolve({
            success: true,
            output: output.trim(),
            executionTime: executionTime
          })
        } else {
          console.log(`\n❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌`)
          console.log(`🚨 [PROMPT-FAILED-${sessionId}] ========== EXECUTION FAILED ==========`)
          console.log(`⚠️  [PROMPT-FAILED-${sessionId}] Exit code: ${code}`)
          console.log(`📛 [PROMPT-FAILED-${sessionId}] Error: ${errorOutput}`)
          console.log(`🕐 [PROMPT-FAILED-${sessionId}] Timestamp: ${new Date().toISOString()}`)
          console.log(`❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌\n`)
          
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
          console.log(`\n⏰⏰⏰⏰⏰⏰⏰⏰⏰⏰⏰⏰⏰⏰⏰⏰⏰⏰⏰⏰⏰⏰⏰⏰⏰⏰⏰⏰⏰⏰`)
          console.log(`⌛ [PROMPT-TIMEOUT-${sessionId}] ========== EXECUTION TIMEOUT ==========`)
          console.log(`🔴 [PROMPT-TIMEOUT-${sessionId}] Killing process after ${timeout}ms`)
          console.log(`🕐 [PROMPT-TIMEOUT-${sessionId}] Timestamp: ${new Date().toISOString()}`)
          console.log(`⏰⏰⏰⏰⏰⏰⏰⏰⏰⏰⏰⏰⏰⏰⏰⏰⏰⏰⏰⏰⏰⏰⏰⏰⏰⏰⏰⏰⏰⏰\n`)
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
      // 构建模板路径
      const isDocker = process.env.NODE_ENV === 'production' || process.env.DATA_PATH
      const dataPath = process.env.DATA_PATH || path.join(process.cwd(), 'data')
      const templatePath = isDocker 
        ? path.join('/app/data/public_template', templateName)
        : path.join(dataPath, 'public_template', templateName)
      
      const claudePath = path.join(templatePath, 'CLAUDE.md')
      
      // 使用模板文档进行参数生成
      const mergedPrompt = `根据[${claudePath}]文档，针对主题"${topic}"，请生成以下三个参数：

1. 风格：根据主题类别(心理/知识/创意等)按[${claudePath}]文档第五点（风格选择指南）自动匹配原则选择合适风格
2. 语言：判断主题语言，如果包含中文返回"中文"，纯英文返回"英文"，混合返回"中英双语"  
3. 参考： 如果没有任何参考信息，或参考信息中提供了链接但无法访问，请自行检索主题获取更多内容进行生成

请以JSON格式返回，格式如下：
{
  "style": "风格描述", 
  "language": "语言类型",
  "reference": "参考要点"
}`

      const result = await this.executePrompt(mergedPrompt, 60000, 'generate_card_params')
      
      if (result.success && result.output) {
        try {
          console.log(`[ClaudeExecutorDirect] Raw output for JSON parsing:`)
          console.log(`[ClaudeExecutorDirect] "${result.output}"`)
          console.log(`[ClaudeExecutorDirect] Output length: ${result.output.length} chars`)
          
          // 尝试提取 JSON 代码块中的内容
          let jsonString = result.output.trim()
          
          // 查找 ```json 代码块
          const jsonBlockMatch = jsonString.match(/```json\s*([\s\S]*?)\s*```/)
          if (jsonBlockMatch) {
            jsonString = jsonBlockMatch[1].trim()
            console.log(`[ClaudeExecutorDirect] Extracted JSON from code block: "${jsonString}"`)
          }
          
          // 如果没有代码块，尝试查找 JSON 对象
          if (!jsonBlockMatch) {
            const jsonMatch = jsonString.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
              jsonString = jsonMatch[0].trim()
              console.log(`[ClaudeExecutorDirect] Extracted JSON object: "${jsonString}"`)
            }
          }
          
          const params = JSON.parse(jsonString)
          console.log(`[ClaudeExecutorDirect] Parameters generated successfully:`, params)
          return {
            style: params.style || '根据主题理解其精神内核',
            language: params.language || '根据主题的语言确定',
            reference: params.reference || '检索主题相关内容'
          }
        } catch (e) {
          console.log(`[ClaudeExecutorDirect] JSON parse failed:`, e.message)
          console.log(`[ClaudeExecutorDirect] Raw output causing parse error:`)
          console.log(`"${result.output}"`)
          console.log(`[ClaudeExecutorDirect] Using defaults`)
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