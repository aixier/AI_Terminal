# 更新日志

本文档记录AI Terminal项目的重要变更。

## [未发布] - 2025-08-12

### 📖 文档重构
- **BREAKING**: 重组项目文档结构，符合开源项目标准
- **新增**: 完整的文档中心 `docs/`
- **新增**: 标准化的用户指南、开发指南、API文档
- **新增**: 详细的贡献指南和代码规范
- **移动**: 将分散的.md文件整理到对应目录

### 📁 文档目录结构
```
docs/
├── 📚 user-guides/          # 用户指南
│   ├── quickstart.md        # 快速入门
│   ├── card-generation.md   # 卡片生成指南
│   ├── terminal-usage.md    # 终端使用指南
│   └── mobile-guide.md      # 移动端指南
├── 🛠️ developer-guides/     # 开发指南
│   ├── command-to-api.md    # 命令转API开发指南
│   └── responsive-design.md # 响应式设计
├── 🔌 api/                  # API文档
│   └── README.md            # API总览
├── 🚀 deployment/           # 部署文档
│   ├── docker.md            # Docker部署
│   ├── cloud-deployment.md  # 云平台部署
│   ├── configuration.md     # 配置管理
│   ├── aliyun-fc.md         # 阿里云部署
│   └── simple-deployment.md # 简单部署
├── 🏗️ architecture/         # 架构文档
│   └── system-architecture.md # 系统架构
└── 🤝 contributing/         # 贡献指南
    ├── CONTRIBUTING.md      # 贡献指南
    ├── bug-report.md        # Bug反馈模板
    ├── feature-request.md   # 功能建议模板
    └── code-style.md        # 代码规范
```

### ✨ 新增功能
- **命令转API开发指南**: 完整的命令行工具API化指南
- **移动端使用指南**: 详细的移动端操作和优化指南
- **云平台部署指南**: 覆盖阿里云、AWS、Azure等主流平台
- **代码规范**: 前端、后端、测试的完整代码规范

### 🔄 改进
- **文档导航**: README中新增完整的文档导航链接
- **标准化**: 采用开源项目标准的文档结构
- **用户体验**: 按用户角色组织文档，便于查找

### 📱 移动端
- **继续优化**: 移动端CardGenerator界面优化
- **Tab导航**: 完善底部导航栏的用户体验

## [v1.2.0] - 2025-08-12

### 🎨 响应式设计
- **新增**: 完整的移动端响应式界面
- **新增**: 移动端专用Tab导航
- **新增**: 触控优化的交互设计
- **优化**: 移动端卡片生成体验

### 🤖 AI功能增强
- **新增**: Claude命令行集成
- **新增**: 智能知识卡片生成
- **新增**: 实时终端交互
- **优化**: API化的命令执行

### 🔧 技术改进
- **新增**: Docker容器化支持
- **新增**: 多环境部署配置
- **优化**: 前后端分离架构
- **优化**: WebSocket实时通信

---

## 版本标识说明

- **[未发布]**: 正在开发中的功能
- **BREAKING**: 破坏性变更，需要注意升级
- **新增**: 新功能或新特性
- **优化**: 现有功能的改进
- **修复**: Bug修复
- **移除**: 已删除的功能