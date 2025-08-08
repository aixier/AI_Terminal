# Docker 部署指南

> **MVP快速部署？** 查看 [README_DOCKER_MVP.md](README_DOCKER_MVP.md) - 一行命令启动！

## 环境要求

- Docker 20.10+
- Docker Compose 2.0+ (可选)
- 足够的磁盘空间（至少2GB）

## Dockerfile 说明

项目提供了两个Dockerfile：

### 1. Dockerfile (标准版)
- 基于 Node.js 22 Alpine
- 包含完整的开发依赖
- 适合开发和测试环境
- 包含 Claude Code CLI 工具
- **环境变量已硬编码在Dockerfile中**

### 2. Dockerfile.production (生产优化版)
- 使用多阶段构建减小镜像体积
- 只包含运行时必要依赖
- 使用 tini 作为 init 进程
- 更严格的安全配置
- **生产环境配置已硬编码**

## 环境变量配置

### 硬编码的环境变量（在Dockerfile中设置）
以下环境变量已在Dockerfile中硬编码，通常不需要修改：

- `NODE_ENV=production` - 运行环境
- `PORT=3000` - 服务端口
- `LOG_LEVEL=info` - 日志级别
- `JWT_SECRET=default-jwt-secret-change-in-production` - JWT密钥（用于用户认证，生产环境建议修改）
- `JWT_EXPIRE_TIME=24h` - JWT过期时间
- `MAX_TERMINAL_SESSIONS=10` - 最大终端会话数
- `TERMINAL_TIMEOUT=600000` - 终端超时时间（10分钟）
- `ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000` - CORS允许的源
- `HOME=/home/nodeuser` - 用户主目录
- `LANG=en_US.UTF-8` - 语言设置

### Claude集成说明
Claude功能通过已安装的 `claude-code` CLI工具实现，不需要配置API密钥。
Claude CLI会在终端会话中直接使用。

### 认证系统说明
系统包含基础的JWT认证功能：
- 默认用户：`admin` （密码在代码中硬编码）
- JWT_SECRET用于签名和验证token
- 生产环境强烈建议修改JWT_SECRET的默认值

## 构建镜像

### 开发环境
```bash
docker build -t terminal-backend:dev .
```

### 生产环境
```bash
docker build -f Dockerfile.production -t terminal-backend:prod .
```

## 运行容器

### 使用 Docker 命令

```bash
# 开发环境
docker run -d \
  --name terminal-backend \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  terminal-backend:dev

# 生产环境（建议修改JWT_SECRET）
docker run -d \
  --name terminal-backend \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  -e JWT_SECRET=your-secure-jwt-secret \
  --restart unless-stopped \
  --memory="2g" \
  --cpus="2" \
  terminal-backend:prod
```

### 直接使用 Docker 运行

由于配置已硬编码，无需docker-compose，直接运行即可：

```bash
# 构建并运行
docker build -t terminal-backend .
docker run -d \
  --name terminal-backend \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  --restart unless-stopped \
  terminal-backend

# 查看日志
docker logs -f terminal-backend

# 停止容器
docker stop terminal-backend

# 删除容器
docker rm terminal-backend
```

## 安全特性

1. **非root用户运行**
   - 容器内使用 `nodeuser` (UID: 1000, GID: 1000) 运行应用
   - 减少潜在的安全风险

2. **最小权限原则**
   - 只暴露必要的端口 (3000)
   - 限制文件系统写入权限到指定目录

3. **资源限制**
   - CPU: 最大2核，预留0.5核
   - 内存: 最大2GB，预留512MB

4. **健康检查**
   - 每30秒检查一次应用健康状态
   - 自动重启不健康的容器

## Claude Code CLI 使用

容器中已安装 Claude Code CLI，可以通过以下方式使用：

```bash
# 进入容器
docker exec -it terminal-backend /bin/bash

# 使用 Claude Code
claude-code --help
```

## 数据持久化

- `/app/data`: 用户数据和卡片文件
- `/app/logs`: 应用日志文件

确保宿主机上的挂载目录有正确的权限：

```bash
# 创建数据目录
mkdir -p data logs

# 设置权限（UID 1000）
chown -R 1000:1000 data logs
```

## 故障排查

### 1. 容器无法启动
```bash
# 查看容器日志
docker logs terminal-backend

# 检查容器状态
docker ps -a
```

### 2. 权限问题
```bash
# 确保数据目录权限正确
ls -la data/ logs/

# 修复权限
sudo chown -R 1000:1000 data logs
```

### 3. 健康检查失败
```bash
# 手动测试健康检查端点
curl http://localhost:3000/api/terminal/health
```

## 监控

### 查看容器资源使用
```bash
docker stats terminal-backend
```

### 查看容器进程
```bash
docker top terminal-backend
```

## 更新部署

1. 拉取最新代码
2. 重新构建镜像
3. 停止旧容器
4. 启动新容器

```bash
# 更新脚本示例
git pull
docker build -f Dockerfile.production -t terminal-backend:prod .
docker stop terminal-backend
docker rm terminal-backend
docker run -d --name terminal-backend ... terminal-backend:prod
```

## 备份与恢复

### 备份数据
```bash
# 创建备份
tar -czf backup-$(date +%Y%m%d).tar.gz data/

# 或使用 Docker 卷备份
docker run --rm -v $(pwd)/data:/source -v $(pwd)/backup:/backup alpine tar -czf /backup/data-$(date +%Y%m%d).tar.gz -C /source .
```

### 恢复数据
```bash
# 恢复备份
tar -xzf backup-20250107.tar.gz
```