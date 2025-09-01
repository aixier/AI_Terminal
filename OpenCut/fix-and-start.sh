#!/bin/bash

echo "🔧 OpenCut 依赖修复启动脚本"
echo "================================"

# 1. 清理所有缓存
echo "📦 清理缓存..."
rm -rf node_modules apps/*/node_modules packages/*/node_modules
rm -rf ~/.bun ~/.npm/_cacache

# 2. 修改package.json临时移除workspace
echo "🔧 临时修改配置..."
cd apps/web
cp package.json package.json.bak

# 移除workspace依赖
sed -i 's/"@opencut\/auth": "workspace:\*"/"@opencut\/auth": "*"/g' package.json
sed -i 's/"@opencut\/db": "workspace:\*"/"@opencut\/db": "*"/g' package.json

# 3. 安装依赖
echo "📦 安装依赖..."
npm install --force --legacy-peer-deps

# 4. 启动服务
echo "🚀 启动服务..."
npm run dev