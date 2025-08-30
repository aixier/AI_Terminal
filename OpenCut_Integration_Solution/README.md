# AI Terminal - OpenCut Integration Solution

## Project Overview

AI Terminal is an advanced web-based terminal system that integrates AI capabilities (Claude AI & Gemini AI) with modern terminal operations. This document provides a comprehensive guide for integrating AI Terminal into the OpenCut ecosystem.

## Table of Contents

1. [Architecture Overview](./ARCHITECTURE.md)
2. [API Documentation](./API_REFERENCE.md)
3. [Integration Guide](./INTEGRATION_GUIDE.md)
4. [Template System](./TEMPLATE_SYSTEM.md)
5. [Deployment Guide](./DEPLOYMENT.md)
6. [Security & Authentication](./SECURITY.md)

## Quick Start

### Prerequisites
- Node.js >= 18.0.0
- npm >= 8.0.0
- Docker (optional for containerized deployment)

### Installation

```bash
# Clone the repository
git clone https://github.com/aixier/AI_Terminal.git
cd AI_Terminal

# Install dependencies
npm install

# Start backend server
cd terminal-backend
npm start

# Start frontend (in another terminal)
cd terminal-ui
npm run dev
```

### Basic Configuration

1. Copy `.env.example` to `.env`
2. Configure your AI API keys:
   ```env
   ANTHROPIC_API_KEY=your_claude_api_key
   GEMINI_API_KEY=your_gemini_api_key
   ```

## Core Features

### 1. AI-Powered Card Generation
- Dynamic content generation using AI models
- Multiple template support
- Async and streaming generation modes
- Multi-format output (HTML, JSON)

### 2. Real-time Terminal Operations
- WebSocket-based terminal emulation
- Multi-session support
- Command execution and process management
- File system operations

### 3. Template Management System
- Customizable templates for different use cases
- Template registry with metadata
- Quick template selection buttons
- Style and language customization

### 4. User Management
- JWT-based authentication
- Multi-user support with isolated workspaces
- Default user fallback mechanism
- Token-based API access

## System Requirements

- **Backend**: Node.js Express server
- **Frontend**: Vue 3 + Vite
- **Terminal**: XTerm.js
- **Real-time**: Socket.IO
- **UI**: Element Plus + Fluent UI
- **AI Integration**: Claude API, Gemini API

## License

MIT License - See [LICENSE](../LICENSE) for details

## Support

- GitHub Issues: [https://github.com/aixier/AI_Terminal/issues](https://github.com/aixier/AI_Terminal/issues)
- Email: support@ai-terminal.com