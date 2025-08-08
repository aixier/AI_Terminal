# 快速启动指南

## 🚀 一键启动

### Windows
```bash
双击 start.bat
```

### Linux/Mac
```bash
./start.sh
```

## 📝 手动启动

如果自动脚本不工作，请按以下步骤手动启动：

### 1. 启动后端服务（必须先启动）
```bash
cd terminal-backend
npm install  # 首次运行
npm start
```

后端将运行在: http://localhost:3000

### 2. 启动前端（新开一个终端）
```bash
cd terminal-ui
npm install  # 首次运行
npm run dev
```

前端将运行在: http://localhost:5173

## ⚠️ 常见问题

### 1. Terminal连接超时
**错误信息**: `[TerminalService] Connection timeout`

**解决方法**:
- 确保后端服务正在运行（端口3000）
- 检查防火墙设置
- 确认没有其他程序占用3000端口

### 2. Claude初始化失败
**错误信息**: `终端服务未连接`

**解决方法**:
- 后端必须先启动
- 等待后端完全启动后再刷新前端页面
- 检查控制台是否有错误信息

### 3. 端口被占用
```bash
# Windows - 查看端口占用
netstat -ano | findstr :3000

# Linux/Mac
lsof -i :3000
```

## 🎯 功能说明

### Terminal功能
- **默认隐藏**: 点击terminal标题栏展开/折叠
- **自动初始化**: Claude会在启动2秒后自动初始化
- **状态显示**: 标题栏显示连接状态

### 连接状态指示
- ⚪ 未连接 - 后端服务未运行
- 🔄 连接中 - 正在连接后端
- ✅ 已连接 - 成功连接，可以使用

## 🔧 环境要求

- Node.js 18+ (推荐 Node.js 22)
- npm 或 yarn
- Windows/Linux/Mac OS

## 📦 Docker部署（可选）

如果想使用Docker部署后端：

```bash
cd terminal-backend
docker build -t terminal-backend .
docker run -d -p 3000:3000 terminal-backend
```

## 💡 提示

1. **首次运行**: 需要在两个目录都运行 `npm install`
2. **启动顺序**: 必须先启动后端，再启动前端
3. **自动重连**: 如果连接断开，刷新页面即可重连
4. **日志查看**: 在各自的终端窗口查看详细日志

## 📞 支持

遇到问题？
1. 查看控制台错误信息
2. 确认所有依赖已安装
3. 重启所有服务