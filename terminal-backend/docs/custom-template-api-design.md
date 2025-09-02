# 自定义模板异步API设计文档

## 1. API概述

### 1.1 功能说明
提供与 `/api/generate/card/async` 一致的异步自定义模板处理接口。支持ZIP文件上传、AI内容生成和两阶段处理（HTML生成 + Base64图片嵌入）。采用单一提交接口+状态查询的异步模式。

### 1.2 核心流程
1. **任务提交**：上传ZIP和prompt，立即返回任务信息
2. **后台处理**：
   - 第一阶段：解压ZIP、处理prompt路径、生成HTML文件
   - 第二阶段：自动将图片转换为base64嵌入HTML（同一session保持上下文）
3. **状态查询**：通过 `/api/generate/custom/status/{taskId}` 查询进度
4. **结果读取**：完成后从返回的文件路径读取内容

## 2. API接口设计

### 2.1 自定义模板异步提交接口
```
POST /api/generate/custom/async
Content-Type: multipart/form-data
```

#### 请求参数
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| zipFile | File | 是 | 包含模板资源的ZIP压缩包（支持中文文件名） |
| prompt | String | 是 | AI处理提示词，支持多种路径占位符 |
| templateName | String | 否 | 模板名称，默认 'custom-template' |
| token | String | 否 | 用户token，用于指定生成到特定用户 |

#### 支持的占位符
- `[文件名]` - 替换为ZIP中的实际文件路径
- `[user]` - 替换为用户的card工作目录路径
- `"用户card路径"` - 替换为用户的card工作目录路径（兼容中文）
- `[用户card路径]` - 替换为用户的card工作目录路径（兼容中文）

#### 响应格式（立即返回）
```json
{
  "code": 200,
  "success": true,
  "data": {
    "taskId": "custom_1234567890_abc123",
    "folderName": "custom_template_1234567890",
    "folderPath": "/data/users/{userId}/workspace/card/custom_template_1234567890",
    "topic": "自定义模板: {templateName}",
    "templateName": "custom-template",
    "status": "submitted",
    "extractedStructure": {
      "files": [
        {
          "path": "播客小红书图文卡片需求文档.md",
          "type": "document",
          "size": 11897
        },
        {
          "path": "CDN/cardplanet_logo_filled.svg",
          "type": "image",
          "size": 5432
        }
      ],
      "directories": ["CDN", "李静", "李静/第二期", "李静/第二期/照片"],
      "totalFiles": 25,
      "totalSize": 2457890
    }
  },
  "message": "任务已提交，正在后台处理"
}
```

### 2.2 状态查询（复用现有接口）
```
GET /api/generate/status/{taskId}
```

使用现有的 `/api/generate/status` 接口查询任务状态，返回格式与现有接口一致。

#### 响应格式
```json
{
  "code": 200,
  "success": true,
  "status": "generating|completed|failed",
  "files": {
    "json": ["output.json"],
    "html": ["output.html", "output_oss.html"],
    "total": 3
  },
  "message": "生成完成",
  "progress": {
    "json": 1,
    "html": 2
  },
  "templateName": "custom-template",
  "taskId": "custom_1234567890_abc123",
  "metadata": {
    "status": "completed",
    "startTime": "2024-01-10T10:00:00Z",
    "endTime": "2024-01-10T10:05:00Z",
    "templatePath": "/data/users/xxx/templates/custom_1234567890",
    "ossResources": 16,
    "phases": {
      "extraction": "completed",
      "firstGeneration": "completed",
      "base64Embedding": "completed"
    }
  }
}
```

### 2.3 内容获取（复用现有接口）
```
GET /api/generate/card/content/{folderName}
```

使用现有的 `/api/generate/card/content` 接口获取生成的内容。任务完成后，使用返回的 `folderName` 查询内容。

#### 响应格式（与现有接口一致）
```json
{
  "code": 200,
  "success": true,
  "data": {
    "topic": "custom_template_1234567890",
    "sanitizedTopic": "custom_template_1234567890",
    "templateName": "custom-template",
    "fileName": "output.html",
    "filePath": "/data/users/{userId}/workspace/card/custom_template_1234567890/output.html",
    "generationTime": null,
    "content": "<html>...生成的HTML内容...</html>",
    "apiId": null,
    "allFiles": [
      {
        "fileName": "output.html",
        "path": "/data/users/{userId}/workspace/card/custom_template_1234567890/output.html",
        "content": "<html>...本地版HTML...</html>",
        "fileType": "html"
      },
      {
        "fileName": "output_oss.html",
        "path": "/data/users/{userId}/workspace/card/custom_template_1234567890/output_oss.html",
        "content": "<html>...OSS版HTML...</html>",
        "fileType": "html"
      },
      {
        "fileName": "output.json",
        "path": "/data/users/{userId}/workspace/card/custom_template_1234567890/output.json",
        "content": {
          "title": "封面标题",
          "content": "社媒文案内容",
          "hashtags": ["#播客", "#小红书"]
        },
        "fileType": "json"
      }
    ]
  },
  "message": "卡片生成成功"
}
```

## 3. 技术实现方案

### 3.1 目录结构
```
/data/users/{userId}/
├── templates/                      # 模板存储目录
│   └── custom_{timestamp}/         # 解压的模板文件
│       ├── *.md                    # 文档文件
│       ├── CDN/                    # 公共资源
│       └── ...                     # 其他资源
└── workspace/
    └── card/
        └── custom_template_{timestamp}/  # 任务输出目录
            ├── .card_workspace_meta.json # 元数据文件（状态、进度等）
            ├── {生成的文件名}.html       # 第一阶段生成的HTML
            └── {文件名}_with_base64.html # 第二阶段生成的HTML（图片已嵌入base64）
```

### 3.2 核心实现路径

#### 3.2.1 新建路由文件
```
/src/routes/generate/customAsync.js
```

#### 3.2.2 复用现有组件
- `SessionMetadata` - 元数据管理
- `folderManager` - 文件夹管理
- `apiTerminalService` - AI交互
- `/api/generate/status` - 状态查询

### 3.3 后台处理流程

```javascript
// customAsync.js 主要逻辑
router.post('/', authenticateUserOrDefault, ensureUserFolder, upload.single('zipFile'), async (req, res) => {
  const { prompt, templateName = 'custom-template', token } = req.body
  const zipFile = req.file
  
  // 1. 参数验证
  if (!zipFile || !prompt) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: 'zipFile和prompt参数不能为空'
    })
  }
  
  // 2. 生成任务ID和路径
  const taskId = `custom_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  const folderName = `custom_template_${Date.now()}`
  const userCardPath = userService.getUserCardPath(targetUser.username, folderName)
  
  // 3. 解压ZIP并分析结构
  const templatePath = path.join(userTemplatesPath, `custom_${Date.now()}`)
  const extractedStructure = await zipProcessor.extract(zipFile.path, templatePath)
  
  // 4. 创建任务文件夹和元数据
  await ensureCardFolder(userCardPath, folderName, folderName)
  const metadata = new SessionMetadata(userCardPath, {
    taskId,
    templateName,
    status: 'submitted',
    startTime: new Date().toISOString()
  })
  await metadata.save(userCardPath)
  
  // 5. 立即返回响应
  res.json({
    code: 200,
    success: true,
    data: {
      taskId,
      folderName,
      folderPath: userCardPath,
      topic: `自定义模板: ${templateName}`,
      templateName,
      status: 'submitted',
      extractedStructure
    },
    message: '任务已提交，正在后台处理'
  })
  
  // 6. 后台异步处理
  processInBackground(taskId, userCardPath, templatePath, prompt, metadata)
})

// 后台处理函数（两阶段处理）
async function processInBackground(taskId, userCardPath, templatePath, prompt, metadata) {
  // 创建共享的API会话，保持上下文连续性
  const apiId = uuidv4()
  
  try {
    // 创建终端会话（两次生成共享）
    await apiTerminalService.createTerminalSession(apiId)
    
    // ========== 第一阶段：生成HTML文件 ==========
    metadata.updateStatus('generating')
    metadata.data.custom.phases.firstGeneration = 'processing'
    await metadata.save(userCardPath)
    
    // 1. 处理Prompt路径占位符
    const processedPrompt = await promptProcessor.processPrompt(prompt, templatePath, userCardPath)
    
    // 2. 调用AI生成第一个HTML
    const firstResult = await generateWithAI(processedPrompt, userCardPath, { apiId })
    
    metadata.data.custom.phases.firstGeneration = 'completed'
    metadata.addLog('info', '第一次AI生成完成', { fileName: firstResult.fileName })
    
    // ========== 第二阶段：嵌入Base64图片 ==========
    metadata.updateStatus('embedding')
    metadata.data.custom.phases.base64Embedding = 'processing'
    await metadata.save(userCardPath)
    
    // 3. 使用简洁的prompt，利用session上下文
    const base64Prompt = `将生成的html中的图片直接嵌入到文件中。方便发送给别人看效果`
    
    // 4. 在同一session中执行第二次生成
    const secondResult = await generateWithAI(base64Prompt, userCardPath, { 
      apiId,  // 使用同一个session
      filePattern: '_with_base64'  // 检测特定文件名
    })
    
    metadata.data.custom.phases.base64Embedding = 'completed'
    metadata.addLog('info', 'Base64图片嵌入完成')
    
    // 更新状态：完成
    metadata.complete('success')
    metadata.data.custom.generatedFiles = {
      original: firstResult.fileName,
      withBase64: secondResult.fileName
    }
    await metadata.save(userCardPath)
    
    // 销毁共享session
    await apiTerminalService.destroySession(apiId)
    
  } catch (error) {
    // 错误处理
    if (apiId) await apiTerminalService.destroySession(apiId)
    metadata.complete('error')
    metadata.addLog('error', error.message)
    await metadata.save(userCardPath)
  }
}
```

## 4. 核心模块实现

### 4.1 ZIP处理模块
```javascript
// /src/utils/zipProcessor.js
import unzipper from 'unzipper'
import fs from 'fs/promises'
import path from 'path'

class ZipProcessor {
  async extract(zipPath, targetDir) {
    // 创建目标目录
    await fs.mkdir(targetDir, { recursive: true })
    
    // 解压文件
    await fs.createReadStream(zipPath)
      .pipe(unzipper.Extract({ path: targetDir }))
      .promise()
    
    // 分析文件结构
    return await this.analyzeStructure(targetDir)
  }
  
  async analyzeStructure(dir) {
    const structure = {
      files: [],
      directories: [],
      totalFiles: 0,
      totalSize: 0
    }
    
    async function scan(currentPath, relativePath = '') {
      const items = await fs.readdir(currentPath, { withFileTypes: true })
      
      for (const item of items) {
        const fullPath = path.join(currentPath, item.name)
        const relPath = path.join(relativePath, item.name)
        
        if (item.isDirectory()) {
          structure.directories.push(relPath)
          await scan(fullPath, relPath)
        } else {
          const stats = await fs.stat(fullPath)
          structure.files.push({
            path: relPath,
            type: getFileType(item.name),
            size: stats.size
          })
          structure.totalFiles++
          structure.totalSize += stats.size
        }
      }
    }
    
    await scan(dir)
    return structure
  }
}
```

### 4.2 Prompt处理模块
```javascript
// /src/utils/promptProcessor.js
class PromptProcessor {
  /**
   * 处理prompt中的路径占位符
   * [path] -> 模板目录中的实际路径
   * "用户card路径" -> 用户的card工作目录
   */
  async processPrompt(prompt, templateDir, cardPath) {
    let processed = prompt
    
    // 1. 替换方括号路径
    const bracketMatches = prompt.match(/\[([^\]]+)\]/g) || []
    for (const match of bracketMatches) {
      const fileName = match.slice(1, -1)
      
      // 递归查找文件
      const fullPath = await this.findFile(templateDir, fileName)
      
      if (fullPath) {
        processed = processed.replace(match, fullPath)
        console.log(`[PromptProcessor] Replaced [${fileName}] with ${fullPath}`)
      } else {
        console.warn(`[PromptProcessor] File not found: ${fileName}`)
        throw new Error(`文件未找到: ${fileName}`)
      }
    }
    
    // 2. 替换用户card路径
    processed = processed.replace(/"用户card路径"/g, `"${cardPath}"`)
    
    return processed
  }
  
  async findFile(baseDir, target) {
    // 如果target包含路径分隔符，直接拼接
    if (target.includes('/') || target.includes('\\')) {
      const fullPath = path.join(baseDir, target)
      try {
        await fs.access(fullPath)
        return fullPath
      } catch {
        return null
      }
    }
    
    // 否则递归搜索文件名
    async function search(dir) {
      const items = await fs.readdir(dir, { withFileTypes: true })
      
      for (const item of items) {
        const fullPath = path.join(dir, item.name)
        
        if (item.name === target) {
          return fullPath
        }
        
        if (item.isDirectory()) {
          const found = await search(fullPath)
          if (found) return found
        }
      }
      
      return null
    }
    
    return await search(baseDir)
  }
}
```

### 4.3 资源上传模块
```javascript
// /src/utils/resourceUploader.js
import { OSSService } from '../services/oss/index.cjs'

class ResourceUploader {
  constructor() {
    this.oss = new OSSService('custom-template')
  }
  
  async uploadResources(templateDir) {
    const mediaFiles = await this.scanMediaFiles(templateDir)
    const mapping = []
    
    // 批量上传，控制并发
    const batchSize = 5
    for (let i = 0; i < mediaFiles.length; i += batchSize) {
      const batch = mediaFiles.slice(i, i + batchSize)
      const results = await Promise.all(
        batch.map(async (file) => {
          const ossPath = `custom-template/${Date.now()}/${file.relativePath}`
          const ossUrl = await this.oss.upload(file.fullPath, {
            remotePath: ossPath
          })
          
          return {
            localPath: file.relativePath,
            fullPath: file.fullPath,
            ossUrl: ossUrl.url
          }
        })
      )
      mapping.push(...results)
    }
    
    return mapping
  }
  
  async scanMediaFiles(dir) {
    const mediaExtensions = [
      '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp',
      '.mp4', '.avi', '.mov', '.webm',
      '.mp3', '.wav', '.ogg', '.m4a',
      '.pdf'
    ]
    
    const files = []
    
    async function scan(currentPath, basePath) {
      const items = await fs.readdir(currentPath, { withFileTypes: true })
      
      for (const item of items) {
        const fullPath = path.join(currentPath, item.name)
        const relativePath = path.relative(basePath, fullPath)
        
        if (item.isDirectory()) {
          await scan(fullPath, basePath)
        } else {
          const ext = path.extname(item.name).toLowerCase()
          if (mediaExtensions.includes(ext)) {
            files.push({ fullPath, relativePath })
          }
        }
      }
    }
    
    await scan(dir, dir)
    return files
  }
}
```

### 4.4 HTML路径替换模块
```javascript
// /src/utils/htmlProcessor.js
class HtmlProcessor {
  async replaceResourcePaths(html, resourceMapping, templateDir) {
    let processed = html
    
    // 第一阶段：基于映射表替换
    for (const mapping of resourceMapping) {
      // 尝试多种匹配模式
      const patterns = [
        mapping.localPath,                           // 相对路径
        path.basename(mapping.localPath),            // 文件名
        mapping.localPath.replace(/\\/g, '/'),       // 统一斜杠
        mapping.fullPath                             // 完整路径
      ]
      
      for (const pattern of patterns) {
        const regex = new RegExp(escapeRegex(pattern), 'g')
        processed = processed.replace(regex, mapping.ossUrl)
      }
    }
    
    // 第二阶段：扫描剩余的本地路径
    const remainingPaths = this.scanLocalPaths(processed)
    if (remainingPaths.length > 0) {
      // 上传未映射的资源
      const additionalMappings = await this.uploadRemainingResources(
        remainingPaths,
        templateDir
      )
      
      // 替换新上传的资源
      for (const mapping of additionalMappings) {
        processed = processed.replace(
          new RegExp(escapeRegex(mapping.localPath), 'g'),
          mapping.ossUrl
        )
      }
    }
    
    return processed
  }
  
  scanLocalPaths(html) {
    const patterns = [
      /src="([^"]+)"/g,
      /href="([^"]+)"/g,
      /url\(['"]?([^'")]+)['"]?\)/g,
      /background-image:\s*url\(['"]?([^'")]+)['"]?\)/g
    ]
    
    const paths = new Set()
    
    for (const pattern of patterns) {
      let match
      while ((match = pattern.exec(html)) !== null) {
        const path = match[1]
        // 过滤掉已经是URL的路径
        if (!path.startsWith('http') && !path.startsWith('data:')) {
          paths.add(path)
        }
      }
    }
    
    return Array.from(paths)
  }
}
```

## 5. 实现细节

### 5.1 Prompt路径替换规则

#### 占位符类型
1. **方括号路径 [path]**：替换为解压后模板目录中的实际路径
2. **引号路径 "用户card路径"**：替换为用户的card工作目录路径

#### 替换示例
**输入prompt**：
```
阅读[播客小红书图文卡片需求文档.md]，按文档要求使用[新闻感封面.md]和[内容页模板规范.md]的规范，
为"用户card路径"生成html文档。
需要使用的照片在[李静/第二期/照片]文件夹中。
需要使用的其他素材在[CDN]文件夹中。
```

**处理后的prompt**：
```
阅读/data/users/user123/templates/custom_1234567890/播客小红书图文卡片需求文档.md，
按文档要求使用/data/users/user123/templates/custom_1234567890/新闻感封面.md和
/data/users/user123/templates/custom_1234567890/内容页模板规范.md的规范，
为"/data/users/user123/workspace/card/custom_task_xxx"生成html文档。
需要使用的照片在/data/users/user123/templates/custom_1234567890/李静/第二期/照片文件夹中。
需要使用的其他素材在/data/users/user123/templates/custom_1234567890/CDN文件夹中。
```

### 5.2 元数据结构（_meta.json）
```json
{
  "taskId": "custom_1234567890_abc123",
  "templateName": "custom-template",
  "status": "completed",
  "startTime": "2024-01-10T10:00:00Z",
  "endTime": "2024-01-10T10:05:00Z",
  "phases": {
    "extraction": {
      "status": "completed",
      "files": 25,
      "size": 2457890
    },
    "resourceUpload": {
      "status": "completed",
      "uploaded": 16,
      "totalSize": 1234567
    },
    "aiGeneration": {
      "status": "completed",
      "duration": 45000
    },
    "pathReplacement": {
      "status": "completed",
      "replaced": 16
    }
  },
  "logs": [
    {
      "time": "2024-01-10T10:00:00Z",
      "level": "info",
      "message": "任务开始"
    }
  ],
  "error": null
}
```

## 6. 错误处理

### 6.1 错误码定义
| 错误码 | 说明 | HTTP状态码 |
|--------|------|------------|
| E001_INVALID_ZIP | ZIP文件无效或损坏 | 400 |
| E002_FILE_TOO_LARGE | 文件超过大小限制 | 413 |
| E003_PATH_NOT_FOUND | Prompt中的路径未找到 | 400 |
| E004_UPLOAD_FAILED | OSS上传失败 | 500 |
| E005_AI_GENERATION_FAILED | AI生成失败 | 500 |

### 6.2 错误恢复
- 自动重试机制（最多3次）
- 失败任务可通过重新提交恢复
- 详细的错误日志记录

## 7. 安全措施

### 7.1 文件安全
- ZIP解压路径验证，防止目录遍历
- 文件类型白名单
- 文件大小限制：ZIP最大100MB

### 7.2 用户隔离
- 每个用户独立的模板和工作目录
- 严格的权限验证

## 8. 客户端使用示例

### 8.1 完整使用流程
```javascript
// 1. 提交任务
const formData = new FormData()
formData.append('zipFile', zipFile)
formData.append('prompt', promptText)
formData.append('templateName', 'my-custom-template')

const submitResponse = await fetch('/api/generate/custom/async', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: formData
})

const { data } = await submitResponse.json()
const { taskId, folderName } = data
console.log(`任务已提交: ${taskId}, 文件夹: ${folderName}`)

// 2. 轮询状态
const checkStatus = async () => {
  const statusResponse = await fetch(`/api/generate/status/${taskId}`)
  const statusResult = await statusResponse.json()
  
  if (statusResult.status === 'completed') {
    console.log('生成完成，文件列表:', statusResult.files)
    // 进入第3步获取内容
    getContent()
  } else if (statusResult.status === 'failed') {
    console.error('生成失败:', statusResult.message)
  } else {
    console.log('处理中...', statusResult.status)
    // 继续轮询
    setTimeout(checkStatus, 2000)
  }
}

// 3. 获取生成的内容
const getContent = async () => {
  const contentResponse = await fetch(`/api/generate/card/content/${folderName}`)
  const contentResult = await contentResponse.json()
  
  if (contentResult.success) {
    const { data } = contentResult
    
    // 获取主要内容
    console.log('HTML内容:', data.content)
    
    // 获取所有文件
    if (data.allFiles) {
      data.allFiles.forEach(file => {
        console.log(`文件: ${file.fileName}`)
        if (file.fileName.includes('_oss.html')) {
          console.log('OSS版本HTML:', file.content)
        } else if (file.fileType === 'json') {
          console.log('JSON数据:', file.content)
        }
      })
    }
  }
}

// 启动流程
checkStatus()
```

### 8.2 简化的使用示例
```javascript
// 封装的辅助函数
async function processCustomTemplate(zipFile, prompt, templateName) {
  // 1. 提交
  const formData = new FormData()
  formData.append('zipFile', zipFile)
  formData.append('prompt', prompt)
  formData.append('templateName', templateName)
  
  const submitRes = await fetch('/api/generate/custom/async', {
    method: 'POST',
    body: formData
  })
  const { data: { taskId, folderName } } = await submitRes.json()
  
  // 2. 等待完成
  while (true) {
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    const statusRes = await fetch(`/api/generate/status/${taskId}`)
    const status = await statusRes.json()
    
    if (status.status === 'completed') {
      // 3. 获取内容
      const contentRes = await fetch(`/api/generate/card/content/${folderName}`)
      return await contentRes.json()
    } else if (status.status === 'failed') {
      throw new Error(status.message)
    }
  }
}

// 使用
try {
  const result = await processCustomTemplate(zipFile, prompt, 'podcast-template')
  console.log('生成成功:', result.data)
} catch (error) {
  console.error('生成失败:', error)
}
```

## 9. 与现有系统的集成点

### 9.1 复用组件
- `SessionMetadata` - 元数据管理
- `folderManager` - 文件夹管理  
- `apiTerminalService` - AI交互
- `/api/generate/status` - 状态查询接口
- 认证中间件 - 用户验证

### 9.2 新增组件
- `ZipProcessor` - ZIP文件处理
- `PromptProcessor` - Prompt路径替换
- `ResourceUploader` - 资源上传OSS
- `HtmlProcessor` - HTML路径替换

### 9.3 文件位置
```
/src/routes/generate/customAsync.js        # 主接口
/src/utils/zipProcessor.js                 # ZIP处理
/src/utils/promptProcessor.js              # Prompt处理
/src/utils/resourceUploader.js             # 资源上传
/src/utils/htmlProcessor.js                # HTML处理
```

## 10. 测试要点

### 10.1 功能测试
- ZIP文件上传和解压
- Prompt路径替换准确性
- 资源上传完整性
- HTML路径替换正确性

### 10.2 集成测试
- 与现有状态查询接口的兼容性
- 元数据文件格式一致性
- 用户权限验证

### 10.3 性能测试
- 大文件处理能力
- 并发任务处理
- 内存使用优化