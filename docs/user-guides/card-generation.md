# 🎨 知识卡片生成指南

本指南将详细介绍如何使用AI Terminal创建、管理和导出知识卡片。

## 📖 概述

AI Terminal的知识卡片系统是一个智能的内容生成和管理平台，通过AI技术帮助用户快速创建结构化的知识内容。

## 🚀 快速开始

### 1. 创建第一张卡片

#### 通过Web界面创建
1. 打开AI Terminal应用
2. 切换到"卡片生成"页面
3. 在主题输入框中输入您想要的主题
4. 选择合适的模板（可选）
5. 点击"生成卡片"按钮

#### 通过终端创建
```bash
# 使用默认模板
> 生成一张关于"机器学习基础"的知识卡片

# 指定模板
> 根据daily-knowledge-card模板生成"Python编程技巧"卡片
```

### 2. 模板选择

系统提供多种预设模板：

- **daily-knowledge-card**: 日常知识卡片模板
- **tech-tutorial**: 技术教程模板  
- **concept-explanation**: 概念解释模板
- **step-by-step**: 步骤指导模板

## 📝 卡片创建详解

### 🎯 主题制定

好的主题是成功卡片的基础：

**✅ 推荐主题格式**
- "机器学习中的梯度下降算法"
- "Vue.js组件通信的5种方式"
- "Docker容器网络配置指南"

**❌ 避免的主题格式**
- "学习"（过于宽泛）
- "如何做饭炒菜做饭"（重复啰嗦）
- "?????"（无意义字符）

### 📋 模板详解

#### Daily Knowledge Card 模板
适用于日常知识科普类内容
```json
{
  "theme": {
    "name": "daily-knowledge-series",
    "category": "education",
    "style": "modern-card"
  },
  "content": {
    "title": "每日一条XX知识",
    "subtitle": "科普向知识卡片",
    "sections": [...]
  }
}
```

**特点**:
- 适合科普向内容
- 语言通俗易懂
- 结构清晰层次分明

#### Tech Tutorial 模板  
适用于技术教程类内容
```json
{
  "theme": {
    "name": "tech-tutorial",
    "category": "programming", 
    "style": "step-by-step"
  },
  "content": {
    "title": "技术教程",
    "prerequisites": [...],
    "steps": [...],
    "examples": [...]
  }
}
```

**特点**:
- 强调动手实践
- 包含代码示例
- 循序渐进的学习路径

### 🔄 生成流程

1. **主题解析**: AI分析主题关键词和领域
2. **模板匹配**: 根据主题自动选择最适合的模板
3. **内容生成**: 基于模板结构生成完整内容
4. **格式化输出**: 生成标准化JSON格式
5. **预览渲染**: 实时渲染卡片效果

## 📱 移动端使用

### 触控操作
- **点击**: 选择模板、输入主题
- **滑动**: 浏览模板列表、查看卡片
- **长按**: 快速操作菜单

### 移动端专属功能
- **一键分享**: 直接分享到社交平台
- **离线预览**: 本地预览生成的卡片
- **语音输入**: 通过语音输入主题（需要浏览器支持）

## 🔧 高级功能

### 批量生成
```bash
# 生成多个相关主题的卡片
> 批量生成编程语言系列卡片：Python, JavaScript, Go, Rust

# 从文件批量生成
> 根据topics.txt文件批量生成卡片
```

### 自定义模板
创建自己的模板文件：
```json
{
  "theme": {
    "name": "my-custom-template",
    "description": "我的自定义模板"
  },
  "structure": {
    "sections": [
      {
        "type": "title",
        "required": true
      },
      {
        "type": "content", 
        "required": true
      }
    ]
  }
}
```

### API调用生成
```javascript
// 通过API生成卡片
const response = await fetch('/api/generate/card', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    topic: '深度学习基础概念',
    templateName: 'daily-knowledge-card-template.md'
  })
})

const result = await response.json()
console.log('生成的卡片:', result.data.content)
```

## 📤 导出和分享

### 支持的导出格式
- **JSON**: 原始数据格式，适合二次开发
- **HTML**: 网页格式，适合在线分享
- **PNG**: 图片格式，适合社交媒体
- **PDF**: 文档格式，适合打印保存

### 导出操作
1. 选择要导出的卡片
2. 点击"导出"按钮
3. 选择导出格式
4. 下载到本地或获取分享链接

### 分享链接
系统会为每张卡片生成唯一的分享链接：
```
https://your-domain.com/card/share/abc123
```

## 🎨 自定义和美化

### 主题配色
系统根据内容类型自动选择配色方案：
- **科技类**: 蓝绿渐变
- **生活类**: 橙黄渐变  
- **健康类**: 绿色渐变
- **心理类**: 紫色渐变

### 布局调整
- **紧凑模式**: 适合移动端查看
- **标准模式**: 适合桌面端展示
- **演示模式**: 适合大屏幕演示

## 🔍 管理和搜索

### 文件夹管理
- 按主题创建文件夹
- 支持嵌套文件夹结构
- 快速移动和整理卡片

### 搜索功能
- **关键词搜索**: 按标题、内容搜索
- **标签搜索**: 按标签快速筛选
- **时间搜索**: 按创建时间范围查找

### 历史记录
- 查看最近生成的卡片
- 访问历史记录
- 恢复已删除的卡片

## 📊 使用技巧

### 🎯 提高生成质量
1. **明确主题**: 使用具体、明确的主题描述
2. **选对模板**: 根据内容类型选择合适模板
3. **iterative**: 根据生成结果iterative优化主题

### ⚡ 提高效率
1. **快捷键**: 使用键盘快捷键快速操作
2. **模板收藏**: 收藏常用模板
3. **批量操作**: 一次性处理多个卡片

### 🔧 故障排除
- **生成失败**: 检查网络连接和API配置
- **预览空白**: 清除浏览器缓存后重试
- **导出错误**: 确认有足够的存储空间

## 📞 获取帮助

如果在使用过程中遇到问题：

1. 查看[常见问题解答](../user-guides/faq.md)
2. 查阅[API文档](../api/README.md)
3. 提交[问题反馈](../contributing/bug-report.md)
4. 加入[社区讨论](https://github.com/aixier/AI_Terminal/discussions)

---

🎉 现在您已经掌握了知识卡片生成的核心技能，开始创建属于您的知识库吧！