# AI Terminal Backend API 文档

## 项目概述

AI Terminal Backend 是一个功能强大的Web终端后端服务，支持AI卡片生成、实时终端交互、文件管理等核心功能。本文档详细描述了所有可用的API端点。

**核心特性：**
- 🤖 AI驱动的智能卡片生成 (Claude + Gemini)
- 📺 实时终端交互 (XTerm.js + Socket.IO)
- 📁 文件系统管理与上传
- 🔄 Server-Sent Events 实时推送
- 🎨 动态模板系统
- 📝 工作空间管理

**版本信息：**
- **当前版本**: v3.10.3
- **更新日期**: 2025-01-19
- **API 版本**: v1.0

---

## 基础信息

- **Base URL**: `http://localhost:6000`
- **数据格式**: JSON
- **认证方式**: JWT Token认证系统 (支持默认用户回退)
- **字符编码**: UTF-8

### 通用响应格式

#### 成功响应
```json
{
  "code": 200,
  "success": true,
  "data": {},
  "message": "操作成功"
}
```

#### 错误响应
```json
{
  "code": 400,
  "success": false,
  "error": "错误详情",
  "message": "错误说明"
}
```

### 认证方式

大部分API需要在请求头中携带认证信息：
```
Authorization: Bearer <token>
```

部分API支持默认用户回退机制，无需认证即可使用。

---

## 1. 认证 API (`/api/auth`)

### 1.1 用户登录
```
POST /api/auth/login
```

**描述：** 用户登录认证，获取访问令牌

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
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "username": "admin",
    "userId": "admin_001",
    "expiresIn": 86400
  }
}
```

### 1.2 验证Token
```
GET /api/auth/verify
```

**描述：** 验证当前Token是否有效

**请求头：**
```
Authorization: Bearer <token>
```

**响应：**
```json
{
  "code": 200,
  "success": true,
  "data": {
    "valid": true,
    "username": "admin",
    "userId": "admin_001"
  }
}
```

### 1.3 获取用户列表
```
GET /api/auth/users
```

**描述：** 获取系统中所有用户信息（需要管理员权限）

---

## 2. 终端管理 API (`/api/terminal`)

### 2.1 获取所有会话
```
GET /api/terminal/sessions
```

**描述：** 获取当前所有活跃的终端会话

**响应：**
```json
{
  "success": true,
  "sessions": [
    {
      "id": "session_123",
      "created": "2025-01-19T10:00:00Z",
      "lastActivity": "2025-01-19T10:05:00Z",
      "status": "active"
    }
  ]
}
```

### 2.2 获取特定会话信息
```
GET /api/terminal/sessions/:sessionId
```

**描述：** 获取指定终端会话的详细信息

### 2.3 删除会话
```
DELETE /api/terminal/sessions/:sessionId
```

**描述：** 终止并删除指定的终端会话

### 2.4 执行命令
```
POST /api/terminal/execute
```

**描述：** 在终端中执行命令

**请求体：**
```json
{
  "command": "ls -la",
  "sessionId": "session_123"
}
```

### 2.5 获取用户文件夹
```
GET /api/terminal/folders
```

**描述：** 获取用户的所有文件夹信息

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
      "cardCount": 10,
      "color": "#0078d4",
      "createdAt": "2025-01-06T00:00:00.000Z"
    }
  ]
}
```

### 2.6 获取文件夹中的卡片
```
GET /api/terminal/folders/:folderId/cards
```

**描述：** 获取指定文件夹中的所有卡片

### 2.7 获取卡片HTML内容
```
GET /api/terminal/card/html/:folderId/:fileName
```

**描述：** 获取指定卡片的HTML内容

### 2.8 保存HTML内容
```
POST /api/terminal/save-html
```

**描述：** 保存HTML格式的卡片内容

**请求体：**
```json
{
  "folderId": "default-folder",
  "fileName": "card_001.html",
  "htmlContent": "<html>...</html>"
}
```

### 2.9 获取模板列表
```
GET /api/terminal/templates
```

**描述：** 获取所有可用的卡片模板

### 2.10 获取特定模板
```
GET /api/terminal/templates/:templateId
```

**描述：** 获取指定模板的详细内容

### 2.11 保存卡片
```
POST /api/terminal/save-card
```

**描述：** 保存新的卡片或更新现有卡片

### 2.12 删除卡片
```
DELETE /api/terminal/card
```

**描述：** 删除指定的卡片

**查询参数：**
- `folderId`: 文件夹ID
- `fileName`: 文件名

### 2.13 重命名文件夹
```
PUT /api/terminal/folder/rename
```

**描述：** 重命名文件夹

**请求体：**
```json
{
  "oldName": "旧文件夹",
  "newName": "新文件夹"
}
```

### 2.14 重命名卡片
```
PUT /api/terminal/card/rename
```

**描述：** 重命名卡片文件

### 2.15 清理资源
```
POST /api/terminal/cleanup
```

**描述：** 清理终端会话和相关资源

### 2.16 健康检查
```
GET /api/terminal/health
```

**描述：** 检查终端服务健康状态

---

## 3. 命令管理 API (`/api/commands`)

### 3.1 获取所有命令
```
GET /api/commands
```

**描述：** 获取所有可用的命令列表

### 3.2 验证命令
```
POST /api/commands/validate
```

**描述：** 验证命令语法是否正确

**请求体：**
```json
{
  "command": "claude -p \"生成卡片\""
}
```

### 3.3 获取命令历史
```
GET /api/commands/history
```

**描述：** 获取用户的命令执行历史

**查询参数：**
- `days`: 获取最近N天的历史（默认7天）

### 3.4 保存命令历史
```
POST /api/commands/history
```

**描述：** 保存命令到历史记录

---

## 4. Claude AI API (`/api/claude`)

### 4.1 执行AI命令
```
POST /api/claude/execute
```

**描述：** 执行Claude AI命令

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

**描述：** 获取Claude相关的用户文件夹

### 4.3 健康检查
```
GET /api/claude/health
```

**描述：** 检查Claude服务状态

### 4.4 清理会话
```
POST /api/claude/cleanup
```

**描述：** 清理Claude AI会话

---

## 5. 卡片生成 API (`/api/generate`)

### 5.1 生成卡片 (标准版)
```
POST /api/generate/card
```

**描述：** 使用AI生成知识卡片

**请求体：**
```json
{
  "topic": "人工智能发展史",
  "templateName": "daily-knowledge-card-template.md",
  "style": "风格描述（可选）",
  "language": "语言类型（可选）",
  "reference": "参考资料（可选）"
}
```

**响应：**
```json
{
  "code": 200,
  "success": true,
  "data": {
    "content": "生成的卡片内容...",
    "topic": "人工智能发展史",
    "template": "daily-knowledge-card-template.md",
    "generatedAt": "2025-01-19T10:00:00Z"
  }
}
```

### 5.2 生成卡片 (流式版本)
```
POST /api/generate/card/stream
```

**描述：** 使用流式传输生成卡片，支持实时显示生成过程

**请求体：** 同5.1

**响应：** Server-Sent Events流

### 5.3 获取模板列表
```
GET /api/generate/templates
```

**描述：** 获取所有可用的生成模板

**响应：**
```json
{
  "code": 200,
  "templates": [
    {
      "id": "daily-knowledge-card-template",
      "name": "每日知识卡片模板",
      "description": "用于生成每日知识卡片",
      "fields": ["topic", "style", "language"]
    }
  ]
}
```

### 5.4 获取生成状态
```
GET /api/generate/status/:topic
```

**描述：** 获取特定主题的卡片生成状态

### 5.5 直接执行Claude命令 (新增)
```
POST /api/generate/cc
```

**描述：** 直接执行Claude命令，无需复杂的卡片生成流程

**请求体：**
```json
{
  "prompt": "什么是人工智能？用一句话回答。",
  "timeout": 15000
}
```

**响应：**
```json
{
  "code": 200,
  "success": true,
  "output": "人工智能是让计算机模拟人类智能行为的技术。",
  "executionTime": 6711
}
```

**参数说明：**
- `prompt`: 要发送给Claude的提示词（必需）
- `timeout`: 执行超时时间，单位毫秒（可选，默认30000）

---

## 6. 文件上传 API (`/api/upload`)

### 6.1 上传多个文件
```
POST /api/upload/files
```

**描述：** 批量上传文件

**请求格式：** multipart/form-data

**表单字段：**
- `files`: 文件数组
- `folder`: 目标文件夹

### 6.2 上传单个文件
```
POST /api/upload/file
```

**描述：** 上传单个文件

**请求体：**
```json
{
  "fileName": "document.pdf",
  "fileData": "base64编码的文件内容",
  "folder": "documents"
}
```

### 6.3 创建文件夹
```
POST /api/upload/folder
```

**描述：** 创建新文件夹

**请求体：**
```json
{
  "folderName": "新文件夹",
  "parentPath": "/workspace"
}
```

### 6.4 获取文件结构
```
GET /api/upload/structure
```

**描述：** 获取文件系统结构

**查询参数：**
- `path`: 起始路径（可选）

### 6.5 删除文件或文件夹
```
DELETE /api/upload/:type/:name
```

**描述：** 删除指定的文件或文件夹

**参数：**
- `type`: `file` 或 `folder`
- `name`: 文件或文件夹名称

---

## 7. Server-Sent Events API (`/api/sse`)

### 7.1 建立SSE连接
```
GET /api/sse/stream
```

**描述：** 建立Server-Sent Events连接，接收实时推送

**请求头：**
```
Authorization: Bearer <token>
Accept: text/event-stream
```

**事件类型：**
- `file-detected`: 文件检测事件
- `generation-progress`: 生成进度事件
- `status-update`: 状态更新事件

### 7.2 刷新SSE连接
```
POST /api/sse/refresh
```

**描述：** 刷新SSE连接

### 7.3 获取SSE状态
```
GET /api/sse/status
```

**描述：** 获取当前SSE连接状态

---

## 8. 预览 API (`/api/preview`)

### 8.1 获取元数据
```
POST /api/preview/metadata
```

**描述：** 获取URL的元数据信息

**请求体：**
```json
{
  "url": "https://example.com"
}
```

### 8.2 获取内容
```
POST /api/preview/content
```

**描述：** 获取URL的内容

### 8.3 生成截图
```
POST /api/preview/screenshot
```

**描述：** 生成网页截图

**请求体：**
```json
{
  "url": "https://example.com",
  "width": 1920,
  "height": 1080
}
```

### 8.4 代理请求
```
POST /api/preview/proxy
```

**描述：** 通过代理获取外部资源

---

## 9. 工作空间 API (`/api/workspace`)

### 9.1 获取用户工作空间信息
```
GET /api/workspace/:username
```

**描述：** 获取指定用户的工作空间信息

**响应：**
```json
{
  "code": 200,
  "success": true,
  "data": {
    "username": "alice",
    "workspacePath": "/app/data/users/alice/workspace",
    "folders": ["card", "markdown", "projects"],
    "stats": {
      "totalFiles": 42,
      "totalSize": "15.3MB"
    }
  }
}
```

### 9.2 获取工作空间文件列表
```
GET /api/workspace/:username/files
```

**描述：** 获取用户工作空间中的所有文件

**查询参数：**
- `path`: 相对路径（可选）
- `recursive`: 是否递归获取（true/false）

### 9.3 创建工作空间文件
```
POST /api/workspace/:username/create
```

**描述：** 在工作空间中创建新文件

**请求体：**
```json
{
  "path": "projects/new-project.md",
  "content": "# New Project\n\nProject description...",
  "type": "markdown"
}
```

### 9.4 读取工作空间文件
```
GET /api/workspace/:username/file/*
```

**描述：** 读取工作空间中的特定文件

**示例：**
```
GET /api/workspace/alice/file/projects/README.md
```

### 9.5 更新工作空间文件
```
PUT /api/workspace/:username/file/*
```

**描述：** 更新工作空间中的文件内容

**请求体：**
```json
{
  "content": "更新后的文件内容"
}
```

### 9.6 删除工作空间文件
```
DELETE /api/workspace/:username/file/*
```

**描述：** 删除工作空间中的文件

### 9.7 迁移工作空间
```
POST /api/workspace/:username/migrate
```

**描述：** 迁移用户工作空间到新位置

---

## WebSocket 连接

### 终端WebSocket
```
ws://localhost:6000/ws/terminal
```

**描述：** 实时终端交互WebSocket连接

**消息格式：**
```json
{
  "type": "command",
  "data": "ls -la",
  "sessionId": "session_123"
}
```

### Socket.IO连接
```
ws://localhost:6000/socket.io
```

**描述：** Socket.IO实时通信

**事件：**
- `connect`: 连接建立
- `terminal:create`: 创建终端
- `terminal:input`: 终端输入
- `terminal:output`: 终端输出
- `terminal:resize`: 调整终端大小

---

## 错误码说明

| 错误码 | 说明 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未认证 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 408 | 请求超时 |
| 429 | 请求过于频繁 |
| 500 | 服务器内部错误 |
| 502 | 网关错误 |
| 503 | 服务不可用 |

---

## 使用示例

### 完整的卡片生成流程

```javascript
// 1. 登录获取Token
const loginResponse = await fetch('http://localhost:6000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'admin',
    password: 'admin123'
  })
});
const { data: { token } } = await loginResponse.json();

// 2. 生成卡片
const generateResponse = await fetch('http://localhost:6000/api/generate/card', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    topic: '量子计算',
    templateName: 'daily-knowledge-card-template.md'
  })
});

// 3. 获取生成结果
const result = await generateResponse.json();
console.log('生成的卡片内容:', result.data.content);
```

### 使用新的CC接口快速执行Claude命令

```javascript
// 直接执行Claude命令，无需认证
const response = await fetch('http://localhost:6000/api/generate/cc', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: '解释什么是区块链技术',
    timeout: 20000
  })
});

const result = await response.json();
console.log('Claude回复:', result.output);
```

---

## 部署说明

### Docker部署

```bash
# 构建镜像
docker build -f DockerfileProduct -t ai-terminal:v3.10.3 .

# 运行容器
docker run -d \
  --name ai-terminal \
  -p 6000:6000 \
  -v $(pwd)/data:/app/data \
  ai-terminal:v3.10.3
```

### 环境变量配置

```env
# 服务配置
NODE_ENV=production
PORT=6000
HOST=0.0.0.0

# 认证配置
JWT_SECRET=your-secret-key
JWT_EXPIRE_TIME=86400

# Claude配置
ANTHROPIC_API_KEY=your-api-key

# 数据路径
DATA_PATH=/app/data
LOG_PATH=/app/logs
```

---

## 更新日志

### v3.10.3 (2025-01-19)
- ✨ 新增 `/api/generate/cc` 接口，支持直接执行Claude命令
- ✨ 添加动态参数生成功能（style、language、referenceContent）
- ✨ 新增工作空间管理API (`/api/workspace`)
- 🔧 优化卡片生成流程，移除文件系统依赖
- 🐛 修复终端会话管理问题
- 📝 完善API文档

### v3.9.8 (2025-01-06)
- 📱 移动端终端优化
- 🔐 修复token失效时的登录重定向问题
- ✨ 实现终端和预览窗口可拖动分隔栏功能

---

## 联系方式

- **项目地址**: https://github.com/aixier/AI_Terminal
- **问题反馈**: 请在GitHub Issues中提交
- **技术支持**: 通过项目Wiki获取更多信息

---

*本文档最后更新于 2025-01-19*