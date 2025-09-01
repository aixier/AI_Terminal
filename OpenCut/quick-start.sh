#!/bin/bash

# OpenCut 快速启动脚本
# 解决依赖安装问题的临时方案

echo "🚀 OpenCut 快速启动脚本"
echo "================================"

# 进入web目录
cd apps/web

# 检查是否已安装依赖
if [ ! -d "node_modules" ]; then
    echo "📦 首次运行，正在安装依赖..."
    echo "这可能需要几分钟，请耐心等待..."
    
    # 尝试使用yarn安装
    if command -v yarn &> /dev/null; then
        echo "使用 Yarn 安装..."
        yarn install --network-timeout 100000
    # 否则使用npm
    elif command -v npm &> /dev/null; then
        echo "使用 NPM 安装..."
        npm install --force
    else
        echo "❌ 未找到包管理器，请先安装 Node.js"
        exit 1
    fi
fi

# 检查端口是否被占用
PORT=3000
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  端口 $PORT 已被占用，尝试使用端口 3001"
    PORT=3001
fi

echo ""
echo "✅ 准备启动 OpenCut..."
echo "================================"
echo "📌 访问地址: http://localhost:$PORT"
echo "📌 按 Ctrl+C 停止服务器"
echo "================================"
echo ""

# 设置环境变量并启动
export PORT=$PORT
export NEXT_TELEMETRY_DISABLED=1

# 尝试不同的启动方式
if [ -f "node_modules/.bin/next" ]; then
    # 使用本地安装的next
    ./node_modules/.bin/next dev -p $PORT
elif command -v npx &> /dev/null; then
    # 使用npx
    npx next dev -p $PORT
else
    # 使用npm脚本
    npm run dev -- -p $PORT
fi