/**
 * Claude Executor Service - 统一的Claude命令执行服务
 * 提供可复用的Claude提示词执行功能
 */

import terminalManager from './terminalManager.js'
import path from 'path'

class ClaudeExecutorService {
  /**
   * 执行Claude提示词并返回清理后的输出
   * @param {string} prompt - 要执行的提示词
   * @param {number} timeout - 超时时间（毫秒）
   * @param {string} purpose - 执行目的（用于日志）
   * @returns {Promise<{success: boolean, output: string, executionTime: number, error?: string}>}
   */
  async executePrompt(prompt, timeout = 30000, purpose = 'general') {
    const startTime = Date.now()
    const sessionId = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    
    console.log(`\n[ClaudeExecutor] ==================== START ====================`)
    console.log(`[ClaudeExecutor] Session ID: ${sessionId}`)
    console.log(`[ClaudeExecutor] Purpose: ${purpose}`)
    console.log(`[ClaudeExecutor] Timeout: ${timeout}ms`)
    console.log(`[ClaudeExecutor] Prompt length: ${prompt.length} characters`)
    console.log(`[ClaudeExecutor] Prompt preview: ${prompt.substring(0, 200)}${prompt.length > 200 ? '...' : ''}`)
    console.log(`[ClaudeExecutor] ==============================================`)
    
    let pty = null
    
    try {
      // 创建终端会话 - 使用特定的 PTY 选项来改善兼容性
      console.log(`[ClaudeExecutor] Creating terminal session with optimized PTY settings...`)
      const terminalId = `api_${sessionId}`
      pty = terminalManager.create(terminalId, {
        cols: 120,
        rows: 30,
        env: {
          ...process.env,
          ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN,
          ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL,
          TERM: 'dumb',  // 使用简单终端模式减少控制字符
          NO_COLOR: '1'  // 禁用颜色输出
        }
      })
      
      if (!pty) {
        throw new Error('Failed to create terminal session')
      }
      
      console.log(`[ClaudeExecutor] Terminal session created successfully`)
      
      // 收集输出
      let output = ''
      let commandExecuted = false
      let commandSeen = false
      let promptEndMarker = '<<<PROMPT_END>>>'
      
      // 监听输出
      pty.onData((data) => {
        output += data
        
        // 检测命令是否已经出现在输出中
        if (!commandSeen && output.includes('claude')) {
          commandSeen = true
          console.log(`[ClaudeExecutor] Command echo detected`)
        }
        
        // 记录输出长度变化（每1KB记录一次）
        if (output.length % 1024 === 0) {
          console.log(`[ClaudeExecutor] Output buffer size: ${Math.floor(output.length / 1024)}KB`)
        }
      })
      
      // 方案：使用 printf 和 stdin 重定向，避免 echo 的引号问题
      // 同时发送一个结束标记来帮助检测命令完成
      const escapedPrompt = prompt
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\$/g, '\\$')
        .replace(/`/g, '\\`')
        .replace(/!/g, '\\!')
      
      // 基于您的发现：claude --dangerously-skip-permissions -p 然后输入提示词再回车
      // 关键是需要等待 Claude 进入输入模式，然后再发送提示词
      
      const command = `claude --dangerously-skip-permissions -p`
      
      console.log(`[ClaudeExecutor] Step 1: Sending claude command...`)
      console.log(`[ClaudeExecutor] Command: ${command}`)
      
      // 步骤1：发送 claude 命令并回车
      pty.write(command + '\r')
      commandExecuted = true
      
      // 步骤2：等待 Claude 进入输入模式（关键延迟）
      console.log(`[ClaudeExecutor] Step 2: Waiting for claude to enter input mode...`)
      await new Promise(resolve => setTimeout(resolve, 1500))  // 增加等待时间
      
      // 步骤3：发送提示词
      console.log(`[ClaudeExecutor] Step 3: Sending prompt: ${prompt.substring(0, 50)}...`)
      pty.write(prompt)  // 先不加回车
      
      // 步骤4：等待一下然后发送回车触发执行
      console.log(`[ClaudeExecutor] Step 4: Sending enter to execute...`)
      await new Promise(resolve => setTimeout(resolve, 200))
      pty.write('\r')  // 发送回车
      
      // 步骤5：等待响应
      console.log(`[ClaudeExecutor] Step 5: Waiting for response...`)
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // 步骤6：发送结束标记
      pty.write(`echo "${promptEndMarker}"\r`)
      
      console.log(`[ClaudeExecutor] All steps completed, monitoring output...`)
      
      // 等待执行完成或超时
      const checkInterval = 100 // 每100ms检查一次
      let lastOutputLength = 0
      let stableOutputCount = 0
      let hasSeenEndMarker = false
      
      const waitForCompletion = new Promise((resolve) => {
        const intervalId = setInterval(() => {
          const elapsedTime = Date.now() - startTime
          
          // 检查是否超时
          if (elapsedTime >= timeout) {
            clearInterval(intervalId)
            console.log(`[ClaudeExecutor] Execution timeout after ${timeout}ms`)
            resolve({ success: false, reason: 'timeout' })
            return
          }
          
          // 检查是否看到结束标记
          if (output.includes(promptEndMarker)) {
            hasSeenEndMarker = true
            clearInterval(intervalId)
            console.log(`[ClaudeExecutor] End marker detected after ${elapsedTime}ms`)
            resolve({ success: true })
            return
          }
          
          // 备用方案：检查输出是否稳定（连续30次检查，3秒）
          if (output.length === lastOutputLength) {
            stableOutputCount++
            // 如果已经看到命令回显，且输出稳定3秒，认为完成
            if (commandSeen && stableOutputCount >= 30 && elapsedTime >= 3000) {
              clearInterval(intervalId)
              console.log(`[ClaudeExecutor] Output stabilized after ${elapsedTime}ms (no end marker)`)
              resolve({ success: true })
              return
            }
          } else {
            stableOutputCount = 0
            lastOutputLength = output.length
          }
          
          // 每5秒输出一次进度
          if (elapsedTime % 5000 < checkInterval) {
            console.log(`[ClaudeExecutor] Still executing... (${Math.floor(elapsedTime / 1000)}s elapsed, output: ${output.length} bytes)`)
          }
        }, checkInterval)
      })
      
      const result = await waitForCompletion
      
      if (!result.success) {
        console.log(`[ClaudeExecutor] Execution failed: ${result.reason}`)
        console.log(`[ClaudeExecutor] Partial output length: ${output.length} bytes`)
        return {
          success: false,
          output: this.cleanOutput(output, command),
          executionTime: Date.now() - startTime,
          error: result.reason === 'timeout' ? 'Execution timeout' : 'Execution failed'
        }
      }
      
      // 清理输出
      const cleanedOutput = this.cleanOutput(output, command)
      const executionTime = Date.now() - startTime
      
      console.log(`[ClaudeExecutor] ==================== SUCCESS ====================`)
      console.log(`[ClaudeExecutor] Execution time: ${executionTime}ms`)
      console.log(`[ClaudeExecutor] Raw output length: ${output.length} bytes`)
      console.log(`[ClaudeExecutor] Cleaned output length: ${cleanedOutput.length} bytes`)
      console.log(`[ClaudeExecutor] Output preview: ${cleanedOutput.substring(0, 200)}${cleanedOutput.length > 200 ? '...' : ''}`)
      console.log(`[ClaudeExecutor] =================================================\n`)
      
      return {
        success: true,
        output: cleanedOutput,
        executionTime: executionTime
      }
      
    } catch (error) {
      console.error(`[ClaudeExecutor] ==================== ERROR ====================`)
      console.error(`[ClaudeExecutor] Error message: ${error.message}`)
      console.error(`[ClaudeExecutor] Stack trace:`, error.stack)
      console.error(`[ClaudeExecutor] ===============================================\n`)
      
      return {
        success: false,
        output: '',
        executionTime: Date.now() - startTime,
        error: error.message
      }
      
    } finally {
      // 清理终端会话
      if (pty) {
        console.log(`[ClaudeExecutor] Cleaning up terminal session: ${sessionId}`)
        terminalManager.destroy(sessionId)
      }
    }
  }
  
  /**
   * 清理Claude命令的输出
   * @private
   */
  cleanOutput(rawOutput, command) {
    // 调试：输出原始内容的前500字符
    console.log(`[ClaudeExecutor] DEBUG - Raw output (first 500 chars):`)
    console.log(JSON.stringify(rawOutput.substring(0, 500)))
    
    // 尝试多种模式提取输出
    let cleanOutput = ''
    
    // 方法1：查找claude命令后的内容
    const commandPattern = /claude --dangerously-skip-permissions -p\r?\n/
    const commandMatch = rawOutput.match(commandPattern)
    
    if (commandMatch) {
      console.log(`[ClaudeExecutor] DEBUG - Found command match`)
      // 获取命令之后的所有内容
      const afterCommand = rawOutput.substring(rawOutput.indexOf(commandMatch[0]) + commandMatch[0].length)
      
      // 移除ANSI转义序列
      const cleaned = afterCommand
        .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')  // ANSI转义序列
        .replace(/\x1b\[\?[0-9]+[hl]/g, '')      // 特殊转义序列
        .replace(/\[[\?0-9]+[hl]/g, '')          // 未转义的特殊序列
        .replace(/\r/g, '')                      // 回车符
      
      console.log(`[ClaudeExecutor] DEBUG - After cleaning (first 200 chars):`)
      console.log(JSON.stringify(cleaned.substring(0, 200)))
      
      // 按行分割并过滤
      const lines = cleaned.split('\n')
      const outputLines = []
      
      for (const line of lines) {
        const trimmed = line.trim()
        // 停止条件：遇到新的提示符或结束标记
        if (trimmed.includes(':~$') || trimmed.match(/^[a-f0-9]+:~\$/) || trimmed.includes('<<<PROMPT_END>>>')) {
          break
        }
        // 添加非空行
        if (trimmed && !trimmed.includes('<<<PROMPT_END>>>')) {
          outputLines.push(trimmed)
        }
      }
      
      cleanOutput = outputLines.join('\n').trim()
    } else {
      console.log(`[ClaudeExecutor] DEBUG - No command match found, trying alternative method`)
      
      // 方法2：如果没找到命令，尝试提取所有非终端控制的内容
      const cleaned = rawOutput
        .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
        .replace(/\x1b\[\?[0-9]+[hl]/g, '')
        .replace(/\[[\?0-9]+[hl]/g, '')
        .replace(/\r/g, '')
      
      const lines = cleaned.split('\n')
      const outputLines = []
      let foundContent = false
      
      for (const line of lines) {
        const trimmed = line.trim()
        // 跳过提示符和命令行
        if (trimmed.includes('claude --dangerously-skip-permissions')) {
          foundContent = true
          continue
        }
        if (foundContent && trimmed && !trimmed.includes(':~$')) {
          outputLines.push(trimmed)
        }
      }
      
      cleanOutput = outputLines.join('\n').trim()
    }
    
    console.log(`[ClaudeExecutor] DEBUG - Final clean output:`)
    console.log(JSON.stringify(cleanOutput))
    
    return cleanOutput
  }
  
  /**
   * 生成卡片的参数（style、language、reference）
   * @param {string} topic - 主题
   * @param {string} templateName - 模板名称
   * @returns {Promise<{style: string, language: string, reference: string}>}
   */
  async generateCardParameters(topic, templateName) {
    console.log(`\n[ClaudeExecutor] ========== GENERATING CARD PARAMETERS ==========`)
    console.log(`[ClaudeExecutor] Topic: ${topic}`)
    console.log(`[ClaudeExecutor] Template: ${templateName}`)
    console.log(`[ClaudeExecutor] ================================================`)
    
    // 如果不是cardplanet-Sandra模板，返回默认值
    if (templateName !== 'cardplanet-Sandra') {
      console.log(`[ClaudeExecutor] Non-cardplanet-Sandra template, using defaults`)
      return {
        style: '',
        language: '',
        reference: ''
      }
    }
    
    try {
      // 构建模板路径
      const isDocker = process.env.NODE_ENV === 'production' || process.env.DATA_PATH
      const dataPath = process.env.DATA_PATH || path.join(process.cwd(), 'data')
      const templatePath = isDocker 
        ? path.join('/app/data/public_template', templateName)
        : path.join(dataPath, 'public_template', templateName)
      
      const claudePath = path.join(templatePath, 'CLAUDE.md')
      
      // 方案1：合并生成（一次调用生成所有参数）
      console.log(`[ClaudeExecutor] Using merged generation approach`)
      console.log(`[ClaudeExecutor] Claude path: ${claudePath}`)
      
      const mergedPrompt = `根据[${claudePath}]文档，针对主题"${topic}"，请生成以下三个参数：

1. 风格：根据主题类别(心理/知识/创意等)按[${claudePath}]文档第五点（风格选择指南）自动匹配原则选择合适风格
2. 语言：判断主题语言，如果包含中文返回"中文"，纯英文返回"英文"，混合返回"中英双语"
3. 参考：如果没有任何参考信息，或参考信息中提供了链接但无法访问，请自行检索主题获取更多内容进行生成

请以JSON格式返回，格式如下：
{
  "style": "风格描述",
  "language": "语言类型",
  "reference": "参考要点"
}`

      console.log(`[ClaudeExecutor] Executing merged prompt...`)
      const result = await this.executePrompt(mergedPrompt, 15000, 'generate_card_params_merged')
      
      if (result.success && result.output) {
        try {
          // 尝试解析JSON
          console.log(`[ClaudeExecutor] Attempting to parse JSON response...`)
          const params = JSON.parse(result.output)
          
          console.log(`[ClaudeExecutor] ========== PARAMETERS GENERATED (MERGED) ==========`)
          console.log(`[ClaudeExecutor] Style: ${params.style}`)
          console.log(`[ClaudeExecutor] Language: ${params.language}`)
          console.log(`[ClaudeExecutor] Reference: ${params.reference?.substring(0, 100)}${params.reference?.length > 100 ? '...' : ''}`)
          console.log(`[ClaudeExecutor] ==================================================`)
          
          return {
            style: params.style || '根据主题理解其精神内核，自动选择合适的风格',
            language: params.language || '根据主题的语言确定语言类型',
            reference: params.reference || '如果提供了链接但无法访问，请自行检索主题获取更多内容进行生成'
          }
        } catch (parseError) {
          console.log(`[ClaudeExecutor] JSON parse failed, falling back to individual generation`)
          console.log(`[ClaudeExecutor] Parse error: ${parseError.message}`)
        }
      }
      
      // 方案2：分别生成（作为后备方案）
      console.log(`[ClaudeExecutor] Using individual generation approach (fallback)`)
      
      // 定义三个前置提示词
      const stylePrompt = `根据"${topic}"类别(心理/知识/创意等)按CLAUDE.md第五点（风格选择指南）自动匹配原则选择合适风格。直接返回风格描述，不要解释。`
      const languagePrompt = `请根据"${topic}"判断语言。如果包含中文返回"中文"，纯英文返回"英文"，混合返回"中英双语"。直接返回语言类型。`
      const referencePrompt = `如果没有任何参考信息，或参考信息中提供了链接但无法访问，请自行检索"${topic}"获取更多内容进行生成。返回核心要点（100字以内）。`
      
      // 并行生成三个参数
      console.log(`[ClaudeExecutor] Generating parameters in parallel...`)
      const [styleResult, languageResult, referenceResult] = await Promise.all([
        this.executePrompt(stylePrompt, 10000, 'generate_style'),
        this.executePrompt(languagePrompt, 10000, 'generate_language'),
        this.executePrompt(referencePrompt, 10000, 'generate_reference')
      ])
      
      const style = styleResult.success ? styleResult.output : '根据主题理解其精神内核，自动选择合适的风格'
      const language = languageResult.success ? languageResult.output : '根据主题的语言确定语言类型'
      const reference = referenceResult.success ? referenceResult.output : '如果提供了链接但无法访问，请自行检索主题获取更多内容进行生成'
      
      console.log(`[ClaudeExecutor] ========== PARAMETERS GENERATED (INDIVIDUAL) ==========`)
      console.log(`[ClaudeExecutor] Style: ${style}`)
      console.log(`[ClaudeExecutor] Language: ${language}`)
      console.log(`[ClaudeExecutor] Reference: ${reference.substring(0, 100)}${reference.length > 100 ? '...' : ''}`)
      console.log(`[ClaudeExecutor] ======================================================`)
      
      return { style, language, reference }
      
    } catch (error) {
      console.error(`[ClaudeExecutor] Error generating parameters:`, error)
      // 返回默认值
      return {
        style: '根据主题理解其精神内核，自动选择合适的风格',
        language: '根据主题的语言确定语言类型',
        reference: '如果提供了链接但无法访问，请自行检索主题获取更多内容进行生成'
      }
    }
  }
}

// 导出单例
export default new ClaudeExecutorService()