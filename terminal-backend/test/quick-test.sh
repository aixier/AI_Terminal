#!/bin/bash

# 自定义模板API快速测试脚本
# 使用方法: ./quick-test.sh [token]

echo "=========================================="
echo "🚀 自定义模板API快速测试"
echo "=========================================="

# 配置
API_BASE="http://localhost:6009/api"
ZIP_FILE="/mnt/d/work/AI_Terminal/播客.zip"
TOKEN="${1:-test_token}"

# 检查ZIP文件
if [ ! -f "$ZIP_FILE" ]; then
    echo "❌ ZIP文件不存在: $ZIP_FILE"
    exit 1
fi

echo "📦 ZIP文件: $ZIP_FILE"
echo "🔑 Token: ${TOKEN:0:10}..."
echo ""

# 1. 提交任务
echo "📤 提交任务..."
RESPONSE=$(curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -F "zipFile=@$ZIP_FILE" \
  -F 'prompt=阅读[播客小红书图文卡片需求文档.md]，按文档要求使用[新闻感封面.md]和[内容页模板规范.md的规范]，为"用户card路径"生成html文档。需要使用的照片在[李静/第二期/照片]文件夹中。需要使用的其他素材在[CDN]文件夹中。本期主播：李静、养鸡。本期嘉宾：戴军、艳艳。' \
  -F "templateName=podcast-test" \
  "$API_BASE/generate/custom/async")

# 解析响应
SUCCESS=$(echo "$RESPONSE" | grep -o '"success":true')
if [ -z "$SUCCESS" ]; then
    echo "❌ 提交失败:"
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
    exit 1
fi

TASK_ID=$(echo "$RESPONSE" | grep -o '"taskId":"[^"]*"' | cut -d'"' -f4)
FOLDER_NAME=$(echo "$RESPONSE" | grep -o '"folderName":"[^"]*"' | cut -d'"' -f4)

echo "✅ 任务提交成功"
echo "   Task ID: $TASK_ID"
echo "   Folder: $FOLDER_NAME"
echo ""

# 2. 轮询状态
echo "⏳ 等待处理..."
MAX_ATTEMPTS=30
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    sleep 2
    
    STATUS_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" \
        "$API_BASE/generate/status/$TASK_ID")
    
    STATUS=$(echo "$STATUS_RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    
    if [ "$STATUS" = "completed" ]; then
        echo ""
        echo "✅ 处理完成!"
        break
    elif [ "$STATUS" = "failed" ] || [ "$STATUS" = "error" ]; then
        echo ""
        echo "❌ 处理失败"
        echo "$STATUS_RESPONSE" | python3 -m json.tool 2>/dev/null
        exit 1
    else
        echo -n "."
        ATTEMPT=$((ATTEMPT + 1))
    fi
done

if [ $ATTEMPT -ge $MAX_ATTEMPTS ]; then
    echo ""
    echo "⏱️ 等待超时"
    exit 1
fi

echo ""

# 3. 获取结果
echo "📥 获取结果..."
CONTENT_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" \
    "$API_BASE/generate/card/content/$FOLDER_NAME")

CONTENT_SUCCESS=$(echo "$CONTENT_RESPONSE" | grep -o '"success":true')
if [ -z "$CONTENT_SUCCESS" ]; then
    echo "❌ 获取结果失败"
    exit 1
fi

# 保存结果
OUTPUT_DIR="./test-output-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUTPUT_DIR"

echo "$CONTENT_RESPONSE" | python3 -c "
import json
import sys

data = json.load(sys.stdin)
if data.get('success'):
    # 保存主内容
    if 'content' in data['data']:
        with open('$OUTPUT_DIR/output.html', 'w') as f:
            f.write(data['data']['content'])
        print('✅ 已保存: output.html')
    
    # 保存所有文件
    if 'allFiles' in data['data']:
        for file in data['data']['allFiles']:
            filename = file['fileName']
            content = file['content']
            if isinstance(content, dict):
                content = json.dumps(content, indent=2, ensure_ascii=False)
            with open(f'$OUTPUT_DIR/{filename}', 'w') as f:
                f.write(content)
            print(f'✅ 已保存: {filename}')
"

echo ""
echo "=========================================="
echo "✅ 测试完成！"
echo "📁 输出目录: $OUTPUT_DIR"
echo "=========================================="