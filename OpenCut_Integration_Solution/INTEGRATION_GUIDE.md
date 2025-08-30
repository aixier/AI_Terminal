# AI Terminal Integration Guide for OpenCut

## Overview

This guide provides step-by-step instructions for integrating AI Terminal into the OpenCut platform. AI Terminal can be integrated as a microservice, embedded component, or standalone application.

## Integration Approaches

### 1. Microservice Integration

Deploy AI Terminal as an independent service that OpenCut can communicate with via APIs.

#### Setup Steps

1. **Deploy AI Terminal Service**
```bash
# Using Docker
docker run -d \
  --name ai-terminal \
  -p 6000:6000 \
  -e ANTHROPIC_API_KEY=your_key \
  -e GEMINI_API_KEY=your_key \
  coopotfan/ai-terminal:latest
```

2. **Configure OpenCut to Connect**
```javascript
// OpenCut configuration
const aiTerminalConfig = {
  baseUrl: 'http://ai-terminal-service:6000',
  apiKey: 'your_api_key',
  timeout: 30000
};
```

3. **Implement API Client**
```javascript
// Example API client for OpenCut
class AITerminalClient {
  constructor(config) {
    this.config = config;
    this.axios = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout
    });
  }

  async generateCard(topic, templateName) {
    const response = await this.axios.post('/api/generate/card/async', {
      topic,
      templateName
    });
    return response.data;
  }

  async checkStatus(taskId) {
    const response = await this.axios.get(`/api/generate/status/${taskId}`);
    return response.data;
  }
}
```

### 2. Embedded Component Integration

Embed AI Terminal UI components directly into OpenCut's interface.

#### Frontend Integration

1. **Install Dependencies**
```bash
npm install @ai-terminal/ui-components
```

2. **Import Components**
```vue
<template>
  <div id="opencut-app">
    <AICardGenerator 
      :api-url="aiTerminalUrl"
      :token="userToken"
      @generated="handleCardGenerated"
    />
  </div>
</template>

<script>
import { AICardGenerator } from '@ai-terminal/ui-components';

export default {
  components: {
    AICardGenerator
  },
  methods: {
    handleCardGenerated(data) {
      // Handle generated card data
      console.log('Card generated:', data);
    }
  }
}
</script>
```

### 3. IFrame Integration

Embed AI Terminal as an iframe for quick integration without code changes.

```html
<iframe 
  src="http://ai-terminal.example.com/card-generator"
  width="100%"
  height="600"
  frameborder="0"
  allow="clipboard-write"
></iframe>
```

#### PostMessage Communication

```javascript
// OpenCut sends message to AI Terminal
const iframe = document.getElementById('ai-terminal-iframe');
iframe.contentWindow.postMessage({
  action: 'generateCard',
  data: {
    topic: 'User Story',
    template: 'daily-knowledge-card'
  }
}, 'http://ai-terminal.example.com');

// OpenCut receives message from AI Terminal
window.addEventListener('message', (event) => {
  if (event.origin !== 'http://ai-terminal.example.com') return;
  
  if (event.data.action === 'cardGenerated') {
    console.log('Card generated:', event.data.result);
  }
});
```

## API Integration Examples

### 1. User Authentication

```javascript
// Authenticate user and get token
async function authenticateUser(username, password) {
  const response = await fetch(`${AI_TERMINAL_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ username, password })
  });
  
  const data = await response.json();
  if (data.success) {
    localStorage.setItem('ai_terminal_token', data.data.token);
    return data.data.token;
  }
  throw new Error(data.message);
}
```

### 2. Card Generation Workflow

```javascript
class CardGenerationWorkflow {
  constructor(apiUrl, token) {
    this.apiUrl = apiUrl;
    this.token = token;
  }

  async generateCard(topic, options = {}) {
    // Step 1: Initiate generation
    const initResponse = await fetch(`${this.apiUrl}/api/generate/card/async`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify({
        topic,
        templateName: options.template || 'cardplanet-Sandra-json',
        style: options.style,
        language: options.language
      })
    });
    
    const initData = await initResponse.json();
    const taskId = initData.data.taskId;
    
    // Step 2: Poll for completion
    return await this.pollForCompletion(taskId);
  }

  async pollForCompletion(taskId, maxAttempts = 60) {
    for (let i = 0; i < maxAttempts; i++) {
      const statusResponse = await fetch(
        `${this.apiUrl}/api/generate/status/${taskId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.token}`
          }
        }
      );
      
      const statusData = await statusResponse.json();
      
      if (statusData.data.status === 'completed') {
        return statusData.data;
      } else if (statusData.data.status === 'failed') {
        throw new Error('Generation failed: ' + statusData.data.message);
      }
      
      // Wait 2 seconds before next poll
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    throw new Error('Generation timeout');
  }
}
```

### 3. Terminal Integration

```javascript
// Initialize terminal connection
class TerminalIntegration {
  constructor(wsUrl, token) {
    this.socket = io(wsUrl, {
      auth: {
        token: token
      }
    });
    
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.socket.on('connect', () => {
      console.log('Terminal connected');
      this.createSession();
    });

    this.socket.on('terminal:output', (data) => {
      this.handleOutput(data);
    });

    this.socket.on('terminal:exit', (data) => {
      console.log('Terminal session ended:', data);
    });
  }

  createSession() {
    this.socket.emit('terminal:create', {
      cols: 80,
      rows: 24,
      cwd: '/workspace'
    });
  }

  sendCommand(command) {
    this.socket.emit('terminal:input', {
      data: command + '\n'
    });
  }

  handleOutput(data) {
    // Process terminal output
    console.log('Terminal output:', data.output);
  }
}
```

## Data Format Specifications

### Card Generation Request
```json
{
  "topic": "string (required)",
  "templateName": "string (optional)",
  "style": "object (optional)",
  "language": "string (optional)",
  "reference": "string (optional)",
  "metadata": {
    "userId": "string",
    "projectId": "string",
    "tags": ["array", "of", "tags"]
  }
}
```

### Card Generation Response
```json
{
  "taskId": "task_123456",
  "status": "completed",
  "files": {
    "json": ["data.json"],
    "html": ["card1.html", "card2.html", "card3.html", "card4.html"]
  },
  "metadata": {
    "generatedAt": "2024-01-01T00:00:00Z",
    "template": "daily-knowledge-card",
    "duration": 15000
  },
  "urls": {
    "preview": "http://ai-terminal/preview/task_123456",
    "download": "http://ai-terminal/download/task_123456"
  }
}
```

## Security Considerations

### 1. API Key Management
```javascript
// Store API keys securely
const secureConfig = {
  aiTerminal: {
    apiKey: process.env.AI_TERMINAL_API_KEY,
    secretKey: process.env.AI_TERMINAL_SECRET_KEY
  }
};
```

### 2. Request Signing
```javascript
// Sign requests for additional security
function signRequest(payload, secretKey) {
  const hmac = crypto.createHmac('sha256', secretKey);
  hmac.update(JSON.stringify(payload));
  return hmac.digest('hex');
}

// Add signature to request
const signature = signRequest(requestBody, secretKey);
headers['X-Signature'] = signature;
```

### 3. CORS Configuration
```javascript
// Configure CORS for OpenCut domain
const corsOptions = {
  origin: ['https://opencut.example.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
```

## Webhook Integration

### Setup Webhooks for Async Events

```javascript
// Register webhook endpoint
const webhookConfig = {
  url: 'https://opencut.example.com/webhooks/ai-terminal',
  events: ['card.generated', 'card.failed', 'terminal.output'],
  secret: 'webhook_secret_key'
};

// Handle webhook in OpenCut
app.post('/webhooks/ai-terminal', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  
  // Verify signature
  if (!verifyWebhookSignature(req.body, signature)) {
    return res.status(401).send('Invalid signature');
  }
  
  // Process webhook event
  switch (req.body.event) {
    case 'card.generated':
      handleCardGenerated(req.body.data);
      break;
    case 'card.failed':
      handleCardFailed(req.body.data);
      break;
    case 'terminal.output':
      handleTerminalOutput(req.body.data);
      break;
  }
  
  res.status(200).send('OK');
});
```

## Performance Optimization

### 1. Connection Pooling
```javascript
// Reuse connections for better performance
const connectionPool = new Map();

function getConnection(userId) {
  if (!connectionPool.has(userId)) {
    connectionPool.set(userId, createNewConnection(userId));
  }
  return connectionPool.get(userId);
}
```

### 2. Caching Strategy
```javascript
// Cache frequently used templates
const templateCache = new Map();
const CACHE_TTL = 3600000; // 1 hour

async function getTemplate(templateId) {
  const cached = templateCache.get(templateId);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  const template = await fetchTemplate(templateId);
  templateCache.set(templateId, {
    data: template,
    timestamp: Date.now()
  });
  
  return template;
}
```

### 3. Batch Processing
```javascript
// Batch multiple card generation requests
async function batchGenerateCards(topics, template) {
  const promises = topics.map(topic => 
    generateCard(topic, template)
  );
  
  return await Promise.allSettled(promises);
}
```

## Monitoring and Logging

```javascript
// Integration monitoring
class AITerminalMonitor {
  constructor() {
    this.metrics = {
      requests: 0,
      successful: 0,
      failed: 0,
      avgResponseTime: 0
    };
  }

  async trackRequest(requestFn) {
    const startTime = Date.now();
    this.metrics.requests++;
    
    try {
      const result = await requestFn();
      this.metrics.successful++;
      this.updateAvgResponseTime(Date.now() - startTime);
      return result;
    } catch (error) {
      this.metrics.failed++;
      this.logError(error);
      throw error;
    }
  }

  updateAvgResponseTime(duration) {
    this.metrics.avgResponseTime = 
      (this.metrics.avgResponseTime * (this.metrics.requests - 1) + duration) 
      / this.metrics.requests;
  }

  logError(error) {
    console.error('[AI Terminal Integration Error]', {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack
    });
  }
}
```

## Support Resources

- **Documentation**: https://github.com/aixier/AI_Terminal/wiki
- **API Reference**: See [API_REFERENCE.md](./API_REFERENCE.md)
- **Examples**: https://github.com/aixier/AI_Terminal/tree/main/examples
- **Issues**: https://github.com/aixier/AI_Terminal/issues
- **Community**: Discord/Slack channels