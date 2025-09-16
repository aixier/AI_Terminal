# htmlPath 传递链路设计

## 一、数据流向

```
文件列表API → 前端存储 → 编辑按钮 → HtmlEditModal → 提交修改API
```

## 二、详细链路

### 1. 文件列表获取阶段

**API**: `GET /api/card/files` 或 `GET /api/workspace/files`

**响应数据结构**:
```json
{
  "files": [
    {
      "id": "file_123456",
      "name": "content_ossurl.html",
      "path": "/terminal-backend/data/users/default/workspace/card/pod_demo/content_ossurl.html",
      "absolutePath": "/mnt/d/work/AI_Terminal/terminal-backend/data/users/default/workspace/card/pod_demo/content_ossurl.html",
      "type": "html",
      "size": 12345,
      "modified": "2024-01-15T10:30:00Z",
      "folderId": "folder_789",
      "folderName": "pod_demo",
      "permissions": {
        "read": true,
        "write": true,
        "delete": true
      }
    }
  ]
}
```

### 2. 前端存储阶段

#### PortfolioPage.vue
```javascript
// 文件数据存储
const fileList = ref([])
const selectedFile = ref(null)

// 获取文件列表
const fetchFiles = async () => {
  const response = await api.getWorkspaceFiles(folderId)
  fileList.value = response.files
}

// 选择文件时保存完整信息
const selectFile = (file) => {
  selectedFile.value = {
    ...file,
    htmlPath: file.absolutePath  // 保存服务端返回的绝对路径
  }
}
```

#### HtmlMessageCard.vue
```javascript
// 从props或API响应中获取
const props = defineProps({
  resultData: {
    type: Object,
    default: () => ({
      htmlPath: '',      // 服务端返回的路径
      fileId: '',        // 文件ID
      htmlContent: ''    // HTML内容
    })
  }
})

// 或从消息数据中获取
const messageData = computed(() => {
  return {
    htmlPath: props.resultData.metadata?.filePath,
    fileId: props.resultData.metadata?.fileId,
    content: props.resultData.content
  }
})
```

### 3. 传递给编辑组件

```javascript
// 点击编辑按钮时
const handleEditHtml = () => {
  editModalProps.value = {
    htmlContent: processedHtml.value,
    htmlPath: selectedFile.value?.htmlPath || messageData.value?.htmlPath,
    fileId: selectedFile.value?.id || messageData.value?.fileId,
    folderId: selectedFile.value?.folderId
  }
  showEditModal.value = true
}
```

### 4. HtmlEditModal组件接收

```vue
<!-- HtmlEditModal.vue -->
<script setup>
const props = defineProps({
  modelValue: Boolean,
  htmlContent: String,
  htmlPath: String,      // 接收服务端的文件路径
  fileId: String,        // 接收文件ID
  folderId: String,      // 接收文件夹ID
  title: String
})

// 提交修改时使用
const handleApply = async () => {
  const requestData = {
    htmlPath: props.htmlPath,  // 使用props传入的路径
    fileId: props.fileId,       // 使用props传入的ID
    folderId: props.folderId,
    elements: selectedElements.value,
    request: editRequest.value,
    timestamp: Date.now()
  }

  // 调用API
  const response = await api.editHtml(requestData)
}
</script>
```

## 三、完整示例

### 3.1 PortfolioPage使用场景

```vue
<template>
  <!-- 文件列表 -->
  <div v-for="file in fileList" :key="file.id">
    <button @click="handleEdit(file)">编辑</button>
  </div>

  <!-- 编辑模态框 -->
  <HtmlEditModal
    v-model="showEditModal"
    :html-content="editingFile?.content"
    :html-path="editingFile?.absolutePath"
    :file-id="editingFile?.id"
    :folder-id="editingFile?.folderId"
    @apply="handleEditApply"
  />
</template>

<script setup>
const editingFile = ref(null)

const handleEdit = async (file) => {
  // 先获取文件内容
  const content = await api.getFileContent(file.id)

  editingFile.value = {
    ...file,
    content: content.html
  }

  showEditModal.value = true
}

const handleEditApply = async (data) => {
  // data中已包含htmlPath等信息
  const result = await api.editHtml(data)
}
</script>
```

### 3.2 HtmlMessageCard使用场景

```vue
<template>
  <MessageCard>
    <button @click="handleEditHtml">编辑</button>

    <HtmlEditModal
      v-model="showEditModal"
      :html-content="htmlContent"
      :html-path="htmlMetadata.filePath"
      :file-id="htmlMetadata.fileId"
      @apply="handleEditApply"
    />
  </MessageCard>
</template>

<script setup>
// 从消息元数据中获取路径信息
const htmlMetadata = computed(() => {
  return {
    filePath: props.resultData?.metadata?.filePath,
    fileId: props.resultData?.metadata?.fileId,
    folderId: props.resultData?.metadata?.folderId
  }
})

const handleEditHtml = () => {
  if (!htmlMetadata.value.filePath) {
    ElMessage.warning('文件路径信息缺失，无法编辑')
    return
  }
  showEditModal.value = true
}
</script>
```

## 四、后端API设计

### 4.1 文件信息API

```javascript
// 获取文件详情
router.get('/api/files/:fileId', async (req, res) => {
  const file = await fileService.getFile(req.params.fileId)

  res.json({
    id: file.id,
    name: file.name,
    absolutePath: file.getAbsolutePath(),  // 服务端生成绝对路径
    relativePath: file.relativePath,
    content: file.content,
    metadata: {
      size: file.size,
      modified: file.modifiedAt,
      permissions: file.permissions
    }
  })
})
```

### 4.2 编辑API验证

```javascript
router.post('/api/html/edit', async (req, res) => {
  const { htmlPath, fileId, elements, request } = req.body

  // 验证路径和ID的一致性
  const file = await fileService.getFile(fileId)
  if (file.absolutePath !== htmlPath) {
    return res.status(400).json({
      error: 'Path mismatch'
    })
  }

  // 验证用户权限
  if (!await hasPermission(req.user, file)) {
    return res.status(403).json({
      error: 'Permission denied'
    })
  }

  // 处理编辑请求
  const result = await editService.processEdit({
    filePath: file.absolutePath,
    elements,
    request
  })

  res.json(result)
})
```

## 五、安全考虑

### 5.1 路径验证

```javascript
// 后端必须验证路径
const validatePath = (htmlPath, userId) => {
  // 确保路径在用户的工作空间内
  const userWorkspace = `/terminal-backend/data/users/${userId}/workspace/`

  if (!htmlPath.startsWith(userWorkspace)) {
    throw new Error('Invalid path: outside user workspace')
  }

  // 防止路径遍历攻击
  if (htmlPath.includes('../') || htmlPath.includes('..\\')) {
    throw new Error('Invalid path: path traversal detected')
  }

  return true
}
```

### 5.2 权限检查

```javascript
const checkFileAccess = async (userId, fileId, htmlPath) => {
  // 通过fileId查询数据库
  const file = await db.files.findOne({ id: fileId })

  // 验证文件所有者
  if (file.userId !== userId) {
    throw new Error('Access denied')
  }

  // 验证路径一致性
  if (file.path !== htmlPath) {
    throw new Error('Path mismatch')
  }

  return true
}
```

## 六、错误处理

### 6.1 路径缺失处理

```javascript
// 前端
const handleEditClick = () => {
  if (!fileData.htmlPath) {
    // 尝试通过fileId获取
    fetchFilePath(fileData.id).then(path => {
      fileData.htmlPath = path
      openEditModal()
    }).catch(err => {
      ElMessage.error('无法获取文件路径')
    })
  } else {
    openEditModal()
  }
}
```

### 6.2 路径验证失败

```javascript
// 后端
if (!isValidPath(htmlPath)) {
  return res.status(400).json({
    error: 'Invalid file path',
    code: 'INVALID_PATH',
    details: 'The provided path is not accessible'
  })
}
```

## 七、总结

1. **htmlPath来源**: 始终从后端API获取，不在前端硬编码
2. **传递方式**: 通过props从父组件传递到HtmlEditModal
3. **验证机制**: 后端验证路径合法性和用户权限
4. **安全保障**: 防止路径遍历和越权访问
5. **容错处理**: 路径缺失时的降级方案

这样设计确保了：
- ✅ 路径信息的安全性
- ✅ 用户权限的正确验证
- ✅ 防止恶意路径访问
- ✅ 前后端数据一致性