# 简化部署指南

无需nginx和shell脚本的部署方式

## 部署步骤

### 1. 构建前端
```bash
cd terminal-ui
npm install
npm run build
cd ..
```

### 2. 安装后端依赖
```bash
cd terminal-backend
npm install --production
```

### 3. 直接启动（开发测试）
```bash
# 在terminal-backend目录下
NODE_ENV=production PORT=80 SERVE_STATIC=true node src/index.js
```

### 4. 使用PM2管理（生产环境）

#### 安装PM2
```bash
npm install -g pm2
```

#### 方式一：后端托管前端（推荐）
```bash
# 在terminal-backend目录下
pm2 start ecosystem.config.cjs
```

#### 方式二：前后端分离部署
```bash
# 启动后端（端口3000或6000）
cd terminal-backend
pm2 start ecosystem.config.cjs --name terminal-backend

# 启动前端（端口80）
cd ../terminal-ui
npm run build  # 先构建
pm2 start ecosystem.config.cjs --name terminal-ui
```

#### PM2常用命令
```bash
pm2 status              # 查看状态
pm2 logs terminal-backend  # 查看日志
pm2 restart terminal-backend  # 重启
pm2 stop terminal-backend     # 停止
pm2 delete terminal-backend   # 删除进程
```

#### 设置开机自启
```bash
pm2 save
pm2 startup
# 按提示执行命令
```

## 配置说明

`terminal-backend/ecosystem.config.cjs` 配置文件：
- `PORT: 80` - 监听端口
- `SERVE_STATIC: 'true'` - 启用静态文件服务
- `STATIC_PATH: '../terminal-ui/dist'` - 前端文件路径

## 访问方式

部署完成后：
- 主页：`http://你的服务器IP/`
- API：`http://你的服务器IP/api/`
- WebSocket：`ws://你的服务器IP/socket.io`

## 注意事项

1. 确保服务器防火墙开放80端口
2. 如需使用其他端口，修改`ecosystem.config.cjs`中的PORT
3. 前端修改后需要重新构建：`npm run build`
4. 所有请求由同一个Node.js进程处理，简单高效