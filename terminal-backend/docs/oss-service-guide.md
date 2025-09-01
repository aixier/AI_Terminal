# OSS 服务使用说明

## 概述
OSS (Object Storage Service) 是阿里云提供的对象存储服务，本项目使用 OSS 存储音视频文件，为 SenseVoice 转录服务提供可访问的文件 URL。

## 主要功能
- 文件上传（支持大文件分片上传）
- 生成签名 URL（临时访问链接）
- 文件管理（列表、删除、下载）
- 目录结构化存储

## 配置要求

### 环境变量
```bash
# OSS 配置（必需）
OSS_ACCESS_KEY_ID=your_access_key_id        # OSS 访问密钥 ID
OSS_ACCESS_KEY_SECRET=your_access_key_secret # OSS 访问密钥
OSS_BUCKET=your_bucket_name                 # OSS 存储桶名称
OSS_REGION=oss-cn-hangzhou                  # OSS 区域
```

### 目录结构
```
OSS Bucket/
├── transcription/          # 转录文件根目录
│   ├── audio/             # 音频文件
│   ├── video/             # 视频文件
│   ├── batch/             # 批量处理文件
│   └── temp/              # 临时文件
```

## 核心模块

### 1. OSSService 类
路径：`src/services/oss/index.cjs`

```javascript
const ossService = new OSSService('transcription', {
  baseDir: 'transcription',
  structure: {
    audio: 'audio',
    video: 'video',
    temp: 'temp'
  }
});
```

### 2. 主要方法

#### 上传文件
```javascript
// 普通上传（<10MB）
const result = await ossService.upload(localFilePath, {
  remotePath: 'transcription/audio/file.mp3',
  headers: {
    'Content-Type': 'audio/mp3'
  }
});

// 分片上传（>10MB）
const result = await ossService.multipartUpload(localFilePath, {
  remotePath: 'transcription/video/large.mp4',
  partSize: 1024 * 1024, // 1MB per part
  parallel: 3
});
```

#### 生成签名 URL
```javascript
// 生成 2 小时有效的签名 URL
const signedUrl = await ossService.generateSignedUrl(ossPath, 7200);
```

#### 文件管理
```javascript
// 列出文件
const files = await ossService.list('transcription/audio/');

// 删除文件
await ossService.delete('transcription/temp/old-file.mp3');

// 检查文件是否存在
const exists = await ossService.exists('transcription/video/test.mp4');
```

## 使用流程

### 1. 初始化服务
```javascript
import { OSSService } from '../services/oss/index.cjs';

const ossService = new OSSService('transcription');
```

### 2. 上传文件
```javascript
// 根据文件大小自动选择上传方式
const fileSize = fs.statSync(filePath).size;
let uploadResult;

if (fileSize > 10 * 1024 * 1024) {
  // 大文件分片上传
  uploadResult = await ossService.multipartUpload(filePath, {
    remotePath: ossPath,
    progress: (p) => {
      console.log(`上传进度: ${Math.floor(p * 100)}%`);
    }
  });
} else {
  // 小文件直接上传
  uploadResult = await ossService.upload(filePath, {
    remotePath: ossPath
  });
}
```

### 3. 获取访问 URL
```javascript
// 生成临时访问链接（推荐）
const signedUrl = await ossService.generateSignedUrl(ossPath, 3600);

// 获取永久公共链接（需要 bucket 设置为公共读）
const publicUrl = ossService.getPublicUrl(ossPath);
```

## 最佳实践

### 1. 文件命名
```javascript
// 生成唯一文件名
const timestamp = Date.now();
const randomStr = Math.random().toString(36).substring(2, 8);
const ext = path.extname(originalName);
const ossPath = `transcription/${type}/${timestamp}-${randomStr}${ext}`;
```

### 2. 错误处理
```javascript
try {
  const result = await ossService.upload(filePath, options);
  if (!result.success) {
    throw new Error('Upload failed');
  }
} catch (error) {
  console.error('OSS upload error:', error);
  // 清理临时文件
  await fs.unlink(filePath);
}
```

### 3. 进度显示
```javascript
await ossService.multipartUpload(filePath, {
  progress: (percentage, checkpoint) => {
    // 更新进度条
    updateProgress(percentage * 100);
    // 保存断点信息用于断点续传
    saveCheckpoint(checkpoint);
  }
});
```

## 安全建议

1. **不要在代码中硬编码密钥**
   - 使用环境变量或配置文件
   - 生产环境使用 STS 临时凭证

2. **使用签名 URL 而非公共访问**
   - 签名 URL 有时效性，更安全
   - 可以控制访问权限和有效期

3. **设置合理的 CORS 规则**
   - 限制允许的域名
   - 限制允许的方法

4. **定期清理临时文件**
   - 设置生命周期规则
   - 定期删除过期文件

## 故障排查

### 常见错误

1. **AccessDenied**
   - 检查 Access Key 是否正确
   - 检查 Bucket 权限设置

2. **NoSuchBucket**
   - 确认 Bucket 名称正确
   - 确认 Region 设置正确

3. **RequestTimeout**
   - 检查网络连接
   - 考虑使用分片上传
   - 调整超时设置

### 性能优化

1. **大文件上传**
   - 使用分片上传
   - 调整分片大小（1-10MB）
   - 并行上传多个分片

2. **批量操作**
   - 使用批量接口
   - 控制并发数量
   - 实现重试机制

## 相关资源

- [阿里云 OSS 官方文档](https://help.aliyun.com/product/31815.html)
- [OSS Node.js SDK](https://github.com/ali-sdk/ali-oss)
- [OSS 最佳实践](https://help.aliyun.com/document_detail/31833.html)