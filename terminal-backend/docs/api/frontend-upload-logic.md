# 前端文件上传逻辑分析

## 📋 目录
1. [上传流程概览](#上传流程概览)
2. [前端组件](#前端组件)
3. [API 接口](#api-接口)
4. [上传逻辑详解](#上传逻辑详解)
5. [后端接口](#后端接口)

---

## 上传流程概览

```
用户点击上传
    ↓
触发文件选择器
    ↓
用户选择文件
    ↓
处理文件名（替换空格、处理中文）
    ↓
构建 FormData
    ↓
调用后端 API: POST /api/assets/upload
    ↓
后端保存文件
    ↓
刷新文件列表
```

---

## 前端组件

### **主要组件**: `AssetManagerSimple.vue`

**位置**: `/mnt/d/work/AI_Terminal/terminal-ui/src/components/assets/AssetManagerSimple.vue`

#### **1. 上传按钮**

```vue
<!-- 第 6 行: 标题栏中的上传按钮 -->
<button class="upload-btn" @click="selectFiles">上传文件</button>

<!-- 第 29 行: 空状态的上传按钮 -->
<button class="upload-btn" @click="selectFiles">上传文件</button>

<!-- 第 87-92 行: 隐藏的文件输入框 -->
<input
  ref="fileInput"
  type="file"
  multiple
  style="display: none"
  @change="handleFileSelect"
>
```

---

## API 接口

### **API 文件**: `assets.js` 和 `assetsV2.js`

#### **1. assets.js** (第 90-109 行)

```javascript
/**
 * 上传文件
 * @param {FormData} formData - 包含文件的表单数据
 */
uploadAssets(formData) {
  // 添加用户ID
  formData.append('userId', getUserId())

  // 如果有category参数，转换为path
  const category = formData.get('category')
  if (category) {
    formData.delete('category')
    formData.append('path', category)
  }

  return request.post('/assets/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
}
```

**接口地址**: `POST /api/assets/upload`

**请求头**:
- `Content-Type: multipart/form-data`

**请求参数**:
- `files`: 文件对象（支持多文件）
- `path`: 上传路径（可选，默认根目录）
- `userId`: 用户ID（自动添加）
- `encoding`: 编码标记（UTF-8）

---

#### **2. assetsV2.js** (类似接口)

```javascript
/**
 * 批量上传文件
 */
uploadBatch(formData) {
  formData.append('userId', getUserId())

  return request.post('/assets/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
}
```

---

## 上传逻辑详解

### **核心函数**: `handleFileSelect` (AssetManagerSimple.vue: 679-726行)

```javascript
const handleFileSelect = async (event) => {
  // 1. 获取选择的文件
  const files = Array.from(event.target.files)
  if (files.length === 0) return

  try {
    const formData = new FormData()

    // 2. 处理每个文件
    files.forEach(file => {
      // 2.1 替换文件名中的空格为下划线
      let fileName = file.name.replace(/\s+/g, '_')

      // 2.2 处理包含非ASCII字符的文件名（中文等）
      if (fileName && /[^\x00-\x7F]/.test(fileName)) {
        console.log('[AssetManager] Original filename:', file.name, '-> Processed:', fileName)
        formData.append('files', file, fileName)
      } else {
        console.log('[AssetManager] Original filename:', file.name, '-> Processed:', fileName)
        formData.append('files', file, fileName)
      }
    })

    // 3. 添加上传路径（当前目录）
    if (currentCategory.value) {
      formData.append('path', currentCategory.value)
    }

    // 4. 添加编码标记
    formData.append('encoding', 'utf-8')

    // 5. 调用上传 API
    await assetsApiV2.uploadBatch(formData)

    // 6. 成功提示
    ElMessage.success('上传成功')

    // 7. 刷新文件列表
    loadData()

  } catch (error) {
    // 8. 错误处理
    if (error.response?.data?.error?.includes('已存在')) {
      ElMessage.error(error.response.data.error)
    } else {
      ElMessage.error('上传失败: ' + (error.response?.data?.error || error.message))
    }
  }

  // 9. 清空文件选择器
  event.target.value = ''
}
```

### **关键处理逻辑**

#### **1. 文件名处理**

```javascript
// 原始文件名: "我的 文件.jpg"
// 处理后: "我的_文件.jpg"

let fileName = file.name.replace(/\s+/g, '_')
```

**目的**: 避免文件名中的空格导致路径问题

---

#### **2. 中文文件名处理**

```javascript
// 检测非ASCII字符（中文等）
if (/[^\x00-\x7F]/.test(fileName)) {
  // 使用处理后的文件名
  formData.append('files', file, fileName)
}
```

**目的**:
- 正确处理中文文件名
- 添加 UTF-8 编码标记
- 避免乱码问题

---

#### **3. FormData 构建**

```javascript
// 示例：上传 2 个文件到 "作品集/项目A" 路径

const formData = new FormData()

// 文件1
formData.append('files', file1, '封面_图片.jpg')

// 文件2
formData.append('files', file2, '内容_文档.pdf')

// 上传路径
formData.append('path', '作品集/项目A')

// 编码标记
formData.append('encoding', 'utf-8')

// 用户ID（由 API 自动添加）
// formData.append('userId', 'default')
```

---

## 后端接口

### **接口地址**

```
POST /api/assets/upload
```

### **请求格式**

**Content-Type**: `multipart/form-data`

**参数**:

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `files` | File[] | ✅ | 上传的文件（支持多文件） |
| `path` | String | ❌ | 上传路径（默认根目录） |
| `userId` | String | ✅ | 用户ID（自动添加） |
| `encoding` | String | ❌ | 编码标记（UTF-8） |

### **响应格式**

**成功响应**:
```json
{
  "success": true,
  "message": "上传成功",
  "data": {
    "uploadedFiles": [
      {
        "fileName": "封面_图片.jpg",
        "path": "作品集/项目A/封面_图片.jpg",
        "size": 102400,
        "mimeType": "image/jpeg"
      }
    ]
  }
}
```

**失败响应**:
```json
{
  "success": false,
  "error": "文件已存在: 封面_图片.jpg"
}
```

---

## 后端实现位置

根据前端调用的接口，后端实现应该在：

```
/mnt/d/work/AI_Terminal/terminal-backend/src/routes/assets.js
```

**关键路由**:
```javascript
router.post('/upload', async (req, res) => {
  // 处理文件上传
  // 使用 multer 或其他中间件解析 multipart/form-data
  // 保存文件到用户目录
  // 返回上传结果
})
```

---

## 完整上传流程示例

### **场景**: 用户在 "作品集/项目A" 目录上传 2 个文件

#### **1. 用户操作**
```
用户点击 "上传文件" 按钮
  ↓
选择文件: "封面 图片.jpg", "内容文档.pdf"
  ↓
点击确认
```

#### **2. 前端处理**
```javascript
// 文件名处理
"封面 图片.jpg" → "封面_图片.jpg"
"内容文档.pdf" → "内容文档.pdf"

// 构建 FormData
formData.append('files', file1, '封面_图片.jpg')
formData.append('files', file2, '内容文档.pdf')
formData.append('path', '作品集/项目A')
formData.append('encoding', 'utf-8')
formData.append('userId', 'default')  // 自动添加
```

#### **3. HTTP 请求**
```http
POST /api/assets/upload
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary...

------WebKitFormBoundary...
Content-Disposition: form-data; name="files"; filename="封面_图片.jpg"
Content-Type: image/jpeg

[binary data]
------WebKitFormBoundary...
Content-Disposition: form-data; name="files"; filename="内容文档.pdf"
Content-Type: application/pdf

[binary data]
------WebKitFormBoundary...
Content-Disposition: form-data; name="path"

作品集/项目A
------WebKitFormBoundary...
Content-Disposition: form-data; name="encoding"

utf-8
------WebKitFormBoundary...
Content-Disposition: form-data; name="userId"

default
------WebKitFormBoundary...--
```

#### **4. 后端处理**
```
1. 解析 multipart/form-data
2. 验证用户权限
3. 创建目录（如果不存在）
4. 保存文件到: /data/users/default/workspace/assets/作品集/项目A/
5. 返回成功响应
```

#### **5. 前端响应**
```javascript
// 显示成功消息
ElMessage.success('上传成功')

// 刷新文件列表
loadData()  // 重新加载当前目录
```

---

## 特殊处理逻辑

### **1. 文件名冲突**

```javascript
// 后端检测文件已存在
if (existingFile) {
  return res.status(400).json({
    success: false,
    error: '文件已存在: 封面_图片.jpg'
  })
}

// 前端处理
if (error.response?.data?.error?.includes('已存在')) {
  ElMessage.error(error.response.data.error)
}
```

### **2. 中文编码处理**

```javascript
// 前端添加编码标记
formData.append('encoding', 'utf-8')

// 后端使用正确的编码读取文件名
const encoding = req.body.encoding || 'utf-8'
const fileName = Buffer.from(file.originalname, 'latin1').toString(encoding)
```

### **3. 路径处理**

```javascript
// 前端传递当前目录路径
if (currentCategory.value) {
  formData.append('path', currentCategory.value)
}

// 后端拼接完整路径
const uploadPath = path.join(userAssetsDir, req.body.path || '', fileName)
```

---

## 相关文件位置

| 文件 | 路径 | 功能 |
|------|------|------|
| **前端组件** | `terminal-ui/src/components/assets/AssetManagerSimple.vue` | 文件管理器UI和上传逻辑 |
| **API (旧版)** | `terminal-ui/src/api/assets.js` | 资源管理API（旧） |
| **API (新版)** | `terminal-ui/src/api/assetsV2.js` | 资源管理API（新） |
| **Composable** | `terminal-ui/src/composables/useAssets.js` | 资源管理逻辑封装 |
| **后端路由** | `terminal-backend/src/routes/assets.js` | 后端上传接口实现 |

---

## 总结

### **上传接口**
```
POST /api/assets/upload
```

### **请求参数**
- `files`: 文件对象（FormData）
- `path`: 上传路径
- `userId`: 用户ID
- `encoding`: UTF-8

### **核心处理**
1. ✅ 文件名空格替换为下划线
2. ✅ 中文文件名UTF-8编码
3. ✅ 支持多文件上传
4. ✅ 支持指定上传路径
5. ✅ 文件名冲突检测
6. ✅ 上传后自动刷新列表

---

**版本**: v1.0
**更新日期**: 2025-10-11
**前端框架**: Vue 3 + Element Plus
**上传组件**: AssetManagerSimple.vue
