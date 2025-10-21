# Terminal 用户隔离实现

## 概述
实现了基于用户认证的终端隔离机制，确保每个用户只能在自己的私有目录 `/app/data/users/[username]` 下操作。

## 实现细节

### 1. 认证机制
- **JWT Token 验证**: WebSocket 连接时从请求头或 URL 参数获取 token
- **用户提取**: 验证 token 并提取用户信息（id, username, role）
- **未授权拒绝**: 无效或缺失 token 的连接被立即拒绝（WebSocket 1008）

### 2. 用户目录隔离

#### 目录结构
```
/app/data/users/
├── user1/
│   ├── file1.txt
│   └── folder/
├── user2/
│   ├── file2.txt
│   └── ...
└── ...
```

#### 工作目录设置规则
```javascript
// 优先级：
1. 用户指定的 cwd（如果在用户目录内）
2. 用户私有目录 /app/data/users/[username]
3. 如果客户端尝试访问用户目录外 → 强制转向用户目录
```

### 3. 访问控制
- **路径验证**: 所有请求的 cwd 都验证是否在用户目录内
- **权限提升防止**: 无法通过 `cd ..` 或绝对路径逃逸用户目录
- **目录自动创建**: 首次连接时自动创建用户私有目录

## 代码修改

### websocketService.js 变更

**1. 导入必要模块**
```javascript
import jwt from 'jsonwebtoken'
import config from '../config/config.js'
import { promises as fs } from 'fs'
import path from 'path'
```

**2. 用户提取方法**
```javascript
extractUserFromRequest(req) {
  // 从 URL 参数或 Authorization 头获取 token
  // 验证 JWT token
  // 返回 { id, username, role }
}
```

**3. 连接时认证**
```javascript
handleConnection(ws, req) {
  const user = this.extractUserFromRequest(req)
  if (!user) {
    ws.close(1008, 'Unauthorized')
    return
  }
  // 连接信息中保存用户数据
  this.connections.set(ws, { user, ... })
}
```

**4. 初始化时用户隔离**
```javascript
handleLocalInit(ws, clientId, options, user) {
  // 设置用户目录
  const userDir = path.join('/app/data/users', user.username)
  
  // 验证客户端指定的 cwd 是否在用户目录内
  if (cwd && !cwd.startsWith(userDir)) {
    console.warn(`⚠️ Attempt to access outside user directory`)
    cwd = userDir // 强制使用用户目录
  }
  
  // 创建或确保用户目录存在
  await this.ensureUserDirectory(userDir)
}
```

## 前端集成

### 在 xterm-engine.js 中传递 token
```javascript
// 在 connectWebSocket() 中
const token = localStorage.getItem('token')
const wsUrl = isDev
  ? `ws://${window.location.hostname}:6009/ws/terminal?token=${token}`
  : `ws://${window.location.hostname}:${window.location.port}/ws/terminal?token=${token}`
```

## 安全特性

✅ **用户隔离**
- 每个用户的终端运行在独立的 PTY 中
- 不同用户的文件系统完全隔离

✅ **访问控制**
- 路径验证防止目录遍历
- 相对路径和绝对路径都会被验证
- 尝试逃逸会被强制重定向

✅ **认证要求**
- WebSocket 连接强制要求有效的 JWT token
- Token 包含用户身份信息
- 无效的连接被立即拒绝

✅ **审计日志**
- 所有连接尝试都有日志记录
- 未授权尝试记录完整信息
- 路径逃逸尝试有警告日志

## 使用示例

### 服务器启动
```bash
# /app/data/users 目录会被自动创建
docker run -v /app/data/users:/app/data/users ...
```

### 首次连接
```
1. 用户登录获得 JWT token
2. 前端使用 token 连接 WebSocket
3. 后端验证 token → 提取用户信息
4. 创建 /app/data/users/alice 目录（如果不存在）
5. 启动终端，工作目录为 /app/data/users/alice
```

### 文件操作
```bash
# 用户 alice 可以操作
cd /app/data/users/alice
touch myfile.txt
mkdir myfolder

# 用户 alice 尝试以下操作会被阻止
cd /app/data/users/bob  # ❌ 跳转失败，停留在 /app/data/users/alice
cd /                     # ❌ 跳转失败，停留在 /app/data/users/alice
ls /etc                  # ❌ 无法访问
```

## Docker 配置

推荐的 Dockerfile 配置：
```dockerfile
# 创建数据目录
RUN mkdir -p /app/data/users && chmod 755 /app/data/users

# 设置环境变量（可选）
ENV APP_DATA_DIR=/app/data/users
```

## 故障排查

### 连接被拒绝
- 检查 token 是否有效
- 检查 token 是否在 URL 参数或 Authorization 头中
- 检查 JWT secret 是否正确配置

### 无法创建用户目录
- 检查 `/app/data/users` 父目录权限
- 检查容器内的写权限
- 查看错误日志中的详细信息

### 路径访问被阻止
- 确认用户目录路径格式正确
- 检查是否使用了相对路径 `..`
- 查看服务器警告日志中的尝试信息

## 未来改进

- [ ] 支持更细粒度的权限控制（只读/读写）
- [ ] 添加目录配额限制
- [ ] 实现用户之间的文件共享机制
- [ ] 添加活动审计和日志查询界面
- [ ] 支持 chroot 沙箱隔离（需要 Linux 权限）
