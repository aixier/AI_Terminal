#!/bin/bash

# 测试脚本 - 诊断 Empty reply from server 问题

echo "=========================================="
echo "诊断 Empty Reply from Server 问题"
echo "=========================================="

SERVER="http://card.paitongai.com"
ENDPOINT="/api/generate/card"

# 1. 测试基础连接
echo -e "\n1. 测试基础连接..."
curl -v --max-time 10 $SERVER/health 2>&1 | grep -E "(Connected|HTTP|curl)"

# 2. 测试 OPTIONS 请求（CORS预检）
echo -e "\n2. 测试 OPTIONS 请求..."
curl -X OPTIONS -v --max-time 10 $SERVER$ENDPOINT 2>&1 | grep -E "(Connected|HTTP|curl)"

# 3. 使用 telnet 测试原始 HTTP
echo -e "\n3. 测试原始 HTTP 连接..."
(echo -e "POST $ENDPOINT HTTP/1.1\r\nHost: card.paitongai.com\r\nContent-Type: application/json\r\nContent-Length: 62\r\nConnection: close\r\n\r\n{\"topic\":\"test\",\"templateName\":\"cardplanet-Sandra-json\"}" | nc card.paitongai.com 80 | head -20) 2>/dev/null

# 4. 测试短超时
echo -e "\n4. 测试 5 秒超时..."
curl -X POST $SERVER$ENDPOINT \
  -H "Content-Type: application/json" \
  -d '{"topic": "测试", "templateName": "cardplanet-Sandra-json"}' \
  --max-time 5 -v 2>&1 | tail -5

# 5. 测试保持连接
echo -e "\n5. 测试 Keep-Alive..."
curl -X POST $SERVER$ENDPOINT \
  -H "Content-Type: application/json" \
  -H "Connection: keep-alive" \
  -H "Keep-Alive: timeout=600" \
  -d '{"topic": "测试", "templateName": "cardplanet-Sandra-json"}' \
  --keepalive-time 60 \
  --max-time 30 -v 2>&1 | grep -E "(Connected|Empty|curl|HTTP)"

# 6. 测试异步接口
echo -e "\n6. 测试异步接口..."
curl -X POST $SERVER/api/generate/card/async \
  -H "Content-Type: application/json" \
  -d '{"topic": "测试", "templateName": "cardplanet-Sandra-json"}' \
  --max-time 10 -v 2>&1 | grep -E "(HTTP|curl|{)"

echo -e "\n=========================================="
echo "诊断完成"
echo "=========================================="