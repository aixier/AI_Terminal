# AI Terminal 项目文档中心

## 📚 文档目录

### 🎯 核心文档
- [**API 文档**](./API_DOCUMENTATION.md) - 完整的 RESTful API 接口文档 (v4.5.0)
- [**功能特性**](./FEATURES.md) - 系统功能特性详解
- [**项目愿景**](./VISION.md) - 项目愿景与发展目标
- [**发展路线图**](./ROADMAP_2025.md) - 2025年产品路线图

### 🚀 功能模块文档
- [**自定义模式**](./CUSTOM_MODE_DOCUMENTATION.md) - 自定义模式完整指南 (v4.5.0 新功能)
- [**素材管理系统**](./ASSET_MANAGEMENT_DOCUMENTATION.md) - 素材上传、分类与引用
- [**JSON 修复 API**](./JSON_REPAIR_API.md) - JSON 格式修复服务

### 🔧 技术文档
- [**异步 API 流程**](./async-api-usage-flow.md) - 异步接口使用指南
- [**Claude 集成**](./node-pty-claude-integration.md) - Node PTY 与 Claude CLI 集成
- [**模板处理对比**](./template-async-processing-comparison.md) - 同步与异步处理方案对比
- [**聊天输入流程**](./chat-input-flow-analysis.md) - 聊天输入组件架构分析

### 📖 参考资料
- [**Claude Code CLI**](./claude-code-cli-reference.md) - Claude Code 命令行工具参考
- [**SEO 策略**](./SEO_KEYWORDS.md) - 搜索引擎优化关键词
- [**API Schema 报告**](./api-schema-report.md) - API 结构分析报告

## 🎉 最新版本 v4.5.0

### 发布日期
2025年9月5日

### 主要更新
- ✨ **自定义模式** - 支持 `@文件引用` 生成任意格式文件
- 📄 **Markdown 预览** - 内置文件预览组件，支持多种格式
- 📁 **文件操作增强** - 查看、下载、刷新文件列表
- 🔧 **技术优化** - 修复 URL 编码、路径拼接等问题
- 📱 **移动端适配** - 优化移动设备使用体验

## 🚀 快速开始

### 1. 环境准备
```bash
# Node.js >= 16.x
# Docker >= 20.x (可选)
```

### 2. 安装部署
请参考主项目 [README.md](../README.md)

### 3. 功能使用
- [使用自定义模式](./CUSTOM_MODE_DOCUMENTATION.md#使用流程)
- [管理素材文件](./ASSET_MANAGEMENT_DOCUMENTATION.md#使用场景)
- [调用 API 接口](./API_DOCUMENTATION.md)

## 📊 文档结构说明

### 整合后的文档
| 原文档 | 整合到 | 说明 |
|--------|--------|------|
| custom-mode-*.md (5个文件) | CUSTOM_MODE_DOCUMENTATION.md | 自定义模式所有相关内容 |
| asset-management-*.md (5个文件) | ASSET_MANAGEMENT_DOCUMENTATION.md | 素材管理所有相关内容 |
| 多个 API 文档片段 | API_DOCUMENTATION.md | 完整 API 接口文档 |

### 文档分类
- **核心文档**: 项目整体相关
- **功能文档**: 具体功能模块
- **技术文档**: 技术实现细节
- **参考文档**: 辅助参考资料

## 🔄 文档维护记录

### 2025-09-05
- ✅ 整合 5 个自定义模式文档为 CUSTOM_MODE_DOCUMENTATION.md
- ✅ 合并 5 个素材管理文档为 ASSET_MANAGEMENT_DOCUMENTATION.md  
- ✅ 更新 API_DOCUMENTATION.md 至 v4.5.0
- ✅ 重构文档目录结构

### 待删除文档（已整合）
以下文档内容已整合到新文档中，建议删除：
- custom-mode-completion-report.md
- custom-mode-design.md
- custom-mode-file-generation-design.md
- custom-mode-final-summary.md
- custom-mode-implementation-tasks.md
- asset-management-design.md
- asset-management-final-ux.md
- asset-management-three-column-layout.md
- asset-management-ux-update.md
- assets-metadata-final-solution.md

## 📝 贡献指南

### 文档规范
1. **语言**: 中文为主，技术术语使用英文
2. **格式**: Markdown (GFM)
3. **结构**: 清晰的层级和目录
4. **示例**: 包含代码示例和使用场景
5. **版本**: 标注文档版本和更新日期

### 提交流程
1. Fork 项目仓库
2. 创建文档分支
3. 编写或更新文档
4. 提交 Pull Request
5. 等待审核合并

## 🛠 技术栈

- **前端**: Vue 3 + Vite + Element Plus
- **后端**: Node.js + Express
- **AI**: Claude API + Gemini API
- **终端**: XTerm.js + node-pty
- **容器**: Docker + Docker Compose

## 📞 联系与支持

- **GitHub**: [https://github.com/aixier/AI_Terminal](https://github.com/aixier/AI_Terminal)
- **Issues**: [报告问题](https://github.com/aixier/AI_Terminal/issues)
- **Discussions**: [参与讨论](https://github.com/aixier/AI_Terminal/discussions)

## 📄 许可证

MIT License - 详见 [LICENSE](../LICENSE)

---

*文档版本: v4.5.0 | 更新日期: 2025-09-05 | 作者: AI Terminal Team*