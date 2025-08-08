# Terminal 技术架构文档

## 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                         前端 (Vue 3)                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐       │
│  │  XTerm.js   │  │ Socket.io   │  │  Terminal    │       │
│  │  终端渲染    │  │   Client    │  │   Service    │       │
│  └──────┬──────┘  └──────┬──────┘  └──────┬───────┘       │
│         │                │                 │                │
│         └────────────────┴─────────────────┘                │
│                          │                                   │
└──────────────────────────┼───────────────────────────────────┘
                          │ WebSocket
                          │ 
┌──────────────────────────┼───────────────────────────────────┐
│                         │ 后端 (Node.js)                     │
├──────────────────────────┼───────────────────────────────────┤
│                    ┌─────┴──────┐                           │
│                    │ Socket.io  │                           │
│                    │   Server    │                           │
│                    └─────┬──────┘                           │
│         ┌────────────────┼────────────────┐                 │
│         │                │                │                 │
│  ┌──────┴──────┐  ┌──────┴──────┐  ┌─────┴──────┐         │
│  │   Socket     │  │  Terminal   │  │   Claude   │         │
│  │   Handler    │  │   Manager   │  │   Service  │         │
│  └──────┬──────┘  └──────┬──────┘  └─────┬──────┘         │
│         │                │                │                 │
│         └────────────────┼────────────────┘                 │
│                    ┌─────┴──────┐                           │
│                    │   node-pty  │                           │
│                    │  (PTY进程)  │                           │
│                    └─────┬──────┘                           │
│                          │                                   │
└──────────────────────────┼───────────────────────────────────┘
                          │
                    ┌─────┴──────┐
                    │   Shell     │
                    │  /bin/bash  │
                    └─────────────┘
```

## 数据流向

### 1. 用户输入流程
```
用户键盘输入
    ↓
XTerm.js onData事件
    ↓
Socket.emit('terminal:input', data)
    ↓ [WebSocket传输]
Socket.on('terminal:input')
    ↓
terminalManager.write(terminalId, data)
    ↓
pty.write(data)
    ↓
Shell执行命令
```

### 2. 命令输出流程
```
Shell命令输出
    ↓
PTY进程捕获
    ↓
pty.onData(data)
    ↓
socket.emit('terminal:output', data)
    ↓ [WebSocket传输]
socket.on('terminal:output')
    ↓
terminal.write(data)
    ↓
XTerm.js渲染显示
```

## 核心模块说明

### 前端模块

#### 1. terminalService.js
**职责**: 统一的终端服务层
```javascript
class TerminalService {
  - terminal: XTerm实例管理
  - socket: Socket连接管理
  - init(): 初始化终端
  - sendCommand(): 发送命令
  - setupDataFlow(): 建立数据流
}
```

#### 2. CardGenerator.vue
**职责**: 业务逻辑层
- Claude初始化
- 卡片生成
- 终端UI集成

### 后端模块

#### 1. socketHandler.js
**职责**: Socket连接管理
```javascript
class SocketHandler {
  - handleConnection(): 处理新连接
  - setupSocketEvents(): 设置事件监听
  - createOrAttachTerminal(): 创建/附加终端
  - setupDataFlow(): 建立数据流
}
```

#### 2. terminalManager.js
**职责**: PTY进程管理
```javascript
class TerminalManager {
  - create(): 创建PTY实例
  - write(): 写入数据
  - resize(): 调整尺寸
  - destroy(): 销毁终端
}
```

#### 3. socketService.js
**职责**: Socket服务初始化
- 设置Socket.io服务器
- 监听系统事件
- 优雅关闭处理

## 关键技术决策

### 1. 为什么选择 Socket.io？
- **自动重连**: 内置断线重连机制
- **降级支持**: 自动降级到长轮询
- **跨浏览器**: 良好的兼容性
- **事件模型**: 清晰的事件驱动架构

### 2. 为什么选择 node-pty？
- **真实PTY**: 提供真实的伪终端
- **跨平台**: 支持Windows/Linux/Mac
- **信号支持**: 支持Ctrl+C等信号
- **颜色支持**: 完整的ANSI支持

### 3. 为什么选择 XTerm.js？
- **性能优秀**: WebGL渲染器
- **功能完整**: 支持各种终端特性
- **插件生态**: 丰富的插件系统
- **活跃维护**: Microsoft维护

## 性能考虑

### 1. 内存管理
```javascript
// 限制输出缓冲区大小
const MAX_BUFFER_SIZE = 1000
if (outputBuffer.length > MAX_BUFFER_SIZE) {
  outputBuffer.shift()
}
```

### 2. 事件优化
```javascript
// Resize防抖
let resizeTimer
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => {
    fitAddon.fit()
  }, 100)
})
```

### 3. 资源限制
```javascript
// 最大终端数限制
const MAX_TERMINALS = 100
// 单终端输出限制
const MAX_OUTPUT_LENGTH = 1MB
```

## 安全设计

### 1. 输入验证
- 类型检查
- 长度限制
- 特殊字符过滤（可选）

### 2. 会话隔离
- 每个Socket独立终端
- 用户间进程隔离
- 资源使用限制

### 3. 清理机制
- 断线自动清理
- 超时自动断开
- 僵尸进程检测

## 扩展性设计

### 1. 插件机制
```javascript
// 支持自定义处理器
terminalService.onOutput((data) => {
  // 自定义处理逻辑
})
```

### 2. 事件钩子
```javascript
// 生命周期钩子
terminalManager.on('terminal:created', handler)
terminalManager.on('terminal:exit', handler)
```

### 3. 协议扩展
```javascript
// 自定义命令支持
socket.on('custom:command', (data) => {
  // 扩展命令处理
})
```

## 部署考虑

### 1. 环境变量
```bash
# 端口配置
PORT=3000
# 日志级别
LOG_LEVEL=info
# 最大连接数
MAX_CONNECTIONS=1000
```

### 2. 负载均衡
- Sticky Session支持
- Redis适配器（多实例）
- 水平扩展方案

### 3. 监控指标
- 活跃连接数
- 命令执行频率
- 资源使用情况
- 错误率统计

## 故障排查

### 1. 常见问题
| 问题 | 原因 | 解决方案 |
|-----|------|---------|
| 输入无响应 | 数据格式错误 | 检查emit格式 |
| 输出乱码 | 字符编码问题 | 设置UTF-8 |
| 连接断开 | 超时或网络问题 | 检查心跳机制 |
| 颜色不显示 | ANSI解析问题 | 检查终端类型 |

### 2. 调试工具
```javascript
// Socket调试
socket.onAny((event, ...args) => {
  console.log(event, args)
})

// PTY调试
pty.onData((data) => {
  console.log('Raw output:', data)
})
```

### 3. 日志分析
```bash
# 查看错误日志
tail -f logs/error.log

# 查看连接日志
grep "NEW CONNECTION" logs/combined.log

# 统计命令使用
grep "terminal:input" logs/combined.log | wc -l
```

## 版本迭代计划

### v1.0 (当前版本)
- [x] 基础终端功能
- [x] Claude AI集成
- [x] 实时输入输出
- [x] 颜色支持

### v1.1 (计划中)
- [ ] 文件传输
- [ ] 多标签页
- [ ] 历史记录
- [ ] 快捷键自定义

### v2.0 (未来)
- [ ] 协作功能
- [ ] 录制回放
- [ ] 主题定制
- [ ] 插件市场

## 参考资料

1. [Socket.io Documentation](https://socket.io/docs/)
2. [node-pty GitHub](https://github.com/microsoft/node-pty)
3. [XTerm.js Documentation](https://xtermjs.org/)
4. [ANSI Escape Sequences](https://en.wikipedia.org/wiki/ANSI_escape_code)
5. [WebSocket Protocol RFC](https://datatracker.ietf.org/doc/html/rfc6455)