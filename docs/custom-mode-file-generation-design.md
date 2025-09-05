# 自定义模式文件生成设计文档

## 概述
自定义模式允许用户通过 `@文件引用` 的方式让 Claude 读取指定文件并根据用户需求生成多种格式的文件。与模板模式不同，自定义模式下生成的文件格式和数量完全由 Claude 根据任务需求决定。

## 核心特性

### 1. 文件引用机制
- **输入格式**：`@文件名 用户问题`
- **处理方式**：将 `@文件名` 直接替换为文件的绝对路径
- **示例**：
  - 输入：`@README.md 生成项目文档`
  - 处理后：`/app/data/users/default/storage/README.md 生成项目文档`

### 2. 渐进式文件检测
- **检测策略**：检测到第一个文件即返回，不等待所有文件生成完成
- **用户控制**：通过刷新按钮主动检查新生成的文件
- **状态管理**：支持 `generating`、`partial`、`completed` 等状态

## 技术架构

### 前端架构

```
┌─────────────────────────────────────────┐
│           ChatInputPanel.vue            │
│  - 解析 @引用                           │
│  - 发送到后端                           │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│         asyncCardGeneration.js          │
│  - 提交异步任务                         │
│  - 轮询状态                             │
│  - 刷新文件列表                         │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│          CardGenerator.vue              │
│  - 渐进式展示文件                       │
│  - 刷新按钮交互                         │
│  - 文件预览/下载                        │
└─────────────────────────────────────────┘
```

### 后端架构

```
┌─────────────────────────────────────────┐
│           cardAsync.js                  │
│  - 接收自定义模式请求                   │
│  - 路径替换处理                         │
│  - 文件检测（首个文件）                 │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│        referenceConverter.js            │
│  - 解析引用                             │
│  - 转换为路径映射                       │
│  - 返回 pathMap                         │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│         claudeExecutor.js               │
│  - 执行 Claude 命令                     │
│  - 传递处理后的提示词                   │
└─────────────────────────────────────────┘
```

## API 设计

### 1. 提交异步生成任务
```javascript
POST /api/generate/card/async
{
  "topic": "@README.md 生成文档",
  "mode": "custom",
  "references": [{
    "type": "file",
    "name": "README.md",
    "value": "README.md"
  }]
}

Response:
{
  "success": true,
  "data": {
    "taskId": "task_xxx",
    "folderName": "README_md_生成文档",
    "status": "submitted"
  }
}
```

### 2. 刷新文件检测
```javascript
GET /api/generate/refresh/{folderName}

Response:
{
  "success": true,
  "data": {
    "files": [
      {
        "fileName": "project_overview.md",
        "fileType": "markdown",
        "size": 2048,
        "createdAt": "2025-09-05T10:00:00Z",
        "preview": "# Project Overview..."
      },
      {
        "fileName": "api_docs.json",
        "fileType": "json",
        "size": 1024,
        "createdAt": "2025-09-05T10:00:05Z"
      }
    ],
    "totalFiles": 2,
    "status": "partial",
    "mayHaveMore": true
  }
}
```

### 3. 获取任务状态
```javascript
GET /api/generate/status/{topic}

Response:
{
  "success": true,
  "data": {
    "status": "partial",  // generating | partial | completed | failed
    "filesDetected": 2,
    "lastActivity": "2025-09-05T10:00:05Z",
    "message": "已检测到 2 个文件，可能还有更多"
  }
}
```

## 文件检测逻辑

### 后端检测流程
```javascript
// 1. 初始检测 - 检测到第一个文件就返回
const detectFirstFile = async (folderPath) => {
  return new Promise((resolve) => {
    const checkInterval = setInterval(async () => {
      const files = await fs.readdir(folderPath)
      const generatedFiles = files.filter(isGeneratedFile)
      
      if (generatedFiles.length > 0) {
        clearInterval(checkInterval)
        resolve({
          detected: true,
          firstFile: generatedFiles[0],
          timestamp: Date.now()
        })
      }
    }, 2000)
    
    // 超时处理
    setTimeout(() => {
      clearInterval(checkInterval)
      resolve({ detected: false })
    }, 120000)  // 2分钟超时
  })
}

// 2. 文件过滤规则
const isGeneratedFile = (fileName) => {
  return !fileName.startsWith('.') &&           // 非隐藏文件
         !fileName.includes('_meta') &&         // 非元数据
         !fileName.includes('-response') &&     // 非响应日志
         !fileName.includes('_backup')          // 非备份文件
}
```

## 前端交互设计

### 1. 文件列表组件
```vue
<template>
  <div class="file-generation-result">
    <!-- 头部：文件统计和刷新按钮 -->
    <div class="result-header">
      <div class="file-count">
        <span class="count-number">{{ files.length }}</span>
        <span class="count-label">个文件</span>
      </div>
      <button class="refresh-btn" @click="refreshFiles">
        <i class="icon-refresh" :class="{ spinning: isRefreshing }"></i>
        {{ isRefreshing ? '检查中' : '刷新' }}
      </button>
    </div>
    
    <!-- 文件列表：渐进式展示 -->
    <div class="file-list">
      <transition-group name="slide-fade">
        <div v-for="file in files" :key="file.fileName" class="file-card">
          <!-- 文件信息和操作 -->
        </div>
      </transition-group>
    </div>
    
    <!-- 提示信息 -->
    <div v-if="showGeneratingHint" class="generating-hint">
      <i class="icon-info"></i>
      Claude 可能还在生成更多文件，点击刷新查看
    </div>
  </div>
</template>
```

### 2. 刷新逻辑
```javascript
const refreshFiles = async () => {
  isRefreshing.value = true
  
  try {
    const response = await api.refreshFiles(folderName)
    const newFiles = response.data.files
    
    // 比对并添加新文件
    const existingNames = files.value.map(f => f.fileName)
    const addedFiles = newFiles.filter(f => !existingNames.includes(f.fileName))
    
    if (addedFiles.length > 0) {
      // 添加新文件并高亮显示
      addedFiles.forEach(file => {
        file.isNew = true
        files.value.push(file)
      })
      
      // 3秒后移除高亮
      setTimeout(() => {
        addedFiles.forEach(f => f.isNew = false)
      }, 3000)
      
      showToast(`发现 ${addedFiles.length} 个新文件`)
    }
    
    // 智能隐藏提示
    updateGeneratingHint(addedFiles.length)
    
  } finally {
    isRefreshing.value = false
  }
}

// 智能提示管理
let noNewFileCount = 0
const updateGeneratingHint = (newFileCount) => {
  if (newFileCount === 0) {
    noNewFileCount++
    if (noNewFileCount >= 3) {
      showGeneratingHint.value = false  // 连续3次无新文件，隐藏提示
    }
  } else {
    noNewFileCount = 0  // 重置计数
  }
}
```

### 3. 自动刷新策略
```javascript
onMounted(() => {
  // 初始自动刷新
  let autoRefreshCount = 0
  const maxAutoRefresh = 3
  
  const autoRefreshTimer = setInterval(() => {
    if (autoRefreshCount < maxAutoRefresh) {
      refreshFiles()
      autoRefreshCount++
    } else {
      clearInterval(autoRefreshTimer)
      console.log('自动刷新结束，用户可手动刷新')
    }
  }, 5000)  // 每5秒一次，共3次
})
```

## 状态管理

### 任务状态定义
```javascript
const TaskStatus = {
  SUBMITTED: 'submitted',     // 已提交
  GENERATING: 'generating',    // 生成中
  PARTIAL: 'partial',         // 部分完成（已有文件）
  COMPLETED: 'completed',      // 完成（用户确认）
  FAILED: 'failed'            // 失败
}

const FileStatus = {
  NEW: 'new',                 // 新检测到
  VIEWED: 'viewed',           // 已查看
  DOWNLOADED: 'downloaded'     // 已下载
}
```

## 用户体验优化

### 1. 视觉反馈
- **新文件高亮**：新检测到的文件以动画和颜色高亮3秒
- **刷新动画**：刷新按钮旋转动画
- **加载状态**：骨架屏或加载动画

### 2. 交互优化
- **快捷键**：`R` 键快速刷新
- **拖拽排序**：支持文件列表拖拽排序
- **批量操作**：支持批量下载

### 3. 错误处理
- **超时提示**：2分钟无文件生成时提示可能的问题
- **重试机制**：失败时提供重试按钮
- **日志查看**：提供查看生成日志的入口

## 性能优化

### 1. 防抖和节流
```javascript
// 刷新按钮防抖
const refreshFiles = debounce(async () => {
  // 刷新逻辑
}, 500)

// 文件列表虚拟滚动（文件数量多时）
const visibleFiles = computed(() => {
  return files.value.slice(startIndex, endIndex)
})
```

### 2. 缓存策略
```javascript
// 缓存文件预览内容
const filePreviewCache = new Map()

const getFilePreview = async (file) => {
  if (filePreviewCache.has(file.fileName)) {
    return filePreviewCache.get(file.fileName)
  }
  
  const preview = await api.getFileContent(file.fileName, { limit: 200 })
  filePreviewCache.set(file.fileName, preview)
  return preview
}
```

## 安全考虑

1. **路径验证**：确保文件路径在用户允许的范围内
2. **文件类型限制**：限制可生成的文件类型
3. **大小限制**：单个文件和总大小限制
4. **访问控制**：确保用户只能访问自己的文件

## 未来扩展

1. **实时推送**：使用 WebSocket 实时推送新文件
2. **预览增强**：支持更多文件类型的预览
3. **协作功能**：支持分享和协作编辑
4. **版本管理**：支持文件版本历史

## 总结

自定义模式通过渐进式文件检测和用户控制的刷新机制，提供了灵活且高效的文件生成体验。核心优势：

- ✅ **快速响应**：首个文件即可展示
- ✅ **用户控制**：主动刷新而非被动等待
- ✅ **渐进体验**：文件逐个出现
- ✅ **简单可靠**：无需复杂的完成判断
- ✅ **灵活扩展**：易于添加新功能