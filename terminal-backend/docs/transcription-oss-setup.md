# 音视频转录服务 OSS 配置指南

## 概述

音视频转录服务现已集成阿里云OSS存储服务，实现了以下工作流程：
1. 用户上传音视频文件到后端
2. 后端将文件上传到OSS
3. 生成签名URL供阿里云转录API访问
4. 使用URL调用SenseVoice转录服务
5. 返回转录结果给用户

## 环境变量配置

在 `.env` 文件中添加以下配置：

```bash
# 阿里云OSS配置（用于转录服务）
OSS_TRANSCRIPTION_ACCESS_KEY_ID=your_access_key_id
OSS_TRANSCRIPTION_ACCESS_KEY_SECRET=your_access_key_secret
OSS_TRANSCRIPTION_BUCKET=your_bucket_name
OSS_TRANSCRIPTION_REGION=oss-cn-beijing  # 根据实际区域调整

# 如果没有专门的转录OSS配置，会使用默认配置
OSS_ACCESS_KEY_ID=your_default_access_key_id
OSS_ACCESS_KEY_SECRET=your_default_access_key_secret
OSS_BUCKET=your_default_bucket_name
OSS_REGION=oss-cn-beijing

# 阿里云转录服务API密钥
ALIYUN_API_KEY=your_dashscope_api_key
```

## OSS Bucket 结构

转录服务会在OSS中创建以下目录结构：

```
transcription/
├── audio/           # 音频文件
│   └── [timestamp]-[random].mp3
├── video/           # 视频文件
│   └── [timestamp]-[random].mp4
└── batch/           # 批量处理
    └── batch-[id]/
        ├── audio/
        └── video/
```

## OSS Bucket 权限配置

### 1. Bucket 访问权限
- 建议设置为 **私有（Private）**
- 通过签名URL控制访问

### 2. 跨域配置（CORS）
如果需要前端直接访问，配置CORS规则：

```json
{
  "CORSRule": [{
    "AllowedOrigin": ["*"],
    "AllowedMethod": ["GET", "HEAD"],
    "AllowedHeader": ["*"],
    "ExposeHeader": ["Content-Length", "Content-Type"],
    "MaxAgeSeconds": 300
  }]
}
```

### 3. 生命周期规则
建议配置自动清理规则：

```json
{
  "Rule": [{
    "ID": "delete-temp-transcription-files",
    "Prefix": "transcription/",
    "Status": "Enabled",
    "Expiration": {
      "Days": 7  // 7天后自动删除
    }
  }]
}
```

## API 使用示例

### 1. 单文件转录

```bash
curl -X POST http://localhost:3000/api/transcription/file \
  -H "Content-Type: multipart/form-data" \
  -F "file=@/path/to/audio.mp3" \
  -F "languages=[\"zh\", \"en\"]" \
  -F "enableTimestamp=true"
```

响应示例：
```json
{
  "success": true,
  "taskId": "task-123456",
  "message": "Task submitted successfully",
  "status": "processing",
  "ossPath": "transcription/audio/1234567890-abc123.mp3"
}
```

### 2. 批量转录

```bash
curl -X POST http://localhost:3000/api/transcription/batch \
  -H "Content-Type: multipart/form-data" \
  -F "files=@audio1.mp3" \
  -F "files=@audio2.mp3" \
  -F "files=@video1.mp4" \
  -F "enableWords=true"
```

响应示例：
```json
{
  "success": true,
  "total": 3,
  "successful": 3,
  "failed": 0,
  "batchId": "batch-1234567890-xyz789",
  "results": [
    {
      "filename": "audio1.mp3",
      "taskId": "task-001",
      "ossPath": "transcription/batch/batch-1234567890-xyz789/audio/..."
    }
  ]
}
```

### 3. URL转录（直接使用外部URL）

```bash
curl -X POST http://localhost:3000/api/transcription/url \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/audio.mp3",
    "languages": ["zh", "en"]
  }'
```

## 文件大小和格式限制

### 支持的格式
- **音频**: mp3, wav, m4a, aac, opus, flac, ogg, amr
- **视频**: mp4, avi, mov, mkv, wmv, flv, webm

### 文件大小限制
- 单个文件最大: 100MB
- 批量上传: 每批最多10个文件

## 签名URL有效期

- 默认有效期: 2小时（7200秒）
- 用于确保转录任务有足够时间完成
- 过期后文件仍保留在OSS中，但无法通过该URL访问

## 故障排查

### 常见问题

1. **上传失败**
   - 检查OSS配置是否正确
   - 确认Access Key有上传权限
   - 检查网络连接

2. **转录失败**
   - 确认文件格式支持
   - 检查文件大小是否超限
   - 验证阿里云API密钥

3. **URL无法访问**
   - 检查签名URL是否过期
   - 确认OSS Bucket权限设置
   - 验证文件是否存在

### 日志查看

```bash
# 查看转录服务日志
tail -f logs/app.log | grep transcription

# 查看OSS上传日志
tail -f logs/app.log | grep OSS
```

## 安全建议

1. **使用RAM账号**
   - 创建专门的RAM账号用于转录服务
   - 只授予必要的OSS权限

2. **定期轮换密钥**
   - 定期更新Access Key
   - 使用密钥管理服务

3. **监控和告警**
   - 监控OSS使用量
   - 设置异常访问告警

4. **数据保护**
   - 敏感音视频考虑加密存储
   - 及时清理不需要的文件

## 成本优化

1. **存储优化**
   - 配置生命周期自动删除
   - 使用低频访问存储类型

2. **流量优化**
   - 使用内网传输（如果服务器在阿里云）
   - 启用传输压缩

3. **并发控制**
   - 限制并发上传数量
   - 实施请求限流

## 相关文档

- [阿里云OSS SDK文档](https://help.aliyun.com/document_detail/32067.html)
- [SenseVoice API文档](https://help.aliyun.com/zh/model-studio/developer-reference/sensevoice-recorded-speech-recognition-restful-api)
- [项目OSS服务文档](./oss-service.md)