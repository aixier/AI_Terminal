# 🐳 AI Terminal - Claude Code API Platform

[![Docker Pulls](https://img.shields.io/docker/pulls/aixier/ai-terminal)](https://hub.docker.com/r/aixier/ai-terminal)
[![Docker Image Size](https://img.shields.io/docker/image-size/aixier/ai-terminal)](https://hub.docker.com/r/aixier/ai-terminal)
[![GitHub](https://img.shields.io/badge/GitHub-AI_Terminal-blue)](https://github.com/aixier/AI_Terminal)

## 🚀 Transform Claude Code & CLI Tools into REST APIs - Deploy in 30 Seconds!

**AI Terminal** is the first open-source platform that transforms Claude Code CLI (and other AI CLI tools) into production-ready REST APIs with streaming support.

## ✨ Key Features

- 🔥 **Claude Code API** - Transform Claude Code into REST/WebSocket APIs
- ⚡ **30-Second Deploy** - One command, instant API
- 🌊 **Streaming Support** - Real-time Server-Sent Events
- 🐳 **Docker Ready** - Production-grade containerization
- 🔌 **Multi-CLI Support** - Claude, Gemini, Cursor (coming soon)
- 🎯 **Zero Config** - Works out of the box

## 📦 Quick Start

### Deploy in 30 Seconds
```bash
docker run -d -p 8082:6000 aixier/ai-terminal:latest
```

### Test Your API
```bash
# Simple API call
curl -X POST http://localhost:8082/api/generate/card \
  -H "Content-Type: application/json" \
  -d '{"topic": "Hello World"}'

# Streaming API
curl -X POST http://localhost:8082/api/generate/card/stream \
  -H "Content-Type: application/json" \
  -d '{"topic": "Python Tutorial"}' -N
```

## 🏷️ Available Tags

- `latest` - Latest stable release
- `v2.5` - Platform vision release
- `v2.4` - Claude Code API release
- `v2.3` - Performance optimizations

## 🛠️ Environment Variables

```bash
docker run -d \
  -p 8082:6000 \
  -e API_TIMEOUT=300000 \
  -e MAX_SESSIONS=10 \
  aixier/ai-terminal:latest
```

## 📊 Use Cases

### For Developers
- Add AI capabilities to your app without learning Claude CLI
- Simple REST API integration
- Production-ready with session management

### For Enterprises
- Self-hosted AI solution
- No vendor lock-in
- Full control over your AI infrastructure

### For Content Creators
- Generate AI content via simple APIs
- Stream responses in real-time
- Batch processing support

## 🔗 Resources

- 📖 [Documentation](https://github.com/aixier/AI_Terminal)
- 🚀 [Quick Start Guide](https://github.com/aixier/AI_Terminal/blob/main/CLAUDE_CODE_API_QUICKSTART.md)
- 💡 [Examples](https://github.com/aixier/AI_Terminal/tree/main/examples)
- 🐛 [Issues](https://github.com/aixier/AI_Terminal/issues)
- ⭐ [Star on GitHub](https://github.com/aixier/AI_Terminal)

## 🤝 Community

Join our growing community:
- 💬 [Discord](https://discord.gg/ai-terminal)
- 🐦 [Twitter](https://twitter.com/AITerminal)
- 🌟 [GitHub Discussions](https://github.com/aixier/AI_Terminal/discussions)

## 📝 License

MIT License - Free for commercial and personal use.

---

**Keywords**: Claude Code API, Claude CLI, CLI to API, Gemini CLI, Cursor CLI, AI Terminal, Docker, REST API, Streaming API, WebSocket