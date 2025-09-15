# HTML卡片选择编辑功能集成文档

## 概述

本文档说明了如何在Vue前端项目中集成HTML卡片的选择编辑功能。该功能允许用户通过涂抹选择的方式，直观地选中HTML内容中的元素并进行编辑。

## 功能特性

### 1. 核心功能
- **涂抹选择**: 使用画笔工具涂抹选择HTML元素
- **矩形选择**: 通过拖拽矩形框选择区域内的元素
- **套索选择**: 自由绘制路径选择元素
- **智能检测**: 自动识别涂抹区域覆盖的DOM元素
- **覆盖率计算**: 精确计算元素被选中的覆盖程度
- **移动端支持**: 完全支持触摸操作，适配移动设备

### 2. 用户界面
- **编辑按钮**: 在HtmlMessageCard组件中添加编辑按钮
- **模态编辑器**: 弹出式编辑界面，包含工具栏和预览区
- **实时反馈**: 选择过程中实时显示选中的元素
- **批量操作**: 支持同时选择和编辑多个元素

## 组件结构

```
terminal-ui/src/
├── components/
│   ├── SelectionOverlay/          # 选择覆盖层组件
│   │   ├── index.vue              # 主组件
│   │   └── useSelectionOverlay.js # 组合式函数
│   │
│   └── HtmlEditModal/             # 编辑模态框组件
│       └── index.vue              # 模态框组件
│
└── views/CardGenerator/
    └── messages/
        └── HtmlMessageCard.vue    # 集成编辑功能的卡片组件
```

## 使用方法

### 1. 基本使用

在HtmlMessageCard组件中，编辑功能已经集成完成。用户只需点击编辑按钮即可打开编辑界面。

```vue
<HtmlMessageCard
  :result-data="messageData"
  :html-content="htmlContent"
  @edit="handleEdit"
/>
```

### 2. 编辑流程

1. **点击编辑按钮**: 在HTML卡片上点击编辑按钮（铅笔图标）
2. **选择元素**: 使用涂抹工具在HTML内容上涂抹，选择要编辑的元素
3. **查看选中**: 右侧面板显示所有选中的元素及其覆盖率
4. **输入修改**: 在文本框中描述想要的修改
5. **应用修改**: 点击"应用修改"按钮提交编辑请求

### 3. 工具选项

#### 涂抹工具
- 画笔大小: 5px - 50px 可调
- 透明度: 0.3 (默认)
- 颜色: #007AFF (默认蓝色)

#### 选择模式
- **涂抹模式**: 适合选择不规则形状的内容
- **矩形模式**: 适合选择矩形区域的内容
- **套索模式**: 适合精确勾勒选择区域

## API 参考

### SelectionOverlay 组件

#### Props

| 属性 | 类型 | 默认值 | 说明 |
|-----|------|--------|------|
| visible | Boolean | false | 控制覆盖层显示 |
| container | HTMLElement | null | 目标容器元素 |
| config | Object | {} | 配置选项 |

#### Events

| 事件名 | 参数 | 说明 |
|--------|------|------|
| selection-start | {point} | 选择开始 |
| selection-update | {bounds, path} | 选择更新 |
| selection-complete | {selection} | 选择完成 |
| selections-change | [selections] | 选区变化 |

#### Methods

```javascript
// 清除所有选区
selectionOverlay.clearSelections()

// 获取所有选区
const selections = selectionOverlay.getSelections()

// 导出数据
const data = selectionOverlay.exportData('json')
```

### HtmlEditModal 组件

#### Props

| 属性 | 类型 | 默认值 | 说明 |
|-----|------|--------|------|
| modelValue | Boolean | false | v-model绑定值 |
| htmlContent | String | '' | HTML内容 |
| title | String | '编辑HTML内容' | 对话框标题 |

#### Events

| 事件名 | 参数 | 说明 |
|--------|------|------|
| update:modelValue | Boolean | 更新显示状态 |
| apply | {elements, request} | 应用修改 |
| cancel | - | 取消编辑 |

## 配置选项

### 选择覆盖层配置

```javascript
const overlayConfig = {
  // 模式配置
  mode: 'paint', // paint | rectangle | lasso

  // 画笔配置
  brush: {
    size: 20,        // 画笔大小
    opacity: 0.3,    // 透明度
    color: '#007AFF', // 颜色
    shape: 'circle'  // 形状: circle | square
  },

  // 行为配置
  behavior: {
    multiSelect: true,    // 允许多选
    autoComplete: false,  // 自动闭合路径
    magneticSnap: false   // 磁性吸附
  },

  // 性能配置
  performance: {
    throttleMs: 16,   // 节流时间(ms)
    sampleRate: 5     // 采样率(px)
  },

  // 视觉配置
  visual: {
    showCursor: true,      // 显示光标
    showCoordinates: true, // 显示坐标
    showDimensions: false  // 显示尺寸
  },

  // 阈值配置
  thresholds: {
    coverageMin: 0.3,  // 最小覆盖率
    selectionMin: 0.1  // 最小选择率
  }
}
```

## 移动端适配

### 触摸事件支持

组件自动检测并支持触摸事件：

```javascript
// 自动处理的事件
- touchstart → 开始选择
- touchmove → 移动选择
- touchend → 结束选择
```

### 响应式布局

编辑模态框会根据屏幕尺寸自动调整：

- **桌面端** (>768px): 左右分栏布局
- **移动端** (<768px): 上下分栏布局，全屏显示

### 移动端优化

1. **画笔大小**: 移动端默认增大画笔尺寸
2. **采样率**: 降低采样率以提升性能
3. **手势支持**: 支持缩放和平移手势

## 数据处理

### 选中元素数据结构

```javascript
{
  id: 'element_123456',
  element: HTMLElement,      // DOM元素引用
  coverage: 0.75,            // 覆盖率 (0-1)
  bounds: {                  // 边界框
    x: 100,
    y: 200,
    width: 300,
    height: 150
  },
  selection: {               // 选区信息
    id: 'selection_789',
    type: 'paint',
    path: [{x, y}, ...],
    metadata: {...}
  }
}
```

### 编辑请求数据

```javascript
{
  elements: [               // 选中的元素列表
    {
      tagName: 'div',
      className: 'content',
      id: 'main',
      html: '<div>...</div>',
      coverage: 0.8
    }
  ],
  request: '将标题改为...',  // 用户的修改描述
  timestamp: 1234567890
}
```

## 扩展开发

### 自定义选择工具

```javascript
// 创建自定义工具
class CustomTool {
  onStart(point, ctx) {
    // 开始绘制
  }

  onMove(point, ctx) {
    // 移动绘制
  }

  onEnd(point, ctx) {
    // 结束绘制
  }
}

// 使用自定义工具
selectionOverlay.setTool(new CustomTool())
```

### 自定义适配器

```javascript
// 创建内容适配器
class CustomAdapter {
  getElementsInSelection(selection) {
    // 自定义元素检测逻辑
    return elements
  }

  calculateCoverage(selection, element) {
    // 自定义覆盖率计算
    return coverage
  }
}
```

## 性能优化建议

1. **使用离屏Canvas**: 减少重绘次数
2. **节流处理**: 控制事件触发频率
3. **采样优化**: 根据内容复杂度调整采样率
4. **懒加载**: 仅在需要时加载编辑组件
5. **虚拟滚动**: 长列表使用虚拟滚动

## 兼容性

- Vue 3.2+
- Element Plus 2.0+
- 现代浏览器 (Chrome 80+, Firefox 75+, Safari 13+, Edge 80+)
- 移动端浏览器 (iOS Safari 13+, Chrome Mobile)

## 故障排除

### 常见问题

1. **选择不准确**
   - 调整采样率: 降低 `sampleRate` 值
   - 增大画笔: 适当增加画笔大小

2. **性能问题**
   - 提高节流时间: 增加 `throttleMs` 值
   - 减少采样: 增加 `sampleRate` 值

3. **移动端触摸问题**
   - 确保容器有正确的touch-action样式
   - 检查是否有其他组件阻止事件冒泡

## 示例代码

### 完整集成示例

```vue
<template>
  <div class="card-container">
    <HtmlMessageCard
      v-for="message in messages"
      :key="message.id"
      :result-data="message.data"
      :html-content="message.html"
      @edit="handleCardEdit"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import HtmlMessageCard from '@/views/CardGenerator/messages/HtmlMessageCard.vue'

const messages = ref([...])

const handleCardEdit = (editData) => {
  console.log('编辑数据:', editData)
  // 处理编辑请求
}
</script>
```

## 更新日志

### v1.0.0 (2024-01-15)
- 初始版本发布
- 实现涂抹选择功能
- 集成到HtmlMessageCard组件
- 支持移动端触摸操作

## 联系支持

如有问题或建议，请提交Issue或联系开发团队。