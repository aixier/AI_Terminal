# 命令行转API开发指南

## 目录
- [概述](#概述)
- [核心架构](#核心架构)
- [快速开始](#快速开始)
- [详细实现](#详细实现)
- [代码示例](#代码示例)
- [最佳实践](#最佳实践)
- [故障排除](#故障排除)
- [扩展开发](#扩展开发)

## 概述

本指南基于AI Terminal项目的成功实践，详细说明如何将命令行工具转换为稳定的REST API服务。通过复用现有terminal基础设施，实现了高可靠性和环境一致性的API服务。

### 适用场景
- 将Claude、Git、NPM等命令行工具转换为API
- 需要复杂环境配置的工具API化
- 支持并发请求的批量命令执行
- 长时间运行命令的异步处理

### 核心优势
- ✅ **环境一致性**: API与前端使用完全相同的环境
- ✅ **会话隔离**: 支持并发请求互不干扰  
- ✅ **资源管理**: 自动会话清理和内存保护
- ✅ **错误恢复**: 多层异常处理和资源清理
- ✅ **可扩展性**: 标准化模式快速添加新命令

## 核心架构

### 架构层次图
```
┌─────────────────────────────────────┐
│          HTTP API Layer            │  ← REST接口层
│    (Express Routes + Validation)   │
├─────────────────────────────────────┤
│       API Terminal Service         │  ← 会话管理层
│    (Session Management + I/O)      │
├─────────────────────────────────────┤
│        Terminal Manager             │  ← PTY进程管理
│     (PTY Creation + Lifecycle)     │
├─────────────────────────────────────┤
│      Command Line Tools             │  ← 实际命令工具
│   (Claude, Git, NPM, Custom...)    │
└─────────────────────────────────────┘
```

### 核心组件

#### 1. ApiTerminalService (会话管理核心)
- **会话创建**: 为每个API请求创建独立PTY终端
- **命令执行**: 标准化的命令发送和控制流程
- **输出捕获**: 实时缓冲和处理终端输出
- **资源清理**: 自动会话销毁和内存管理

#### 2. 路由层 (API接口)
- **参数验证**: 输入参数的类型和格式校验
- **流程控制**: 标准化的执行流程管理
- **响应格式**: 统一的JSON响应结构
- **错误处理**: 多层异常捕获和友好错误信息

#### 3. 结果检测 (完成判断)
- **文件监控**: 监控文件生成完成
- **输出模式**: 基于输出内容模式识别
- **状态检查**: 定期检查命令状态
- **超时保护**: 防止无限等待的保护机制

## 快速开始

### 1. 安装依赖
```bash
npm install express node-pty
```

### 2. 基础目录结构
```
src/
├── routes/
│   └── your-command.js          # API路由定义
├── services/
│   └── apiTerminalService.js    # 核心会话管理服务
├── utils/
│   └── commandHelpers.js        # 命令工具函数
└── index.js                     # 主应用入口
```

### 3. 最小实现示例
```javascript
// routes/echo.js - 简单命令API
import express from 'express'
import apiTerminalService from '../services/apiTerminalService.js'

const router = express.Router()

router.post('/echo', async (req, res) => {
  const { message } = req.body
  const apiId = `echo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  try {
    // 创建会话
    await apiTerminalService.createTerminalSession(apiId)
    
    // 执行命令
    await apiTerminalService.sendTextAndControl(apiId, `echo "${message}"`)
    
    // 等待结果
    const output = await apiTerminalService.waitForCompletion(apiId)
    
    // 返回结果
    res.json({
      success: true,
      data: { output, apiId },
      message: 'Command executed successfully'
    })
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    })
  } finally {
    // 清理资源
    await apiTerminalService.destroySession(apiId)
  }
})

export default router
```

## 详细实现

### 步骤1: 创建ApiTerminalService

```javascript
// services/apiTerminalService.js
import terminalManager from './terminalManager.js'
import { EventEmitter } from 'events'

class ApiTerminalService extends EventEmitter {
  constructor() {
    super()
    this.terminals = new Map()      // apiId -> terminal info
    this.outputBuffers = new Map()  // apiId -> output buffer
  }

  /**
   * 创建终端会话
   */
  async createTerminalSession(apiId, options = {}) {
    console.log(`[ApiTerminalService] Creating session: ${apiId}`)
    
    if (this.terminals.has(apiId)) {
      return this.terminals.get(apiId)
    }
    
    const terminalId = `api_${apiId}`
    const pty = terminalManager.create(terminalId, {
      cols: options.cols || 120,
      rows: options.rows || 30,
      env: {
        ...process.env,
        ...options.env
      }
    })
    
    // 创建输出缓冲区
    const outputBuffer = []
    this.outputBuffers.set(apiId, outputBuffer)
    
    // 监听输出
    const dataHandler = (data) => {
      outputBuffer.push({
        data: data,
        timestamp: Date.now()
      })
      
      // 限制缓冲区大小
      if (outputBuffer.length > 1000) {
        outputBuffer.shift()
      }
      
      this.emit('output', { apiId, data })
    }
    
    pty.onData(dataHandler)
    
    const terminalInfo = {
      id: terminalId,
      pty: pty,
      dataHandler: dataHandler,
      created: Date.now(),
      lastActivity: Date.now()
    }
    
    this.terminals.set(apiId, terminalInfo)
    return terminalInfo
  }

  /**
   * 发送命令
   */
  async sendTextAndControl(apiId, text, control = '\r', delay = 1000) {
    const terminal = this.terminals.get(apiId)
    if (!terminal) {
      throw new Error(`Terminal session not found: ${apiId}`)
    }
    
    // 发送文本
    terminal.pty.write(text)
    
    // 等待延迟
    await this.delay(delay)
    
    // 发送控制字符
    terminal.pty.write(control)
    
    terminal.lastActivity = Date.now()
    return true
  }

  /**
   * 等待命令完成
   */
  async waitForCompletion(apiId, timeout = 30000) {
    return new Promise((resolve) => {
      const startTime = Date.now()
      
      const checkComplete = () => {
        if (Date.now() - startTime > timeout) {
          resolve(this.getOutput(apiId))
        }
      }
      
      const interval = setInterval(checkComplete, 1000)
      
      setTimeout(() => {
        clearInterval(interval)
        resolve(this.getOutput(apiId))
      }, timeout)
    })
  }

  /**
   * 获取输出
   */
  getOutput(apiId) {
    const buffer = this.outputBuffers.get(apiId)
    if (!buffer) return ''
    return buffer.map(item => item.data).join('')
  }

  /**
   * 销毁会话
   */
  async destroySession(apiId) {
    const terminal = this.terminals.get(apiId)
    if (!terminal) return
    
    console.log(`[ApiTerminalService] Destroying session: ${apiId}`)
    
    // 移除监听器
    if (terminal.dataHandler) {
      terminal.pty.removeListener('data', terminal.dataHandler)
    }
    
    // 销毁终端
    terminalManager.destroy(terminal.id)
    
    // 清理缓存
    this.terminals.delete(apiId)
    this.outputBuffers.delete(apiId)
  }

  /**
   * 延迟函数
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 清理过期会话
   */
  cleanupExpiredSessions(maxAge = 300000) {
    const now = Date.now()
    for (const [apiId, terminal] of this.terminals) {
      if (now - terminal.lastActivity > maxAge) {
        console.log(`[ApiTerminalService] Cleaning expired session: ${apiId}`)
        this.destroySession(apiId)
      }
    }
  }
}

export default new ApiTerminalService()
```

### 步骤2: 创建专用命令API

#### Claude命令API示例
```javascript
// routes/claude.js
import express from 'express'
import apiTerminalService from '../services/apiTerminalService.js'
import fs from 'fs/promises'
import path from 'path'

const router = express.Router()

/**
 * Claude代码生成API
 * POST /api/claude/generate
 */
router.post('/generate', async (req, res) => {
  const { prompt, outputPath, templatePath } = req.body
  const apiId = `claude_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  try {
    // 参数验证
    if (!prompt || !outputPath) {
      return res.status(400).json({
        success: false,
        message: 'prompt和outputPath参数必填'
      })
    }
    
    // 确保输出目录存在
    await fs.mkdir(outputPath, { recursive: true })
    
    // 构建Claude命令
    const command = templatePath 
      ? `根据[${templatePath}]文档的规范，就以下命题，生成文档在[${outputPath}]：${prompt}`
      : `就以下命题，生成文档在[${outputPath}]：${prompt}`
    
    console.log(`[Claude API] Starting generation: ${apiId}`)
    console.log(`[Claude API] Command: ${command}`)
    
    // 创建会话并初始化Claude
    await apiTerminalService.createTerminalSession(apiId, {
      env: {
        ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN,
        ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL
      }
    })
    
    // 初始化Claude
    await initializeClaude(apiId)
    
    // 发送生成命令
    await apiTerminalService.sendTextAndControl(apiId, command, '\r', 1000)
    
    // 等待文件生成
    const result = await waitForFileGeneration(outputPath, 180000)
    
    res.json({
      success: true,
      data: {
        prompt: prompt,
        outputPath: outputPath,
        files: result.files,
        apiId: apiId
      },
      message: '生成完成'
    })
    
  } catch (error) {
    console.error(`[Claude API] Error: ${error.message}`)
    res.status(500).json({
      success: false,
      message: error.message,
      apiId: apiId
    })
  } finally {
    await apiTerminalService.destroySession(apiId)
  }
})

/**
 * 初始化Claude环境
 */
async function initializeClaude(apiId) {
  console.log(`[Claude API] Initializing Claude: ${apiId}`)
  
  // 获取终端
  const terminal = apiTerminalService.terminals.get(apiId)
  if (!terminal) {
    throw new Error('Terminal session not found')
  }
  
  // 启动Claude
  terminal.pty.write('claude --dangerously-skip-permissions\r')
  
  // 等待启动完成
  await apiTerminalService.delay(3000)
  
  // 激活Claude shell
  terminal.pty.write('\r')
  
  console.log(`[Claude API] Claude initialized: ${apiId}`)
}

/**
 * 等待文件生成完成
 */
async function waitForFileGeneration(outputPath, timeout = 180000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    
    const checkFiles = async () => {
      try {
        const files = await fs.readdir(outputPath)
        const targetFiles = files.filter(f => 
          f.endsWith('.json') || 
          f.endsWith('.md') || 
          f.endsWith('.html')
        )
        
        if (targetFiles.length > 0) {
          resolve({ files: targetFiles })
          return
        }
      } catch (error) {
        // 目录可能还不存在，继续等待
      }
      
      // 检查超时
      if (Date.now() - startTime > timeout) {
        reject(new Error(`生成超时，已等待${timeout/1000}秒`))
        return
      }
      
      // 继续检查
      setTimeout(checkFiles, 2000)
    }
    
    // 开始检查
    checkFiles()
  })
}

export default router
```

#### Git命令API示例
```javascript
// routes/git.js
import express from 'express'
import apiTerminalService from '../services/apiTerminalService.js'

const router = express.Router()

/**
 * Git状态查询API
 * GET /api/git/status
 */
router.get('/status', async (req, res) => {
  const { repository } = req.query
  const apiId = `git_status_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  try {
    // 创建会话
    await apiTerminalService.createTerminalSession(apiId)
    
    // 切换到仓库目录（如果指定）
    if (repository) {
      await apiTerminalService.sendTextAndControl(apiId, `cd "${repository}"`)
      await apiTerminalService.delay(500)
    }
    
    // 执行git status
    await apiTerminalService.sendTextAndControl(apiId, 'git status --porcelain')
    
    // 等待结果
    const output = await apiTerminalService.waitForCompletion(apiId, 10000)
    
    // 解析Git状态
    const changes = parseGitStatus(output)
    
    res.json({
      success: true,
      data: {
        repository: repository || process.cwd(),
        changes: changes,
        rawOutput: output
      },
      message: 'Git status retrieved successfully'
    })
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    })
  } finally {
    await apiTerminalService.destroySession(apiId)
  }
})

/**
 * Git提交API
 * POST /api/git/commit
 */
router.post('/commit', async (req, res) => {
  const { message, files, repository } = req.body
  const apiId = `git_commit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  try {
    // 参数验证
    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Commit message is required'
      })
    }
    
    // 创建会话
    await apiTerminalService.createTerminalSession(apiId)
    
    // 切换目录
    if (repository) {
      await apiTerminalService.sendTextAndControl(apiId, `cd "${repository}"`)
      await apiTerminalService.delay(500)
    }
    
    // 添加文件
    if (files && files.length > 0) {
      for (const file of files) {
        await apiTerminalService.sendTextAndControl(apiId, `git add "${file}"`)
        await apiTerminalService.delay(200)
      }
    } else {
      await apiTerminalService.sendTextAndControl(apiId, 'git add .')
      await apiTerminalService.delay(500)
    }
    
    // 提交
    await apiTerminalService.sendTextAndControl(apiId, `git commit -m "${message}"`)
    
    // 等待结果
    const output = await apiTerminalService.waitForCompletion(apiId, 15000)
    
    res.json({
      success: true,
      data: {
        message: message,
        files: files,
        output: output
      },
      message: 'Commit completed successfully'
    })
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    })
  } finally {
    await apiTerminalService.destroySession(apiId)
  }
})

/**
 * 解析Git状态输出
 */
function parseGitStatus(output) {
  const lines = output.split('\n').filter(line => line.trim())
  return lines.map(line => {
    const status = line.substring(0, 2)
    const file = line.substring(3)
    
    return {
      file: file,
      status: status,
      staged: status[0] !== ' ' && status[0] !== '?',
      unstaged: status[1] !== ' ',
      untracked: status === '??'
    }
  })
}

export default router
```

### 步骤3: 统一路由注册

```javascript
// index.js
import express from 'express'
import cors from 'cors'
import claudeRoutes from './routes/claude.js'
import gitRoutes from './routes/git.js'
import echoRoutes from './routes/echo.js'
import apiTerminalService from './services/apiTerminalService.js'

const app = express()

// 中间件
app.use(cors())
app.use(express.json())

// 注册路由
app.use('/api/claude', claudeRoutes)
app.use('/api/git', gitRoutes)
app.use('/api/echo', echoRoutes)

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    activeSessions: apiTerminalService.getActiveSessions().length
  })
})

// 错误处理
app.use((error, req, res, next) => {
  console.error('API Error:', error)
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: error.message
  })
})

// 定期清理过期会话
setInterval(() => {
  apiTerminalService.cleanupExpiredSessions()
}, 60000) // 每分钟清理一次

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Command-to-API Server running on port ${PORT}`)
})
```

## 代码示例

### 完整的NPM命令API实现

```javascript
// routes/npm.js
import express from 'express'
import apiTerminalService from '../services/apiTerminalService.js'
import path from 'path'

const router = express.Router()

/**
 * NPM包安装API
 * POST /api/npm/install
 */
router.post('/install', async (req, res) => {
  const { packages, projectPath, devDependency = false } = req.body
  const apiId = `npm_install_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  try {
    // 参数验证
    if (!packages || packages.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'packages参数必填'
      })
    }
    
    // 创建会话
    await apiTerminalService.createTerminalSession(apiId)
    
    // 切换到项目目录
    if (projectPath) {
      await apiTerminalService.sendTextAndControl(apiId, `cd "${projectPath}"`)
      await apiTerminalService.delay(500)
    }
    
    // 构建安装命令
    const packageList = Array.isArray(packages) ? packages.join(' ') : packages
    const installCommand = devDependency 
      ? `npm install --save-dev ${packageList}`
      : `npm install ${packageList}`
    
    console.log(`[NPM API] Installing packages: ${packageList}`)
    
    // 执行安装命令
    await apiTerminalService.sendTextAndControl(apiId, installCommand)
    
    // 等待安装完成（NPM安装可能需要较长时间）
    const output = await apiTerminalService.waitForCompletion(apiId, 120000) // 2分钟超时
    
    // 检查安装结果
    const success = !output.includes('npm ERR!') && !output.includes('Error:')
    
    res.json({
      success: success,
      data: {
        packages: packages,
        projectPath: projectPath || process.cwd(),
        devDependency: devDependency,
        output: output
      },
      message: success ? 'Package installation completed' : 'Package installation failed'
    })
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    })
  } finally {
    await apiTerminalService.destroySession(apiId)
  }
})

/**
 * NPM脚本执行API
 * POST /api/npm/run
 */
router.post('/run', async (req, res) => {
  const { script, projectPath, args = [] } = req.body
  const apiId = `npm_run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  try {
    if (!script) {
      return res.status(400).json({
        success: false,
        message: 'script参数必填'
      })
    }
    
    await apiTerminalService.createTerminalSession(apiId)
    
    if (projectPath) {
      await apiTerminalService.sendTextAndControl(apiId, `cd "${projectPath}"`)
      await apiTerminalService.delay(500)
    }
    
    // 构建运行命令
    const argsString = args.length > 0 ? ` -- ${args.join(' ')}` : ''
    const runCommand = `npm run ${script}${argsString}`
    
    console.log(`[NPM API] Running script: ${script}`)
    
    await apiTerminalService.sendTextAndControl(apiId, runCommand)
    
    // NPM脚本执行时间可能较长
    const output = await apiTerminalService.waitForCompletion(apiId, 180000) // 3分钟超时
    
    const success = !output.includes('npm ERR!') && output.includes('npm run')
    
    res.json({
      success: success,
      data: {
        script: script,
        args: args,
        projectPath: projectPath || process.cwd(),
        output: output
      },
      message: success ? 'Script execution completed' : 'Script execution failed'
    })
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    })
  } finally {
    await apiTerminalService.destroySession(apiId)
  }
})

export default router
```

### 高级功能：流式输出API

```javascript
// routes/stream.js
import express from 'express'
import apiTerminalService from '../services/apiTerminalService.js'

const router = express.Router()

/**
 * 流式命令执行API
 * POST /api/stream/execute
 */
router.post('/execute', async (req, res) => {
  const { command, workingDir } = req.body
  const apiId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  try {
    if (!command) {
      return res.status(400).json({
        success: false,
        message: 'command参数必填'
      })
    }
    
    // 设置SSE响应头
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    })
    
    // 发送初始状态
    res.write(`data: ${JSON.stringify({
      type: 'status',
      message: 'Starting command execution',
      apiId: apiId
    })}\n\n`)
    
    // 创建会话
    await apiTerminalService.createTerminalSession(apiId)
    
    // 监听实时输出
    const outputHandler = ({ apiId: sessionId, data }) => {
      if (sessionId === apiId) {
        res.write(`data: ${JSON.stringify({
          type: 'output',
          data: data,
          timestamp: Date.now()
        })}\n\n`)
      }
    }
    
    apiTerminalService.on('output', outputHandler)
    
    // 切换工作目录
    if (workingDir) {
      await apiTerminalService.sendTextAndControl(apiId, `cd "${workingDir}"`)
      await apiTerminalService.delay(500)
    }
    
    // 执行命令
    await apiTerminalService.sendTextAndControl(apiId, command)
    
    // 等待命令完成
    setTimeout(async () => {
      // 移除监听器
      apiTerminalService.removeListener('output', outputHandler)
      
      // 发送完成状态
      res.write(`data: ${JSON.stringify({
        type: 'complete',
        message: 'Command execution completed',
        apiId: apiId
      })}\n\n`)
      
      // 关闭连接
      res.end()
      
      // 清理会话
      await apiTerminalService.destroySession(apiId)
    }, 30000) // 30秒后自动结束
    
    // 处理客户端断开连接
    req.on('close', async () => {
      apiTerminalService.removeListener('output', outputHandler)
      await apiTerminalService.destroySession(apiId)
    })
    
  } catch (error) {
    res.write(`data: ${JSON.stringify({
      type: 'error',
      message: error.message,
      apiId: apiId
    })}\n\n`)
    res.end()
    
    await apiTerminalService.destroySession(apiId)
  }
})

export default router
```

## 最佳实践

### 1. 会话管理最佳实践

#### 唯一会话ID生成
```javascript
// 推荐格式：命令类型_时间戳_随机字符串
const generateApiId = (commandType) => {
  return `${commandType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// 使用示例
const apiId = generateApiId('claude')  // claude_1649123456789_abc123def
```

#### 资源清理策略
```javascript
// 1. 立即清理模式（推荐）
try {
  // 执行命令
  const result = await executeCommand(apiId)
  return result
} finally {
  // 无论成功失败都清理
  await apiTerminalService.destroySession(apiId)
}

// 2. 延迟清理模式（用于需要保持会话的场景）
const cleanup = () => {
  setTimeout(async () => {
    await apiTerminalService.destroySession(apiId)
  }, 5000) // 5秒后清理
}

// 3. 定期清理守护进程
setInterval(() => {
  apiTerminalService.cleanupExpiredSessions(300000) // 清理5分钟前的会话
}, 60000) // 每分钟执行一次
```

### 2. 错误处理最佳实践

#### 多层错误处理
```javascript
router.post('/command', async (req, res) => {
  let apiId = null
  
  try {
    // 参数验证层
    const validation = validateRequest(req.body)
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.message,
        errors: validation.errors
      })
    }
    
    apiId = generateApiId('command')
    
    // 会话创建层
    try {
      await apiTerminalService.createTerminalSession(apiId)
    } catch (sessionError) {
      throw new Error(`Session creation failed: ${sessionError.message}`)
    }
    
    // 命令执行层
    try {
      const result = await executeCommand(apiId, req.body)
      
      res.json({
        success: true,
        data: result,
        apiId: apiId
      })
      
    } catch (executeError) {
      throw new Error(`Command execution failed: ${executeError.message}`)
    }
    
  } catch (error) {
    // 统一错误响应
    console.error(`[API Error] ${apiId}: ${error.message}`)
    
    res.status(500).json({
      success: false,
      message: error.message,
      apiId: apiId,
      timestamp: new Date().toISOString()
    })
    
  } finally {
    // 强制资源清理
    if (apiId) {
      try {
        await apiTerminalService.destroySession(apiId)
      } catch (cleanupError) {
        console.error(`[Cleanup Error] ${apiId}: ${cleanupError.message}`)
      }
    }
  }
})
```

#### 超时处理
```javascript
const executeWithTimeout = async (apiId, command, timeout = 30000) => {
  return new Promise(async (resolve, reject) => {
    // 设置超时定时器
    const timeoutTimer = setTimeout(() => {
      reject(new Error(`Command timeout after ${timeout}ms`))
    }, timeout)
    
    try {
      // 执行命令
      const result = await apiTerminalService.waitForCompletion(apiId, timeout)
      clearTimeout(timeoutTimer)
      resolve(result)
    } catch (error) {
      clearTimeout(timeoutTimer)
      reject(error)
    }
  })
}
```

### 3. 性能优化最佳实践

#### 输出缓冲区优化
```javascript
// 在ApiTerminalService中优化缓冲区管理
class ApiTerminalService {
  constructor() {
    super()
    this.maxBufferSize = 1000        // 最大缓冲条目数
    this.maxOutputLength = 100000    // 单条输出最大长度
  }
  
  addToBuffer(apiId, data) {
    const buffer = this.outputBuffers.get(apiId)
    if (!buffer) return
    
    // 截断过长的输出
    const truncatedData = data.length > this.maxOutputLength 
      ? data.substring(0, this.maxOutputLength) + '...[truncated]'
      : data
    
    buffer.push({
      data: truncatedData,
      timestamp: Date.now()
    })
    
    // 维护缓冲区大小
    while (buffer.length > this.maxBufferSize) {
      buffer.shift()
    }
  }
}
```

#### 并发控制
```javascript
// 限制并发会话数量
class ApiTerminalService {
  constructor() {
    super()
    this.maxConcurrentSessions = 10
  }
  
  async createTerminalSession(apiId) {
    // 检查并发限制
    if (this.terminals.size >= this.maxConcurrentSessions) {
      throw new Error(`Maximum concurrent sessions exceeded: ${this.maxConcurrentSessions}`)
    }
    
    // 继续创建会话...
  }
}
```

### 4. 安全性最佳实践

#### 命令注入防护
```javascript
const sanitizeCommand = (input) => {
  // 移除危险字符
  const dangerous = /[;&|`$(){}[\]]/g
  if (dangerous.test(input)) {
    throw new Error('Invalid characters detected in command')
  }
  
  // 限制命令长度
  if (input.length > 1000) {
    throw new Error('Command too long')
  }
  
  return input.trim()
}

// 使用示例
router.post('/safe-command', async (req, res) => {
  try {
    const safeCommand = sanitizeCommand(req.body.command)
    // 继续执行...
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    })
  }
})
```

#### 路径安全检查
```javascript
const validatePath = (inputPath) => {
  const resolved = path.resolve(inputPath)
  const allowed = path.resolve(process.env.ALLOWED_PATH || '/app/data')
  
  if (!resolved.startsWith(allowed)) {
    throw new Error('Path access denied')
  }
  
  return resolved
}
```

### 5. 监控和日志最佳实践

#### 结构化日志
```javascript
const logger = {
  info: (message, meta = {}) => {
    console.log(JSON.stringify({
      level: 'info',
      message: message,
      timestamp: new Date().toISOString(),
      ...meta
    }))
  },
  
  error: (message, error, meta = {}) => {
    console.error(JSON.stringify({
      level: 'error',
      message: message,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      ...meta
    }))
  }
}

// 使用示例
logger.info('Session created', { apiId, command: 'claude' })
logger.error('Command failed', error, { apiId, command })
```

#### 性能监控
```javascript
const withPerformanceMonitoring = (fn) => {
  return async (...args) => {
    const startTime = Date.now()
    const apiId = args[0] // 假设第一个参数是apiId
    
    try {
      const result = await fn(...args)
      
      logger.info('Command completed', {
        apiId: apiId,
        duration: Date.now() - startTime,
        success: true
      })
      
      return result
    } catch (error) {
      logger.error('Command failed', error, {
        apiId: apiId,
        duration: Date.now() - startTime,
        success: false
      })
      
      throw error
    }
  }
}

// 使用示例
const monitoredExecute = withPerformanceMonitoring(executeCommand)
```

## 故障排除

### 常见问题及解决方案

#### 1. 会话泄露问题
**症状**: 内存使用持续增长，进程数量增加
**原因**: 会话没有正确清理
**解决方案**:
```javascript
// 添加进程监控
const monitorSessions = () => {
  const activeSessions = apiTerminalService.getActiveSessions()
  
  if (activeSessions.length > 20) {
    console.warn(`High session count: ${activeSessions.length}`)
    // 强制清理老会话
    apiTerminalService.cleanupExpiredSessions(60000) // 1分钟
  }
}

setInterval(monitorSessions, 30000) // 每30秒检查
```

#### 2. 命令执行超时
**症状**: API请求长时间无响应
**原因**: 命令执行时间过长或卡死
**解决方案**:
```javascript
// 实现可中断的命令执行
const executeWithCancellation = (apiId, command, timeout = 30000) => {
  return new Promise(async (resolve, reject) => {
    const controller = new AbortController()
    
    const timeoutTimer = setTimeout(() => {
      controller.abort()
      reject(new Error('Command timeout'))
    }, timeout)
    
    try {
      // 监听中断信号
      controller.signal.addEventListener('abort', async () => {
        // 终止会话
        await apiTerminalService.destroySession(apiId)
      })
      
      const result = await apiTerminalService.waitForCompletion(apiId, timeout)
      clearTimeout(timeoutTimer)
      resolve(result)
    } catch (error) {
      clearTimeout(timeoutTimer)
      reject(error)
    }
  })
}
```

#### 3. 输出解析错误
**症状**: 无法正确解析命令输出
**原因**: 输出格式不符合预期或编码问题
**解决方案**:
```javascript
const parseOutput = (rawOutput) => {
  try {
    // 清理输出
    const cleaned = rawOutput
      .replace(/\u001b\[[0-9;]*m/g, '') // 移除ANSI颜色代码
      .replace(/\r\n/g, '\n')           // 统一换行符
      .trim()
    
    // 尝试JSON解析
    if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
      return JSON.parse(cleaned)
    }
    
    // 按行分割
    return cleaned.split('\n').filter(line => line.trim())
  } catch (error) {
    console.warn('Output parsing failed:', error.message)
    return rawOutput
  }
}
```

#### 4. 环境变量问题
**症状**: 命令找不到或权限错误
**原因**: 环境变量配置不正确
**解决方案**:
```javascript
// 环境变量验证
const validateEnvironment = () => {
  const required = ['ANTHROPIC_AUTH_TOKEN', 'PATH']
  const missing = required.filter(key => !process.env[key])
  
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`)
  }
}

// 启动时验证
validateEnvironment()
```

## 扩展开发

### 添加新命令API的标准流程

#### 1. 创建路由文件
```javascript
// routes/your-command.js
import express from 'express'
import apiTerminalService from '../services/apiTerminalService.js'

const router = express.Router()

router.post('/action', async (req, res) => {
  const apiId = generateApiId('your-command')
  
  try {
    // 实现你的命令逻辑
  } catch (error) {
    // 错误处理
  } finally {
    await apiTerminalService.destroySession(apiId)
  }
})

export default router
```

#### 2. 注册路由
```javascript
// index.js
import yourCommandRoutes from './routes/your-command.js'
app.use('/api/your-command', yourCommandRoutes)
```

#### 3. 添加测试
```javascript
// tests/your-command.test.js
describe('Your Command API', () => {
  test('should execute command successfully', async () => {
    const response = await request(app)
      .post('/api/your-command/action')
      .send({ param: 'value' })
    
    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
  })
})
```

### 自定义结果检测器

```javascript
// utils/resultDetectors.js
export const createFileWatcher = (path, pattern, timeout = 30000) => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    
    const check = async () => {
      try {
        const files = await fs.readdir(path)
        const matches = files.filter(f => pattern.test(f))
        
        if (matches.length > 0) {
          resolve(matches)
          return
        }
      } catch (error) {
        // 目录不存在，继续等待
      }
      
      if (Date.now() - startTime > timeout) {
        reject(new Error('File watch timeout'))
        return
      }
      
      setTimeout(check, 1000)
    }
    
    check()
  })
}

export const createOutputMatcher = (apiId, pattern, timeout = 30000) => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    
    const checkOutput = () => {
      const output = apiTerminalService.getOutput(apiId)
      
      if (pattern.test(output)) {
        resolve(output)
        return
      }
      
      if (Date.now() - startTime > timeout) {
        reject(new Error('Output match timeout'))
        return
      }
      
      setTimeout(checkOutput, 500)
    }
    
    checkOutput()
  })
}
```

### 配置管理

```javascript
// config/commands.js
export const COMMAND_CONFIGS = {
  claude: {
    initialize: 'claude --dangerously-skip-permissions',
    initDelay: 3000,
    timeout: 180000,
    env: {
      ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN,
      ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL
    }
  },
  
  git: {
    initialize: null, // 不需要特殊初始化
    initDelay: 0,
    timeout: 30000,
    env: {}
  },
  
  npm: {
    initialize: 'npm --version',
    initDelay: 1000,
    timeout: 120000,
    env: {}
  }
}

// 使用配置
const config = COMMAND_CONFIGS[commandType]
if (config.initialize) {
  await initializeCommand(apiId, config.initialize, config.initDelay)
}
```

---

## 总结

通过本指南，您可以：

1. **快速实现**: 使用标准模式快速将任何命令行工具转换为API
2. **稳定可靠**: 利用经过验证的会话管理和错误处理机制
3. **高性能**: 支持并发请求和资源优化
4. **易扩展**: 标准化的架构便于添加新命令
5. **生产就绪**: 包含监控、日志、安全等生产环境必需功能

该架构已在AI Terminal项目中得到验证，能够稳定支持Claude、Git等复杂命令行工具的API化。

如需更多帮助或遇到问题，请参考故障排除章节或联系开发团队。