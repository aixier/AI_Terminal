# AI Terminal Backend

智能内容生成和音视频转录服务后端，集成阿里云 OSS 存储、SenseVoice 语音识别和多种AI生成服务。

## 功能特性

### 🎯 音视频转录服务
- 支持多种音视频格式的高精度转录
- 自动上传文件到阿里云 OSS，生成安全的访问链接
- 提供句子级和词级时间戳
- 支持中英文混合识别
- 批量处理和异步执行，支持进度查询

### 🎨 智能内容生成服务
- **卡片生成**: 同步/异步/流式卡片内容生成
- **自定义模板**: 支持ZIP模板上传和自定义生成
- **Pod2Post播客卡片**: 专业播客内容卡片生成
- **资源管理**: CDN图片、照片、参考文档上传管理
- **Base64嵌入**: 自动图片Base64嵌入和清理机制

### 🛠️ 核心技术特性
- 异步任务处理和状态跟踪
- 多用户认证和工作空间隔离
- 完整的文件管理和清理机制
- 模块化路由设计和服务架构

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

#### 转录服务 `/api/transcription`
| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/file` | 上传文件并转录 |
| POST | `/url` | 从 URL 转录 |
| POST | `/batch` | 批量转录多个文件 |
| GET | `/task/:taskId` | 查询任务状态 |
| GET | `/task/:taskId/result` | 获取转录结果 |
| GET | `/tasks` | 获取任务列表 |
| GET | `/formats` | 获取支持的格式 |
| DELETE | `/task/:taskId` | 删除任务 |
| POST | `/task/:taskId/retry` | 重试失败的任务 |
| GET | `/statistics` | 获取统计信息 |

#### 生成服务 `/api/generate`
| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/card` | 同步卡片生成 |
| POST | `/card/async` | 异步卡片生成 |
| POST | `/card/stream` | 流式卡片生成 |
| GET | `/card/query/:folderName` | 查询卡片内容 |
| GET | `/card/content/:folderName` | 获取格式化内容 |
| POST | `/custom/async` | 自定义模板异步生成 |
| GET | `/custom/status/:taskId` | 查询自定义任务状态 |
| POST | `/custom/ossasync` | OSS自定义模板生成 |
| GET | `/custom/ossstatus/:taskId` | OSS任务状态查询 |
| POST | `/pod2post/async` | Pod2Post播客卡片生成 |
| GET | `/pod2post/status/:taskId` | Pod2Post任务状态查询 |
| POST | `/pod2post/cdn` | CDN图片上传 |
| POST | `/pod2post/pic` | 照片上传 |
| POST | `/pod2post/resources` | 参考文档上传 |
| GET | `/templates` | 获取模板列表 |
| GET | `/status/:topic` | 获取生成状态 |
| POST | `/cc` | Claude执行 |
| POST | `/share/xiaohongshu` | 分享到小红书 |
| GET | `/health` | 健康检查 |

详细 API 文档请参考：
- [转录接口使用说明](./docs/transcription-api-guide.md)
- [OSS 服务使用说明](./docs/oss-service-guide.md)
- [SenseVoice 服务使用说明](./docs/sensevoice-service-guide.md)

## 使用示例

### 转录服务示例

#### 1. 上传文件转录

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

#### 2. 查询任务状态

```javascript
const response = await fetch(`http://localhost:6009/api/transcription/task/${taskId}`);
const { status, progress } = await response.json();
```

#### 3. 获取转录结果

```javascript
const response = await fetch(`http://localhost:6009/api/transcription/task/${taskId}/result`);
const { data } = await response.json();
console.log(data.fullText); // 完整转录文本
console.log(data.sentences); // 带时间戳的句子
```

### Pod2Post生成服务示例

#### 1. 播客卡片生成

```javascript
const response = await fetch('http://localhost:6009/api/generate/pod2post/async', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompts: ['播客内容概要', '主要观点总结'],
    token: 'user_token'
  })
});

const { taskId } = await response.json();
```

#### 2. 上传CDN图片

```javascript
const formData = new FormData();
formData.append('images', file1);
formData.append('images', file2);
formData.append('clearBase64', 'true');

const response = await fetch('http://localhost:6009/api/generate/pod2post/cdn', {
  method: 'POST',
  body: formData
});
```

#### 3. 上传参考文档

```javascript
const formData = new FormData();
formData.append('files', pdfFile);
formData.append('files', mdFile);
formData.append('clearBase64', 'true');

const response = await fetch('http://localhost:6009/api/generate/pod2post/resources', {
  method: 'POST',
  body: formData
});
```

## 项目结构

```
terminal-backend/
├── src/
│   ├── routes/           # API 路由
│   │   ├── transcription.js     # 转录接口
│   │   ├── assets.js            # 静态资源
│   │   └── generate/            # 生成服务路由
│   │       ├── index.js         # 路由入口
│   │       ├── card.js          # 卡片生成
│   │       ├── cardAsync.js     # 异步卡片生成
│   │       ├── cardStream.js    # 流式卡片生成
│   │       ├── customAsync.js   # 自定义模板生成
│   │       ├── pod2postAsync.js # Pod2Post生成
│   │       ├── pod2postStatus.js # Pod2Post状态查询
│   │       ├── pod2postCdn.js   # CDN图片上传
│   │       ├── pod2postPic.js   # 照片上传
│   │       ├── pod2postResources.js # 参考文档上传
│   │       ├── templates.js     # 模板管理
│   │       ├── claude.js        # Claude执行
│   │       └── share.js         # 分享功能
│   ├── services/         # 核心服务
│   │   ├── oss/         # OSS 存储服务
│   │   ├── SenseVoice/  # 语音识别服务
│   │   ├── userService.js # 用户服务
│   │   └── referenceConverter.js # 参考资料转换
│   ├── utils/           # 工具函数
│   │   ├── promptProcessor.js   # 提示词处理
│   │   ├── htmlToBase64Converter.js # HTML转Base64
│   │   ├── zipProcessor.js      # ZIP处理
│   │   └── logger.js            # 日志工具
│   ├── middleware/      # 中间件
│   │   └── userAuth.js  # 用户认证
│   └── config/          # 配置文件
├── data/                # 数据目录
│   ├── public_template/ # 公共模板
│   │   └── pod2post/   # Pod2Post模板
│   │       ├── CDN/    # CDN图片
│   │       ├── 照片/    # 照片资源
│   │       └── resources/ # 参考文档
│   └── users/          # 用户数据
├── docs/               # 文档
├── test/              # 测试文件
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