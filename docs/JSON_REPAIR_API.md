# JSON修复API文档

## 概述

本文档描述了JSON自动修复功能，该功能通过调用Claude API来修复JSON语法错误，主要用于修复模板生成的JSON文件中的格式问题。

## 核心接口

### /api/generate/cc

Claude执行接口，用于直接调用Claude进行文本处理任务。

#### 请求参数

- **URL**: `POST /api/generate/cc`
- **Content-Type**: `application/json`
- **Authorization**: `Bearer {token}`

#### 请求体 (Request Body)

```json
{
  "prompt": "string",     // 必需: 发送给Claude的提示词
  "timeout": "number"     // 可选: 超时时间(毫秒), 默认30000ms
}
```

**参数说明:**
- `prompt`: 发送给Claude的完整提示词，包含要处理的内容和具体要求
- `timeout`: 请求超时时间，建议设置为60000-120000ms以应对复杂JSON修复任务

#### 响应格式 (Response)

**成功响应 (200):**
```json
{
  "code": 200,
  "success": true,
  "output": "string",           // Claude的响应内容
  "executionTime": "number"     // 执行耗时(毫秒)
}
```

**失败响应:**
```json
{
  "code": 400|408|500,
  "success": false,
  "message": "string",          // 错误信息
  "timeout": "number",          // 设置的超时时间
  "partialOutput": "string"     // 部分输出(如果有)
}
```

## JSON修复流程

### 1. 修复Prompt模板

```javascript
const fixPrompt = `请检查并修复以下JSON文件的语法错误。这是一个daily-knowledge-card-template.md模板生成的心理学知识卡片JSON文件。

任务要求：
1. 识别并修复所有JSON语法错误（如缺少逗号、括号不匹配等）
2. 保持原始数据内容和结构完全不变，只修复格式问题  
3. 确保修复后的JSON可以被JSON.parse()正确解析
4. 直接返回修复后的完整JSON内容，不要添加任何解释文字或markdown格式

需要修复的JSON内容：
${originalJsonContent}

请直接返回修复后的JSON：`;
```

### 2. API调用示例

```javascript
const response = await fetch('/api/generate/cc', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer default-secure-token-abc123'
  },
  body: JSON.stringify({
    prompt: fixPrompt,
    timeout: 120000  // 2分钟超时
  })
});

const result = await response.json();
```

### 3. 响应处理

```javascript
if (result.success) {
  let fixedJson = result.output.trim();
  
  // 去除可能的markdown代码块标记
  const jsonMatch = fixedJson.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    fixedJson = jsonMatch[1].trim();
  }
  
  // 如果响应包含解释文字，提取JSON部分
  if (!fixedJson.startsWith('{')) {
    const jsonStart = fixedJson.indexOf('{');
    const jsonEnd = fixedJson.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      fixedJson = fixedJson.substring(jsonStart, jsonEnd + 1);
    }
  }
  
  // 验证修复后的JSON
  const parsedJson = JSON.parse(fixedJson);
  
  // 验证必要字段
  const requiredFields = ['theme', 'copy', 'cards'];
  const missingFields = requiredFields.filter(field => !parsedJson[field]);
  
  if (missingFields.length === 0) {
    return { success: true, data: parsedJson };
  }
}
```

## 常见问题处理

### 1. 响应格式问题
Claude可能返回以下格式的响应：
- 纯JSON (理想情况)
- Markdown代码块包裹的JSON
- 包含解释文字的JSON

处理策略：依次尝试直接解析、提取代码块、提取JSON片段

### 2. 常见JSON错误类型
- 缺少逗号分隔符
- 括号不匹配
- 字符串引号问题
- 数组结构错误

### 3. 性能考虑
- **平均修复时间**: 30-60秒
- **建议超时设置**: 60-120秒
- **重试策略**: 失败时重试1-2次
- **缓存考虑**: 可对相同错误模式进行缓存

## 安全注意事项

1. **输入验证**: 确保JSON内容不包含恶意代码
2. **大小限制**: 建议JSON文件大小不超过100KB
3. **频率限制**: 避免过于频繁的API调用
4. **备份策略**: 修复前务必保留原始文件

## 错误码说明

| 错误码 | 说明 | 处理建议 |
|--------|------|----------|
| 400 | 请求参数错误 | 检查prompt参数 |
| 408 | 请求超时 | 增加timeout值或分片处理 |
| 500 | 服务器错误 | 重试或联系管理员 |

## 使用示例

详细使用示例请参考 `utils/jsonRepair.js` 模块。

## 更新日志

- **2025-08-28**: 初始版本，支持基础JSON语法修复
- 支持daily-knowledge-card-template.md模板生成的JSON修复
- 集成Claude API进行智能修复