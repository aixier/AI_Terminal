# Pod2Post播客卡片服务开发者文档

## 📌 服务概述

Pod2Post播客卡片服务是一个专门用于将播客内容转化为社媒平台图文卡片的AI生成服务。该服务基于Claude AI，能够自动生成包含封面和内容页的完整卡片集合，支持资源管理、用户隔离和Base64嵌入等高级功能。

### 🎯 核心特性
- ✅ **多用户隔离**: 基于token的用户工作空间管理
- ✅ **资源管理**: 支持照片、CDN素材、参考文档的上传和管理
- ✅ **异步生成**: 支持长时间任务的异步处理和状态查询
- ✅ **Base64嵌入**: 自动将图片转换为Base64嵌入HTML
- ✅ **自动清理**: 生成完成后自动清理临时资源
- ✅ **并发控制**: 防止同用户多任务冲突

## 🔗 API端点列表

| 端点 | 方法 | 描述 | 响应格式 |
|-----|------|------|---------|
| `/api/generate/pod2post/async` | POST | Pod2Post播客卡片生成 | JSON |
| `/api/generate/pod2post/status/:taskId` | GET | Pod2Post任务状态查询 | JSON |
| `/api/generate/pod2post/cdn` | POST/GET/DELETE | CDN图片上传管理 | JSON |
| `/api/generate/pod2post/pic` | POST/GET/DELETE | 照片上传管理 | JSON |
| `/api/generate/pod2post/resources` | POST/GET/DELETE | 参考文档上传管理 | JSON |

## 🚀 快速开始

### 1. 环境配置

#### 服务器地址
- **生产环境**: `http://8.130.86.152:8083`
- **前端访问**: `http://8.130.86.152:8100`

#### 认证方式
使用Token认证，在请求头或请求体中传入：

```javascript
// 方式1：请求头
headers: {
  'Authorization': 'Bearer lijing-token-2025-pod2post'
}

// 方式2：请求体
{
  "token": "lijing-token-2025-pod2post"
}
```

### 2. 基础工作流程

```javascript
// 完整的Pod2Post生成流程
const workflow = {
  "1": "上传照片资源 → /api/generate/pod2post/pic",
  "2": "上传CDN素材 → /api/generate/pod2post/cdn", 
  "3": "提交生成任务 → /api/generate/pod2post/async",
  "4": "轮询任务状态 → /api/generate/pod2post/status/:taskId",
  "5": "获取生成结果 → Base64嵌入HTML + JSON文案"
}
```

## 📤 资源上传接口

### 照片上传 (photos)

#### 端点
```
POST /api/generate/pod2post/pic
```

#### 请求格式
```http
Content-Type: multipart/form-data

Parameters:
- images: 图片文件（支持多个）
- clearBase64: "true" | "false" (可选，清理已生成的Base64文件)
- token: "lijing-token-2025-pod2post" (可选，用户认证)
```

#### 响应示例
```json
{
  "success": true,
  "data": {
    "uploadedFiles": [
      {
        "originalName": "封面顶部.png",
        "filename": "封面顶部.png",
        "size": 164628,
        "path": "/app/data/users/lijing/workspace/templates/pod2post/photos/封面顶部.png",
        "url": "/data/users/lijing/workspace/templates/pod2post/photos/封面顶部.png"
      }
    ],
    "total": 1,
    "picPath": "/app/data/users/lijing/workspace/templates/pod2post/photos"
  }
}
```

### CDN素材上传

#### 端点
```
POST /api/generate/pod2post/cdn
```

#### 支持的文件类型
- 图片：JPG, PNG, GIF, WebP, SVG
- 背景纹理：用于封面和内容页的背景装饰

#### 请求格式
```http
Content-Type: multipart/form-data

Parameters:
- images: 图片文件（支持多个）
- clearBase64: "true" | "false" (可选)
- token: "lijing-token-2025-pod2post" (可选)
```

### 参考文档上传

#### 端点
```
POST /api/generate/pod2post/resources
```

#### 支持的文件类型
- 文本：TXT, MD
- 文档：PDF, DOC, DOCX
- 数据：JSON, XML, YAML

#### 请求格式
```http
Content-Type: multipart/form-data

Parameters:
- files: 文档文件（支持多个）
- clearBase64: "true" | "false" (可选)
- token: "lijing-token-2025-pod2post" (可选)
```

## 🎯 播客卡片生成

### 主要生成接口

#### 端点
```
POST /api/generate/pod2post/async
```

#### 请求格式
```json
{
  "prompt": "阅读[播客小红书图文卡片需求文档.md]，按文档要求使用[新闻感封面.md]和[内容页模板规范.md]，在[用户card路径]生成html和json文档。需要使用的照片请遍历[photos]文件夹下的所有子目录寻找照片资源，html图片资源使用绝对路径。需要使用的其他素材在[CDN]文件夹中。本期主播：李静、养鸡。本期嘉宾：戴军、艳艳。",
  "token": "lijing-token-2025-pod2post"
}
```

#### 响应格式
```json
{
  "success": true,
  "data": {
    "taskId": "pod2post_1757375653794",
    "topic": "pod2post_1757375653794",
    "templateName": "cardplanet-Sandra-cover",
    "status": "submitted",
    "submittedAt": "2025-09-09T07:55:12.903Z",
    "userPath": "/app/data/users/lijing",
    "cardPath": "/app/data/users/lijing/card"
  },
  "message": "Pod2Post任务已提交，请使用taskId查询状态"
}
```

### 任务状态查询

#### 端点
```
GET /api/generate/pod2post/status/:taskId
```

#### 响应示例
```json
{
  "success": true,
  "data": {
    "taskId": "pod2post_1757375653794",
    "status": "completed", // submitted | processing | completed | failed
    "progress": 100,
    "startTime": "2025-09-09T07:55:12.903Z",
    "endTime": "2025-09-09T08:00:45.126Z",
    "duration": 332223, // 毫秒
    "result": {
      "topic": "pod2post_1757375653794",
      "templateName": "cardplanet-Sandra-cover",
      "fileCount": 2,
      "files": [
        {
          "filename": "index.html",
          "size": 45127,
          "path": "/app/data/users/lijing/card/pod2post_1757375653794/index.html"
        },
        {
          "filename": "index_with_base64.html", 
          "size": 23647639, // Base64嵌入版本
          "path": "/app/data/users/lijing/card/pod2post_1757375653794/index_with_base64.html"
        }
      ]
    }
  }
}
```

## 📋 资源管理接口

### 获取文件列表

```javascript
// 获取照片列表
GET /api/generate/pod2post/pic?token=lijing-token-2025-pod2post

// 获取CDN素材列表  
GET /api/generate/pod2post/cdn?token=lijing-token-2025-pod2post

// 获取参考文档列表
GET /api/generate/pod2post/resources?token=lijing-token-2025-pod2post
```

### 删除文件

```javascript
// 删除单个文件
DELETE /api/generate/pod2post/pic/filename.jpg?token=lijing-token-2025-pod2post

// 批量删除文档
POST /api/generate/pod2post/resources/batch-delete
{
  "filenames": ["file1.pdf", "file2.md"],
  "token": "lijing-token-2025-pod2post"
}
```

### 预览文档内容

```javascript
// 预览文本类型文档
GET /api/generate/pod2post/resources/content/filename.md?token=lijing-token-2025-pod2post
```

## 💻 JavaScript示例代码

### 完整工作流程示例

```javascript
import fetch from 'node-fetch'
import FormData from 'form-data'
import fs from 'fs'

class Pod2PostClient {
  constructor(baseUrl = 'http://8.130.86.152:8083/api', token = 'lijing-token-2025-pod2post') {
    this.baseUrl = baseUrl
    this.token = token
  }

  // 1. 上传照片
  async uploadPhotos(photoPaths) {
    const formData = new FormData()
    
    for (const photoPath of photoPaths) {
      formData.append('images', fs.createReadStream(photoPath))
    }
    formData.append('token', this.token)
    formData.append('clearBase64', 'true')

    const response = await fetch(`${this.baseUrl}/generate/pod2post/pic`, {
      method: 'POST',
      body: formData
    })

    return await response.json()
  }

  // 2. 上传CDN素材
  async uploadCDN(cdnPaths) {
    const formData = new FormData()
    
    for (const cdnPath of cdnPaths) {
      formData.append('images', fs.createReadStream(cdnPath))
    }
    formData.append('token', this.token)

    const response = await fetch(`${this.baseUrl}/generate/pod2post/cdn`, {
      method: 'POST',
      body: formData
    })

    return await response.json()
  }

  // 3. 提交生成任务
  async submitTask(prompt) {
    const response = await fetch(`${this.baseUrl}/generate/pod2post/async`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: prompt,
        token: this.token
      })
    })

    return await response.json()
  }

  // 4. 查询任务状态
  async getTaskStatus(taskId) {
    const response = await fetch(`${this.baseUrl}/generate/pod2post/status/${taskId}?token=${this.token}`)
    return await response.json()
  }

  // 5. 轮询等待任务完成
  async waitForCompletion(taskId, maxWaitTime = 1800000) {
    const startTime = Date.now()
    const pollInterval = 3000

    while (Date.now() - startTime < maxWaitTime) {
      const status = await this.getTaskStatus(taskId)
      
      console.log(`任务状态: ${status.data?.status}, 进度: ${status.data?.progress || 0}%`)

      if (status.data?.status === 'completed') {
        return status.data
      } else if (status.data?.status === 'failed') {
        throw new Error(`任务失败: ${status.data?.error || '未知错误'}`)
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval))
    }

    throw new Error('任务超时')
  }

  // 完整流程
  async generatePod2PostCards(photoPaths, cdnPaths, prompt) {
    try {
      console.log('🚀 开始Pod2Post卡片生成流程...')

      // 1. 上传照片
      console.log('📸 上传照片...')
      const photoResult = await this.uploadPhotos(photoPaths)
      console.log(`✅ 照片上传成功: ${photoResult.data?.total || 0} 个文件`)

      // 2. 上传CDN素材
      console.log('🎨 上传CDN素材...')
      const cdnResult = await this.uploadCDN(cdnPaths)
      console.log(`✅ CDN素材上传成功: ${cdnResult.data?.total || 0} 个文件`)

      // 3. 提交生成任务
      console.log('⚡ 提交生成任务...')
      const taskResult = await this.submitTask(prompt)
      const taskId = taskResult.data?.taskId

      if (!taskId) {
        throw new Error('任务提交失败')
      }
      console.log(`✅ 任务已提交: ${taskId}`)

      // 4. 等待完成
      console.log('⏳ 等待生成完成...')
      const result = await this.waitForCompletion(taskId)
      
      console.log('🎉 生成完成!')
      console.log(`📁 生成文件数: ${result.result?.fileCount || 0}`)
      console.log(`⏱️ 耗时: ${Math.round(result.duration / 1000)}秒`)

      return result

    } catch (error) {
      console.error('❌ 生成失败:', error.message)
      throw error
    }
  }
}

// 使用示例
async function example() {
  const client = new Pod2PostClient()
  
  const photoPaths = [
    '/path/to/封面顶部.png',
    '/path/to/封面底部.png',
    '/path/to/photo1.jpg'
  ]
  
  const cdnPaths = [
    '/path/to/封面背景.jpeg',
    '/path/to/样式1纹理.jpg',
    '/path/to/logo.svg'
  ]
  
  const prompt = `阅读[播客小红书图文卡片需求文档.md]，按文档要求使用[新闻感封面.md]和[内容页模板规范.md]，在[用户card路径]生成html和json文档。
需要使用的照片请遍历[photos]文件夹下的所有子目录寻找照片资源，html图片资源使用绝对路径。
需要使用的其他素材在[CDN]文件夹中。
本期主播：李静、养鸡。本期嘉宾：戴军、艳艳。`

  const result = await client.generatePod2PostCards(photoPaths, cdnPaths, prompt)
  console.log('最终结果:', result)
}
```

### cURL示例

```bash
# 1. 上传照片
curl -X POST http://8.130.86.152:8083/api/generate/pod2post/pic \
  -F "images=@/path/to/photo1.jpg" \
  -F "images=@/path/to/photo2.jpg" \
  -F "token=lijing-token-2025-pod2post" \
  -F "clearBase64=true"

# 2. 上传CDN素材
curl -X POST http://8.130.86.152:8083/api/generate/pod2post/cdn \
  -F "images=@/path/to/background.jpg" \
  -F "images=@/path/to/logo.svg" \
  -F "token=lijing-token-2025-pod2post"

# 3. 提交生成任务
curl -X POST http://8.130.86.152:8083/api/generate/pod2post/async \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "生成播客卡片...",
    "token": "lijing-token-2025-pod2post"
  }'

# 4. 查询任务状态
curl "http://8.130.86.152:8083/api/generate/pod2post/status/pod2post_1234567890?token=lijing-token-2025-pod2post"
```

## 🔧 高级功能

### Base64自动清理

在任何资源上传时添加 `clearBase64=true` 参数，系统会在上传成功后自动清理该用户所有已生成的Base64 HTML文件，避免存储空间浪费：

```javascript
formData.append('clearBase64', 'true')
```

### 并发控制

系统自动防止同一用户同时执行多个Pod2Post任务，确保文件不会被覆盖：

```json
{
  "success": false,
  "error": "用户lijing已有Pod2Post任务正在进行中，请等待完成后再提交新任务"
}
```

### 错误处理

#### 常见错误码

| 错误码 | 描述 | 解决方案 |
|-------|------|---------|
| 400 | 请求参数错误 | 检查请求格式和必需参数 |
| 401 | 认证失败 | 检查token是否正确 |
| 409 | 任务冲突 | 等待当前任务完成 |
| 413 | 文件过大 | 压缩文件或分批上传 |
| 500 | 服务器内部错误 | 联系技术支持 |

#### 错误响应格式

```json
{
  "success": false,
  "error": "错误描述",
  "code": 400,
  "details": {
    "field": "具体错误字段",
    "message": "详细错误信息"
  }
}
```

## 📊 性能指标

### 文件限制
- **单文件大小**: 最大50MB
- **批量上传**: 最多20个文件
- **总存储**: 每用户1GB

### 生成时间
- **简单任务**: 2-5分钟
- **复杂任务**: 5-15分钟
- **超时时间**: 30分钟

### 输出规格
- **HTML文件**: 包含原始路径和Base64嵌入两个版本
- **JSON文案**: 包含标题、内容、标签等社媒发布信息
- **图片数量**: 封面1张 + 内容页10张

## 🚨 注意事项

1. **用户隔离**: 每个token对应独立的工作空间，文件不会互相影响
2. **资源清理**: 建议定期使用 `clearBase64=true` 清理历史文件
3. **文件命名**: 支持中文文件名，系统会自动处理编码问题
4. **任务状态**: 请妥善保存taskId，用于查询任务状态和结果
5. **并发限制**: 同一用户同时只能执行一个Pod2Post任务

## 📞 技术支持

如有问题，请联系技术团队或查看相关文档：
- API总览: `/docs/api/card-generation-api.md`
- 开发者指南: `/DEVELOPER.md`
- 问题反馈: GitHub Issues

---

**文档版本**: v4.6.0  
**更新时间**: 2025-09-09  
**适用环境**: 生产环境