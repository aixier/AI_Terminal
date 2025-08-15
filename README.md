# AI Terminal - World's First AI-Powered Web Terminal Platform

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker Ready](https://img.shields.io/badge/Docker-Ready-blue)](https://hub.docker.com/r/coopotfan/ai-terminal)
[![GitHub stars](https://img.shields.io/github/stars/aixier/AI_Terminal?style=social)](https://github.com/aixier/AI_Terminal/stargazers)
[![Node.js](https://img.shields.io/badge/Node.js-v22+-green)](https://nodejs.org/)
[![Vue.js](https://img.shields.io/badge/Vue.js-v3.0+-4FC08D)](https://vuejs.org/)
[![GitHub Issues](https://img.shields.io/github/issues/aixier/AI_Terminal)](https://github.com/aixier/AI_Terminal/issues)
[![GitHub Forks](https://img.shields.io/github/forks/aixier/AI_Terminal)](https://github.com/aixier/AI_Terminal/network)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/aixier/AI_Terminal/pulls)

[🇺🇸 English](./README.md) | [🇨🇳 中文](./README_CN.md) | [📖 Documentation](./docs/) | [🐳 Docker Hub](https://hub.docker.com/r/coopotfan/ai-terminal) | [💬 Discussions](https://github.com/aixier/AI_Terminal/discussions)

</div>

## 🚀 Revolutionary AI-Powered Web Terminal

> One line: let AI run the commands for you. No terminal skills needed; power users go faster.

**AI Terminal** is the world's first open-source web-based terminal platform that seamlessly integrates multiple AI assistants (Claude AI + Gemini AI) with a production-ready terminal interface. Transform your development workflow with intelligent code assistance, real-time collaboration, and enterprise-grade AI tools - all accessible through your browser.

> **🎯 Perfect for**: Developers, Researchers, DevOps Teams, AI Enthusiasts, Educational Institutions, and Enterprise Development Teams

### ✨ What Makes AI Terminal Unique?

🌟 **World's First AI-Integrated Web Terminal** - Breakthrough innovation in developer tools  
🤖 **Dual AI Engine** - Claude AI + Gemini AI working together  
🌐 **Zero Installation** - Runs entirely in your browser  
🐳 **One-Click Deploy** - Docker-ready for instant setup  
🔧 **Production Ready** - Enterprise-grade architecture  
📱 **Cross-Platform** - Desktop, tablet, and mobile support  

---

## 🎉 Latest Release: v3.9.8 "Enhanced Connection Management"

### 🆕 Breakthrough Features
- **🔌 Real-time Connection Management** - Visual connection status with auto-recovery
- **🎯 Smart Terminal Recovery** - One-click cursor refresh and reconnection
- **🔒 Secure Docker Deployments** - Dual-mode images for development and production
- **⚡ Enhanced xterm Integration** - Improved terminal reliability and user experience
- **🛡️ Production-Ready Security** - Separated sensitive configurations for safe distribution

### 🚀 Quick Start (30 Seconds)

#### Option 1: Public Image (Development/Testing)
```bash
# Deploy with environment variables
docker run -d -p 6000:6000 \
  -e ANTHROPIC_AUTH_TOKEN="your_claude_token" \
  -e ANTHROPIC_BASE_URL="your_claude_api_url" \
  coopotfan/ai-terminal:latest

# Open browser and visit: http://localhost:6000
```

#### Option 2: Production Image (Ready to Use)
```bash
# Deploy instantly - no configuration needed
docker run -d -p 6000:6000 coopotfan/ai-terminal:production

# Open browser and visit: http://localhost:6000
# ✅ Pre-configured and ready to use!
```

---

## 🌟 Core Features & Capabilities

### 🤖 **Multi-AI Integration Engine**
- **Claude AI Integration** - Advanced reasoning, code generation, and analysis
- **Gemini AI Integration** - Versatile content creation and multimodal AI
- **Manual Initialization System** - On-demand AI tool setup with visual feedback
- **Smart Context Management** - Persistent AI conversation context
- **Error Recovery** - Automatic AI session restoration

### 🌐 **Advanced Web Terminal**
- **Full xterm.js Implementation** - Complete terminal emulation in browser
- **Real-time WebSocket Communication** - Low-latency bidirectional communication
- **Session Management** - Persistent terminal sessions with auto-reconnect
- **Multi-Session Support** - Handle multiple terminal instances simultaneously
- **Cross-Platform Compatibility** - Works on Windows, macOS, Linux, iOS, Android

### 📊 **Knowledge Card Generation System**
- **AI-Powered Content Creation** - Generate structured knowledge cards
- **Multiple Template System** - Professional layouts for different content types
- **Real-time Preview** - Instant preview with responsive design testing
- **Export Capabilities** - HTML, JSON, and shareable link formats
- **Template Management** - Upload, customize, and share templates

### 🔧 **Developer Experience**
- **REST API Gateway** - Convert terminal commands to HTTP APIs
- **Streaming Support** - Real-time output streaming for long-running processes
- **Environment Management** - Flexible configuration via environment variables
- **Logging & Monitoring** - Comprehensive logging with structured output
- **Security Features** - JWT authentication, CORS protection, input validation

### 🎨 **Modern UI/UX Design**
- **Fluent Design System** - Microsoft Fluent UI components
- **Responsive Layout** - Optimized for all screen sizes and orientations
- **Dark Theme Optimized** - Eye-friendly interface for extended coding sessions
- **Real-time Indicators** - Visual feedback for all operations and status
- **Accessibility Features** - WCAG compliant interface design

---

## 🚀 Installation & Deployment

### Option 1: Docker Deployment (Recommended)

#### Public Image (Development/Open Source)
```bash
# Basic deployment with environment variables
docker run -d \
  --name ai-terminal \
  -p 6000:6000 \
  -e ANTHROPIC_AUTH_TOKEN="your_claude_token" \
  -e ANTHROPIC_BASE_URL="your_claude_api_url" \
  -e GEMINI_API_KEY="your_gemini_key" \
  coopotfan/ai-terminal:latest

# Advanced deployment with persistence
docker run -d \
  --name ai-terminal \
  -p 6000:6000 \
  -e ANTHROPIC_AUTH_TOKEN="your_claude_token" \
  -e ANTHROPIC_BASE_URL="your_claude_api_url" \
  -e GEMINI_API_KEY="your_gemini_key" \
  -e NODE_ENV=production \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  --restart unless-stopped \
  coopotfan/ai-terminal:latest
```

#### Production Image (Internal Deployment)
```bash
# Ready-to-use deployment (no environment variables needed)
docker run -d \
  --name ai-terminal \
  -p 6000:6000 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  --restart unless-stopped \
  coopotfan/ai-terminal:production
```

### Option 2: Docker Compose
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

### Option 3: Development Setup
```bash
# Clone repository
git clone https://github.com/aixier/AI_Terminal.git
cd AI_Terminal

# Install dependencies
npm install

# Set environment variables
cp .env.example .env
# Edit .env with your AI API tokens

# Start backend dev server
cd terminal-backend
npm install
npm run dev

# Start frontend dev server (new terminal)
cd terminal-ui
npm install
npm run dev

# Visit http://localhost:5173
```

---

## 🔧 Configuration & Environment

### Essential Environment Variables
```bash
# AI Service Configuration
ANTHROPIC_AUTH_TOKEN=your_claude_api_token
ANTHROPIC_BASE_URL=https://api.anthropic.com
GEMINI_API_KEY=your_google_gemini_key

# Server Configuration
PORT=6000
NODE_ENV=production
HOST=0.0.0.0

# Security Configuration
JWT_SECRET=your_secure_jwt_secret
JWT_EXPIRE_TIME=24h
CORS_ORIGINS=*

# Terminal Configuration
MAX_TERMINAL_SESSIONS=10
TERMINAL_TIMEOUT=600000
ENABLE_TERMINAL_LOGGING=true

# Performance Configuration
MEMORY_LIMIT=512m
CPU_LIMIT=1.0
WORKER_PROCESSES=1
```

### Advanced Configuration
```bash
# Database Configuration (Optional)
DATABASE_URL=postgresql://user:pass@host:5432/db

# Redis Configuration (Optional)
REDIS_URL=redis://localhost:6379

# Monitoring Configuration
ENABLE_METRICS=true
METRICS_PORT=9090
LOG_LEVEL=info
```

---

## 📖 Usage Examples & Tutorials

### Basic AI Assistant Usage
```bash
# 1. Open AI Terminal in browser
# 2. Click 🤖 to initialize Claude AI
# 3. Start coding with AI assistance

# Example commands:
claude "explain this error message"
claude "optimize this code for performance"
claude "generate unit tests for this function"
```

### Knowledge Card Generation
```bash
# 1. Navigate to "Generate Card" tab
# 2. Enter topic: "Machine Learning Fundamentals"
# 3. Select template style
# 4. Generate and export

# Supported formats:
- HTML with embedded CSS
- JSON structured data
- Shareable public links
- PDF export (coming soon)
```

### API Integration Examples
```javascript
// REST API usage
const response = await fetch('/api/terminal/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    command: 'npm install express',
    stream: true
  })
});

// WebSocket streaming
const ws = new WebSocket('ws://localhost:6000/terminal');
ws.onmessage = (event) => {
  console.log('Terminal output:', event.data);
};
```

---

## 🏗️ Architecture & Technology Stack

```
┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│   Frontend      │    Backend      │   AI Services   │   Infrastructure│
│   (Vue 3)       │   (Node.js)     │  (Claude/Gemini)│   (Docker)      │
├─────────────────┼─────────────────┼─────────────────┼─────────────────┤
│ • Vue 3 + Vite  │ • Express.js    │ • Claude API    │ • Docker Multi- │
│ • xterm.js      │ • Socket.IO     │ • Gemini API    │   stage Build   │
│ • Fluent UI     │ • node-pty      │ • OpenAI (soon) │ • Health Checks │
│ • WebSocket     │ • JWT Auth      │ • Streaming     │ • Auto Scaling  │
│ • Responsive    │ • CORS Security │ • Context Mgmt  │ • Load Balancer │
│ • PWA Ready     │ • Rate Limiting │ • Error Recovery│ • SSL/TLS      │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┘
```

### Key Technologies
- **Frontend**: Vue.js 3, Vite, xterm.js, Microsoft Fluent UI
- **Backend**: Node.js, Express.js, Socket.IO, node-pty
- **AI Integration**: Anthropic Claude API, Google Gemini API
- **Containerization**: Docker, Docker Compose
- **Security**: JWT, CORS, Input Validation, Rate Limiting

---

## 🎯 Use Cases & Applications

### For Software Developers
- **AI-Powered Code Assistant** - Get intelligent code suggestions and explanations
- **Terminal Collaboration** - Share terminal sessions with team members
- **API Development** - Convert command-line tools to REST APIs
- **Code Documentation** - Generate comprehensive documentation with AI

### For DevOps Engineers
- **Infrastructure Management** - Manage servers through web interface
- **Deployment Automation** - Create deployment scripts with AI assistance
- **Monitoring Integration** - Combine terminal access with monitoring tools
- **Team Collaboration** - Share terminal access across teams

### For Researchers & Data Scientists
- **Data Analysis Workflows** - AI-assisted data exploration and analysis
- **Experiment Documentation** - Generate research cards and reports
- **Model Development** - Interactive AI development environment
- **Results Sharing** - Create shareable analysis results

### For Educational Institutions
- **Computer Science Education** - Teach programming with AI assistance
- **Remote Learning** - Provide browser-based development environments
- **Student Collaboration** - Enable group programming projects
- **Course Content Creation** - Generate educational materials with AI

### For Enterprise Teams
- **Secure AI Access** - Self-hosted AI tools for sensitive projects
- **Team Productivity** - Standardized development environments
- **Knowledge Management** - Create and share team knowledge bases
- **Training & Onboarding** - Interactive learning environments

---

## 📊 Performance & Scalability

### Performance Metrics
- **Startup Time**: < 10 seconds (container ready)
- **Memory Usage**: ~200MB base, ~50MB per terminal session
- **Response Time**: < 100ms for UI interactions
- **Concurrent Users**: Up to 100+ (depending on resources)
- **AI Response Time**: 1-5 seconds (depends on AI service)

### Scalability Features
- **Horizontal Scaling** - Multiple container instances
- **Load Balancing** - Built-in session affinity
- **Resource Management** - Configurable limits per session
- **Auto-scaling** - Kubernetes compatible
- **Monitoring Integration** - Prometheus metrics ready

---

## 🛡️ Security & Privacy

### Security Features
- **JWT Authentication** - Secure session management
- **CORS Protection** - Configurable cross-origin policies
- **Input Validation** - Comprehensive input sanitization
- **Rate Limiting** - Prevent abuse and DOS attacks
- **Secure Headers** - HTTPS, CSP, HSTS support

### Privacy Guarantees
- **No Data Persistence** - AI conversations are not stored by default
- **Local Processing** - All terminal operations happen locally
- **Token Security** - API tokens stored securely in environment
- **Audit Logging** - Comprehensive activity logging
- **GDPR Compliant** - Designed with privacy regulations in mind

---

## 🤝 Contributing & Community

We welcome contributions from developers worldwide! This project thrives on community collaboration.

### How to Contribute
1. **🍴 Fork the Repository**
2. **🌿 Create Feature Branch**: `git checkout -b feature/amazing-feature`
3. **💻 Make Your Changes**: Follow our coding standards
4. **✅ Test Your Changes**: Ensure all tests pass
5. **📝 Commit Changes**: `git commit -m 'Add amazing feature'`
6. **🚀 Push to Branch**: `git push origin feature/amazing-feature`
7. **🔄 Open Pull Request**: Describe your changes thoroughly

### Development Guidelines
- **Code Style**: ESLint + Prettier configuration
- **Testing**: Jest for unit tests, Cypress for E2E
- **Documentation**: JSDoc comments for all functions
- **Security**: Security audit for all contributions
- **Performance**: Performance impact assessment

### Community Resources
- 📖 [Contributing Guide](./CONTRIBUTING.md)
- 🐛 [Issue Templates](./github/ISSUE_TEMPLATE/)
- 💬 [GitHub Discussions](https://github.com/aixier/AI_Terminal/discussions)
- 📧 [Developer Mailing List](mailto:dev@ai-terminal.com)
- 💼 [LinkedIn Community](https://linkedin.com/company/ai-terminal)

---

## 📋 System Requirements

### Minimum Requirements
- **OS**: Windows 10+, macOS 10.15+, Linux (any modern distro)
- **Browser**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Memory**: 2GB RAM available
- **Storage**: 1GB free space
- **Network**: Stable internet connection for AI services

### Recommended Requirements
- **OS**: Latest versions of Windows, macOS, or Linux
- **Browser**: Latest Chrome or Firefox for best performance
- **Memory**: 4GB+ RAM for multiple sessions
- **Storage**: 5GB+ for data persistence
- **Network**: High-speed internet for optimal AI response times

### Docker Requirements
- **Docker**: v20.10+ 
- **Docker Compose**: v2.0+ (optional)
- **Resources**: 2 CPU cores, 2GB RAM minimum

---

## 🐛 Troubleshooting & Support

### Common Issues & Solutions

#### AI Initialization Problems
```bash
# Problem: Claude initialization fails
# Solution: Check API token and network connectivity
docker logs ai-terminal 2>&1 | grep -i "claude"

# Problem: Gemini not responding
# Solution: Verify Gemini API key and quota
curl -H "Authorization: Bearer $GEMINI_API_KEY" https://api.gemini.com/health
```

#### Terminal Connection Issues
```bash
# Problem: WebSocket connection fails
# Solution: Check firewall and proxy settings
# Enable debug logging
docker run -e LOG_LEVEL=debug coopotfan/ai-terminal:latest
```

#### Performance Issues
```bash
# Problem: Slow response times
# Solution: Increase container resources
docker run --memory=1g --cpus=2 coopotfan/ai-terminal:latest
```

### Getting Help
- 📖 [Comprehensive Documentation](./docs/)
- ❓ [FAQ Section](./docs/FAQ.md)
- 🐛 [Issue Tracker](https://github.com/aixier/AI_Terminal/issues)
- 💬 [Community Discussions](https://github.com/aixier/AI_Terminal/discussions)
- 📧 [Email Support](mailto:support@ai-terminal.com)
- 🆘 [Emergency Support](https://github.com/aixier/AI_Terminal/issues/new?template=bug_report.md)

---

## 🗺️ Roadmap & Future Plans

### Q1 2025 - Core Enhancements
- [ ] **Multi-Model AI Support** - OpenAI GPT, Anthropic Claude 3.5
- [ ] **Advanced Terminal Features** - Split panes, tabs, session saving
- [ ] **Enhanced Security** - SSO integration, RBAC, audit trails
- [ ] **Mobile App** - Native iOS/Android applications

### Q2 2025 - Enterprise Features
- [ ] **Team Collaboration** - Real-time collaborative editing
- [ ] **Enterprise SSO** - SAML, OIDC, Active Directory integration
- [ ] **Advanced Analytics** - Usage analytics, performance metrics
- [ ] **API Gateway** - Advanced rate limiting, API versioning

### Q3 2025 - AI Innovations
- [ ] **Custom AI Models** - Support for fine-tuned models
- [ ] **AI Workflow Builder** - Visual AI workflow designer
- [ ] **Advanced Knowledge Cards** - Interactive, multimedia cards
- [ ] **AI Code Reviews** - Automated code review with AI

### Q4 2025 - Platform Evolution
- [ ] **Plugin System** - Third-party plugin support
- [ ] **Marketplace** - Template and plugin marketplace
- [ ] **Enterprise Cloud** - Managed cloud service
- [ ] **AI Training** - Train custom models on your data

---

## 📄 License & Legal

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

### What this means:
- ✅ **Commercial Use** - Use in commercial projects
- ✅ **Modification** - Modify and adapt the code
- ✅ **Distribution** - Distribute original or modified versions
- ✅ **Private Use** - Use privately without sharing changes
- ❗ **No Liability** - Software provided "as is"
- ❗ **No Warranty** - No guarantees about software performance

### Attribution
If you use AI Terminal in your project, we appreciate attribution:
```
Powered by AI Terminal - https://github.com/aixier/AI_Terminal
```

---

## 🌟 Star History & Recognition

[![Star History Chart](https://api.star-history.com/svg?repos=aixier/AI_Terminal&type=Date)](https://star-history.com/#aixier/AI_Terminal&Date)

### Awards & Recognition
- 🏆 **GitHub Trending** - Featured in trending repositories
- 🌟 **Developer Choice** - High community rating
- 🚀 **Innovation Award** - Recognized for AI integration breakthrough
- 💎 **Open Source Excellence** - Community-driven development model

---

## 💖 Support the Project

If AI Terminal has helped you or your team, consider supporting our development:

### Ways to Support
- ⭐ **Star the Repository** - Help others discover the project
- 🐛 **Report Bugs** - Help us improve quality
- 💡 **Suggest Features** - Share your ideas for improvements
- 🔄 **Contribute Code** - Submit pull requests
- 📢 **Share with Others** - Spread the word about AI Terminal
- ☕ **Buy us a Coffee** - [Support on Ko-fi](https://ko-fi.com/aiterminal)

### Corporate Sponsorship
Interested in corporate sponsorship or custom development? Contact us at [sponsor@ai-terminal.com](mailto:sponsor@ai-terminal.com)

---

## 📞 Contact & Social

- 🌐 **Website**: [aiterminal.dev](https://aiterminal.dev)
- 📧 **Email**: [hello@ai-terminal.com](mailto:hello@ai-terminal.com)
- 🐦 **Twitter**: [@AITerminal](https://twitter.com/AITerminal)
- 💼 **LinkedIn**: [AI Terminal](https://linkedin.com/company/ai-terminal)
- 💬 **Discord**: [Join our Community](https://discord.gg/ai-terminal)
- 📺 **YouTube**: [AI Terminal Channel](https://youtube.com/@ai-terminal)

---

<div align="center">

### 🎯 Built for developers, by developers

**Made with ❤️ by the global open source community**

[⬆️ Back to Top](#ai-terminal---worlds-first-ai-powered-web-terminal-platform)

</div>

---

**Keywords**: ai-terminal, web-terminal, claude-ai, gemini-ai, browser-terminal, ai-powered-development, terminal-emulator, web-based-terminal, ai-assistant, developer-tools, open-source, docker-deployment, vue3-application, nodejs-backend, xterm-js, ai-integration, knowledge-cards, real-time-collaboration, enterprise-ai-tools