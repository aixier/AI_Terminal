# Docker WebSocket 连接问题诊断

## 🔍 问题发现

### Docker 容器信息
```
Container ID: fd806b9f97c7
Image: ai-terminal:v4.8.36
Port Mapping: 0.0.0.0:8199->6009/tcp
Status: Up 10+ minutes (healthy)
```

### 观察到的现象

**后端日志**（docker logs）：
```
========================================
[WebSocketService] ✅ NEW WEBSOCKET CONNECTION!
[WebSocketService] Client ID: ws_1760947233432_lfvcv
[WebSocketService] Client IP: 172.17.0.1
[WebSocketService] Time: 2025-10-20T08:00:33.432Z
========================================
[WebSocketService] Connection closed: ws_1760947233432_lfvcv (1005: )
[WebSocketService] Cleaned up resources for ws_1760947233432_lfvcv
```

**关键问题**：连接建立后**立即断开**，状态码 `1005` 表示"没有收到状态码"

### 可能的根本原因

1. **消息未被发送或未被接收**
   - 后端成功接受连接并开始处理
   - 但在某个环节出现错误导致连接断开

2. **超时机制被触发**
   - 前端代码中存在 10 秒超时
   - 如果超时被触发，前端会关闭连接

3. **消息处理崩溃**
   - 可能是异常被捕获但连接被关闭

---

## 🔧 快速诊断步骤

### 步骤 1：进入 Docker 容器

```bash
docker exec -it fd806b9f97c7 /bin/sh
```

### 步骤 2：检查后端日志级别和详细输出

```bash
# 查看最近的日志（包括WebSocket详情）
docker logs fd806b9f97c7 2>&1 | grep -i "websocket\|terminal\|error" | tail -50
```

### 步骤 3：验证后端服务状态

```bash
docker exec fd806b9f97c7 curl -s http://localhost:6000/health | jq '.'
docker exec fd806b9f97c7 curl -s http://localhost:6000/api/ws/status | jq '.'
```

### 步骤 4：检查前端编译结果

```bash
# 检查前端文件是否存在
docker exec fd806b9f97c7 ls -la /app/static/ | head -20

# 检查main.js中的WebSocket配置
docker exec fd806b9f97c7 grep -r "ws://" /app/static/ --include="*.js" | head -5
```

---

## 📋 预期的工作流程

### 正常连接流程（成功时应该看到）

```
T0: WebSocket 连接请求
    ↓
T1: [WebSocketService] ✅ NEW WEBSOCKET CONNECTION!
    ↓
T2: 前端发送 { type: 'init', cols: 80, rows: 24 }
    ↓
T3: [WebSocketService] Initializing terminal for ws_xxx
    ↓
T4: [WebSocketService] Using cwd: ..., shell: ...
    ↓
T5: [WebSocketService] ✅ Terminal term_xxx created for ws_xxx, PID: 12345
    ↓
T6: 前端接收 { type: 'ready', terminalId: 'term_xxx', pid: 12345 }
    ↓
T7: 前端显示 "$ "
```

### 当前观察到的流程（失败时）

```
T0: WebSocket 连接请求
    ↓
T1: [WebSocketService] ✅ NEW WEBSOCKET CONNECTION!
    ↓
T2: [WebSocketService] Connection closed: ws_xxx (1005: )  ← 立即断开！
    ↓
T3: [WebSocketService] Cleaned up resources for ws_xxx
```

**中间步骤 T2-T6 完全缺失！**

---

## 🔎 深度诊断

### 检查项 1：前端是否发送 'init' 消息

在浏览器控制台输入：
```javascript
// 这需要访问engine对象（通常不会暴露）
// 手动方式：打开Network标签，查看WebSocket帧
```

**应该看到的**：
- WebSocket 连接建立
- 立即发送一个 `init` 消息帧

### 检查项 2：前端超时是否被触发

打开浏览器开发者工具（F12），查看 Console：

**可能看到的错误**：
```
❌ [错误] 终端初始化超时 (10秒)
[提示] 请检查后端服务是否运行在6009端口
```

这表明后端在 10 秒内未响应 'ready' 消息。

### 检查项 3：检查消息队列是否有阻塞

```bash
# 查看系统网络统计
docker exec fd806b9f97c7 netstat -an | grep 6009

# 查看WebSocket连接状态
docker exec fd806b9f97c7 ss -tpn | grep :6009
```

### 检查项 4：检查 PTY 创建是否成功

```bash
# 查看运行的进程
docker exec fd806b9f97c7 ps aux | grep bash

# 查看文件描述符
docker exec fd806b9f97c7 ls -la /proc/[pid]/fd/
```

---

## 💡 可能的解决方案

### 方案 A：验证前端代码已更新

Docker 容器中编译的前端可能是旧版本（未包含最新修复）。

**解决步骤**：
```bash
# 1. 重建 Docker 镜像（强制重建，不使用缓存）
docker build --no-cache -t ai-terminal:v4.8.36-new .

# 2. 停止现有容器
docker stop fd806b9f97c7
docker rm fd806b9f97c7

# 3. 运行新容器
docker run -d -p 8199:6009 --name terminal ai-terminal:v4.8.36-new
```

### 方案 B：添加详细的 WebSocket 日志

修改后端代码以增加日志详细度：

**文件**：`terminal-backend/src/services/websocketService.js`

在 `handleConnection` 中添加：
```javascript
handleConnection(ws, req) {
  const clientId = this.generateClientId()
  const clientIp = req.socket.remoteAddress

  console.log('========================================')
  console.log('[WebSocketService] ✅ NEW WEBSOCKET CONNECTION!')
  console.log('[WebSocketService] Client ID:', clientId)
  console.log('[WebSocketService] Client IP:', clientIp)
  console.log('[WebSocketService] Time:', new Date().toISOString())
  console.log('========================================')

  // 设置事件处理
  this.setupWebSocketEvents(ws, clientId)

  // 记录连接信息
  this.connections.set(ws, {
    id: clientId,
    ip: clientIp,
    connectedAt: new Date(),
    headers: req.headers
  })

  // 发送欢迎消息
  console.log('[WebSocketService] 📤 Sending connected message...')
  this.sendMessage(ws, {
    type: 'connected',
    clientId: clientId,
    message: 'WebSocket connection established'
  })
  console.log('[WebSocketService] ✅ Connected message sent')
}
```

在 `setupWebSocketEvents` 中添加更详细的日志：
```javascript
setupWebSocketEvents(ws, clientId) {
  console.log(`[WebSocketService] 📝 Setting up events for ${clientId}`)

  ws.on('message', async (data) => {
    try {
      console.log(`[WebSocketService] 📨 Message received from ${clientId}: ${data.toString().substring(0, 100)}`)
      const message = JSON.parse(data.toString())
      console.log(`[WebSocketService] 📋 Message type: ${message.type}`)
      await this.handleMessage(ws, clientId, message)
    } catch (error) {
      console.error(`[WebSocketService] ❌ Error parsing message from ${clientId}:`, error.message)
      logger.error(`[WebSocketService] Error parsing message:`, error)
      this.sendMessage(ws, {
        type: 'error',
        error: 'Invalid message format'
      })
    }
  })

  ws.on('error', (error) => {
    console.error(`[WebSocketService] ❌ WebSocket error for ${clientId}:`, error.message)
    logger.error(`[WebSocketService] WebSocket error for ${clientId}:`, error)
  })

  ws.on('close', (code, reason) => {
    console.log(`[WebSocketService] 🔌 Connection closed: ${clientId} (${code}: ${reason})`)
    this.handleDisconnect(ws, clientId)
  })

  ws.on('pong', () => {
    const info = this.connections.get(ws)
    if (info) {
      info.lastPong = new Date()
      console.log(`[WebSocketService] 🏓 Pong received from ${clientId}`)
    }
  })
}
```

### 方案 C：检查 WebSocket 握手是否成功

添加握手验证：
```javascript
handleConnection(ws, req) {
  // ... 现有代码 ...

  // 验证握手
  console.log('[WebSocketService] 🤝 Checking WebSocket handshake...')
  console.log('[WebSocketService] Ready state:', ws.readyState)
  console.log('[WebSocketService] Protocol:', ws.protocol)
  console.log('[WebSocketService] Extensions:', ws.extensions)

  if (ws.readyState !== WebSocket.OPEN) {
    console.error('[WebSocketService] ❌ WebSocket not in OPEN state!', ws.readyState)
    return
  }

  console.log('[WebSocketService] ✅ WebSocket handshake successful')

  // ... 继续处理 ...
}
```

---

## 🧪 测试验证

### 测试 1：直接 telnet 连接

```bash
# 从主机连接到容器
telnet localhost 8199

# 应该看到连接建立
```

### 测试 2：使用 curl 检查升级

```bash
# 检查 WebSocket 升级响应
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Key: $(openssl rand -base64 16)" \
  -H "Sec-WebSocket-Version: 13" \
  http://localhost:8199/ws/terminal

# 应该看到 101 Switching Protocols
```

### 测试 3：使用 wscat

```bash
# 安装 wscat
npm install -g wscat

# 连接到 WebSocket 端点
wscat -c ws://localhost:8199/ws/terminal

# 应该能连接并可以发送消息
{ "type": "init", "cols": 80, "rows": 24 }
```

---

## 🚀 最终解决方案清单

- [ ] 确认前端代码包含所有最新修复
- [ ] 重建 Docker 镜像（包含最新前端代码）
- [ ] 添加详细日志便于诊断
- [ ] 验证 WebSocket 握手成功
- [ ] 测试完整的连接-初始化-关闭流程
- [ ] 监控实时日志输出
- [ ] 验证消息收发

---

## 📞 需要帮助？

如果问题仍然存在：

1. **收集完整日志**：
   ```bash
   docker logs fd806b9f97c7 > docker_logs.txt 2>&1
   ```

2. **保存浏览器日志**：
   - F12 → Console → 右键 "Save as..."

3. **运行诊断脚本**：
   ```bash
   bash /mnt/d/work/AI_Terminal/test-websocket.sh
   ```

4. **查看完整报告**：
   - `/mnt/d/work/AI_Terminal/WEBSOCKET_DEBUG_REPORT.md`
   - `/mnt/d/work/AI_Terminal/FIX_SUMMARY.md`
   - `/mnt/d/work/AI_Terminal/QUICK_TEST_GUIDE.md`

