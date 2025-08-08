# AI卡片系统

一个智能的AI卡片生成和管理系统，通过友好的Web界面让用户创建、编辑和管理知识卡片，集成终端功能进行高级操作。

## 功能特性

- 🖥️ **友好的Web界面** - 直观的图形界面，降低终端使用门槛
- 💬 **自然语言交互** - 支持用自然语言描述操作，自动转换为终端命令
- 🔘 **命令快捷按钮** - 预设常用命令，一键执行
- 📊 **执行过程可视化** - 实时显示命令执行进度和日志
- 🔒 **安全控制** - 命令白名单、参数验证、防注入攻击
- 👥 **多用户支持** - 用户认证、会话隔离、权限管理
- 🤖 **Claude Code集成** - 智能命令建议和错误处理

## 技术栈

### 前端
- Vue 3 + Vite
- Element Plus UI
- Pinia 状态管理
- Socket.io Client

### 后端
- Node.js + Express
- Socket.io
- node-pty (终端模拟)
- JWT 认证

## 快速开始

### 1. 克隆项目
```bash
git clone <repository-url>
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