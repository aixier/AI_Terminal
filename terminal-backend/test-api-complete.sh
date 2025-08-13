#!/bin/bash

echo "=== 文件夹模板功能测试 ==="
echo ""

# 1. 测试模板列表API
echo "1. 测试模板列表API"
echo "GET http://localhost:8083/api/generate/templates"
curl -s http://localhost:8083/api/generate/templates | python3 -m json.tool
echo ""

# 2. 测试单文件模板（仅验证API响应）
echo "2. 测试单文件模板API响应"
echo "POST http://localhost:8083/api/generate/card"
echo "Body: {\"topic\": \"测试主题\", \"templateName\": \"daily-knowledge-card-template.md\"}"
curl -X POST http://localhost:8083/api/generate/card \
  -H "Content-Type: application/json" \
  -d '{"topic": "测试主题", "templateName": "daily-knowledge-card-template.md"}' \
  -s --max-time 5 | head -n 20
echo ""
echo "注：实际生成需要Claude环境，此处仅测试API响应"
echo ""

# 3. 测试文件夹模板（仅验证API响应）
echo "3. 测试文件夹模板API响应"
echo "POST http://localhost:8083/api/generate/card"
echo "Body: {\"topic\": \"心理韧性\", \"templateName\": \"cardplanet-Sandra\"}"
curl -X POST http://localhost:8083/api/generate/card \
  -H "Content-Type: application/json" \
  -d '{"topic": "心理韧性", "templateName": "cardplanet-Sandra"}' \
  -s --max-time 5 | head -n 20
echo ""
echo "注：实际生成需要Claude环境，此处仅测试API响应"
echo ""

# 4. 查看容器日志验证提示词
echo "4. 查看容器日志（最后20行）"
docker logs terminal-backend-test --tail 20
echo ""

echo "=== 测试完成 ==="
echo ""
echo "停止并删除容器："
echo "docker stop terminal-backend-test && docker rm terminal-backend-test"