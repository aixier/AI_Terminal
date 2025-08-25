# Card Generation API Reference

> 统一的卡片生成 API 参考文档  
> 最后更新：2025-08-25 (v3.62.2)

## 概述

卡片生成 API 提供了通过 AI (Claude) 生成各种格式知识卡片的能力。支持多种模板、实时流式传输、自动参数生成等高级功能。

## 端点列表

| 端点 | 方法 | 描述 | 响应格式 |
|-----|------|------|---------|
| `/api/generate/card` | POST | 标准卡片生成 | JSON |
| `/api/generate/card/stream` | POST | 流式卡片生成 | SSE |
| `/api/generate/templates` | GET | 获取模板列表 | JSON |
| `/api/generate/status/:topic` | GET | 检查生成状态 | JSON |

## 1. 标准卡片生成

### 端点
```
POST /api/generate/card
```

### 请求体
```json
{
  "topic": "主题名称",
  "templateName": "模板名称"  // 可选，默认: daily-knowledge-card-template.md
}
```

### 支持的模板

| 模板名称 | 类型 | 输出格式 | 特殊参数 |
|---------|------|---------|---------|
| daily-knowledge-card-template.md | 单文件 | JSON | 无 |
| cardplanet-Sandra | 文件夹 | JSON | style, language, reference |
| cardplanet-Sandra-cover | 文件夹 | JSON | cover, style, language, reference |
| cardplanet-Sandra-json | 文件夹 | HTML + JSON | cover, style, language, reference |

### 响应格式

#### 基础响应结构
```json
{
  "code": 200,
  "success": true,
  "data": {
    "topic": "主题名称",
    "sanitizedTopic": "清理后的主题名",
    "templateName": "模板名称",
    "fileName": "生成的文件名",
    "filePath": "文件完整路径",
    "generationTime": 120000,  // 毫秒
    "content": {},  // 文件内容（HTML或解析后的JSON）
    "apiId": "会话ID"
  },
  "message": "卡片生成成功"
}
```

#### 特殊字段（v3.62.2+）

**pageinfo** (仅 cardplanet-Sandra-json 模板):
```json
{
  "pageinfo": {
    "title": "卡片集标题",
    "cards": [
      {
        "id": "card-1",
        "title": "卡片标题",
        "content": "卡片内容",
        "style": {}
      }
    ],
    "metadata": {
      "version": "1.0",
      "generatedAt": "2025-08-25"
    }
  }
}
```

**allFiles** (多文件模板):
```json
{
  "allFiles": [
    {
      "fileName": "topic_style.html",
      "path": "/full/path/to/file",
      "fileType": "html"
    },
    {
      "fileName": "topic_data.json",
      "path": "/full/path/to/file",
      "fileType": "json"
    }
  ]
}
```

### 自动参数生成

对于 cardplanet-Sandra 系列模板，系统会自动通过 AI 生成以下参数：

1. **style** - 根据主题类别自动选择合适的设计风格
2. **language** - 根据主题判断语言类型（中文/英文/中英双语）
3. **reference** - 自动检索主题相关内容（500字以内）
4. **cover** - (仅 cover/json 模板) 选择默认封面或小红书封面

### 生成时间参考

- daily-knowledge-card-template: 100-120秒
- cardplanet-Sandra: 230-260秒
- cardplanet-Sandra-json: 240-280秒

### 错误响应
```json
{
  "code": 400,
  "success": false,
  "message": "主题(topic)参数不能为空"
}
```

## 2. 流式卡片生成

### 端点
```
POST /api/generate/card/stream
```

### 请求体
与标准生成接口相同

### 响应格式
Server-Sent Events (SSE) 流

### 事件类型

| 事件 | 数据格式 | 描述 |
|------|---------|------|
| start | `{topic, templatePath, userCardPath}` | 开始生成 |
| status | `{step: string}` | 状态更新 |
| parameters | `{style, language, reference, cover?}` | 参数生成完成 |
| output | `{data: string, timestamp}` | 实时输出 |
| success | 与标准接口相同 | 生成成功 |
| error | `{message: string}` | 生成失败 |

### 客户端示例

```javascript
const eventSource = new EventSource('/api/generate/card/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    topic: '人工智能',
    templateName: 'cardplanet-Sandra-json'
  })
});

eventSource.addEventListener('parameters', (e) => {
  const params = JSON.parse(e.data);
  console.log('生成的参数:', params);
});

eventSource.addEventListener('success', (e) => {
  const result = JSON.parse(e.data);
  console.log('生成成功:', result);
  
  // 对于 cardplanet-Sandra-json，访问 pageinfo
  if (result.pageinfo) {
    console.log('JSON数据:', result.pageinfo);
  }
  
  eventSource.close();
});
```

## 3. 获取模板列表

### 端点
```
GET /api/generate/templates
```

### 响应示例
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
      "fileName": "cardplanet-Sandra-json",
      "displayName": "cardplanet-Sandra-json",
      "type": "folder"
    }
  ]
}
```

## 4. 检查生成状态

### 端点
```
GET /api/generate/status/:topic
```

### 响应示例
```json
{
  "code": 200,
  "success": true,
  "status": "completed",  // not_started | generating | completed
  "files": ["generated_file.json"],
  "message": "生成完成"
}
```

## 使用建议

1. **选择合适的接口**：
   - 需要实时反馈：使用流式接口
   - 简单集成：使用标准接口

2. **模板选择**：
   - 简单知识卡片：daily-knowledge-card-template
   - 精美设计卡片：cardplanet-Sandra
   - 双文件输出（预览+数据）：cardplanet-Sandra-json

3. **超时设置**：
   - 建议客户端超时设置为 8 分钟
   - 服务端默认超时为 7 分钟

4. **错误处理**：
   - 实现重试机制
   - 记录 apiId 用于调试

## 版本历史

- **v3.62.2** (2025-08-25): 添加 pageinfo 字段支持 cardplanet-Sandra-json
- **v3.62.0** (2025-08-24): 支持多文件输出模板
- **v3.33.0** (2025-01-19): 简化 Claude 执行流程
- **v3.10.27** (2025-01-11): 添加自动参数生成功能

## 相关文档

- [API 总览](/docs/API_DOCUMENTATION.md)
- [开发者指南](/DEVELOPER.md)
- [模板开发指南](/docs/template-development.md)