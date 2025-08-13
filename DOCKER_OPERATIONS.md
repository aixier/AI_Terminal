# Docker 操作指南

## 构建镜像

```bash
# 基础构建命令
docker build -t ai-terminal:v3.20 .

# 查看构建进度（显示最后几行）
docker build -t ai-terminal:v3.20 . 2>&1 | tail -5
```

## 运行容器

```bash
# 标准运行命令
docker run -d \
  -p 8083:6000 \
  -v /mnt/d/work/AI_Terminal/terminal-backend/data:/app/data \
  ai-terminal:v3.20

# 简化版（单行）
docker run -d -p 8083:6000 -v /mnt/d/work/AI_Terminal/terminal-backend/data:/app/data ai-terminal:v3.20
```

### 运行参数说明
- `-d`: 后台运行（detached mode）
- `-p 8083:6000`: 端口映射（主机8083端口 -> 容器6000端口）
- `-v /mnt/d/work/AI_Terminal/terminal-backend/data:/app/data`: 数据卷挂载（持久化数据）
- `ai-terminal:v3.20`: 镜像名称和标签

## 容器管理

### 查看容器
```bash
# 查看运行中的容器
docker ps

# 查看8083端口的容器
docker ps -f "publish=8083"

# 获取容器ID
docker ps -q -f "publish=8083"
```

### 停止容器
```bash
# 停止指定容器
docker stop <container_id>

# 停止8083端口的容器
docker stop $(docker ps -q -f "publish=8083")
```

### 删除容器
```bash
# 删除指定容器
docker rm <container_id>

# 删除所有8083端口的容器（包括已停止的）
docker rm $(docker ps -aq -f "publish=8083")
```

### 查看日志
```bash
# 查看容器日志
docker logs <container_id>

# 实时查看日志
docker logs -f <container_id>

# 查看最后100行日志
docker logs --tail 100 <container_id>

# 查看8083端口容器的日志
docker logs $(docker ps -q -f "publish=8083")
```

### 执行命令
```bash
# 在容器内执行命令
docker exec <container_id> <command>

# 进入容器shell
docker exec -it <container_id> sh

# 查看容器内文件
docker exec $(docker ps -q -f "publish=8083") ls -la /app/data
```

## 完整重启流程

```bash
# 一键重启（停止、删除、构建、运行）
docker stop $(docker ps -q -f "publish=8083") && \
docker rm $(docker ps -aq -f "publish=8083") && \
docker build -t ai-terminal:v3.20 . && \
docker run -d -p 8083:6000 -v /mnt/d/work/AI_Terminal/terminal-backend/data:/app/data ai-terminal:v3.20
```

## Docker镜像配置说明

### 基础配置
- **基础镜像**: node:22-alpine（轻量级Linux）
- **工作目录**: /app/terminal-backend
- **运行用户**: node（非root用户）
- **进程管理**: tini（作为init进程）

### 环境变量
- `NODE_ENV=production`: 生产环境
- `PORT=6000`: 服务端口
- `DATA_PATH=/app/data`: 数据目录
- `LOG_PATH=/app/logs`: 日志目录
- `STATIC_PATH=/app/static`: 静态文件目录
- `JWT_SECRET`: JWT密钥
- `MAX_TERMINAL_SESSIONS=10`: 最大终端会话数
- `TERMINAL_TIMEOUT=600000`: 终端超时时间（10分钟）

### 健康检查
- **检查间隔**: 30秒
- **超时时间**: 3秒
- **启动等待**: 5秒
- **重试次数**: 3次
- **检查端点**: http://localhost:6000/api/terminal/health

### 目录结构
```
/app/
├── terminal-backend/     # 后端代码
│   ├── node_modules/    # 依赖包
│   ├── src/            # 源代码
│   └── package.json    # 包配置
├── static/             # 前端静态文件
├── data/              # 数据目录（挂载卷）
│   ├── public_template/  # 公共模板
│   ├── users/           # 用户数据
│   └── history/         # 历史记录
└── logs/              # 日志目录
```

## 常见问题

### 1. 端口被占用
```bash
# 查看端口占用
lsof -i :8083

# 或使用其他端口
docker run -d -p 8084:6000 ...
```

### 2. 容器启动失败
```bash
# 查看容器状态
docker ps -a

# 查看错误日志
docker logs <container_id>
```

### 3. 清理Docker资源
```bash
# 清理停止的容器
docker container prune

# 清理未使用的镜像
docker image prune

# 清理所有未使用资源
docker system prune
```

## 版本管理

### 命名规范
- 格式: `ai-terminal:v3.XX`
- 示例: `ai-terminal:v3.20`

### 查看镜像
```bash
# 列出所有ai-terminal镜像
docker images | grep ai-terminal

# 删除旧版本镜像
docker rmi ai-terminal:v3.19
```

## 生产部署建议

1. **使用具体版本标签**，避免使用latest
2. **设置资源限制**：
   ```bash
   docker run -d \
     --memory="1g" \
     --cpus="1.0" \
     -p 8083:6000 \
     -v /mnt/d/work/AI_Terminal/terminal-backend/data:/app/data \
     ai-terminal:v3.20
   ```

3. **使用Docker Compose**进行管理（如需要）
4. **定期备份data目录**
5. **监控容器健康状态**

## 快速命令参考

```bash
# 构建
docker build -t ai-terminal:v3.20 .

# 运行
docker run -d -p 8083:6000 -v /mnt/d/work/AI_Terminal/terminal-backend/data:/app/data ai-terminal:v3.20

# 查看日志
docker logs $(docker ps -q -f "publish=8083")

# 重启
docker restart $(docker ps -q -f "publish=8083")

# 停止并删除
docker stop $(docker ps -q -f "publish=8083") && docker rm $(docker ps -aq -f "publish=8083")
```