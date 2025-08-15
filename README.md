# AI Terminal - Next-Gen Web Terminal with AI Intelligence

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker Ready](https://img.shields.io/badge/Docker-Ready-blue)](https://hub.docker.com/r/coopotfan/ai-terminal)
[![GitHub stars](https://img.shields.io/github/stars/aixier/AI_Terminal?style=social)](https://github.com/aixier/AI_Terminal/stargazers)
[![Node.js](https://img.shields.io/badge/Node.js-v22+-green)](https://nodejs.org/)
[![Vue.js](https://img.shields.io/badge/Vue.js-v3.0+-4FC08D)](https://vuejs.org/)

> 🚀 **Revolutionary Web Terminal Platform** - Seamlessly integrate AI capabilities (Claude + Gemini) with web-based terminal experience, featuring real-time streaming, knowledge card generation, and enterprise-grade architecture.

## 🎉 Latest Updates (v2.3.1)

### ✨ New Features
- **🤖 Manual AI CLI Initialization**: Added dedicated buttons for Claude and Gemini initialization
- **💎 Enhanced User Control**: Users can now independently manage AI tool initialization  
- **🎨 Improved UI**: Beautiful responsive buttons with loading states and animations
- **🔧 Better Error Handling**: Enhanced initialization feedback and troubleshooting

### 🚀 Quick Start with Docker
```bash
# Pull and run the latest version
docker run -d -p 6000:6000 coopotfan/ai-terminal:latest

# Access at http://localhost:6000
```

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
- **Claude AI** - Advanced reasoning and code generation via `@anthropic-ai/claude-code`
- **Gemini AI** - Versatile content creation and analysis via Google AI CLI
- **Manual Initialization** - On-demand AI tool setup with visual feedback

### 🌐 **Web Terminal Experience**
- **Real-time Terminal** - Full-featured web-based terminal with xterm.js
- **WebSocket Communication** - Low-latency bi-directional communication
- **Session Management** - Persistent terminal sessions with auto-reconnect
- **Cross-Platform** - Works on desktop, tablet, and mobile devices

### 📊 **Knowledge Card Generation**
- **Smart Templates** - Multiple predefined card styles and layouts
- **Real-time Preview** - Instant preview with responsive design
- **Export Options** - HTML, JSON, and shareable link formats
- **Template Management** - Upload and manage custom templates

### 🔧 **Developer Experience**
- **REST API** - Convert terminal commands to HTTP APIs
- **Streaming Support** - Real-time output streaming for long-running commands
- **Docker Ready** - One-command deployment with Docker
- **Environment Variables** - Flexible configuration management

### 🎨 **Modern UI/UX**
- **Responsive Design** - Optimized for all screen sizes
- **Dark Theme** - Eye-friendly interface for extended use
- **Fluent Design** - Microsoft Fluent UI components
- **Real-time Indicators** - Visual feedback for all operations

## 🚀 Quick Start

### Option 1: Docker (Recommended)
```bash
# Run with Docker
docker run -d -p 6000:6000 \
  -e ANTHROPIC_AUTH_TOKEN="your_claude_token" \
  -e GEMINI_API_KEY="your_gemini_key" \
  coopotfan/ai-terminal:latest

# Access at http://localhost:6000
```

### Option 2: Docker Compose
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

### Option 3: Development Setup
```bash
# Clone repository
git clone https://github.com/aixier/AI_Terminal.git
cd AI_Terminal

# Install dependencies
npm install

# Start backend
cd terminal-backend && npm install && npm start &

# Start frontend  
cd terminal-ui && npm install && npm run dev

# Access at http://localhost:5173
```

## 🔧 Configuration

### Environment Variables
```bash
# AI Service Configuration
ANTHROPIC_AUTH_TOKEN=your_claude_token
ANTHROPIC_BASE_URL=https://api.anthropic.com
GEMINI_API_KEY=your_gemini_key

# Server Configuration  
PORT=6000
NODE_ENV=production
JWT_SECRET=your_jwt_secret

# Terminal Configuration
MAX_TERMINAL_SESSIONS=10
TERMINAL_TIMEOUT=600000
```

### AI CLI Setup
1. **Claude**: Initialize with the blue 🤖 button
2. **Gemini**: Initialize with the purple 💎 button  
3. **Manual Setup**: Use terminal commands if needed

## 📖 Usage Examples

### Generate Knowledge Cards
```bash
# Start AI Terminal
# Click "Generate Card" tab
# Enter topic: "Machine Learning Basics"
# Select template and generate
```

### Use Terminal with AI
```bash
# Initialize Claude or Gemini
# Run commands with AI assistance
claude "explain this error message"
ai "generate documentation for this code"
```

### API Integration
```bash
# Convert terminal command to API
POST /api/terminal/execute
{
  "command": "ls -la",
  "stream": true
}
```

## 🏗️ Architecture

```
┌─────────────────┬─────────────────┬─────────────────┐
│   Frontend      │    Backend      │   AI Services   │
│   (Vue.js)      │   (Node.js)     │  (Claude/Gemini)│
├─────────────────┼─────────────────┼─────────────────┤
│ • xterm.js      │ • Express.js    │ • Claude Code   │
│ • WebSocket     │ • Socket.IO     │ • Gemini CLI    │
│ • Responsive UI │ • node-pty      │ • REST APIs     │
│ • Card System   │ • JWT Auth      │ • Streaming     │
└─────────────────┴─────────────────┴─────────────────┘
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./DEVELOPER.md) for details.

### Development Workflow
1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📋 Requirements

- **Node.js**: v22+ 
- **Docker**: v20+ (for containerized deployment)
- **Browser**: Modern browser with WebSocket support
- **AI Tokens**: Claude and/or Gemini API access

## 🐛 Troubleshooting

### Common Issues
- **Terminal not connecting**: Check backend service status
- **AI initialization fails**: Verify API tokens in environment variables
- **Performance issues**: Ensure adequate system resources

### Get Help
- 📖 [Documentation](./docs/)
- 🐛 [Issue Tracker](https://github.com/aixier/AI_Terminal/issues)
- 💬 [Discussions](https://github.com/aixier/AI_Terminal/discussions)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🌟 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=aixier/AI_Terminal&type=Date)](https://star-history.com/#aixier/AI_Terminal&Date)

## 💖 Support

If you find this project helpful, please consider:
- ⭐ Starring the repository
- 🐛 Reporting bugs and issues
- 💡 Contributing new features
- 📢 Sharing with others

---

**Built with ❤️ for the developer community**