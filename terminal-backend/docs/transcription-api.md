# 音视频转文字API文档

## 概述
本服务使用阿里云的SenseVoice API实现音频和视频文件的语音转文字功能。支持多种音视频格式，提供高精度的中英文识别。

## 配置要求

### 环境变量
在`.env`文件中添加阿里云API密钥：
```bash
ALIYUN_API_KEY=your-aliyun-api-key
```

获取API密钥：
1. 登录[阿里云控制台](https://dashscope.console.aliyun.com/)
2. 创建API密钥
3. 将密钥添加到环境变量

## API端点

### 1. 获取支持的格式
**端点:** `GET /api/transcription/formats`

**响应示例:**
```json
{
  "success": true,
  "formats": ["wav", "mp3", "mp4", "m4a", "aac", "opus", "flac", "ogg", "amr", "webm", "mov", "avi", "mkv", "wmv", "flv"],
  "maxFileSize": "100MB"
}
```

### 2. 文件上传转录
**端点:** `POST /api/transcription/file`

**请求类型:** `multipart/form-data`

**参数:**
- `file` (required): 音频/视频文件
- `format` (optional): 文件格式，默认auto
- `sampleRate` (optional): 采样率，默认16000
- `languages` (optional): 语言列表，默认["zh", "en"]
- `enableWords` (optional): 是否返回词级别时间戳，默认true
- `enableTimestamp` (optional): 是否返回时间戳，默认true
- `removeDisfluency` (optional): 是否去除语气词，默认false
- `enablePunctuation` (optional): 是否添加标点，默认true

**响应示例:**
```json
{
  "success": true,
  "taskId": "task-12345",
  "fullText": "这是转录的文本内容",
  "sentences": [
    {
      "text": "这是第一句",
      "startTime": 0,
      "endTime": 2.5,
      "words": [
        {"text": "这", "startTime": 0, "endTime": 0.5},
        {"text": "是", "startTime": 0.5, "endTime": 1.0}
      ]
    }
  ],
  "language": "zh",
  "duration": 10.5,
  "metadata": {
    "model": "sensevoice-v1",
    "processedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### 3. URL转录
**端点:** `POST /api/transcription/url`

**请求类型:** `application/json`

**参数:**
```json
{
  "url": "https://example.com/audio.mp3",
  "format": "auto",
  "sampleRate": 16000,
  "languages": ["zh", "en"],
  "enableWords": true,
  "enableTimestamp": true,
  "removeDisfluency": false,
  "enablePunctuation": true
}
```

**响应:** 同文件上传转录

### 4. 批量转录
**端点:** `POST /api/transcription/batch`

**请求类型:** `multipart/form-data`

**参数:**
- `files` (required): 多个音频/视频文件（最多10个）
- 其他参数同单文件上传

**响应示例:**
```json
{
  "success": true,
  "total": 3,
  "successful": 2,
  "failed": 1,
  "results": [
    {
      "filename": "audio1.mp3",
      "success": true,
      "fullText": "转录文本1",
      // ... 其他字段
    }
  ],
  "errors": [
    {
      "filename": "audio3.wav",
      "error": "File too large"
    }
  ]
}
```

## 使用示例

### JavaScript/Node.js
```javascript
import axios from 'axios'
import FormData from 'form-data'
import fs from 'fs'

// 文件上传转录
const formData = new FormData()
formData.append('file', fs.createReadStream('audio.mp3'))
formData.append('languages', JSON.stringify(['zh', 'en']))
formData.append('enableTimestamp', 'true')

const response = await axios.post(
  'http://localhost:3000/api/transcription/file',
  formData,
  { headers: formData.getHeaders() }
)

console.log(response.data.fullText)
```

### cURL
```bash
# 文件上传
curl -X POST http://localhost:3000/api/transcription/file \
  -F "file=@audio.mp3" \
  -F "languages=[\"zh\",\"en\"]" \
  -F "enableTimestamp=true"

# URL转录
curl -X POST http://localhost:3000/api/transcription/url \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/audio.mp3",
    "languages": ["zh", "en"]
  }'
```

## 错误处理

### 错误响应格式
```json
{
  "success": false,
  "error": "错误描述信息"
}
```

### 常见错误码
- `400`: 请求参数错误或文件格式不支持
- `401`: API密钥未配置或无效
- `403`: 权限不足
- `413`: 文件过大（超过100MB）
- `429`: 请求频率超限
- `500`: 服务器内部错误

## 注意事项

1. **文件大小限制:** 单个文件最大100MB
2. **支持格式:** 支持主流音视频格式，具体列表通过`/formats`端点获取
3. **并发限制:** 建议控制并发请求数量，避免触发频率限制
4. **异步处理:** 大文件会采用异步处理，API会轮询获取结果
5. **语言支持:** 主要支持中文和英文，其他语言识别效果可能较差

## 性能优化建议

1. **文件预处理:**
   - 转换为支持的格式
   - 降低采样率到16kHz（语音识别足够）
   - 压缩文件大小

2. **批量处理:**
   - 使用批量接口处理多个文件
   - 实现客户端重试机制

3. **缓存策略:**
   - 缓存转录结果
   - 避免重复转录相同文件

## 参考链接

- [阿里云SenseVoice API文档](https://help.aliyun.com/zh/model-studio/developer-reference/sensevoice-recorded-speech-recognition-restful-api)
- [阿里云控制台](https://dashscope.console.aliyun.com/)