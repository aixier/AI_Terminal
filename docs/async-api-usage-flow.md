# 异步卡片生成API使用流程文档

## 概述

异步卡片生成系统提供了一套完整的API接口，允许客户端发起生成请求后立即返回，并通过轮询检查生成状态，最终获取生成的文件内容。

## API接口时序图

```
客户端                          服务端
  |                               |
  |---POST /api/generate/card/async-->|  1. 发起异步生成请求
  |<------202 Accepted + taskId-------|     立即返回任务信息
  |                               |
  |                               |     [后台生成进行中...]
  |                               |
  |---GET /api/generate/status/:topic->|  2. 轮询检查状态
  |<------200 OK + status-------------|     返回当前状态
  |                               |
  |---GET /api/generate/status/:topic->|  (继续轮询...)
  |<------200 OK + completed----------|     生成完成
  |                               |
  |---GET /api/generate/card/query/:folder->|  3. 获取文件内容
  |<------200 OK + file content-------|     返回生成的文件
  |                               |
```

## 1. 发起异步生成请求

### 接口信息
- **URL**: `/api/generate/card/async`
- **方法**: POST
- **Content-Type**: application/json

### 请求参数
```json
{
  "topic": "马斯克",                    // 必填，生成主题
  "templateName": "cardplanet-Sandra-json"  // 可选，模板名称，默认为 cardplanet-Sandra-json
}
```

### 响应格式
```json
{
  "code": 200,
  "success": true,
  "data": {
    "taskId": "task_1735035851234_abc123",  // 任务ID
    "folderName": "马斯克",                  // 文件夹名称（清理后）
    "folderPath": "/app/data/users/default/workspace/card/马斯克",  // 存储路径
    "topic": "马斯克",                       // 原始主题
    "templateName": "cardplanet-Sandra-json", // 使用的模板
    "status": "submitted",                   // 提交状态
    "submittedAt": "2024-12-24T10:30:51.234Z", // 提交时间
    "folderCreated": true,                   // 是否新建文件夹
    "folderExisted": false                   // 文件夹是否已存在
  },
  "message": "任务已提交，正在后台生成"
}
```

### CURL示例
```bash
curl -X POST http://localhost:3000/api/generate/card/async \
  -H "Content-Type: application/json" \
  -H "Cookie: authToken=your_token_here" \
  -d '{
    "topic": "马斯克",
    "templateName": "cardplanet-Sandra-json"
  }'
```

## 2. 检查生成状态

### 接口信息
- **URL**: `/api/generate/status/:topic`
- **方法**: GET
- **参数**: topic为URL编码后的主题名称

### 响应格式

#### 状态：未开始
```json
{
  "code": 200,
  "success": true,
  "status": "not_started",
  "message": "尚未开始生成"
}
```

#### 状态：生成中
```json
{
  "code": 200,
  "success": true,
  "status": "generating",
  "message": "正在生成中"
}
```

#### 状态：已完成
```json
{
  "code": 200,
  "success": true,
  "status": "completed",
  "files": [
    "马斯克_style.html",
    "马斯克_data.json"
  ],
  "message": "生成完成"
}
```

### CURL示例
```bash
# 检查"马斯克"主题的生成状态
curl -X GET "http://localhost:3000/api/generate/status/%E9%A9%AC%E6%96%AF%E5%85%8B" \
  -H "Cookie: authToken=your_token_here"
```

### 轮询策略建议
- 初始延迟：2秒
- 轮询间隔：2-3秒
- 最大轮询次数：150次（约5分钟）
- 超时处理：超过最大次数后停止轮询并提示用户

## 3. 获取生成的文件内容

### 接口信息
- **URL**: `/api/generate/card/query/:folder`
- **方法**: GET
- **参数**: folder为URL编码后的文件夹名称

### 响应格式
```json
{
  "code": 200,
  "success": true,
  "data": {
    "folderName": "马斯克",
    "files": [
      {
        "name": "马斯克_style.html",
        "type": "html",
        "size": 15234,
        "content": "<!DOCTYPE html>..."  // HTML文件完整内容
      },
      {
        "name": "马斯克_data.json",
        "type": "json",
        "size": 8976,
        "content": {                     // JSON文件解析后的对象
          "title": "马斯克",
          "cards": [...]
        }
      }
    ],
    "totalFiles": 2,
    "generatedAt": "2024-12-24T10:31:45.678Z"
  }
}
```

### CURL示例
```bash
# 获取"马斯克"文件夹中的所有生成文件
curl -X GET "http://localhost:3000/api/generate/card/query/%E9%A9%AC%E6%96%AF%E5%85%8B" \
  -H "Cookie: authToken=your_token_here"
```

## 完整使用流程示例

### JavaScript/TypeScript示例
```javascript
async function generateCardAsync(topic, templateName = 'cardplanet-Sandra-json') {
  try {
    // 1. 发起异步生成请求
    const response = await fetch('/api/generate/card/async', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ topic, templateName })
    });
    
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message);
    }
    
    const { taskId, folderName } = result.data;
    console.log(`任务已提交，ID: ${taskId}`);
    
    // 2. 轮询检查状态
    let completed = false;
    let attempts = 0;
    const maxAttempts = 150;
    
    while (!completed && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // 等待2秒
      
      const statusResponse = await fetch(`/api/generate/status/${encodeURIComponent(topic)}`);
      const statusResult = await statusResponse.json();
      
      console.log(`检查状态 [${attempts + 1}/${maxAttempts}]: ${statusResult.status}`);
      
      if (statusResult.status === 'completed') {
        completed = true;
        console.log('生成完成！文件列表:', statusResult.files);
      }
      
      attempts++;
    }
    
    if (!completed) {
      throw new Error('生成超时');
    }
    
    // 3. 获取生成的文件内容
    const filesResponse = await fetch(`/api/generate/card/query/${encodeURIComponent(folderName)}`);
    const filesResult = await filesResponse.json();
    
    if (filesResult.success) {
      console.log(`成功获取 ${filesResult.data.totalFiles} 个文件`);
      return filesResult.data.files;
    }
    
  } catch (error) {
    console.error('生成失败:', error);
    throw error;
  }
}

// 使用示例
generateCardAsync('马斯克').then(files => {
  files.forEach(file => {
    console.log(`文件: ${file.name}, 大小: ${file.size} bytes`);
  });
});
```

## 状态码说明

### HTTP状态码
- **200**: 请求成功
- **202**: 异步任务已接受（某些实现可能使用）
- **400**: 请求参数错误
- **401**: 未授权（需要登录）
- **404**: 资源不存在
- **500**: 服务器内部错误

### 业务状态码（code字段）
- **200**: 操作成功
- **400**: 参数错误
- **404**: 未找到资源
- **500**: 服务器错误

## 错误处理

### 常见错误响应
```json
{
  "code": 400,
  "success": false,
  "message": "主题(topic)参数不能为空"
}
```

```json
{
  "code": 404,
  "success": false,
  "message": "文件夹不存在"
}
```

### 错误处理建议
1. **网络错误**: 实施重试机制，使用指数退避策略
2. **超时处理**: 设置合理的超时时间，提供用户反馈
3. **状态异常**: 记录详细日志，提供用户友好的错误提示

## 注意事项

1. **文件夹命名规则**
   - 特殊字符会被替换为下划线
   - 中文字符保持不变
   - 示例：`"马斯克 & Tesla"` → `"马斯克___Tesla"`

2. **模板类型**
   - `cardplanet-Sandra-json`: 生成HTML和JSON两个文件
   - `cardplanet-Sandra-cover`: 生成带封面的JSON文件
   - 其他模板: 通常生成单个JSON文件

3. **并发限制**
   - 同一用户同时只能有一个生成任务
   - 相同主题的重复请求会覆盖之前的结果

4. **文件大小**
   - HTML文件通常10-50KB
   - JSON文件通常5-20KB
   - 大型主题可能生成更大的文件

5. **认证要求**
   - 所有接口都需要用户认证
   - 使用Cookie中的authToken进行身份验证
   - 未认证用户使用默认用户空间

## 性能优化建议

1. **前端优化**
   - 使用防抖避免频繁轮询
   - 实现智能轮询间隔（随时间递增）
   - 缓存已获取的文件内容

2. **批量操作**
   - 考虑实现批量生成接口
   - 支持多主题并行生成

3. **缓存策略**
   - 相同主题和模板的结果可缓存
   - 实施合理的缓存过期策略

## 版本历史

- **v1.0** (2024-12-24): 初始版本
  - 支持异步生成
  - 状态轮询
  - 文件内容获取