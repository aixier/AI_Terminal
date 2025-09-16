# GET /api/transcription/task/{taskId}/result 返回数据 Schema

## 接口概述
- **路径**: `/api/transcription/task/{taskId}/result`
- **方法**: GET
- **功能**: 获取音频/视频转录任务的结果
- **实现位置**: `/terminal-backend/src/routes/transcription.js` (行444)

## 返回数据结构

### 1. 成功状态 (status: 'succeeded')

```json
{
  "success": true,
  "taskId": "task_1234567890",
  "status": "succeeded",
  "transcription": "纯文本转录内容，所有文字连在一起",
  "fullText": "纯文本转录内容（同transcription）",
  "sentences": [
    {
      "text": "这是第一句话",
      "startTime": 0.0,
      "endTime": 2.5,
      "words": [
        {
          "text": "这",
          "startTime": 0.0,
          "endTime": 0.3
        },
        {
          "text": "是",
          "startTime": 0.3,
          "endTime": 0.6
        }
      ]
    },
    {
      "text": "这是第二句话",
      "startTime": 2.5,
      "endTime": 5.0,
      "words": []
    }
  ],
  "language": "zh",
  "duration": 5000,
  "wordCount": 20,
  "sentenceCount": 2,
  "metadata": {
    "model": "sensevoice-v1",
    "processedAt": "2024-01-01T12:00:00.000Z",
    "audioFormat": "mp3",
    "originalDuration": 5000
  }
}
```

### 2. 处理中状态 (status: 'processing')

```json
{
  "success": false,
  "taskId": "task_1234567890",
  "status": "processing",
  "message": "Task is still processing",
  "progress": 45
}
```

### 3. 失败状态 (status: 'failed')

```json
{
  "success": false,
  "taskId": "task_1234567890",
  "status": "failed",
  "message": "Task failed: 具体错误信息",
  "error": "具体的错误详情"
}
```

### 4. 任务不存在 (404错误)

```json
{
  "success": false,
  "error": "Task not found"
}
```

## 字段说明

### 核心字段
| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| success | boolean | 是 | 请求是否成功 |
| taskId | string | 是 | 任务ID |
| status | string | 是 | 任务状态：succeeded/processing/failed |

### 转录结果字段（仅在 status='succeeded' 时）
| 字段名 | 类型 | 说明 |
|--------|------|------|
| transcription | string | 纯文本转录内容（主要字段） |
| fullText | string | 同transcription，为兼容性保留 |
| sentences | array | 分句数组，包含时间戳信息 |
| sentences[].text | string | 句子文本内容 |
| sentences[].startTime | number | 开始时间（秒） |
| sentences[].endTime | number | 结束时间（秒） |
| sentences[].words | array | 单词级别的时间戳（可选） |
| language | string | 语言代码（如：zh、en） |
| duration | number | 音频时长（毫秒） |
| wordCount | number | 字数统计 |
| sentenceCount | number | 句子数量 |

### 元数据字段
| 字段名 | 类型 | 说明 |
|--------|------|------|
| metadata.model | string | 使用的模型版本 |
| metadata.processedAt | string | 处理时间（ISO格式） |
| metadata.audioFormat | string | 音频格式 |
| metadata.originalDuration | number | 原始音频时长（毫秒） |

## 客户端使用示例

### 前端页面中的处理逻辑（audio-transcription-direct-fixed.html）

```javascript
// 轮询任务状态（行591）
const response = await fetch(`${apiEndpoint}/transcription/task/${taskId}/result`);
const data = await response.json();

// 判断状态
if (data.status === 'succeeded') {
    // 处理成功结果
    // 1. 获取纯文本
    const plainText = data.transcription;

    // 2. 获取带时间戳的分句
    const segments = data.sentences || [];
    segments.forEach(segment => {
        const startTime = formatTimestamp(segment.startTime);
        const endTime = formatTimestamp(segment.endTime);
        const text = segment.text;
        console.log(`[${startTime} → ${endTime}] ${text}`);
    });

} else if (data.status === 'failed') {
    // 处理失败
    console.error('转录失败:', data.error);

} else if (data.status === 'processing') {
    // 继续轮询
    console.log('处理中...', data.progress + '%');
}
```

## 备注

1. **兼容性考虑**：
   - `transcription` 和 `fullText` 包含相同内容，为兼容不同版本
   - `sentences` 可能为空数组（如果转录服务未提供时间戳）

2. **时间戳格式**：
   - 所有时间戳以秒为单位（浮点数）
   - 部分字段可能使用 `begin_time`/`end_time` 而非 `startTime`/`endTime`

3. **前端下载功能**：
   - 下载功能在客户端生成，不是通过服务器文件列表
   - 基于返回的 `transcription` 和 `sentences` 数据动态创建下载文件

4. **HTTP状态码**：
   - 200：成功或处理中
   - 202：任务仍在处理中
   - 400：任务失败
   - 404：任务不存在