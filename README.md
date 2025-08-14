# AI Terminal - Next-Gen Web Terminal with AI Intelligence

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker Ready](https://img.shields.io/badge/Docker-Ready-blue)](https://hub.docker.com/r/coopotfan/ai-terminal)
[![GitHub stars](https://img.shields.io/github/stars/aixier/AI_Terminal?style=social)](https://github.com/aixier/AI_Terminal/stargazers)
[![Node.js](https://img.shields.io/badge/Node.js-v18+-green)](https://nodejs.org/)
[![Vue.js](https://img.shields.io/badge/Vue.js-v3.0+-4FC08D)](https://vuejs.org/)

> 🚀 **Revolutionary Web Terminal Platform** - Seamlessly integrate AI capabilities (Claude + Gemini) with web-based terminal experience, featuring real-time streaming, knowledge card generation, and enterprise-grade architecture.

## 🌟 Why AI Terminal?

AI Terminal transforms traditional command-line interfaces into intelligent, web-accessible platforms. Built for developers, researchers, and teams who need powerful AI tools in accessible, collaborative environments.

**🎯 Perfect for:**
- AI-powered content generation and analysis
- Real-time collaborative terminal sessions
- Knowledge management and documentation
- Educational and training environments
- API-first development workflows

## ✨ Core Features

### 🤖 **Multi-AI Integration**
- **Claude AI** - Advanced reasoning and code generation
- **Gemini AI** - Versatile content creation and analysis
- **Unified API** - Single interface for multiple AI models
- **Streaming Responses** - Real-time output with Server-Sent Events

### 🎨 **Intelligent Knowledge Cards**
- **Template System** - Customizable card templates and folder structures
- **Dynamic Generation** - AI-powered structured content creation
- **Rich Media Support** - HTML, JSON, and multimedia content
- **Version Control** - Track and manage card revisions

### 🌐 **Web Terminal Excellence**
- **XTerm.js Integration** - Full-featured terminal emulation
- **Real-time Sync** - WebSocket-powered instant updates
- **Multi-session Support** - Concurrent terminal instances
- **Cross-platform** - Works on any device with a browser

### 📁 **Advanced File Management**
- **Upload System** - Drag-and-drop file and folder uploads
- **Template Library** - Organized template collection
- **Real-time Monitoring** - File system change detection
- **Security First** - Path traversal protection and type validation

### 🚀 **Production Ready**
- **Docker Optimized** - Single-command deployment
- **Cloud Native** - Kubernetes and container-friendly
- **API-First** - Complete REST API with comprehensive documentation
- **Monitoring** - Health checks and performance metrics

## 🚀 Quick Start

### One-Command Docker Deploy
```bash
# Production deployment with persistent data
docker run -d -p 8083:6000 \
  -v $(pwd)/data:/app/data \
  -e ANTHROPIC_AUTH_TOKEN=your_claude_token \
  -e GEMINI_API_KEY=your_gemini_key \
  --name ai-terminal \
  coopotfan/ai-terminal:latest

# Access your AI Terminal
open http://localhost:8083
```

### Development Setup
```bash
# Clone repository
git clone https://github.com/aixier/AI_Terminal.git
cd AI_Terminal

# Backend setup (Node.js 18+)
cd terminal-backend
npm install
npm run dev  # Starts on port 6000

# Frontend setup (Vue 3 + Vite)
cd ../terminal-ui
npm install
npm run dev  # Starts on port 5173
```

## 🎯 Key Use Cases

### 🏢 **Enterprise Teams**
- **AI-powered Documentation** - Generate technical docs with Claude
- **Knowledge Base Management** - Structured information cards
- **Developer Productivity** - Web-based CLI tools
- **Training Materials** - Interactive learning content

### 🎓 **Education & Research**
- **Interactive Tutorials** - AI-generated learning materials
- **Research Documentation** - Structured knowledge capture
- **Student Projects** - Collaborative coding environments
- **Academic Publishing** - Automated content formatting

### 🛠️ **Developers & DevOps**
- **API Testing** - Real-time terminal debugging
- **CI/CD Integration** - Web-based build monitoring
- **Infrastructure Management** - Remote server access
- **Documentation Generation** - AI-assisted tech writing

## 📚 API Examples

### Generate Knowledge Cards
```bash
# Create structured knowledge content with user authentication
curl -X POST http://localhost:8083/api/generate/card \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer alice-secure-token-abc123" \
  -d '{
    "topic": "Machine Learning Fundamentals",
    "templateName": "daily-knowledge-card-template.md"
  }'

# Or use without token (automatically uses default user)
curl -X POST http://localhost:8083/api/generate/card \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "Machine Learning Fundamentals",
    "templateName": "daily-knowledge-card-template.md"
  }'
```

### Real-time Streaming
```javascript
// Server-Sent Events for live updates
const eventSource = new EventSource('/api/generate/card/stream');
eventSource.addEventListener('output', (event) => {
  const data = JSON.parse(event.data);
  console.log('AI Output:', data.content);
});
```

### File Management
```bash
# Upload templates via API
curl -X POST http://localhost:8083/api/upload/files \
  -F "files=@my-template.md" \
  -F "folderPath=custom-templates"
```

### Terminal WebSocket
```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:8083');
socket.emit('terminal:create', { cols: 120, rows: 30 });
socket.on('terminal:output', (data) => {
  console.log('Terminal:', data);
});
```

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   AI Services   │
│   (Vue 3)       │◄──►│   (Node.js)     │◄──►│   Claude API    │
│                 │    │                 │    │   Gemini API    │
│ • XTerm.js      │    │ • Socket.IO     │    │                 │
│ • Element Plus  │    │ • Express       │    │                 │
│ • WebSocket     │    │ • node-pty      │    │                 │
│ • SSE Client    │    │ • File Watcher  │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Technology Stack
- **Frontend**: Vue 3, Element Plus, XTerm.js, Socket.IO
- **Backend**: Node.js, Express, Socket.IO, node-pty
- **AI Integration**: Claude API, Gemini API
- **Database**: File-based storage with JSON
- **Deployment**: Docker, Docker Compose
- **Real-time**: WebSocket, Server-Sent Events

## 📖 Documentation

| Resource | Description |
|----------|-------------|
| [📘 API Documentation](./docs/API_DOCUMENTATION.md) | Complete REST API reference |
| [🚀 Quick Start Guide](./docs/user-guides/quickstart.md) | Get started in 5 minutes |
| [🐳 Docker Deployment](./docs/deployment/docker.md) | Production deployment guide |
| [🏗️ Architecture Guide](./docs/architecture/system-architecture.md) | System design overview |
| [🤝 Contributing](./docs/contributing/CONTRIBUTING.md) | How to contribute |

## 🔐 User Authentication System (v3.381+)

### Multi-User Support
AI Terminal now supports complete user isolation with token-based authentication:

**Pre-configured Users:**
- **default** - Automatic fallback user (no token required)
- **alice** - `alice123` / `alice-secure-token-abc123`
- **bob** - `bob456` / `bob-secure-token-def456` 
- **charlie** - `charlie789` / `charlie-secure-token-ghi789`

### Authentication Flow
```bash
# 1. Login to get your token
curl -X POST http://localhost:8083/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "alice", "password": "alice123"}'

# Response: {"data": {"token": "alice-secure-token-abc123"}}

# 2. Use token for authenticated requests
curl -X POST http://localhost:8083/api/generate/card \
  -H "Authorization: Bearer alice-secure-token-abc123" \
  -H "Content-Type: application/json" \
  -d '{"topic": "Your Topic"}'
```

### Data Isolation
Each user gets their own isolated directory:
- **alice**: `/app/data/users/alice/folders/default-folder/cards/`
- **bob**: `/app/data/users/bob/folders/default-folder/cards/`
- **default**: `/app/data/users/default/folders/default-folder/cards/`

## 🌍 Environment Configuration

### Essential Variables
```bash
# AI API Keys
ANTHROPIC_AUTH_TOKEN=your_claude_token
GEMINI_API_KEY=your_gemini_key

# Server Configuration
NODE_ENV=production
PORT=6000
HOST=0.0.0.0

# Data Paths
DATA_PATH=/app/data
STATIC_PATH=/app/static
SERVE_STATIC=true

# Security
JWT_SECRET=your_secure_secret
ALLOWED_ORIGINS=https://yourdomain.com
```

### Docker Compose Example
```yaml
version: '3.8'
services:
  ai-terminal:
    image: coopotfan/ai-terminal:latest
    ports:
      - "8083:6000"
    environment:
      - ANTHROPIC_AUTH_TOKEN=${ANTHROPIC_AUTH_TOKEN}
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - NODE_ENV=production
    volumes:
      - ./data:/app/data
    restart: unless-stopped
```

## 🔮 Roadmap 2025

### Q1 2025
- [ ] **Plugin System** - Extensible CLI adapter framework
- [ ] **Multi-language Support** - i18n for global users
- [ ] **Advanced Templates** - Rich media card templates
- [ ] **Performance Optimization** - Enhanced streaming performance

### Q2 2025
- [ ] **Cloud Integrations** - AWS, Azure, GCP native support
- [ ] **Team Collaboration** - Multi-user shared workspaces
- [ ] **AI Model Expansion** - Support for more AI providers
- [ ] **Mobile App** - Native iOS/Android applications

### Q3 2025
- [ ] **Enterprise Features** - SSO, RBAC, audit logging
- [ ] **Workflow Automation** - CI/CD pipeline integration
- [ ] **Analytics Dashboard** - Usage metrics and insights
- [ ] **API Marketplace** - Community-driven API extensions

## 📊 Performance Metrics

| Metric | Value | Notes |
|--------|--------|-------|
| **Cold Start** | < 3s | Docker container startup |
| **API Response** | < 100ms | Standard endpoints |
| **AI Generation** | 30-420s | Varies by complexity |
| **File Upload** | < 5s | Up to 10MB |
| **Concurrent Users** | 100+ | WebSocket connections |
| **Memory Usage** | < 512MB | Typical workload |

## 🛡️ Security Features

- **Input Validation** - Comprehensive request sanitization
- **Path Protection** - Directory traversal prevention
- **CORS Configuration** - Secure cross-origin policies
- **File Type Filtering** - Upload security controls
- **JWT Authentication** - Token-based auth (optional)
- **Error Handling** - Secure error message disclosure

## 🤝 Contributing

We welcome contributions from the community! Here's how to get involved:

### Quick Contribution Guide
1. **Fork** the repository on GitHub
2. **Clone** your fork locally
3. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
4. **Commit** your changes (`git commit -m 'Add amazing feature'`)
5. **Push** to your branch (`git push origin feature/amazing-feature`)
6. **Open** a Pull Request

### Development Guidelines
- Follow existing code style and conventions
- Add tests for new features
- Update documentation as needed
- Ensure Docker builds pass
- Test on multiple browsers/devices

## 📄 License & Legal

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

### Third-party Licenses
- Vue.js - MIT License
- Element Plus - MIT License
- XTerm.js - MIT License
- Node.js - MIT License
- Socket.IO - MIT License

## 🙏 Acknowledgments

Special thanks to the amazing open-source community and these key projects:

- **[Vue.js](https://vuejs.org/)** - Progressive JavaScript framework
- **[Element Plus](https://element-plus.org/)** - Vue 3 component library
- **[XTerm.js](https://xtermjs.org/)** - Terminal emulator for the web
- **[node-pty](https://github.com/microsoft/node-pty)** - Pseudo terminal bindings
- **[Socket.IO](https://socket.io/)** - Real-time communication
- **[Anthropic Claude](https://www.anthropic.com/)** - AI language model

## 📞 Support & Community

### Get Help
- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/aixier/AI_Terminal/issues)
- 💡 **Feature Requests**: [GitHub Discussions](https://github.com/aixier/AI_Terminal/discussions)
- 📧 **Email Support**: ai-terminal@example.com
- 💬 **Community Chat**: [Join our Discord](https://discord.gg/ai-terminal)

### Stay Updated
- ⭐ **Star this repo** to show support
- 👀 **Watch releases** for updates
- 🐦 **Follow us** on social media
- 📱 **Subscribe** to our newsletter

---

<div align="center">

**[🌐 Website](https://ai-terminal.com) • [📖 Docs](./docs/) • [🐳 Docker Hub](https://hub.docker.com/r/coopotfan/ai-terminal) • [💬 Community](https://discord.gg/ai-terminal)**

*Built with ❤️ for the developer community*

</div>