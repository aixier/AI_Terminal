# Docker 操作指南

## 镜像版本说明

AI Terminal 提供两种类型的Docker镜像：

### 1. 公开镜像（推荐用于开发和公开部署）
- **标签**: `coopotfan/ai-terminal:latest`, `coopotfan/ai-terminal:v3.9.8`
- **特点**: 不包含敏感配置，需要通过环境变量提供API密钥
- **安全性**: ✅ 安全，适合公开分发
- **用途**: 开发环境、公开部署、Docker Hub分发

### 2. 生产镜像（仅用于内部部署）
- **标签**: `coopotfan/ai-terminal:production`, `coopotfan/ai-terminal:v3.9.8-production`
- **特点**: 内置API配置，即开即用
- **安全性**: ⚠️ 包含敏感信息，仅限内部使用
- **用途**: 生产环境、内部部署

## 构建镜像

### 构建公开镜像
```bash
# 使用标准Dockerfile（隐藏敏感信息）
docker build -t coopotfan/ai-terminal:v3.9.8 -t coopotfan/ai-terminal:latest .
```

### 构建生产镜像
```bash
# 使用DockerfileProduct（包含生产配置）
docker build -f DockerfileProduct -t coopotfan/ai-terminal:v3.9.8-production -t coopotfan/ai-terminal:production .
```

## 运行容器

### 公开镜像部署（需要环境变量）
```bash
# 完整配置运行
docker run -d \
  -p 6000:6000 \
  -e ANTHROPIC_AUTH_TOKEN="your_claude_token" \
  -e ANTHROPIC_BASE_URL="your_claude_api_url" \
  -e GEMINI_API_KEY="your_gemini_key" \
  -v /path/to/data:/app/data \
  coopotfan/ai-terminal:latest

# 简化版（单行）
docker run -d -p 6000:6000 -e ANTHROPIC_AUTH_TOKEN="your_token" -e ANTHROPIC_BASE_URL="your_url" coopotfan/ai-terminal:latest
```

### 生产镜像部署（即开即用）
```bash
# 直接运行，无需额外配置
docker run -d -p 6000:6000 coopotfan/ai-terminal:production

# 带数据持久化
docker run -d \
  -p 6000:6000 \
  -v /path/to/data:/app/data \
  coopotfan/ai-terminal:v3.9.8-production
```

### 运行参数说明
- `-d`: 后台运行（detached mode）
- `-p 6000:6000`: 端口映射（主机6000端口 -> 容器6000端口）
- `-v /path/to/data:/app/data`: 数据卷挂载（持久化用户数据和卡片）
- `-e KEY=VALUE`: 环境变量设置（仅公开镜像需要）

## 容器管理

### 查看容器
```bash
# 查看运行中的容器
docker ps

# 查看6000端口的容器
docker ps -f "publish=6000"

# 获取容器ID
docker ps -q -f "publish=6000"
```

### 停止容器
```bash
# 停止指定容器
docker stop <container_id>

# 停止所有AI Terminal容器
docker stop $(docker ps -q -f "ancestor=coopotfan/ai-terminal")
```

### 查看日志
```bash
# 查看容器日志
docker logs <container_id>

# 实时跟踪日志
docker logs -f <container_id>

# 查看最近50行日志
docker logs --tail 50 <container_id>
```

### 进入容器
```bash
# 进入容器shell
docker exec -it <container_id> /bin/bash

# 查看容器文件系统
docker exec <container_id> ls -la /app
```

## 镜像管理

### 查看镜像
```bash
# 查看所有AI Terminal镜像
docker images | grep ai-terminal

# 查看镜像详细信息
docker inspect coopotfan/ai-terminal:latest
```

### 清理镜像
```bash
# 删除指定镜像
docker rmi coopotfan/ai-terminal:v3.9.8

# 清理未使用的镜像
docker image prune

# 强制清理所有未使用的镜像
docker image prune -a
```

## 网络配置

### 端口说明
- **6000**: 主服务端口（Web界面 + API）
- **WebSocket**: ws://localhost:6000/socket.io
- **健康检查**: http://localhost:6000/health

### 防火墙配置
```bash
# Ubuntu/Debian
sudo ufw allow 6000

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=6000/tcp
sudo firewall-cmd --reload
```

## 数据持久化

### 数据目录结构
```
/app/data/
├── users/                 # 用户数据
├── public_template/      # 公共模板
├── history/              # 历史记录
└── logs/                 # 应用日志
```

### 备份数据
```bash
# 创建数据备份
docker cp <container_id>:/app/data ./backup-$(date +%Y%m%d)

# 恢复数据
docker cp ./backup-20250815/ <container_id>:/app/data
```

## 故障排查

### 常见问题

1. **容器启动失败**
   ```bash
   # 检查日志
   docker logs <container_id>
   
   # 检查端口占用
   netstat -tlnp | grep 6000
   ```

2. **API连接失败**
   ```bash
   # 检查环境变量（公开镜像）
   docker exec <container_id> env | grep ANTHROPIC
   
   # 测试API连接
   docker exec <container_id> curl -s http://localhost:6000/health
   ```

3. **性能问题**
   ```bash
   # 查看资源使用
   docker stats <container_id>
   
   # 检查容器配置
   docker inspect <container_id> | grep -A 10 "Memory\|Cpu"
   ```

## 安全注意事项

### 公开镜像安全性
- ✅ 不包含API密钥，安全分发
- ✅ 环境变量方式注入配置
- ✅ 支持secrets管理系统

### 生产镜像安全性
- ⚠️ 包含敏感配置，仅限内部网络
- ⚠️ 不要推送到公共仓库
- ⚠️ 定期轮换内置密钥

### 最佳实践
1. 生产环境使用生产镜像
2. 开发环境使用公开镜像
3. 定期更新镜像版本
4. 监控容器安全性