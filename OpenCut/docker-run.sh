#!/bin/bash

echo "🐳 OpenCut Docker 启动"
echo "================================"

# 使用预构建的镜像（如果存在）
docker run -d \
  --name opencut-demo \
  -p 3000:3000 \
  -v $(pwd):/app \
  node:18-alpine \
  sh -c "cd /app && npm install -g bun && bun install && bun run dev"

echo "✅ 容器启动中..."
echo "📌 等待30秒后访问: http://localhost:3000"
echo "📌 查看日志: docker logs -f opencut-demo"
echo "📌 停止容器: docker stop opencut-demo && docker rm opencut-demo"