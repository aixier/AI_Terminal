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
- ⚡ 简化的Claude命令执行接口

**版本信息：**
- **当前版本**: v3.10.33
- **更新日期**: 2025-08-19
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

### 2.6 其他终端接口
- `GET /api/terminal/folders/:folderId/cards` - 获取文件夹中的卡片
- `GET /api/terminal/card/html/:folderId/:fileName` - 获取卡片HTML内容
- `POST /api/terminal/save-html` - 保存HTML内容
- `GET /api/terminal/templates` - 获取模板列表
- `POST /api/terminal/save-card` - 保存卡片
- `DELETE /api/terminal/card` - 删除卡片
- `PUT /api/terminal/folder/rename` - 重命名文件夹
- `PUT /api/terminal/card/rename` - 重命名卡片
- `POST /api/terminal/cleanup` - 清理资源
- `GET /api/terminal/health` - 健康检查

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

> 📖 **详细文档**: 请参阅 [Card Generation API Reference](/docs/api/card-generation-api.md)

### 5.1 生成卡片 (标准版)
```
POST /api/generate/card
```

**描述：** 使用AI生成知识卡片，支持动态参数生成

**请求体：**
```json
{
  "topic": "人工智能发展史",
  "templateName": "daily-knowledge-card-template.md"
}
```

**特殊模板参数生成：**
- **cardplanet-Sandra**: 自动生成 style、language、reference 三个参数
- **cardplanet-Sandra-cover/cardplanet-Sandra-json**: 自动生成 cover、style、language、reference 四个参数
  - **cover**: 根据主题特点选择默认封面或小红书封面
  - **style**: 根据主题类别自动选择合适风格
  - **language**: 根据主题判断语言类型（中文/英文/中英双语）
  - **reference**: 自动检索主题相关内容（500字以内）

**内部处理流程：**（v3.10.27 更新）
1. 参数验证和主题清理
2. 判断模板类型（单文件 .md 或文件夹模板）
3. 如果是 cardplanet-Sandra 模板，调用 `claudeExecutorDirect.generateCardParameters()`：
   - 使用与 `/api/generate/cc` 相同的底层机制（echo pipe + Claude CLI）
   - 一次性生成三个参数的 JSON 响应（60秒超时，优化后的时间）
   - 智能解析 Claude 响应：支持 markdown 代码块（```json...```）和纯 JSON 格式
   - 提取并验证 style、language、reference 参数
4. 构建完整提示词，嵌入动态生成的真实参数
5. 执行 Claude 命令生成卡片内容
6. 监控文件生成（每2秒检查，最多7分钟）
7. 返回生成结果（支持 JSON 和 HTML 格式）

**参数生成示例响应：**
```json
{
  "style": "技术教学风格 - 系统性讲解复杂技术概念，注重逻辑结构和实例说明",
  "language": "英文",
  "reference": "区块链基础涵盖分布式账本技术、加密哈希、共识机制、去中心化网络、智能合约等核心概念。重点理解区块链的不可篡改性、透明性和去信任化特征，以及在数字货币、供应链管理等领域的应用。"
}
```

**响应：**
```json
{
  "code": 200,
  "success": true,
  "data": {
    "content": "生成的卡片内容（HTML或JSON）...",
    "topic": "人工智能发展史",
    "templateName": "daily-knowledge-card-template.md",
    "fileName": "generated_file.json",
    "filePath": "/app/data/users/default/card/...",
    "generationTime": 120000,
    "pageinfo": {  // 仅当 templateName 为 cardplanet-Sandra-json 时存在
      "title": "卡片标题",
      "cards": [...],
      "metadata": {...}
    },
    "allFiles": [  // 当生成多个文件时存在
      { "fileName": "file.html", "fileType": "html", "path": "..." },
      { "fileName": "file.json", "fileType": "json", "path": "..." }
    ]
  }
}
```

**特殊字段说明：**
- **pageinfo**: 仅在使用 `cardplanet-Sandra-json` 模板时返回，包含解析后的 JSON 数据
- **allFiles**: 当模板生成多个文件时（如 cardplanet-Sandra-json 生成 HTML 和 JSON），返回所有文件信息

### 5.2 生成卡片 (流式版本)
```
POST /api/generate/card/stream
```

**描述：** 使用流式传输生成卡片，支持实时显示生成过程

**请求体：** 同5.1

**响应：** Server-Sent Events流

**事件类型及Schema：**

#### `folder_created` - 文件夹创建事件
```json
{
  "folderName": "sanitized_topic_name",
  "folderPath": "/path/to/folder",
  "folderCreated": true,
  "folderExisted": false,
  "requestId": "stream_123456789_abc"
}
```

#### `status` - 状态更新事件
```json
{
  "step": "generating_prompt_parameters | executing_claude | claude_executed | waiting_file_generation | processing_metadata | generating_additional_files",
  "requestId": "stream_123456789_abc"
}
```

#### `parameter_progress` - 参数生成进度
```json
{
  "param": "all",
  "status": "generating",
  "requestId": "stream_123456789_abc"
}
```

#### `parameters` - 参数生成完成
```json
{
  "style": "生成的风格参数",
  "language": "生成的语言参数", 
  "reference": "参考内容摘要...",
  "cover": "封面类型", // 仅cardplanet-Sandra-cover和cardplanet-Sandra-json模板
  "requestId": "stream_123456789_abc"
}
```

#### `log` - 日志消息
```json
{
  "message": "日志消息内容",
  "requestId": "stream_123456789_abc"
}
```

#### `start` - 开始生成
```json
{
  "topic": "原始主题",
  "sanitizedTopic": "清理后的主题名",
  "templatePath": "/path/to/template",
  "userCardPath": "/path/to/user/card",
  "requestId": "stream_123456789_abc"
}
```

#### `command` - 执行命令
```json
{
  "prompt": "完整的提示词内容",
  "requestId": "stream_123456789_abc"
}
```

#### `session` - 会话信息
```json
{
  "apiId": "session_id",
  "requestId": "stream_123456789_abc"
}
```

#### `output` - 实时输出
```json
{
  "data": "Claude输出的实时内容",
  "timestamp": 1756478120942,
  "requestId": "stream_123456789_abc"
}
```

#### `success` - 生成成功
```json
{
  "topic": "原始主题",
  "sanitizedTopic": "清理后的主题名",
  "templateName": "模板名称",
  "fileName": "主文件名",
  "filePath": "/path/to/main/file",
  "generationTime": 120000,
  "content": "主文件内容（HTML或JSON对象）",
  "apiId": "session_id",
  "allFiles": [ // 多文件模板时包含
    {
      "fileName": "file1.html",
      "path": "/path/to/file1",
      "fileType": "html"
    },
    {
      "fileName": "file2.json", 
      "path": "/path/to/file2",
      "fileType": "json"
    }
  ],
  "pageinfo": { /* JSON数据 */ }, // 仅cardplanet-Sandra-json模板
  "requestId": "stream_123456789_abc"
}
```

#### `four_file_generation` - 四文件生成结果（仅daily模板）
```json
{
  "success": true,
  "files": ["file1.json", "file2.html", "file3.md", "file4.txt"],
  "errors": [], // success为false时包含错误信息
  "requestId": "stream_123456789_abc"
}
```

#### `metadata_saved` - 元数据保存完成
```json
{
  "metaFilePath": "metadata_filename.json",
  "requestId": "stream_123456789_abc"
}
```

#### `cleanup` - 资源清理完成
```json
{
  "apiId": "session_id",
  "totalRequestTime": 125000,
  "memoryUsage": {
    "rss": 123456789,
    "heapTotal": 67890123,
    "heapUsed": 45678901,
    "external": 12345678
  },
  "requestId": "stream_123456789_abc"
}
```

#### `error` - 错误事件
```json
{
  "message": "错误描述",
  "errorCode": "E001_CONCURRENT_LIMIT | E002_RESOURCE_UNAVAILABLE | E003_TIMEOUT | E004_CLAUDE_API_ERROR | E005_FILE_GENERATION_ERROR | E006_PARAMETER_GENERATION_ERROR | E007_TEMPLATE_NOT_FOUND",
  "stage": "parameter_generation | execution | file_generation", // 可选，指示错误发生的阶段
  "apiId": "session_id", // 可选
  "totalRequestTime": 125000, // 可选
  "activeStreamsCount": 3, // 可选
  "templateName": "模板名", // 可选，模板相关错误时包含
  "templatePath": "/path/to/template", // 可选，模板相关错误时包含
  "details": "详细错误信息", // 可选
  "requestId": "stream_123456789_abc"
}
```

**事件流程示例：**
1. `folder_created` - 创建文件夹
2. `status` (generating_prompt_parameters) - 开始生成参数
3. `parameter_progress` - 参数生成进度
4. `parameters` - 参数生成完成
5. `start` - 开始主要生成过程
6. `command` - 执行Claude命令
7. `session` - 会话建立
8. `status` (executing_claude) - 执行Claude
9. `output` (多次) - 实时输出内容
10. `status` (claude_executed) - Claude执行完成
11. `status` (waiting_file_generation) - 等待文件生成
12. `log` (多次) - 文件检测日志
13. `success` - 生成成功
14. `status` (processing_metadata) - 处理元数据
15. `metadata_saved` - 元数据保存完成
16. `cleanup` - 清理完成

### 5.3 获取模板列表
```
GET /api/generate/templates
```

**描述：** 获取所有可用的生成模板

### 5.4 获取生成状态
```
GET /api/generate/status/:topic
```

**描述：** 获取特定主题的卡片生成状态

### 5.5 直接执行Claude命令 ⭐ 新增
```
POST /api/generate/cc
```

**描述：** 简化的Claude命令执行接口，直接发送prompt获取AI响应，无需复杂的卡片生成流程

**请求体：**
```json
{
  "prompt": "什么是人工智能？用一句话回答。",
  "timeout": 15000
}
```

**参数说明：**
- `prompt`: 要发送给Claude的提示词（必需）
- `timeout`: 执行超时时间，单位毫秒（可选，默认30000，最大600000）

**内部实现逻辑：**（v3.10.21 更新）
1. 使用 echo pipe 方式执行 Claude CLI（避免 TTY 交互问题）
2. 命令格式：`echo "${prompt}" | claude --dangerously-skip-permissions`
3. 通过 child_process.spawn 执行 shell 命令
4. 等待命令执行完成或超时
5. 返回 Claude 的响应输出
6. 执行时间通常在 7-10 秒之间

**响应：**
```json
{
  "code": 200,
  "success": true,
  "output": "人工智能是让计算机模拟人类智能行为的技术。",
  "executionTime": 6711
}
```

**错误响应：**
```json
{
  "code": 408,
  "success": false,
  "message": "执行超时",
  "timeout": 15000,
  "partialOutput": "部分输出内容..."
}
```

**使用场景：**
- 快速获取AI回答，无需生成完整卡片
- 简单的问答交互
- 测试Claude连接和功能
- 轻量级AI调用场景

**示例调用：**
```javascript
// JavaScript
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

```bash
# cURL
curl -X POST http://localhost:6000/api/generate/cc \
  -H "Content-Type: application/json" \
  -d '{"prompt": "什么是元宇宙？", "timeout": 10000}'
```

---

## 6. 文件上传 API (`/api/upload`)

### 6.1 上传多个文件
```
POST /api/upload/files
```

**描述：** 批量上传文件

**请求格式：** multipart/form-data

### 6.2 上传单个文件
```
POST /api/upload/file
```

### 6.3 创建文件夹
```
POST /api/upload/folder
```

### 6.4 获取文件结构
```
GET /api/upload/structure
```

### 6.5 删除文件或文件夹
```
DELETE /api/upload/:type/:name
```

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

### 7.2 刷新SSE连接
```
POST /api/sse/refresh
```

### 7.3 获取SSE状态
```
GET /api/sse/status
```

---

## 8. 预览 API (`/api/preview`)

### 8.1 获取元数据
```
POST /api/preview/metadata
```

### 8.2 获取内容
```
POST /api/preview/content
```

### 8.3 生成截图
```
POST /api/preview/screenshot
```

### 8.4 代理请求
```
POST /api/preview/proxy
```

---

## 9. 工作空间 API (`/api/workspace`)

### 9.1 获取用户工作空间信息
```
GET /api/workspace/:username
```

### 9.2 获取工作空间文件列表
```
GET /api/workspace/:username/files
```

### 9.3 创建工作空间文件
```
POST /api/workspace/:username/create
```

### 9.4 读取工作空间文件
```
GET /api/workspace/:username/file/*
```

### 9.5 更新工作空间文件
```
PUT /api/workspace/:username/file/*
```

### 9.6 删除工作空间文件
```
DELETE /api/workspace/:username/file/*
```

### 9.7 迁移工作空间
```
POST /api/workspace/:username/migrate
```

---

## WebSocket 连接

### 终端WebSocket
```
ws://localhost:6000/ws/terminal
```

**描述：** 实时终端交互WebSocket连接

### Socket.IO连接
```
ws://localhost:6000/socket.io
```

**描述：** Socket.IO实时通信

---

## 核心服务说明

### ApiTerminalService (v3.33+简化版)

**位置：** `terminal-backend/src/utils/apiTerminalService.js`

#### executeClaude() 方法
```javascript
async executeClaude(apiId, prompt) {
  const terminal = await this.createTerminalSession(apiId)
  
  // 直接执行claude命令，使用-p参数传递prompt
  const command = `claude --dangerously-skip-permissions -p "${prompt.replace(/"/g, '\\"')}"`
  terminal.pty.write(command + '\r')
  
  return true
}
```

**优势：**
- ✅ 无需复杂初始化流程
- ✅ 响应速度更快
- ✅ 代码更简洁
- ✅ 错误率更低

#### getLastOutput() 方法
```javascript
async getLastOutput(apiId) {
  const outputBuffer = this.outputBuffers.get(apiId) || []
  // 获取并清理最后的输出内容
  return cleanedOutput
}
```

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
// 1. 登录获取Token（可选）
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
    'Authorization': `Bearer ${token}` // 可选
  },
  body: JSON.stringify({
    topic: '量子计算',
    templateName: 'cardplanet-Sandra' // 将自动生成style、language、reference参数
  })
});

// 3. 获取生成结果
const result = await generateResponse.json();
console.log('生成的卡片内容:', result.data.content);
```

### 使用CC接口快速执行Claude命令

```javascript
// 无需认证，直接调用
const response = await fetch('http://localhost:6000/api/generate/cc', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: '用Python写一个快速排序算法',
    timeout: 30000
  })
});

const result = await response.json();
if (result.success) {
  console.log('Claude响应:', result.output);
  console.log('执行时间:', result.executionTime, 'ms');
} else {
  console.error('执行失败:', result.message);
}
```

### 流式生成示例

```javascript
const eventSource = new EventSource('/api/generate/card/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ topic: 'AI发展史' })
});

eventSource.addEventListener('start', (e) => {
  console.log('开始生成:', e.data);
});

eventSource.addEventListener('progress', (e) => {
  console.log('生成进度:', e.data);
});

eventSource.addEventListener('success', (e) => {
  console.log('生成成功:', e.data);
  eventSource.close();
});

eventSource.addEventListener('error', (e) => {
  console.error('生成失败:', e.data);
  eventSource.close();
});
```

---

## 版本历史

### v3.10.33 (2025-08-19)
- 🔧 **修复 HTML/JSON 文件预览问题**
- 📁 **前后端ID格式统一**：使用完整文件路径作为文件夹和文件ID
- 🔍 **递归文件夹查找**：支持在嵌套子文件夹中查找目标文件
- 📝 **完整的API请求日志**：前端请求参数和后端响应详细记录
- 🎯 **路径处理修复**：相对路径正确解析到用户工作区目录
- ✅ **现在支持**：HTML、JSON、Markdown 文件正确预览和API调用

**文件预览问题解决方案：**
1. **问题原因**：后端工作区API返回的数据结构没有设置`id`字段，导致前端无法匹配文件夹
2. **解决方案**：修改`transformFolder`函数，使用完整路径作为ID
3. **ID格式**：文件夹ID=`folder.path`，文件ID=`file.path`
4. **递归查找**：实现`findFolderRecursive`函数支持嵌套文件夹查找
5. **API调用**：正确发起`GET /api/terminal/card?path=完整文件路径`请求

### v3.10.27 (2025-08-19)
- 🔧 修复 cardplanet-Sandra 模板参数生成 JSON 解析问题
- ⏱️  优化参数生成超时：15秒 → 60秒，提高成功率
- 🧠 智能解析 Claude 响应：支持 markdown 代码块（```json...```）和纯 JSON
- ✅ 现在可正确提取动态生成的 style、language、reference 参数
- 🎯 完善日志追踪系统，便于调试和监控

### v3.10.21 (2025-01-19)
- 🐛 修复 `/api/generate/cc` 接口在容器中执行超时问题
- 🔧 改进 Claude CLI 执行方式，使用 echo pipe 避免 TTY 交互
- ⚡ 优化响应时间，稳定在 7-10 秒
- 📝 更新 node-pty 与 Claude CLI 集成文档

### v3.10.3 (2025-01-19)
- ✨ 新增 `/api/generate/cc` 接口，支持直接执行Claude命令
- ✨ 添加动态参数生成功能（style、language、referenceContent）
- ✨ 新增工作空间管理API (`/api/workspace`)
- 🔧 优化卡片生成流程，移除文件系统依赖
- 🐛 修复终端会话管理问题
- 📝 完善API文档

### v3.33+ (历史版本)
- ✨ 引入简化的 `executeClaude` 方法
- ❌ 废弃复杂的 `initializeClaude` 流程
- 🚀 提升Claude命令执行效率

### v3.9.8 (2025-01-06)
- 📱 移动端终端优化
- 🔐 修复token失效时的登录重定向问题
- ✨ 实现终端和预览窗口可拖动分隔栏功能

---

## 迁移指南

### 从旧版本迁移到v3.33+

#### 旧代码（已废弃）
```javascript
// 复杂的初始化流程
await apiTerminalService.initializeClaude(apiId)
await apiTerminalService.sendTextAndControl(apiId, prompt, '\r', 1000)
```

#### 新代码（推荐）
```javascript
// 直接执行，无需初始化
await apiTerminalService.executeClaude(apiId, prompt)
```

### 废弃的方法

以下方法在 v3.33+ 中已废弃：
- ❌ `initializeClaude()` - 使用 `executeClaude()` 替代
- ❌ `sendTextAndControl()` - 由 `executeClaude()` 内部处理
- ❌ 复杂的Claude初始化流程
- ❌ 主题选择处理
- ❌ 权限确认处理

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
  -e ANTHROPIC_AUTH_TOKEN="your_token" \
  -e ANTHROPIC_BASE_URL="your_api_url" \
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
ANTHROPIC_AUTH_TOKEN=your_token_here
ANTHROPIC_BASE_URL=http://your_relay_server:3000/api/

# 数据路径
DATA_PATH=/app/data
LOG_PATH=/app/logs
```

---

## 注意事项

1. **Prompt 转义**：`executeClaude` 方法会自动处理 prompt 中的引号转义
2. **会话管理**：记得调用 `destroySession()` 清理会话资源
3. **超时设置**：
   - 卡片生成默认超时：7分钟 (420000ms)
   - CC接口默认超时：30秒 (30000ms)
   - CC接口最大超时：10分钟 (600000ms)
4. **并发支持**：每个API请求使用独立的会话ID
5. **输出清理**：CC接口会自动清理ANSI转义序列和终端提示符

---

## 联系方式

- **项目地址**: https://github.com/aixier/AI_Terminal
- **问题反馈**: 请在GitHub Issues中提交
- **技术支持**: 通过项目Wiki获取更多信息

---

*本文档最后更新于 2025-01-19*