# GET /api/generate/card/content/:folderName 接口文档

## 概述
获取指定文件夹中的HTML和JSON文件内容，专门用于卡片内容查询，具有特殊过滤规则和格式要求，响应格式与v3.62.2的 `POST /api/generate/card` 完全一致。

## 接口信息
- **方法**: `GET`
- **路径**: `/api/generate/card/query/:folderName`
- **认证**: `authenticateUserOrDefault`

## 请求参数

### 路径参数
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| folderName | string | 是 | 文件夹名称（sanitized topic名称） |

### 查询参数
| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| username | string | 否 | 认证用户名 | 指定用户名（可选） |

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
  "message": "查询成功"
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
  "message": "查询成功"
}
```

### 错误响应

#### 参数错误 (400)
```json
{
  "code": 400,
  "success": false,
  "message": "folderName参数不能为空"
}
```

#### 文件夹不存在 (404)
```json
{
  "code": 404,
  "success": false,
  "message": "文件尚未生成或不存在",
  "data": {
    "folderName": "人工智能",
    "folderPath": "/path/to/folder",
    "status": "folder_not_found"
  }
}
```

#### 无生成文件 (404)
```json
{
  "code": 404,
  "success": false,
  "message": "文件尚未生成或不存在",
  "data": {
    "folderName": "人工智能", 
    "folderPath": "/path/to/folder",
    "status": "no_files_generated",
    "availableFiles": [...]
  }
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

### 1. 文件过滤规则
- ✅ 包含 `.html` 和 `.json` 文件
- ❌ 排除包含 `response` 的文件
- ❌ 排除以 `.` 开头的隐藏文件  
- ❌ 排除包含 `_meta` 的元数据文件

### 2. 模板类型推测
- **HTML + JSON**: `cardplanet-Sandra-json`
- **仅 JSON**: `daily-knowledge-card-template.md`
- **仅 HTML**: `cardplanet-Sandra-cover`
- **其他**: `unknown`

### 3. 主文件选择
- 优先选择 HTML 文件作为主文件
- 如无 HTML，选择第一个 JSON 文件

### 4. pageinfo字段
- 仅在 `cardplanet-Sandra-json` 模板时添加
- 内容为 JSON 文件的解析后数据
- 与 v3.62.2 版本完全一致

### 5. 错误处理
- JSON 解析失败时返回原始字符串内容
- 标记 `parseError: true` 用于调试
- 文件读取失败时跳过该文件

## 使用示例

```bash
# 查询指定文件夹的文件
GET /api/generate/card/query/人工智能

# 查询其他用户的文件（需要权限）
GET /api/generate/card/query/人工智能?username=otheruser
```

## 兼容性说明

此接口的响应格式与 `/mnt/d/work/AI_Terminal/api-generate-card-v3.62.2-interface-doc.md` 中定义的格式完全一致，确保前端代码无需修改即可使用。