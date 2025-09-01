# SenseVoice 音视频转文字服务

## 概述
SenseVoice服务是基于阿里云SenseVoice模型的音视频转文字解决方案，提供高精度的语音识别功能。

## 特性
- ✅ 支持15+种音视频格式
- ✅ 中英文自动识别
- ✅ 异步任务处理
- ✅ 任务状态追踪
- ✅ 批量文件处理
- ✅ 词级别时间戳
- ✅ 语气词过滤
- ✅ 自动标点符号
- ✅ 任务持久化存储
- ✅ 失败任务重试

## 架构设计

### 服务结构
```
src/services/SenseVoice/
├── index.js              # 服务入口
├── SenseVoiceService.js  # 核心服务逻辑
├── TaskManager.js        # 任务管理器
├── api-schema.json       # OpenAPI规范
└── README.md            # 本文档
```

### 核心组件

#### 1. SenseVoiceService
主要职责：
- 与阿里云API交互
- 处理文件上传和URL转录
- 异步任务轮询
- 结果格式化

#### 2. TaskManager
主要职责：
- 任务生命周期管理
- 任务状态追踪
- 任务持久化存储
- 任务统计分析

## API使用指南

### 1. 提交转录任务

#### 文件上传
```javascript
// POST /api/transcription/file
const formData = new FormData()
formData.append('file', audioFile)
formData.append('languages', JSON.stringify(['zh', 'en']))
formData.append('enableTimestamp', 'true')

const response = await fetch('/api/transcription/file', {
  method: 'POST',
  body: formData
})

const { taskId } = await response.json()
console.log('任务ID:', taskId)
```

#### URL转录
```javascript
// POST /api/transcription/url
const response = await fetch('/api/transcription/url', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'https://example.com/audio.mp3',
    languages: ['zh', 'en']
  })
})

const { taskId } = await response.json()
```

### 2. 查询任务状态
```javascript
// GET /api/transcription/task/:taskId
const response = await fetch(`/api/transcription/task/${taskId}`)
const status = await response.json()

console.log('任务状态:', status.status)
console.log('进度:', status.progress + '%')
```

### 3. 获取转录结果
```javascript
// GET /api/transcription/task/:taskId/result
const response = await fetch(`/api/transcription/task/${taskId}/result`)
const result = await response.json()

if (result.success) {
  console.log('转录文本:', result.fullText)
  console.log('句子数:', result.sentenceCount)
  console.log('词数:', result.wordCount)
} else {
  console.log('任务状态:', result.status)
  console.log('错误信息:', result.error)
}
```

### 4. 轮询等待结果
```javascript
async function waitForTranscription(taskId, maxWait = 300000) {
  const startTime = Date.now()
  
  while (Date.now() - startTime < maxWait) {
    const response = await fetch(`/api/transcription/task/${taskId}/result`)
    const result = await response.json()
    
    if (result.success || result.status === 'failed') {
      return result
    }
    
    // 等待5秒后重试
    await new Promise(resolve => setTimeout(resolve, 5000))
  }
  
  throw new Error('Transcription timeout')
}

// 使用示例
try {
  const result = await waitForTranscription(taskId)
  console.log('转录完成:', result.fullText)
} catch (error) {
  console.error('转录失败:', error)
}
```

### 5. 批量处理
```javascript
// POST /api/transcription/batch
const formData = new FormData()
formData.append('files', file1)
formData.append('files', file2)
formData.append('files', file3)

const response = await fetch('/api/transcription/batch', {
  method: 'POST',
  body: formData
})

const { batchTaskId, subTasks } = await response.json()
console.log('批量任务ID:', batchTaskId)
console.log('子任务:', subTasks)
```

### 6. 任务管理

#### 获取任务列表
```javascript
// GET /api/transcription/tasks?status=processing&page=1&limit=10
const response = await fetch('/api/transcription/tasks?status=processing')
const { tasks, total, hasMore } = await response.json()
```

#### 重试失败任务
```javascript
// POST /api/transcription/task/:taskId/retry
const response = await fetch(`/api/transcription/task/${taskId}/retry`, {
  method: 'POST'
})
const { newTaskId } = await response.json()
```

#### 删除任务
```javascript
// DELETE /api/transcription/task/:taskId
await fetch(`/api/transcription/task/${taskId}`, {
  method: 'DELETE'
})
```

## 任务状态说明

| 状态 | 说明 | 进度范围 |
|------|------|---------|
| `pending` | 任务已创建，等待处理 | 0% |
| `processing` | 任务正在处理中 | 10-95% |
| `succeeded` | 任务成功完成 | 100% |
| `failed` | 任务失败 | - |

## 错误处理

### 常见错误码
- `400` - 请求参数错误
- `401` - API密钥无效
- `403` - 权限不足
- `404` - 任务不存在
- `413` - 文件过大
- `429` - 请求频率超限
- `500` - 服务器错误

### 错误处理示例
```javascript
try {
  const response = await fetch('/api/transcription/file', {
    method: 'POST',
    body: formData
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Request failed')
  }
  
  const result = await response.json()
  // 处理结果
} catch (error) {
  console.error('转录错误:', error.message)
  
  // 根据错误类型处理
  if (error.message.includes('API key')) {
    // 处理API密钥错误
  } else if (error.message.includes('File too large')) {
    // 处理文件过大错误
  }
}
```

## 配置选项

### 转录参数说明
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `format` | string | auto | 音频格式，auto自动识别 |
| `sampleRate` | number | 16000 | 采样率（Hz） |
| `languages` | array | ['zh','en'] | 语言提示 |
| `enableWords` | boolean | true | 返回词级时间戳 |
| `enableTimestamp` | boolean | true | 返回句子时间戳 |
| `removeDisfluency` | boolean | false | 去除语气词 |
| `enablePunctuation` | boolean | true | 自动添加标点 |

## 性能优化

### 1. 文件预处理
- 压缩大文件到合理大小
- 转换为支持的格式
- 降低采样率到16kHz

### 2. 并发控制
- 控制并发请求数量
- 实现请求队列
- 使用批量接口

### 3. 缓存策略
- 缓存转录结果
- 避免重复转录

## 监控与统计

### 获取统计信息
```javascript
// GET /api/transcription/statistics
const response = await fetch('/api/transcription/statistics')
const { statistics } = await response.json()

console.log('总任务数:', statistics.total)
console.log('成功率:', statistics.successRate + '%')
console.log('平均执行时间:', statistics.averageExecutionTime + 'ms')
```

## 注意事项

1. **文件大小限制**: 单个文件最大100MB
2. **并发限制**: 建议控制并发数在10以内
3. **任务有效期**: 任务结果保留24小时
4. **API密钥安全**: 不要在客户端暴露API密钥
5. **错误重试**: 实现指数退避重试策略

## 支持的格式

### 音频格式
- WAV, MP3, AAC, OPUS
- FLAC, OGG, AMR
- M4A

### 视频格式
- MP4, MOV, AVI
- MKV, WMV, FLV
- WEBM

## 环境变量

在`.env`文件中配置：
```bash
# 阿里云API密钥（必需）
ALIYUN_API_KEY=your-api-key-here
```

## 故障排查

### 任务一直处于processing状态
1. 检查阿里云API密钥是否有效
2. 检查网络连接
3. 查看服务器日志

### 转录结果不准确
1. 确保音频质量良好
2. 正确设置语言参数
3. 尝试调整采样率

### 文件上传失败
1. 检查文件格式是否支持
2. 确认文件大小未超限
3. 验证multipart配置

## 更新日志

### v1.0.0 (2024-01-01)
- 初始版本发布
- 支持文件和URL转录
- 实现任务管理系统
- 添加批量处理功能
- 支持任务持久化存储