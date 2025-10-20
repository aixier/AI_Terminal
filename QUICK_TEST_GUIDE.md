# 快速测试指南 - WebSocket 修复验证

## 修复内容总结

### ✅ 后端修复 (websocketService.js)
- 改进了工作目录 (`cwd`) 的配置逻辑
- 改进了 shell 的配置逻辑
- 增加了详细的错误日志输出
- 优化了错误消息格式

### ✅ 前端修复 (simple-engine.js)
- 移除了初始化消息的100ms延迟
- 添加了初始化超时处理 (10秒)
- 增加了重试机制
- 改进了消息日志输出
- 优化了错误提示信息

---

## 一键测试流程

### 前置条件
```bash
# 1. 进入项目目录
cd /mnt/d/work/AI_Terminal

# 2. 检查Node.js版本
node -v  # 需要 >= 14.0

# 3. 检查npm版本
npm -v   # 需要 >= 6.0
```

### 步骤 1：启动后端服务

```bash
# 1. 进入后端目录
cd terminal-backend

# 2. 安装依赖（如果未安装）
npm install

# 3. 启动后端服务
npm start

# 预期输出：
# ================================================================================
# 🚀 TERMINAL BACKEND STARTING...
# ================================================================================
# ...
# 🔌 WEBSOCKET SERVICES:
#   Initializing native WebSocket service...
#   ✓ Native WebSocket service initialized at /ws/terminal
# ...
# ✅ SERVER STARTED SUCCESSFULLY!
# ================================================================================
# 📡 Server is running on http://0.0.0.0:6000
```

**关键检查点**：
- [ ] 是否显示 "WEBSOCKET SERVICES"
- [ ] 是否显示 "Native WebSocket service initialized at /ws/terminal"
- [ ] 是否显示 "SERVER STARTED SUCCESSFULLY"

---

### 步骤 2：启动前端开发服务器

**在新的终端窗口中**：

```bash
# 1. 进入前端目录
cd terminal-ui

# 2. 安装依赖（如果未安装）
npm install

# 3. 启动前端开发服务器
npm run dev

# 预期输出：
# ➜  Local:   http://localhost:5173/
# ➜  press h + enter to show help
```

**关键检查点**：
- [ ] 是否显示本地开发服务器地址
- [ ] 是否显示可访问的URL

---

### 步骤 3：打开浏览器访问

1. **打开浏览器**：http://localhost:5173
2. **打开开发者工具**：F12 (或 Ctrl+Shift+I / Cmd+Option+I)
3. **切换到 Console 标签**

---

### 步骤 4：观察连接过程

**应该看到的日志序列**：

```javascript
// 1. WebSocket 连接开始
[Terminal] Connecting to WebSocket: ws://localhost:6009/ws/terminal

// 2. 连接建立
[Terminal] WebSocket connected

// 3. 连接状态已连接 (在 TerminalBest 组件中)
[TerminalBest] Mobile device detected: false
[TerminalBest] Mobile terminal reinitialization triggered

// 4. 初始化消息发送
[Terminal] Sending init message immediately...
[Terminal] Sending init message: {type: 'init', cols: 80, rows: 24}
[Terminal] Init message sent successfully

// 5. 收到 'connected' 响应
[Terminal] Received message type: connected full message: {type: 'connected', clientId: 'ws_xxx_yyy', message: 'WebSocket connection established'}
[Terminal] ✅ Connected: ws_xxx_yyy

// 6. 收到 'ready' 响应
[Terminal] Received message type: ready full message: {type: 'ready', terminalId: 'term_xxx_yyy', pid: 12345, message: 'Terminal ready. PID: 12345'}
[Terminal] ✅ Terminal ready: term_xxx_yyy (PID: 12345)
[Terminal] ✅ Cleared init timeout - terminal ready
[Terminal] ✅ Input focused after ready
```

**后端应该看到的日志**：

```
========================================
[WebSocketService] ✅ NEW WEBSOCKET CONNECTION!
[WebSocketService] Client ID: ws_xxx_yyy
[WebSocketService] Client IP: 127.0.0.1
[WebSocketService] Time: 2024-xx-xx...
========================================

[WebSocketService] Initializing terminal for ws_xxx_yyy
[WebSocketService] Options: { cols: 80, rows: 24 }
[WebSocketService] Using cwd: /home/user, shell: /bin/bash
[WebSocketService] ✅ Terminal term_xxx_yyy created for ws_xxx_yyy, PID: 12345
```

---

### 步骤 5：测试命令执行

1. **点击终端窗口**让它获得焦点
2. **输入命令**：`echo "Hello WebSocket!"`
3. **按 Enter**

**预期结果**：
```
$ echo "Hello WebSocket!"
Hello WebSocket!
$
```

**前端日志**：
```
[Terminal] Key pressed: Enter WebSocket state: 1
[Terminal] Sending input: \r
[Terminal] Received message type: output full message: {type: 'output', data: 'Hello WebSocket!\r\n'}
```

---

### 步骤 6：测试特殊命令

#### 测试 6.1：ls 命令
```bash
ls -la
```

#### 测试 6.2：pwd 命令
```bash
pwd
```

#### 测试 6.3：date 命令
```bash
date
```

#### 测试 6.4：Ctrl+C (中断)
```bash
sleep 10
# 然后按 Ctrl+C
```

**预期**：命令被中断

#### 测试 6.5：clear 命令 (Ctrl+L)
```bash
clear
# 或按 Ctrl+L
```

**预期**：终端清空

---

## 故障排查

### 问题 1：连接超时错误

**症状**：
```
❌ [错误] 终端初始化超时 (10秒)
[提示] 请检查后端服务是否运行在6009端口
```

**解决方案**：
```bash
# 1. 检查后端是否运行
curl http://localhost:6000/health
# 应该返回: {"status":"ok","timestamp":"..."}

# 2. 检查WebSocket端点
curl http://localhost:6000/api/ws/status
# 应该返回: {"status":"ok","stats":{...}}

# 3. 如果未启动，启动后端
cd terminal-backend
npm start
```

---

### 问题 2：WebSocket 连接立即断开

**症状**：
```
[Terminal] WebSocket connected
[Terminal] WebSocket disconnected
```

**可能原因**：
- 后端服务在初始化时崩溃
- 环境变量配置错误

**解决方案**：
```bash
# 1. 检查后端控制台是否有错误消息
# 2. 查看后端日志中是否有 "❌ Error details"

# 3. 如果是HOME环境变量问题，手动设置
export HOME=/home/your-username
cd terminal-backend
npm start
```

---

### 问题 3：命令输入无反应

**症状**：
- 输入命令后没有输出
- 终端没有显示 "$" 提示符

**排查步骤**：

1. **检查焦点**：
   ```javascript
   // 在控制台输入
   document.querySelector('#terminal-content')?.focus()
   console.log('Terminal focused')
   ```

2. **检查WebSocket连接**：
   ```javascript
   // 在控制台查看engine的websocket状态
   // (需要访问engine实例)
   ```

3. **手动测试消息发送**：
   ```javascript
   // 获取WebSocket对象（这需要从engine中暴露）
   // ws.send(JSON.stringify({type: 'input', data: 'ls\r'}))
   ```

---

### 问题 4：后端报错

#### 错误：`Error: spawn ENOENT: no such file or directory, spawn '/bin/bash'`

**原因**：bash 不在指定位置

**解决方案**：
```bash
# 查找bash位置
which bash
# 输出可能是 /bin/bash 或其他路径

# 修改环境变量
export SHELL=$(which bash)
cd terminal-backend
npm start
```

#### 错误：`Error: EACCES: permission denied`

**原因**：权限不足

**解决方案**：
```bash
# 检查目录权限
ls -ld $HOME
# 应该包含 x 权限 (例如: drwxr-xr-x)

# 如果权限不足，修改
chmod u+x $HOME
```

---

## 完整连接测试脚本

创建文件 `test-websocket.sh`：

```bash
#!/bin/bash

echo "========================================"
echo "WebSocket 连接测试"
echo "========================================"

echo ""
echo "1️⃣ 检查后端健康状态..."
HEALTH=$(curl -s http://localhost:6000/health 2>&1)
if [[ $HEALTH == *"ok"* ]]; then
    echo "✅ 后端服务运行正常"
else
    echo "❌ 后端服务未运行或不响应"
    echo "请运行: cd terminal-backend && npm start"
    exit 1
fi

echo ""
echo "2️⃣ 检查WebSocket端点状态..."
WS_STATUS=$(curl -s http://localhost:6000/api/ws/status 2>&1)
if [[ $WS_STATUS == *"ok"* ]]; then
    echo "✅ WebSocket端点正常"
    echo "响应: $WS_STATUS" | head -c 100
    echo "..."
else
    echo "❌ WebSocket端点异常"
    exit 1
fi

echo ""
echo "3️⃣ 前端检查..."
if curl -s http://localhost:5173 > /dev/null; then
    echo "✅ 前端开发服务器运行正常"
else
    echo "⚠️  前端开发服务器未运行"
    echo "请运行: cd terminal-ui && npm run dev"
fi

echo ""
echo "========================================"
echo "✅ 所有检查通过！"
echo "请打开浏览器访问: http://localhost:5173"
echo "========================================"
```

**运行测试**：
```bash
chmod +x test-websocket.sh
./test-websocket.sh
```

---

## 预期最终结果

### 成功连接表现：

1. **前端页面**显示：
   ```
   AI Terminal v3.0
   Connected to terminal server
   Waiting for terminal initialization...

   ==================================================
   🎉 Terminal ready. Type commands to interact.
   ==================================================
   $
   ```

2. **浏览器控制台**显示绿色的 "✅" 日志
3. **后端控制台**显示绿色的 "✅ Terminal xxx created"
4. **光标处于终端可输入状态**
5. **输入命令可正常执行**

---

## 验证清单

- [ ] 后端服务启动成功
- [ ] 前端开发服务器启动成功
- [ ] 浏览器可以打开前端页面
- [ ] 浏览器控制台显示正确的连接日志
- [ ] 后端控制台显示成功创建终端
- [ ] 前端显示 "$" 提示符
- [ ] 可以输入命令
- [ ] 命令执行产生输出
- [ ] 可以中断命令 (Ctrl+C)
- [ ] 可以清屏 (Ctrl+L 或 clear)

---

## 需要帮助？

如果仍然有问题：

1. **收集日志**：
   - 保存浏览器控制台日志 (F12 → Console → 右键选择 "保存日志")
   - 保存后端服务日志 (复制所有输出到文件)

2. **检查环境**：
   ```bash
   echo "Node: $(node -v)"
   echo "npm: $(npm -v)"
   echo "Shell: $SHELL"
   echo "Home: $HOME"
   echo "Platform: $(uname -s)"
   ```

3. **查看完整诊断报告**：
   查看 `/mnt/d/work/AI_Terminal/WEBSOCKET_DEBUG_REPORT.md`

