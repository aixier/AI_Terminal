# CardGenerator 组件使用指南

## 📚 概述

CardGenerator 是一个模块化的 AI 内容生成系统，提供了完整的聊天界面、文件管理、模板选择和多种内容渲染能力。

## 🎯 快速开始

### 基础使用

```vue
<template>
  <CardGenerator />
</template>

<script setup>
import { CardGenerator } from '@/views/CardGenerator'
</script>
```

## 📦 核心组件

### 1. ChatInterface - 聊天界面

**功能**: 提供完整的聊天交互界面，支持消息展示、输入和快捷模板。

```vue
<ChatInterface
  :messages="chatMessages"
  v-model="inputText"
  :templates="templates"
  :selected-template="selectedTemplate"
  :is-generating="isGenerating"
  @send="handleSend"
  @select-template="handleTemplateSelect"
  @retry="handleRetry"
/>
```

**Props**:
- `messages` (Array): 聊天消息数组
- `modelValue` (String): 输入框文本（v-model）
- `templates` (Array): 可用模板列表
- `selectedTemplate` (Number): 当前选中的模板索引
- `isGenerating` (Boolean): 是否正在生成内容
- `placeholder` (String): 输入框提示文本

**Events**:
- `send`: 发送消息时触发
- `select-template`: 选择模板时触发
- `retry`: 重试生成时触发
- `clear-history`: 清空历史时触发

### 2. FileManager - 文件管理器

**功能**: 提供文件夹树形结构展示和文件管理功能。

```vue
<FileManager
  title="我的文件"
  :folders="folders"
  :selected-file="selectedFile"
  :generating-files="generatingFiles"
  @refresh="handleRefresh"
  @select-file="handleFileSelect"
  @toggle-folder="handleFolderToggle"
/>
```

**Props**:
- `title` (String): 标题
- `folders` (Array): 文件夹数据
- `selectedFolder` (Object): 当前选中的文件夹
- `selectedFile` (Object): 当前选中的文件
- `generatingFiles` (Object): 正在生成的文件状态
- `fileFilter` (Function): 文件过滤函数
- `connectionStatus` (Object): 连接状态
- `emptyMessage` (String): 空状态提示

### 3. TemplateSelector - 模板选择器

**功能**: 展示和选择内容生成模板。

```vue
<TemplateSelector
  :templates="templates"
  :selected-index="selectedIndex"
  @select="handleSelect"
  @refresh="handleRefresh"
/>
```

**Props**:
- `templates` (Array): 模板列表
- `selectedIndex` (Number): 选中的模板索引
- `showRefresh` (Boolean): 是否显示刷新按钮
- `showQuickButtons` (Boolean): 是否显示快捷按钮

## 🎨 消息卡片组件

### MessageCard - 基础卡片

所有消息卡片的基础组件，提供统一的容器和操作按钮。

```vue
<MessageCard
  type="text"
  :content="content"
  :timestamp="timestamp"
  :show-actions="true"
  @copy="handleCopy"
  @download="handleDownload"
>
  <!-- 自定义内容 -->
</MessageCard>
```

### HtmlMessageCard - HTML渲染卡片

专门用于渲染和预览HTML内容。

```vue
<HtmlMessageCard
  :html-content="htmlContent"
  :file-name="fileName"
  :timestamp="timestamp"
  @copy="handleCopy"
  @download="handleDownload"
  @fullscreen="handleFullscreen"
/>
```

**特性**:
- 代码/预览模式切换
- 语法高亮
- 全屏预览
- 下载功能

## 🔧 组合式函数

### useCardGeneration - 卡片生成

管理内容生成的流式处理。

```javascript
import { useCardGeneration } from '@/views/CardGenerator/composables'

const {
  isGenerating,
  generatingHint,
  streamMessages,
  totalChars,
  startGeneration,
  processStream,
  stopGeneration
} = useCardGeneration()

// 开始生成
const response = await startGeneration({
  prompt: '生成一篇文章',
  template: 'article'
})

// 处理流式响应
await processStream(response, 
  (chunk) => console.log('收到数据:', chunk),
  (allChunks) => console.log('生成完成')
)
```

### useChatHistory - 聊天历史

管理聊天消息的存储和恢复。

```javascript
import { useChatHistory } from '@/views/CardGenerator/composables'

const {
  messages,
  addUserMessage,
  addAIMessage,
  updateMessage,
  clearHistory,
  restoreFromLocal
} = useChatHistory()

// 添加用户消息
const userMsg = addUserMessage('你好', templateIndex)

// 添加AI消息
const aiMsg = addAIMessage('', true, '生成中...', templateIndex)

// 更新消息
updateMessage(aiMsg.id, {
  content: '生成完成的内容',
  isGenerating: false
})
```

### useFileOperations - 文件操作

提供文件的增删改查操作。

```javascript
import { useFileOperations } from '@/views/CardGenerator/composables'

const {
  downloadFile,
  deleteFile,
  renameFile,
  previewHtmlFile,
  getFileContent,
  createFolder,
  deleteFolder
} = useFileOperations()

// 下载文件
await downloadFile(file, folder)

// 删除文件
const success = await deleteFile(file, folder)

// 获取文件内容
const content = await getFileContent(file, folder)
```

### useSSEConnection - SSE连接

管理服务器推送事件连接。

```javascript
import { useSSEConnection } from '@/views/CardGenerator/composables'

const {
  isConnected,
  connect,
  disconnect,
  reconnect
} = useSSEConnection(
  (fileUpdate) => console.log('文件更新:', fileUpdate),
  (refresh) => console.log('需要刷新:', refresh)
)

// 建立连接
connect()

// 断开连接
disconnect()
```

## 🎯 完整示例

### 创建自定义消息卡片

```vue
<!-- CustomMessageCard.vue -->
<template>
  <MessageCard 
    type="custom"
    :content="data"
    v-bind="$attrs"
  >
    <div class="custom-content">
      <!-- 自定义渲染逻辑 -->
      <div v-for="item in data.items" :key="item.id">
        {{ item.name }}
      </div>
    </div>
    
    <template #actions>
      <!-- 自定义操作按钮 -->
      <button @click="handleCustomAction">
        自定义操作
      </button>
    </template>
  </MessageCard>
</template>

<script setup>
import { MessageCard } from '@/views/CardGenerator/messages'

const props = defineProps({
  data: Object
})

const handleCustomAction = () => {
  // 自定义逻辑
}
</script>
```

### 集成到现有项目

```vue
<template>
  <div class="my-app">
    <!-- 只使用聊天界面 -->
    <ChatInterface
      :messages="messages"
      v-model="input"
      @send="handleSend"
    />
    
    <!-- 只使用文件管理 -->
    <FileManager
      :folders="myFolders"
      @select-file="handleFileSelect"
    />
  </div>
</template>

<script setup>
import { ChatInterface, FileManager } from '@/views/CardGenerator/components'
import { useChatHistory } from '@/views/CardGenerator/composables'

const { messages, addUserMessage, addAIMessage } = useChatHistory()
const input = ref('')

const handleSend = async (text) => {
  // 添加用户消息
  addUserMessage(text)
  
  // 调用API生成内容
  const response = await generateContent(text)
  
  // 添加AI响应
  addAIMessage(response)
}
</script>
```

## 🚀 最佳实践

### 1. 按需导入
只导入需要的组件，减少打包体积：

```javascript
// ✅ 好的做法
import { ChatInterface } from '@/views/CardGenerator/components'

// ❌ 避免
import * as CardGenerator from '@/views/CardGenerator'
```

### 2. 组件懒加载
对于大型组件，使用动态导入：

```javascript
const HtmlMessageCard = () => import('@/views/CardGenerator/messages/HtmlMessageCard.vue')
```

### 3. 状态管理
复杂应用建议配合 Pinia 使用：

```javascript
// stores/cardGenerator.js
export const useCardGeneratorStore = defineStore('cardGenerator', {
  state: () => ({
    messages: [],
    templates: [],
    folders: []
  }),
  // ...
})
```

### 4. 错误处理
始终添加错误处理：

```javascript
try {
  const response = await startGeneration(params)
  await processStream(response, onChunk, onComplete)
} catch (error) {
  console.error('生成失败:', error)
  ElMessage.error('生成失败，请重试')
}
```

## 📝 注意事项

1. **依赖项**: 确保安装了必要的依赖
   - Vue 3.x
   - Element Plus
   - axios
   - highlight.js (for code highlighting)

2. **样式**: 组件使用 scoped 样式，不会影响全局样式

3. **响应式**: 所有组件都支持移动端和桌面端

4. **国际化**: 目前只支持中文，可通过修改文本实现国际化

## 🔗 相关文档

- [模块化方案](./MODULARIZATION_PLAN.md)
- [优化报告](./OPTIMIZATION_REPORT.md)
- [API文档](../../api/README.md)

## 💡 常见问题

**Q: 如何添加新的消息类型？**
A: 创建新的消息卡片组件，继承 MessageCard，实现自定义渲染逻辑。

**Q: 如何自定义主题？**
A: 通过 CSS 变量覆盖默认样式，或修改组件的 scoped 样式。

**Q: 如何集成其他AI服务？**
A: 修改 useCardGeneration 中的 API 调用，适配新的接口。

## 📧 支持

如有问题，请提交 Issue 或联系开发团队。