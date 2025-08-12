# AI Terminal - Transform Claude Code & Any CLI into REST API | One-Click Deploy

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker Ready](https://img.shields.io/badge/Docker-Ready-blue)](https://hub.docker.com/r/aixier/ai-terminal)
[![Claude Code API](https://img.shields.io/badge/Claude%20Code-API-purple)](CLAUDE_CODE_API.md)
[![Deploy Time](https://img.shields.io/badge/Deploy-30%20seconds-green)](DEMO.md)
[![GitHub stars](https://img.shields.io/github/stars/aixier/AI_Terminal?style=social)](https://github.com/aixier/AI_Terminal/stargazers)
[![GitHub last commit](https://img.shields.io/github/last-commit/aixier/AI_Terminal)](https://github.com/aixier/AI_Terminal/commits)
[![GitHub release](https://img.shields.io/github/v/release/aixier/AI_Terminal)](https://github.com/aixier/AI_Terminal/releases)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](docs/contributing/CONTRIBUTING.md)

> 🚀 **Universal CLI-to-API Platform** | Transform ANY CLI Tool into REST API | Claude Code, Gemini, Cursor & More | Streaming Support | Docker Ready

## 🌟 Vision: Democratizing Professional CLI Tools

**AI Terminal is evolving into a universal platform that transforms ANY professional CLI tool into accessible APIs.** Starting with Claude Code, expanding to Gemini CLI, Cursor, GPT CLI, and beyond!

### 🔥 Current Hot Feature: Claude Code API!

**Transform Claude Code into REST APIs with streaming support!** This is just the beginning - imagine having API access to every professional CLI tool.

### 🎬 [See Live Demo](DEMO.md) | 🚀 [Quick Start](CLAUDE_CODE_API_QUICKSTART.md) | 📖 [Full Docs](CLAUDE_CODE_API.md)

```bash
# Quick Start - Claude Code API in 30 seconds
docker run -d -p 8082:6000 aixier/ai-terminal:latest

# Test Claude Code API
curl -X POST http://localhost:8082/api/generate/card \
  -H "Content-Type: application/json" \
  -d '{"topic": "Your Topic"}'
```

📖 **[Full Claude Code API Documentation →](CLAUDE_CODE_API.md)** | **[Platform Vision →](VISION.md)** | **[2025 Roadmap →](ROADMAP_2025.md)**

## 🚀 Platform Roadmap - Coming Soon!

| CLI Tool | Status | Release | Features |
|----------|--------|---------|----------|
| **Claude Code** | ✅ Live | Now | Full API, Streaming, Knowledge Cards |
| **Gemini CLI** | 🚧 Development | Q1 2025 | Multimodal, Vision API |
| **Cursor CLI** | 📋 Planned | Q1 2025 | Code Editing, Refactoring |
| **GPT CLI** | 📋 Planned | Q2 2025 | GPT-4, Plugins |
| **Ollama** | 📋 Planned | Q2 2025 | Local Models, Privacy |
| **Your CLI** | 💡 [Request](https://github.com/aixier/AI_Terminal/issues) | TBD | Community Driven |

---

**AI Terminal** 是一个革命性的开源平台，将专业的命令行工具民主化，让每个人都能通过简单的API使用强大的CLI工具。从 Claude Code 开始，逐步支持所有主流AI CLI工具。

🔥 **Key Features**: Claude Code API, Claude CLI, Gemini CLI, Cursor CLI, Grok CLI, CLI to API, Web Terminal, One-Click Deploy, Codex CLI Integration

## ✨ 核心特性

### 🤖 AI智能终端
- **Claude集成**: 深度集成Anthropic Claude AI，支持自然语言命令
- **实时交互**: WebSocket驱动的实时终端体验
- **会话管理**: 智能会话隔离和资源管理
- **命令转API**: 将任何命令行工具转换为REST API

### 🎨 知识卡片系统
- **智能生成**: AI驱动的结构化知识卡片自动生成
- **丰富模板**: 多样化的卡片模板，适用于不同场景
- **实时预览**: 即时预览效果，所见即所得
- **多格式导出**: 支持JSON、HTML、PDF等多种格式

### 📱 响应式设计
- **移动优先**: 完整的移动端适配和触控优化
- **自适应布局**: 智能响应不同屏幕尺寸
- **原生体验**: 类原生应用的交互体验

### 🔧 开发者友好
- **API优先**: 完整的REST API和实时通信支持
- **容器化**: 完整的Docker支持，一键部署
- **可扩展**: 模块化架构，易于扩展和定制
- **文档完善**: 详细的开发和部署文档

## 🚀 快速开始

### 🐳 Docker部署（推荐）

```bash
# 克隆项目
git clone https://github.com/aixier/AI_Terminal.git
cd AI_Terminal

# 构建并运行
docker build -t ai-terminal .
docker run -d -p 8080:6000 \
  -e ANTHROPIC_AUTH_TOKEN=your_token \
  -e ANTHROPIC_BASE_URL=your_base_url \
  ai-terminal
```

### 💻 本地开发

```bash
# 安装依赖
npm install

# 后端开发
cd terminal-backend
npm install
npm run dev

# 前端开发（新终端）
cd terminal-ui  
npm install
npm run dev
```

### 🌐 在线访问

部署完成后访问 `http://localhost:8080` 即可使用完整功能。

## 📖 文档导航

### 📚 用户指南
- [🚀 快速入门](docs/user-guides/quickstart.md) - 5分钟上手指南
- [🎨 卡片生成](docs/user-guides/card-generation.md) - 知识卡片创建与管理
- [🖥️ 终端使用](docs/user-guides/terminal-usage.md) - AI终端操作指南
- [📱 移动端使用](docs/user-guides/mobile-guide.md) - 移动设备使用指南

### 🛠️ 开发指南
- [🏗️ 架构概览](docs/architecture/system-architecture.md) - 系统架构设计
- [⚡ 命令转API](docs/developer-guides/command-to-api.md) - 命令行API化指南
- [🔌 API文档](docs/api/README.md) - 完整API参考
- [🎨 前端开发](docs/developer-guides/frontend-development.md) - UI开发指南
- [🔧 后端开发](docs/developer-guides/backend-development.md) - 服务端开发

### 🚀 部署运维  
- [🐳 Docker部署](docs/deployment/docker.md) - 容器化部署方案
- [☁️ 云平台部署](docs/deployment/cloud-deployment.md) - 各云平台部署指南
- [🔧 配置管理](docs/deployment/configuration.md) - 环境配置说明

### 🤝 贡献指南
- [📋 贡献指南](docs/contributing/CONTRIBUTING.md) - 如何参与项目
- [🐛 问题报告](docs/contributing/bug-report.md) - Bug反馈模板
- [💡 功能建议](docs/contributing/feature-request.md) - 新功能建议

## 🛠️ 技术栈

### 前端技术
- **框架**: Vue 3 + TypeScript
- **构建**: Vite + ESBuild  
- **UI库**: Element Plus + 自定义组件
- **状态管理**: Pinia
- **通信**: Socket.io + Axios
- **样式**: CSS3 + 响应式设计

### 后端技术
- **运行时**: Node.js 18+
- **框架**: Express.js
- **实时通信**: Socket.io + WebSocket
- **终端**: node-pty
- **AI集成**: Anthropic Claude API
- **容器化**: Docker + Multi-stage Build

### 基础设施
- **部署**: Docker + Docker Compose
- **代理**: Nginx（可选）
- **监控**: 内置健康检查
- **日志**: 结构化日志系统

## 📊 项目结构

```
AI_Terminal/
├── 📁 docs/                    # 📖 项目文档
│   ├── user-guides/            # 👤 用户指南
│   ├── developer-guides/       # 🛠️ 开发指南  
│   ├── api/                    # 🔌 API文档
│   ├── deployment/             # 🚀 部署文档
│   ├── architecture/           # 🏗️ 架构文档
│   └── contributing/           # 🤝 贡献指南
├── 📁 terminal-backend/        # 🔧 后端服务
│   ├── src/                    # 📝 源代码
│   ├── services/               # 🔄 核心服务
│   └── routes/                 # 🛣️ API路由
├── 📁 terminal-ui/             # 🎨 前端应用
│   ├── src/                    # 📝 源代码
│   ├── components/             # 🧩 Vue组件
│   └── views/                  # 📄 页面视图
├── 📁 serverless/              # ☁️ 无服务器部署
└── 🐳 Dockerfile              # 📦 容器配置
```

## 🎯 核心功能展示

### 🤖 AI终端交互
```bash
# 自然语言命令
> 帮我生成一个关于机器学习的知识卡片

# 文件操作
> 在data/cards目录创建新的卡片文件

# 智能建议
> 优化这个JSON结构的可读性
```

### 🎨 知识卡片生成
- **智能模板**: 根据主题自动选择最适合的模板
- **结构化数据**: 生成标准化的JSON格式卡片
- **即时预览**: 实时查看卡片的渲染效果
- **批量处理**: 支持批量生成和管理

### 📱 移动端体验
- **触控优化**: 专为触屏设备优化的交互
- **离线支持**: 核心功能支持离线使用
- **手势操作**: 支持滑动、缩放等手势
- **响应式布局**: 完美适配各种屏幕尺寸

## 🔗 相关链接

- [📖 在线文档](https://your-docs-site.com) 
- [🐛 问题反馈](https://github.com/aixier/AI_Terminal/issues)
- [💬 讨论区](https://github.com/aixier/AI_Terminal/discussions)
- [📦 Docker镜像](https://hub.docker.com/r/your-username/ai-terminal)

## 📄 开源协议

本项目基于 [MIT License](LICENSE) 开源协议。

## 🙏 致谢

感谢以下开源项目和贡献者：

- [Vue.js](https://vuejs.org/) - 渐进式JavaScript框架
- [Element Plus](https://element-plus.org/) - Vue 3组件库
- [Anthropic Claude](https://www.anthropic.com/) - AI语言模型
- [Socket.io](https://socket.io/) - 实时通信库
- 所有为本项目贡献代码的开发者们

## 📞 联系我们

- 项目维护者: [@aixier](https://github.com/aixier)
- 邮箱: your-email@example.com
- 官网: https://your-website.com

---

⭐ 如果这个项目对你有帮助，请给我们一个Star支持！