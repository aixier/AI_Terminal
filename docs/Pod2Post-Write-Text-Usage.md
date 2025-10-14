# Pod2Post 写文本文件接口使用说明

## 接口地址
```
POST /api/generate/pod2post/write-text
```

## 功能说明
写入文本文件到本地，并自动上传到OSS生成可下载链接。

## 请求参数

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| task_id | String | 是 | - | 任务ID（格式：pod2post_时间戳_随机字符） |
| filename | String | 是 | - | 文件名（带后缀，如：content.json） |
| content | String | 是 | - | 文件内容 |
| token | String | 否 | - | 用户token（可选） |
| upload_to_oss | Boolean | 否 | true | 是否上传到OSS |
| return_oss_url | Boolean | 否 | true | 是否返回OSS下载链接 |

## 使用示例

### JavaScript/TypeScript

```javascript
// 基础用法 - 自动上传到OSS并返回下载链接
const response = await fetch('http://your-server/api/generate/pod2post/write-text', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    task_id: `pod2post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    filename: 'content.json',
    content: JSON.stringify({
      title: '文章标题',
      content: '文章内容',
      author: '作者名',
      createTime: new Date().toISOString()
    })
  })
});

const result = await response.json();

if (result.success) {
  console.log('文件信息:', result.data.filename);
  console.log('下载链接:', result.data.downloadUrl);
  console.log('文件大小:', result.data.size + ' bytes');
}
```

### curl 示例

```bash
curl -X POST http://your-server/api/generate/pod2post/write-text \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "pod2post_1736781000_test456",
    "filename": "content.json",
    "content": "{\"title\": \"测试文档\", \"content\": \"这是内容\"}"
  }'
```

### 仅本地写入（不上传OSS）

```javascript
const response = await fetch('http://your-server/api/generate/pod2post/write-text', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    task_id: 'pod2post_1736781000_test',
    filename: 'local-file.txt',
    content: '这个文件只保存在本地',
    upload_to_oss: false  // 不上传到OSS
  })
});
```

## 响应格式

### 成功响应

```json
{
  "code": 200,
  "success": true,
  "message": "文件写入成功并已生成下载链接",
  "data": {
    "filename": "content.json",
    "path": "/app/data/users/default/workspace/card/pod2post_xxx/content.json",
    "size": 1024,
    "isNew": true,
    "taskId": "pod2post_1736781000_test456",
    "username": "default",
    "createdAt": "2025-01-13T10:30:00.000Z",
    "modifiedAt": "2025-01-13T10:30:00.000Z",

    // OSS相关信息（如果上传到OSS）
    "downloadUrl": "https://cms-mcp.oss-cn-hangzhou.aliyuncs.com/pod2post/...?OSSAccessKeyId=...&Expires=...&Signature=...",
    "ossPath": "pod2post/default/pod2post_xxx/content.json",
    "ossUrl": "https://cms-mcp.oss-cn-hangzhou.aliyuncs.com/default/default/content.json"
  }
}
```

### 错误响应

```json
{
  "code": 400,
  "success": false,
  "message": "参数错误: task_id 格式不正确，应为 pod2post_{timestamp}_{random}"
}
```

## 关键点

1. **downloadUrl**：这是您需要的可下载链接，有效期10年
2. **task_id格式**：必须是 `pod2post_` 开头，后面接时间戳和随机字符
3. **文件名**：必须包含文件扩展名（如 .json, .txt, .md）
4. **内容限制**：最大10MB

## 常见用例

### 1. 保存JSON配置文件
```javascript
const config = {
  title: "小红书图文",
  images: ["img1.jpg", "img2.jpg"],
  text: "这是一篇关于..."
};

fetch('/api/generate/pod2post/write-text', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    task_id: generateTaskId(),
    filename: 'config.json',
    content: JSON.stringify(config, null, 2)
  })
})
.then(res => res.json())
.then(data => {
  // 使用 data.data.downloadUrl 下载或分享
  window.open(data.data.downloadUrl);
});
```

### 2. 保存Markdown文档
```javascript
fetch('/api/generate/pod2post/write-text', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    task_id: generateTaskId(),
    filename: 'article.md',
    content: `# 文章标题\n\n这是文章内容...`
  })
});
```

### 3. 批量生成多个文件
```javascript
const files = [
  { name: 'content.json', data: { type: 'content' } },
  { name: 'metadata.json', data: { type: 'metadata' } },
  { name: 'config.json', data: { type: 'config' } }
];

const taskId = generateTaskId();
const promises = files.map(file =>
  fetch('/api/generate/pod2post/write-text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task_id: taskId,
      filename: file.name,
      content: JSON.stringify(file.data, null, 2)
    })
  }).then(res => res.json())
);

Promise.all(promises).then(results => {
  results.forEach(result => {
    console.log(`${result.data.filename}: ${result.data.downloadUrl}`);
  });
});
```

## 注意事项

1. URL有效期很长（10年），可以直接保存使用
2. 文件会先写入本地，再上传到OSS
3. 如果OSS上传失败，本地写入仍然会成功
4. 支持的文件类型：.txt, .json, .md, .html, .css, .js, .xml, .csv, .pdf, .doc, .docx等

## 工具函数

```javascript
// 生成任务ID
function generateTaskId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `pod2post_${timestamp}_${random}`;
}

// 使用示例
const taskId = generateTaskId(); // pod2post_1736781000_abc123def
```