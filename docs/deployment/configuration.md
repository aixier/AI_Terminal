# ⚙️ 配置管理指南

本指南详细介绍AI Terminal的配置选项和环境变量设置。

## 📋 环境变量

### 🔑 必需的环境变量

```bash
# Claude AI 配置
ANTHROPIC_AUTH_TOKEN=your_claude_token_here
ANTHROPIC_BASE_URL=https://api.anthropic.com

# 服务配置
NODE_ENV=production
PORT=6000
HOST=0.0.0.0

# 数据路径
DATA_PATH=/app/data
STATIC_PATH=/app/static
```

### 🔧 可选的环境变量

```bash
# 日志配置
LOG_LEVEL=info
LOG_PATH=/app/logs

# 安全配置
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRE_TIME=24h

# 终端配置
MAX_TERMINAL_SESSIONS=10
TERMINAL_TIMEOUT=600000

# CORS配置
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com

# 上传配置
MAX_FILE_SIZE=10485760
UPLOAD_PATH=/app/uploads
```

## 🐳 Docker配置

### 环境变量文件
创建`.env`文件：
```bash
# .env
ANTHROPIC_AUTH_TOKEN=your_token
ANTHROPIC_BASE_URL=https://api.anthropic.com
NODE_ENV=production
```

### Docker Compose
```yaml
version: '3.8'
services:
  ai-terminal:
    build: .
    ports:
      - "8080:6000"
    env_file:
      - .env
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    restart: unless-stopped
```

## 📄 配置文件详解

### 后端配置 (config.js)
```javascript
export default {
  server: {
    port: process.env.PORT || 6000,
    host: process.env.HOST || '0.0.0.0'
  },
  
  ai: {
    anthropic: {
      authToken: process.env.ANTHROPIC_AUTH_TOKEN,
      baseUrl: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com'
    }
  },
  
  security: {
    jwt: {
      secret: process.env.JWT_SECRET || 'default-secret',
      expiresIn: process.env.JWT_EXPIRE_TIME || '24h'
    },
    cors: {
      origins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000']
    }
  }
}
```

### 前端配置 (vite.config.js)
```javascript
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:6000',
        changeOrigin: true
      }
    }
  },
  
  build: {
    outDir: 'dist',
    sourcemap: process.env.NODE_ENV === 'development'
  }
})
```

## ☁️ 云平台配置

### 阿里云函数计算
```yaml
# s.yaml
edition: 1.0.0
name: ai-terminal
access: default

services:
  ai-terminal:
    component: fc
    props:
      region: cn-hangzhou
      service:
        name: ai-terminal-service
        runtime: nodejs18
        environmentVariables:
          ANTHROPIC_AUTH_TOKEN: ${env(ANTHROPIC_AUTH_TOKEN)}
          NODE_ENV: production
```

### AWS Lambda
```yaml
# serverless.yml
service: ai-terminal

provider:
  name: aws
  runtime: nodejs18.x
  environment:
    ANTHROPIC_AUTH_TOKEN: ${env:ANTHROPIC_AUTH_TOKEN}
    NODE_ENV: production

functions:
  api:
    handler: index.handler
    events:
      - http:
          path: /{proxy+}
          method: ANY
```

## 🔒 安全配置

### HTTPS配置
```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    location / {
        proxy_pass http://localhost:6000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 防火墙配置
```bash
# 只允许必要的端口
ufw allow 22    # SSH
ufw allow 80    # HTTP
ufw allow 443   # HTTPS
ufw enable
```

## 📊 监控配置

### 健康检查
```javascript
// 健康检查端点
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version
  })
})
```

### 日志配置
```javascript
import winston from 'winston'

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: path.join(process.env.LOG_PATH || './logs', 'error.log'),
      level: 'error'
    }),
    new winston.transports.File({ 
      filename: path.join(process.env.LOG_PATH || './logs', 'combined.log')
    })
  ]
})
```

---

更多配置选项请参考[部署文档](README.md)。