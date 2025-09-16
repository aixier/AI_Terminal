# HtmlEditModal 独立化方案设计

## 1. 背景与需求

### 1.1 当前状况
- HtmlEditModal 组件与 PortfolioPage 耦合度较高
- 需要手动传递 HTML 内容和路径
- 修改后的文件处理不够自动化
- 缺少与 OSS 和 meta 文件的联动

### 1.2 目标
- 让 HtmlEditModal 成为独立的编辑器组件
- 自动从 pod2post 的 meta 文件获取必要信息
- 支持 OSS URL 加载和更新
- 保持文件路径用于 AI 修改定位

## 2. 架构设计

### 2.1 数据流程图

```
┌─────────────────────────────────────────────────────────────────┐
│                      PortfolioPage.vue                          │
│                                                                  │
│  1. 点击编辑按钮 ──────────────────────────────────────────┐   │
│                                                              ↓   │
│  2. 调用 /api/generate/pod2post/content/{folderName} ←──────┘   │
│                                                                  │
│  3. 获取 meta 数据（包含路径和 OSS URL）                        │
└──────────────────────────────────────────────────────────────────┘
                                   ↓
┌─────────────────────────────────────────────────────────────────┐
│                      HtmlEditModal                               │
│                                                                  │
│  4. 接收配置对象：                                              │
│     - folderName: "pod2post_xxx"                                │
│     - htmlPath: "/app/data/.../content_ossurl.html"             │
│     - ossUrl: "https://oss.../content_ossurl.html"              │
│     - metaPath: "/app/data/.../pod2post_xxx_meta.json"          │
│                                                                  │
│  5. 通过 OSS URL 加载 HTML 内容（iframe/预览）                  │
│                                                                  │
│  6. 用户选择元素并输入修改需求                                  │
│                                                                  │
│  7. 提交修改请求（包含绝对路径）到 /api/html/edit              │
└──────────────────────────────────────────────────────────────────┘
                                   ↓
┌─────────────────────────────────────────────────────────────────┐
│                    后端处理流程                                  │
│                                                                  │
│  8. AI 修改文件（使用绝对路径）                                 │
│                                                                  │
│  9. 自动上传到 OSS (/api/pod2post/upload-oss)                  │
│                                                                  │
│  10. 更新 meta 文件（新的 OSS URL 和时间戳）                   │
│                                                                  │
│  11. 返回新的 OSS URL                                          │
└──────────────────────────────────────────────────────────────────┘
                                   ↓
┌─────────────────────────────────────────────────────────────────┐
│                 HtmlEditModal（更新视图）                        │
│                                                                  │
│  12. 接收新的 OSS URL                                           │
│                                                                  │
│  13. 重新加载 iframe 显示更新后的内容                           │
│                                                                  │
│  14. 显示修改成功提示                                           │
└──────────────────────────────────────────────────────────────────┘
```

## 3. 核心组件设计

### 3.1 PortfolioPage 调用方式

```javascript
// PortfolioPage.vue
methods: {
  // 编辑按钮点击事件
  async handleEdit(folderName, fileType = 'ossurl') {
    try {
      // 1. 获取 pod2post 内容和 meta 信息
      const response = await fetch(`/api/generate/pod2post/content/${folderName}`)
      const result = await response.json()

      if (!result.success) {
        throw new Error('获取内容失败')
      }

      // 2. 从返回数据中提取必要信息
      const { content, folderPath } = result.data

      // 3. 根据文件类型选择对应的文件
      let targetFile = null
      let targetOssUrl = null

      if (fileType === 'ossurl') {
        // OSS URL 版本（轻量级）
        targetFile = content.generatedFiles?.ossUrl || 'content_ossurl.html'
        targetOssUrl = content.ossUrlHtmlOssUrl
      } else if (fileType === 'base64') {
        // Base64 版本
        targetFile = content.generatedFiles?.withBase64 || 'content_base64.html'
        targetOssUrl = content.base64HtmlOssUrl
      } else {
        // 原始版本
        targetFile = content.generatedFiles?.original || 'content.html'
        targetOssUrl = content.originalHtmlOssUrl
      }

      // 4. 构建编辑配置
      const editConfig = {
        // 任务标识
        folderName: folderName,
        taskId: content.metadata?.custom?.taskId || folderName,

        // 文件路径（绝对路径，用于 AI 修改）
        htmlPath: `${folderPath}/${targetFile}`,

        // OSS URL（用于加载显示）
        ossUrl: targetOssUrl,

        // Meta 文件路径（用于更新）
        metaPath: `${folderPath}/${folderName}_meta.json`,

        // 文件类型标识
        fileType: fileType,

        // 用户信息
        username: this.username || 'default',

        // 回调函数
        onSuccess: this.handleEditSuccess,
        onError: this.handleEditError
      }

      // 5. 打开编辑器
      this.showEditModal = true
      this.editModalConfig = editConfig

    } catch (error) {
      console.error('打开编辑器失败:', error)
      this.$message.error('打开编辑器失败')
    }
  },

  // 编辑成功回调
  handleEditSuccess(result) {
    console.log('编辑成功:', result)
    this.$message.success('修改已保存')

    // 可选：刷新文件列表
    if (result.newOssUrl) {
      // 更新本地显示
      this.updateFileDisplay(result)
    }
  },

  // 编辑失败回调
  handleEditError(error) {
    console.error('编辑失败:', error)
    this.$message.error('修改失败: ' + error.message)
  }
}
```

### 3.2 HtmlEditModal 组件改造

```vue
<!-- HtmlEditModal/index.vue -->
<template>
  <el-dialog
    v-model="visible"
    :title="dialogTitle"
    width="90%"
    :close-on-click-modal="false"
  >
    <!-- 顶部信息栏 -->
    <div class="edit-info-bar">
      <el-tag>{{ config.folderName }}</el-tag>
      <el-tag type="info">{{ config.fileType }}</el-tag>
      <span class="sync-status">
        <i :class="syncStatusIcon"></i>
        {{ syncStatusText }}
      </span>
    </div>

    <!-- 现有的工具栏和编辑区域 -->
    <!-- ... existing toolbar and edit area ... -->

  </el-dialog>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'

const props = defineProps({
  visible: Boolean,
  config: {
    type: Object,
    required: true
    // config 包含:
    // - folderName: pod2post 文件夹名
    // - htmlPath: HTML 文件绝对路径
    // - ossUrl: OSS URL 用于加载
    // - metaPath: meta 文件路径
    // - fileType: 文件类型
    // - onSuccess: 成功回调
    // - onError: 错误回调
  }
})

// 状态管理
const isLoading = ref(false)
const isSyncing = ref(false)
const currentOssUrl = ref('')
const localFilePath = ref('')

// 计算属性
const dialogTitle = computed(() => {
  if (!props.config) return 'HTML 编辑器'
  return `编辑 - ${props.config.folderName} (${props.config.fileType})`
})

const syncStatusIcon = computed(() => {
  if (isSyncing.value) return 'el-icon-loading'
  return 'el-icon-success'
})

const syncStatusText = computed(() => {
  if (isSyncing.value) return '同步中...'
  return '已同步到 OSS'
})

// 监听配置变化
watch(() => props.config, async (newConfig) => {
  if (newConfig && newConfig.ossUrl) {
    await loadFromOssUrl(newConfig.ossUrl)
    localFilePath.value = newConfig.htmlPath
  }
}, { immediate: true })

// 从 OSS URL 加载内容
async function loadFromOssUrl(ossUrl) {
  if (!ossUrl) {
    console.warn('No OSS URL provided')
    return
  }

  isLoading.value = true
  currentOssUrl.value = ossUrl

  try {
    // 直接使用 OSS URL 加载到 iframe
    if (iframeRef.value) {
      iframeRef.value.src = ossUrl
      console.log('Loaded content from OSS:', ossUrl)
    }
  } catch (error) {
    console.error('Failed to load from OSS:', error)
    props.config.onError?.(error)
  } finally {
    isLoading.value = false
  }
}

// 提交编辑请求（重写）
async function submitEditRequest() {
  if (!selectedElements.value.length) {
    ElMessage.warning('请先选择要编辑的元素')
    return
  }

  if (!editRequest.value.trim()) {
    ElMessage.warning('请输入修改需求')
    return
  }

  try {
    isSyncing.value = true

    // 1. 提交修改请求（使用绝对路径）
    const editResponse = await fetch('/api/html/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        htmlPath: localFilePath.value,  // 使用绝对路径
        fileId: props.config.taskId,
        folderId: props.config.folderName,
        elements: selectedElements.value,
        request: editRequest.value
      })
    })

    const editResult = await editResponse.json()

    if (!editResult.success) {
      throw new Error(editResult.error || '修改失败')
    }

    // 2. 开始轮询任务状态
    const taskId = editResult.taskId
    await pollTaskStatus(taskId)

  } catch (error) {
    console.error('Submit edit error:', error)
    ElMessage.error('提交失败: ' + error.message)
    props.config.onError?.(error)
  } finally {
    isSyncing.value = false
  }
}

// 轮询任务状态
async function pollTaskStatus(taskId) {
  const maxAttempts = 60  // 最多等待 3 分钟
  let attempts = 0

  while (attempts < maxAttempts) {
    try {
      const response = await fetch(`/api/html/edit/status/${taskId}`)
      const status = await response.json()

      if (status.status === 'completed') {
        // 3. 修改完成，触发 OSS 上传
        await uploadToOssAndUpdateMeta()
        return
      } else if (status.status === 'failed') {
        throw new Error(status.error || '修改失败')
      }

      // 继续等待
      await new Promise(resolve => setTimeout(resolve, 3000))
      attempts++

    } catch (error) {
      console.error('Poll status error:', error)
      throw error
    }
  }

  throw new Error('修改超时')
}

// 上传到 OSS 并更新 meta
async function uploadToOssAndUpdateMeta() {
  try {
    isSyncing.value = true

    // 调用专门的 OSS 更新接口
    const response = await fetch('/api/pod2post/update-oss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        folderName: props.config.folderName,
        fileName: props.config.htmlPath.split('/').pop(),
        fileType: props.config.fileType,
        metaPath: props.config.metaPath
      })
    })

    const result = await response.json()

    if (!result.success) {
      throw new Error(result.error || 'OSS 更新失败')
    }

    // 4. 获取新的 OSS URL
    const newOssUrl = result.data.newOssUrl

    // 5. 重新加载显示
    await loadFromOssUrl(newOssUrl)

    // 6. 清空选区和输入
    clearSelections()
    editRequest.value = ''

    // 7. 显示成功提示
    ElMessage.success('修改已成功并同步到 OSS')

    // 8. 调用成功回调
    props.config.onSuccess?.({
      taskId: props.config.taskId,
      newOssUrl: newOssUrl,
      fileName: props.config.htmlPath.split('/').pop(),
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('OSS update error:', error)
    ElMessage.error('OSS 同步失败: ' + error.message)
    props.config.onError?.(error)
  } finally {
    isSyncing.value = false
  }
}
</script>
```

## 4. 后端接口设计

### 4.1 新增 OSS 更新接口

```javascript
// /api/pod2post/update-oss
router.post('/update-oss', async (req, res) => {
  const { folderName, fileName, fileType, metaPath } = req.body

  try {
    // 1. 读取修改后的文件
    const filePath = path.join(folderPath, fileName)
    const fileContent = await fs.readFile(filePath, 'utf8')

    // 2. 上传到 OSS
    const ossKey = `pod2post/${folderName}/${fileName}`
    const uploadResult = await ossService.upload(fileContent, ossKey)

    // 3. 生成新的签名 URL
    const newOssUrl = await ossService.getSignedUrl(ossKey)

    // 4. 更新 meta 文件
    const metaContent = await fs.readFile(metaPath, 'utf8')
    const metadata = JSON.parse(metaContent)

    // 更新对应的 URL
    if (fileType === 'ossurl') {
      metadata.custom.ossUpload.urls.ossUrlHtml = newOssUrl
    } else if (fileType === 'base64') {
      metadata.custom.ossUpload.urls.withBase64 = newOssUrl
    } else {
      metadata.custom.ossUpload.urls.originalHtml = newOssUrl
    }

    // 添加修改记录
    metadata.custom.modifications = metadata.custom.modifications || []
    metadata.custom.modifications.push({
      timestamp: new Date().toISOString(),
      fileName: fileName,
      fileType: fileType,
      newOssUrl: newOssUrl
    })

    // 保存 meta 文件
    await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2))

    res.json({
      success: true,
      data: {
        newOssUrl,
        updatedAt: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('OSS update error:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})
```

### 4.2 修改现有 html/edit 接口

保持现有逻辑不变，但确保：
1. 接受绝对路径参数
2. 文件修改完成后触发事件
3. 支持任务状态查询

## 5. 数据结构设计

### 5.1 编辑配置对象

```typescript
interface EditConfig {
  // 基础信息
  folderName: string        // pod2post_xxx
  taskId: string            // 任务 ID

  // 文件路径
  htmlPath: string          // 绝对路径：/app/data/.../content.html
  ossUrl: string            // OSS URL：https://oss.../content.html
  metaPath: string          // Meta 路径：/app/data/.../meta.json

  // 类型标识
  fileType: 'ossurl' | 'base64' | 'original'

  // 用户信息
  username?: string

  // 回调函数
  onSuccess?: (result: EditResult) => void
  onError?: (error: Error) => void
}
```

### 5.2 Meta 文件结构扩展

```json
{
  "custom": {
    "ossUpload": {
      "urls": {
        "originalHtml": "https://...",
        "withBase64": "https://...",
        "ossUrlHtml": "https://..."
      }
    },
    "modifications": [
      {
        "timestamp": "2024-01-01T00:00:00Z",
        "fileName": "content_ossurl.html",
        "fileType": "ossurl",
        "newOssUrl": "https://...",
        "description": "用户修改了标题"
      }
    ]
  }
}
```

## 6. 优势分析

### 6.1 独立性提升
- HtmlEditModal 不再依赖父组件传递 HTML 内容
- 自动处理 OSS 加载和更新
- 标准化的配置接口

### 6.2 自动化程度
- 修改后自动上传 OSS
- 自动更新 meta 文件
- 自动刷新显示内容

### 6.3 可维护性
- 清晰的数据流程
- 统一的错误处理
- 完整的状态追踪

### 6.4 用户体验
- 实时同步状态显示
- 平滑的内容更新
- 保留修改历史记录

## 7. 实施步骤

### Phase 1：基础改造（2小时）
- [ ] 修改 HtmlEditModal 支持配置对象
- [ ] 实现 OSS URL 加载功能
- [ ] 添加同步状态显示

### Phase 2：后端支持（2小时）
- [ ] 实现 /api/pod2post/update-oss 接口
- [ ] 扩展 meta 文件结构
- [ ] 添加修改历史记录

### Phase 3：集成测试（1小时）
- [ ] PortfolioPage 集成调用
- [ ] 完整流程测试
- [ ] 错误处理测试

### Phase 4：优化完善（1小时）
- [ ] 性能优化（缓存等）
- [ ] 用户体验优化
- [ ] 文档完善

## 8. 风险与对策

| 风险点 | 可能影响 | 应对策略 |
|--------|----------|----------|
| OSS 上传失败 | 无法同步最新内容 | 实现重试机制，本地备份 |
| Meta 文件损坏 | 无法获取路径信息 | 自动备份，版本控制 |
| 网络延迟 | 加载缓慢 | 显示加载进度，缓存机制 |
| 并发修改 | 内容冲突 | 实现锁机制，冲突检测 |

## 9. 总结

本方案通过以下关键设计实现 HtmlEditModal 的独立化：

1. **标准化配置接口**：通过统一的配置对象传递所有必要信息
2. **OSS URL 驱动**：使用 OSS URL 作为内容加载和更新的核心
3. **绝对路径保留**：确保 AI 修改能准确定位文件
4. **自动同步机制**：修改后自动上传 OSS 并更新 meta
5. **完整的生命周期**：从加载到修改到同步的完整流程管理

该方案让 HtmlEditModal 成为一个真正独立、可复用的智能编辑组件。