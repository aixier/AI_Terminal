# Pod2Post播客卡片服务开发者文档 V6

## 📌 服务概述

Pod2Post播客卡片服务是一个专门用于将播客内容转化为社媒平台图文卡片的AI生成服务。该服务基于Claude AI，能够自动生成包含封面和内容页的完整卡片集合，支持资源管理、用户隔离、Base64嵌入和OSS自动上传等高级功能。

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
| `/api/generate/pod2post/content/:folderName` | GET | 获取生成的内容（优化版） | JSON |
| `/api/generate/pod2post/cdn` | POST/GET/DELETE | CDN图片上传管理 | JSON |
| `/api/generate/pod2post/pic` | POST/GET/DELETE | 照片上传管理 | JSON |
| `/api/generate/pod2post/resources` | POST/GET/DELETE | 参考文档上传管理 | JSON |

## 🚀 快速开始

### 1. 环境配置

#### 服务器地址
- **生产环境**: `http://8.130.86.152:8083`
- **前端访问**: `http://8.130.86.152:8100`
- **远程API**: `http://cardapi.paitongai.com`

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

### 2. 基础工作流程（含OSS优化）

```javascript
// 完整的Pod2Post生成流程（支持并发+OSS自动上传）
const workflow = {
  "1": "生成taskId → 客户端生成 pod2post_{timestamp}_{random}",
  "2": "上传照片资源 → /api/generate/pod2post/pic?taskId={taskId}",
  "3": "上传CDN素材 → /api/generate/pod2post/cdn?taskId={taskId}", 
  "4": "上传参考文档 → /api/generate/pod2post/resources?taskId={taskId}",
  "5": "提交生成任务 → /api/generate/pod2post/async (包含taskId)",
  "6": "后台Base64嵌入 → 自动转换图片为Base64",
  "7": "🆕 OSS自动上传 → 上传所有文件到OSS，保存链接到meta",
  "8": "轮询任务状态 → /api/generate/pod2post/status/:taskId",
  "9": "获取生成结果 → /api/generate/pod2post/content/:folderName",
  "10": "下载内容 → 直接使用meta中的OSS链接（性能优化）"
}

// TaskId生成示例
function generateTaskId() {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  return `pod2post_${timestamp}_${random}`
}
```

## 🔄 生成流程状态

### 状态转换图
```mermaid
stateDiagram-v2
    [*] --> submitted: 提交任务
    submitted --> processing: 开始处理
    processing --> generated: AI生成完成
    generated --> uploading_oss: Base64嵌入完成
    uploading_oss --> completed: OSS上传成功
    uploading_oss --> partial_success: OSS上传失败
    processing --> failed: 处理失败
```

### 阶段权重分配
| 阶段 | 权重 | 说明 |
|-----|------|------|
| promptProcessing | 10% | Prompt处理和路径替换 |
| firstGeneration | 50% | AI生成HTML和JSON |
| base64Embedding | 25% | 图片转换为Base64 |
| **ossUpload** 🆕 | 15% | 上传文件到OSS |

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

### CDN素材上传

#### 端点
```
POST /api/generate/pod2post/cdn
```

#### 请求格式
```http
Content-Type: multipart/form-data

Parameters:
- files: 图片文件（支持多个）  // 重要：CDN上传使用files字段，不是images
- clearBase64: "true" | "false" (可选)
- token: "lijing-token-2025-pod2post" (可选)

Query Parameters:
- taskId: "pod2post_1757482406080_abc123" (可选，任务ID)
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

## 🎯 播客卡片生成

### 主要生成接口

#### 端点
```
POST /api/generate/pod2post/async
```

#### 请求格式
```json
{
  "prompt": "阅读[播客小红书图文卡片需求文档.md]...",
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
    "submittedAt": "2025-01-10T07:55:12.903Z",
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

#### 响应示例（含OSS状态）
```json
{
  "success": true,
  "data": {
    "taskId": "pod2post_1757375653794_ddrq4mn",
    "status": "completed",
    "progress": 100,
    "phases": {
      "promptProcessing": "completed",
      "firstGeneration": "completed", 
      "base64Embedding": "completed",
      "ossUpload": "completed"  // 🆕 新增OSS上传阶段
    },
    "startTime": "2025-01-10T07:55:12.903Z",
    "endTime": "2025-01-10T08:00:45.126Z",
    "duration": 332223,
    "result": {
      "topic": "pod2post_1757375653794",
      "templateName": "pod2post-template",
      "fileCount": 3,
      "files": [
        {
          "fileName": "podcast_cards.html",
          "size": 24950,
          "mtime": "2025-01-10T03:18:04.993Z"
        },
        {
          "fileName": "podcast_cards_with_base64.html",
          "size": 23768530,
          "mtime": "2025-01-10T03:18:11.049Z"
        },
        {
          "fileName": "20250110_031413_lijing_meta.json",
          "size": 8219,
          "mtime": "2025-01-10T03:18:11.117Z"
        }
      ]
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
- `folderName`: 完整的taskId（例如：pod2post_1757375653794_ddrq4mn）
- `token`: 用户认证token（可选，通过URL参数或请求头传递）

#### 🆕 性能优化说明
1. **不再实时上传OSS**：移除了Content接口的实时上传逻辑
2. **直接返回缓存链接**：从meta文件读取预存的OSS链接
3. **响应时间优化**：从5-30秒降至<500ms
4. **减少OSS请求**：避免重复上传相同文件

#### 响应格式（使用缓存的OSS链接）
```json
{
  "code": 200,
  "success": true,
  "data": {
    "folderName": "pod2post_1757388375054_abc123",
    "allFiles": [...],
    "pod2postFiles": {
      "original": "podcast_cards.html",
      "withBase64": "podcast_cards_with_base64.html",
      "metadata": "20250110_032615_lijing_meta.json"
    },
    "content": {
      // 🆕 从meta文件读取的OSS链接
      "originalHtmlOssUrl": "https://cms-mcp.oss-cn-hangzhou.aliyuncs.com/pod2post/lijing/...",
      "base64HtmlOssUrl": "https://cms-mcp.oss-cn-hangzhou.aliyuncs.com/pod2post/lijing/...",
      "base64HtmlSize": 23768530,
      "base64HtmlPreview": "<!DOCTYPE html>...", // 前50KB预览
      
      "metadata": {
        "sessionInfo": {...},
        "custom": {
          "ossUpload": {  // 🆕 OSS上传信息
            "success": true,
            "uploadedAt": "2025-01-10T08:00:45.126Z",
            "urls": {
              "originalHtml": "https://...",
              "withBase64": "https://...",
              "metadata": "https://..."
            }
          }
        }
      },
      
      "base64Analysis": {
        "base64ImageCount": 20,
        "unconvertedPathCount": 0,
        "conversionSuccess": true
      }
    }
  }
}
```

### OSS链接说明

#### 自动上传机制
1. **触发时机**：Base64转换完成后自动触发
2. **上传内容**：所有生成的文件（HTML、JSON、meta）
3. **链接有效期**：1年
4. **存储位置**：`pod2post/{username}/{folderName}/{filename}`

#### 优化效果对比
| 指标 | 优化前 | 优化后 |
|-----|--------|--------|
| Content接口响应时间 | 5-30秒 | <500ms |
| OSS上传次数 | 每次请求都上传 | 只在生成时上传一次 |
| 带宽消耗 | 高（重复上传） | 低（缓存链接） |
| 用户体验 | 等待时间长 | 即时响应 |

## 💻 JavaScript示例代码

### 完整工作流程示例（含OSS优化）

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

  // 2. 提交生成任务
  async submitTask(prompt, taskId) {
    const response = await fetch(`${this.baseUrl}/generate/pod2post/async`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: prompt,
        token: this.token,
        taskId: taskId
      })
    })

    return await response.json()
  }

  // 3. 查询任务状态（含OSS状态）
  async getTaskStatus(taskId) {
    const response = await fetch(`${this.baseUrl}/generate/pod2post/status/${taskId}?token=${this.token}`)
    const result = await response.json()
    
    if (result.success && result.data) {
      const { phases, progress } = result.data
      
      // 检查OSS上传状态
      if (phases.ossUpload === 'completed') {
        console.log('✅ OSS上传完成，文件已缓存到云端')
      } else if (phases.ossUpload === 'processing') {
        console.log('⏳ 正在上传到OSS...')
      }
      
      console.log(`📊 总进度: ${progress}%`)
    }
    
    return result
  }

  // 4. 获取内容（优化版，直接返回OSS链接）
  async getContent(folderName) {
    const response = await fetch(`${this.baseUrl}/generate/pod2post/content/${folderName}?token=${this.token}`)
    const result = await response.json()
    
    if (result.success && result.data?.content) {
      const content = result.data.content
      
      // 🆕 直接使用缓存的OSS链接，无需等待上传
      if (content.base64HtmlOssUrl) {
        console.log(`✅ 使用缓存的OSS链接（响应时间<500ms）`)
        console.log(`📦 Base64 HTML: ${content.base64HtmlOssUrl}`)
        console.log(`📏 文件大小: ${(content.base64HtmlSize / 1024 / 1024).toFixed(2)}MB`)
      } else {
        console.warn(`⚠️ 未找到OSS链接，可能任务未完成OSS上传阶段`)
      }
      
      // 检查OSS上传信息
      if (content.metadata?.custom?.ossUpload) {
        const ossInfo = content.metadata.custom.ossUpload
        console.log(`📅 OSS上传时间: ${ossInfo.uploadedAt}`)
        console.log(`✅ OSS上传成功: ${ossInfo.success}`)
      }
    }
    
    return result
  }

  // 5. 轮询等待任务完成（包括OSS上传）
  async waitForCompletion(taskId, maxWaitTime = 1800000) {
    const startTime = Date.now()
    const pollInterval = 3000

    while (Date.now() - startTime < maxWaitTime) {
      const status = await this.getTaskStatus(taskId)
      
      if (status.data?.status === 'completed') {
        console.log('🎉 任务完成（包括OSS上传）!')
        return status.data
      } else if (status.data?.status === 'partial_success') {
        console.warn('⚠️ 任务部分成功（OSS上传可能失败）')
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

      // 0. 生成任务ID
      const taskId = this.generateTaskId()
      console.log(`📝 任务ID: ${taskId}`)

      // 1. 上传资源
      console.log('📸 上传照片...')
      await this.uploadPhotos(photoPaths, taskId)

      // 2. 提交任务
      console.log('⚡ 提交生成任务...')
      const taskResult = await this.submitTask(prompt, taskId)

      // 3. 等待完成（包括OSS上传）
      console.log('⏳ 等待生成和OSS上传...')
      const result = await this.waitForCompletion(taskId)

      // 4. 获取内容（使用缓存的OSS链接）
      console.log('📥 获取生成内容（优化版）...')
      const contentResult = await this.getContent(taskId)
      
      return { taskResult: result, contentResult }

    } catch (error) {
      console.error('❌ 生成失败:', error.message)
      throw error
    }
  }
}
```

## 🔧 高级功能

### OSS自动上传机制 🆕

#### 工作原理
1. **生成阶段**：AI生成HTML和JSON文件
2. **Base64嵌入**：将图片转换为Base64格式
3. **OSS上传**：自动上传所有文件到阿里云OSS
4. **链接保存**：将OSS链接保存到meta文件
5. **Content查询**：直接返回缓存的链接

#### 优势
- **性能提升**：Content接口响应速度提升10倍以上
- **节省带宽**：避免重复上传相同文件
- **高可用性**：文件存储在云端，支持CDN加速
- **自动管理**：无需手动管理文件上传

### 并发控制

#### 多任务并发支持
- **最大并发数**: 每用户5个任务
- **任务ID格式**: `pod2post_{timestamp}_{random}`
- **资源隔离**: 每个任务使用独立的资源目录
- **自动清理**: 任务完成后自动清理任务资源

### 错误处理

#### 常见错误码
| 错误码 | 描述 | 解决方案 |
|-------|------|---------|
| 400 | 请求参数错误 | 检查请求格式和必需参数 |
| 401 | 认证失败 | 检查token是否正确 |
| 404 | 文件夹不存在 | 检查folderName是否正确 |
| 409 | 任务冲突 | 等待当前任务完成 |
| 500 | 服务器内部错误 | 联系技术支持 |

## 📊 性能指标

### 文件限制
- **单文件大小**: 最大50MB
- **批量上传**: 最多20个文件
- **总存储**: 每用户1GB

### 生成时间
- **简单任务**: 2-5分钟
- **复杂任务**: 5-15分钟
- **OSS上传**: 10-60秒（取决于文件大小）
- **超时时间**: 30分钟

### 输出规格
- **HTML文件**: 原始版本和Base64嵌入版本
- **JSON文案**: 包含标题、内容、标签等
- **图片数量**: 封面1张 + 内容页10张
- **OSS链接**: 1年有效期

## 🚨 注意事项

1. **用户隔离**: 每个token对应独立的工作空间
2. **资源清理**: 建议定期使用 `clearBase64=true` 清理历史文件
3. **文件命名**: 支持中文文件名，系统会自动处理编码
4. **任务状态**: 请妥善保存taskId，用于查询任务状态
5. **并发支持**: 同一用户支持最多5个任务并发执行
6. **OSS链接**: 自动生成，有效期1年
7. **性能优化**: Content接口已优化，直接返回缓存链接

## 📞 技术支持

如有问题，请联系技术团队或查看相关文档：
- API总览: `/docs/api/card-generation-api.md`
- 开发者指南: `/DEVELOPER.md`
- 问题反馈: GitHub Issues

---

**文档版本**: v6.0.0  
**更新时间**: 2025-01-10  
**主要更新**: 
- 新增OSS自动上传机制
- Content接口性能优化（不再实时上传）
- 新增OSS上传阶段状态
- 响应时间从5-30秒优化至<500ms

**适用环境**: 生产环境