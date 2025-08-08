# Docker MVP部署指南（极简版）

## 快速开始

### 1. 构建镜像
```bash
docker build -t terminal-backend .
```

### 2. 运行容器
```bash
docker run -d -p 3000:3000 terminal-backend
```

就这么简单！应用现在运行在 http://localhost:3000

## MVP特性说明

### 零配置运行
- 所有配置已硬编码在Dockerfile中
- 无需环境变量
- 无需数据卷挂载
- 无需docker-compose

### 内置配置
- **JWT认证**：使用固定密钥 `mvp-jwt-secret-2025`
- **默认用户**：`admin` / `admin123`
- **数据存储**：容器内部 `/app/data`
- **日志存储**：容器内部 `/app/logs`
- **Claude CLI**：已预装，可在终端中使用

### 支持的前端端口
自动允许以下端口的CORS请求：
- http://localhost:5173 (Vite默认)
- http://localhost:5174
- http://localhost:3000
- http://localhost:8080

## 常用命令

```bash
# 查看容器状态
docker ps

# 查看日志
docker logs terminal-backend

# 进入容器
docker exec -it terminal-backend sh

# 停止容器
docker stop terminal-backend

# 删除容器
docker rm terminal-backend

# 重启容器
docker restart terminal-backend
```

## 数据说明

### 注意事项
- 数据存储在容器内部
- 删除容器会丢失所有数据
- MVP阶段不建议存储重要数据

### 数据备份（可选）
如果需要保存数据，可以从容器中复制出来：
```bash
# 备份数据
docker cp terminal-backend:/app/data ./backup-data
docker cp terminal-backend:/app/logs ./backup-logs

# 恢复数据到新容器
docker cp ./backup-data terminal-backend:/app/data
docker cp ./backup-logs terminal-backend:/app/logs
```

## 进阶使用

### 指定容器名称
```bash
docker run -d -p 3000:3000 --name my-terminal terminal-backend
```

### 使用不同端口
```bash
docker run -d -p 8080:3000 terminal-backend
# 应用将在 http://localhost:8080 运行
```

### 后台运行并自动重启
```bash
docker run -d -p 3000:3000 --restart unless-stopped terminal-backend
```

### 查看资源使用
```bash
docker stats terminal-backend
```

## 限制说明

### MVP阶段限制
1. **数据持久性**：数据存储在容器内，容器删除数据丢失
2. **安全性**：使用固定JWT密钥，仅适合开发测试
3. **用户管理**：只有一个硬编码的admin用户
4. **扩展性**：单容器运行，不支持集群

### 不适用场景
- 生产环境
- 需要数据持久化
- 多用户系统
- 高安全要求

## 故障排查

### 容器无法启动
```bash
# 查看错误日志
docker logs terminal-backend

# 检查端口占用
netstat -tulpn | grep 3000
```

### 无法访问应用
1. 检查容器是否运行：`docker ps`
2. 检查端口映射：`docker port terminal-backend`
3. 检查防火墙设置

### 登录问题
- 用户名：`admin`
- 密码：`admin123`
- 确保前端使用正确的API地址

## 下一步

当需要更完整的功能时：
1. 查看 `DOCKER_DEPLOYMENT.md` 了解生产部署
2. 配置外部数据卷实现数据持久化
3. 修改JWT_SECRET提高安全性
4. 添加用户管理功能