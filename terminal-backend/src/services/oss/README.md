# OSS服务模块

这是一个通用的阿里云OSS服务模块，支持多项目使用，提供完整的文件存储功能。

## 功能特性

- ✅ 文件上传（自动选择普通或分片上传）
- ✅ 文件下载和删除
- ✅ 批量操作
- ✅ 文件列表和元信息
- ✅ 签名URL生成
- ✅ STS临时凭证支持
- ✅ 多项目配置管理
- ✅ 自动重试机制
- ✅ 进度回调

## 安装依赖

```bash
npm install ali-oss
```

## 配置环境变量

在项目根目录的 `.env` 文件中添加：

```env
# 默认OSS配置
OSS_ACCESS_KEY_ID=your_access_key_id
OSS_ACCESS_KEY_SECRET=your_access_key_secret
OSS_BUCKET=your_bucket_name
OSS_REGION=oss-cn-beijing

# STS配置（可选）
STS_ACCESS_KEY_ID=your_sts_access_key_id
STS_ACCESS_KEY_SECRET=your_sts_access_key_secret
STS_ROLE_ARN=acs:ram::1234567890:role/your-role

# 项目特定配置（可选）
OSS_TUGO_BUCKET=tugo-bucket
OSS_TUGO_REGION=oss-cn-shanghai
```

## 基本使用

### 1. 初始化服务

```javascript
const { OSSService } = require('./services/oss');

// 使用默认配置
const ossService = new OSSService();

// 使用项目预设配置
const tugoOSS = new OSSService('tugo');

// 使用自定义配置
const customOSS = new OSSService('custom', {
  bucket: 'my-bucket',
  baseDir: 'my-project'
});
```

### 2. 上传文件

```javascript
// 上传本地文件（自动选择普通或分片上传）
const result = await ossService.upload('/path/to/file.jpg', {
  customDir: 'images',
  useTimestamp: true
});
console.log('文件URL:', result.url);

// 上传HTML内容
const htmlResult = await ossService.uploadHTML(
  '<html><body>Hello</body></html>',
  'index.html',
  { customDir: 'pages' }
);

// 上传Buffer
const buffer = Buffer.from('Hello World');
const bufferResult = await ossService.uploadBuffer(
  buffer,
  'hello.txt',
  { customDir: 'texts' }
);

// 分片上传大文件（带进度）
const largeFileResult = await ossService.upload('/path/to/large-file.zip', {
  onProgress: ({ progress, uploaded, total }) => {
    console.log(`上传进度: ${progress}% (${uploaded}/${total})`);
  }
});
```

### 3. 下载文件

```javascript
// 下载到本地
await ossService.download('path/to/remote-file.jpg', '/local/path/file.jpg');

// 获取文件Buffer
const { buffer } = await ossService.getBuffer('path/to/remote-file.txt');
console.log(buffer.toString());
```

### 4. 文件管理

```javascript
// 检查文件是否存在
const exists = await ossService.exists('path/to/file.jpg');

// 获取文件元信息
const metadata = await ossService.getMetadata('path/to/file.jpg');
console.log('文件大小:', metadata.size);
console.log('最后修改:', metadata.lastModified);

// 删除文件
await ossService.delete('path/to/file.jpg');

// 批量删除
await ossService.deleteMultiple([
  'path/to/file1.jpg',
  'path/to/file2.jpg'
]);

// 列出文件
const { objects } = await ossService.list('images/', {
  'max-keys': 100
});
```

### 5. 生成签名URL

```javascript
// 生成临时访问URL（1小时有效）
const { url } = await ossService.generateSignedUrl('path/to/file.jpg', 3600);
console.log('临时URL:', url);
```

### 6. STS临时凭证

```javascript
// 初始化带STS的服务
const stsOSS = new OSSService('default', {
  stsConfig: {
    roleArn: 'acs:ram::1234567890:role/oss-role'
  }
});

// 获取临时凭证
const credentials = await stsOSS.getSTSCredentials();

// 获取前端上传凭证
const uploadCredentials = await stsOSS.getUploadCredentials({
  directory: 'user-uploads',
  maxSize: 5 * 1024 * 1024, // 5MB
  allowedTypes: ['image/*'],
  durationSeconds: 1800 // 30分钟
});
```

## 在TuGo项目中使用

```javascript
// server/index.js
const { OSSService } = require('./services/oss');

// 初始化TuGo专用OSS服务
const tugoOSS = new OSSService('tugo');

// 在生成接口中使用
app.post('/api/generate', async (req, res) => {
  try {
    // ... 生成HTML内容 ...
    
    // 上传到OSS
    const ossResult = await tugoOSS.uploadHTML(
      htmlContent,
      `${templateType}_${Date.now()}.html`,
      { customDir: 'generated' }
    );
    
    res.json({
      success: true,
      localPath: filePath,
      ossUrl: ossResult.url,
      ossPath: ossResult.name
    });
  } catch (error) {
    // ...
  }
});
```

## 项目配置预设

在 `config.js` 中可以添加新的项目预设：

```javascript
const projectPresets = {
  myproject: {
    baseDir: 'myproject',
    structure: {
      images: 'assets/images',
      documents: 'docs',
      temp: 'temp'
    }
  }
};
```

## 高级功能

### 自定义重试策略

```javascript
const ossService = new OSSService('default', {
  retryCount: 5,
  retryDelay: 2000
});
```

### 清理过期的分片上传

```javascript
// 清理24小时前的未完成上传
const cleanup = await ossService.cleanupMultipartUploads(24);
console.log(`清理了 ${cleanup.cleaned} 个过期任务`);
```

## 错误处理

```javascript
try {
  await ossService.upload('/path/to/file.jpg');
} catch (error) {
  if (error.code === 'NoSuchBucket') {
    console.error('Bucket不存在');
  } else if (error.code === 'AccessDenied') {
    console.error('权限不足');
  } else {
    console.error('上传失败:', error.message);
  }
}
```

## 注意事项

1. 确保OSS Bucket已创建并配置正确的权限
2. 大文件会自动使用分片上传
3. 所有路径使用正斜杠（/）
4. 定期清理未完成的分片上传任务
5. 生产环境建议使用STS临时凭证

## 许可证

MIT