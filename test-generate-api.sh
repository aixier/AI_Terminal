#!/bin/bash

echo "Testing Generate Card API"
echo "========================="

# 测试生成卡片
echo "1. 发送生成请求..."
curl -X POST http://localhost:8080/api/generate/card \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "测试API生成的卡片",
    "templateName": "daily-knowledge-card-template.md"
  }' \
  --max-time 200

echo ""
echo ""
echo "2. 检查生成状态..."
sleep 5
curl http://localhost:8080/api/generate/status/测试API生成的卡片

echo ""
echo "完成!"