# AI卡片系统

> 一个现代化的AI驱动的知识卡片生成和管理平台

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18-green)](https://nodejs.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

AI卡片系统是一个智能的知识管理平台，结合AI技术和直观的Web界面，帮助用户高效地创建、编辑和管理知识卡片。系统集成了强大的终端功能，为高级用户提供更多操作选项。

## ✨ 功能特性

- 🎨 **智能卡片生成** - 基于AI技术自动生成结构化知识卡片
- 📝 **多样化模板** - 提供丰富的卡片模板，适用于不同场景
- 🔄 **实时预览** - 即时预览卡片效果，所见即所得
- 💾 **多格式导出** - 支持JSON、PDF、图片等多种格式导出
- 🖥️ **现代化界面** - 基于Vue 3 + Element Plus的直观用户界面
- 🔒 **安全认证** - JWT认证机制，确保数据安全
- 🌐 **Docker部署** - 支持容器化部署，简化运维
- 🤖 **Claude集成** - 集成Claude AI服务，提供智能内容生成

## 技术栈

### 前端
- Vue 3 + Vite
- Element Plus UI
- Pinia 状态管理
- Socket.io Client

### 后端
- Node.js + Express
- Socket.io (实时通信)
- JWT 认证
- Claude AI API 集成

## 快速开始

### 1. 克隆项目
```bash
git clone https://github.com/aixier/AI_Terminal.git
cd AI_Terminal
```

### 2. 安装依赖

后端：
```bash
cd terminal-backend
npm install
```

前端：
```bash
cd terminal-ui
npm install
```

### 3. 配置环境变量

后端配置 `terminal-backend/.env`：
```env
PORT=3000
NODE_ENV=development
JWT_SECRET=your-secret-key-here-change-in-production
```

### 4. 启动服务

启动后端：
```bash
cd terminal-backend
npm run dev
```

启动前端：
```bash
cd terminal-ui
npm run dev
```

### 5. 访问系统

打开浏览器访问：`http://localhost:5173`

默认账号：`admin / admin123`

## 🚀 生产环境部署

### 环境要求

- **Node.js**: 18+ 
- **系统**: Ubuntu 20.04+ / CentOS 7+
- **内存**: 至少 2GB RAM
- **端口**: 80 (前端)、3000 (后端API)

### 1. 安装系统依赖

```bash
# 安装 Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 验证版本
node --version  # 应该 >= 18.0.0
npm --version

# 安装 PM2 进程管理器
npm install -g pm2

# 安装 Claude Code (可选)
npm install -g @anthropic-ai/claude-code
```

### 2. 克隆并部署

```bash
# 克隆项目
git clone https://github.com/aixier/AI_Terminal.git
cd AI_Terminal

# 设置权限
chmod +x terminal-backend/deploy.sh
chmod +x terminal-ui/deploy.sh
```

### 3. 部署后端 (端口 3000)

```bash
cd ~/AI_Terminal/terminal-backend

# 方式1: 一键部署脚本 (推荐)
npm run deploy

# 方式2: 手动部署
npm ci                           # 安装依赖
pm2 start ecosystem.config.cjs   # 启动服务
```

### 4. 部署前端 (端口 80)

```bash
cd ~/AI_Terminal/terminal-ui

# 方式1: 一键部署脚本 (推荐)  
npm run deploy

# 方式2: 手动部署
npm ci                           # 安装依赖
npm run build                    # 构建项目
pm2 start ecosystem.config.cjs   # 启动服务
```

### 5. 验证部署

```bash
# 查看服务状态
pm2 status

# 查看日志
pm2 logs

# 测试访问
curl http://localhost:3000/health  # 后端健康检查
curl http://localhost/             # 前端页面
```

## 🔧 PM2 进程管理

### 启动服务

```bash
# 启动所有服务
pm2 start all

# 启动单个服务
pm2 start terminal-backend
pm2 start terminal-ui
```

### 停止服务

```bash
# 停止所有服务
pm2 stop all

# 停止单个服务
pm2 stop terminal-backend
pm2 stop terminal-ui
```

### 重启服务

```bash
# 重启所有服务
pm2 restart all

# 重启单个服务
pm2 restart terminal-backend
pm2 restart terminal-ui
```

### 查看状态和日志

```bash
# 查看进程状态
pm2 status
pm2 list

# 查看日志
pm2 logs                    # 所有日志
pm2 logs terminal-backend   # 后端日志
pm2 logs terminal-ui        # 前端日志
pm2 logs --lines 50         # 最近50行日志

# 实时监控
pm2 monit
```

### 开机自启

```bash
# 保存当前PM2配置
pm2 save

# 设置开机自启
pm2 startup
```

### 删除服务

```bash
# 删除单个服务
pm2 delete terminal-backend
pm2 delete terminal-ui

# 删除所有服务
pm2 delete all
```

## 📦 NPM 脚本命令

### 后端 (`terminal-backend`)

```bash
npm start          # 直接启动
npm run dev        # 开发模式
npm run prod       # 生产模式
npm run deploy     # 一键部署

# PM2 管理
npm run pm2:start    # PM2启动
npm run pm2:stop     # PM2停止  
npm run pm2:restart  # PM2重启
npm run pm2:delete   # PM2删除
```

### 前端 (`terminal-ui`)

```bash
npm run dev        # 开发模式
npm run build      # 构建项目
npm run serve      # 启动服务器
npm run deploy     # 一键部署

# PM2 管理  
npm run pm2:start    # PM2启动
npm run pm2:stop     # PM2停止
npm run pm2:restart  # PM2重启
npm run pm2:delete   # PM2删除
```

## 🐛 常见问题

### 1. 端口被占用
```bash
# 查看端口占用
sudo lsof -i :80
sudo lsof -i :3000

# 杀死进程
sudo kill -9 <PID>
```

### 2. 权限问题
```bash
# 如果80端口需要root权限
sudo pm2 start ecosystem.config.cjs
```

### 3. 内存不足
```bash
# 检查内存使用
free -h
pm2 monit

# 重启服务释放内存
pm2 restart all
```

### 4. 依赖安装失败
```bash
# 清理缓存重新安装
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

## 🔄 更新部署

当有代码更新时，按以下步骤重新部署：

```bash
# 1. 拉取最新代码
cd ~/AI_Terminal
git pull

# 2. 停止现有服务
pm2 stop all

# 3. 更新后端
cd ~/AI_Terminal/terminal-backend
npm ci                          # 更新依赖
pm2 start ecosystem.config.cjs  # 重启服务

# 4. 更新前端  
cd ~/AI_Terminal/terminal-ui
npm ci                          # 更新依赖
npm run build                   # 重新构建
pm2 start ecosystem.config.cjs  # 重启服务

# 5. 验证部署
pm2 status
pm2 logs --lines 10
```

**或使用一键更新脚本：**
```bash
cd ~/AI_Terminal/terminal-backend && npm run deploy
cd ~/AI_Terminal/terminal-ui && npm run deploy
```

## 项目结构

```
AI_Terminal/
├── terminal-ui/          # 前端项目
│   ├── src/
│   │   ├── api/         # API配置
│   │   ├── components/  # Vue组件
│   │   ├── router/      # 路由配置
│   │   ├── store/       # 状态管理
│   │   ├── services/    # 服务层
│   │   └── views/       # 页面视图
│   └── package.json
│
├── terminal-backend/     # 后端项目
│   ├── src/
│   │   ├── config/      # 配置文件
│   │   ├── middleware/  # 中间件
│   │   ├── routes/      # API路由
│   │   ├── services/    # 业务逻辑
│   │   ├── utils/       # 工具函数
│   │   └── data/        # 数据文件
│   └── package.json
│
├── tasklist.md          # 任务清单
└── README.md           # 项目说明

```

## 核心功能说明

### 1. 终端执行
- 基于 node-pty 实现真实的终端环境
- 支持流式输出，实时显示执行结果
- 会话隔离，多用户同时使用

### 2. 自然语言处理
- 集成 Claude Code 服务
- 支持自然语言转命令
- 智能命令建议

### 3. 安全机制
- 命令白名单验证
- 参数注入防护
- 用户权限控制
- 操作审计日志

### 4. 界面组件
- 终端面板：命令输入和输出显示
- Chat面板：自然语言交互
- 命令面板：预设命令快捷操作
- 进度显示：执行状态可视化
- 结果展示：文件预览和导出

## 开发指南

### 添加新命令
1. 编辑 `terminal-backend/src/data/commands.json`
2. 添加命令配置，包括名称、描述、参数等
3. 重启后端服务

### 扩展Claude Code功能
1. 编辑 `terminal-backend/src/services/claudeCodeService.js`
2. 添加新的命令模式匹配
3. 实现智能推断逻辑

### 自定义UI主题
1. 修改 `terminal-ui/src/assets/styles/`
2. 调整 Element Plus 主题变量
3. 重新构建前端

## 安全注意事项

1. **生产环境部署前必须**：
   - 修改 JWT_SECRET
   - 配置 HTTPS
   - 限制 CORS 来源
   - 启用速率限制

2. **命令白名单**：
   - 仔细审查 commands.json
   - 避免添加危险命令
   - 定期审计命令使用

3. **用户权限**：
   - 实施最小权限原则
   - 定期审查用户权限
   - 监控异常操作

## 性能优化建议

1. **前端优化**：
   - 启用路由懒加载
   - 使用虚拟滚动显示大量日志
   - 压缩静态资源

2. **后端优化**：
   - 使用 Redis 缓存会话
   - 实施连接池管理
   - 异步处理耗时操作

3. **WebSocket优化**：
   - 启用消息压缩
   - 实施心跳检测
   - 合理设置超时时间

## 故障排查

### 终端无法连接
1. 检查后端服务是否正常运行
2. 确认 WebSocket 端口未被占用
3. 查看浏览器控制台错误信息

### 命令执行失败
1. 检查命令是否在白名单中
2. 验证用户权限是否足够
3. 查看后端日志文件

### 性能问题
1. 检查并发会话数量
2. 监控内存使用情况
3. 优化数据库查询

## 贡献指南

欢迎提交 Issue 和 Pull Request！

## 许可证

本项目基于 MIT License 开源，详见 [LICENSE](LICENSE) 文件。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)