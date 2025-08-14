# AI Terminal Backend API 文档

## 项目概述

AI Terminal Backend 是一个功能强大的Web终端后端服务，支持AI卡片生成、实时终端交互、文件管理等核心功能。本文档详细描述了所有可用的API端点。

**核心特性：**
- 🤖 AI驱动的智能卡片生成 (Claude + Gemini)
- 📺 实时终端交互 (XTerm.js + Socket.IO)
- 📁 文件系统管理与上传
- 🔄 Server-Sent Events 实时推送
- 🎨 动态模板系统

---

## 基础信息

- **Base URL**: `http://localhost:6000`
- **API 版本**: v3.37+
- **数据格式**: JSON
- **认证方式**: JWT (目前禁用，使用默认用户)

### 通用响应格式

```json
{
  "code": 200,
  "success": true,
  "data": {},
  "message": "操作成功"
}
```

---

## 1. 认证 API (`/api/auth`)

### 1.1 用户登录
```
POST /api/auth/login
```

**请求体：**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**响应：**
```json
{
  "code": 200,
  "data": {
    "token": "jwt_token_here",
    "user": {
      "id": 1,
      "username": "admin",
      "role": "admin"
    }
  },
  "message": "登录成功"
}
```

### 1.2 验证Token
```
GET /api/auth/verify
```

**请求头：**
```
Authorization: Bearer <token>
```

---

## 2. 终端管理 API (`/api/terminal`)

### 2.1 获取所有会话
```
GET /api/terminal/sessions
```

**响应：**
```json
{
  "code": 200,
  "data": [
    {
      "id": "term_123",
      "created": "2024-01-01T00:00:00.000Z",
      "lastActivity": "2024-01-01T01:00:00.000Z",
      "cols": 80,
      "rows": 24,
      "pid": 12345,
      "alive": true
    }
  ],
  "message": "success"
}
```

### 2.2 获取单个会话信息
```
GET /api/terminal/sessions/:sessionId
```

### 2.3 删除会话
```
DELETE /api/terminal/sessions/:sessionId
```

### 2.4 获取用户文件夹列表
```
GET /api/terminal/folders
```

**响应：**
```json
{
  "code": 200,
  "success": true,
  "folders": [
    {
      "id": "default-folder",
      "name": "默认文件夹",
      "description": "默认卡片文件夹",
      "cardCount": 15,
      "color": "#0078d4",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### 2.5 获取卡片目录结构
```
GET /api/terminal/cards-directory
```

**响应：**
```json
{
  "code": 200,
  "success": true,
  "folders": [
    {
      "id": "AI技术",
      "name": "AI技术",
      "path": "/path/to/cards/AI技术",
      "cards": [
        {
          "id": "AI技术-content",
          "name": "content.json",
          "path": "/path/to/cards/AI技术/content.json",
          "type": "json"
        }
      ]
    }
  ]
}
```

### 2.6 执行终端命令
```
POST /api/terminal/execute
```

**请求体：**
```json
{
  "command": "claude -p \"生成关于人工智能的卡片\"",
  "type": "generate-card",
  "topic": "人工智能"
}
```

### 2.7 获取公共模板列表
```
GET /api/terminal/templates
```

**响应：**
```json
{
  "code": 200,
  "success": true,
  "templates": [
    {
      "fileName": "daily-knowledge-card-template.md",
      "displayName": "daily knowledge card template",
      "type": "file"
    },
    {
      "fileName": "cardplanet-Sandra",
      "displayName": "cardplanet-Sandra",
      "type": "folder"
    }
  ]
}
```

### 2.8 健康检查
```
GET /api/terminal/health
```

---

## 3. 命令管理 API (`/api/commands`)

### 3.1 获取所有命令
```
GET /api/commands
```

### 3.2 验证命令
```
POST /api/commands/validate
```

**请求体：**
```json
{
  "command": "claude -p \"生成卡片\""
}
```

### 3.3 获取命令历史
```
GET /api/commands/history?days=7
```

**请求头：**
```
x-user-id: user123
```

### 3.4 保存命令历史
```
POST /api/commands/history
```

---

## 4. Claude AI API (`/api/claude`)

### 4.1 执行AI命令
```
POST /api/claude/execute
```

**请求体：**
```json
{
  "command": "claude -p \"根据模板生成关于机器学习的知识卡片\"",
  "type": "generate-card",
  "topic": "机器学习"
}
```

### 4.2 获取用户文件夹
```
GET /api/claude/folders
```

### 4.3 健康检查
```
GET /api/claude/health
```

### 4.4 清理会话
```
POST /api/claude/cleanup
```

---

## 5. 卡片生成 API (`/api/generate`)

### 5.1 生成卡片 (标准版)
```
POST /api/generate/card
```

**请求体：**
```json
{
  "topic": "人工智能发展史",
  "templateName": "daily-knowledge-card-template.md"
}
```

**响应：**
```json
{
  "code": 200,
  "success": true,
  "data": {
    "topic": "人工智能发展史",
    "sanitizedTopic": "人工智能发展史",
    "templateName": "daily-knowledge-card-template.md",
    "fileName": "content.json",
    "filePath": "/path/to/generated/file",
    "generationTime": 45000,
    "content": {
      "cards": [
        {
          "id": 1,
          "title": "人工智能发展史",
          "content": "人工智能的发展历程...",
          "category": "技术",
          "tags": ["AI", "历史", "技术发展"]
        }
      ]
    },
    "apiId": "card_1234567890_abcdef"
  },
  "message": "卡片生成成功"
}
```

### 5.2 流式生成卡片 (支持 SSE)
```
POST /api/generate/card/stream
```

**响应类型：** `text/event-stream`

**SSE 事件类型：**
- `start` - 生成开始
- `command` - 执行的命令
- `session` - 会话信息
- `output` - 实时输出
- `success` - 生成成功
- `error` - 生成失败
- `cleanup` - 清理完成

**示例事件：**
```
event: start
data: {"topic":"人工智能","sanitizedTopic":"人工智能","templatePath":"/path/to/template"}

event: output
data: {"data":"正在生成卡片...","timestamp":1640995200000}

event: success
data: {"topic":"人工智能","fileName":"content.json","content":{...}}
```

### 5.3 获取模板列表
```
GET /api/generate/templates
```

### 5.4 查询生成状态
```
GET /api/generate/status/:topic
```

**响应：**
```json
{
  "code": 200,
  "success": true,
  "status": "completed",
  "files": ["content.json"],
  "message": "生成完成"
}
```

---

## 6. 文件上传 API (`/api/upload`)

### 6.1 上传文件 (多文件)
```
POST /api/upload/files
```

**Content-Type:** `multipart/form-data`

**表单字段：**
- `files` - 文件数组
- `folderPath` - 目标文件夹路径 (可选)

**响应：**
```json
{
  "success": true,
  "data": {
    "files": [
      {
        "filename": "template.md",
        "originalName": "my-template.md",
        "size": 1024,
        "path": "/app/data/public_template/template.md",
        "folderPath": ""
      }
    ],
    "count": 1
  },
  "message": "成功上传 1 个文件"
}
```

### 6.2 创建文本文件
```
POST /api/upload/file
```

**请求体：**
```json
{
  "filename": "new-template.md",
  "content": "# 新模板\n\n这是一个新的模板文件...",
  "folderPath": "templates"
}
```

### 6.3 创建文件夹
```
POST /api/upload/folder
```

**请求体：**
```json
{
  "folderName": "my-new-folder"
}
```

### 6.4 获取目录结构
```
GET /api/upload/structure
```

**响应：**
```json
{
  "success": true,
  "data": [
    {
      "type": "folder",
      "name": "cardplanet-Sandra",
      "children": [
        {
          "type": "file",
          "name": "CLAUDE.md",
          "size": 2048,
          "modified": "2024-01-01T00:00:00.000Z"
        }
      ]
    }
  ]
}
```

### 6.5 删除文件或文件夹
```
DELETE /api/upload/:type/:name
```

**参数：**
- `type` - `file` 或 `folder`
- `name` - 文件/文件夹名称

---

## 7. 预览 API (`/api/preview`)

### 7.1 获取网页元数据
```
POST /api/preview/metadata
```

**请求体：**
```json
{
  "url": "https://example.com"
}
```

**响应：**
```json
{
  "title": "网页标题",
  "description": "网页描述",
  "images": ["https://example.com/image.jpg"],
  "siteName": "example.com",
  "favicon": "https://example.com/favicon.ico",
  "author": "作者",
  "publishDate": "2024-01-01T00:00:00.000Z",
  "keywords": "关键词1,关键词2"
}
```

### 7.2 代理请求 (解决CORS)
```
POST /api/preview/proxy
```

**请求体：**
```json
{
  "url": "https://example.com"
}
```

**注意：** 内容提取和截图功能已禁用

---

## 8. Server-Sent Events API (`/api/sse`)

### 8.1 建立SSE连接
```
GET /api/sse/stream
```

**响应类型：** `text/event-stream`

**事件类型：**
- `connected` - 连接成功
- `file:added` - 文件添加
- `file:changed` - 文件修改
- `file:deleted` - 文件删除
- `folder:added` - 文件夹添加
- `folder:deleted` - 文件夹删除
- `refresh` - 刷新请求

**示例事件：**
```
event: file:added
data: {"type":"file:added","data":{"path":"/path/to/file","action":"add"},"timestamp":"2024-01-01T00:00:00.000Z"}
```

### 8.2 手动触发刷新
```
POST /api/sse/refresh
```

### 8.3 获取连接状态
```
GET /api/sse/status
```

**响应：**
```json
{
  "connected_clients": 3,
  "watcher_active": true,
  "watch_dir": "/app/data/users/default/folders/default-folder/cards"
}
```

---

## 9. WebSocket 终端 (Socket.IO)

### 连接地址
```
ws://localhost:6000/socket.io
```

### 事件类型

**客户端发送：**
- `terminal:create` - 创建终端
- `terminal:input` - 发送输入
- `terminal:resize` - 调整大小
- `ping` - 心跳检测

**服务端发送：**
- `terminal:ready` - 终端就绪
- `terminal:output` - 终端输出
- `terminal:error` - 错误信息
- `terminal:exit` - 终端退出
- `pong` - 心跳响应

**示例使用：**
```javascript
import { io } from 'socket.io-client'

const socket = io('http://localhost:6000')

// 创建终端
socket.emit('terminal:create', { cols: 80, rows: 24 })

// 监听输出
socket.on('terminal:output', (data) => {
  console.log('终端输出:', data)
})

// 发送命令
socket.emit('terminal:input', 'ls -la\r')
```

---

## 10. 错误处理

### 错误响应格式
```json
{
  "code": 500,
  "success": false,
  "message": "错误描述",
  "error": "详细错误信息"
}
```

### 常见错误代码
- `400` - 参数错误
- `401` - 认证失败
- `403` - 权限不足
- `404` - 资源不存在
- `409` - 资源冲突
- `500` - 服务器内部错误
- `501` - 功能未实现

---

## 11. 环境配置

### 环境变量
```bash
# 服务配置
NODE_ENV=production
PORT=6000
HOST=0.0.0.0

# 数据路径
DATA_PATH=/app/data
STATIC_PATH=/app/static
SERVE_STATIC=true

# CORS配置
ALLOWED_ORIGINS=http://localhost:5173,https://yourdomain.com

# JWT配置
JWT_SECRET=your_secret_key
JWT_EXPIRE_TIME=24h

# AI API配置
ANTHROPIC_API_KEY=your_claude_api_key
GEMINI_API_KEY=your_gemini_api_key

# 会话配置
MAX_TERMINAL_SESSIONS=10
TERMINAL_TIMEOUT=600000
```

### Docker 支持
- 自动检测Docker环境
- 支持数据卷挂载
- 环境变量优先级配置

---

## 12. 性能优化

### API 响应时间
- 标准API: < 100ms
- AI生成: 30-420秒 (取决于模板复杂度)
- 文件上传: < 5秒
- SSE连接: < 50ms

### 并发支持
- 最大终端会话: 10个 (可配置)
- 文件上传限制: 100个文件/10MB
- SSE并发连接: 无限制

### 缓存策略
- 静态文件: 长期缓存
- API响应: 无缓存
- 模板文件: 实时更新

---

## 13. 安全特性

### 文件安全
- 路径遍历防护
- 文件类型过滤
- 大小限制
- 危险字符清理

### API安全
- CORS配置
- 请求大小限制
- 错误信息脱敏
- 认证中间件支持

---

## 更新日志

### v3.37 (2024-08-14)
- ✅ 添加 Gemini CLI 支持
- ✅ 优化流式API性能
- ✅ 增强文件上传功能
- ✅ 完善多用户会话管理

### v3.33+ 
- ✅ 简化Claude命令执行流程
- ✅ 支持文件夹模板
- ✅ 实时文件系统监控
- ✅ Docker环境优化

---

**技术支持：** 如有问题请提交 Issue 到项目仓库
**更新频率：** 持续更新，跟随项目版本发布