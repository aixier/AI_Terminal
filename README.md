# AI Terminal - Transform Any CLI into REST API

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker Ready](https://img.shields.io/badge/Docker-Ready-blue)](https://hub.docker.com/r/coopotfan/ai-terminal)
[![GitHub stars](https://img.shields.io/github/stars/aixier/AI_Terminal?style=social)](https://github.com/aixier/AI_Terminal/stargazers)

> 🚀 **Universal CLI-to-API Platform** - Transform ANY CLI tool into REST API with real-time streaming support

## 🌟 Overview

AI Terminal is an open-source platform that democratizes professional CLI tools by transforming them into accessible REST APIs. Starting with Claude Code integration, we're building a universal adapter for all CLI tools.

## ✨ Key Features

- **🤖 AI Integration** - Deep integration with Claude AI for intelligent command processing
- **🔄 Real-time Streaming** - WebSocket-powered real-time terminal experience
- **🎨 Knowledge Cards** - AI-driven structured knowledge card generation
- **📱 Responsive Design** - Mobile-first design with native-like experience
- **🐳 Docker Ready** - One-click deployment with Docker
- **🔌 Extensible** - Modular architecture for easy customization

## 🚀 Quick Start

### Docker Deployment (Recommended)

```bash
# Pull and run the latest image
docker run -d -p 8083:6000 \
  -e ANTHROPIC_AUTH_TOKEN=your_token \
  coopotfan/ai-terminal:latest

# Access the application
open http://localhost:8083
```

### Local Development

```bash
# Clone the repository
git clone https://github.com/aixier/AI_Terminal.git
cd AI_Terminal

# Install dependencies
cd terminal-backend && npm install
cd ../terminal-ui && npm install

# Start backend (port 6000)
cd terminal-backend
npm run dev

# Start frontend (port 5173)
cd ../terminal-ui
npm run dev
```

## 📖 Documentation

- [Quick Start Guide](./docs/user-guides/quickstart.md)
- [API Documentation](./docs/api/README.md)
- [Deployment Guide](./docs/deployment/docker.md)
- [Contributing Guidelines](./docs/contributing/CONTRIBUTING.md)

## 🏗️ Architecture

```
AI_Terminal/
├── terminal-backend/     # Node.js + Express backend
│   ├── src/
│   │   ├── routes/      # API endpoints
│   │   ├── services/    # Business logic
│   │   └── utils/       # Utilities
│   └── data/            # Templates and data
├── terminal-ui/          # Vue 3 + Element Plus frontend
│   ├── src/
│   │   ├── components/  # Vue components
│   │   ├── views/       # Page views
│   │   └── services/    # API services
│   └── public/          # Static assets
└── docs/                # Documentation
```

## 🔌 API Examples

### Generate Knowledge Card

```bash
# Generate a knowledge card
curl -X POST http://localhost:8083/api/generate/card \
  -H "Content-Type: application/json" \
  -d '{"topic": "Python Programming", "templateName": "daily-knowledge-card-template.md"}'
```

### Stream Generation

```javascript
// Real-time streaming with SSE
const eventSource = new EventSource('/api/generate/card/stream');
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](./docs/contributing/CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 Environment Variables

```bash
# Required
ANTHROPIC_AUTH_TOKEN=your_claude_api_token

# Optional
ANTHROPIC_BASE_URL=https://api.anthropic.com
PORT=6000
NODE_ENV=production
JWT_SECRET=your_jwt_secret
```

## 🚀 Roadmap

- [x] Claude AI Integration
- [x] Knowledge Card Generation
- [x] Docker Support
- [x] Mobile Responsive Design
- [ ] Multi-language Support
- [ ] Plugin System
- [ ] Cloud Deployment Templates
- [ ] More AI Model Support

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Vue 3](https://vuejs.org/) and [Node.js](https://nodejs.org/)
- UI powered by [Element Plus](https://element-plus.org/)
- Terminal emulation by [node-pty](https://github.com/microsoft/node-pty)
- AI capabilities by [Anthropic Claude](https://www.anthropic.com/)

## 📧 Contact

- GitHub Issues: [Report bugs or request features](https://github.com/aixier/AI_Terminal/issues)
- Email: [Contact maintainers](mailto:your-email@example.com)

---

⭐ If you find this project useful, please consider giving it a star!