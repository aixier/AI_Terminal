# AI Terminal Deployment Guide

## Deployment Options

AI Terminal supports multiple deployment strategies to fit different infrastructure requirements and scale.

## 1. Docker Deployment (Recommended)

### Single Container Deployment

```bash
# Pull the latest image
docker pull coopotfan/ai-terminal:latest

# Run with environment variables
docker run -d \
  --name ai-terminal \
  -p 6000:6000 \
  -e ANTHROPIC_API_KEY=your_claude_key \
  -e GEMINI_API_KEY=your_gemini_key \
  -e JWT_SECRET=your_jwt_secret \
  -v ai-terminal-data:/app/data \
  coopotfan/ai-terminal:latest
```

### Docker Compose Deployment

```yaml
# docker-compose.yml
version: '3.8'

services:
  ai-terminal:
    image: coopotfan/ai-terminal:latest
    container_name: ai-terminal
    ports:
      - "6000:6000"
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - JWT_SECRET=${JWT_SECRET}
      - NODE_ENV=production
      - PORT=6000
    volumes:
      - ai-terminal-data:/app/data
      - ai-terminal-logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:6000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  ai-terminal-data:
  ai-terminal-logs:
```

### Building Custom Docker Image

```dockerfile
# Dockerfile for custom build
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY terminal-backend/package*.json ./terminal-backend/
COPY terminal-ui/package*.json ./terminal-ui/

# Install dependencies
RUN npm ci --only=production
RUN cd terminal-backend && npm ci --only=production
RUN cd terminal-ui && npm ci

# Copy application code
COPY . .

# Build frontend
RUN cd terminal-ui && npm run build

# Expose port
EXPOSE 6000

# Start application
CMD ["npm", "start"]
```

## 2. Kubernetes Deployment

### Deployment Configuration

```yaml
# ai-terminal-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ai-terminal
  labels:
    app: ai-terminal
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ai-terminal
  template:
    metadata:
      labels:
        app: ai-terminal
    spec:
      containers:
      - name: ai-terminal
        image: coopotfan/ai-terminal:latest
        ports:
        - containerPort: 6000
        env:
        - name: ANTHROPIC_API_KEY
          valueFrom:
            secretKeyRef:
              name: ai-terminal-secrets
              key: anthropic-key
        - name: GEMINI_API_KEY
          valueFrom:
            secretKeyRef:
              name: ai-terminal-secrets
              key: gemini-key
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: ai-terminal-secrets
              key: jwt-secret
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 6000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 6000
          initialDelaySeconds: 5
          periodSeconds: 5
```

### Service Configuration

```yaml
# ai-terminal-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: ai-terminal-service
spec:
  selector:
    app: ai-terminal
  ports:
    - protocol: TCP
      port: 80
      targetPort: 6000
  type: LoadBalancer
```

### Ingress Configuration

```yaml
# ai-terminal-ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ai-terminal-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "600"
spec:
  rules:
  - host: ai-terminal.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: ai-terminal-service
            port:
              number: 80
  tls:
  - hosts:
    - ai-terminal.example.com
    secretName: ai-terminal-tls
```

## 3. Manual Deployment

### Prerequisites

```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
npm install -g pm2
```

### Installation Steps

```bash
# Clone repository
git clone https://github.com/aixier/AI_Terminal.git
cd AI_Terminal

# Install dependencies
npm install
cd terminal-backend && npm install
cd ../terminal-ui && npm install

# Build frontend
npm run build

# Create environment file
cp .env.example .env
nano .env  # Edit with your API keys

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### PM2 Configuration

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'ai-terminal',
    script: './terminal-backend/src/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 6000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    min_uptime: '5s',
    max_restarts: 10
  }]
};
```

## 4. Cloud Platform Deployment

### AWS Elastic Beanstalk

```yaml
# .ebextensions/nodecommand.config
option_settings:
  aws:elasticbeanstalk:container:nodejs:
    NodeCommand: "npm start"
    NodeVersion: 18.x
  aws:elasticbeanstalk:application:environment:
    NODE_ENV: production
    PORT: 8080
```

### Google Cloud Run

```bash
# Build and deploy to Cloud Run
gcloud builds submit --tag gcr.io/PROJECT_ID/ai-terminal
gcloud run deploy ai-terminal \
  --image gcr.io/PROJECT_ID/ai-terminal \
  --platform managed \
  --port 6000 \
  --memory 1Gi \
  --cpu 2 \
  --set-env-vars="NODE_ENV=production" \
  --set-secrets="ANTHROPIC_API_KEY=anthropic-key:latest"
```

### Azure Container Instances

```bash
# Deploy to Azure
az container create \
  --resource-group myResourceGroup \
  --name ai-terminal \
  --image coopotfan/ai-terminal:latest \
  --ports 6000 \
  --environment-variables \
    NODE_ENV=production \
  --secure-environment-variables \
    ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
    GEMINI_API_KEY=$GEMINI_API_KEY
```

## Environment Configuration

### Required Environment Variables

```bash
# AI Service Keys (Required)
ANTHROPIC_API_KEY=sk-ant-xxxxx
GEMINI_API_KEY=AIzaSyxxxxx

# Security (Required for production)
JWT_SECRET=your-secure-jwt-secret-key
SESSION_SECRET=your-secure-session-secret

# Server Configuration (Optional)
NODE_ENV=production
PORT=6000
HOST=0.0.0.0

# Database (Optional - for future use)
DATABASE_URL=postgresql://user:pass@host:5432/dbname
REDIS_URL=redis://localhost:6379

# Storage (Optional)
STORAGE_TYPE=local  # or 's3', 'gcs', 'azure'
STORAGE_PATH=/app/data
S3_BUCKET=ai-terminal-storage
S3_REGION=us-east-1

# Rate Limiting (Optional)
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX_REQUESTS=100

# Logging (Optional)
LOG_LEVEL=info  # debug, info, warn, error
LOG_FORMAT=json  # json or text
```

### Configuration File

```javascript
// config/production.js
module.exports = {
  server: {
    port: process.env.PORT || 6000,
    host: process.env.HOST || '0.0.0.0'
  },
  ai: {
    claude: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: 'claude-3-opus-20240229',
      maxTokens: 4000
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY,
      model: 'gemini-pro'
    }
  },
  security: {
    jwtSecret: process.env.JWT_SECRET,
    sessionSecret: process.env.SESSION_SECRET,
    tokenExpiry: '24h'
  },
  storage: {
    type: process.env.STORAGE_TYPE || 'local',
    path: process.env.STORAGE_PATH || './data'
  }
};
```

## Nginx Configuration

### Reverse Proxy Setup

```nginx
# /etc/nginx/sites-available/ai-terminal
server {
    listen 80;
    server_name ai-terminal.example.com;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ai-terminal.example.com;
    
    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/ai-terminal.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ai-terminal.example.com/privkey.pem;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Proxy settings
    location / {
        proxy_pass http://localhost:6000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support
        proxy_read_timeout 86400;
    }
    
    # Static files (if serving separately)
    location /static {
        alias /var/www/ai-terminal/static;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

## Performance Tuning

### Node.js Optimization

```javascript
// Cluster mode for multi-core utilization
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`);
  
  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  
  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died`);
    cluster.fork(); // Restart worker
  });
} else {
  // Worker process
  require('./terminal-backend/src/index.js');
}
```

### Memory Management

```bash
# Set Node.js memory limits
NODE_OPTIONS="--max-old-space-size=4096" npm start

# PM2 memory management
pm2 start app.js --max-memory-restart 1G
```

### Database Connection Pooling

```javascript
// Connection pool configuration
const pool = {
  min: 2,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
};
```

## Monitoring and Logging

### Health Check Endpoint

```javascript
// Health check implementation
app.get('/api/health', async (req, res) => {
  const health = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: Date.now(),
    checks: {
      database: await checkDatabase(),
      aiService: await checkAIService(),
      storage: await checkStorage()
    }
  };
  
  const allHealthy = Object.values(health.checks).every(check => check.healthy);
  
  res.status(allHealthy ? 200 : 503).json(health);
});
```

### Prometheus Metrics

```javascript
// Prometheus metrics setup
const prometheus = require('prom-client');
const register = new prometheus.Registry();

// Default metrics
prometheus.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  registers: [register]
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(register.metrics());
});
```

### Logging Configuration

```javascript
// Winston logging setup
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});
```

## Backup and Recovery

### Data Backup Strategy

```bash
#!/bin/bash
# backup.sh - Daily backup script

BACKUP_DIR="/backups/ai-terminal"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup data directory
tar -czf $BACKUP_DIR/data_$DATE.tar.gz /app/data

# Backup database (if applicable)
pg_dump $DATABASE_URL > $BACKUP_DIR/db_$DATE.sql

# Keep only last 30 days of backups
find $BACKUP_DIR -type f -mtime +30 -delete

# Upload to S3 (optional)
aws s3 sync $BACKUP_DIR s3://backup-bucket/ai-terminal/
```

### Disaster Recovery

```bash
#!/bin/bash
# restore.sh - Restore from backup

BACKUP_FILE=$1
RESTORE_DIR="/app/data"

# Stop application
pm2 stop ai-terminal

# Extract backup
tar -xzf $BACKUP_FILE -C $RESTORE_DIR

# Restore database (if applicable)
psql $DATABASE_URL < db_backup.sql

# Start application
pm2 start ai-terminal
```

## Security Hardening

### SSL/TLS Configuration

```bash
# Generate SSL certificate with Let's Encrypt
certbot certonly --standalone -d ai-terminal.example.com
```

### Firewall Rules

```bash
# UFW firewall configuration
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp  # SSH
ufw allow 80/tcp  # HTTP
ufw allow 443/tcp # HTTPS
ufw allow 6000/tcp # AI Terminal (if direct access needed)
ufw enable
```

### Security Headers

```javascript
// Security middleware
const helmet = require('helmet');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "https:"]
    }
  }
}));
```

## Troubleshooting

### Common Issues

1. **Port Already in Use**
```bash
# Find process using port 6000
lsof -i :6000
# Kill process
kill -9 <PID>
```

2. **Memory Issues**
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=8192"
```

3. **Permission Errors**
```bash
# Fix file permissions
chown -R node:node /app
chmod -R 755 /app
```

4. **WebSocket Connection Issues**
- Check nginx proxy_read_timeout
- Verify firewall allows WebSocket traffic
- Enable sticky sessions in load balancer

### Debug Mode

```bash
# Enable debug logging
DEBUG=* npm start

# PM2 debug mode
pm2 start app.js --log-type json --merge-logs
```

## Maintenance

### Zero-Downtime Deployment

```bash
# PM2 reload with zero downtime
pm2 reload ai-terminal

# Docker rolling update
docker service update --image coopotfan/ai-terminal:new ai-terminal
```

### Database Migrations

```bash
# Run migrations
npm run migrate:up

# Rollback migrations
npm run migrate:down
```

### Performance Monitoring

```bash
# PM2 monitoring
pm2 monit

# Docker stats
docker stats ai-terminal

# System monitoring
htop
iotop
```