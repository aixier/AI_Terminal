# 🔧 Universal CLI Adapter Architecture

> Transform ANY CLI tool into REST/WebSocket APIs with zero code

## 📐 Architecture Overview

The Universal CLI Adapter is the core innovation that enables AI Terminal to transform any command-line tool into accessible APIs. It provides a standardized way to integrate, manage, and expose CLI tools through modern web APIs.

```
┌──────────────────────────────────────────────────────────────┐
│                     Client Applications                       │
│  (Web, Mobile, Desktop, API Consumers)                       │
└────────────────────────┬─────────────────────────────────────┘
                         │ HTTP/WebSocket
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                      API Gateway Layer                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Routes  │  Auth  │  Rate Limit  │  Cache  │  Logs  │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│              Universal CLI Adapter Framework                  │
│                                                               │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ Adapter Manager │  │ Session Manager │                  │
│  └────────┬────────┘  └────────┬────────┘                  │
│           │                     │                            │
│  ┌────────▼────────────────────▼────────┐                  │
│  │     Adapter Registry & Discovery      │                  │
│  └───────────────────────────────────────┘                  │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              CLI Adapter Instances                     │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐    │  │
│  │  │ Claude  │ │ Gemini  │ │ Cursor  │ │   GPT   │ ...│  │
│  │  │ Adapter │ │ Adapter │ │ Adapter │ │ Adapter │    │  │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘    │  │
│  └───────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                    Native CLI Tools                           │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │ claude  │ │ gemini  │ │ cursor  │ │   gpt   │  ...     │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘          │
└──────────────────────────────────────────────────────────────┘
```

## 🎯 Core Components

### 1. Base CLI Adapter Interface

```typescript
// Universal adapter interface that all CLI tools must implement
interface ICLIAdapter {
  // Metadata
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly capabilities: CLICapabilities;
  
  // Lifecycle methods
  initialize(config: AdapterConfig): Promise<void>;
  healthCheck(): Promise<HealthStatus>;
  destroy(): Promise<void>;
  
  // Execution methods
  execute(command: string, options?: ExecuteOptions): Promise<CLIResponse>;
  stream(command: string, options?: StreamOptions): AsyncGenerator<StreamChunk>;
  
  // Session management
  createSession(sessionId: string): Promise<CLISession>;
  getSession(sessionId: string): CLISession | null;
  destroySession(sessionId: string): Promise<void>;
  
  // API generation
  generateEndpoints(): APIEndpoint[];
  getOpenAPISpec(): OpenAPISchema;
}
```

### 2. Adapter Implementation Example

```typescript
// Example: Claude Code Adapter
export class ClaudeCodeAdapter implements ICLIAdapter {
  name = 'claude-code';
  version = '1.0.0';
  description = 'Anthropic Claude Code CLI adapter';
  
  capabilities = {
    streaming: true,
    sessions: true,
    stateful: true,
    authentication: 'token',
    fileOperations: true,
    multiModal: false
  };
  
  private sessions = new Map<string, ClaudeSession>();
  
  async initialize(config: AdapterConfig) {
    // Validate Claude is installed
    await this.validateInstallation();
    
    // Set up environment
    process.env.ANTHROPIC_AUTH_TOKEN = config.authToken;
    
    // Initialize session pool
    await this.initializeSessionPool(config.maxSessions);
  }
  
  async execute(command: string, options?: ExecuteOptions) {
    const session = await this.getOrCreateSession(options?.sessionId);
    
    // Handle initialization if needed
    if (!session.initialized) {
      await this.initializeClaude(session);
    }
    
    // Execute command
    const result = await session.execute(command);
    
    return {
      success: true,
      output: result,
      metadata: {
        executionTime: Date.now() - startTime,
        sessionId: session.id
      }
    };
  }
  
  async *stream(command: string, options?: StreamOptions) {
    const session = await this.getOrCreateSession(options?.sessionId);
    
    // Create streaming PTY session
    const pty = session.createPTY();
    
    // Send command
    pty.write(command + '\r');
    
    // Stream output
    for await (const chunk of pty.stream()) {
      yield {
        type: 'output',
        data: chunk,
        timestamp: Date.now()
      };
    }
  }
  
  generateEndpoints(): APIEndpoint[] {
    return [
      {
        method: 'POST',
        path: '/api/claude/execute',
        handler: this.executeHandler.bind(this),
        schema: claudeExecuteSchema
      },
      {
        method: 'POST',
        path: '/api/claude/stream',
        handler: this.streamHandler.bind(this),
        schema: claudeStreamSchema
      },
      {
        method: 'GET',
        path: '/api/claude/sessions',
        handler: this.getSessionsHandler.bind(this)
      }
    ];
  }
}
```

### 3. Adapter Registry & Discovery

```typescript
class AdapterRegistry {
  private adapters = new Map<string, ICLIAdapter>();
  private routes = new Map<string, RouteHandler>();
  
  // Register a new adapter
  async register(adapter: ICLIAdapter) {
    // Validate adapter
    this.validateAdapter(adapter);
    
    // Initialize adapter
    await adapter.initialize(this.getConfig(adapter.name));
    
    // Register in registry
    this.adapters.set(adapter.name, adapter);
    
    // Generate and register API endpoints
    const endpoints = adapter.generateEndpoints();
    this.registerEndpoints(adapter.name, endpoints);
    
    // Emit registration event
    this.emit('adapter:registered', adapter);
    
    console.log(`✅ Registered adapter: ${adapter.name} v${adapter.version}`);
  }
  
  // Auto-discover adapters from plugins directory
  async autoDiscover(pluginsDir: string) {
    const files = await fs.readdir(pluginsDir);
    
    for (const file of files) {
      if (file.endsWith('.adapter.js')) {
        const AdapterClass = require(path.join(pluginsDir, file));
        const adapter = new AdapterClass();
        await this.register(adapter);
      }
    }
  }
  
  // Get adapter by name
  getAdapter(name: string): ICLIAdapter | null {
    return this.adapters.get(name) || null;
  }
  
  // List all registered adapters
  listAdapters(): AdapterInfo[] {
    return Array.from(this.adapters.values()).map(adapter => ({
      name: adapter.name,
      version: adapter.version,
      description: adapter.description,
      capabilities: adapter.capabilities,
      endpoints: adapter.generateEndpoints().map(e => e.path)
    }));
  }
}
```

### 4. Session Management

```typescript
class SessionManager {
  private sessions = new Map<string, SessionInfo>();
  private pools = new Map<string, SessionPool>();
  
  // Create a new session
  async createSession(
    adapterId: string, 
    userId: string,
    options?: SessionOptions
  ): Promise<Session> {
    const adapter = this.registry.getAdapter(adapterId);
    if (!adapter) throw new Error(`Adapter ${adapterId} not found`);
    
    // Get or create session pool for this adapter
    const pool = this.getOrCreatePool(adapterId);
    
    // Acquire session from pool
    const session = await pool.acquire();
    
    // Initialize session
    await session.initialize({
      userId,
      timeout: options?.timeout || 300000,
      maxMemory: options?.maxMemory || '512m'
    });
    
    // Track session
    this.sessions.set(session.id, {
      id: session.id,
      adapterId,
      userId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      status: 'active'
    });
    
    return session;
  }
  
  // Session pooling for performance
  private getOrCreatePool(adapterId: string): SessionPool {
    if (!this.pools.has(adapterId)) {
      this.pools.set(adapterId, new SessionPool({
        adapter: this.registry.getAdapter(adapterId),
        minSize: 2,
        maxSize: 10,
        idleTimeout: 300000
      }));
    }
    return this.pools.get(adapterId)!;
  }
  
  // Clean up idle sessions
  async cleanupIdleSessions() {
    const now = Date.now();
    const idleTimeout = 300000; // 5 minutes
    
    for (const [sessionId, info] of this.sessions) {
      if (now - info.lastActivity > idleTimeout) {
        await this.destroySession(sessionId);
      }
    }
  }
}
```

### 5. API Generation Engine

```typescript
class APIGenerator {
  // Generate OpenAPI spec for an adapter
  generateOpenAPISpec(adapter: ICLIAdapter): OpenAPISchema {
    const endpoints = adapter.generateEndpoints();
    
    return {
      openapi: '3.0.0',
      info: {
        title: `${adapter.name} API`,
        version: adapter.version,
        description: adapter.description
      },
      paths: this.generatePaths(endpoints),
      components: this.generateComponents(adapter)
    };
  }
  
  // Generate Express routes
  generateExpressRoutes(adapter: ICLIAdapter): Router {
    const router = Router();
    const endpoints = adapter.generateEndpoints();
    
    for (const endpoint of endpoints) {
      const middleware = this.createMiddleware(endpoint);
      
      switch (endpoint.method) {
        case 'GET':
          router.get(endpoint.path, ...middleware, endpoint.handler);
          break;
        case 'POST':
          router.post(endpoint.path, ...middleware, endpoint.handler);
          break;
        // ... other methods
      }
    }
    
    return router;
  }
  
  // Create middleware stack for endpoint
  private createMiddleware(endpoint: APIEndpoint) {
    const middleware = [];
    
    // Authentication
    if (endpoint.auth) {
      middleware.push(authMiddleware(endpoint.auth));
    }
    
    // Validation
    if (endpoint.schema) {
      middleware.push(validationMiddleware(endpoint.schema));
    }
    
    // Rate limiting
    if (endpoint.rateLimit) {
      middleware.push(rateLimitMiddleware(endpoint.rateLimit));
    }
    
    return middleware;
  }
}
```

## 🔌 Creating Custom Adapters

### Step 1: Create Adapter Class

```javascript
// my-cli-adapter.js
import { BaseAdapter } from '@ai-terminal/core';

export class MyCLIAdapter extends BaseAdapter {
  name = 'my-cli';
  version = '1.0.0';
  
  async initialize(config) {
    // Verify CLI is installed
    const installed = await this.checkInstallation('my-cli');
    if (!installed) {
      throw new Error('my-cli is not installed');
    }
    
    // Set up environment
    this.setupEnvironment(config);
  }
  
  async execute(command, options) {
    // Create PTY session
    const pty = this.createPTY();
    
    // Execute command
    const output = await pty.execute(`my-cli ${command}`);
    
    return {
      success: true,
      output
    };
  }
  
  generateEndpoints() {
    return [
      {
        method: 'POST',
        path: '/api/my-cli/run',
        handler: async (req, res) => {
          const result = await this.execute(req.body.command);
          res.json(result);
        }
      }
    ];
  }
}
```

### Step 2: Register Adapter

```javascript
// Register adapter with AI Terminal
import { AdapterRegistry } from '@ai-terminal/core';
import { MyCLIAdapter } from './my-cli-adapter';

const registry = new AdapterRegistry();
const adapter = new MyCLIAdapter();

await registry.register(adapter);

// Adapter is now available at:
// POST /api/my-cli/run
```

### Step 3: Use the Adapter

```bash
# Use your CLI through API
curl -X POST http://localhost:8082/api/my-cli/run \
  -H "Content-Type: application/json" \
  -d '{"command": "hello world"}'
```

## 🎨 Adapter Templates

### AI/LLM CLI Template
```javascript
class LLMAdapter extends BaseAdapter {
  // Common patterns for AI/LLM CLIs
  async initializeModel() { /* ... */ }
  async generateText() { /* ... */ }
  async streamResponse() { /* ... */ }
}
```

### Development Tool Template
```javascript
class DevToolAdapter extends BaseAdapter {
  // Common patterns for dev tools
  async runBuild() { /* ... */ }
  async runTests() { /* ... */ }
  async lint() { /* ... */ }
}
```

### Data Processing Template
```javascript
class DataAdapter extends BaseAdapter {
  // Common patterns for data tools
  async importData() { /* ... */ }
  async transform() { /* ... */ }
  async export() { /* ... */ }
}
```

## 📊 Performance Optimization

### Connection Pooling
```javascript
class ConnectionPool {
  constructor(adapter, options) {
    this.adapter = adapter;
    this.minConnections = options.min || 2;
    this.maxConnections = options.max || 10;
    this.connections = [];
  }
  
  async acquire() {
    // Get available connection or create new one
    let connection = this.connections.find(c => !c.inUse);
    
    if (!connection && this.connections.length < this.maxConnections) {
      connection = await this.createConnection();
      this.connections.push(connection);
    }
    
    if (connection) {
      connection.inUse = true;
      return connection;
    }
    
    // Wait for available connection
    return this.waitForConnection();
  }
}
```

### Caching Strategy
```javascript
class AdapterCache {
  constructor() {
    this.cache = new LRUCache({
      max: 1000,
      ttl: 300000 // 5 minutes
    });
  }
  
  async execute(adapter, command, options) {
    const cacheKey = this.getCacheKey(adapter.name, command, options);
    
    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && !options.noCache) {
      return cached;
    }
    
    // Execute command
    const result = await adapter.execute(command, options);
    
    // Cache result
    if (result.success && options.cacheable) {
      this.cache.set(cacheKey, result);
    }
    
    return result;
  }
}
```

## 🔒 Security Considerations

### Sandboxing
- Each adapter runs in isolated environment
- Resource limits enforced
- Network access controlled

### Input Validation
- Command injection prevention
- Path traversal protection
- Size limits on inputs

### Authentication & Authorization
- Per-adapter authentication
- Role-based access control
- API key management

## 🚀 Future Enhancements

### 1. AI-Powered Adapter Generation
```javascript
// Future: AI generates adapter from CLI documentation
const adapter = await AI.generateAdapter({
  cliName: 'new-cli',
  documentation: 'https://new-cli.docs',
  examples: ['new-cli --help', 'new-cli run']
});
```

### 2. Visual Adapter Builder
- Drag-and-drop interface
- No-code adapter creation
- Automatic testing

### 3. Adapter Marketplace
- Community adapters
- Verified publishers
- One-click installation

---

## 📚 Resources

- [Creating Your First Adapter](../guides/first-adapter.md)
- [Adapter Best Practices](../guides/adapter-best-practices.md)
- [API Reference](../api/adapter-api.md)
- [Example Adapters](../../examples/adapters/)

---

**The Universal CLI Adapter - Making every CLI tool accessible to everyone.**