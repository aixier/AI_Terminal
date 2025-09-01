# SenseVoice 服务使用说明

## 概述
SenseVoice 是阿里云提供的语音识别服务，支持音视频文件的高精度转录，可识别中英文混合内容，并提供时间戳、标点符号等详细信息。

## 主要功能
- 音视频文件转录（支持多种格式）
- 多语言识别（中文、英文等）
- 时间戳标注（句子级、词级）
- 异步任务处理
- 批量转录

## 配置要求

### 环境变量
```bash
# SenseVoice API 配置（必需）
ALIYUN_API_KEY=sk-xxxxxxxxxxxxx  # 阿里云 API Key
```

### 支持的文件格式
- **音频**: wav, mp3, m4a, aac, opus, flac, ogg, amr
- **视频**: mp4, mov, avi, mkv, wmv, flv, webm
- **文件大小**: 最大 100MB
- **时长限制**: 最长 3 小时

## 核心模块

### 1. SenseVoiceService 类
路径：`src/services/SenseVoice/SenseVoiceService.js`

```javascript
import senseVoiceService from '../services/SenseVoice/index.js';
```

### 2. 主要方法

#### 提交 URL 转录任务
```javascript
const result = await senseVoiceService.submitUrlTranscriptionTask(fileUrl, {
  languages: ['zh', 'en'],           // 语言提示
  enableWords: true,                  // 启用词级时间戳
  enableTimestamp: true,              // 启用时间戳
  enablePunctuation: true,            // 启用标点符号
  removeDisfluency: false             // 移除语气词
});
```

#### 查询任务状态
```javascript
const status = await senseVoiceService.getTaskStatus(taskId);
// 返回: { status: 'processing', progress: 50, message: '...' }
```

#### 获取转录结果
```javascript
const result = await senseVoiceService.getTaskResult(taskId);
// 返回: { fullText: '...', sentences: [...], duration: 122 }
```

## API 调用流程

### 1. 异步任务模式
```javascript
// 步骤 1: 提交任务
const { taskId } = await senseVoiceService.submitUrlTranscriptionTask(url);

// 步骤 2: 轮询状态
let status;
do {
  await sleep(5000); // 等待 5 秒
  status = await senseVoiceService.getTaskStatus(taskId);
} while (status.status === 'processing');

// 步骤 3: 获取结果
if (status.status === 'succeeded') {
  const result = await senseVoiceService.getTaskResult(taskId);
}
```

### 2. 任务管理器
路径：`src/services/SenseVoice/TaskManager.js`

```javascript
import TaskManager from '../services/SenseVoice/TaskManager.js';

// 获取所有任务
const tasks = TaskManager.getAllTasks({
  status: 'succeeded',
  page: 1,
  limit: 20
});

// 获取统计信息
const stats = TaskManager.getStatistics();
```

## 转录结果格式

### 1. 基础结果结构
```javascript
{
  "fullText": "完整的转录文本...",
  "sentences": [
    {
      "text": "第一句话",
      "startTime": 0,        // 开始时间（秒）
      "endTime": 3.5,        // 结束时间（秒）
      "words": [...]         // 词级信息（如果启用）
    }
  ],
  "language": "zh",          // 主要语言
  "duration": 122.5,         // 总时长（秒）
  "wordCount": 500,          // 总词数
  "sentenceCount": 20        // 总句数
}
```

### 2. 详细转录结果
```javascript
{
  "transcripts": [{
    "channel_id": 0,
    "content_duration_in_milliseconds": 122120,
    "text": "完整文本",
    "sentences": [
      {
        "begin_time": 0,         // 毫秒
        "end_time": 19020,       // 毫秒
        "text": "句子文本"
      }
    ]
  }],
  "properties": {
    "audio_format": "aac",
    "channels": [0, 1],
    "original_sampling_rate": 44100,
    "original_duration_in_milliseconds": 122139
  }
}
```

## 参数说明

### 转录参数
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `language_hints` | Array | ['zh', 'en'] | 语言提示，提高识别准确率 |
| `enable_timestamp` | Boolean | true | 启用时间戳 |
| `enable_words` | Boolean | false | 启用词级时间戳 |
| `enable_punctuation` | Boolean | true | 自动添加标点符号 |
| `disfluency_removal` | Boolean | false | 移除语气词（如"呃"、"嗯"） |
| `sample_rate` | Number | 16000 | 采样率 |
| `format` | String | 'auto' | 音频格式，auto 为自动检测 |

### 任务状态
- `pending`: 等待处理
- `processing`: 处理中
- `succeeded`: 成功完成
- `failed`: 处理失败

## 使用示例

### 1. 完整转录流程
```javascript
async function transcribeVideo(videoUrl) {
  try {
    // 1. 提交转录任务
    const { taskId } = await senseVoiceService.submitUrlTranscriptionTask(
      videoUrl, 
      {
        languages: ['zh', 'en'],
        enableTimestamp: true,
        enableWords: true
      }
    );
    
    console.log(`任务已提交，ID: ${taskId}`);
    
    // 2. 等待任务完成
    let attempts = 0;
    const maxAttempts = 120; // 最多等待 10 分钟
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const status = await senseVoiceService.getTaskStatus(taskId);
      
      if (status.status === 'succeeded') {
        // 3. 获取结果
        const result = await senseVoiceService.getTaskResult(taskId);
        return result;
      } else if (status.status === 'failed') {
        throw new Error(status.error);
      }
      
      attempts++;
      console.log(`进度: ${status.progress}%`);
    }
    
    throw new Error('转录超时');
  } catch (error) {
    console.error('转录失败:', error);
    throw error;
  }
}
```

### 2. 批量转录
```javascript
async function batchTranscribe(fileUrls) {
  const tasks = [];
  
  // 提交所有任务
  for (const url of fileUrls) {
    const { taskId } = await senseVoiceService.submitUrlTranscriptionTask(url);
    tasks.push({ url, taskId });
  }
  
  // 等待所有任务完成
  const results = await Promise.all(
    tasks.map(async ({ url, taskId }) => {
      // 轮询等待完成
      // ... 省略轮询逻辑
      const result = await senseVoiceService.getTaskResult(taskId);
      return { url, result };
    })
  );
  
  return results;
}
```

## 最佳实践

### 1. 音频质量优化
- 使用高质量音频（采样率 16kHz 以上）
- 避免过度压缩
- 减少背景噪音

### 2. 性能优化
- 使用异步任务模式
- 实现任务队列管理
- 批量处理优化

### 3. 错误处理
```javascript
try {
  const result = await senseVoiceService.submitUrlTranscriptionTask(url);
} catch (error) {
  if (error.message.includes('Rate limit')) {
    // 限流处理：等待后重试
    await sleep(60000);
    return retry();
  } else if (error.message.includes('Invalid format')) {
    // 格式错误：转换格式后重试
    const convertedUrl = await convertFormat(url);
    return transcribe(convertedUrl);
  }
  throw error;
}
```

### 4. 结果处理
```javascript
// 生成字幕文件
function generateSRT(sentences) {
  return sentences.map((s, i) => {
    const start = formatTime(s.startTime);
    const end = formatTime(s.endTime);
    return `${i + 1}\n${start} --> ${end}\n${s.text}\n`;
  }).join('\n');
}

// 生成带时间戳的 Markdown
function generateTimestampedMD(sentences) {
  return sentences.map(s => {
    const time = formatTime(s.startTime);
    return `### [${time}]\n${s.text}\n`;
  }).join('\n');
}
```

## 故障排查

### 常见错误

1. **Authentication failed**
   - 检查 API Key 是否正确
   - 确认 API Key 有效期

2. **File format not supported**
   - 检查文件格式
   - 确认文件未损坏

3. **Rate limit exceeded**
   - 降低请求频率
   - 实现请求队列

4. **Task timeout**
   - 检查文件大小
   - 延长轮询时间

### 调试技巧

1. **启用详细日志**
```javascript
import logger from '../utils/logger.js';
logger.level = 'debug';
```

2. **保存中间结果**
```javascript
// 保存任务信息
fs.writeFileSync(`task-${taskId}.json`, JSON.stringify(taskInfo));
```

3. **使用测试文件**
```javascript
// 使用小文件测试
const testFile = 'test-audio-10s.mp3';
```

## 限制说明

1. **API 限制**
   - QPS 限制：10 次/秒
   - 并发任务：最多 10 个
   - 每日配额：根据套餐

2. **文件限制**
   - 单文件：最大 100MB
   - 时长：最长 3 小时
   - 格式：见支持格式列表

3. **结果保存**
   - 任务结果保存 7 天
   - 超时自动清理

## 相关资源

- [阿里云 SenseVoice 官方文档](https://help.aliyun.com/zh/model-studio/developer-reference/sensevoice-recorded-speech-recognition-restful-api)
- [DashScope API 文档](https://dashscope.aliyun.com/)
- [语音识别最佳实践](https://help.aliyun.com/document_detail/471191.html)