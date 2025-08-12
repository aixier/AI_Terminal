#!/bin/bash

echo "测试流式API并捕获completed事件"
echo "================================"

# 发送请求并保存所有事件
curl -X POST http://127.0.0.1:8082/api/generate/card/stream \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "健身入门",
    "templateName": "daily-knowledge-card-template.md"
  }' \
  -N \
  --max-time 180 2>/dev/null > stream_output.txt

# 提取completed事件
echo -e "\n✅ Completed事件内容："
grep "event: completed" -A 1 stream_output.txt | grep "^data:" | sed 's/^data: //' | python3 -m json.tool

# 清理临时文件
rm -f stream_output.txt