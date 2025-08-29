# AI创作页面Chat模式改造任务清单

## 任务状态说明
- 🔴 **待开始** - 未开始的任务
- 🟡 **进行中** - 正在进行的任务  
- 🟢 **已完成** - 已完成的任务
- 🔵 **已测试** - 已测试通过的任务

---

## 📋 任务列表

| 状态 | 序号 | 任务名称 | 模块 | 参考文档 | 需要修改的代码文件 | 注意事项 |
|------|------|----------|------|----------|-------------------|----------|
| 🔴 | 1 | 创建聊天消息数据结构 | 核心数据 | CLAUDE.md#核心逻辑改造 | `src/views/CardGenerator.vue` | 定义消息对象结构：id, type, content, timestamp, template, isGenerating等字段 |
| 🔴 | 2 | 实现聊天历史状态管理 | 状态管理 | CLAUDE.md#聊天状态管理 | `src/views/CardGenerator.vue` | 使用Vue3 ref管理chatMessages数组，实现消息的增删改查 |
| 🔴 | 3 | 移动端对话界面布局重构 | 移动端UI | CLAUDE.md#移动端AI创作Tab改造 | `src/views/CardGenerator.vue` (create-tab部分) | 替换现有模板选择区域为对话历史区域，高度自适应 |
| 🔴 | 4 | 移动端用户消息气泡组件 | 移动端组件 | CLAUDE.md#移动端对话样式 | `src/views/CardGenerator.vue` | 右对齐，蓝色背景，圆角设计，最大宽度80% |
| 🔴 | 5 | 移动端AI响应卡片组件 | 移动端组件 | CLAUDE.md#核心组件改造 | `src/views/CardGenerator.vue` | 左对齐，包含AI头像，卡片式展示，操作按钮组 |
| 🔴 | 6 | 移动端生成中状态动画 | 动画效果 | CLAUDE.md#CreateTab.vue | `src/views/CardGenerator.vue` | 打字机效果，三点loading动画，"AI正在创作中..."提示 |
| 🔴 | 7 | 移动端模板快选按钮组 | 移动端输入区 | CLAUDE.md#模板快选 | `src/views/CardGenerator.vue` | 横向滚动，常用模板4-6个，更多按钮触发完整列表 |
| 🔴 | 8 | 移动端输入框改造 | 移动端输入区 | CLAUDE.md#输入区域 | `src/views/CardGenerator.vue` | 固定底部，单行输入框，Enter发送，右侧发送按钮 |
| 🔴 | 9 | 桌面端创作区块标题改造 | 桌面端UI | CLAUDE.md#DesktopCreatePanel | `src/views/CardGenerator.vue` (右侧区块) | "AI创作助手"标题，右侧清空对话按钮 |
| 🔴 | 10 | 桌面端紧凑对话区域 | 桌面端UI | CLAUDE.md#桌面端紧凑样式 | `src/views/CardGenerator.vue` | 320px宽度限制，精简版消息展示，滚动区域 |
| 🔴 | 11 | 桌面端迷你卡片组件 | 桌面端组件 | CLAUDE.md#result-mini-card | `src/views/CardGenerator.vue` | 紧凑版结果卡片，60字符预览，预览和保存按钮 |
| 🔴 | 12 | 桌面端快捷模板图标 | 桌面端输入区 | CLAUDE.md#quick-templates | `src/views/CardGenerator.vue` | 仅显示emoji图标，32x32px按钮，hover显示名称 |
| 🔴 | 13 | 桌面端输入框适配 | 桌面端输入区 | CLAUDE.md#input-section | `src/views/CardGenerator.vue` | 2行文本框，Ctrl+Enter发送，自适应宽度 |
| 🔴 | 14 | 集成现有生成逻辑 | 核心功能 | CLAUDE.md#sendMessage | `src/views/CardGenerator.vue` | 调用generateCard函数，保持原有API调用 |
| 🔴 | 15 | 实现流式生成显示 | 流式传输 | 现有streamMessages逻辑 | `src/views/CardGenerator.vue` | 复用现有SSE流式传输，更新到对话消息中 |
| 🔴 | 16 | 消息预览功能集成 | 功能集成 | 现有previewContent逻辑 | `src/views/CardGenerator.vue` | 点击预览按钮调用现有预览逻辑 |
| 🔴 | 17 | 消息保存功能集成 | 功能集成 | 现有saveContent逻辑 | `src/views/CardGenerator.vue` | 保存到文件系统，刷新文件列表 |
| 🔴 | 18 | 消息分享功能实现 | 新功能 | 参考现有分享逻辑 | `src/views/CardGenerator.vue` | 生成分享链接，复制到剪贴板 |
| 🔴 | 19 | 对话历史滚动优化 | 用户体验 | scrollIntoView API | `src/views/CardGenerator.vue` | 新消息自动滚动到底部，平滑滚动效果 |
| 🔴 | 20 | 错误消息处理 | 错误处理 | try-catch错误处理 | `src/views/CardGenerator.vue` | 生成失败时显示错误卡片，提供重试按钮 |
| 🔴 | 21 | 清空对话功能 | 辅助功能 | clearChat方法 | `src/views/CardGenerator.vue` | 清空chatMessages数组，重置输入状态 |
| 🔴 | 22 | 模板选择状态同步 | 状态同步 | selectedTemplate ref | `src/views/CardGenerator.vue` | 快选按钮和下拉列表状态同步 |
| 🔴 | 23 | 输入状态管理 | 状态管理 | canSend computed | `src/views/CardGenerator.vue` | 禁用/启用发送按钮，生成中禁用输入 |
| 🔴 | 24 | 时间戳格式化 | 工具函数 | formatTime函数 | `src/views/CardGenerator.vue` | 显示消息发送时间，"刚刚"、"5分钟前"等 |
| 🔴 | 25 | 移动端响应式适配 | 响应式 | CSS媒体查询 | `src/views/CardGenerator.vue` | 适配不同屏幕尺寸，字体大小调整 |
| 🔴 | 26 | 桌面端响应式适配 | 响应式 | CSS媒体查询 | `src/views/CardGenerator.vue` | 保持320px宽度，高度自适应 |
| 🔴 | 27 | 暗色主题支持 | 主题适配 | CSS变量 | `src/views/CardGenerator.vue` | 适配现有暗色主题，调整颜色变量 |
| 🔴 | 28 | 加载状态优化 | 性能优化 | v-if条件渲染 | `src/views/CardGenerator.vue` | 虚拟滚动(可选)，懒加载历史消息 |
| 🔴 | 29 | 过渡动画效果 | 动画效果 | Vue Transition | `src/views/CardGenerator.vue` | 消息进入/离开动画，淡入淡出效果 |
| 🔴 | 30 | 键盘快捷键支持 | 快捷操作 | @keydown事件 | `src/views/CardGenerator.vue` | Esc清空输入，上下键历史记录(可选) |
| 🔴 | 31 | 本地存储对话历史 | 数据持久化 | localStorage | `src/views/CardGenerator.vue` | 保存最近10条对话，页面刷新恢复 |
| 🔴 | 32 | 单元测试编写 | 测试 | Jest/Vitest | `tests/ChatMode.spec.js` (新建) | 测试核心功能：发送、生成、预览等 |
| 🔴 | 33 | 集成测试 | 测试 | E2E测试 | `tests/e2e/chat-mode.js` (新建) | 完整流程测试，移动端和桌面端 |
| 🔴 | 34 | 性能监控埋点 | 监控 | Performance API | `src/views/CardGenerator.vue` | 生成时间、响应时间等指标 |
| 🔴 | 35 | 文档更新 | 文档 | README.md | `README.md`, `docs/chat-mode.md` (新建) | 更新使用说明，添加新功能介绍 |

---

## 🔄 任务依赖关系

### Phase 1: 基础架构 (任务 1-2, 14)
- 先完成数据结构和状态管理
- 确保与现有生成逻辑集成

### Phase 2: 移动端实现 (任务 3-8, 15-20)  
- 完成移动端界面和功能
- 优先级最高，因为移动端是主要使用场景

### Phase 3: 桌面端实现 (任务 9-13)
- 适配桌面端紧凑布局
- 复用移动端逻辑

### Phase 4: 功能完善 (任务 21-31)
- 辅助功能和优化
- 提升用户体验

### Phase 5: 测试和文档 (任务 32-35)
- 确保质量
- 更新文档

---

## ⚠️ 关键注意事项

### 技术约束
1. **不能改动其他模块** - 仅修改CardGenerator.vue中的创作相关部分
2. **保持API兼容** - 必须使用现有的generateCard等API
3. **样式隔离** - 新增样式需要合适的作用域，避免影响其他部分
4. **状态管理** - 聊天状态仅在组件内部管理，不影响全局store

### 设计约束
1. **移动端优先** - 先实现移动端，再适配桌面端
2. **渐进增强** - 保留原功能作为后备方案
3. **性能要求** - 对话历史最多保留50条消息
4. **响应式要求** - 必须适配各种屏幕尺寸

### 测试要求
1. **功能测试** - 每个功能点都需要测试
2. **兼容性测试** - iOS Safari、Android Chrome
3. **性能测试** - 50条消息时的滚动性能
4. **回归测试** - 确保不影响现有功能

---

## 📊 进度跟踪

### 统计信息
- **总任务数**: 35
- **已完成**: 0
- **进行中**: 0
- **待开始**: 35
- **完成率**: 0%

### 里程碑
- [ ] **M1**: 基础架构完成 (任务1-2, 14)
- [ ] **M2**: 移动端MVP完成 (任务3-8)
- [ ] **M3**: 桌面端完成 (任务9-13)
- [ ] **M4**: 功能完善 (任务21-31)
- [ ] **M5**: 测试通过 (任务32-33)
- [ ] **M6**: 文档完成 (任务35)

---

## 🚀 快速开始

### 开发流程
1. 从Phase 1开始，按顺序完成任务
2. 每完成一个任务，更新状态标记
3. 定期提交代码，避免大量改动
4. 完成Phase后进行集成测试

### 代码规范
- 使用Vue 3 Composition API
- 遵循现有代码风格
- 添加必要的注释
- 保持代码整洁

### 测试策略
- 单元测试覆盖核心逻辑
- 手动测试UI交互
- 多设备真机测试
- 性能profile分析

---

*创建时间: 2024-12-20*  
*最后更新: 2024-12-20*  
*版本: v1.0*