# 🐳 AI Terminal - World's First AI-Powered Web Terminal Platform

[![Docker Pulls](https://img.shields.io/docker/pulls/coopotfan/ai-terminal)](https://hub.docker.com/r/coopotfan/ai-terminal)
[![Docker Image Size](https://img.shields.io/docker/image-size/coopotfan/ai-terminal/latest)](https://hub.docker.com/r/coopotfan/ai-terminal)
[![GitHub Stars](https://img.shields.io/github/stars/aixier/AI_Terminal?style=social)](https://github.com/aixier/AI_Terminal/stargazers)
[![GitHub](https://img.shields.io/badge/GitHub-AI_Terminal-blue)](https://github.com/aixier/AI_Terminal)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://img.shields.io/github/actions/workflow/status/aixier/AI_Terminal/docker-publish.yml)](https://github.com/aixier/AI_Terminal/actions)

## 🚀 Breakthrough Innovation: AI-Integrated Web Terminal Revolution

**AI Terminal** transforms traditional command-line interfaces into intelligent, web-accessible platforms. Built for developers, researchers, and teams who need powerful AI tools in accessible, collaborative environments.

## ✨ What's New in v2.3.1

### 🎯 Manual AI CLI Initialization
- **🤖 Claude Button**: One-click Claude AI setup with visual feedback
- **💎 Gemini Button**: Independent Gemini AI initialization
- **🎨 Enhanced UI**: Beautiful responsive buttons with loading animations
- **🔧 Better Control**: Users can manage AI tools independently

## 🌟 Key Features

### 🤖 **Multi-AI Integration**
- **Claude AI** - Advanced reasoning and code generation
- **Gemini AI** - Versatile content creation and analysis
- **Manual Setup** - On-demand AI tool initialization

### 🌐 **Web Terminal Experience**
- **Real-time Terminal** - Full xterm.js web terminal
- **WebSocket Communication** - Low-latency streaming
- **Cross-Platform** - Desktop, tablet, mobile support
- **Session Management** - Persistent sessions with auto-reconnect

### 📊 **Knowledge Card Generation**
- **Smart Templates** - Multiple predefined layouts
- **Real-time Preview** - Instant responsive preview
- **Export Options** - HTML, JSON, shareable links
- **Template Management** - Upload custom templates

### 🔧 **Developer Ready**
- **REST API** - Convert terminal commands to HTTP APIs
- **Streaming Support** - Real-time output for long commands
- **Docker Ready** - One-command deployment
- **Environment Config** - Flexible configuration

## 📦 Quick Start

### Option 1: Basic Setup
```bash
docker run -d -p 6000:6000 coopotfan/ai-terminal:latest
# Access at http://localhost:6000
```

### Option 2: With AI Tokens
```bash
docker run -d -p 6000:6000 \
  -e ANTHROPIC_AUTH_TOKEN="your_claude_token" \
  -e GEMINI_API_KEY="your_gemini_key" \
  coopotfan/ai-terminal:latest
```

### Option 3: Docker Compose
```yaml
version: '3.8'
services:
  ai-terminal:
    image: coopotfan/ai-terminal:latest
    ports:
      - "6000:6000"
    environment:
      - ANTHROPIC_AUTH_TOKEN=your_claude_token
      - GEMINI_API_KEY=your_gemini_key
    restart: unless-stopped
```

## 🔧 Configuration

### Environment Variables
```bash
# AI Configuration
ANTHROPIC_AUTH_TOKEN=your_claude_token
GEMINI_API_KEY=your_gemini_key

# Server Configuration
PORT=6000
NODE_ENV=production
MAX_TERMINAL_SESSIONS=10
TERMINAL_TIMEOUT=600000
```

### Volume Mounts (Optional)
```bash
docker run -d -p 6000:6000 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  coopotfan/ai-terminal:latest
```

## 🎯 Use Cases

### For Developers
- **AI Code Assistant** - Claude and Gemini in your terminal
- **Collaborative Debugging** - Share terminal sessions
- **API Development** - Convert commands to REST APIs
- **Documentation** - Generate knowledge cards from code

### For Teams
- **Remote Collaboration** - Web-based terminal sharing
- **Training Environment** - Safe, sandboxed AI learning
- **Knowledge Management** - Create and share cards
- **Code Reviews** - AI-assisted analysis

### For Researchers
- **Data Analysis** - AI-powered terminal workflows
- **Documentation** - Automated knowledge extraction
- **Experiment Tracking** - Persistent session history
- **Content Generation** - Multi-modal AI content

## 🏷️ Available Tags

- `latest` - Latest stable release (v2.3.1)
- `v2.3.1` - Manual AI initialization release
- `v2.3.0` - Enhanced UI and performance
- `v2.2.x` - Previous stable versions

## 🚀 Getting Started

1. **Run Container**: `docker run -d -p 6000:6000 coopotfan/ai-terminal:latest`
2. **Open Browser**: Navigate to `http://localhost:6000`
3. **Initialize AI**: Click 🤖 for Claude or 💎 for Gemini
4. **Start Creating**: Generate cards or use terminal

## 📊 Performance

- **Startup Time**: < 30 seconds
- **Memory Usage**: ~200MB base
- **Concurrent Sessions**: Up to 10 (configurable)
- **Response Time**: < 100ms for UI interactions

## 🔗 Resources

- 📖 [Full Documentation](https://github.com/aixier/AI_Terminal)
- 🚀 [Quick Start Guide](https://github.com/aixier/AI_Terminal#-quick-start)
- 💡 [Examples & Tutorials](https://github.com/aixier/AI_Terminal/tree/main/examples)
- 🐛 [Issue Tracker](https://github.com/aixier/AI_Terminal/issues)
- ⭐ [Star on GitHub](https://github.com/aixier/AI_Terminal)

## 🛡️ Security

- **No Data Persistence**: AI conversations are not stored
- **Token Security**: Environment variable configuration
- **Sandboxed Execution**: Isolated terminal sessions
- **HTTPS Ready**: SSL/TLS support for production

## 🤝 Contributing

We welcome contributions! The project is open source under MIT license.

- 🔧 [Development Guide](https://github.com/aixier/AI_Terminal/blob/main/DEVELOPER.md)
- 💬 [Discussions](https://github.com/aixier/AI_Terminal/discussions)
- 🐛 [Bug Reports](https://github.com/aixier/AI_Terminal/issues)

## 📝 License

MIT License - Free for commercial and personal use.

---

**Keywords**: AI Terminal, Claude AI, Gemini AI, Web Terminal, Docker, xterm.js, Vue.js, Node.js, REST API, Knowledge Cards, Developer Tools, Collaboration, Real-time, WebSocket
