# AI Terminal - 全球首个AI智能终端平台

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker Ready](https://img.shields.io/badge/Docker-Ready-blue)](https://hub.docker.com/r/coopotfan/ai-terminal)
[![GitHub stars](https://img.shields.io/github/stars/aixier/AI_Terminal?style=social)](https://github.com/aixier/AI_Terminal/stargazers)
[![Node.js](https://img.shields.io/badge/Node.js-v22+-green)](https://nodejs.org/)
[![Vue.js](https://img.shields.io/badge/Vue.js-v3.0+-4FC08D)](https://vuejs.org/)
[![GitHub Issues](https://img.shields.io/github/issues/aixier/AI_Terminal)](https://github.com/aixier/AI_Terminal/issues)
[![GitHub Forks](https://img.shields.io/github/forks/aixier/AI_Terminal)](https://github.com/aixier/AI_Terminal/network)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/aixier/AI_Terminal/pulls)

[🇺🇸 English](./README.md) | [🇨🇳 中文](./README_CN.md) | [📖 文档](./docs/) | [🐳 Docker Hub](https://hub.docker.com/r/coopotfan/ai-terminal) | [💬 讨论](https://github.com/aixier/AI_Terminal/discussions)

</div>

## 🚀 革命性的AI智能终端平台

> 一句话，让AI替你敲命令。不懂命令行也能完成复杂操作；懂命令行就更快更稳。

**AI Terminal** 是全球首个开源的基于Web的终端平台，无缝集成多个AI助手（Claude AI + Gemini AI）与生产级终端界面。通过智能代码辅助、实时协作和企业级AI工具来转变您的开发工作流程 - 全部通过浏览器访问。

> **🎯 完美适用于**: 开发者、研究人员、DevOps团队、AI爱好者、教育机构和企业开发团队

### ✨ AI Terminal的独特之处

🌟 **全球首个AI集成的Web终端** - 开发者工具的突破性创新  
🤖 **双AI引擎** - Claude AI + Gemini AI协同工作  
🌐 **零安装** - 完全在浏览器中运行  
🐳 **一键部署** - Docker即刻部署  
🔧 **生产就绪** - 企业级架构  
📱 **跨平台** - 支持桌面、平板和移动设备  

---

## 🎉 最新版本: v2.3.1 "AI革命"

### 🆕 突破性功能
- **🤖 手动AI CLI初始化** - 革命性的一键AI设置
- **💎 独立AI管理** - Claude和Gemini独立控制
- **🎨 增强用户体验** - 美观的响应式界面，实时反馈
- **⚡ 性能优化** - 更快启动和改进的资源管理
- **🔧 更好的错误处理** - 智能故障排除和用户指导

### 🚀 快速开始（30秒）
```bash
# 使用Docker即时部署
docker run -d -p 6000:6000 coopotfan/ai-terminal:latest

# 打开浏览器访问: http://localhost:6000
# 点击 🤖 初始化Claude AI 或 💎 初始化Gemini AI
```

---

## 🌟 核心功能与能力

### 🤖 **多AI集成引擎**
- **Claude AI集成** - 先进的推理、代码生成和分析
- **Gemini AI集成** - 多功能内容创建和多模态AI
- **手动初始化系统** - 按需AI工具设置，可视化反馈
- **智能上下文管理** - 持久的AI对话上下文
- **错误恢复** - 自动AI会话恢复

### 🌐 **先进的Web终端**
- **完整的xterm.js实现** - 浏览器中的完整终端模拟
- **实时WebSocket通信** - 低延迟双向通信
- **会话管理** - 持久的终端会话，自动重连
- **多会话支持** - 同时处理多个终端实例
- **跨平台兼容** - 支持Windows、macOS、Linux、iOS、Android

### 📊 **知识卡片生成系统**
- **AI驱动的内容创建** - 生成结构化知识卡片
- **多模板系统** - 不同内容类型的专业布局
- **实时预览** - 即时预览，响应式设计测试
- **导出功能** - HTML、JSON和可分享链接格式
- **模板管理** - 上传、自定义和分享模板

### 🔧 **开发者体验**
- **REST API网关** - 将终端命令转换为HTTP API
- **流式支持** - 长时间运行进程的实时输出流
- **环境管理** - 通过环境变量灵活配置
- **日志和监控** - 结构化输出的全面日志记录
- **安全功能** - JWT认证、CORS保护、输入验证

### 🎨 **现代UI/UX设计**
- **Fluent设计系统** - Microsoft Fluent UI组件
- **响应式布局** - 针对所有屏幕尺寸和方向优化
- **深色主题优化** - 适合长时间编码的护眼界面
- **实时指示器** - 所有操作和状态的可视化反馈
- **无障碍功能** - 符合WCAG的界面设计

---

## 🚀 安装与部署

### 选项1: Docker部署（推荐）
```bash
# 基础部署
docker run -d \
  --name ai-terminal \
  -p 6000:6000 \
  coopotfan/ai-terminal:latest

# 高级部署（包含AI Token）
docker run -d \
  --name ai-terminal \
  -p 6000:6000 \
  -e ANTHROPIC_AUTH_TOKEN="your_claude_token" \
  -e GEMINI_API_KEY="your_gemini_key" \
  -e NODE_ENV=production \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  --restart unless-stopped \
  coopotfan/ai-terminal:latest
```

### 选项2: Docker Compose
```yaml
version: '3.8'
services:
  ai-terminal:
    image: coopotfan/ai-terminal:latest
    container_name: ai-terminal
    ports:
      - "6000:6000"
    environment:
      - NODE_ENV=production
      - ANTHROPIC_AUTH_TOKEN=${ANTHROPIC_AUTH_TOKEN}
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - MAX_TERMINAL_SESSIONS=20
      - TERMINAL_TIMEOUT=1800000
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    restart: unless-stopped
```

### 选项3: 开发环境搭建
```bash
# 克隆仓库
git clone https://github.com/aixier/AI_Terminal.git
cd AI_Terminal

# 安装依赖
npm install

# 设置环境变量
cp .env.example .env
# 编辑.env文件，填入您的AI API Token

# 启动后端开发服务器
cd terminal-backend
npm install
npm run dev

# 启动前端开发服务器（新终端窗口）
cd terminal-ui
npm install
npm run dev

# 访问开发服务器 http://localhost:5173
```

---

## 🔧 配置与环境

### 必要的环境变量
```bash
# AI服务配置
ANTHROPIC_AUTH_TOKEN=你的Claude_API令牌
ANTHROPIC_BASE_URL=https://api.anthropic.com
GEMINI_API_KEY=你的Google_Gemini密钥

# 服务器配置
PORT=6000
NODE_ENV=production
HOST=0.0.0.0

# 安全配置
JWT_SECRET=你的安全JWT密钥
JWT_EXPIRE_TIME=24h
CORS_ORIGINS=*

# 终端配置
MAX_TERMINAL_SESSIONS=10
TERMINAL_TIMEOUT=600000
ENABLE_TERMINAL_LOGGING=true

# 性能配置
MEMORY_LIMIT=512m
CPU_LIMIT=1.0
WORKER_PROCESSES=1
```

### 高级配置
```bash
# 数据库配置（可选）
DATABASE_URL=postgresql://user:pass@host:5432/db

# Redis配置（可选）
REDIS_URL=redis://localhost:6379

# 监控配置
ENABLE_METRICS=true
METRICS_PORT=9090
LOG_LEVEL=info
```

---

## 📖 使用示例与教程

### 基础AI助手使用
```bash
# 1. 在浏览器中打开AI Terminal
# 2. 点击 🤖 初始化Claude AI
# 3. 开始使用AI辅助编程

# 示例命令:
claude "解释这个错误信息"
claude "优化这段代码的性能"
claude "为这个函数生成单元测试"
```

### 知识卡片生成
```bash
# 1. 导航到"生成卡片"标签
# 2. 输入主题："机器学习基础"
# 3. 选择模板样式
# 4. 生成并导出

# 支持的格式:
- 嵌入CSS的HTML
- JSON结构化数据
- 可分享的公共链接
- PDF导出（即将推出）
```

### API集成示例
```javascript
// REST API使用
const response = await fetch('/api/terminal/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    command: 'npm install express',
    stream: true
  })
});

// WebSocket流式传输
const ws = new WebSocket('ws://localhost:6000/terminal');
ws.onmessage = (event) => {
  console.log('终端输出:', event.data);
};
```

---

## 🏗️ 架构与技术栈

```
┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│   前端          │    后端         │   AI服务        │   基础设施       │
│   (Vue 3)       │   (Node.js)     │  (Claude/Gemini)│   (Docker)      │
├─────────────────┼─────────────────┼─────────────────┼─────────────────┤
│ • Vue 3 + Vite  │ • Express.js    │ • Claude API    │ • Docker多阶段   │
│ • xterm.js      │ • Socket.IO     │ • Gemini API    │   构建          │
│ • Fluent UI     │ • node-pty      │ • OpenAI (即将) │ • 健康检查      │
│ • WebSocket     │ • JWT认证       │ • 流式传输      │ • 自动扩缩容    │
│ • 响应式        │ • CORS安全      │ • 上下文管理    │ • 负载均衡      │
│ • PWA就绪       │ • 速率限制      │ • 错误恢复      │ • SSL/TLS      │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┘
```

### 关键技术
- **前端**: Vue.js 3、Vite、xterm.js、Microsoft Fluent UI
- **后端**: Node.js、Express.js、Socket.IO、node-pty
- **AI集成**: Anthropic Claude API、Google Gemini API
- **容器化**: Docker、Docker Compose
- **安全**: JWT、CORS、输入验证、速率限制

---

## 🎯 使用场景与应用

### 软件开发者
- **AI驱动的代码助手** - 获得智能代码建议和解释
- **终端协作** - 与团队成员共享终端会话
- **API开发** - 将命令行工具转换为REST API
- **代码文档** - 使用AI生成全面的文档

### DevOps工程师
- **基础设施管理** - 通过Web界面管理服务器
- **部署自动化** - 在AI协助下创建部署脚本
- **监控集成** - 将终端访问与监控工具结合
- **团队协作** - 跨团队共享终端访问

### 研究人员与数据科学家
- **数据分析工作流** - AI辅助数据探索和分析
- **实验文档** - 生成研究卡片和报告
- **模型开发** - 交互式AI开发环境
- **结果分享** - 创建可分享的分析结果

### 教育机构
- **计算机科学教育** - 使用AI辅助教授编程
- **远程学习** - 提供基于浏览器的开发环境
- **学生协作** - 启用小组编程项目
- **课程内容创建** - 使用AI生成教育材料

### 企业团队
- **安全的AI访问** - 用于敏感项目的自托管AI工具
- **团队生产力** - 标准化开发环境
- **知识管理** - 创建和分享团队知识库
- **培训和入职** - 交互式学习环境

---

## 📊 性能与可扩展性

### 性能指标
- **启动时间**: < 10秒（容器就绪）
- **内存使用**: ~200MB基础，每个终端会话~50MB
- **响应时间**: UI交互 < 100ms
- **并发用户**: 最多100+（取决于资源）
- **AI响应时间**: 1-5秒（取决于AI服务）

### 可扩展性功能
- **水平扩展** - 多个容器实例
- **负载均衡** - 内置会话亲和性
- **资源管理** - 每个会话的可配置限制
- **自动扩缩容** - 兼容Kubernetes
- **监控集成** - 准备好Prometheus指标

---

## 🛡️ 安全与隐私

### 安全功能
- **JWT认证** - 安全的会话管理
- **CORS保护** - 可配置的跨域策略
- **输入验证** - 全面的输入清理
- **速率限制** - 防止滥用和DOS攻击
- **安全标头** - HTTPS、CSP、HSTS支持

### 隐私保证
- **无数据持久化** - 默认不存储AI对话
- **本地处理** - 所有终端操作都在本地进行
- **Token安全** - API Token安全存储在环境中
- **审计日志** - 全面的活动日志记录
- **GDPR合规** - 考虑隐私法规的设计

---

## 🤝 贡献与社区

我们欢迎来自全世界开发者的贡献！这个项目在社区协作中蓬勃发展。

### 如何贡献
1. **🍴 Fork仓库**
2. **🌿 创建功能分支**: `git checkout -b feature/amazing-feature`
3. **💻 进行修改**: 遵循我们的编码标准
4. **✅ 测试修改**: 确保所有测试通过
5. **📝 提交修改**: `git commit -m 'Add amazing feature'`
6. **🚀 推送到分支**: `git push origin feature/amazing-feature`
7. **🔄 创建Pull Request**: 详细描述您的修改

### 开发指南
- **代码风格**: ESLint + Prettier配置
- **测试**: Jest单元测试，Cypress端到端测试
- **文档**: 所有函数的JSDoc注释
- **安全**: 所有贡献的安全审计
- **性能**: 性能影响评估

### 社区资源
- 📖 [贡献指南](./CONTRIBUTING.md)
- 🐛 [问题模板](./github/ISSUE_TEMPLATE/)
- 💬 [GitHub讨论](https://github.com/aixier/AI_Terminal/discussions)
- 📧 [开发者邮件列表](mailto:dev@ai-terminal.com)
- 💼 [LinkedIn社区](https://linkedin.com/company/ai-terminal)

---

## 📋 系统要求

### 最低要求
- **操作系统**: Windows 10+、macOS 10.15+、Linux（任何现代发行版）
- **浏览器**: Chrome 90+、Firefox 88+、Safari 14+、Edge 90+
- **内存**: 2GB可用RAM
- **存储**: 1GB可用空间
- **网络**: 稳定的互联网连接（用于AI服务）

### 推荐要求
- **操作系统**: 最新版本的Windows、macOS或Linux
- **浏览器**: 最新的Chrome或Firefox以获得最佳性能
- **内存**: 4GB+ RAM用于多会话
- **存储**: 5GB+用于数据持久化
- **网络**: 高速互联网以获得最佳AI响应时间

### Docker要求
- **Docker**: v20.10+
- **Docker Compose**: v2.0+（可选）
- **资源**: 最少2个CPU核心，2GB RAM

---

## 🐛 故障排除与支持

### 常见问题与解决方案

#### AI初始化问题
```bash
# 问题: Claude初始化失败
# 解决方案: 检查API Token和网络连接
docker logs ai-terminal 2>&1 | grep -i "claude"

# 问题: Gemini无响应
# 解决方案: 验证Gemini API密钥和配额
curl -H "Authorization: Bearer $GEMINI_API_KEY" https://api.gemini.com/health
```

#### 终端连接问题
```bash
# 问题: WebSocket连接失败
# 解决方案: 检查防火墙和代理设置
# 启用调试日志
docker run -e LOG_LEVEL=debug coopotfan/ai-terminal:latest
```

#### 性能问题
```bash
# 问题: 响应时间慢
# 解决方案: 增加容器资源
docker run --memory=1g --cpus=2 coopotfan/ai-terminal:latest
```

### 获取帮助
- 📖 [全面文档](./docs/)
- 🔌 [API文档](./API_DOCUMENTATION.md) - 完整的REST API参考
- ❓ [FAQ部分](./docs/FAQ.md)
- 🐛 [问题跟踪器](https://github.com/aixier/AI_Terminal/issues)
- 💬 [社区讨论](https://github.com/aixier/AI_Terminal/discussions)
- 📧 [邮件支持](mailto:support@ai-terminal.com)

---

## 🗺️ 路线图与未来规划

### 2025年第一季度 - 核心增强
- [ ] **多模型AI支持** - OpenAI GPT、Anthropic Claude 3.5
- [ ] **高级终端功能** - 分屏、标签页、会话保存
- [ ] **增强安全性** - SSO集成、RBAC、审计跟踪
- [ ] **移动应用** - 原生iOS/Android应用

### 2025年第二季度 - 企业功能
- [ ] **团队协作** - 实时协作编辑
- [ ] **企业SSO** - SAML、OIDC、Active Directory集成
- [ ] **高级分析** - 使用分析、性能指标
- [ ] **API网关** - 高级速率限制、API版本控制

### 2025年第三季度 - AI创新
- [ ] **自定义AI模型** - 支持微调模型
- [ ] **AI工作流构建器** - 可视化AI工作流设计器
- [ ] **高级知识卡片** - 交互式、多媒体卡片
- [ ] **AI代码审查** - 使用AI进行自动代码审查

### 2025年第四季度 - 平台演进
- [ ] **插件系统** - 第三方插件支持
- [ ] **市场** - 模板和插件市场
- [ ] **企业云** - 托管云服务
- [ ] **AI训练** - 在您的数据上训练自定义模型

---

## 📄 许可证与法律

本项目采用 **MIT许可证** - 详见[LICENSE](LICENSE)文件。

### 这意味着什么:
- ✅ **商业使用** - 在商业项目中使用
- ✅ **修改** - 修改和改编代码
- ✅ **分发** - 分发原版或修改版本
- ✅ **私人使用** - 私下使用而不分享更改
- ❗ **无责任** - 软件按"原样"提供
- ❗ **无保证** - 不保证软件性能

### 署名
如果您在项目中使用AI Terminal，我们感谢您的署名：
```
由AI Terminal提供支持 - https://github.com/aixier/AI_Terminal
```

---

## 🌟 Star历史与认可

[![Star History Chart](https://api.star-history.com/svg?repos=aixier/AI_Terminal&type=Date)](https://star-history.com/#aixier/AI_Terminal&Date)

### 奖项与认可
- 🏆 **GitHub趋势** - 在趋势仓库中精选
- 🌟 **开发者选择** - 高社区评分
- 🚀 **创新奖** - 因AI集成突破而获得认可
- 💎 **开源卓越** - 社区驱动的开发模式

---

## 💖 支持项目

如果AI Terminal对您或您的团队有帮助，请考虑支持我们的开发：

### 支持方式
- ⭐ **Star仓库** - 帮助他人发现项目
- 🐛 **报告错误** - 帮助我们改进质量
- 💡 **建议功能** - 分享您的改进想法
- 🔄 **贡献代码** - 提交拉取请求
- 📢 **分享给他人** - 传播AI Terminal的消息
- ☕ **请我们喝咖啡** - [在Ko-fi上支持](https://ko-fi.com/aiterminal)

### 企业赞助
对企业赞助或定制开发感兴趣？请联系我们：[sponsor@ai-terminal.com](mailto:sponsor@ai-terminal.com)

---

## 📞 联系与社交

- 🌐 **网站**: [aiterminal.dev](https://aiterminal.dev)
- 📧 **邮箱**: [hello@ai-terminal.com](mailto:hello@ai-terminal.com)
- 🐦 **Twitter**: [@AITerminal](https://twitter.com/AITerminal)
- 💼 **LinkedIn**: [AI Terminal](https://linkedin.com/company/ai-terminal)
- 💬 **Discord**: [加入我们的社区](https://discord.gg/ai-terminal)
- 📺 **YouTube**: [AI Terminal频道](https://youtube.com/@ai-terminal)

---

<div align="center">

### 🎯 为开发者而生，由开发者打造

**由全球开源社区用❤️制作**

[⬆️ 返回顶部](#ai-terminal---全球首个ai智能终端平台)

</div>

---

**关键词**: ai终端, web终端, claude-ai, gemini-ai, 浏览器终端, ai驱动开发, 终端模拟器, 基于web的终端, ai助手, 开发者工具, 开源, docker部署, vue3应用, nodejs后端, xterm-js, ai集成, 知识卡片, 实时协作, 企业ai工具, 智能终端, 中文ai工具