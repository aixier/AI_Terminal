# AI Terminal Backend

音视频转录服务后端，集成阿里云 OSS 存储和 SenseVoice 语音识别服务。

## 功能特性

- 🎯 **音视频转录**: 支持多种音视频格式的高精度转录
- 💾 **OSS 存储**: 自动上传文件到阿里云 OSS，生成安全的访问链接
- ⏱️ **时间戳标注**: 提供句子级和词级时间戳
- 🌐 **多语言支持**: 支持中英文混合识别
- 📦 **批量处理**: 支持批量文件转录
- 🔄 **异步处理**: 任务异步执行，支持进度查询

## 快速开始

### 环境要求

- Node.js >= 16.0
- npm >= 7.0

### 安装

```bash
# 克隆项目
git clone https://github.com/your-repo/ai-terminal.git
cd ai-terminal/terminal-backend

# 安装依赖
npm install

# 复制环境变量配置
cp .env.example .env

# 编辑 .env 文件，填入你的 API 密钥
```

### 配置

编辑 `.env` 文件，配置以下必要参数：

```bash
# 阿里云 SenseVoice API
ALIYUN_API_KEY=your_sensevoice_api_key

# 阿里云 OSS
OSS_ACCESS_KEY_ID=your_oss_access_key_id
OSS_ACCESS_KEY_SECRET=your_oss_access_key_secret
OSS_BUCKET=your_bucket_name
OSS_REGION=oss-cn-hangzhou
```

### 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

服务将在 `http://localhost:6009` 启动

## API 文档

### 主要接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/transcription/file` | 上传文件并转录 |
| POST | `/api/transcription/url` | 从 URL 转录 |
| GET | `/api/transcription/task/:taskId` | 查询任务状态 |
| GET | `/api/transcription/task/:taskId/result` | 获取转录结果 |

详细 API 文档请参考：
- [转录接口使用说明](./docs/transcription-api-guide.md)
- [OSS 服务使用说明](./docs/oss-service-guide.md)
- [SenseVoice 服务使用说明](./docs/sensevoice-service-guide.md)

## 使用示例

### 1. 上传文件转录

```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('languages', JSON.stringify(['zh', 'en']));

const response = await fetch('http://localhost:6009/api/transcription/file', {
  method: 'POST',
  body: formData
});

const { taskId } = await response.json();
```

### 2. 查询任务状态

```javascript
const response = await fetch(`http://localhost:6009/api/transcription/task/${taskId}`);
const { status, progress } = await response.json();
```

### 3. 获取转录结果

```javascript
const response = await fetch(`http://localhost:6009/api/transcription/task/${taskId}/result`);
const { data } = await response.json();
console.log(data.fullText); // 完整转录文本
console.log(data.sentences); // 带时间戳的句子
```

## 项目结构

```
terminal-backend/
├── src/
│   ├── routes/           # API 路由
│   │   └── transcription.js
│   ├── services/         # 核心服务
│   │   ├── oss/         # OSS 存储服务
│   │   └── SenseVoice/  # 语音识别服务
│   ├── utils/           # 工具函数
│   └── config/          # 配置文件
├── docs/                # 文档
├── test/               # 测试文件
└── package.json
```

## 测试

运行完整的端到端测试：

```bash
node test-transcription-final.js
```

这将执行完整的转录流程：
1. 上传文件到 OSS
2. 提交转录任务
3. 轮询任务状态
4. 获取转录结果
5. 生成带时间戳的 Markdown 文件

## 支持的格式

### 音频格式
- WAV, MP3, M4A, AAC
- OPUS, FLAC, OGG, AMR

### 视频格式
- MP4, MOV, AVI, MKV
- WMV, FLV, WebM

### 限制
- 单文件最大：100MB
- 时长最长：3小时

## 常见问题

### 1. API Key 配置
- SenseVoice API Key: 在[阿里云控制台](https://dashscope.console.aliyun.com/apiKey)获取
- OSS Access Key: 在[RAM控制台](https://ram.console.aliyun.com/manage/ak)获取

### 2. OSS Bucket 配置
- 确保 Bucket 已创建
- 设置正确的区域（Region）
- 配置 CORS 规则（如需前端直传）

### 3. 转录失败处理
- 检查文件格式是否支持
- 确认文件大小未超限
- 验证 API Key 是否有效

## 许可证

MIT

## 贡献

欢迎提交 Issue 和 Pull Request！

## 联系方式

- Issues: [GitHub Issues](https://github.com/your-repo/ai-terminal/issues)
- Email: your-email@example.com