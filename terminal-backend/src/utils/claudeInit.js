import { spawn } from 'child_process'
import fs from 'fs/promises'
import path from 'path'

let claudeInitialized = false
let initializationPromise = null
let claudeProcess = null  // 持久的Claude进程

/**
 * 初始化Claude CLI，自动处理交互式设置
 */
export async function initializeClaude() {
  // 如果已经初始化，直接返回
  if (claudeInitialized) {
    console.log('[Claude Init] Already initialized')
    return true
  }

  // 如果正在初始化，等待初始化完成
  if (initializationPromise) {
    console.log('[Claude Init] Waiting for ongoing initialization...')
    return initializationPromise
  }

  // 开始初始化
  initializationPromise = doInitialize()
  const result = await initializationPromise
  initializationPromise = null
  return result
}

async function doInitialize() {
  console.log('[Claude Init] ========================================')
  console.log('[Claude Init] Starting Claude shell initialization...')
  console.log('[Claude Init] ========================================')
  
  try {
    // 如果Claude进程已经存在，直接返回
    if (claudeProcess && !claudeProcess.killed) {
      console.log('[Claude Init] ✓ Claude shell already running')
      claudeInitialized = true
      return true
    }
    
    // 启动Claude shell进程 (类似前端的initializeClaude)
    console.log('[Claude Init] >>> Starting Claude shell process...')
    claudeProcess = spawn('claude', ['--dangerously-skip-permissions'], {
      env: {
        ...process.env,
        ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN,
        ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL
      },
      stdio: ['pipe', 'pipe', 'pipe']
    })
    
    console.log('[Claude Init] >>> Claude shell started, PID:', claudeProcess.pid)
    
    // 等待Claude初始化 (类似前端等待3秒)
    console.log('[Claude Init] >>> Waiting for Claude shell to initialize...')
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    // 发送初始回车激活shell
    console.log('[Claude Init] >>> Sending initial carriage return to activate Claude shell...')
    claudeProcess.stdin.write('\r')
    
    // 设置错误处理
    claudeProcess.on('error', (error) => {
      console.error('[Claude Init] Process error:', error)
    })
    
    claudeProcess.on('exit', (code) => {
      console.log('[Claude Init] Process exited with code:', code)
      claudeProcess = null
      claudeInitialized = false
    })
    
    claudeInitialized = true
    console.log('[Claude Init] ✅ Claude shell initialized successfully')
    return true
    
  } catch (error) {
    console.error('[Claude Init] Initialization failed:', error)
    claudeProcess = null
    claudeInitialized = false
    throw error
  }
}

/**
 * 执行Claude命令
 */
export async function executeClaude(prompt) {
  // 确保Claude已初始化检查
  await initializeClaude()
  
  console.log('[Claude Execute] ========================================')
  console.log('[Claude Execute] Executing prompt in existing Claude shell')
  console.log('[Claude Execute] Prompt:', prompt.substring(0, 100) + '...')
  console.log('[Claude Execute] ========================================')

  return new Promise((resolve, reject) => {
    if (!claudeProcess || claudeProcess.killed) {
      reject(new Error('Claude process not available'))
      return
    }

    let output = ''
    let errorOutput = ''
    
    const timeout = setTimeout(() => {
      console.log('[Claude Execute] ⏰ Execution timeout after 60 seconds')
      resolve(output) // 不杀死进程，只是超时返回
    }, 60000) // 1分钟超时，足够生成时间

    // 监听输出
    const onData = (data) => {
      const text = data.toString()
      output += text
      
      console.log('[Claude Shell] Raw output received:', text.length, 'bytes')
      console.log('[Claude Shell] Raw content:', JSON.stringify(text.substring(0, 200)))
      
      // 实时输出Claude shell回显
      const lines = text.split('\n')
      lines.forEach((line, index) => {
        console.log(`[Claude Shell] Line ${index}: "${line}"`)
      })
    }
    
    const onError = (data) => {
      const text = data.toString()
      errorOutput += text
      
      // 实时输出Claude shell错误信息
      const lines = text.split('\n')
      lines.forEach(line => {
        if (line.trim()) {
          console.error('[Claude Shell Error] ' + line)
        }
      })
    }

    // 添加临时监听器
    claudeProcess.stdout.on('data', onData)
    claudeProcess.stderr.on('data', onError)

    // 检查进程状态
    console.log('[Claude Execute] >>> Process status check:')
    console.log('[Claude Execute] >>> PID:', claudeProcess.pid)
    console.log('[Claude Execute] >>> Killed:', claudeProcess.killed)
    console.log('[Claude Execute] >>> Exit code:', claudeProcess.exitCode)
    
    // 使用与前端一致的命令发送方式
    console.log('[Claude Execute] >>> Sending prompt to Claude shell...')
    claudeProcess.stdin.write(prompt)
    console.log('[Claude Execute] >>> Prompt written to stdin')
    
    // 等待1秒后发送回车符 (类似前端的'\r'和1000ms间隔)
    setTimeout(() => {
      console.log('[Claude Execute] >>> Sending carriage return to execute command')
      claudeProcess.stdin.write('\r')
      console.log('[Claude Execute] >>> Carriage return written to stdin')
      
      // 30秒后完成执行并清理
      setTimeout(() => {
        console.log('[Claude Execute] >>> Completing execution after 30 seconds')
        
        // 移除临时监听器
        claudeProcess.stdout.removeListener('data', onData)
        claudeProcess.stderr.removeListener('data', onError)
        
        clearTimeout(timeout)
        resolve(output)
      }, 30000) // 30秒后自动完成
      
    }, 1000) // 等1秒后发送换行符
  })
}

export default {
  initializeClaude,
  executeClaude
}