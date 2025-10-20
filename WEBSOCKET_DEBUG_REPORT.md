# WebSocket 连接问题诊断报告

## 问题描述
前端显示 "AI Terminal v3.0\nConnecting to terminal server..." 和光标闪烁，但无法输入命令。

## 根本原因分析

### 1. 核心问题：初始化消息响应流程中断

#### 前端发送流程：
```
前端连接 → onopen 事件触发
→ 发送 { type: 'init', cols: 80, rows: 24 }
→ 等待 'ready' 类型的响应
```

#### 后端接收流程：
```
websocketService.handleConnection()
→ 发送 'connected' 消息
→ 等待 'init' 类型消息
→ handleInit() 创建终端
→ 发送 'ready' 响应
```

### 2. 关键发现

#### 问题 A：前端初始化时机问题
**文件**: `terminal-ui/src/core/terminal-engine/simple-engine.js:180-188`

```javascript
this.websocket.onopen = () => {
  console.log('[Terminal] WebSocket connected')
  this.write('Connected to terminal server\r\n')
  // 创建新的终端会话
  setTimeout(() => {
    console.log('[Terminal] Sending init message...')
    this.createTerminalSession()  // ← 延迟100ms后才发送init
  }, 100)
}
```

**影响**：初始化消息延迟100ms，可能导致竞态条件。

#### 问题 B：后端终端初始化可能失败
**文件**: `terminal-backend/src/services/websocketService.js:156-213`

```javascript
async handleInit(ws, clientId, options) {
  try {
    const terminal = terminalManager.create(terminalId, {
      cols: options.cols || 80,
      rows: options.rows || 24,
      cwd: options.cwd || process.env.HOME,  // ← 可能未定义
      shell: options.shell                    // ← 未设置shell
    })

    terminal.onData((data) => {
      if (ws.readyState === ws.OPEN) {
        this.sendMessage(ws, { type: 'output', data: data })
      }
    })

    // 发送 'ready' 响应
    this.sendMessage(ws, {
      type: 'ready',
      terminalId: terminalId,
      pid: terminal.pid
    })
  } catch (error) {
    // 错误处理
    logger.error(`[WebSocketService] Failed to create terminal:`, error)
  }
}
```

**问题**：
1. `process.env.HOME` 在某些环境中可能未定义
2. shell 未指定，依赖 `terminalManager.create()` 的默认值
3. 如果错误发生，客户端会卡在连接状态

#### 问题 C：前端等待响应的消息类型不完整
**文件**: `terminal-ui/src/core/terminal-engine/simple-engine.js:228-262`

```javascript
handleMessage(message) {
  switch (message.type) {
    case 'connected':
      console.log(`[Terminal] Connected: ${message.clientId}`)
      // ← 没有处理逻辑
      break

    case 'ready':
      this.terminalId = message.terminalId
      this.write('Terminal ready. Type commands to interact.\r\n$ ')
      // ← 如果收不到'ready'，就无法提示用户输入
      break

    case 'output':
      this.write(message.data)
      break
  }
}
```

**问题**：前端只在收到 `'ready'` 消息后才认为终端已初始化。如果此消息未到达或延迟，终端处于"连接中"状态。

#### 问题 D：消息发送顺序不确定
**文件**: `terminal-backend/src/services/websocketService.js:75-81`

```javascript
// 发送欢迎消息
this.sendMessage(ws, {
  type: 'connected',
  clientId: clientId,
  message: 'WebSocket connection established'
})
```

**时序问题**：
```
T0: 连接建立，发送 'connected' 消息
T1: 客户端 onopen 触发
T2: 前端设置事件处理器
T3: 前端延迟100ms发送 'init' 消息
T4: 后端接收 'init' 消息，开始创建终端
T5: 后端发送 'ready' 消息
```

如果 'connected' 消息在前端事件处理器设置完成之前发送，可能被丢弃。

---

## 详细问题清单

### 🔴 高优先级问题

| 问题ID | 问题描述 | 严重程度 | 文件位置 |
|--------|--------|---------|---------|
| WS-001 | 前端初始化延迟可能导致消息丢失 | 高 | simple-engine.js:184 |
| WS-002 | 后端HOME环境变量未定义导致创建失败 | 高 | websocketService.js:168 |
| WS-003 | shell参数未显式配置 | 高 | websocketService.js:169 |
| WS-004 | 'connected'消息可能在事件处理器前发送 | 中 | websocketService.js:76 |
| WS-005 | 错误处理不够完善，错误消息可能未正确传递 | 中 | websocketService.js:206-211 |
| WS-006 | 前端没有超时处理，会无限期等待 | 中 | simple-engine.js:190-197 |

---

## 诊断步骤

### 步骤 1：检查浏览器控制台

打开浏览器开发者工具（F12），在 Console 标签中查看：

**预期输出**：
```
[Terminal] Connecting to WebSocket: ws://localhost:6009/ws/terminal
[Terminal] WebSocket connected
[Terminal] Sending init message...
[Terminal] Received message: connected
[Terminal] Received message: ready
[Terminal] Focused after ready
```

**实际可能输出**：
```
[Terminal] Connecting to WebSocket: ws://localhost:6009/ws/terminal
[Terminal] WebSocket connected
[Terminal] Sending init message...
(无后续消息 - 卡住)
```

### 步骤 2：检查后端服务日志

后端应该输出：
```
========================================
[WebSocketService] ✅ NEW WEBSOCKET CONNECTION!
[WebSocketService] Client ID: ws_xxx_yyy
[WebSocketService] Client IP: 127.0.0.1
[WebSocketService] Time: 2024-xx-xx...
========================================

[WebSocketService] Initializing terminal for ws_xxx_yyy
[WebSocketService] Options: { cols: 80, rows: 24 }
[WebSocketService] ✅ Terminal term_xxx_yyy created for ws_xxx_yyy
```

**如果看不到这些日志**，表示：
- 后端未接收到连接
- 或后端初始化失败，异常被吞掉

### 步骤 3：检查后端错误

在后端日志中搜索错误消息：
```
[WebSocketService] Failed to create terminal:
⚠️ Error: ...
```

常见错误：
- `Error: spawn ENOENT: no such file or directory, spawn '/bin/bash'`
- `Error: process.env.HOME is undefined`
- `Error: EACCES: permission denied`

---

## 修复方案

### 方案 1：修复后端初始化（优先）

**文件**: `terminal-backend/src/services/websocketService.js`

```javascript
async handleInit(ws, clientId, options) {
  try {
    console.log(`[WebSocketService] Initializing terminal for ${clientId}`)
    console.log('[WebSocketService] Options:', options)

    // 生成终端ID
    const terminalId = `term_${Date.now()}_${Math.random().toString(36).substring(7)}`

    // 确定工作目录 - 改进的逻辑
    let cwd = options.cwd
    if (!cwd) {
      // 1. 优先使用当前用户的HOME
      cwd = process.env.HOME || process.env.USERPROFILE

      // 2. 如果HOME不存在，使用当前工作目录
      if (!cwd) {
        cwd = process.cwd()
      }
    }

    // 确定shell - 改进的逻辑
    let shell = options.shell
    if (!shell) {
      if (process.platform === 'win32') {
        shell = process.env.COMSPEC || 'cmd.exe'
      } else {
        shell = process.env.SHELL || '/bin/bash'
      }
    }

    console.log(`[WebSocketService] Using cwd: ${cwd}, shell: ${shell}`)

    // 创建终端
    const terminal = terminalManager.create(terminalId, {
      cols: options.cols || 80,
      rows: options.rows || 24,
      cwd: cwd,
      shell: shell
    })

    // 建立映射关系
    this.wsToTerminal.set(ws, terminalId)
    this.terminalToWs.set(terminalId, ws)

    // 监听终端输出
    terminal.onData((data) => {
      if (ws.readyState === ws.OPEN) {
        this.sendMessage(ws, {
          type: 'output',
          data: data
        })
      }
    })

    // 监听终端退出
    terminal.onExit(({ exitCode, signal }) => {
      console.log(`[WebSocketService] Terminal ${terminalId} exited: ${exitCode}/${signal}`)
      this.sendMessage(ws, {
        type: 'exit',
        exitCode: exitCode,
        signal: signal
      })
      ws.close(1000, 'Terminal exited')
    })

    // 发送成功消息
    this.sendMessage(ws, {
      type: 'ready',
      terminalId: terminalId,
      pid: terminal.pid,
      message: `Terminal ready. PID: ${terminal.pid}`
    })

    console.log(`[WebSocketService] ✅ Terminal ${terminalId} created for ${clientId}, PID: ${terminal.pid}`)

  } catch (error) {
    logger.error(`[WebSocketService] Failed to create terminal:`, error)
    console.error(`[WebSocketService] ❌ Error details:`, {
      message: error.message,
      code: error.code,
      errno: error.errno,
      syscall: error.syscall
    })

    this.sendMessage(ws, {
      type: 'error',
      error: `Failed to create terminal: ${error.message}`,
      details: {
        code: error.code,
        syscall: error.syscall
      }
    })
  }
}
```

### 方案 2：修复前端消息处理

**文件**: `terminal-ui/src/core/terminal-engine/simple-engine.js`

```javascript
connectWebSocket() {
  const isDev = import.meta.env.DEV
  const wsUrl = isDev
    ? `ws://${window.location.hostname}:6009/ws/terminal`
    : `ws://${window.location.hostname}:${window.location.port}/ws/terminal`

  console.log('[Terminal] Connecting to WebSocket:', wsUrl)
  this.websocket = new WebSocket(wsUrl)

  this.websocket.onopen = () => {
    console.log('[Terminal] WebSocket connected')
    this.write('Connected to terminal server\r\n')

    // 立即发送init消息，不延迟
    console.log('[Terminal] Sending init message immediately...')
    this.createTerminalSession()
  }

  this.websocket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data)
      console.log('[Terminal] Received message:', message.type, message)
      this.handleMessage(message)
    } catch (error) {
      console.error('[Terminal] Message parse error:', error)
    }
  }

  this.websocket.onclose = () => {
    console.log('[Terminal] WebSocket disconnected')
    this.write('\r\n[连接已断开]\r\n')
  }

  this.websocket.onerror = (error) => {
    console.error('[Terminal] WebSocket error:', error)
    this.write('\r\n[连接错误]\r\n')
  }
}

createTerminalSession() {
  if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
    console.error('[Terminal] WebSocket not open, state:', this.websocket?.readyState)
    // 添加超时重试
    setTimeout(() => this.createTerminalSession(), 500)
    return
  }

  const message = {
    type: 'init',
    cols: 80,
    rows: 24
  }

  console.log('[Terminal] Sending init message:', message)
  this.websocket.send(JSON.stringify(message))
}
```

### 方案 3：添加超时处理

**文件**: `terminal-ui/src/core/terminal-engine/simple-engine.js`

```javascript
connectWebSocket() {
  // ... existing code ...

  // 添加初始化超时
  const initTimeout = setTimeout(() => {
    if (!this.terminalId) {
      console.error('[Terminal] Terminal initialization timeout (10s)')
      this.write('\r\n[错误：终端初始化超时，请检查后端服务]\r\n')
      this.websocket.close()
    }
  }, 10000)

  this.websocket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data)

      if (message.type === 'ready' && !this.terminalId) {
        clearTimeout(initTimeout)
      }

      this.handleMessage(message)
    } catch (error) {
      console.error('[Terminal] Message parse error:', error)
    }
  }
}
```

---

## 测试清单

### 测试 1：基本连接
- [ ] 打开浏览器，访问前端页面
- [ ] 检查浏览器控制台是否显示 "WebSocket connected"
- [ ] 后端日志是否显示 "NEW WEBSOCKET CONNECTION"

### 测试 2：终端初始化
- [ ] 前端是否显示 "Terminal ready. Type commands to interact."
- [ ] 终端是否显示 "$" 提示符
- [ ] 后端日志是否显示 "Terminal xxx created"

### 测试 3：命令执行
- [ ] 输入 `echo "hello"` 并按Enter
- [ ] 是否显示命令输出
- [ ] 是否显示新的 "$" 提示符

### 测试 4：错误恢复
- [ ] 停止后端服务
- [ ] 前端是否显示 "连接已断开"
- [ ] 点击 "重新连接" 按钮
- [ ] 是否重新连接成功

---

## 环境检查

```bash
# 1. 检查后端是否运行
curl -s http://localhost:6000/health | jq

# 输出应该是: { "status": "ok", "timestamp": "..." }

# 2. 检查WebSocket端点
curl -i http://localhost:6000/api/ws/status | jq

# 3. 检查终端功能
curl -s http://localhost:6000/api-info | jq '.endpoints'

# 4. 检查环境变量
echo $HOME
echo $SHELL
echo $TERM
```

---

## 补充资源

### 后端WebSocket流程图

```
客户端连接请求
    ↓
handleConnection()
    ├─ 生成 clientId
    ├─ 记录连接信息
    ├─ 发送 'connected' 消息 ← 前端收到此消息
    └─ 设置事件处理器
    ↓
前端接收 'connected' 消息，发送 'init' 消息
    ↓
handleMessage() 接收 'init' 类型
    ↓
handleInit()
    ├─ 创建终端 (terminalManager.create)
    ├─ 建立映射关系 (wsToTerminal, terminalToWs)
    ├─ 监听终端输出 (terminal.onData)
    ├─ 监听终端退出 (terminal.onExit)
    └─ 发送 'ready' 消息 ← 前端收到此消息
    ↓
前端接收 'ready' 消息，显示提示符
    ↓
用户输入命令
    ↓
前端发送 'input' 消息
    ↓
handleMessage() 接收 'input' 类型
    ↓
handleInput()
    ├─ 获取映射的 terminalId
    ├─ 获取 PTY 实例
    └─ terminal.write(data)
    ↓
PTY执行命令，产生输出
    ↓
终端 onData 事件触发
    ↓
发送 'output' 消息给前端
    ↓
前端接收并显示
```

### 消息协议详解

#### 'connected' 消息 (服务器 → 客户端)
```json
{
  "type": "connected",
  "clientId": "ws_1234567890_abcd",
  "message": "WebSocket connection established"
}
```

#### 'init' 消息 (客户端 → 服务器)
```json
{
  "type": "init",
  "cols": 80,
  "rows": 24,
  "cwd": "/home/user",        // 可选
  "shell": "/bin/bash"        // 可选
}
```

#### 'ready' 消息 (服务器 → 客户端)
```json
{
  "type": "ready",
  "terminalId": "term_1234567890_abcd",
  "pid": 12345,
  "message": "Terminal ready. PID: 12345"
}
```

#### 'input' 消息 (客户端 → 服务器)
```json
{
  "type": "input",
  "data": "ls -la\r"
}
```

#### 'output' 消息 (服务器 → 客户端)
```json
{
  "type": "output",
  "data": "total 48\ndrwxr-xr-x  5 user user 4096 Jan 1 12:00 .\n..."
}
```

---

## 后续行动

1. **立即修复**：按照方案1修复后端初始化
2. **测试验证**：运行测试清单中的所有测试
3. **监控调整**：调整日志级别便于故障排查
4. **文档更新**：更新API文档
5. **性能优化**：考虑添加消息队列处理

