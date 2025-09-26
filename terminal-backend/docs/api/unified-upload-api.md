# 通用素材上传接口文档

## 概述

本接口用于替代原有的三个独立上传接口（`/pic`、`/cdn`、`/resources`），提供统一的文件上传功能，同时保持响应格式完全兼容，确保前端无需修改逻辑。

## 接口定义

### 上传文件

**端点：** `POST /api/generate/pod2post/upload`

**描述：** 上传单个文件到指定目录，支持多级目录和自定义文件名。

#### 请求参数

##### Query参数

| 参数名 | 类型 | 必填 | 说明 | 示例 |
|--------|------|------|------|------|
| path | string | 是 | 目标目录路径，支持多级目录 | `CDN`、`photos`、`resources`、`CDN/2024/images` |
| taskId | string | 否 | 任务ID，格式必须为`pod2post_`开头 | `pod2post_1234567890_abc` |

##### FormData参数

| 参数名 | 类型 | 必填 | 说明 | 默认值 |
|--------|------|------|------|--------|
| file | File | 是 | 要上传的文件（单个） | - |
| filename | string | 否 | 自定义文件名，不指定则使用原始文件名 | 原始文件名 |
| clearBase64 | string | 否 | 是否清理Base64 HTML文件 | `"true"`（默认清理） |
| token | string | 否 | 用户认证令牌（JWT） | - |

#### 请求示例

```javascript
// 1. 上传到CDN目录（替代原 /cdn 接口）
const formData = new FormData();
formData.append('file', imageFile);

fetch('/api/generate/pod2post/upload?path=CDN', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your_token'
  },
  body: formData
});

// 2. 上传到任务特定的photos目录（替代原 /pic 接口）
const formData = new FormData();
formData.append('file', photoFile);

fetch('/api/generate/pod2post/upload?path=photos&taskId=pod2post_123456_abc', {
  method: 'POST',
  body: formData
});

// 3. 上传文档到resources目录（替代原 /resources 接口）
const formData = new FormData();
formData.append('file', docFile);
formData.append('filename', 'my-document.pdf'); // 自定义文件名

fetch('/api/generate/pod2post/upload?path=resources', {
  method: 'POST',
  body: formData
});

// 4. 上传到多级目录
fetch('/api/generate/pod2post/upload?path=CDN/2024/banners&taskId=pod2post_123', {
  method: 'POST',
  body: formData
});

// 5. 不清理Base64文件
const formData = new FormData();
formData.append('file', file);
formData.append('clearBase64', 'false'); // 明确指定不清理

fetch('/api/generate/pod2post/upload?path=CDN', {
  method: 'POST',
  body: formData
});
```

#### 响应格式

为保持与原接口完全兼容，响应格式根据 `path` 参数自动适配：

##### 成功响应（200）

```json
{
  "code": 200,
  "success": true,
  "message": "成功上传 1 个文件到{目录类型}目录",
  "data": {
    "uploadedFiles": [
      {
        "originalName": "image.jpg",
        "filename": "image.jpg",
        "size": 123456,
        "path": "/full/path/to/file",
        "url": "/data/users/{username}/workspace/templates/pod2post/{path}/image.jpg",
        "type": ".jpg",        // 仅在 path=resources 时包含
        "mimetype": "image/jpeg" // 仅在 path=resources 时包含
      }
    ],
    "total": 1,
    "cdnPath": "/path/to/cdn",      // path=CDN 时返回
    "picPath": "/path/to/photos",   // path=photos 时返回
    "resourcesPath": "/path/to/resources" // path=resources 时返回
  }
}
```

##### 错误响应（400/500）

```json
{
  "code": 400,
  "success": false,
  "message": "错误信息"
}
```

### 获取文件列表

**端点：** `GET /api/generate/pod2post/upload`

**描述：** 获取指定目录中的文件列表

#### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| path | string | 是 | 目标目录路径 |
| taskId | string | 否 | 任务ID |

#### 响应格式

```json
{
  "code": 200,
  "success": true,
  "data": {
    "files": [
      {
        "filename": "file.jpg",
        "size": 123456,
        "created": "2024-01-01T00:00:00.000Z",
        "modified": "2024-01-01T00:00:00.000Z",
        "url": "/data/users/{username}/workspace/templates/pod2post/{path}/file.jpg",
        "type": ".jpg" // 仅在 path=resources 时包含
      }
    ],
    "total": 1,
    "cdnPath": "/path/to/cdn",      // path=CDN 时返回
    "picPath": "/path/to/photos",   // path=photos 时返回
    "resourcesPath": "/path/to/resources" // path=resources 时返回
  }
}
```

### 删除文件

**端点：** `DELETE /api/generate/pod2post/upload/{filename}`

**描述：** 删除指定文件

#### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| filename | string | 是 | 文件名（URL路径参数） |
| path | string | 是 | 目标目录路径（Query参数） |
| taskId | string | 否 | 任务ID（Query参数） |

#### 响应格式

```json
{
  "code": 200,
  "success": true,
  "message": "文件删除成功",
  "data": {
    "filename": "deleted_file.jpg"
  }
}
```

## 兼容性映射

### 原接口到新接口的映射关系

| 原接口 | 新接口调用方式 | 说明 |
|--------|---------------|------|
| `POST /api/generate/pod2post/pic` | `POST /api/generate/pod2post/upload?path=photos` | 上传照片 |
| `POST /api/generate/pod2post/cdn` | `POST /api/generate/pod2post/upload?path=CDN` | 上传CDN图片 |
| `POST /api/generate/pod2post/resources` | `POST /api/generate/pod2post/upload?path=resources` | 上传文档 |
| `GET /api/generate/pod2post/pic` | `GET /api/generate/pod2post/upload?path=photos` | 获取照片列表 |
| `GET /api/generate/pod2post/cdn` | `GET /api/generate/pod2post/upload?path=CDN` | 获取CDN文件列表 |
| `GET /api/generate/pod2post/resources` | `GET /api/generate/pod2post/upload?path=resources` | 获取文档列表 |
| `DELETE /api/generate/pod2post/pic/:file` | `DELETE /api/generate/pod2post/upload/:file?path=photos` | 删除照片 |
| `DELETE /api/generate/pod2post/cdn/:file` | `DELETE /api/generate/pod2post/upload/:file?path=CDN` | 删除CDN文件 |
| `DELETE /api/generate/pod2post/resources/:file` | `DELETE /api/generate/pod2post/upload/:file?path=resources` | 删除文档 |

### 字段名映射

| 原接口 | 原字段名 | 新接口字段名 | 说明 |
|--------|---------|------------|------|
| /pic | images | file | 文件字段名改变 |
| /cdn | files | file | 统一使用file |
| /resources | files | file | 统一使用file |

### 批量上传处理

原接口支持批量上传（一次请求多个文件），新接口为单文件上传。前端需要：

```javascript
// 原接口批量上传
const formData = new FormData();
files.forEach(file => formData.append('images', file));
await fetch('/api/generate/pod2post/pic', { method: 'POST', body: formData });

// 新接口处理方式（并发上传）
const uploadPromises = files.map(file => {
  const formData = new FormData();
  formData.append('file', file);
  return fetch('/api/generate/pod2post/upload?path=photos', {
    method: 'POST',
    body: formData
  });
});

// 等待所有上传完成
const responses = await Promise.all(uploadPromises);

// 合并响应结果（保持兼容性）
const uploadedFiles = [];
for (const response of responses) {
  const result = await response.json();
  uploadedFiles.push(...result.data.uploadedFiles);
}

// 构造兼容的批量响应
const batchResponse = {
  code: 200,
  success: true,
  message: `成功上传 ${uploadedFiles.length} 个文件到照片目录`,
  data: {
    uploadedFiles,
    total: uploadedFiles.length,
    picPath: responses[0].data.picPath
  }
};
```

## 前端适配建议

### 最小改动方案

为了让前端无需修改现有逻辑，建议创建一个适配层：

```javascript
// adapter.js - 前端适配器
class UploadAdapter {
  constructor(baseUrl = '/api/generate/pod2post') {
    this.baseUrl = baseUrl;
  }

  // 适配原 pic 接口
  async uploadPic(files, taskId, options = {}) {
    return this.batchUpload(files, 'photos', taskId, 'images', options);
  }

  // 适配原 cdn 接口
  async uploadCdn(files, taskId, options = {}) {
    return this.batchUpload(files, 'CDN', taskId, 'files', options);
  }

  // 适配原 resources 接口
  async uploadResources(files, taskId, options = {}) {
    return this.batchUpload(files, 'resources', taskId, 'files', options);
  }

  // 批量上传处理
  async batchUpload(files, path, taskId, originalFieldName, options = {}) {
    // 单文件直接上传
    if (!Array.isArray(files)) {
      files = [files];
    }

    // 并发上传所有文件
    const uploadPromises = files.map(file => {
      const formData = new FormData();
      formData.append('file', file);

      if (options.clearBase64 !== undefined) {
        formData.append('clearBase64', options.clearBase64.toString());
      }

      const params = new URLSearchParams({ path });
      if (taskId) params.append('taskId', taskId);

      return fetch(`${this.baseUrl}/upload?${params}`, {
        method: 'POST',
        headers: options.headers || {},
        body: formData
      }).then(res => res.json());
    });

    const results = await Promise.all(uploadPromises);

    // 合并结果，保持原接口响应格式
    const uploadedFiles = results.flatMap(r => r.data.uploadedFiles);
    const pathKey = path === 'CDN' ? 'cdnPath' :
                    path === 'photos' ? 'picPath' : 'resourcesPath';

    return {
      code: 200,
      success: true,
      message: `成功上传 ${uploadedFiles.length} 个文件到${this.getPathName(path)}目录`,
      data: {
        uploadedFiles,
        total: uploadedFiles.length,
        [pathKey]: results[0].data[pathKey]
      }
    };
  }

  getPathName(path) {
    const names = {
      'CDN': 'CDN',
      'photos': '照片',
      'resources': '资源'
    };
    return names[path] || path;
  }
}

// 使用示例 - 完全兼容原有调用方式
const uploader = new UploadAdapter();

// 原来的调用方式
const response = await uploader.uploadPic(imageFiles, 'pod2post_123');
console.log(response.data.uploadedFiles); // 完全兼容的响应格式
```

## 路径安全

新接口会自动过滤危险路径：

- 过滤 `..` 防止路径遍历
- 过滤 `.` 避免隐藏文件
- 过滤 `\` 防止Windows路径
- 过滤 `~` 防止用户目录访问

示例：
- 输入：`CDN/../../../etc` → 输出：`CDN/etc`
- 输入：`./photos/./test` → 输出：`photos/test`

## 迁移计划

1. **第一阶段**：实现新接口，与原接口并存
2. **第二阶段**：前端逐步迁移到新接口（使用适配器）
3. **第三阶段**：监控使用情况，确保稳定
4. **第四阶段**：标记原接口为废弃（deprecated）
5. **第五阶段**：完全移除原接口

## 优势总结

1. **代码简化**：一个接口替代三个，减少重复代码
2. **灵活性提升**：支持多级目录、自定义文件名
3. **扩展性增强**：轻松添加新的上传类型
4. **维护性改善**：统一的处理逻辑，便于维护
5. **向后兼容**：响应格式完全兼容，前端改动最小