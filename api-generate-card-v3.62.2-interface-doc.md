# POST /api/generate/card - v3.62.2 接口文档

## 概述
v3.62.2版本是CardPlanet Sandra JSON增强的稳定版本，引入了关键的`pageinfo`字段，为移动端HTML预览提供了基础支持。

## 接口信息
- **版本**: v3.62.2 - CardPlanet Sandra JSON 增强
- **路径**: `POST /api/generate/card`
- **认证**: `authenticateUserOrDefault`
- **中间件**: `ensureUserFolder`

## 请求格式

### 请求体
```json
{
  "topic": "主题名称",
  "templateName": "模板文件名"
}
```

### 参数说明
| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| topic | string | 是 | - | 生成卡片的主题 |
| templateName | string | 否 | daily-knowledge-card-template.md | 模板名称 |

## 处理逻辑与时序

### 1. 请求验证阶段 (0-10ms)
```javascript
// 参数验证
if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
  return res.status(400).json({
    code: 400,
    success: false,
    message: '主题(topic)参数不能为空'
  })
}

// 主题名称清理
const sanitizedTopic = topic.trim().replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')
```

### 2. 环境初始化阶段 (10-50ms)
```javascript
// 环境路径确定
const isDocker = process.env.NODE_ENV === 'production' || process.env.DATA_PATH
const dataPath = process.env.DATA_PATH || path.join(process.cwd(), 'data')

// 模板类型判断
const isFolder = !templateName.includes('.md')

// 用户专属路径
const userCardPath = userService.getUserCardPath(req.user.username, topic)
```

### 3. 参数生成阶段 (50ms-30s)
```javascript
// 使用直接执行服务生成参数
const parameters = await claudeExecutorDirect.generateCardParameters(topic, templateName)

// 根据模板类型解构参数
let cover, style, language, referenceContent
if (templateName === 'cardplanet-Sandra-cover' || templateName === 'cardplanet-Sandra-json') {
  ({ cover, style, language, reference: referenceContent } = parameters)
  // 4参数模式：封面、风格、语言、参考
} else {
  ({ style, language, reference: referenceContent } = parameters)
  // 3参数模式：风格、语言、参考
}
```

### 4. 模板路径构建阶段 (30-50ms)
```javascript
if (isFolder) {
  // 文件夹模式
  templatePath = isDocker 
    ? path.join('/app/data/public_template', templateName)
    : path.join(dataPath, 'public_template', templateName)
  
  // 模板验证
  const stats = await fs.stat(templatePath)
  if (!stats.isDirectory()) {
    throw new Error('不是有效的模板文件夹')
  }
} else {
  // 单文件模式
  templatePath = isDocker 
    ? path.join('/app/data/public_template', templateName)
    : path.join(dataPath, 'public_template', templateName)
  
  await fs.access(templatePath)
}
```

### 5. 提示词构建阶段 (50-100ms)
```javascript
// cardplanet-Sandra-json 特殊处理
if (templateName === 'cardplanet-Sandra-json') {
  prompt = `你是一位海报设计师，要为"${topic}"创作一套收藏级卡片海报作品。

创作重点：
- 把每张卡片当作独立的艺术海报设计
- 深挖主题的趣味性和视觉潜力
- 用细节和创意打动人心
- 必须同时生成HTML和JSON两个文件

封面：${cover}
风格：${style}
语言：${language}
参考：${referenceContent}

从${claudePath}文档开始，按其指引阅读全部6个文档获取创作框架。
特别注意：必须按照html_generation_workflow.md中的双文件输出规范，同时生成HTML文件（主题英文名_style.html）和JSON文件（主题英文名_data.json）。
生成的文件保存在[${userCardPath}]`
}
```

### 6. Claude执行阶段 (100ms-5分钟)
```javascript
// 创建API会话
const apiId = `card_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

// 执行Claude命令
await apiTerminalService.executeClaude(apiId, prompt)
```

### 7. 文件监控阶段 (与Claude执行并行)
```javascript
const waitForFile = new Promise((resolve, reject) => {
  const checkFile = async () => {
    const files = await fs.readdir(userCardPath)
    const generatedFiles = files.filter(f => 
      (f.endsWith('.json') || f.endsWith('.html')) && 
      !f.includes('-response')
    )
    
    // cardplanet-Sandra-json 双文件检测
    if (templateName === 'cardplanet-Sandra-json') {
      const htmlFiles = generatedFiles.filter(f => f.endsWith('.html'))
      const jsonFiles = generatedFiles.filter(f => f.endsWith('.json'))
      
      if (htmlFiles.length > 0 && jsonFiles.length > 0) {
        // 读取并处理两个文件
        const result = { success: true, files: [] }
        
        // HTML文件处理
        const htmlContent = await fs.readFile(htmlFilePath, 'utf-8')
        result.files.push({
          fileName: htmlFileName,
          path: htmlFilePath,
          content: htmlContent,
          fileType: 'html'
        })
        
        // JSON文件处理
        const jsonContent = await fs.readFile(jsonFilePath, 'utf-8')
        const parsedJson = JSON.parse(jsonContent)
        result.files.push({
          fileName: jsonFileName,
          path: jsonFilePath,
          content: parsedJson,
          fileType: 'json'
        })
        
        resolve({
          success: true,
          fileName: htmlFileName,
          path: htmlFilePath,
          content: htmlContent,
          fileType: 'html',
          allFiles: result.files
        })
      }
    }
  }
  
  // 每2秒检查一次，最多7分钟超时
  setInterval(checkFile, 2000)
  setTimeout(() => reject(new Error('生成超时')), 420000)
})
```

### 8. 响应构建阶段 (50-100ms)
```javascript
const responseData = {
  topic: topic,
  sanitizedTopic: sanitizedTopic,
  templateName: templateName,
  fileName: result.fileName,
  filePath: result.path,
  generationTime: elapsedTime,
  content: result.content,
  apiId: apiId
}

// 🆕 pageinfo字段的关键逻辑
if (result.allFiles) {
  responseData.allFiles = result.allFiles
  
  // CardPlanet Sandra JSON 增强：添加pageinfo
  if (templateName === 'cardplanet-Sandra-json') {
    const jsonFile = result.allFiles.find(f => f.fileType === 'json')
    if (jsonFile && jsonFile.content) {
      responseData.pageinfo = jsonFile.content  // 核心创新点
    }
  }
}
```

## 响应格式

### 成功响应 (200)

#### 单文件模板
```json
{
  "code": 200,
  "success": true,
  "data": {
    "topic": "人工智能",
    "sanitizedTopic": "人工智能",
    "templateName": "daily-knowledge-card-template.md",
    "fileName": "ai_cards.json",
    "filePath": "/path/to/ai_cards.json",
    "generationTime": 45000,
    "content": {...},
    "apiId": "card_1234567890_abcdefg"
  },
  "message": "卡片生成成功"
}
```

#### CardPlanet Sandra JSON 模板 (核心增强)
```json
{
  "code": 200,
  "success": true,
  "data": {
    "topic": "人工智能",
    "sanitizedTopic": "人工智能",
    "templateName": "cardplanet-Sandra-json",
    "fileName": "artificial_intelligence_style.html",
    "filePath": "/path/to/artificial_intelligence_style.html",
    "generationTime": 120000,
    "content": "<!DOCTYPE html><html>...</html>",
    "apiId": "card_1234567890_abcdefg",
    "allFiles": [
      {
        "fileName": "artificial_intelligence_style.html",
        "path": "/path/to/artificial_intelligence_style.html",
        "content": "<!DOCTYPE html><html>...</html>",
        "fileType": "html"
      },
      {
        "fileName": "artificial_intelligence_data.json",
        "path": "/path/to/artificial_intelligence_data.json",
        "content": {
          "cards": [...],
          "metadata": {...}
        },
        "fileType": "json"
      }
    ],
    "pageinfo": {
      "cards": [...],
      "metadata": {...}
    }
  },
  "message": "卡片生成成功"
}
```

### 错误响应

#### 参数错误 (400)
```json
{
  "code": 400,
  "success": false,
  "message": "主题(topic)参数不能为空"
}
```

#### 模板不存在 (404)
```json
{
  "code": 404,
  "success": false,
  "message": "模板文件夹不存在: cardplanet-Sandra-json"
}
```

#### 生成失败 (500)
```json
{
  "code": 500,
  "success": false,
  "message": "生成超时，已等待420秒",
  "error": {
    "topic": "人工智能",
    "templateName": "cardplanet-Sandra-json",
    "apiId": "card_1234567890_abcdefg",
    "details": "Error: 生成超时，已等待420秒"
  }
}
```

## 关键特性

### 1. pageinfo字段创新
- **作用**: 为移动端提供JSON数据结构
- **触发条件**: 仅当`templateName === 'cardplanet-Sandra-json'`时添加
- **数据来源**: allFiles中JSON文件的content副本

### 2. 双文件处理逻辑
- **HTML文件**: 作为主文件返回在content字段
- **JSON文件**: 同时返回在allFiles和pageinfo字段
- **文件检测**: 必须等待两个文件都生成完成

### 3. 超时机制
- **超时时间**: 7分钟 (420000ms)
- **检查频率**: 每2秒检查一次文件生成状态
- **并发处理**: 文件监控与Claude执行并行进行

### 4. 错误恢复
- **JSON解析失败**: 返回原始内容并标记parseError
- **会话清理**: 无论成功失败都清理API会话
- **详细错误信息**: 包含apiId用于调试

这个版本为后续的移动端HTML预览功能奠定了基础，pageinfo字段的引入是关键创新点。