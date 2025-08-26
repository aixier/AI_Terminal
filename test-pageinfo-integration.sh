#!/bin/bash

echo "==========================================="
echo "测试 pageinfo 集成功能"
echo "==========================================="

SERVER="http://localhost:3001"
TOPIC="测试舞蹈"
TEMPLATE="cardplanet-Sandra-json"

echo -e "\n1. 使用异步接口生成卡片..."
RESPONSE=$(curl -s -X POST "${SERVER}/api/generate/card/async" \
  -H "Content-Type: application/json" \
  -d "{\"topic\": \"${TOPIC}\", \"templateName\": \"${TEMPLATE}\"}")

echo "响应: $RESPONSE"

# 提取文件夹名称
FOLDER_NAME=$(echo "$RESPONSE" | sed -n 's/.*"folderName":"\([^"]*\)".*/\1/p')
echo "文件夹名称: $FOLDER_NAME"

# URL编码文件夹名称
ENCODED_FOLDER=$(echo -n "$FOLDER_NAME" | python3 -c "import sys, urllib.parse; print(urllib.parse.quote(sys.stdin.read()))")

echo -e "\n2. 等待生成完成..."
sleep 5

echo -e "\n3. 查询生成的文件..."
QUERY_RESPONSE=$(curl -s "${SERVER}/api/generate/card/query/${ENCODED_FOLDER}")

echo "查询响应:"
echo "$QUERY_RESPONSE" | python3 -m json.tool

# 检查是否有JSON文件
echo -e "\n4. 分析文件列表..."
echo "$QUERY_RESPONSE" | python3 -c "
import json
import sys

try:
    data = json.load(sys.stdin)
    if data.get('success') and 'data' in data and 'files' in data['data']:
        files = data['data']['files']
        print(f'找到 {len(files)} 个文件:')
        for file in files:
            print(f\"  - {file['name']} ({file['type']})\")
        
        # 查找JSON文件
        json_files = [f for f in files if f['name'].endswith('.json') and '-response' not in f['name']]
        if json_files:
            print(f'\\n找到 pageinfo JSON 文件: {json_files[0][\"name\"]}')
            print('✅ pageinfo 文件生成成功，可以传递给 engagia API')
        else:
            print('\\n❌ 未找到 pageinfo JSON 文件')
    else:
        print('查询失败或没有文件')
except Exception as e:
    print(f'解析错误: {e}')
"

echo -e "\n==========================================="
echo "测试完成"
echo "==========================================="