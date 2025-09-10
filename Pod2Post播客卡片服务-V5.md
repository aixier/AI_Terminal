# Pod2Post播客卡片服务开发者文档

## 📌 服务概述

Pod2Post播客卡片服务是一个专门用于将播客内容转化为社媒平台图文卡片的AI生成服务。该服务基于Claude AI，能够自动生成包含封面和内容页的完整卡片集合，支持资源管理、用户隔离、Base64嵌入和OSS大文件处理等高级功能。

### 🎯 核心特性
- ✅ **多用户隔离**: 基于token的用户工作空间管理
- ✅ **资源管理**: 支持照片、CDN素材、参考文档的上传和管理
- ✅ **异步生成**: 支持长时间任务的异步处理和状态查询
- ✅ **Base64嵌入**: 自动将图片转换为Base64嵌入HTML
- ✅ **OSS自动上传**: 生成完成后自动上传到OSS，Content接口直接返回缓存链接
- ✅ **自动清理**: 生成完成后自动清理临时资源
- 🆕 **多任务并发**: 支持同用户多任务并发处理（最多5个）
- 🆕 **任务级资源隔离**: 每个任务拥有独立的资源目录，避免冲突
- 🆕 **性能优化**: Content接口不再实时上传，响应速度提升10倍以上

## 🔗 API端点列表

| 端点 | 方法 | 描述 | 响应格式 |
|-----|------|------|---------|
| `/api/generate/pod2post/async` | POST | Pod2Post播客卡片生成 | JSON |
| `/api/generate/pod2post/status/:taskId` | GET | Pod2Post任务状态查询 | JSON |
| `/api/generate/pod2post/content/:folderName` | GET | 获取生成的内容（支持OSS大文件） | JSON |
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

// 方式3：URL参数
GET /api/generate/pod2post/content/pod2post_xxx?token=lijing-token-2025-pod2post
```

### 2. 基础工作流程

```javascript
// 完整的Pod2Post生成流程（支持并发）
const workflow = {
  "1": "生成taskId → 客户端生成 pod2post_{timestamp}_{random}",
  "2": "上传照片资源 → /api/generate/pod2post/pic?taskId={taskId}",
  "3": "上传CDN素材 → /api/generate/pod2post/cdn?taskId={taskId}", 
  "4": "上传参考文档 → /api/generate/pod2post/resources?taskId={taskId}",
  "5": "提交生成任务 → /api/generate/pod2post/async (包含taskId)",
  "6": "轮询任务状态 → /api/generate/pod2post/status/:taskId",
  "7": "获取生成结果 → /api/generate/pod2post/content/:folderName",
  "8": "下载内容 → Base64嵌入HTML + JSON文案 (大文件通过OSS URL下载)"
}

// TaskId生成示例
function generateTaskId() {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  return `pod2post_${timestamp}_${random}`
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
- images: 图片文件（支持多个）  // 注意：照片上传使用images字段
- clearBase64: "true" | "false" (可选，清理已生成的Base64文件)
- token: "lijing-token-2025-pod2post" (可选，用户认证)

Query Parameters:
- taskId: "pod2post_1757482406080_abc123" (可选，任务ID，用于任务级资源隔离)
```

⚠️ **注意事项**：
- 支持中文文件名（服务器会自动处理UTF-8编码）
- 单个文件大小限制：50MB
- 最多支持20个文件同时上传

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
- files: 图片文件（支持多个）  // 重要：CDN上传使用files字段，不是images
- clearBase64: "true" | "false" (可选)
- token: "lijing-token-2025-pod2post" (可选)

Query Parameters:
- taskId: "pod2post_1757482406080_abc123" (可选，任务ID，用于任务级资源隔离)
```

⚠️ **注意事项**：
- CDN上传的字段名是`files`，不同于照片上传的`images`
- 支持中文文件名（服务器会自动处理UTF-8编码）
- 单个文件大小限制：50MB

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

Query Parameters:
- taskId: "pod2post_1757482406080_abc123" (可选，任务ID，用于任务级资源隔离)
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
  "token": "lijing-token-2025-pod2post",
  "taskId": "pod2post_1757482406080_abc123"  // 可选，用于任务级资源隔离
}
```

#### 响应格式
```json
{
  "success": true,
  "data": {
    "taskId": "pod2post_1757375653794_ddrq4mn",
    "topic": "pod2post_1757375653794",
    "templateName": "pod2post-template",
    "status": "submitted",
    "submittedAt": "2025-09-09T07:55:12.903Z",
    "userPath": "/app/data/users/lijing",
    "cardPath": "/app/data/users/lijing/workspace/card"
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
    "taskId": "pod2post_1757375653794_ddrq4mn",
    "status": "completed", // submitted | processing | generated | uploading_oss | completed | failed
    "progress": 100,
    "phases": {
      "promptProcessing": "completed",
      "firstGeneration": "completed", 
      "base64Embedding": "completed",
      "ossUpload": "completed"  // 🆕 新增OSS上传阶段
    },
    "startTime": "2025-09-09T07:55:12.903Z",
    "endTime": "2025-09-09T08:00:45.126Z",
    "duration": 332223, // 毫秒
    "result": {
      "topic": "pod2post_1757375653794",
      "templateName": "pod2post-template",
      "fileCount": 3,
      "files": [
        {
          "fileName": "podcast_cards.html",
          "size": 24950,
          "mtime": "2025-09-09T03:18:04.993Z"
        },
        {
          "fileName": "podcast_cards_with_base64.html", 
          "size": 23768530, // Base64嵌入版本
          "mtime": "2025-09-09T03:18:11.049Z"
        },
        {
          "fileName": "20250909_031413_lijing_meta.json",
          "size": 8219,
          "mtime": "2025-09-09T03:18:11.117Z"
        }
      ],
      "pod2postFiles": {
        "original": "podcast_cards.html",
        "withBase64": "podcast_cards_with_base64.html",
        "metadata": "20250909_031413_lijing_meta.json"
      }
    }
  }
}
```

## 📥 内容获取接口（优化版）

### 获取生成的内容

#### 端点
```
GET /api/generate/pod2post/content/:folderName
```

#### 请求参数
- `folderName`: Pod2Post文件夹名称（完整taskId，例如：pod2post_1757375653794_ddrq4mn）
- `token`: 用户认证token（可选，通过URL参数或请求头传递）

#### 🆕 优化说明
- **不再实时上传OSS**：移除了Content接口的实时上传逻辑
- **直接返回缓存链接**：从meta文件读取预存的OSS链接
- **性能提升**：响应时间从5-30秒降至<500ms
- **向后兼容**：旧任务仍能正常工作

#### 响应格式（优化版）
系统优先从meta文件获取OSS链接：

```json
{
  "code": 200,
  "success": true,
  "data": {
    "folderName": "pod2post_1757388375054",
    "allFiles": [
      {
        "fileName": "podcast_cards.html",
        "size": 24590,
        "mtime": "2025-09-09T03:29:57.919Z"
      }
    ],
    "pod2postFiles": {
      "original": "podcast_cards.html",
      "withBase64": "podcast_cards_with_base64.html",
      "metadata": "20250909_032615_lijing_meta.json"
    },
    "content": {
      "originalHtml": "<!DOCTYPE html>...", // 原始HTML内容
      "base64Html": "<!DOCTYPE html>...", // Base64嵌入的HTML内容
      "metadata": { // 元数据JSON对象
        "sessionInfo": {...},
        "request": {...},
        "output": {...}
      },
      "base64Analysis": {
        "base64ImageCount": 20,
        "unconvertedPathCount": 0,
        "conversionSuccess": true,
        "sampleUnconvertedPaths": []
      }
    }
  }
}
```

#### 响应格式（大文件）
当文件超过5MB时，自动上传到OSS并返回签名URL：

```json
{
  "code": 200,
  "success": true,
  "data": {
    "folderName": "pod2post_1757388375054",
    "allFiles": [...],
    "pod2postFiles": {
      "original": "podcast_cards.html",
      "withBase64": "podcast_cards_with_base64.html",
      "metadata": "20250909_032615_lijing_meta.json"
    },
    "content": {
      "originalHtml": "<!DOCTYPE html>...", // 原始HTML（如果<5MB）
      "originalHtmlOssUrl": "https://cms-mcp.oss-cn-hangzhou.aliyuncs.com/...", // 原始HTML OSS URL（如果>5MB）
      "originalHtmlSize": 27402,
      
      "base64HtmlOssUrl": "https://cms-mcp.oss-cn-hangzhou.aliyuncs.com/pod2post/lijing/pod2post_xxx/podcast_cards_with_base64.html?...",
      "base64HtmlSize": 23768530, // 文件大小（字节）
      "base64HtmlPreview": "<!DOCTYPE html>...", // 前50KB预览内容
      
      "metadata": {...},
      "base64Analysis": {
        "base64ImageCount": 20,
        "unconvertedPathCount": 0,
        "conversionSuccess": true,
        "sampleUnconvertedPaths": []
      }
    }
  }
}
```

### OSS签名URL说明

当文件超过5MB时，系统会自动将文件上传到阿里云OSS，并返回签名URL：

- **URL有效期**: 1年
- **访问方式**: 直接使用浏览器或HTTP客户端下载
- **文件路径**: `pod2post/{username}/{folderName}/{filename}`
- **签名参数**: 包含在URL中，无需额外认证

示例URL：
```
https://cms-mcp.oss-cn-hangzhou.aliyuncs.com/pod2post/lijing/pod2post_1757388375054/podcast_cards_with_base64.html?OSSAccessKeyId=xxx&Expires=1788925019&Signature=xxx
```

## 💻 JavaScript示例代码

### 完整工作流程示例（包含OSS处理）

```javascript
import fetch from 'node-fetch'
import FormData from 'form-data'
import fs from 'fs'

class Pod2PostClient {
  constructor(baseUrl = 'http://8.130.86.152:8083/api', token = 'lijing-token-2025-pod2post') {
    this.baseUrl = baseUrl
    this.token = token
  }

  // 生成任务ID
  generateTaskId() {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    return `pod2post_${timestamp}_${random}`
  }

  // 1. 上传照片
  async uploadPhotos(photoPaths, taskId) {
    const formData = new FormData()
    
    for (const photoPath of photoPaths) {
      formData.append('images', fs.createReadStream(photoPath))
    }
    formData.append('token', this.token)
    formData.append('clearBase64', 'true')

    const url = taskId 
      ? `${this.baseUrl}/generate/pod2post/pic?taskId=${taskId}`
      : `${this.baseUrl}/generate/pod2post/pic`

    const response = await fetch(url, {
      method: 'POST',
      body: formData
    })

    return await response.json()
  }

  // 2. 上传CDN素材
  async uploadCDN(cdnPaths, taskId) {
    const formData = new FormData()
    
    for (const cdnPath of cdnPaths) {
      formData.append('files', fs.createReadStream(cdnPath))  // 注意：CDN使用files字段
    }
    formData.append('token', this.token)

    const url = taskId
      ? `${this.baseUrl}/generate/pod2post/cdn?taskId=${taskId}`
      : `${this.baseUrl}/generate/pod2post/cdn`

    const response = await fetch(url, {
      method: 'POST',
      body: formData
    })

    return await response.json()
  }

  // 3. 提交生成任务
  async submitTask(prompt, taskId) {
    const response = await fetch(`${this.baseUrl}/generate/pod2post/async`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: prompt,
        token: this.token,
        taskId: taskId  // 包含taskId以使用任务特定资源
      })
    })

    return await response.json()
  }

  // 4. 查询任务状态
  async getTaskStatus(taskId) {
    const response = await fetch(`${this.baseUrl}/generate/pod2post/status/${taskId}?token=${this.token}`)
    return await response.json()
  }

  // 5. 获取生成的内容（支持OSS大文件）
  async getContent(folderName) {
    const response = await fetch(`${this.baseUrl}/generate/pod2post/content/${folderName}?token=${this.token}`)
    const result = await response.json()
    
    if (result.success && result.data?.content) {
      const content = result.data.content
      
      // 检查是否有OSS URL
      if (content.base64HtmlOssUrl) {
        console.log(`📦 Base64 HTML文件较大(${(content.base64HtmlSize / 1024 / 1024).toFixed(2)}MB)，请通过OSS URL下载:`)
        console.log(`   ${content.base64HtmlOssUrl}`)
        
        // 可选：自动下载大文件
        // await this.downloadFromOSS(content.base64HtmlOssUrl, 'podcast_cards_with_base64.html')
      }
      
      if (content.originalHtmlOssUrl) {
        console.log(`📦 原始HTML文件通过OSS提供:`)
        console.log(`   ${content.originalHtmlOssUrl}`)
      }
    }
    
    return result
  }

  // 6. 从OSS下载文件（可选）
  async downloadFromOSS(ossUrl, localPath) {
    const response = await fetch(ossUrl)
    if (!response.ok) {
      throw new Error(`OSS下载失败: ${response.status}`)
    }
    
    const buffer = await response.buffer()
    await fs.promises.writeFile(localPath, buffer)
    console.log(`✅ 文件已下载到: ${localPath}`)
  }

  // 7. 轮询等待任务完成
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

  // 完整流程（包含内容获取）
  async generatePod2PostCards(photoPaths, cdnPaths, prompt) {
    try {
      console.log('🚀 开始Pod2Post卡片生成流程...')

      // 0. 生成任务ID
      const taskId = this.generateTaskId()
      console.log(`📝 任务ID: ${taskId}`)

      // 1. 上传照片（带taskId）
      console.log('📸 上传照片...')
      const photoResult = await this.uploadPhotos(photoPaths, taskId)
      console.log(`✅ 照片上传成功: ${photoResult.data?.total || 0} 个文件`)

      // 2. 上传CDN素材（带taskId）
      console.log('🎨 上传CDN素材...')
      const cdnResult = await this.uploadCDN(cdnPaths, taskId)
      console.log(`✅ CDN素材上传成功: ${cdnResult.data?.total || 0} 个文件`)

      // 3. 提交生成任务（带taskId）
      console.log('⚡ 提交生成任务...')
      const taskResult = await this.submitTask(prompt, taskId)
      const returnedTaskId = taskResult.data?.taskId
      const folderName = taskResult.data?.topic // 获取文件夹名称

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

      // 5. 获取生成的内容
      console.log('📥 获取生成内容...')
      const contentResult = await this.getContent(folderName)
      
      if (contentResult.success) {
        const { content } = contentResult.data
        
        // 处理Base64分析结果
        if (content.base64Analysis) {
          console.log('📊 Base64嵌入分析:')
          console.log(`   - Base64图片数: ${content.base64Analysis.base64ImageCount}`)
          console.log(`   - 转换成功: ${content.base64Analysis.conversionSuccess ? '✅' : '❌'}`)
        }
        
        // 保存文件（根据是否有OSS URL决定）
        if (content.base64Html) {
          // 小文件，直接保存
          await fs.promises.writeFile('output/podcast_cards_with_base64.html', content.base64Html)
          console.log('✅ Base64 HTML已保存到本地')
        } else if (content.base64HtmlOssUrl) {
          // 大文件，从OSS下载
          console.log('📦 下载Base64 HTML从OSS...')
          await this.downloadFromOSS(content.base64HtmlOssUrl, 'output/podcast_cards_with_base64.html')
        }
        
        // 保存元数据
        if (content.metadata) {
          await fs.promises.writeFile('output/metadata.json', JSON.stringify(content.metadata, null, 2))
          console.log('✅ 元数据已保存')
        }
      }

      return { taskResult: result, contentResult }

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
# 0. 生成taskId (在客户端生成)
taskId="pod2post_$(date +%s)_$(openssl rand -hex 3)"
echo "TaskId: $taskId"

# 1. 上传照片（带taskId）
curl -X POST "http://8.130.86.152:8083/api/generate/pod2post/pic?taskId=$taskId" \
  -F "images=@/path/to/photo1.jpg" \
  -F "images=@/path/to/photo2.jpg" \
  -F "token=lijing-token-2025-pod2post" \
  -F "clearBase64=true"

# 2. 上传CDN素材（带taskId）  
# 注意：CDN上传使用files字段，不是images
curl -X POST "http://8.130.86.152:8083/api/generate/pod2post/cdn?taskId=$taskId" \
  -F "files=@/path/to/background.jpg" \
  -F "files=@/path/to/logo.svg" \
  -F "token=lijing-token-2025-pod2post"

# 3. 提交生成任务（带taskId）
curl -X POST http://8.130.86.152:8083/api/generate/pod2post/async \
  -H "Content-Type: application/json" \
  -d "{
    \"prompt\": \"生成播客卡片...\",
    \"token\": \"lijing-token-2025-pod2post\",
    \"taskId\": \"$taskId\"
  }"

# 4. 查询任务状态
curl "http://8.130.86.152:8083/api/generate/pod2post/status/pod2post_1234567890_xxx?token=lijing-token-2025-pod2post"

# 5. 获取生成内容（支持OSS大文件）
curl "http://8.130.86.152:8083/api/generate/pod2post/content/pod2post_1234567890?token=lijing-token-2025-pod2post"

# 6. 下载OSS文件（如果返回了OSS URL）
curl -o podcast_cards_with_base64.html "https://cms-mcp.oss-cn-hangzhou.aliyuncs.com/pod2post/..."
```

## 🔧 高级功能

### OSS大文件处理

系统自动检测文件大小，超过5MB的文件会：
1. 自动上传到阿里云OSS
2. 返回签名URL而不是文件内容
3. 提供前50KB预览内容
4. URL有效期为1年

优势：
- 避免API响应过大导致超时
- 减少网络传输时间
- 支持断点续传
- 提供CDN加速

### Base64自动清理

在任何资源上传时添加 `clearBase64=true` 参数，系统会在上传成功后自动清理该用户所有已生成的Base64 HTML文件，避免存储空间浪费：

```javascript
formData.append('clearBase64', 'true')
```

### 并发控制

#### 多任务并发支持
系统支持同一用户最多5个Pod2Post任务并发执行，通过taskId实现任务级资源隔离：

- **任务ID格式**: `pod2post_{timestamp}_{random}`
- **最大并发数**: 每用户5个任务
- **资源隔离**: 每个任务使用独立的资源目录
- **自动清理**: 任务完成后自动清理任务资源

#### TaskId使用说明
1. **客户端生成**: taskId由客户端生成，确保唯一性
2. **资源上传**: 上传资源时携带taskId参数，资源会保存到任务专属目录
3. **任务提交**: 提交任务时包含taskId，确保使用正确的资源路径
4. **路径映射**: 
   - 无taskId: `/templates/pod2post/photos`
   - 有taskId: `/templates/pod2post/tasks/{taskId}/photos`

#### 并发限制响应
当超过最大并发数时：
```json
{
  "success": false,
  "error": "用户lijing已达到最大并发任务数(5)，请等待部分任务完成后再提交新任务"
}
```

### 错误处理

#### 常见错误码

| 错误码 | 描述 | 解决方案 |
|-------|------|---------|
| 400 | 请求参数错误 | 检查请求格式和必需参数 |
| 401 | 认证失败 | 检查token是否正确 |
| 404 | 文件夹不存在 | 检查folderName是否正确 |
| 409 | 任务冲突 | 等待当前任务完成 |
| 413 | 文件过大 | 文件会自动通过OSS处理 |
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
- **OSS自动处理**: >5MB文件

### 生成时间
- **简单任务**: 2-5分钟
- **复杂任务**: 5-15分钟
- **超时时间**: 30分钟

### 输出规格
- **HTML文件**: 包含原始路径和Base64嵌入两个版本
- **JSON文案**: 包含标题、内容、标签等社媒发布信息
- **图片数量**: 封面1张 + 内容页10张
- **大文件处理**: 自动上传OSS，提供签名URL

## 🚨 注意事项

1. **用户隔离**: 每个token对应独立的工作空间，文件不会互相影响
2. **资源清理**: 建议定期使用 `clearBase64=true` 清理历史文件
3. **文件命名**: 支持中文文件名，系统会自动处理编码问题
4. **任务状态**: 请妥善保存taskId，用于查询任务状态和结果
5. **并发支持**: 同一用户支持最多5个Pod2Post任务并发执行（需使用taskId）
6. **OSS URL**: 大文件的OSS URL有效期为1年，请及时下载
7. **网络优化**: 建议使用流式下载处理大文件

## 📞 技术支持

如有问题，请联系技术团队或查看相关文档：
- API总览: `/docs/api/card-generation-api.md`
- 开发者指南: `/DEVELOPER.md`
- 问题反馈: GitHub Issues

---

**文档版本**: v5.1.0  
**更新时间**: 2025-01-10  
**更新内容**: 新增任务级资源隔离和多任务并发支持（通过taskId）  
**适用环境**: 生产环境