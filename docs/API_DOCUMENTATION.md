# AI Terminal API 文档

## 版本信息
- **版本**: V4.5.0
- **更新日期**: 2025-09-05
- **基础路径**: `http://localhost:8083` (开发环境)

## 目录

1. [认证相关 API](#认证相关-api)
2. [终端相关 API](#终端相关-api)
3. [卡片生成 API](#卡片生成-api)
4. [素材管理 API](#素材管理-api)
5. [工作空间 API](#工作空间-api)
6. [SSE 实时通信 API](#sse-实时通信-api)
7. [预览相关 API](#预览相关-api)
8. [转录相关 API](#转录相关-api)
9. [Claude 执行 API](#claude-执行-api)
10. [命令相关 API](#命令相关-api)
11. [文件上传 API](#文件上传-api)

---

## 认证相关 API

### POST /api/auth/login
用户登录

**请求体**:
```json
{
  "username": "string",
  "password": "string"
}
```

**响应**:
```json
{
  "code": 200,
  "success": true,
  "message": "登录成功",
  "data": {
    "token": "jwt_token",
    "username": "username",
    "isDefault": false
  }
}
```

### GET /api/auth/verify
验证 Token 有效性

**请求头**:
- `Authorization: Bearer <token>`

**响应**:
```json
{
  "code": 200,
  "success": true,
  "message": "Token有效",
  "data": {
    "username": "username",
    "isDefault": false
  }
}
```

### GET /api/auth/users
获取所有用户列表

**响应**:
```json
{
  "code": 200,
  "success": true,
  "data": ["user1", "user2", "default"]
}
```

---

## 终端相关 API

### POST /api/terminal/execute
执行终端命令

**请求体**:
```json
{
  "prompt": "命令内容",
  "sessionId": "会话ID（可选）"
}
```

**响应**:
```json
{
  "success": true,
  "sessionId": "session_id",
  "output": "命令输出结果"
}
```

### GET /api/terminal/sessions
获取所有终端会话

**响应**:
```json
{
  "success": true,
  "sessions": [
    {
      "id": "session_id",
      "createdAt": "2025-09-05T10:00:00Z",
      "isActive": true
    }
  ]
}
```

### GET /api/terminal/sessions/:sessionId
获取特定会话信息

### DELETE /api/terminal/sessions/:sessionId
销毁终端会话

### GET /api/terminal/folders
获取用户文件夹结构

**响应**:
```json
{
  "code": 200,
  "success": true,
  "data": {
    "rootFiles": [],
    "folders": [
      {
        "name": "folder_name",
        "path": "/path/to/folder",
        "type": "folder",
        "children": []
      }
    ]
  }
}
```

### GET /api/terminal/cards-directory
获取卡片目录结构

### GET /api/terminal/folders/:folderId/cards
获取文件夹中的卡片

### GET /api/terminal/templates
获取卡片模板列表

### GET /api/terminal/templates/:templateId
获取特定模板信息

### PUT /api/terminal/folder/rename
重命名文件夹

**请求体**:
```json
{
  "oldPath": "/old/path",
  "newName": "new_folder_name"
}
```

### PUT /api/terminal/card/rename
重命名卡片文件

### DELETE /api/terminal/card
删除卡片文件

**请求体**:
```json
{
  "path": "/path/to/card.json"
}
```

### GET /api/terminal/card
获取卡片内容

### POST /api/terminal/save-card
保存卡片

### GET /api/terminal/card/html/:folderId/:fileName
获取卡片HTML内容

### POST /api/terminal/fetch-and-save-html
获取并保存HTML

### POST /api/terminal/save-html
保存HTML内容

### GET /api/terminal/health
终端服务健康检查

### POST /api/terminal/cleanup
清理终端资源

---

## 卡片生成 API

### POST /api/generate/card
同步生成卡片

**请求体**:
```json
{
  "topic": "主题",
  "templateName": "模板名称（可选）",
  "style": "风格（可选）",
  "language": "语言（可选）",
  "reference": "参考内容（可选）"
}
```

### POST /api/generate/card/async
异步生成卡片

**请求体**:
```json
{
  "topic": "主题",
  "templateName": "模板名称（可选）",
  "mode": "custom/normal（可选）",
  "references": ["素材引用数组（可选）"],
  "style": "风格（可选）",
  "language": "语言（可选）",
  "reference": "参考内容（可选）",
  "token": "用户token（可选）"
}
```

**响应**:
```json
{
  "code": 200,
  "success": true,
  "data": {
    "taskId": "task_xxx",
    "folderName": "sanitized_topic_name",
    "folderPath": "/path/to/folder",
    "topic": "原始主题",
    "templateName": "使用的模板",
    "status": "submitted"
  }
}
```

### GET /api/generate/card/async/refresh/:folderName
刷新检测异步生成的文件（自定义模式）

**响应**:
```json
{
  "code": 200,
  "success": true,
  "data": {
    "files": [
      {
        "fileName": "file.md",
        "fileType": "markdown",
        "size": 1024,
        "createdAt": "2025-09-05T10:00:00Z",
        "preview": "文件内容预览..."
      }
    ],
    "totalFiles": 1,
    "status": "partial/completed",
    "mayHaveMore": true,
    "folderName": "folder_name",
    "lastChecked": "2025-09-05T10:00:00Z"
  }
}
```

### POST /api/generate/card/stream
流式生成卡片（SSE）

### GET /api/generate/card/query/:folderName
查询生成的文件内容（支持所有文件类型）

**响应**:
```json
{
  "code": 200,
  "success": true,
  "data": {
    "topic": "主题",
    "sanitizedTopic": "清理后的主题",
    "templateName": "模板名称",
    "fileName": "主文件名",
    "filePath": "主文件路径",
    "content": "文件内容或JSON对象",
    "fileType": "html/json/markdown/text等",
    "allFiles": [
      {
        "fileName": "file.json",
        "path": "/path/to/file",
        "content": "内容",
        "fileType": "json"
      }
    ]
  }
}
```

### GET /api/generate/card/content/:folderName
获取格式化的卡片内容

### GET /api/generate/status/:topic
获取生成状态

### GET /api/generate/status/task/:taskId  
通过任务ID获取状态

### GET /api/generate/templates
获取可用模板列表

**响应**:
```json
{
  "code": 200,
  "success": true,
  "templates": [
    {
      "fileName": "template.md",
      "displayName": "模板名称",
      "description": "模板描述",
      "type": "file/folder",
      "outputType": "json/html/*",
      "outputCount": 1
    }
  ]
}
```

### GET /api/generate/templates/buttons
获取快捷按钮配置

### GET /api/generate/templates/:templateId
获取单个模板信息

### POST /api/generate/cc
直接执行 Claude 命令

### POST /api/generate/share/xiaohongshu
分享到小红书

### GET /api/generate/health
生成服务健康检查

---

## 自定义生成 API

### POST /api/generate/custom/async
异步自定义生成

### GET /api/generate/custom/status/:taskId
获取自定义任务状态

### POST /api/generate/custom/ossasync
OSS异步自定义生成

### GET /api/generate/custom/ossstatus/:taskId
获取OSS任务状态

### GET /api/generate/custom/ossstatus/:taskId/mapping
获取OSS文件映射

---

## 素材管理 API

### GET /api/assets
获取素材列表

**查询参数**:
- `category`: 分类名称
- `page`: 页码（默认1）
- `pageSize`: 每页数量（默认20）

**响应**:
```json
{
  "code": 200,
  "success": true,
  "data": {
    "files": [
      {
        "id": "file_id",
        "filename": "file.jpg",
        "category": "images",
        "size": 102400,
        "type": "image/jpeg",
        "createdAt": "2025-09-05T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 100
    }
  }
}
```

### POST /api/assets/upload
上传素材文件

**请求体**: FormData
- `files`: 文件数组（最多10个）
- `category`: 分类名称

**响应**:
```json
{
  "code": 200,
  "success": true,
  "data": {
    "uploaded": [
      {
        "filename": "file.jpg",
        "category": "images",
        "size": 102400
      }
    ],
    "failed": []
  }
}
```

### GET /api/assets/categories
获取素材分类列表

**响应**:
```json
{
  "code": 200,
  "success": true,
  "data": [
    {
      "name": "images",
      "count": 10,
      "size": 1024000,
      "lastModified": "2025-09-05T10:00:00Z"
    }
  ]
}
```

### POST /api/assets/categories
创建素材分类

**请求体**:
```json
{
  "category": "新分类名称"
}
```

### PUT /api/assets/categories/:category
重命名分类

**请求体**:
```json
{
  "newName": "新分类名称"
}
```

### DELETE /api/assets/categories/:category
删除分类（包含所有文件）

### DELETE /api/assets/file
删除素材文件

**请求体**:
```json
{
  "category": "分类名称",
  "filename": "文件名"
}
```

### PUT /api/assets/file/rename
重命名素材文件

**请求体**:
```json
{
  "category": "分类名称",
  "oldFilename": "旧文件名",
  "newFilename": "新文件名"
}
```

### PUT /api/assets/file/move
移动素材文件

**请求体**:
```json
{
  "filename": "文件名",
  "fromCategory": "原分类",
  "toCategory": "目标分类"
}
```

### POST /api/assets/move
批量移动素材

### GET /api/assets/file/:category/:filename
获取素材文件

### GET /api/assets/thumbnail/:category/:filename
获取素材缩略图

### GET /api/assets/search
搜索素材

**查询参数**:
- `keyword`: 关键词
- `category`: 分类（可选）

### DELETE /api/assets/:id
通过ID删除素材

### PUT /api/assets/:id
通过ID更新素材

---

## 工作空间 API

### GET /api/workspace/:username
获取用户工作空间信息

### GET /api/workspace/:username/files
获取用户文件列表

### POST /api/workspace/:username/create
在工作空间创建文件

**请求体**:
```json
{
  "path": "文件路径",
  "content": "文件内容",
  "type": "file/folder"
}
```

### GET /api/workspace/:username/file/*
读取文件内容

### PUT /api/workspace/:username/file/*
更新文件内容

**请求体**:
```json
{
  "content": "新内容"
}
```

### DELETE /api/workspace/:username/file/*
删除文件

### POST /api/workspace/:username/migrate
迁移工作空间

---

## SSE 实时通信 API

### GET /api/sse/stream
SSE 事件流连接

**事件类型**:
- `connected`: 连接成功
- `heartbeat`: 心跳
- `file-update`: 文件更新
- `task-progress`: 任务进度
- `generation-complete`: 生成完成

### POST /api/sse/refresh
强制刷新 SSE 连接

### GET /api/sse/status
获取 SSE 连接状态

**响应**:
```json
{
  "code": 200,
  "success": true,
  "data": {
    "connected": true,
    "clients": 1,
    "uptime": 3600
  }
}
```

---

## 预览相关 API

### POST /api/preview/metadata
获取网页元数据

**请求体**:
```json
{
  "url": "https://example.com"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "title": "页面标题",
    "description": "页面描述",
    "image": "预览图URL",
    "favicon": "图标URL"
  }
}
```

### POST /api/preview/content
获取网页内容

### POST /api/preview/screenshot
获取网页截图

### POST /api/preview/proxy
代理请求

---

## 转录相关 API

### POST /api/transcription/file
转录音频文件

**请求体**: FormData
- `file`: 音频文件
- `format`: 输出格式（可选）

### POST /api/transcription/url
转录音频 URL

**请求体**:
```json
{
  "url": "音频URL",
  "format": "输出格式（可选）"
}
```

### POST /api/transcription/batch
批量转录

**请求体**: FormData
- `files`: 文件数组（最多10个）

### GET /api/transcription/formats
获取支持的格式

**响应**:
```json
{
  "formats": ["txt", "srt", "vtt", "json"]
}
```

### GET /api/transcription/task/:taskId
获取任务状态

### GET /api/transcription/task/:taskId/result
获取任务结果

### GET /api/transcription/tasks
获取所有任务

### DELETE /api/transcription/task/:taskId
删除任务

### POST /api/transcription/task/:taskId/retry
重试任务

### GET /api/transcription/statistics
获取统计信息

### POST /api/transcription/stream
流式转录

---

## Claude 执行 API

### POST /api/claude/execute
执行 Claude 命令

**请求体**:
```json
{
  "prompt": "提示词",
  "sessionId": "会话ID（可选）"
}
```

**响应**:
```json
{
  "success": true,
  "sessionId": "session_id",
  "output": "Claude响应内容"
}
```

### GET /api/claude/folders
获取 Claude 生成的文件夹

### GET /api/claude/health
健康检查

### POST /api/claude/cleanup
清理 Claude 会话

---

## 命令相关 API

### GET /api/commands
获取可用命令列表

**响应**:
```json
{
  "commands": [
    {
      "name": "help",
      "description": "显示帮助信息",
      "usage": "help [command]"
    }
  ]
}
```

### POST /api/commands/validate
验证命令

**请求体**:
```json
{
  "command": "命令内容"
}
```

### GET /api/commands/history
获取命令历史

### POST /api/commands/history
保存命令到历史

**请求体**:
```json
{
  "command": "命令内容",
  "timestamp": "2025-09-05T10:00:00Z"
}
```

---

## 文件上传 API

### POST /api/upload/files
批量上传文件

**请求体**: FormData
- `files`: 文件数组

**响应**:
```json
{
  "success": true,
  "uploaded": [
    {
      "filename": "file.txt",
      "size": 1024,
      "path": "/uploads/file.txt"
    }
  ]
}
```

### POST /api/upload/file
上传单个文件

### POST /api/upload/folder
上传文件夹

### GET /api/upload/structure
获取上传结构

### DELETE /api/upload/:type/:name
删除上传的文件或文件夹

---

## 系统接口

### GET /health
健康检查

**响应**:
```json
{
  "status": "ok",
  "timestamp": "2025-09-05T10:00:00Z"
}
```

### GET /api-info
API 信息

**响应**:
```json
{
  "service": "AI Terminal Backend",
  "version": "V3.5",
  "status": "running",
  "timestamp": "2025-09-05T10:00:00Z",
  "endpoints": {
    "health": "/health",
    "api": {
      "auth": "/api/auth",
      "terminal": "/api/terminal",
      "commands": "/api/commands",
      "claude": "/api/claude",
      "generate": "/api/generate",
      "sse": "/api/sse",
      "preview": "/api/preview",
      "workspace": "/api/workspace",
      "transcription": "/api/transcription",
      "assets": "/api/assets"
    }
  }
}
```

---

## 认证说明

### Token 认证
大部分 API 需要认证，请在请求头中包含:

```
Authorization: Bearer <your_token>
```

### 默认用户支持
对于支持默认用户的接口（标注有 `authenticateUserOrDefault`），如果未提供 token，将使用默认用户权限。

### 获取 Token
通过 `/api/auth/login` 接口登录获取 token。

---

## 错误响应格式

所有 API 错误响应格式统一：

```json
{
  "code": 400,
  "success": false,
  "message": "错误信息",
  "error": "详细错误（仅开发模式）"
}
```

## 状态码说明

- `200`: 成功
- `400`: 请求参数错误
- `401`: 未认证
- `403`: 无权限
- `404`: 资源不存在
- `409`: 资源冲突
- `500`: 服务器内部错误

---

## WebSocket 连接

终端实时交互使用 WebSocket 连接：

```javascript
const socket = io('http://localhost:8083', {
  auth: {
    token: 'your_token'
  }
});

// 事件监听
socket.on('output', (data) => {
  console.log('终端输出:', data);
});

// 发送命令
socket.emit('command', { cmd: 'ls -la' });
```

---

## 速率限制

- 文件上传：最大 10MB/文件，10 个文件/请求
- API 调用：100 次/分钟（认证用户）
- SSE 连接：最多 5 个并发连接/用户

---

## 更新日志

### v4.5.0 (2025-09-05)
- 新增自定义模式文件生成 API
- 新增文件刷新检测接口 `/api/generate/card/async/refresh`
- 扩展 `/api/generate/card/query` 支持所有文件类型
- 完善素材管理 API
- 优化异步生成流程
- 修复 daily 模板四文件生成

### v4.0.0 (2025-09-01)
- 重构 API 路由结构
- 新增异步卡片生成
- 新增 SSE 实时通信
- 优化认证机制

### v3.5.0 (2025-08-15)
- 新增素材管理系统
- 新增工作空间 API
- 优化文件上传功能

---

## 开发环境配置

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 生产环境
npm run start
```

## Docker 部署

```bash
# 构建镜像
docker build -t ai-terminal-backend .

# 运行容器
docker run -d \
  -p 8083:8083 \
  -v ./data:/app/data \
  --name ai-terminal \
  ai-terminal-backend
```

---

## 联系方式

- GitHub: [https://github.com/aixier/AI_Terminal](https://github.com/aixier/AI_Terminal)
- Issues: [https://github.com/aixier/AI_Terminal/issues](https://github.com/aixier/AI_Terminal/issues)

---

## 许可证

MIT License