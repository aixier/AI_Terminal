# AI Terminal API 接口文档

## 概述

AI Terminal 提供了一套完整的 REST API 接口，用于终端会话管理、卡片生成、文件管理等功能。

- **基础URL**: 
  - 本地开发: `http://localhost:6000/api`
  - Docker部署: `http://服务器地址:6000/api`
  - 云部署: `http://aicard.paitongai.com/api`

- **认证方式**: JWT Token (部分接口需要)
- **响应格式**: JSON
- **字符编码**: UTF-8

## API 端点列表

### 1. 终端管理 API (`/api/terminal`)

#### 1.1 获取所有会话
- **URL**: `/api/terminal/sessions`
- **方法**: `GET`
- **描述**: 获取所有活跃的终端会话列表
- **响应示例**:
```json
{
  "code": 200,
  "data": [
    {
      "id": "session-123",
      "createdAt": "2025-01-01T10:00:00Z",
      "lastActivity": "2025-01-01T10:05:00Z"
    }
  ],
  "message": "success"
}
```

#### 1.2 获取指定会话信息
- **URL**: `/api/terminal/sessions/:sessionId`
- **方法**: `GET`
- **参数**: 
  - `sessionId` (路径参数): 会话ID
- **响应示例**:
```json
{
  "code": 200,
  "data": {
    "id": "session-123",
    "createdAt": "2025-01-01T10:00:00Z",
    "lastActivity": "2025-01-01T10:05:00Z"
  },
  "message": "success"
}
```

#### 1.3 删除会话
- **URL**: `/api/terminal/sessions/:sessionId`
- **方法**: `DELETE`
- **参数**: 
  - `sessionId` (路径参数): 会话ID
- **响应示例**:
```json
{
  "code": 200,
  "message": "Session destroyed successfully"
}
```

#### 1.4 获取用户文件夹列表
- **URL**: `/api/terminal/folders`
- **方法**: `GET`
- **描述**: 获取用户的卡片文件夹列表
- **响应示例**:
```json
{
  "code": 200,
  "success": true,
  "folders": [
    {
      "id": "default-folder",
      "name": "默认文件夹",
      "description": "默认卡片文件夹",
      "cardCount": 5,
      "color": "#0078d4",
      "createdAt": "2025-01-01T10:00:00Z",
      "updatedAt": "2025-01-01T10:00:00Z"
    }
  ],
  "message": "success"
}
```

#### 1.5 获取卡片目录树
- **URL**: `/api/terminal/cards-directory`
- **方法**: `GET`
- **描述**: 获取卡片目录的树形结构
- **响应示例**:
```json
{
  "code": 200,
  "success": true,
  "folders": [
    {
      "id": "knowledge-cards",
      "name": "knowledge-cards",
      "path": "/data/users/default/folders/default-folder/cards/knowledge-cards",
      "cards": [
        {
          "id": "knowledge-cards-card1",
          "name": "card1.json",
          "path": "/data/users/default/folders/default-folder/cards/knowledge-cards/card1.json",
          "type": "json"
        },
        {
          "id": "knowledge-cards-card1",
          "name": "card1.html",
          "path": "/data/users/default/folders/default-folder/cards/knowledge-cards/card1.html",
          "type": "html"
        }
      ]
    }
  ],
  "message": "success"
}
```

#### 1.6 获取指定文件夹的卡片列表
- **URL**: `/api/terminal/folders/:folderId/cards`
- **方法**: `GET`
- **参数**: 
  - `folderId` (路径参数): 文件夹ID
- **响应示例**:
```json
{
  "code": 200,
  "success": true,
  "cards": [
    {
      "id": "card-001",
      "title": "知识卡片",
      "content": "卡片内容",
      "createdAt": "2025-01-01T10:00:00Z"
    }
  ],
  "message": "success"
}
```

#### 1.7 执行终端命令
- **URL**: `/api/terminal/execute`
- **方法**: `POST`
- **描述**: 执行终端命令或生成卡片
- **请求体**:
```json
{
  "command": "generate-card",
  "type": "generate-json | generate-card",
  "topic": "AI技术发展"
}
```
- **响应示例** (生成卡片):
```json
{
  "success": true,
  "code": 200,
  "url": "data:text/html;charset=utf-8,...",
  "cardId": "abc123",
  "message": "Card generated successfully"
}
```

#### 1.8 健康检查
- **URL**: `/api/terminal/health`
- **方法**: `GET`
- **描述**: 检查终端服务健康状态
- **响应示例**:
```json
{
  "code": 200,
  "success": true,
  "status": "healthy",
  "activeSessions": 3,
  "message": "Terminal service is running"
}
```

#### 1.9 获取公共模板列表
- **URL**: `/api/terminal/templates`
- **方法**: `GET`
- **描述**: 获取所有可用的公共模板
- **响应示例**:
```json
{
  "code": 200,
  "success": true,
  "templates": [
    {
      "id": "business-plan",
      "name": "商业计划模板",
      "filename": "business-plan.md",
      "description": "用于创建商业计划的模板",
      "icon": "OfficeBuilding",
      "color": "#0078d4",
      "size": 2048,
      "createdAt": "2025-01-01T10:00:00Z",
      "updatedAt": "2025-01-01T10:00:00Z"
    }
  ],
  "message": "success"
}
```

#### 1.10 获取指定模板内容
- **URL**: `/api/terminal/templates/:templateId`
- **方法**: `GET`
- **参数**: 
  - `templateId` (路径参数): 模板ID
- **响应示例**:
```json
{
  "code": 200,
  "success": true,
  "template": {
    "id": "business-plan",
    "filename": "business-plan.md",
    "content": "# 商业计划模板\n\n## 执行摘要\n...",
    "size": 2048,
    "createdAt": "2025-01-01T10:00:00Z",
    "updatedAt": "2025-01-01T10:00:00Z"
  },
  "message": "success"
}
```

#### 1.11 获取卡片内容
- **URL**: `/api/terminal/card`
- **方法**: `GET`
- **参数**: 
  - `path` (查询参数): 卡片文件路径
- **响应示例**:
```json
{
  "code": 200,
  "success": true,
  "content": {
    "title": "知识卡片",
    "content": "详细内容..."
  },
  "metadata": {
    "path": "/data/users/default/folders/default-folder/cards/card.json",
    "size": 1024,
    "createdAt": "2025-01-01T10:00:00Z",
    "updatedAt": "2025-01-01T10:00:00Z",
    "extension": ".json"
  },
  "message": "success"
}
```

#### 1.12 获取HTML卡片静态服务
- **URL**: `/api/terminal/card/html/:folderId/:fileName`
- **方法**: `GET`
- **参数**: 
  - `folderId` (路径参数): 文件夹ID
  - `fileName` (路径参数): HTML文件名
- **响应**: HTML内容 (Content-Type: text/html)

#### 1.13 获取并保存HTML文件
- **URL**: `/api/terminal/fetch-and-save-html`
- **方法**: `POST`
- **描述**: 从外部URL获取HTML并保存
- **请求体**:
```json
{
  "fileId": "file-123",
  "shareLink": "https://example.com/share/123",
  "originalUrl": "https://example.com/original/123",
  "jsonPath": "/data/users/default/folders/default-folder/cards/card.json",
  "fileName": "card.html",
  "folderId": "default-folder"
}
```
- **响应示例**:
```json
{
  "code": 200,
  "success": true,
  "path": "/data/users/default/folders/default-folder/cards/card.html",
  "relativePath": "data/users/default/folders/default-folder/cards/card.html",
  "message": "HTML file saved successfully"
}
```

#### 1.14 保存HTML内容
- **URL**: `/api/terminal/save-html`
- **方法**: `POST`
- **描述**: 保存生成的HTML内容
- **请求体**:
```json
{
  "jsonPath": "/data/users/default/folders/default-folder/cards/card.json",
  "content": "<!DOCTYPE html><html>...</html>",
  "folderId": "default-folder",
  "fileName": "card.html"
}
```
- **响应示例**:
```json
{
  "code": 200,
  "success": true,
  "path": "/data/users/default/folders/default-folder/cards/card.html",
  "relativePath": "data/users/default/folders/default-folder/cards/card.html",
  "message": "HTML file saved successfully"
}
```

#### 1.15 保存卡片内容
- **URL**: `/api/terminal/save-card`
- **方法**: `POST`
- **描述**: 保存卡片内容（JSON或响应文件）
- **请求体**:
```json
{
  "path": "/data/users/default/folders/default-folder/cards/card.json",
  "content": "{\"title\":\"卡片标题\",\"content\":\"卡片内容\"}",
  "type": "json | response"
}
```
- **响应示例**:
```json
{
  "code": 200,
  "success": true,
  "path": "/data/users/default/folders/default-folder/cards/card.json",
  "relativePath": "data/users/default/folders/default-folder/cards/card.json",
  "message": "Card content saved successfully"
}
```

#### 1.16 删除卡片
- **URL**: `/api/terminal/card`
- **方法**: `DELETE`
- **描述**: 删除卡片文件或文件夹
- **参数**: 
  - `path` (请求体或查询参数): 文件或文件夹路径
  - `type` (可选): 类型（file或folder）
- **响应示例**:
```json
{
  "code": 200,
  "success": true,
  "message": "Successfully deleted"
}
```

#### 1.17 清理会话
- **URL**: `/api/terminal/cleanup`
- **方法**: `POST`
- **描述**: 清理超过30分钟未活动的会话
- **响应示例**:
```json
{
  "code": 200,
  "success": true,
  "cleaned": 2,
  "message": "Cleaned 2 inactive sessions"
}
```

### 2. Claude AI API (`/api/claude`)

#### 2.1 执行Claude命令
- **URL**: `/api/claude/execute`
- **方法**: `POST`
- **描述**: 执行Claude AI命令生成内容
- **请求体**:
```json
{
  "prompt": "生成一个关于AI技术的知识卡片",
  "config": {
    "temperature": 0.7,
    "maxTokens": 2000
  }
}
```
- **响应示例**:
```json
{
  "code": 200,
  "success": true,
  "data": {
    "content": "生成的内容...",
    "metadata": {}
  },
  "message": "success"
}
```

#### 2.2 获取文件夹列表
- **URL**: `/api/claude/folders`
- **方法**: `GET`
- **描述**: 获取Claude生成内容的文件夹列表

#### 2.3 健康检查
- **URL**: `/api/claude/health`
- **方法**: `GET`
- **描述**: 检查Claude服务健康状态

#### 2.4 清理缓存
- **URL**: `/api/claude/cleanup`
- **方法**: `POST`
- **描述**: 清理Claude服务缓存

### 3. 认证 API (`/api/auth`)

#### 3.1 用户登录
- **URL**: `/api/auth/login`
- **方法**: `POST`
- **描述**: 用户登录获取JWT Token
- **请求体**:
```json
{
  "username": "admin",
  "password": "password123"
}
```
- **响应示例**:
```json
{
  "code": 200,
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-123",
    "username": "admin",
    "email": "admin@example.com"
  },
  "message": "Login successful"
}
```

#### 3.2 验证Token
- **URL**: `/api/auth/verify`
- **方法**: `GET`
- **Headers**: 
  - `Authorization: Bearer <token>`
- **响应示例**:
```json
{
  "code": 200,
  "success": true,
  "user": {
    "id": "user-123",
    "username": "admin"
  },
  "message": "Token valid"
}
```

### 4. 命令管理 API (`/api/commands`)

#### 4.1 获取可用命令列表
- **URL**: `/api/commands`
- **方法**: `GET`
- **描述**: 获取所有可用的终端命令

#### 4.2 验证命令
- **URL**: `/api/commands/validate`
- **方法**: `POST`
- **描述**: 验证命令是否有效
- **请求体**:
```json
{
  "command": "generate-card",
  "params": {}
}
```

#### 4.3 获取命令历史
- **URL**: `/api/commands/history`
- **方法**: `GET`
- **描述**: 获取命令执行历史

#### 4.4 保存命令历史
- **URL**: `/api/commands/history`
- **方法**: `POST`
- **描述**: 保存命令到历史记录

### 5. SSE (Server-Sent Events) API (`/api/sse`)

#### 5.1 事件流
- **URL**: `/api/sse/stream`
- **方法**: `GET`
- **描述**: 建立SSE连接接收实时事件
- **响应**: `text/event-stream`
- **事件类型**:
  - `filesystem:changed` - 文件系统变更
  - `terminal:output` - 终端输出
  - `card:generated` - 卡片生成完成

#### 5.2 刷新事件
- **URL**: `/api/sse/refresh`
- **方法**: `POST`
- **描述**: 触发刷新事件通知所有客户端

#### 5.3 获取SSE状态
- **URL**: `/api/sse/status`
- **方法**: `GET`
- **描述**: 获取SSE连接状态
- **响应示例**:
```json
{
  "code": 200,
  "success": true,
  "connectedClients": 5,
  "message": "SSE service running"
}
```

### 6. 预览 API (`/api/preview`)

#### 6.1 获取URL元数据
- **URL**: `/api/preview/metadata`
- **方法**: `POST`
- **描述**: 获取URL的元数据信息
- **请求体**:
```json
{
  "url": "https://example.com/article"
}
```
- **响应示例**:
```json
{
  "code": 200,
  "success": true,
  "metadata": {
    "title": "文章标题",
    "description": "文章描述",
    "image": "https://example.com/image.jpg",
    "author": "作者名"
  }
}
```

#### 6.2 获取URL内容
- **URL**: `/api/preview/content`
- **方法**: `POST`
- **描述**: 获取URL的完整内容

#### 6.3 生成截图
- **URL**: `/api/preview/screenshot`
- **方法**: `POST`
- **描述**: 生成URL页面截图

#### 6.4 代理请求
- **URL**: `/api/preview/proxy`
- **方法**: `POST`
- **描述**: 代理请求绕过CORS限制

### 7. 卡片生成API (`/api/generate`)

#### 7.1 生成卡片并返回JSON内容
- **URL**: `/api/generate/card`
- **方法**: `POST`
- **描述**: 使用统一终端服务，通过Claude生成知识卡片JSON文件并返回完整内容
- **处理流程**:
  1. 创建独立的API终端会话
  2. 初始化Claude shell环境 (`claude --dangerously-skip-permissions`)
  3. 发送生成命令到Claude
  4. 等待JSON文件生成完成
  5. 读取并返回JSON内容
  6. 自动清理终端会话
- **请求体**:
```json
{
  "topic": "Docker容器技术详解",
  "templateName": "daily-knowledge-card-template.md"  // 可选，默认使用 daily-knowledge-card-template.md
}
```
- **请求参数**:
  - `topic` (string, 必填): 卡片主题名称，支持中文和特殊字符
  - `templateName` (string, 可选): 模板文件名，默认为 `daily-knowledge-card-template.md`
- **生成时间**: 
  - daily-knowledge-card-template: 约100-120秒
  - cardplanet-Sandra: 约260-300秒
- **超时设置**: 7分钟超时保护（适应复杂模板）
- **初始化流程**: 使用统一的Claude初始化服务，包含5秒稳定等待时间

- **响应示例** (成功):
```json
{
  "code": 200,
  "success": true,
  "data": {
    "topic": "Docker容器技术详解",
    "sanitizedTopic": "Docker容器技术详解",
    "templateName": "daily-knowledge-card-template.md",
    "fileName": "docker-container-basics.json",
    "filePath": "/app/data/users/default/folders/default-folder/cards/Docker容器技术详解/docker-container-basics.json",
    "generationTime": 108000,
    "apiId": "card_1754897698538_izm2mx5tf",
    "content": {
      "theme": {
        "name": "daily-tech-knowledge",
        "pageTitle": "科技知识点：什么是Docker容器",
        "sectionTitle": "为什么程序员都在谈论Docker？",
        "sectionSubtitle": "每天学习一个科技知识点 · 第8期",
        "gradientColor1": "#10B981",
        "gradientColor2": "#06B6D4",
        "gradientColor1RGB": "16, 185, 129",
        "accentColor": "#10B981",
        "accentColorRGB": "16, 185, 129"
      },
      "copy": {
        "title": "🐳 为什么Docker容器让开发变简单了？现在终于懂了！",
        "content": "每天一个科技小知识，今天聊聊Docker容器...",
        "hashtags": "#Docker知识 #容器技术 #云原生 #每日学习",
        "tips": "发布时间：工作日早9点..."
      },
      "cards": [
        {
          "type": "main",
          "icon": "",
          "header": "为什么程序员都在谈论Docker？",
          "subtitle": "解决部署难题的神器",
          "content": {
            "highlight": {
              "number": "Docker\\n容器",
              "description": "随身携带的小房间"
            },
            "points": [
              {
                "icon": "→",
                "text": "一次打包，到处运行"
              }
            ],
            "tags": []
          }
        },
        {
          "type": "normal",
          "icon": "📦",
          "header": "Docker容器是什么？",
          "subtitle": "最通俗的解释来了",
          "content": {
            "list": [
              "像一个<strong style=\"color: #10B981;\">便携式房间</strong>",
              "里面装着程序和所需环境",
              "搬到哪里都能正常工作",
              "轻量级，启动超快"
            ],
            "special": {
              "type": "info-box",
              "title": "打个比方",
              "description": "就像装修好的集装箱房"
            },
            "tip": "🏠 房间搬家，家具全带着",
            "tags": ["📖 概念"]
          }
        }
        // ... 其他7张卡片内容
      ],
      "footer": {
        "tags": ["🐳 Docker", "📦 容器化", "💻 云原生"]
      },
      "export": {
        "mainCardFilename": "主卡片-Docker容器.png",
        "cardFilenames": [
          "2-Docker容器是什么.png",
          "3-为什么需要Docker.png",
          "4-Docker如何工作.png",
          "5-Docker vs 虚拟机.png",
          "6-实际应用场景.png",
          "7-学Docker的好处.png",
          "8-如何开始学习.png",
          "9-今日总结.png"
        ],
        "zipFilename": "科技知识-Docker容器-知识卡片.zip"
      }
    }
  },
  "message": "卡片生成成功"
}
```

- **响应字段说明**:
  - `topic`: 原始主题名称
  - `sanitizedTopic`: 用于文件夹命名的清理后主题名称
  - `templateName`: 使用的模板文件名
  - `fileName`: 生成的JSON文件名（由Claude决定）
  - `filePath`: 生成文件的完整路径
  - `generationTime`: 生成耗时（毫秒）
  - `apiId`: 本次API调用的唯一标识符
  - `content`: 完整的知识卡片JSON内容
    - `theme`: 主题配置（颜色、标题等）
    - `copy`: 文案内容（标题、正文、标签等）
    - `cards`: 卡片数组（通常9张，包含1张主卡片+8张详细卡片）
    - `footer`: 页脚标签
    - `export`: 导出配置（文件名等）

- **响应示例** (成功 - cardplanet-Sandra 文件夹模板):
```json
{
  "code": 200,
  "success": true,
  "data": {
    "topic": "2015年大事",
    "sanitizedTopic": "2015年大事",
    "templateName": "cardplanet-Sandra",
    "fileName": "2015-world-events.html",
    "filePath": "/app/data/users/default/folders/default-folder/cards/2015年大事/2015-world-events.html",
    "generationTime": 264000,
    "apiId": "card_1754897698538_abc123",
    "content": "<!DOCTYPE html>\n<html lang=\"zh-CN\">\n<head>\n  <meta charset=\"UTF-8\">\n  <title>2015年世界大事记</title>\n  <style>\n    /* 精美的HTML样式 */\n  </style>\n</head>\n<body>\n  <!-- 完整的HTML内容 -->\n  <div class=\"container\">\n    <h1>2015年改变世界的九个瞬间</h1>\n    <!-- 详细的事件卡片内容 -->\n  </div>\n</body>\n</html>"
  },
  "message": "卡片生成成功"
}
```

- **响应示例** (失败):
```json
{
  "code": 500,
  "success": false,
  "message": "生成超时，已等待420秒",
  "error": {
    "topic": "Docker容器技术详解",
    "templateName": "daily-knowledge-card-template.md",
    "apiId": "card_1754897698538_izm2mx5tf",
    "details": "Error: 生成超时，已等待420秒"
  }
}
```

- **常见错误**:
  - `400`: 主题参数为空或无效
  - `404`: 模板文件不存在
  - `500`: Claude初始化失败或生成超时
  
- **支持的模板类型**:
  - **单文件模板** (.md文件): 生成JSON格式的知识卡片
  - **文件夹模板** (目录): 生成HTML格式的艺术海报卡片
  
- **技术实现**:
  - 使用 `apiTerminalService` 管理独立终端会话（每个请求创建新会话，避免上下文干扰）
  - 通过PTY (伪终端) 与Claude进程交互（后端使用stdin，前端使用xterm.js）
  - 统一的Claude初始化服务（`claudeInitializationService.js`）确保一致性
  - 内置5秒稳定等待时间，确保Claude完全就绪
  - 文件监控机制自动检测JSON/HTML生成完成
  - 完整的会话生命周期管理

#### 7.2 获取可用模板列表
- **URL**: `/api/generate/templates`
- **方法**: `GET`
- **描述**: 获取所有可用的模板文件列表
- **响应示例**:
```json
{
  "code": 200,
  "success": true,
  "templates": [
    {
      "fileName": "daily-knowledge-card-template.md",
      "displayName": "daily knowledge card template"
    }
  ],
  "message": "success"
}
```

#### 7.3 检查生成状态
- **URL**: `/api/generate/status/:topic`
- **方法**: `GET`
- **描述**: 检查指定主题的卡片生成状态（用于轮询）
- **参数**: 
  - `topic` (路径参数): 主题名称
- **响应示例**:
```json
{
  "code": 200,
  "success": true,
  "status": "completed | generating | not_started",
  "files": ["card1.json", "card2.json"],
  "message": "状态描述"
}
```

### 8. 外部卡片生成API

##### 7.4 流式生成卡片 (Server-Sent Events)
- **URL**: `/api/generate/card/stream`
- **方法**: `POST`
- **描述**: 使用SSE实时传输生成过程，支持进度监控
- **请求体**: 与非流式接口相同
- **响应**: `text/event-stream`
- **事件类型**:
  - `start`: 开始生成
  - `command`: 发送的命令
  - `session`: 会话ID
  - `output`: 实时输出
  - `status`: 状态更新
  - `success`: 生成成功
  - `error`: 错误信息
  - `cleanup`: 清理完成

### 8. 外部卡片生成API

#### 8.1 生成并处理卡片
- **URL**: `https://engagia-s-cdmxfcdbwa.cn-hangzhou.fcapp.run/generate-and-process`
- **方法**: `POST`
- **描述**: 通过外部服务生成HTML卡片
- **请求体**: 见原文档中的详细格式
- **响应**: 见原文档中的详细格式

## WebSocket/Socket.IO 接口

### 连接配置
```javascript
const socket = io('ws://localhost:6000', {
  path: '/socket.io',
  transports: ['websocket', 'polling'],
  upgrade: true
})
```

### 事件列表

#### 客户端发送事件
- `terminal:create` - 创建新终端会话
- `terminal:input` - 发送终端输入
- `terminal:resize` - 调整终端大小
- `terminal:close` - 关闭终端会话

#### 服务器发送事件
- `terminal:output` - 终端输出数据
- `terminal:created` - 终端创建成功
- `terminal:closed` - 终端已关闭
- `terminal:error` - 终端错误

## 错误码说明

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未授权（需要登录） |
| 403 | 禁止访问（权限不足） |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |
| 503 | 服务暂时不可用 |

## 通用响应格式

### 成功响应
```json
{
  "code": 200,
  "success": true,
  "data": {},
  "message": "success"
}
```

### 错误响应
```json
{
  "code": 500,
  "success": false,
  "message": "Error message",
  "error": {
    "details": "Detailed error information"
  }
}
```

## 认证说明

需要认证的接口需要在请求头中包含JWT Token：
```
Authorization: Bearer <your-jwt-token>
```

目前大部分接口使用默认用户 `default`，不需要认证。

## 文件路径说明

- 用户数据目录: `/data/users/{userId}/`
  - 文件夹: `/data/users/{userId}/folders/`
  - 卡片: `/data/users/{userId}/folders/{folderId}/cards/`
- 公共模板: `/data/public_template/`
- 临时文件: `/tmp/`

## 环境变量配置

- `DATA_PATH`: 数据存储路径（Docker环境）
- `PORT`: 服务端口（默认6000）
- `JWT_SECRET`: JWT密钥
- `ANTHROPIC_AUTH_TOKEN`: Claude API Token
- `ANTHROPIC_BASE_URL`: Claude API基础URL

## 部署说明

### Docker部署
```bash
docker build -t ai-terminal .
docker run -d -p 6000:6000 --name ai-terminal ai-terminal
```

### 本地开发
```bash
# 后端
cd terminal-backend
npm install
npm run dev

# 前端
cd terminal-ui
npm install
npm run dev
```

## 注意事项

1. 所有API响应均为JSON格式，字符编码为UTF-8
2. 文件上传大小限制为10MB
3. WebSocket连接超时时间为60秒
4. 会话超过30分钟未活动将被自动清理
5. 生成的HTML卡片使用data URL格式避免跨域问题
6. Docker环境需要设置DATA_PATH环境变量指向正确的数据目录

## 更新日志

- **2025-01-13**: 
  - 更新API文档，添加实际测试结果
  - 新增cardplanet-Sandra模板HTML响应示例
  - 详细说明流式和非流式接口的统一初始化流程
  - 记录实际生成时间：JSON模板108秒，HTML模板264秒
  - 添加统一Claude初始化服务的技术细节
- **2025-01-11**: 
  - 完整重写 `/api/generate/card` 接口文档
  - 新增统一终端服务架构说明
  - 详细描述请求参数和完整响应结构
  - 添加技术实现细节和错误处理说明
  - 提供真实测试数据示例
- **2025-01-11**: 完整API文档更新，包含所有端点
- **2025-01-10**: 修复Docker环境路径问题
- **2025-01-07**: 初始版本发布