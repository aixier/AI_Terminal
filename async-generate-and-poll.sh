#!/bin/bash

# 异步生成卡片并轮询结果的脚本

echo "==========================================="
echo "异步卡片生成与轮询脚本"
echo "==========================================="

SERVER="http://card.paitongai.com"
ASYNC_ENDPOINT="/api/generate/card/async"
QUERY_ENDPOINT="/api/generate/card/query"

# 生成参数
TOPIC="儿童民族舞蹈"
TEMPLATE="cardplanet-Sandra-json"

echo -e "\n1. 提交异步生成任务..."
echo "主题: $TOPIC"
echo "模板: $TEMPLATE"

# 提交异步任务
RESPONSE=$(curl -s -X POST "${SERVER}${ASYNC_ENDPOINT}" \
  -H "Content-Type: application/json" \
  -d "{\"topic\": \"${TOPIC}\", \"templateName\": \"${TEMPLATE}\"}")

echo -e "\n响应: $RESPONSE"

# 解析响应获取文件夹名称和任务ID
SUCCESS=$(echo "$RESPONSE" | grep -o '"success":true')
if [ -z "$SUCCESS" ]; then
    echo "错误: 任务提交失败"
    echo "$RESPONSE"
    exit 1
fi

# 提取文件夹名称（处理中文）
FOLDER_NAME=$(echo "$RESPONSE" | sed -n 's/.*"folderName":"\([^"]*\)".*/\1/p')
TASK_ID=$(echo "$RESPONSE" | sed -n 's/.*"taskId":"\([^"]*\)".*/\1/p')

echo -e "\n任务ID: $TASK_ID"
echo "文件夹名称: $FOLDER_NAME"

# URL编码文件夹名称（处理中文）
ENCODED_FOLDER=$(echo -n "$FOLDER_NAME" | python3 -c "import sys, urllib.parse; print(urllib.parse.quote(sys.stdin.read()))")
echo "编码后的文件夹名称: $ENCODED_FOLDER"

echo -e "\n2. 开始轮询结果..."
echo "查询地址: ${SERVER}${QUERY_ENDPOINT}/${ENCODED_FOLDER}"

# 轮询计数器
POLL_COUNT=0
MAX_POLLS=60  # 最多轮询60次（10分钟）
POLL_INTERVAL=10  # 每10秒轮询一次

while [ $POLL_COUNT -lt $MAX_POLLS ]; do
    POLL_COUNT=$((POLL_COUNT + 1))
    
    echo -e "\n--- 第 ${POLL_COUNT} 次轮询 ($(date '+%Y-%m-%d %H:%M:%S')) ---"
    
    # 查询生成结果
    QUERY_RESPONSE=$(curl -s "${SERVER}${QUERY_ENDPOINT}/${ENCODED_FOLDER}")
    
    # 检查是否有成功响应
    if echo "$QUERY_RESPONSE" | grep -q '"success":true'; then
        # 检查是否有文件生成
        if echo "$QUERY_RESPONSE" | grep -q '"files":\['; then
            # 提取文件数量
            FILE_COUNT=$(echo "$QUERY_RESPONSE" | grep -o '"name":"[^"]*"' | wc -l)
            
            if [ $FILE_COUNT -gt 0 ]; then
                echo "✅ 生成成功！找到 $FILE_COUNT 个文件"
                
                # 格式化输出文件列表
                echo -e "\n生成的文件:"
                echo "$QUERY_RESPONSE" | python3 -c "
import json
import sys
try:
    data = json.load(sys.stdin)
    if 'data' in data and 'files' in data['data']:
        for file in data['data']['files']:
            print(f\"  - {file['name']} ({file['type']}) - {file['size']} bytes\")
            if 'url' in file:
                print(f\"    URL: {file['url']}\")
except:
    print('无法解析文件列表')
"
                
                # 保存完整响应到文件
                RESULT_FILE="async-result-$(date '+%Y%m%d-%H%M%S').json"
                echo "$QUERY_RESPONSE" | python3 -m json.tool > "$RESULT_FILE"
                echo -e "\n完整结果已保存到: $RESULT_FILE"
                
                echo -e "\n==========================================="
                echo "✅ 任务完成！"
                echo "总耗时: $((POLL_COUNT * POLL_INTERVAL)) 秒"
                echo "==========================================="
                exit 0
            fi
        fi
    fi
    
    # 如果返回404或其他错误
    if echo "$QUERY_RESPONSE" | grep -q '"code":404'; then
        echo "⏳ 文件尚未生成，继续等待..."
    else
        # 显示响应的前200个字符
        echo "响应预览: $(echo "$QUERY_RESPONSE" | head -c 200)..."
    fi
    
    # 等待下次轮询
    if [ $POLL_COUNT -lt $MAX_POLLS ]; then
        echo "等待 ${POLL_INTERVAL} 秒后继续..."
        sleep $POLL_INTERVAL
    fi
done

echo -e "\n==========================================="
echo "❌ 超时：轮询 $MAX_POLLS 次后仍未完成"
echo "总等待时间: $((MAX_POLLS * POLL_INTERVAL)) 秒"
echo "==========================================="

# 最后尝试查询任务状态
echo -e "\n查询任务状态..."
STATUS_RESPONSE=$(curl -s "${SERVER}/api/generate/status/${TASK_ID}")
echo "任务状态: $STATUS_RESPONSE"

exit 1