# Developer Guide

## 🛠️ Development Environment Setup

### Prerequisites

- Node.js 22+ 
- npm 10+
- Docker (optional, for containerized development)
- Git

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/aixier/AI_Terminal.git
cd AI_Terminal

# Install backend dependencies
cd terminal-backend
npm install

# Install frontend dependencies
cd ../terminal-ui
npm install
```

## 🏗️ Project Structure

```
AI_Terminal/
├── terminal-backend/         # Backend service
│   ├── src/
│   │   ├── index.js         # Entry point
│   │   ├── routes/          # API routes
│   │   │   ├── terminal.js  # Terminal endpoints
│   │   │   └── generate.js  # Generation endpoints
│   │   ├── services/        # Business logic
│   │   │   ├── terminalManager.js
│   │   │   └── claudeInitializationService.js
│   │   └── utils/           # Utilities
│   └── data/                # Templates and data
├── terminal-ui/             # Frontend application
│   ├── src/
│   │   ├── main.js         # Vue entry point
│   │   ├── components/     # Reusable components
│   │   ├── views/          # Page components
│   │   └── services/       # API services
│   └── public/             # Static assets
├── docs/                   # Documentation
└── Dockerfile              # Container configuration
```

## 💻 Development Workflow

### Running Locally

#### Backend Development

```bash
cd terminal-backend

# Development mode with hot reload
npm run dev

# Production mode
npm start

# Run tests
npm test
```

Backend runs on `http://localhost:6000`

#### Frontend Development

```bash
cd terminal-ui

# Development server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

Frontend runs on `http://localhost:5173`

### Environment Configuration

Create `.env` files in both `terminal-backend` and `terminal-ui`:

#### Backend (.env)

```bash
# Server
PORT=6000
NODE_ENV=development

# Claude AI
ANTHROPIC_AUTH_TOKEN=your_token_here
ANTHROPIC_BASE_URL=https://api.anthropic.com

# Security
JWT_SECRET=your_secret_key
JWT_EXPIRE_TIME=24h

# Terminal
MAX_TERMINAL_SESSIONS=10
TERMINAL_TIMEOUT=600000
```

#### Frontend (.env)

```bash
# API Configuration
VITE_API_BASE_URL=http://localhost:6000
VITE_WS_URL=ws://localhost:6000
```

## 🔌 API Development

### Adding New Endpoints

1. Create route file in `terminal-backend/src/routes/`
2. Define endpoint logic
3. Register route in `index.js`

Example:

```javascript
// terminal-backend/src/routes/myfeature.js
import express from 'express';
const router = express.Router();

router.get('/status', (req, res) => {
  res.json({ status: 'ok' });
});

export default router;
```

```javascript
// terminal-backend/src/index.js
import myFeatureRouter from './routes/myfeature.js';
app.use('/api/myfeature', myFeatureRouter);
```

### WebSocket Events

The terminal uses WebSocket for real-time communication:

```javascript
// Client
const ws = new WebSocket('ws://localhost:6000');
ws.send(JSON.stringify({
  type: 'command',
  data: 'ls -la'
}));

// Server
ws.on('message', (message) => {
  const { type, data } = JSON.parse(message);
  // Handle command
});
```

## 🧪 Testing

### Unit Tests

```bash
# Run backend tests
cd terminal-backend
npm test

# Run frontend tests
cd terminal-ui
npm run test:unit
```

### API Testing

```bash
# Test card generation
curl -X POST http://localhost:6000/api/generate/card \
  -H "Content-Type: application/json" \
  -d '{"topic": "Test Topic"}'

# Test streaming
curl -X POST http://localhost:6000/api/generate/card/stream \
  -H "Content-Type: application/json" \
  -d '{"topic": "Test Topic", "templateName": "daily-knowledge-card-template.md"}'
```

## 🐳 Docker Development

### Building Images

```bash
# Build from root directory
docker build -t ai-terminal:dev .

# Run with environment variables
docker run -d -p 8083:6000 \
  -e ANTHROPIC_AUTH_TOKEN=your_token \
  -e NODE_ENV=development \
  ai-terminal:dev
```

### Docker Compose (Development)

```yaml
version: '3.8'
services:
  ai-terminal:
    build: .
    ports:
      - "8083:6000"
    environment:
      - ANTHROPIC_AUTH_TOKEN=${ANTHROPIC_AUTH_TOKEN}
      - NODE_ENV=development
    volumes:
      - ./terminal-backend:/app/terminal-backend
      - ./terminal-ui/dist:/app/static
```

## 📝 Code Style

### JavaScript/Node.js

- ES6+ syntax
- Async/await for asynchronous code
- JSDoc comments for functions
- Meaningful variable names

### Vue.js

- Composition API preferred
- Single File Components
- Props validation
- Emit events for parent communication

### Git Commit Messages

Follow conventional commits:

```
feat: add new feature
fix: resolve bug
docs: update documentation
style: format code
refactor: restructure code
test: add tests
chore: update dependencies
```

## 🚀 Deployment

### Production Build

```bash
# Build frontend
cd terminal-ui
npm run build

# Copy dist to backend static folder
cp -r dist/* ../terminal-backend/static/

# Start production server
cd ../terminal-backend
NODE_ENV=production npm start
```

### Docker Deployment

```bash
# Build production image
docker build -t ai-terminal:prod .

# Push to registry
docker tag ai-terminal:prod your-registry/ai-terminal:latest
docker push your-registry/ai-terminal:latest
```

## 🐛 Debugging

### Backend Debugging

```bash
# Debug mode
DEBUG=* npm run dev

# With inspector
node --inspect src/index.js
```

### Frontend Debugging

- Use Vue DevTools browser extension
- Check browser console for errors
- Network tab for API calls

### Common Issues

1. **Port already in use**
   ```bash
   lsof -i :6000
   kill -9 <PID>
   ```

2. **Module not found**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **WebSocket connection failed**
   - Check CORS settings
   - Verify WebSocket URL
   - Check firewall settings

## 📚 Resources

- [Vue 3 Documentation](https://vuejs.org/)
- [Express.js Guide](https://expressjs.com/)
- [Element Plus Components](https://element-plus.org/)
- [Node-pty Documentation](https://github.com/microsoft/node-pty)
- [Claude API Reference](https://docs.anthropic.com/)

## 🤝 Getting Help

- Check [Documentation](./docs/)
- Search [GitHub Issues](https://github.com/aixier/AI_Terminal/issues)
- Ask in [Discussions](https://github.com/aixier/AI_Terminal/discussions)
- Contact maintainers

---

Happy coding! 🚀