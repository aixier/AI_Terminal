#!/bin/bash

# AI Terminal Backend 部署脚本
set -e

echo "🚀 开始部署 AI Terminal Backend..."

# 检查Node.js版本
if ! command -v node &> /dev/null; then
    echo "❌ Node.js未安装，请先安装Node.js 18+"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt "18" ]; then
    echo "❌ Node.js版本过低，需要18+，当前版本: $(node -v)"
    exit 1
fi

# 检查PM2
if ! command -v pm2 &> /dev/null; then
    echo "📦 安装PM2..."
    npm install -g pm2
fi

# 安装依赖
echo "📦 安装依赖包..."
npm ci --only=production

# 创建日志目录
mkdir -p logs

# 停止现有进程
echo "🔄 停止现有进程..."
pm2 delete terminal-backend 2>/dev/null || true

# 启动应用
echo "🚀 启动应用..."
pm2 start ecosystem.config.cjs

# 保存PM2配置
pm2 save

# 设置开机自启
pm2 startup

echo "✅ 部署完成！"
echo "📊 查看状态: pm2 status"
echo "📝 查看日志: pm2 logs terminal-backend"