# GET /api/generate/card/content/:folderName 接口文档

## 概述
获取指定文件夹中的HTML和JSON文件内容，专门用于卡片内容查询，具有特殊过滤规则和格式要求，响应格式与v3.62.2的 `POST /api/generate/card` 完全一致。

## 与通用查询接口的区别

| 特性 | `/api/generate/card/query/:folderName` | `/api/generate/card/content/:folderName` |
|------|---------------------------------------|------------------------------------------|
| **用途** | 通用目录查询 | 专门的卡片内容查询 |
| **过滤规则** | 基础过滤 | 严格过滤（排除 *response.json） |
| **响应格式** | 通用格式 | 完全匹配 v3.62.2 格式 |
| **pageinfo字段** | 可能不一致 | 严格按 v3.62.2 规则 |
| **模板推测** | 基础推测 | 精确推测 |

## 接口信息
- **方法**: `GET`
- **路径**: `/api/generate/card/content/:folderName`
- **认证**: `authenticateUserOrDefault`

## 请求参数

### 路径参数
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| folderName | string | 是 | 文件夹名称（sanitized topic名称） |

## 响应格式

### 成功响应 (200) - 单文件

```json
{
  "code": 200,
  "success": true,
  "data": {
    "topic": "人工智能",
    "sanitizedTopic": "人工智能",
    "templateName": "daily-knowledge-card-template.md",
    "fileName": "ai_cards.json",
    "filePath": "/path/to/ai_cards.json",
    "content": {...}
  },
  "message": "卡片生成成功"
}
```

### 成功响应 (200) - CardPlanet Sandra JSON 模板

```json
{
  "code": 200,
  "success": true,
  "data": {
    "topic": "人工智能",
    "sanitizedTopic": "人工智能",
    "templateName": "cardplanet-Sandra-json",
    "fileName": "artificial_intelligence_style.html",
    "filePath": "/path/to/artificial_intelligence_style.html",
    "content": "<!DOCTYPE html><html>...</html>",
    "allFiles": [
      {
        "fileName": "artificial_intelligence_style.html",
        "path": "/path/to/artificial_intelligence_style.html",
        "content": "<!DOCTYPE html><html>...</html>",
        "fileType": "html"
      },
      {
        "fileName": "artificial_intelligence_data.json",
        "path": "/path/to/artificial_intelligence_data.json",
        "content": {
          "cards": [...],
          "metadata": {...}
        },
        "fileType": "json"
      }
    ],
    "pageinfo": {
      "cards": [...],
      "metadata": {...}
    }
  },
  "message": "卡片生成成功"
}
```

### 错误响应

#### 参数错误 (400)
```json
{
  "code": 400,
  "success": false,
  "message": "文件夹名称不能为空"
}
```

#### 文件夹不存在 (404)
```json
{
  "code": 404,
  "success": false,
  "message": "文件夹不存在: 人工智能"
}
```

#### 无生成文件 (404)
```json
{
  "code": 404,
  "success": false,
  "message": "文件夹中未找到HTML或JSON文件: 人工智能"
}
```

#### 服务器错误 (500)
```json
{
  "code": 500,
  "success": false,
  "message": "服务器内部错误",
  "error": "具体错误信息"
}
```

## 功能特性

### 1. 严格的文件过滤规则
- ✅ 包含 `.html` 和 `.json` 文件
- ❌ **严格排除** 包含 `response` 的文件（如 `*response.json`）
- ❌ 排除以 `.` 开头的隐藏文件  
- ❌ 排除包含 `_meta` 的元数据文件

### 2. 精确的模板类型推测
- **HTML + JSON**: `cardplanet-Sandra-json`
- **仅 JSON**: `daily-knowledge-card-template.md`
- **仅 HTML**: `cardplanet-Sandra-cover`
- **其他**: `unknown`

### 3. 主文件选择策略
- 优先选择 HTML 文件作为主文件
- 如无 HTML，选择 JSON 文件

### 4. pageinfo字段（v3.62.2兼容）
- **触发条件**: 仅当 `templateName === 'cardplanet-Sandra-json'` 时添加
- **数据来源**: JSON 文件的解析后内容
- **格式**: 与 v3.62.2 版本完全一致

### 5. 错误处理机制
- JSON 解析失败时返回原始字符串内容
- 标记 `parseError: true` 用于调试
- 文件读取失败时跳过该文件并记录日志

## 使用示例

```bash
# 查询指定文件夹的卡片内容
GET /api/generate/card/content/人工智能

# 响应示例（cardplanet-Sandra-json模板）
{
  "code": 200,
  "success": true,
  "data": {
    "topic": "人工智能",
    "sanitizedTopic": "人工智能", 
    "templateName": "cardplanet-Sandra-json",
    "fileName": "artificial_intelligence_style.html",
    "filePath": "/path/to/artificial_intelligence_style.html",
    "content": "<!DOCTYPE html>...",
    "allFiles": [...],
    "pageinfo": {...}
  },
  "message": "卡片生成成功"
}
```

## 兼容性说明

✅ **完全兼容 v3.62.2**: 此接口的响应格式与 `/mnt/d/work/AI_Terminal/api-generate-card-v3.62.2-interface-doc.md` 中定义的格式**完全一致**

✅ **前端无需修改**: 前端代码可以直接复用处理 `POST /api/generate/card` 响应的代码

✅ **pageinfo字段**: 严格按照 v3.62.2 规则，仅在 cardplanet-Sandra-json 模板时添加

## 设计理念

这个新接口专门为卡片内容查询而设计，确保：

1. **格式一致性**: 与生成接口保持完全相同的响应格式
2. **过滤精确性**: 严格过滤掉响应文件和调试文件
3. **前端友好性**: 无需额外的数据转换逻辑
4. **向后兼容性**: 完全匹配 v3.62.2 的稳定格式