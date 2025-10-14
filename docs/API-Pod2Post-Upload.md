# Pod2Post 文件上传并返回OSS URL API文档

## 概述

本API用于上传文件到阿里云OSS，并返回外部可访问的带签名URL。支持单文件和批量文件上传。

## 基础信息

- **基础URL**: `http://localhost:8098/api/generate/pod2post`
- **认证方式**: Token认证（可选，不传时使用default用户）
- **请求格式**: multipart/form-data
- **响应格式**: JSON

---

## 1. 单文件上传

### 接口地址
`POST /upload-and-return-url`

### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| file | File | 是 | 要上传的文件（最大50MB） |
| task_id | String | 是 | 任务ID，格式：`pod2post_{timestamp}_{random}` |
| folder | String | 否 | 文件夹路径，默认为空 |
| token | String | 否 | 用户认证令牌 |

### 支持的文件类型

- **图片**: .jpg, .jpeg, .png, .gif, .webp, .svg
- **文本**: .txt, .md, .json
- **文档**: .pdf, .doc, .docx

### 请求示例

```javascript
// 使用 FormData
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('task_id', 'pod2post_1736775600_abc123');
formData.append('folder', 'images');
formData.append('token', 'your-token-here');

fetch('http://localhost:8098/api/generate/pod2post/upload-and-return-url', {
  method: 'POST',
  body: formData
})
.then(response => response.json())
.then(data => console.log(data));
```

```bash
# 使用 curl
curl -X POST http://localhost:8098/api/generate/pod2post/upload-and-return-url \
  -F "file=@/path/to/file.jpg" \
  -F "task_id=pod2post_1736775600_abc123" \
  -F "folder=images" \
  -F "token=your-token-here"
```

### 响应示例

```json
{
  "code": 200,
  "success": true,
  "message": "文件上传成功",
  "data": {
    "originalName": "example.jpg",
    "ossPath": "pod2post/username/pod2post_1736775600_abc123/images/2025-01-13T10-30-00-000Z_example.jpg",
    "ossUrl": "https://cms-mcp.oss-cn-hangzhou.aliyuncs.com/default/default/example.jpg",
    "publicUrl": "https://cms-mcp.oss-cn-hangzhou.aliyuncs.com/pod2post/username/pod2post_1736775600_abc123/images/2025-01-13T10-30-00-000Z_example.jpg?OSSAccessKeyId=LTAI5tP7iEeXDKDgc8B1GWeW&Expires=2075706161&Signature=xxx",
    "size": 1024000,
    "mimetype": "image/jpeg",
    "uploadedAt": "2025-01-13T10:30:00.000Z",
    "taskId": "pod2post_1736775600_abc123",
    "folder": "images",
    "username": "default",
    "etag": "\"138A6C20BB6E974E47E3E588CC92D37F\""
  }
}
```

### 响应字段说明

| 字段名 | 类型 | 说明 |
|--------|------|------|
| originalName | String | 原始文件名 |
| ossPath | String | OSS存储路径 |
| ossUrl | String | OSS返回的基础URL |
| **publicUrl** | String | **带签名的可访问URL（推荐使用）** |
| size | Number | 文件大小（字节） |
| mimetype | String | 文件MIME类型 |
| uploadedAt | String | 上传时间（ISO 8601格式） |
| taskId | String | 任务ID |
| folder | String | 文件夹路径 |
| username | String | 用户名 |
| etag | String | 文件ETag |

---

## 2. 批量文件上传

### 接口地址
`POST /batch-upload-and-return-url`

### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| files | File[] | 是 | 要上传的文件列表（最多20个） |
| task_id | String | 是 | 任务ID，格式：`pod2post_{timestamp}_{random}` |
| folder | String | 否 | 文件夹路径，默认为空 |
| token | String | 否 | 用户认证令牌 |

### 请求示例

```javascript
const formData = new FormData();

// 添加多个文件
for (let file of fileInput.files) {
  formData.append('files', file);
}

formData.append('task_id', 'pod2post_1736775600_batch');
formData.append('folder', 'documents');
formData.append('token', 'your-token-here');

fetch('http://localhost:8098/api/generate/pod2post/batch-upload-and-return-url', {
  method: 'POST',
  body: formData
})
.then(response => response.json())
.then(data => console.log(data));
```

### 响应示例

```json
{
  "code": 200,
  "success": true,
  "message": "批量上传完成: 2 成功, 0 失败",
  "data": {
    "taskId": "pod2post_1736775600_batch",
    "folder": "documents",
    "username": "default",
    "uploaded": [
      {
        "originalName": "doc1.pdf",
        "ossPath": "pod2post/username/pod2post_1736775600_batch/documents/2025-01-13T10-35-00-000Z_doc1.pdf",
        "ossUrl": "https://cms-mcp.oss-cn-hangzhou.aliyuncs.com/default/default/doc1.pdf",
        "publicUrl": "https://cms-mcp.oss-cn-hangzhou.aliyuncs.com/pod2post/username/pod2post_1736775600_batch/documents/2025-01-13T10-35-00-000Z_doc1.pdf?OSSAccessKeyId=xxx&Expires=xxx&Signature=xxx",
        "size": 2048000,
        "mimetype": "application/pdf",
        "uploadedAt": "2025-01-13T10:35:00.000Z"
      },
      {
        "originalName": "doc2.jpg",
        "ossPath": "pod2post/username/pod2post_1736775600_batch/documents/2025-01-13T10-35-05-000Z_doc2.jpg",
        "ossUrl": "https://cms-mcp.oss-cn-hangzhou.aliyuncs.com/default/default/doc2.jpg",
        "publicUrl": "https://cms-mcp.oss-cn-hangzhou.aliyuncs.com/pod2post/username/pod2post_1736775600_batch/documents/2025-01-13T10-35-05-000Z_doc2.jpg?OSSAccessKeyId=xxx&Expires=xxx&Signature=xxx",
        "size": 512000,
        "mimetype": "image/jpeg",
        "uploadedAt": "2025-01-13T10:35:05.000Z"
      }
    ],
    "failed": []
  }
}
```

---

## 3. 错误响应

### 400 Bad Request - 参数错误

```json
{
  "code": 400,
  "success": false,
  "message": "参数错误: task_id 格式不正确，应为 pod2post_{timestamp}_{random}"
}
```

```json
{
  "code": 400,
  "success": false,
  "message": "参数错误: 未找到上传的文件"
}
```

```json
{
  "code": 400,
  "success": false,
  "message": "参数错误: 不支持的文件类型: application/octet-stream"
}
```

### 500 Internal Server Error - 服务器错误

```json
{
  "code": 500,
  "success": false,
  "message": "OSS服务初始化失败"
}
```

```json
{
  "code": 500,
  "success": false,
  "message": "文件上传到OSS失败",
  "error": "详细错误信息（开发环境）"
}
```

---

## 4. 使用建议

### 1. 任务ID生成

```javascript
function generateTaskId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `pod2post_${timestamp}_${random}`;
}

// 使用示例
const taskId = generateTaskId(); // pod2post_1736775600_abc123
```

### 2. 文件大小限制

- 单个文件最大：50MB
- 批量上传最多：20个文件

### 3. URL使用建议

- **使用 `publicUrl`**：这是带签名的长期有效URL（10年有效期），可以直接用于前端展示
- `ossUrl`：作为备份或内部使用
- 文件名自动添加时间戳，避免重名冲突

### 4. 错误处理

```javascript
try {
  const response = await fetch(url, {
    method: 'POST',
    body: formData
  });

  const result = await response.json();

  if (result.success) {
    // 使用 result.data.publicUrl
    console.log('上传成功:', result.data.publicUrl);
  } else {
    // 处理错误
    console.error('上传失败:', result.message);
  }
} catch (error) {
  console.error('请求失败:', error);
}
```

---

## 5. 完整示例

### HTML表单示例

```html
<!DOCTYPE html>
<html>
<head>
  <title>Pod2Post 文件上传示例</title>
</head>
<body>
  <h2>单文件上传</h2>
  <form id="singleUpload">
    <input type="file" id="singleFile" accept=".jpg,.png,.pdf,.txt,.json">
    <input type="text" id="taskId" placeholder="任务ID（可选）">
    <input type="text" id="folder" placeholder="文件夹路径（可选）">
    <button type="submit">上传</button>
  </form>

  <h2>批量上传</h2>
  <form id="batchUpload">
    <input type="file" id="multipleFiles" multiple accept=".jpg,.png,.pdf,.txt,.json">
    <input type="text" id="batchTaskId" placeholder="任务ID（可选）">
    <input type="text" id="batchFolder" placeholder="文件夹路径（可选）">
    <button type="submit">批量上传</button>
  </form>

  <div id="result"></div>

  <script>
    // 生成任务ID
    function generateTaskId() {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 9);
      return `pod2post_${timestamp}_${random}`;
    }

    // 单文件上传
    document.getElementById('singleUpload').onsubmit = async (e) => {
      e.preventDefault();

      const formData = new FormData();
      const file = document.getElementById('singleFile').files[0];
      if (!file) {
        alert('请选择文件');
        return;
      }

      formData.append('file', file);
      formData.append('task_id', document.getElementById('taskId').value || generateTaskId());
      formData.append('folder', document.getElementById('folder').value || '');
      formData.append('token', 'your-token-here'); // 可选

      try {
        const response = await fetch('http://localhost:8098/api/generate/pod2post/upload-and-return-url', {
          method: 'POST',
          body: formData
        });

        const result = await response.json();

        if (result.success) {
          document.getElementById('result').innerHTML = `
            <h3>上传成功！</h3>
            <p>文件名: ${result.data.originalName}</p>
            <p>访问URL: <a href="${result.data.publicUrl}" target="_blank">${result.data.publicUrl}</a></p>
            <p>文件大小: ${(result.data.size / 1024).toFixed(2)} KB</p>
          `;
        } else {
          alert('上传失败: ' + result.message);
        }
      } catch (error) {
        alert('请求失败: ' + error.message);
      }
    };

    // 批量上传
    document.getElementById('batchUpload').onsubmit = async (e) => {
      e.preventDefault();

      const formData = new FormData();
      const files = document.getElementById('multipleFiles').files;

      if (files.length === 0) {
        alert('请选择文件');
        return;
      }

      for (let file of files) {
        formData.append('files', file);
      }

      formData.append('task_id', document.getElementById('batchTaskId').value || generateTaskId());
      formData.append('folder', document.getElementById('batchFolder').value || '');
      formData.append('token', 'your-token-here'); // 可选

      try {
        const response = await fetch('http://localhost:8098/api/generate/pod2post/batch-upload-and-return-url', {
          method: 'POST',
          body: formData
        });

        const result = await response.json();

        if (result.success) {
          let html = `<h3>批量上传完成！</h3>`;
          html += `<p>成功: ${result.data.uploaded.length} 个</p>`;
          html += `<p>失败: ${result.data.failed.length} 个</p>`;

          result.data.uploaded.forEach(file => {
            html += `<div style="margin: 10px 0; padding: 10px; border: 1px solid #ccc;">`;
            html += `<p>${file.originalName} - ${(file.size / 1024).toFixed(2)} KB</p>`;
            html += `<p><a href="${file.publicUrl}" target="_blank">查看文件</a></p>`;
            html += `</div>`;
          });

          document.getElementById('result').innerHTML = html;
        } else {
          alert('批量上传失败: ' + result.message);
        }
      } catch (error) {
        alert('请求失败: ' + error.message);
      }
    };
  </script>
</body>
</html>
```

---

## 6. 注意事项

1. **URL有效期**：返回的 `publicUrl` 有效期为10年，基本可以认为是永久链接
2. **文件命名**：系统会自动在文件名前添加时间戳，避免文件名冲突
3. **用户隔离**：不同用户的文件存储在不同的目录中
4. **文件夹路径**：支持多级目录，如 `images/avatar`、`documents/2024`
5. **错误处理**：请务必处理各种错误情况，特别是文件类型和大小限制

---

## 3. 文本文件写入并上传到OSS

### 接口地址
`POST /write-text`

### 接口描述
写入文本文件到本地，并可选择上传到OSS生成下载链接。此接口在保持原有写入功能的基础上，增加了OSS上传功能。

### 请求参数

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| task_id | String | 是 | - | 任务ID，格式：`pod2post_{timestamp}_{random}` |
| filename | String | 是 | - | 文件名（带后缀） |
| content | String | 是 | - | 文本内容（最大10MB） |
| token | String | 否 | - | 用户认证令牌 |
| upload_to_oss | Boolean | 否 | true | 是否上传到OSS |
| return_oss_url | Boolean | 否 | true | 是否返回OSS下载URL |

### 请求示例

```javascript
const response = await fetch('http://localhost:8098/api/generate/pod2post/write-text', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    task_id: 'pod2post_1736775600_abc123',
    filename: 'content.json',
    content: JSON.stringify({ title: '测试文档', content: '这是测试内容' }),
    upload_to_oss: true,
    return_oss_url: true,
    token: 'your-token-here'
  })
});

const result = await response.json();
```

### 响应示例

```json
{
  "code": 200,
  "success": true,
  "message": "文件写入成功并已生成下载链接",
  "data": {
    "filename": "content.json",
    "path": "/app/data/users/default/workspace/card/pod2post_1736775600_abc123/content.json",
    "size": 1024,
    "isNew": true,
    "taskId": "pod2post_1736775600_abc123",
    "username": "default",
    "createdAt": "2025-01-13T10:30:00.000Z",
    "modifiedAt": "2025-01-13T10:30:00.000Z",
    "ossPath": "pod2post/default/pod2post_1736775600_abc123/content.json",
    "ossUrl": "https://cms-mcp.oss-cn-hangzhou.aliyuncs.com/default/default/content.json",
    "downloadUrl": "https://cms-mcp.oss-cn-hangzhou.aliyuncs.com/pod2post/default/pod2post_1736775600_abc123/content.json?OSSAccessKeyId=LTAI5tP7iEeXDKDgc8B1GWeW&Expires=2075706161&Signature=xxx",
    "oss": {
      "ossPath": "pod2post/default/pod2post_1736775600_abc123/content.json",
      "ossUrl": "https://cms-mcp.oss-cn-hangzhou.aliyuncs.com/default/default/content.json",
      "downloadUrl": "https://cms-mcp.oss-cn-hangzhou.aliyuncs.com/pod2post/default/pod2post_1736775600_abc123/content.json?OSSAccessKeyId=xxx&Expires=xxx&Signature=xxx",
      "uploadedAt": "2025-01-13T10:30:05.000Z"
    }
  }
}
```

### 响应字段说明

| 字段名 | 类型 | 说明 |
|--------|------|------|
| filename | String | 文件名 |
| path | String | 本地文件路径 |
| size | Number | 文件大小（字节） |
| isNew | Boolean | 是否为新文件 |
| taskId | String | 任务ID |
| username | String | 用户名 |
| downloadUrl | String | OSS下载链接（如果上传到OSS） |
| ossPath | String | OSS存储路径 |
| ossUrl | String | OSS基础URL |
| oss | Object | OSS详细信息（可选） |

---

## 更新日志

- **v1.1.0** (2025-01-13)
  - 新增 `write-text` 接口的OSS上传功能
  - 支持写入文本文件后自动上传到OSS
  - 返回可下载的OSS链接
  - 添加可选参数控制OSS上传行为

- **v1.0.0** (2025-01-13)
  - 初始版本
  - 支持单文件和批量上传
  - 返回带签名的长期有效OSS URL
  - 支持用户隔离和自定义文件夹