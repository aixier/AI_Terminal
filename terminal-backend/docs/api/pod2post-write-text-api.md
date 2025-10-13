# Pod2Post 文本文件写入接口设计方案

## 📋 需求分析

### **接口需求**
- **功能**: 在 tasks/{task_id}/ 目录下写入文本文件
- **参数**:
  1. `token` (可选，不传使用 default 用户)
  2. `text` (文本内容)
  3. `filename` (文件名，带后缀，如 "record.txt")
  4. `task_id` (任务ID，如 "pod2post_1757592663331_lsymdox")
- **行为**:
  - 文件存在 → 覆盖
  - 目录不存在 → 自动创建

---

## 🎯 接口设计方案

### **方案 1: 新建独立接口（推荐）**

**接口路径**:
```
POST /api/generate/pod2post/write-text
```

**优点**:
- ✅ 职责单一，专门处理文本写入
- ✅ 不依赖 multer，性能更好
- ✅ API 语义清晰
- ✅ 易于扩展和维护

**实现位置**:
- 新建文件: `terminal-backend/src/routes/generate/pod2postWriteText.js`
- 或在现有文件添加: `pod2postUpload.js` (新增路由)

---

### **方案 2: 扩展现有 upload 接口**

**接口路径**:
```
POST /api/generate/pod2post/upload?mode=text
```

**优点**:
- ✅ 复用现有代码
- ✅ 统一的上传入口

**缺点**:
- ⚠️ 接口职责混乱（二进制文件 + 文本内容）
- ⚠️ 参数格式不统一

---

## 📝 推荐实现方案（方案 1）

### **1. 接口规范**

#### **请求格式**

```http
POST /api/generate/pod2post/write-text
Content-Type: application/json
Authorization: Bearer <token>  (可选)

{
  "task_id": "pod2post_1757592663331_lsymdox",
  "filename": "record.txt",
  "content": "播客文本内容...",
  "token": "user-token-abc123"  (可选，优先级低于 header)
}
```

**参数说明**:

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `task_id` | String | ✅ | 任务ID（格式: pod2post_{timestamp}_{random}） |
| `filename` | String | ✅ | 文件名（带后缀，如 "record.txt"） |
| `content` | String | ✅ | 文本内容 |
| `token` | String | ❌ | 用户token（可选，不传使用 default） |

**Header**:
- `Authorization: Bearer <token>` (可选，优先级高于 body.token)

---

#### **响应格式**

**成功响应**:
```json
{
  "code": 200,
  "success": true,
  "message": "文件写入成功",
  "data": {
    "filename": "record.txt",
    "path": "/app/data/users/default/workspace/templates/pod2post/tasks/pod2post_1757592663331_lsymdox/record.txt",
    "size": 1234,
    "isNew": false,
    "taskId": "pod2post_1757592663331_lsymdox",
    "username": "default"
  }
}
```

**失败响应**:
```json
{
  "code": 400,
  "success": false,
  "message": "参数错误: task_id 格式不正确"
}
```

---

### **2. 核心实现逻辑**

#### **完整代码结构**

```javascript
import express from 'express'
import path from 'path'
import fs from 'fs/promises'
import { authenticateUserOrDefault } from '../../middleware/userAuth.js'
import userService from '../../services/userService.js'

const router = express.Router()

/**
 * 获取任务目录路径
 * @param {string} username - 用户名
 * @param {string} taskId - 任务ID
 * @returns {string} 任务目录的绝对路径
 */
async function getTaskPath(username, taskId) {
  const templatePath = userService.getUserTemplatePath(username, 'pod2post')
  return path.join(templatePath, 'tasks', taskId)
}

/**
 * 验证文件名安全性
 * @param {string} filename - 文件名
 * @returns {boolean} 是否安全
 */
function isFilenameSafe(filename) {
  // 禁止路径遍历和特殊字符
  const dangerous = ['..', '~', '\\', '\0', '<', '>', '|', ':', '*', '?', '"']
  return !dangerous.some(char => filename.includes(char))
}

/**
 * 文本文件写入接口
 * POST /api/generate/pod2post/write-text
 *
 * Body参数:
 * - task_id: 任务ID（必填，格式: pod2post_{timestamp}_{random}）
 * - filename: 文件名（必填，带后缀）
 * - content: 文本内容（必填）
 * - token: 用户token（可选，不传使用default用户）
 */
router.post('/',
  authenticateUserOrDefault,
  async (req, res) => {

  const { task_id, filename, content, token } = req.body

  console.log('[Pod2PostWriteText] ==================== WRITE REQUEST ====================')
  console.log('[Pod2PostWriteText] Task ID:', task_id)
  console.log('[Pod2PostWriteText] Filename:', filename)
  console.log('[Pod2PostWriteText] Content length:', content?.length)
  console.log('[Pod2PostWriteText] Token:', token ? `${token.substring(0, 15)}...` : 'none')

  try {
    // 1. 参数验证
    if (!task_id || !task_id.startsWith('pod2post_')) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '参数错误: task_id 格式不正确，应为 pod2post_{timestamp}_{random}'
      })
    }

    if (!filename || typeof filename !== 'string' || filename.trim().length === 0) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '参数错误: filename 不能为空'
      })
    }

    if (!isFilenameSafe(filename)) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '参数错误: filename 包含不安全字符'
      })
    }

    if (content === undefined || content === null) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '参数错误: content 不能为空'
      })
    }

    // 2. 处理用户认证（支持 body.token 覆盖认证中间件）
    let targetUser = req.user  // 默认使用中间件认证的用户

    if (token) {
      console.log(`[Pod2PostWriteText] Body token provided: ${token}`)
      const tokenUser = await userService.findUserByToken(token)
      if (tokenUser) {
        targetUser = tokenUser
        console.log(`[Pod2PostWriteText] Using token-specified user: ${tokenUser.username}`)
      } else {
        console.log(`[Pod2PostWriteText] Invalid token, using middleware user: ${req.user.username}`)
      }
    }

    // 3. 计算目标路径
    const taskPath = await getTaskPath(targetUser.username, task_id)
    const filePath = path.join(taskPath, filename)

    console.log('[Pod2PostWriteText] Target path:', taskPath)
    console.log('[Pod2PostWriteText] File path:', filePath)

    // 4. 确保目录存在
    await fs.mkdir(taskPath, { recursive: true })

    // 5. 检查文件是否已存在
    let isNew = true
    try {
      await fs.access(filePath)
      isNew = false
      console.log(`[Pod2PostWriteText] File exists, will overwrite: ${filename}`)
    } catch {
      console.log(`[Pod2PostWriteText] Creating new file: ${filename}`)
    }

    // 6. 写入文件（覆盖模式）
    await fs.writeFile(filePath, content, 'utf-8')

    // 7. 获取文件信息
    const stats = await fs.stat(filePath)

    console.log(`[Pod2PostWriteText] File written successfully: ${filePath}`)
    console.log(`[Pod2PostWriteText] File size: ${stats.size} bytes`)

    // 8. 返回成功响应
    res.json({
      code: 200,
      success: true,
      message: isNew ? '文件写入成功' : '文件覆盖成功',
      data: {
        filename,
        path: filePath,
        size: stats.size,
        isNew,
        taskId: task_id,
        username: targetUser.username,
        createdAt: stats.birthtime.toISOString(),
        modifiedAt: stats.mtime.toISOString()
      }
    })

  } catch (error) {
    console.error('[Pod2PostWriteText] Write failed:', error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: error.message || '文件写入失败'
    })
  }
})

export default router
```

---

### **3. 集成到现有路由**

#### **在 index.js 中注册路由**

**位置**: `terminal-backend/src/index.js` 或路由注册文件

```javascript
// 导入新路由
import pod2postWriteTextRouter from './routes/generate/pod2postWriteText.js'

// 注册路由
app.use('/api/generate/pod2post/write-text', pod2postWriteTextRouter)
```

---

### **4. 关键函数复用**

#### **4.1 路径计算函数**

```javascript
// 复用现有逻辑
async function getTaskPath(username, taskId) {
  const templatePath = userService.getUserTemplatePath(username, 'pod2post')
  // templatePath = /app/data/users/default/workspace/templates/pod2post

  return path.join(templatePath, 'tasks', taskId)
  // 返回: /app/data/users/default/workspace/templates/pod2post/tasks/pod2post_xxx
}
```

**与现有 getUserUploadPath 的区别**:
```javascript
// 现有（需要 path 参数）
getUserUploadPath(username, 'photos', taskId)
// → templates/pod2post/tasks/pod2post_xxx/photos

// 新接口（直接在任务根目录）
getTaskPath(username, taskId)
// → templates/pod2post/tasks/pod2post_xxx
```

---

#### **4.2 用户认证逻辑**

```javascript
// 优先级1: Header Authorization
if (req.headers.authorization?.startsWith('Bearer ')) {
  const token = req.headers.authorization.replace('Bearer ', '')
  const user = await userService.findUserByToken(token)
  if (user) {
    targetUser = user
  }
}

// 优先级2: Body token
if (!targetUser && req.body.token) {
  const user = await userService.findUserByToken(req.body.token)
  if (user) {
    targetUser = user
  }
}

// 优先级3: 中间件认证的用户（默认 default）
if (!targetUser) {
  targetUser = req.user
}
```

**参考代码**: `pod2postAsync.js:100-111`

---

#### **4.3 文件写入逻辑**

```javascript
// 1. 确保目录存在
await fs.mkdir(taskPath, { recursive: true })

// 2. 写入文件（自动覆盖）
await fs.writeFile(filePath, content, 'utf-8')
```

**关键点**:
- `fs.writeFile()` 默认覆盖模式
- 如果文件不存在，自动创建
- 如果文件存在，完全覆盖（不是追加）

---

### **5. 安全性考虑**

#### **5.1 文件名验证**

```javascript
function isFilenameSafe(filename) {
  // 禁止的字符
  const dangerous = [
    '..',           // 路径遍历
    '~',            // Home 目录
    '\\',           // 反斜杠
    '\0',           // Null 字符
    '<', '>', '|',  // 系统命令
    ':', '*', '?',  // 通配符
    '"'             // 引号
  ]

  // 检查是否包含危险字符
  return !dangerous.some(char => filename.includes(char))
}
```

**安全规则**:
- ❌ 不允许路径遍历: `../../../etc/passwd`
- ❌ 不允许绝对路径: `/etc/passwd`
- ✅ 只允许简单文件名: `record.txt`, `show_notes.md`

**参考**: `pod2postUpload.js:59-63` (sanitizedPath)

---

#### **5.2 TaskId 验证**

```javascript
if (!task_id || !task_id.startsWith('pod2post_')) {
  return res.status(400).json({
    code: 400,
    success: false,
    message: '参数错误: task_id 格式不正确'
  })
}
```

**格式要求**:
- ✅ `pod2post_1757592663331_lsymdox`
- ❌ `pod2post_`
- ❌ `random_task_id`

**参考**: `pod2postAsync.js:119-125`

---

#### **5.3 内容大小限制**

```javascript
const MAX_CONTENT_SIZE = 10 * 1024 * 1024  // 10MB

if (content.length > MAX_CONTENT_SIZE) {
  return res.status(400).json({
    code: 400,
    success: false,
    message: `内容过大: 最大支持 ${MAX_CONTENT_SIZE / 1024 / 1024}MB`
  })
}
```

---

### **6. 完整文件路径计算**

```javascript
// 1. 获取用户模板路径
const templatePath = userService.getUserTemplatePath(username, 'pod2post')
// → /app/data/users/default/workspace/templates/pod2post

// 2. 拼接任务目录
const taskPath = path.join(templatePath, 'tasks', task_id)
// → /app/data/users/default/workspace/templates/pod2post/tasks/pod2post_1757592663331_lsymdox

// 3. 拼接文件路径
const filePath = path.join(taskPath, filename)
// → /app/data/users/default/workspace/templates/pod2post/tasks/pod2post_1757592663331_lsymdox/record.txt

// 4. 创建目录
await fs.mkdir(taskPath, { recursive: true })

// 5. 写入文件
await fs.writeFile(filePath, content, 'utf-8')
```

---

### **7. 与现有接口的对比**

| 特性 | 现有 upload 接口 | 新 write-text 接口 |
|------|----------------|------------------|
| **URL** | `/api/generate/pod2post/upload` | `/api/generate/pod2post/write-text` |
| **Content-Type** | `multipart/form-data` | `application/json` |
| **中间件** | `multer.single('file')` | 无需 multer |
| **参数位置** | query + formData | JSON body |
| **path 参数** | 必需（CDN/photos/resources） | ❌ 不需要（直接写入任务根目录） |
| **文件来源** | 用户上传的二进制文件 | 文本内容（JSON body） |
| **目标路径** | `tasks/{taskId}/{path}/` | `tasks/{taskId}/` |
| **适用场景** | 图片、文档上传 | 文本文件生成（record.txt, show_notes.md） |

---

### **8. 使用示例**

#### **示例 1: 使用 default 用户**

```bash
curl -X POST http://localhost:3000/api/generate/pod2post/write-text \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "pod2post_1757592663331_lsymdox",
    "filename": "record.txt",
    "content": "播客转录文本内容...\n这是第二行"
  }'
```

**结果**:
- 文件路径: `tasks/pod2post_1757592663331_lsymdox/record.txt`
- 用户: `default`

---

#### **示例 2: 使用指定用户 token**

```bash
curl -X POST http://localhost:3000/api/generate/pod2post/write-text \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer lijing-token-xyz789" \
  -d '{
    "task_id": "pod2post_1757592663331_lsymdox",
    "filename": "show_notes.md",
    "content": "# Show Notes\n\n嘉宾：曲晓英\n..."
  }'
```

**结果**:
- 文件路径: `users/lijing/workspace/templates/pod2post/tasks/pod2post_1757592663331_lsymdox/show_notes.md`
- 用户: `lijing`

---

#### **示例 3: Body 中传递 token**

```bash
curl -X POST http://localhost:3000/api/generate/pod2post/write-text \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "pod2post_1757592663331_lsymdox",
    "filename": "notes.txt",
    "content": "笔记内容",
    "token": "lijing-token-xyz789"
  }'
```

**认证优先级**:
1. Header `Authorization: Bearer <token>`
2. Body `token` 字段
3. 默认 `default` 用户

---

#### **示例 4: 覆盖已存在文件**

```bash
# 第一次写入
POST /api/generate/pod2post/write-text
{
  "task_id": "pod2post_xxx",
  "filename": "record.txt",
  "content": "初始内容"
}
# → 响应: { "isNew": true }

# 第二次写入（覆盖）
POST /api/generate/pod2post/write-text
{
  "task_id": "pod2post_xxx",
  "filename": "record.txt",
  "content": "更新后的内容"
}
# → 响应: { "isNew": false, "message": "文件覆盖成功" }
```

---

### **9. 错误处理**

| 错误场景 | HTTP 状态码 | 错误消息 |
|---------|------------|---------|
| task_id 格式错误 | 400 | `task_id 格式不正确` |
| filename 为空 | 400 | `filename 不能为空` |
| filename 不安全 | 400 | `filename 包含不安全字符` |
| content 为空 | 400 | `content 不能为空` |
| 目录创建失败 | 500 | `任务目录创建失败` |
| 文件写入失败 | 500 | `文件写入失败` |
| 用户不存在 | 401 | `无效的用户令牌` |

---

### **10. 目录结构示例**

#### **写入前**
```
templates/pod2post/tasks/
└── (空目录或其他任务)
```

#### **第一次调用接口**
```bash
POST /api/generate/pod2post/write-text
{
  "task_id": "pod2post_1757592663331_lsymdox",
  "filename": "record.txt",
  "content": "播客内容"
}
```

#### **写入后**
```
templates/pod2post/tasks/
└── pod2post_1757592663331_lsymdox/    ← 自动创建
    └── record.txt                      ← 新文件
```

#### **继续上传其他文件**
```bash
# 上传 show_notes.md
POST /api/generate/pod2post/write-text
{
  "task_id": "pod2post_1757592663331_lsymdox",
  "filename": "show_notes.md",
  "content": "# Show Notes..."
}

# 上传照片（使用现有 upload 接口）
POST /api/generate/pod2post/upload?path=photos&taskId=pod2post_1757592663331_lsymdox
FormData: file=封面顶部.png
```

#### **最终目录结构**
```
templates/pod2post/tasks/
└── pod2post_1757592663331_lsymdox/
    ├── record.txt          ← write-text 接口写入
    ├── show_notes.md       ← write-text 接口写入
    └── photos/             ← upload 接口上传
        ├── 封面顶部.png
        └── 封面底部.png
```

---

## 🔄 完整使用流程

### **场景**: 生成 Pod2Post 卡片

```javascript
// 1. 创建任务（客户端生成 taskId）
const taskId = `pod2post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
// → pod2post_1757592663331_lsymdox

// 2. 写入播客文本
await fetch('/api/generate/pod2post/write-text', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    task_id: taskId,
    filename: 'record.txt',
    content: podcast_text
  })
})

// 3. 写入 Show Notes
await fetch('/api/generate/pod2post/write-text', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    task_id: taskId,
    filename: 'show_notes.md',
    content: show_notes_text
  })
})

// 4. 上传照片（使用现有接口）
const formData = new FormData()
formData.append('file', photoFile)

await fetch(`/api/generate/pod2post/upload?path=photos&taskId=${taskId}`, {
  method: 'POST',
  body: formData
})

// 5. 提交生成任务
await fetch('/api/generate/pod2post/async', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    taskId: taskId,
    prompt: generation_prompt
  })
})
```

---

## 📊 与现有接口的集成

### **现有接口**

| 接口 | 功能 | 输入类型 |
|------|------|---------|
| `POST /api/generate/pod2post/upload` | 上传二进制文件 | multipart/form-data |
| `POST /api/generate/pod2post/cdn` | CDN 资源上传 | multipart/form-data |
| `POST /api/generate/pod2post/pic` | 照片上传 | multipart/form-data |
| `POST /api/generate/pod2post/resources` | 文档上传 | multipart/form-data |

### **新接口**

| 接口 | 功能 | 输入类型 |
|------|------|---------|
| `POST /api/generate/pod2post/write-text` | 写入文本文件 | application/json |

**互补性**:
- 现有接口: 处理用户上传的二进制文件（图片、PDF等）
- 新接口: 处理程序生成的文本内容（record.txt、notes.md等）

---

## 🛠️ 实现步骤

### **Step 1: 创建路由文件**

**位置**: `terminal-backend/src/routes/generate/pod2postWriteText.js`

**内容**: 参考上面的"完整代码结构"

---

### **Step 2: 注册路由**

**位置**: `terminal-backend/src/index.js` (或主路由文件)

```javascript
import pod2postWriteTextRouter from './routes/generate/pod2postWriteText.js'

app.use('/api/generate/pod2post/write-text', pod2postWriteTextRouter)
```

---

### **Step 3: 测试接口**

```bash
# 基础测试
curl -X POST http://localhost:3000/api/generate/pod2post/write-text \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "pod2post_test_123",
    "filename": "test.txt",
    "content": "测试内容"
  }'

# 验证文件
cat /app/data/users/default/workspace/templates/pod2post/tasks/pod2post_test_123/test.txt
# 输出: 测试内容

# 覆盖测试
curl -X POST http://localhost:3000/api/generate/pod2post/write-text \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "pod2post_test_123",
    "filename": "test.txt",
    "content": "更新后的内容"
  }'

# 验证覆盖
cat /app/data/users/default/workspace/templates/pod2post/tasks/pod2post_test_123/test.txt
# 输出: 更新后的内容
```

---

## 🎯 优化建议

### **1. 支持批量写入（可选）**

```javascript
POST /api/generate/pod2post/write-text/batch

{
  "task_id": "pod2post_xxx",
  "files": [
    { "filename": "record.txt", "content": "..." },
    { "filename": "notes.md", "content": "..." }
  ]
}
```

---

### **2. 支持子目录写入（可选）**

```javascript
{
  "task_id": "pod2post_xxx",
  "filename": "docs/notes.md",  // 支持子目录
  "content": "..."
}

// 保存到: tasks/pod2post_xxx/docs/notes.md
```

**实现**:
```javascript
const fileDir = path.dirname(filename)
const taskPath = await getTaskPath(username, task_id)
const targetDir = path.join(taskPath, fileDir)

await fs.mkdir(targetDir, { recursive: true })
```

---

### **3. 返回文件访问 URL**

```javascript
{
  "code": 200,
  "success": true,
  "data": {
    "filename": "record.txt",
    "url": "/data/users/default/workspace/templates/pod2post/tasks/pod2post_xxx/record.txt",
    "downloadUrl": "/api/generate/pod2post/write-text/download?task_id=pod2post_xxx&filename=record.txt"
  }
}
```

---

## 📋 实现清单

### **必需实现**
- [ ] 创建 `pod2postWriteText.js` 路由文件
- [ ] 实现 `getTaskPath()` 路径计算函数
- [ ] 实现 `isFilenameSafe()` 文件名验证函数
- [ ] 实现 POST 路由处理函数
- [ ] 集成 `authenticateUserOrDefault` 中间件
- [ ] 支持 token 参数（header 和 body）
- [ ] 实现文件写入逻辑（覆盖模式）
- [ ] 在主路由中注册新接口
- [ ] 添加日志输出

### **可选增强**
- [ ] 支持批量写入
- [ ] 支持子目录
- [ ] 添加内容大小限制
- [ ] 提供文件下载接口
- [ ] 添加文件编码检测

---

## 🔗 相关代码位置

| 功能 | 参考文件 | 关键行号 |
|------|---------|---------|
| **认证中间件** | `middleware/userAuth.js` | 80-119 |
| **用户 token 查找** | `services/userService.js` | 113-123 |
| **路径计算** | `routes/generate/pod2postUpload.js` | 55-72 |
| **文件写入** | `routes/generate/pod2postUpload.js` | 172 |
| **目录创建** | `routes/generate/pod2postUpload.js` | 164 |
| **Token 处理** | `routes/generate/pod2postAsync.js` | 100-111 |
| **TaskId 验证** | `routes/generate/pod2postAsync.js` | 118-125 |

---

## 总结

### **核心实现要点**

1. **路径计算**:
   ```javascript
   templatePath/tasks/{task_id}/{filename}
   ```

2. **用户认证**:
   ```javascript
   token (header) > token (body) > default 用户
   ```

3. **文件写入**:
   ```javascript
   fs.writeFile(filePath, content, 'utf-8')  // 自动覆盖
   ```

4. **目录创建**:
   ```javascript
   fs.mkdir(taskPath, { recursive: true })  // 自动创建多级目录
   ```

5. **安全验证**:
   - TaskId 格式验证
   - 文件名安全检查
   - 内容大小限制

---

**实现难度**: ⭐⭐☆☆☆ (简单，复用现有逻辑)
**开发时间**: 约 1-2 小时
**测试时间**: 约 30 分钟
**总计**: 1.5-2.5 小时

---

**文档版本**: v1.0
**创建日期**: 2025-10-11
**设计目标**: 在 tasks 目录下写入文本文件的 RESTful API
