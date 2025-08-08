# Terminal UI 前端重新设计文档

## 📋 项目概述

Terminal UI 是一个现代化的 Web 终端应用，采用 VS Code 风格的界面设计，提供卡片生成、终端控制和模板管理等功能。

## 🎯 设计目标

1. **现代化视觉体验** - 采用 GitHub Dark Theme 设计语言
2. **优秀的用户体验** - 直观的交互和流畅的动画
3. **高性能** - 虚拟滚动、代码分割、懒加载
4. **可维护性** - 模块化架构、设计系统、TypeScript
5. **无障碍** - WCAG 2.1 AA 标准支持

## 🏗️ 新架构设计

```
terminal-ui/
├── src/
│   ├── design-system/          # 设计系统
│   │   ├── tokens/             # 设计令牌
│   │   │   ├── colors.ts       # 色彩系统
│   │   │   ├── typography.ts   # 字体系统
│   │   │   ├── spacing.ts      # 间距系统
│   │   │   ├── shadows.ts      # 阴影系统
│   │   │   └── animations.ts   # 动画系统
│   │   ├── components/         # 基础组件库
│   │   │   ├── Button/
│   │   │   ├── Card/
│   │   │   ├── Input/
│   │   │   ├── Modal/
│   │   │   ├── Tabs/
│   │   │   └── Tree/
│   │   └── patterns/          # 设计模式
│   │       ├── SplitView/
│   │       ├── ActivityBar/
│   │       └── StatusBar/
│   ├── layouts/               # 布局系统
│   │   ├── VSCodeLayout/      # VS Code 风格布局
│   │   ├── IDELayout/         # IDE 布局
│   │   └── MinimalLayout/     # 极简布局
│   ├── features/              # 功能模块
│   │   ├── card-generator/    # 卡片生成器
│   │   ├── terminal/          # 终端管理
│   │   ├── explorer/          # 文件浏览器
│   │   └── templates/         # 模板管理
│   ├── shared/                # 共享资源
│   │   ├── composables/       # 组合式函数
│   │   ├── directives/        # 自定义指令
│   │   ├── utils/             # 工具函数
│   │   └── types/             # TypeScript 类型
│   └── theme/                 # 主题系统
│       ├── dark.ts            # 深色主题
│       ├── light.ts           # 浅色主题
│       └── high-contrast.ts   # 高对比度主题
```

## 🎨 设计系统

### 色彩体系

#### 品牌色
- Primary: `#0969da` - 主要操作
- Secondary: `#58a6ff` - 次要操作
- Accent: `#539bf5` - 强调元素

#### 语义色
- Success: `#3fb950` - 成功状态
- Warning: `#d29922` - 警告状态
- Error: `#f85149` - 错误状态
- Info: `#58a6ff` - 信息提示

#### 中性色（GitHub Dark Theme）
- Canvas: `#0d1117` - 画布背景
- Default: `#161b22` - 默认背景
- Overlay: `#1c2128` - 覆盖层
- Inset: `#010409` - 内嵌背景
- Subtle: `#262c36` - 细微背景

### 间距系统（8px 网格）
- xxs: 4px (0.5x)
- xs: 8px (1x)
- sm: 12px (1.5x)
- md: 16px (2x)
- lg: 24px (3x)
- xl: 32px (4x)
- xxl: 48px (6x)
- xxxl: 64px (8x)

### 字体系统
```css
--font-family-default: 'Segoe UI', system-ui, -apple-system, sans-serif;
--font-family-mono: 'SF Mono', Monaco, 'Cascadia Code', monospace;

--font-size-xs: 11px;
--font-size-sm: 12px;
--font-size-md: 13px;
--font-size-lg: 14px;
--font-size-xl: 16px;
--font-size-xxl: 20px;

--font-weight-normal: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;
```

### 动画系统
```css
--duration-instant: 100ms;
--duration-fast: 200ms;
--duration-normal: 300ms;
--duration-slow: 500ms;

--easing-default: cubic-bezier(0.4, 0, 0.2, 1);
--easing-ease-in: cubic-bezier(0.4, 0, 1, 1);
--easing-ease-out: cubic-bezier(0, 0, 0.2, 1);
--easing-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
```

## 🔧 核心功能模块

### 1. 卡片生成器 (Card Generator)
- **文件浏览器**: 树形结构展示卡片文件夹
- **预览区**: 实时预览生成的卡片
- **模板选择**: 多种预设模板
- **主题输入**: Markdown 支持的富文本输入
- **终端集成**: 实时显示生成过程

### 2. 终端管理 (Terminal Manager)
- **多标签支持**: 同时管理多个终端会话
- **分屏功能**: 水平/垂直分割
- **主题定制**: 多种终端主题
- **快捷键**: 完整的快捷键支持

### 3. 模板系统 (Template System)
- **模板市场**: 浏览和下载社区模板
- **自定义模板**: 创建和编辑个人模板
- **模板预览**: 实时预览模板效果
- **版本管理**: 模板版本控制

## 📐 布局设计

### VS Code 布局结构
```
┌─────────┬──────────────────────────────────┬─────────┐
│ Activity│          Editor Area              │  Side   │
│   Bar   │  ┌────────────────────────────┐  │  Panel  │
│         │  │      Preview/Content       │  │         │
│ [Icons] │  ├────────────────────────────┤  │ [Tools] │
│         │  │      Terminal Panel        │  │         │
│         │  └────────────────────────────┘  │         │
├─────────┴──────────────────────────────────┴─────────┤
│                    Status Bar                         │
└────────────────────────────────────────────────────────┘
```

### 响应式断点
- Mobile: < 640px
- Tablet: 768px - 1023px
- Laptop: 1024px - 1279px
- Desktop: 1280px - 1535px
- Wide: > 1536px

## 🚀 性能优化

### 代码分割
- 路由级别的懒加载
- 组件按需加载
- 第三方库分包

### 虚拟化
- 长列表虚拟滚动
- 虚拟化树形结构
- 终端输出虚拟化

### 缓存策略
- Service Worker 缓存
- IndexedDB 本地存储
- Memory Cache 内存缓存

## ♿ 无障碍设计

### WCAG 2.1 AA 合规
- 颜色对比度 ≥ 4.5:1 (普通文本)
- 颜色对比度 ≥ 3:1 (大文本)
- 键盘导航完整支持
- 屏幕阅读器标签
- 焦点管理

### 键盘快捷键
- `Ctrl/Cmd + B`: 切换侧边栏
- `Ctrl/Cmd + J`: 切换终端面板
- `Ctrl/Cmd + P`: 快速打开
- `Ctrl/Cmd + Shift + P`: 命令面板
- `Ctrl/Cmd + \`: 分割编辑器

## 📦 技术栈

### 核心依赖
- **Vue 3.4+**: 渐进式框架
- **TypeScript 5.3+**: 类型安全
- **Vite 5.0+**: 构建工具
- **Pinia 2.1+**: 状态管理
- **Vue Router 4.2+**: 路由管理

### UI 组件
- **Headless UI**: 无样式组件
- **Floating UI**: 浮动定位
- **VueUse**: 组合式工具集

### 开发工具
- **ESLint**: 代码规范
- **Prettier**: 代码格式化
- **Husky**: Git Hooks
- **Vitest**: 单元测试
- **Playwright**: E2E 测试
- **Storybook**: 组件文档

## 📝 开发规范

### 命名规范
- **组件**: PascalCase (如 `CardGenerator.vue`)
- **组合式函数**: camelCase with 'use' prefix (如 `useTheme()`)
- **常量**: UPPER_SNAKE_CASE (如 `MAX_FILE_SIZE`)
- **CSS 类**: kebab-case with BEM (如 `card-item__title--active`)

### 代码风格
- 使用 Composition API
- 使用 `<script setup>` 语法
- 使用 TypeScript
- 遵循 ESLint 规则

### Git 提交规范
- feat: 新功能
- fix: 修复 bug
- docs: 文档更新
- style: 代码格式
- refactor: 重构
- perf: 性能优化
- test: 测试相关
- chore: 构建/工具

## 🔄 迁移计划

### 第一阶段：基础设施 (Week 1)
- [ ] 设计系统搭建
- [ ] TypeScript 配置
- [ ] 构建工具优化
- [ ] 测试环境搭建

### 第二阶段：核心组件 (Week 2)
- [ ] 基础组件库
- [ ] 布局系统
- [ ] 主题系统
- [ ] 路由配置

### 第三阶段：功能迁移 (Week 3-4)
- [ ] 卡片生成器重构
- [ ] 终端组件优化
- [ ] 模板系统实现
- [ ] 文件浏览器

### 第四阶段：优化测试 (Week 5)
- [ ] 性能优化
- [ ] 单元测试
- [ ] E2E 测试
- [ ] 无障碍测试

### 第五阶段：部署上线 (Week 6)
- [ ] 生产构建
- [ ] CI/CD 配置
- [ ] 监控集成
- [ ] 文档完善

## 📊 成功指标

### 性能指标
- First Contentful Paint (FCP) < 1.5s
- Time to Interactive (TTI) < 3.5s
- Cumulative Layout Shift (CLS) < 0.1
- 包体积 < 300KB (gzipped)

### 用户体验指标
- 任务完成率 > 90%
- 用户满意度 > 4.5/5
- 错误率 < 1%
- 平均响应时间 < 200ms

## 🔗 相关资源

- [设计稿](./design)
- [组件文档](./storybook)
- [API 文档](./api-docs)
- [测试报告](./test-reports)
- [性能报告](./performance)

---

*最后更新: 2024-08-06*