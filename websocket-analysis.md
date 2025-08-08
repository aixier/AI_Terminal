# WebSocket 实现分析

## 后端实现

### 技术栈
- **框架**: Socket.IO v4.8.1 (不是原生WebSocket)
- **服务器**: Express + HTTP Server
- **Node版本**: 支持ES6 modules

### Socket.IO 配置
```javascript
const io = new Server(httpServer, {
  cors: {
    origin: config.cors.origins,
    credentials: true,
    methods: ['GET', 'POST']
  },
  transports: ['polling', 'websocket'],  // 支持两种传输方式
  allowEIO3: true                        // 兼容旧版本客户端
})
```

### 关键点
1. **不是标准WebSocket**: 使用的是Socket.IO，它在WebSocket基础上增加了额外的协议层
2. **传输方式**: 同时支持polling（长轮询）和websocket
3. **版本**: Socket.IO v4.8.1 (较新版本)

## 问题分析

### 为什么云端连接失败？

1. **Socket.IO vs 原生WebSocket**
   - Socket.IO不是标准WebSocket，它有自己的握手协议
   - 需要在客户端也使用Socket.IO客户端库

2. **阿里云函数计算限制**
   - FC可能不支持WebSocket长连接
   - FC主要设计用于无状态的HTTP请求
   - WebSocket需要持久连接，这与FC的设计理念冲突

3. **传输层问题**
   - Socket.IO会先尝试polling，再升级到WebSocket
   - 云端可能在握手阶段就失败了

## 解决方案

### 方案1: 继续使用Socket.IO（推荐用于本地/Docker）
- 本地开发: ✅ 完全支持
- Docker部署: ✅ 完全支持
- 阿里云FC: ❌ 不支持

### 方案2: 改用SSE（Server-Sent Events）用于云端
- 已有SSE路由: `/api/sse/stream`
- 单向通信，适合推送更新
- 阿里云FC可能支持

### 方案3: 改用轮询机制用于云端
- 使用REST API定期获取状态
- 适合无状态的函数计算环境

## 建议

1. **开发环境**: 使用本地服务器或Docker（完整WebSocket支持）
2. **生产环境**: 
   - 如果需要实时功能：部署到支持WebSocket的云服务（如ECS）
   - 如果使用FC：改用SSE或轮询机制

## 测试命令

```bash
# 测试本地WebSocket
node test-ws.js --url http://localhost:3000

# 测试Docker WebSocket  
node test-ws.js --url http://localhost:3001

# 测试云端（预期失败）
node test-ws.js --url http://ai-terminal-xnbmzvtedv.ap-northeast-1.fcapp.run
```