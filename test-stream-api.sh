#!/bin/bash

echo "=== 测试流式API - 实时显示Claude回显 ==="
echo "URL: http://127.0.0.1:8082/api/generate/card/stream"
echo "主题: 瑜伽基础知识"
echo ""
echo "开始流式请求..."
echo "----------------------------------------"

curl -X POST http://127.0.0.1:8082/api/generate/card/stream \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "瑜伽基础知识",
    "templateName": "daily-knowledge-card-template.md"
  }' \
  --no-buffer \
  -v

echo ""
echo "----------------------------------------"
echo "流式请求结束"