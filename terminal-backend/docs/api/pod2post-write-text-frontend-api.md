# Pod2Post 文本写入接口 - 前端开发文档

## 📌 接口概述

**接口名称**: Pod2Post 文本文件写入接口
**接口地址**: `POST /api/generate/pod2post/write-text`
**功能说明**: 在 Pod2Post 任务的 card 目录下写入或修改文本文件
**适用场景**:
- 修改已生成任务的 content.json
- 添加自定义文本文件到任务目录
- 覆盖任务中的文本文件

---

## 🔗 接口详情

### **基本信息**

| 项目 | 内容 |
|------|------|
| **请求方法** | POST |
| **请求路径** | `/api/generate/pod2post/write-text` |
| **Content-Type** | `application/json` |
| **认证方式** | Bearer Token (可选) |
| **响应格式** | JSON |

---

## 📝 请求参数

### **Body 参数** (JSON)

| 参数名 | 类型 | 必填 | 说明 | 示例 |
|--------|------|------|------|------|
| `task_id` | String | ✅ | 任务ID，必须以 `pod2post_` 开头 | `"pod2post_1758008133493_mv40bwn"` |
| `filename` | String | ✅ | 文件名（带扩展名） | `"content.json"`, `"notes.txt"`, `"summary.md"` |
| `content` | String | ✅ | 文本内容（支持换行符 `\n`） | `"文件内容..."` |
| `token` | String | ❌ | 用户认证 token（可选） | `"user-token-abc123"` |

### **Header 参数** (可选)

| 参数名 | 类型 | 必填 | 说明 | 示例 |
|--------|------|------|------|------|
| `Authorization` | String | ❌ | Bearer Token (优先级高于 body.token) | `"Bearer user-token-abc123"` |

---

## 📤 请求示例

### **示例 1: 基础使用（修改 content.json）**

```javascript
const response = await fetch('http://localhost:8199/api/generate/pod2post/write-text', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    task_id: 'pod2post_1758008133493_mv40bwn',
    filename: 'content.json',
    content: JSON.stringify({
      social_content: {
        post_title: '新的标题',
        post_content: '新的内容',
        highlights: ['高光1', '高光2'],
        hashtags: ['#标签1', '#标签2']
      }
    }, null, 2)
  })
})

const result = await response.json()
console.log(result)
```

---

### **示例 2: 添加新文件**

```javascript
await fetch('http://localhost:8199/api/generate/pod2post/write-text', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    task_id: 'pod2post_1758008133493_mv40bwn',
    filename: 'notes.txt',
    content: '这是补充笔记\n第二行\n第三行'
  })
})
```

---

### **示例 3: 使用 Token 认证**

```javascript
// 方式1: Header 传递 (推荐)
await fetch('http://localhost:8199/api/generate/pod2post/write-text', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-user-token'
  },
  body: JSON.stringify({
    task_id: 'pod2post_xxx',
    filename: 'file.txt',
    content: '内容'
  })
})

// 方式2: Body 传递
await fetch('http://localhost:8199/api/generate/pod2post/write-text', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    task_id: 'pod2post_xxx',
    filename: 'file.txt',
    content: '内容',
    token: 'your-user-token'
  })
})
```

---

### **示例 4: Axios 调用**

```javascript
import axios from 'axios'

const writeTextToTask = async (taskId, filename, content) => {
  try {
    const response = await axios.post('/api/generate/pod2post/write-text', {
      task_id: taskId,
      filename: filename,
      content: content
    })

    if (response.data.success) {
      console.log('文件写入成功:', response.data.data)
      return response.data.data
    } else {
      throw new Error(response.data.message)
    }
  } catch (error) {
    console.error('写入失败:', error.message)
    throw error
  }
}

// 使用
await writeTextToTask(
  'pod2post_1758008133493_mv40bwn',
  'content.json',
  JSON.stringify(newContentData, null, 2)
)
```

---

## 📥 响应格式

### **成功响应** (HTTP 200)

```json
{
  "code": 200,
  "success": true,
  "message": "文件写入成功",
  "data": {
    "filename": "content.json",
    "path": "/app/data/users/default/workspace/card/pod2post_1758008133493_mv40bwn/content.json",
    "size": 1234,
    "isNew": false,
    "taskId": "pod2post_1758008133493_mv40bwn",
    "username": "default",
    "createdAt": "2025-09-16T07:40:00.000Z",
    "modifiedAt": "2025-10-11T13:34:22.429Z"
  }
}
```

**响应字段说明**:

| 字段 | 类型 | 说明 |
|------|------|------|
| `code` | Number | HTTP 状态码 |
| `success` | Boolean | 是否成功 |
| `message` | String | 操作结果消息（"文件写入成功" 或 "文件覆盖成功"） |
| `data.filename` | String | 文件名 |
| `data.path` | String | 服务器上的完整路径 |
| `data.size` | Number | 文件大小（字节） |
| `data.isNew` | Boolean | 是否为新文件（false 表示覆盖） |
| `data.taskId` | String | 任务 ID |
| `data.username` | String | 用户名 |
| `data.createdAt` | String | 创建时间（ISO 8601） |
| `data.modifiedAt` | String | 修改时间（ISO 8601） |

---

### **错误响应**

#### **400 - 参数错误**

```json
{
  "code": 400,
  "success": false,
  "message": "参数错误: task_id 格式不正确，应为 pod2post_{timestamp}_{random}"
}
```

**常见错误消息**:
- `"参数错误: task_id 格式不正确，应为 pod2post_{timestamp}_{random}"`
- `"参数错误: filename 不能为空"`
- `"参数错误: filename 包含不安全字符"`
- `"参数错误: content 不能为空"`
- `"参数错误: 内容过大，最大支持 10MB"`

---

#### **401 - 认证失败**

```json
{
  "code": 401,
  "success": false,
  "message": "无效的用户令牌"
}
```

---

#### **500 - 服务器错误**

```json
{
  "code": 500,
  "success": false,
  "message": "文件写入失败"
}
```

---

## 🎯 使用场景

### **场景 1: 修改已生成任务的 content.json**

```javascript
// 获取现有的 content.json
const existingContent = await fetchContentJson(taskId)

// 修改数据
existingContent.social_content.post_title = '修改后的标题'

// 写回文件
await fetch('/api/generate/pod2post/write-text', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    task_id: taskId,
    filename: 'content.json',
    content: JSON.stringify(existingContent, null, 2)
  })
})
```

---

### **场景 2: 批量写入多个文件**

```javascript
const files = [
  { filename: 'notes.txt', content: '笔记内容' },
  { filename: 'summary.md', content: '# 总结\n...' },
  { filename: 'metadata.json', content: JSON.stringify({...}) }
]

for (const file of files) {
  await fetch('/api/generate/pod2post/write-text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task_id: 'pod2post_xxx',
      filename: file.filename,
      content: file.content
    })
  })
}
```

---

### **场景 3: 创建新任务并写入文件**

```javascript
// 1. 生成任务 ID
const taskId = `pod2post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

// 2. 写入文件
await fetch('/api/generate/pod2post/write-text', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    task_id: taskId,
    filename: 'custom_data.json',
    content: JSON.stringify({ data: 'value' })
  })
})

// 3. 任务目录已创建，前端可以访问
// 路径: /api/generate/pod2post/content/${taskId}
```

---

## ⚠️ 注意事项

### **1. 文件名限制**

**允许的字符**:
- ✅ 字母、数字: `a-z A-Z 0-9`
- ✅ 下划线、连字符: `_ -`
- ✅ 点号（扩展名）: `.`
- ✅ 中文字符

**禁止的字符**:
- ❌ 路径遍历: `..`
- ❌ 特殊字符: `\ / : * ? " < > |`
- ❌ 波浪号: `~`

**示例**:
```javascript
✅ "content.json"
✅ "show_notes_v2.md"
✅ "播客笔记.txt"
❌ "../../../etc/passwd"
❌ "file:name.txt"
❌ "path/to/file.txt"  // 不支持子目录
```

---

### **2. Task ID 格式**

**必须格式**: `pod2post_{timestamp}_{random}`

**示例**:
```javascript
✅ "pod2post_1758008133493_mv40bwn"
✅ "pod2post_1757592663331_lsymdox"
❌ "task_123"
❌ "pod2post_"
❌ "pod2post_abc"
```

**生成方法**:
```javascript
const taskId = `pod2post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
```

---

### **3. 内容大小限制**

- **最大大小**: 10 MB
- **超过限制**: 返回 400 错误
- **建议**: 单个文件 < 1 MB

---

### **4. 文件覆盖行为**

- **文件不存在**: 创建新文件，返回 `isNew: true`
- **文件已存在**: 完全覆盖（非追加），返回 `isNew: false`
- **无确认提示**: 直接覆盖，请前端自行确认

---

### **5. 认证优先级**

```
优先级 1: Header Authorization
  ↓ (未提供或无效)
优先级 2: Body token 字段
  ↓ (未提供或无效)
优先级 3: 默认 default 用户
```

---

## 🛠️ 前端封装建议

### **Vue 3 Composable**

```javascript
// composables/usePod2PostWriteText.js
import { ref } from 'vue'
import axios from 'axios'

export function usePod2PostWriteText() {
  const loading = ref(false)
  const error = ref(null)

  const writeTextFile = async (taskId, filename, content, token = null) => {
    loading.value = true
    error.value = null

    try {
      const payload = {
        task_id: taskId,
        filename: filename,
        content: content
      }

      if (token) {
        payload.token = token
      }

      const response = await axios.post(
        '/api/generate/pod2post/write-text',
        payload
      )

      if (response.data.success) {
        return response.data.data
      } else {
        throw new Error(response.data.message)
      }
    } catch (err) {
      error.value = err.response?.data?.message || err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  const updateContentJson = async (taskId, contentData) => {
    const jsonString = JSON.stringify(contentData, null, 2)
    return writeTextFile(taskId, 'content.json', jsonString)
  }

  return {
    loading,
    error,
    writeTextFile,
    updateContentJson
  }
}
```

**使用示例**:

```vue
<script setup>
import { usePod2PostWriteText } from '@/composables/usePod2PostWriteText'

const { writeTextFile, updateContentJson, loading, error } = usePod2PostWriteText()

// 修改 content.json
const handleUpdateContent = async () => {
  try {
    const newContent = {
      social_content: {
        post_title: '新标题',
        post_content: '新内容',
        highlights: ['高光1', '高光2'],
        hashtags: ['#标签1', '#标签2']
      }
    }

    await updateContentJson('pod2post_1758008133493_mv40bwn', newContent)
    alert('修改成功')
  } catch (err) {
    alert('修改失败: ' + err.message)
  }
}

// 添加自定义文件
const handleAddNotes = async () => {
  await writeTextFile(
    'pod2post_1758008133493_mv40bwn',
    'notes.txt',
    '这是补充笔记内容'
  )
}
</script>
```

---

### **React Hook**

```javascript
// hooks/usePod2PostWriteText.js
import { useState } from 'react'
import axios from 'axios'

export const usePod2PostWriteText = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const writeTextFile = async (taskId, filename, content, token = null) => {
    setLoading(true)
    setError(null)

    try {
      const payload = {
        task_id: taskId,
        filename,
        content
      }

      if (token) {
        payload.token = token
      }

      const response = await axios.post(
        '/api/generate/pod2post/write-text',
        payload
      )

      if (response.data.success) {
        return response.data.data
      } else {
        throw new Error(response.data.message)
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message
      setError(errorMsg)
      throw new Error(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  return { writeTextFile, loading, error }
}
```

---

## 🔍 错误处理

### **完整错误处理示例**

```javascript
const handleWriteFile = async (taskId, filename, content) => {
  try {
    const response = await fetch('/api/generate/pod2post/write-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: taskId, filename, content })
    })

    const result = await response.json()

    if (!response.ok || !result.success) {
      // 根据错误码处理
      switch (result.code) {
        case 400:
          alert(`参数错误: ${result.message}`)
          break
        case 401:
          alert('认证失败，请重新登录')
          // 跳转登录页
          break
        case 500:
          alert('服务器错误，请稍后重试')
          break
        default:
          alert(`未知错误: ${result.message}`)
      }
      return null
    }

    // 成功处理
    console.log('文件写入成功:', result.data)
    return result.data

  } catch (error) {
    // 网络错误
    console.error('网络请求失败:', error)
    alert('网络连接失败，请检查网络')
    return null
  }
}
```

---

## 📊 常见错误码

| 状态码 | 说明 | 原因 | 解决方法 |
|-------|------|------|---------|
| 200 | 成功 | - | - |
| 400 | 参数错误 | task_id 格式不正确 | 检查 taskId 格式：`pod2post_{timestamp}_{random}` |
| 400 | 参数错误 | filename 包含不安全字符 | 移除特殊字符，如 `../`, `:`, `*` 等 |
| 400 | 参数错误 | content 为空 | 确保 content 不为 null 或 undefined |
| 400 | 参数错误 | 内容过大 | 减少内容大小（最大 10MB） |
| 401 | 认证失败 | token 无效 | 检查 token 是否正确或使用 default 用户 |
| 500 | 服务器错误 | 文件写入失败 | 检查服务器日志，联系后端 |

---

## 🎨 完整业务示例

### **场景: 编辑 Pod2Post 内容**

```vue
<template>
  <div class="edit-content">
    <h3>编辑 Pod2Post 内容</h3>

    <div class="form-group">
      <label>标题</label>
      <input v-model="editForm.post_title" />
    </div>

    <div class="form-group">
      <label>内容</label>
      <textarea v-model="editForm.post_content"></textarea>
    </div>

    <div class="form-group">
      <label>高光总结（每行一条）</label>
      <textarea v-model="highlightsText"></textarea>
    </div>

    <button @click="handleSave" :disabled="saving">
      {{ saving ? '保存中...' : '保存' }}
    </button>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { usePod2PostWriteText } from '@/composables/usePod2PostWriteText'
import { ElMessage } from 'element-plus'

const props = defineProps({
  taskId: { type: String, required: true },
  initialContent: { type: Object, required: true }
})

const { writeTextFile } = usePod2PostWriteText()
const saving = ref(false)

// 表单数据
const editForm = ref({
  post_title: props.initialContent.social_content.post_title,
  post_content: props.initialContent.social_content.post_content
})

const highlightsText = ref(
  props.initialContent.social_content.highlights.join('\n')
)

// 保存修改
const handleSave = async () => {
  saving.value = true

  try {
    // 构建新的 content 对象
    const newContent = {
      social_content: {
        post_title: editForm.value.post_title,
        post_content: editForm.value.post_content,
        highlights: highlightsText.value.split('\n').filter(h => h.trim()),
        hashtags: props.initialContent.social_content.hashtags
      }
    }

    // 写入文件
    await writeTextFile(
      props.taskId,
      'content.json',
      JSON.stringify(newContent, null, 2)
    )

    ElMessage.success('保存成功')

  } catch (error) {
    ElMessage.error('保存失败: ' + error.message)
  } finally {
    saving.value = false
  }
}
</script>
```

---

## 🔗 相关接口

| 接口 | 用途 |
|------|------|
| `POST /api/generate/pod2post/async` | 生成 Pod2Post 卡片 |
| `GET /api/generate/pod2post/status/:taskId` | 查询任务状态 |
| `GET /api/generate/pod2post/content/:taskId` | 获取任务内容 |
| `POST /api/generate/pod2post/write-text` | 写入/修改文本文件 ⭐ |

---

## 📝 TypeScript 类型定义

```typescript
// types/pod2post.ts

export interface WriteTextRequest {
  task_id: string
  filename: string
  content: string
  token?: string
}

export interface WriteTextResponse {
  code: number
  success: boolean
  message: string
  data: {
    filename: string
    path: string
    size: number
    isNew: boolean
    taskId: string
    username: string
    createdAt: string
    modifiedAt: string
  }
}

export interface ErrorResponse {
  code: number
  success: false
  message: string
}

// 使用示例
const writeText = async (
  request: WriteTextRequest
): Promise<WriteTextResponse> => {
  const response = await fetch('/api/generate/pod2post/write-text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  })
  return response.json()
}
```

---

## 📖 快速参考

### **最小请求示例**

```javascript
fetch('/api/generate/pod2post/write-text', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    task_id: 'pod2post_1758008133493_mv40bwn',
    filename: 'content.json',
    content: '{...}'
  })
})
```

### **响应判断**

```javascript
if (response.data.success) {
  // 成功
  const isNewFile = response.data.data.isNew
  console.log(isNewFile ? '新文件创建成功' : '文件覆盖成功')
} else {
  // 失败
  console.error('错误:', response.data.message)
}
```

---

## 🚀 生产环境配置

### **API Base URL**

```javascript
// 开发环境
const API_BASE = 'http://localhost:8199'

// 生产环境
const API_BASE = 'https://your-domain.com'

// 完整 URL
const WRITE_TEXT_URL = `${API_BASE}/api/generate/pod2post/write-text`
```

### **超时配置**

```javascript
const response = await fetch('/api/generate/pod2post/write-text', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({...}),
  signal: AbortSignal.timeout(30000)  // 30秒超时
})
```

---

## 📞 技术支持

**接口版本**: v1.0.1
**最后更新**: 2025-10-11
**后端文档**: `/terminal-backend/docs/api/pod2post-write-text-api.md`

**问题反馈**:
- 参数错误: 检查 task_id 和 filename 格式
- 认证失败: 检查 token 是否正确
- 文件未显示: 确认 task_id 正确，刷新前端

---

## ✅ 测试清单

在集成前端前，请确认：

- [ ] 能成功写入新文件
- [ ] 能成功覆盖已存在文件
- [ ] 错误参数返回 400 错误
- [ ] 响应格式符合预期
- [ ] 文件在 card 目录下可见
- [ ] 支持中文文件名和内容
- [ ] 支持 JSON 格式内容

---

**快速测试命令** (curl):
```bash
curl -X POST http://localhost:8199/api/generate/pod2post/write-text \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "pod2post_1758008133493_mv40bwn",
    "filename": "test.txt",
    "content": "测试内容"
  }'
```
