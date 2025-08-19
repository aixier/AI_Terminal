# Markdown渲染模块

基于Milkdown的高性能Markdown渲染模块，支持UML图表、脑图、代码高亮、数学公式等丰富功能。

## ✨ 功能特性

### 🎯 核心功能
- **GitHub风格Markdown** - 完整支持GFM语法
- **实时渲染** - 高性能的实时预览
- **主题系统** - Fluent Design主题，支持明暗模式
- **响应式设计** - 完美适配桌面和移动端

### 📊 图表支持
- **Mermaid图表** - 流程图、时序图、甘特图等
- **数学公式** - KaTeX渲染的数学公式
- **脑图** - 思维导图支持
- **UML图** - 类图、用例图等

### 💻 代码功能
- **语法高亮** - 支持100+编程语言
- **代码块** - 带语言标识的代码块
- **行号显示** - 可选的行号显示
- **代码复制** - 一键复制代码

### 🎨 内容增强
- **自定义容器** - 信息、警告、提示框等
- **任务列表** - 交互式待办清单
- **表格** - 支持排序和调整大小
- **Emoji** - 表情符号支持
- **媒体嵌入** - 图片、视频、音频

## 🚀 安装依赖

```bash
npm install @milkdown/core @milkdown/ctx @milkdown/preset-gfm \
  @milkdown/plugin-mermaid @milkdown/plugin-prism @milkdown/plugin-math \
  @milkdown/plugin-tooltip @milkdown/plugin-slash @milkdown/plugin-emoji \
  @milkdown/plugin-table @milkdown/theme-material @milkdown/vue \
  katex mermaid prismjs dompurify
```

## 📖 使用方法

### 基础使用

```vue
<template>
  <MarkdownViewer 
    :content="markdownContent"
    theme="fluent"
    preset="full"
    @loaded="handleLoaded"
    @error="handleError"
  />
</template>

<script setup>
import MarkdownViewer from '@/components/markdown/MarkdownViewer.vue'

const markdownContent = ref(`
# 标题

这是一个**Markdown**示例。

\`\`\`javascript
console.log('Hello World')
\`\`\`

\`\`\`mermaid
graph TD
    A[开始] --> B{判断}
    B -->|是| C[执行]
    B -->|否| D[结束]
\`\`\`
`)

const handleLoaded = () => {
  console.log('Markdown渲染完成')
}

const handleError = (error) => {
  console.error('渲染错误:', error)
}
</script>
```

### 高级配置

```vue
<template>
  <MarkdownViewer 
    :content="content"
    theme="fluent-dark"
    preset="technical"
    :show-toolbar="true"
    :show-footer="true"
    :enable-fullscreen="true"
    :enable-export="true"
    min-height="500px"
    @theme-change="handleThemeChange"
    @export="handleExport"
  />
</template>
```

### 程序化创建

```javascript
import { createMarkdownViewer, EDITOR_PRESETS } from '@/components/markdown'

const editor = createMarkdownViewer({
  content: markdownContent,
  container: document.getElementById('markdown-container'),
  theme: 'fluent',
  ...EDITOR_PRESETS.full,
  onLoad: () => console.log('加载完成'),
  onError: (error) => console.error('错误:', error)
})

await editor.create()
```

## 🎨 主题配置

### 可用主题
- `fluent` - Fluent Design浅色主题
- `fluent-dark` - Fluent Design深色主题

### 自定义主题

```css
.markdown-viewer[data-theme="custom"] {
  --md-primary-color: #your-color;
  --md-background: #your-bg;
  /* 更多变量... */
}
```

## ⚙️ 预设配置

| 预设 | 描述 | 功能 |
|------|------|------|
| `basic` | 基础查看器 | 代码高亮、Emoji |
| `full` | 完整功能 | 所有功能 |
| `document` | 文档查看器 | 图表、公式、高亮 |
| `technical` | 技术文档 | 专业技术文档优化 |

## 🔧 API文档

### MarkdownViewer Props

| 属性 | 类型 | 默认值 | 描述 |
|------|------|-------|------|
| `content` | String | `''` | Markdown内容 |
| `theme` | String | `'fluent'` | 主题名称 |
| `preset` | String | `'full'` | 预设配置 |
| `showToolbar` | Boolean | `true` | 显示工具栏 |
| `showFooter` | Boolean | `false` | 显示底部信息 |
| `enableFullscreen` | Boolean | `true` | 启用全屏功能 |
| `enableExport` | Boolean | `true` | 启用导出功能 |
| `minHeight` | String | `'300px'` | 最小高度 |
| `lastUpdated` | Date\|String\|Number | `null` | 最后更新时间 |
| `fileSize` | Number | `null` | 文件大小 |

### Events

| 事件 | 参数 | 描述 |
|------|------|------|
| `loaded` | - | 渲染完成 |
| `error` | `error` | 渲染错误 |
| `theme-change` | `theme` | 主题切换 |
| `fullscreen-change` | `isFullscreen` | 全屏状态变化 |
| `export` | `data` | 导出数据 |

## 🛠️ 工具函数

```javascript
import { 
  analyzeMarkdownContent,
  extractHeaders,
  generateTOC,
  getContentStats,
  validateMarkdownSyntax
} from '@/components/markdown'

// 分析内容复杂度
const analysis = analyzeMarkdownContent(content)

// 提取标题生成目录
const headers = extractHeaders(content)
const toc = generateTOC(headers)

// 内容统计
const stats = getContentStats(content)

// 语法验证
const validation = validateMarkdownSyntax(content)
```

## 📝 Markdown语法示例

### 基础语法

```markdown
# 一级标题
## 二级标题
### 三级标题

**粗体** *斜体* ~~删除线~~

[链接](https://example.com)
![图片](image.jpg)

> 引用文本

- 无序列表
- 项目2

1. 有序列表
2. 项目2
```

### 扩展语法

#### 自定义容器
```markdown
::: info 信息
这是一个信息提示框
:::

::: warning 警告
这是一个警告提示框
:::

::: danger 危险
这是一个危险提示框
:::
```

#### 任务列表
```markdown
- [x] 已完成任务
- [ ] 待完成任务
```

#### 表格
```markdown
| 列1 | 列2 | 列3 |
|-----|-----|-----|
| 数据1 | 数据2 | 数据3 |
```

#### 数学公式
```markdown
行内公式: $E = mc^2$

块级公式:
$$
\sum_{i=1}^{n} x_i = x_1 + x_2 + \cdots + x_n
$$
```

#### Mermaid图表
```markdown
\`\`\`mermaid
graph LR
    A[开始] --> B{决策}
    B -->|是| C[处理]
    B -->|否| D[结束]
    C --> D
\`\`\`
```

## 🔍 故障排除

### 常见问题

1. **Mermaid图表不显示**
   - 确保网络连接正常
   - 检查Mermaid语法是否正确

2. **数学公式渲染错误**
   - 检查KaTeX语法
   - 确认公式分隔符正确

3. **代码高亮失效**
   - 检查语言标识是否正确
   - 确认Prism.js加载正常

### 性能优化

1. **大文件处理**
   ```javascript
   // 使用basic预设减少功能
   <MarkdownViewer preset="basic" />
   ```

2. **延迟加载**
   ```javascript
   // 分析内容复杂度后选择预设
   const preset = detectContentType(content)
   ```

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交Issue和Pull Request！