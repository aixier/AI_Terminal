# 部署指南

## 构建项目

### 前端构建

```bash
cd terminal-ui
npm install
npm run build
```

构建完成后，静态文件将生成在 `terminal-ui/dist` 目录。

### 后端构建

```bash
cd terminal-backend
npm install
npm run build
```

构建完成后，生产环境文件将生成在 `terminal-backend/dist` 目录。

## 生产环境配置

### 1. 前端配置

修改 `terminal-ui/.env.production`：
```env
VITE_API_BASE_URL=https://your-api-domain.com/api
VITE_WS_URL=wss://your-api-domain.com
```

### 2. 后端配置

创建 `terminal-backend/.env.production`：
```env
# Server Configuration
PORT=3000
NODE_ENV=production

# JWT Configuration
JWT_SECRET=your-strong-secret-key-please-change-this
JWT_EXPIRE_TIME=24h

# Logging
LOG_LEVEL=info

# Terminal Configuration
MAX_TERMINAL_SESSIONS=20
TERMINAL_TIMEOUT=1800000

# Security
ALLOWED_ORIGINS=https://your-frontend-domain.com

# Database (if needed in future)
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=terminal_db
```

## 部署方式

### 方式一：使用 Nginx + PM2

#### 1. 部署前端

将 `terminal-ui/dist` 目录内容部署到 Nginx：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    root /var/www/terminal-ui;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    location /socket.io {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

#### 2. 部署后端

使用 PM2 管理后端进程：

```bash
# 安装 PM2
npm install -g pm2

# 启动后端
cd terminal-backend
pm2 start ecosystem.config.js

# 保存 PM2 配置
pm2 save
pm2 startup
```

创建 `terminal-backend/ecosystem.config.js`：
```javascript
module.exports = {
  apps: [{
    name: 'terminal-backend',
    script: './src/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    }
  }]
}
```

### 方式二：使用 Docker

#### 前端 Dockerfile

创建 `terminal-ui/Dockerfile`：
```dockerfile
# 构建阶段
FROM node:18-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# 生产阶段
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### 后端 Dockerfile

创建 `terminal-backend/Dockerfile`：
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "src/index.js"]
```

#### Docker 部署

分别构建和运行前后端容器：

```bash
# 构建前端镜像
cd terminal-ui
docker build -t terminal-frontend .

# 构建后端镜像
cd ../terminal-backend
docker build -t terminal-backend .

# 运行后端容器
docker run -d \
  --name terminal-backend \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e JWT_SECRET=your-secret-key \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  terminal-backend

# 运行前端容器
docker run -d \
  --name terminal-frontend \
  -p 80:80 \
  --link terminal-backend:backend \
  terminal-frontend
```

### 方式三：使用 Kubernetes

创建 Kubernetes 配置文件进行容器编排部署。

## 性能优化

### 1. 启用 Gzip 压缩

Nginx 配置：
```nginx
gzip on;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
```

### 2. 配置 CDN

将静态资源部署到 CDN，修改 `vite.config.js`：
```javascript
build: {
  base: 'https://cdn.your-domain.com/'
}
```

### 3. 数据库优化（未来扩展）

当系统扩展使用数据库时：
- 使用连接池
- 添加适当的索引
- 实施查询缓存

## 监控和日志

### 1. 应用监控

使用 PM2 自带的监控：
```bash
pm2 monit
```

### 2. 日志管理

- 前端错误日志：集成 Sentry
- 后端日志：使用 Winston 输出到文件
- 访问日志：Nginx access.log

### 3. 健康检查

配置健康检查端点：
```bash
curl http://localhost:3000/health
```

## 安全加固

### 1. HTTPS 配置

使用 Let's Encrypt 免费证书：
```bash
sudo certbot --nginx -d your-domain.com
```

### 2. 防火墙配置

```bash
# 只开放必要端口
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 3. 安全头配置

Nginx 安全头：
```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;
add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
```

## 备份策略

### 1. 数据备份

```bash
# 备份用户数据和配置
tar -czf backup-$(date +%Y%m%d).tar.gz terminal-backend/src/data
```

### 2. 自动备份脚本

创建 cron 任务：
```bash
0 2 * * * /path/to/backup-script.sh
```

## 故障恢复

### 1. 服务重启

```bash
# 重启前端
sudo systemctl restart nginx

# 重启后端
pm2 restart terminal-backend
```

### 2. 日志检查

```bash
# 查看后端日志
pm2 logs terminal-backend

# 查看 Nginx 错误日志
tail -f /var/log/nginx/error.log
```

## 扩展部署

### 1. 负载均衡

使用 Nginx 负载均衡多个后端实例：
```nginx
upstream backend {
    server localhost:3001;
    server localhost:3002;
    server localhost:3003;
}
```

### 2. Redis 缓存

添加 Redis 缓存层提升性能：
```javascript
// 安装 redis
npm install redis

// 配置缓存
const redis = require('redis');
const client = redis.createClient();
```

### 3. 容器化集群

使用 Kubernetes 实现自动扩缩容。

## 维护建议

1. 定期更新依赖包
2. 监控系统资源使用
3. 定期备份数据
4. 记录和分析错误日志
5. 进行安全审计