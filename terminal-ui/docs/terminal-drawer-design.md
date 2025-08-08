# Terminal Drawer 设计文档

## 概述
Terminal Drawer 是一个专业的终端输出展示组件，为 Card Generator 页面提供实时的命令执行反馈。该组件采用国际化的设计标准，确保用户体验的专业性和一致性。

## 核心设计理念

### 1. 透明性原则
- **实时展示**：所有终端命令执行过程实时可见
- **清晰反馈**：通过进度条和状态文字提供明确的执行状态
- **历史记录**：保留完整的命令执行历史，方便追溯

### 2. 非侵入式交互
- **智能展现**：执行命令时自动展开，完成后可选择自动收起
- **悬浮按钮**：关闭时通过悬浮按钮快速访问，带有未读计数提醒
- **拖动调整**：支持宽度调整，适应不同用户需求

### 3. 视觉设计
- **毛玻璃效果**：采用现代的半透明背景设计
- **流畅动画**：平滑的滑入滑出动画，符合 Material Motion 规范
- **色彩系统**：
  - 成功状态：绿色 (#28c940)
  - 执行状态：橙色 (#ffa500)
  - 错误状态：红色 (#ff4444)
  - 主题色：蓝色渐变 (#0078d4 → #00bcf2)

## 功能特性

### 主要功能
1. **实时输出显示**
   - 支持 ANSI 颜色码
   - 自动滚动到最新输出
   - 命令与输出分层展示

2. **进度追踪**
   - 可视化进度条
   - 阶段性状态提示
   - 执行时间统计

3. **交互控制**
   - 清空终端输出
   - 导出执行日志
   - 全屏模式
   - 自动收起开关

### 技术实现
- **组件化设计**：Vue 3 Composition API
- **状态管理**：通过 SharedTerminal 服务实现跨页面状态共享
- **WebSocket 通信**：实时接收终端输出
- **响应式布局**：适配桌面和移动设备

## 使用场景

### 1. Claude 初始化
```javascript
// 打开抽屉并显示初始化过程
terminalDrawerRef.value.executeCommand('claude')
terminalDrawerRef.value.updateProgress(10, 'Initializing Claude...')
```

### 2. 卡片生成
```javascript
// 两阶段生成过程的进度展示
terminalDrawerRef.value.executeCommand(prompt1)
terminalDrawerRef.value.updateProgress(20, 'Generating JSON content...')
// ... 第二阶段
terminalDrawerRef.value.updateProgress(70, 'Rendering card...')
```

### 3. 完成处理
```javascript
// 成功完成
terminalDrawerRef.value.updateProgress(100, 'Completed!')
terminalDrawerRef.value.completeExecution()
```

## 交互流程

1. **用户点击"初始化Claude"按钮**
   - Terminal Drawer 自动从右侧滑出
   - 显示 "claude" 命令执行
   - 实时展示初始化进度

2. **用户生成卡片**
   - Drawer 自动打开（如果已关闭）
   - 分阶段显示：JSON生成 → 卡片渲染
   - 完成后根据设置决定是否自动收起

3. **手动操作**
   - 可随时通过悬浮按钮打开查看历史
   - 支持拖动调整宽度
   - 可导出完整执行日志

## 优势

1. **提升透明度**：用户清楚了解系统在做什么
2. **建立信任**：实时反馈增强用户信心
3. **便于调试**：保留完整执行记录，方便问题排查
4. **专业体验**：符合国际化应用的设计标准

## 后续优化建议

1. **智能分析**：自动识别错误并提供解决建议
2. **主题定制**：支持深色/浅色主题切换
3. **快捷键支持**：添加键盘快捷键控制
4. **多语言支持**：国际化文本内容
5. **性能优化**：虚拟滚动处理大量输出