# CardGenerator 模块化方案 v2.0

**更新时间**: 2024-08-29
**状态**: 部分实现，持续优化中

## 一、模块化架构

### 1. 当前目录结构
```
CardGenerator/
├── index.js                    # 主入口文件 ✅
├── CardGenerator.vue           # 主组件（991行，需优化）
├── layouts/                    # 布局组件 🆕
│   └── MobileLayout.vue       # 移动端布局 ✅
├── components/                 # 通用组件
│   ├── ChatInterface.vue      # 聊天界面组件 ✅ (673行，需拆分)
│   ├── FileManager.vue        # 文件管理组件 ✅ (355行)
│   ├── FileItem.vue           # 文件项组件 ✅ (151行)
│   └── TemplateSelector.vue   # 模板选择器组件 ✅ (328行)
├── messages/                   # 消息卡片组件
│   ├── MessageCard.vue        # 基础消息卡片 ✅ (196行)
│   ├── HtmlMessageCard.vue    # HTML渲染卡片 ✅ (328行)
│   ├── JsonMessageCard.vue    # JSON渲染卡片 ⏳
│   ├── MarkdownCard.vue       # Markdown渲染卡片 ⏳
│   ├── ImageGalleryCard.vue   # 多图组合卡片 ⏳
│   └── VideoPlayerCard.vue    # 视频播放卡片 ⏳
├── composables/               # 组合式函数
│   ├── useCardGeneration.js  # 卡片生成逻辑 ✅ (130行)
│   ├── useFileOperations.js  # 文件操作逻辑 ✅ (240行)
│   ├── useChatHistory.js     # 聊天历史管理 ✅ (137行)
│   └── useSSEConnection.js   # SSE连接管理 ✅ (92行) 🆕
├── MODULARIZATION_PLAN.md    # 模块化方案文档 ✅
└── OPTIMIZATION_REPORT.md    # 优化评估报告 ✅ 🆕

图例：✅ 已实现 | ⏳ 待实现 | 🆕 新增
```

## 二、已完成模块

### ✅ 基础架构
1. **MessageCard.vue** - 基础消息卡片组件
   - 提供统一的卡片容器
   - 支持不同类型的消息展示
   - 内置复制、下载等基础操作

2. **HtmlMessageCard.vue** - HTML渲染卡片
   - 支持HTML内容预览
   - 代码高亮显示
   - 全屏预览功能
   - 下载HTML文件

3. **ChatInterface.vue** - 聊天界面组件
   - 消息列表展示
   - 输入框和发送功能
   - 快捷模板选择
   - 自动滚动到底部

4. **FileManager.vue** - 文件管理组件
   - 文件夹树形结构
   - 文件列表展示
   - 展开/折叠功能
   - 文件选择和操作

5. **TemplateSelector.vue** - 模板选择器
   - 模板列表展示
   - 快捷模板按钮
   - 模板选择状态管理

## 三、待实现模块

### 1. JsonMessageCard.vue
```vue
功能需求：
- JSON格式化显示
- 语法高亮
- 折叠/展开节点
- 复制JSON内容
- 导出为文件
```

### 2. MarkdownCard.vue
```vue
功能需求：
- Markdown实时渲染
- 支持代码块高亮
- 支持表格、列表等
- 切换源码/预览模式
- 导出为HTML/PDF
```

### 3. ImageGalleryCard.vue
```vue
功能需求：
- 多图网格展示
- 图片预览放大
- 幻灯片播放
- 批量下载
- 图片信息展示
```

### 4. VideoPlayerCard.vue
```vue
功能需求：
- 视频播放控制
- 进度条拖拽
- 音量控制
- 全屏播放
- 视频信息展示
```

## 四、主组件重构计划

### CardGenerator.vue 精简版结构
```vue
<template>
  <div class="card-generator">
    <!-- 桌面布局 -->
    <div v-if="!isMobile" class="desktop-layout">
      <!-- 左侧文件管理 -->
      <FileManager
        :folders="cardFolders"
        :selected-file="selectedCard"
        @select-file="handleFileSelect"
        @refresh="refreshCardFolders"
      />
      
      <!-- 中间预览区 -->
      <div class="preview-area">
        <component 
          :is="currentPreviewComponent"
          v-bind="previewProps"
        />
      </div>
      
      <!-- 右侧创作区 -->
      <div class="creation-area">
        <TemplateSelector
          v-model="selectedTemplate"
          :templates="templates"
        />
        <ChatInterface
          :messages="chatMessages"
          v-model="chatInputText"
          @send="handleSendMessage"
        />
      </div>
    </div>
    
    <!-- 移动端布局 -->
    <div v-else class="mobile-layout">
      <!-- 底部标签页切换 -->
      <TabBar v-model="activeTab" />
      
      <!-- 内容区域 -->
      <component 
        :is="currentTabComponent"
        v-bind="tabProps"
      />
    </div>
  </div>
</template>

<script setup>
import { FileManager, ChatInterface, TemplateSelector } from './components'
import { useCardGeneration, useFileOperations, useChatHistory } from './composables'

// 使用组合式函数
const { isGenerating, startGeneration, processStream } = useCardGeneration()
const { downloadFile, previewHtmlFile } = useFileOperations()
const { messages: chatMessages, addUserMessage, addAIMessage } = useChatHistory()

// ... 其他逻辑
</script>
```

## 五、组件通信方案

### 1. Props/Emit 模式
- 父子组件之间使用 props 和 emit
- 保持单向数据流

### 2. Provide/Inject
- 跨层级组件共享状态
- 用于主题、配置等全局状态

### 3. 组合式函数
- 逻辑复用和状态共享
- 保持响应式特性

## 六、扩展指南

### 添加新的消息卡片类型

1. 在 `messages/` 目录创建新组件
```vue
<!-- messages/CustomMessageCard.vue -->
<template>
  <MessageCard type="custom" v-bind="$attrs">
    <!-- 自定义内容 -->
  </MessageCard>
</template>
```

2. 注册到消息类型映射
```javascript
const messageComponents = {
  html: HtmlMessageCard,
  json: JsonMessageCard,
  custom: CustomMessageCard,
  // ...
}
```

3. 在 ChatInterface 中使用
```vue
<component 
  :is="getMessageComponent(message.type)"
  :data="message.data"
/>
```

## 七、性能优化

### 1. 组件懒加载
```javascript
const HtmlMessageCard = () => import('./messages/HtmlMessageCard.vue')
const JsonMessageCard = () => import('./messages/JsonMessageCard.vue')
```

### 2. 虚拟滚动
- 消息列表超过100条时启用虚拟滚动
- 文件列表超过500项时启用虚拟滚动

### 3. 防抖和节流
- 输入框输入使用防抖
- 滚动事件使用节流

## 八、测试计划

### 1. 单元测试
- 测试每个组合式函数
- 测试工具函数

### 2. 组件测试
- 测试组件渲染
- 测试用户交互
- 测试组件通信

### 3. 集成测试
- 测试完整的用户流程
- 测试不同设备适配

## 九、迁移步骤

1. **第一阶段**：创建新组件结构 ✅
2. **第二阶段**：逐步迁移功能模块
3. **第三阶段**：更新主组件引用
4. **第四阶段**：测试和优化
5. **第五阶段**：清理旧代码

## 十、注意事项

1. 保持向后兼容性
2. 逐步迁移，避免大规模重构
3. 充分测试每个模块
4. 编写完善的文档
5. 保持代码风格一致性