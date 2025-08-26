/**
 * Claude Executor Direct Service - 使用子进程直接执行
 * 避免 PTY 环境的兼容性问题
 */

import { spawn } from 'child_process'
import path from 'path'

class ClaudeExecutorDirectService {
  /**
   * 直接执行 Claude 命令（不通过 PTY）- 带重试机制
   */
  async executePrompt(prompt, timeout = 60000, purpose = 'general', maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`\n🔄 [RETRY-${attempt}/${maxRetries}] Starting Claude execution attempt ${attempt}`)
      
      try {
        const result = await this._executeSinglePrompt(prompt, timeout, purpose, attempt)
        if (result.success) {
          console.log(`✅ [RETRY-SUCCESS] Attempt ${attempt} succeeded`)
          return result
        }
        
        // 如果失败且不是最后一次重试，等待后重试
        if (attempt < maxRetries) {
          const waitTime = Math.min(5000 * attempt, 15000) // 递增等待时间，最多15秒
          console.log(`⏳ [RETRY-WAIT] Attempt ${attempt} failed, waiting ${waitTime/1000}s before retry...`)
          await new Promise(resolve => setTimeout(resolve, waitTime))
        }
      } catch (error) {
        console.error(`❌ [RETRY-ERROR] Attempt ${attempt} error:`, error.message)
        if (attempt === maxRetries) {
          throw error
        }
      }
    }
    
    throw new Error(`All ${maxRetries} retry attempts failed`)
  }

  /**
   * 单次执行尝试
   */
  async _executeSinglePrompt(prompt, timeout = 60000, purpose = 'general', attempt = 1) {
    const startTime = Date.now()
    const sessionId = `${purpose}_A${attempt}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    
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
      
      // 使用直接 stdin 管道方法 - 避免临时文件的复杂性
      console.log(`🚀 [CLAUDE-EXEC-${sessionId}] Using direct stdin pipe method`)
      console.log(`📌 [CLAUDE-EXEC-${sessionId}] Command: claude --dangerously-skip-permissions`)
      console.log(`🔑 [CLAUDE-EXEC-${sessionId}] Auth token present:`, !!process.env.ANTHROPIC_AUTH_TOKEN)
      console.log(`📝 [CLAUDE-EXEC-${sessionId}] Prompt will be sent via stdin`)
      
      const child = spawn('claude', ['--dangerously-skip-permissions'], {
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
      
      // 直接写入提示词到 stdin
      child.stdin.write(prompt)
      child.stdin.end()
      
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
    
    // 支持三种模板：cardplanet-Sandra (3参数), cardplanet-Sandra-cover (4参数), cardplanet-Sandra-json (4参数)
    const supportedTemplates = ['cardplanet-Sandra', 'cardplanet-Sandra-cover', 'cardplanet-Sandra-json']
    const fourParamTemplates = ['cardplanet-Sandra-cover', 'cardplanet-Sandra-json']
    
    if (!supportedTemplates.includes(templateName)) {
      return fourParamTemplates.includes(templateName)
        ? { cover: '', style: '', language: '', reference: '' }
        : { style: '', language: '', reference: '' }
    }
    
    try {
      // 构建模板路径
      const isDocker = process.env.NODE_ENV === 'production' || process.env.DATA_PATH
      const dataPath = process.env.DATA_PATH || path.join(process.cwd(), 'data')
      const templatePath = isDocker 
        ? path.join('/app/data/public_template', templateName)
        : path.join(dataPath, 'public_template', templateName)
      
      const claudePath = path.join(templatePath, 'CLAUDE.md')
      const coverPath = path.join(templatePath, 'cover.md')
      
      // 根据模板类型生成不同的提示词
      let mergedPrompt
      
      if (templateName === 'cardplanet-Sandra-cover' || templateName === 'cardplanet-Sandra-json') {
        // 四参数模板：封面、风格、语言、参考
        mergedPrompt = `根据[${claudePath}]和[${coverPath}]文档，针对主题"${topic}"，请生成以下四个参数：

1. 封面：根据主题特点判断使用"默认封面"还是"小红书封面"，参考[${coverPath}]文档中的触发条件和适用场景进行选择
2. 风格：根据主题类别(心理/知识/创意等)按[${claudePath}]文档第五点（风格选择指南）自动匹配原则选择合适风格选择其中一种
3. 语言：判断主题语言，如果包含中文返回"中文"，纯英文返回"英文"，混合返回"中英双语"  
4. 参考： 如果没有任何参考信息，或参考信息中提供了链接但无法访问，请自行检索"${topic}"获取更多内容进行生成

请以JSON格式返回，格式如下：
{
  "cover": "默认封面或小红书封面", 
  "style": "风格描述，明确的风格名称", 
  "language": "语言类型",
  "reference": "参考要点"
}`
      } else {
        // 三参数模板：风格、语言、参考
        mergedPrompt = `根据[${claudePath}]文档，针对主题"${topic}"，请生成以下三个参数：

1. 风格：根据主题类别(心理/知识/创意等)按[${claudePath}]文档第五点（风格选择指南）自动匹配原则选择合适风格
2. 语言：判断主题语言，如果包含中文返回"中文"，纯英文返回"英文"，混合返回"中英双语"  
3. 参考： 如果没有任何参考信息，或参考信息中提供了链接但无法访问，请自行检索"${topic}"获取更多内容进行生成

请以JSON格式返回，格式如下：
{
  "style": "风格描述", 
  "language": "语言类型",
  "reference": "参考要点"
}`
      }

      const result = await this.executePrompt(mergedPrompt, 120000, 'generate_card_params')
      
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
          
          // 尝试解析 JSON，使用更宽容的方法
          let params
          try {
            params = JSON.parse(jsonString)
          } catch (parseError) {
            console.log(`[ClaudeExecutorDirect] Standard JSON parse failed, trying JSON repair...`)
            // 尝试修复常见的JSON格式问题
            try {
              // 替换常见的问题字符
              let repairedJson = jsonString
                .replace(/"/g, '"')  // 替换中文引号
                .replace(/"/g, '"')  // 替换中文引号
                .replace(/'/g, '"')  // 替换单引号为双引号
                .replace(/，/g, ',') // 替换中文逗号
                .replace(/：/g, ':') // 替换中文冒号
              
              params = JSON.parse(repairedJson)
              console.log(`[ClaudeExecutorDirect] JSON repair successful`)
            } catch (repairError) {
              console.log(`[ClaudeExecutorDirect] JSON repair also failed:`, repairError.message)
              throw parseError // 抛出原始错误
            }
          }
          console.log(`[ClaudeExecutorDirect] Parameters generated successfully:`, params)
          
          // 根据模板类型返回不同的参数结构
          if (templateName === 'cardplanet-Sandra-cover' || templateName === 'cardplanet-Sandra-json') {
            return {
              cover: params.cover || '默认封面',
              style: params.style || '根据主题理解其精神内核',
              language: params.language || '根据主题的语言确定',
              reference: params.reference || '检索主题相关内容'
            }
          } else {
            return {
              style: params.style || '根据主题理解其精神内核',
              language: params.language || '根据主题的语言确定',
              reference: params.reference || '检索主题相关内容'
            }
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
    if (templateName === 'cardplanet-Sandra-cover' || templateName === 'cardplanet-Sandra-json') {
      return {
        cover: '默认封面',
        style: '根据主题理解其精神内核，自动选择合适的风格',
        language: '根据主题的语言确定语言类型',
        reference: '如果提供了链接但无法访问，请自行检索主题获取更多内容进行生成'
      }
    } else {
      return {
        style: '根据主题理解其精神内核，自动选择合适的风格',
        language: '根据主题的语言确定语言类型',
        reference: '如果提供了链接但无法访问，请自行检索主题获取更多内容进行生成'
      }
    }
  }
}

export default new ClaudeExecutorDirectService()