#!/bin/bash

echo "==========================================="
echo "测试新的 Workspace 元数据系统"
echo "==========================================="

SERVER="http://localhost:3001"
TOPIC="测试元数据$(date +%s)"  # 添加时间戳避免重复
TEMPLATE="cardplanet-Sandra-json"

echo -e "\n1. 使用异步接口创建卡片..."
RESPONSE=$(curl -s -X POST "${SERVER}/api/generate/card/async" \
  -H "Content-Type: application/json" \
  -d "{\"topic\": \"${TOPIC}\", \"templateName\": \"${TEMPLATE}\"}")

echo "响应:"
echo "$RESPONSE" | python3 -m json.tool

# 提取文件夹名称
FOLDER_NAME=$(echo "$RESPONSE" | sed -n 's/.*"folderName":"\([^"]*\)".*/\1/p')
echo -e "\n文件夹名称: $FOLDER_NAME"

# URL编码
ENCODED_FOLDER=$(echo -n "$FOLDER_NAME" | python3 -c "import sys, urllib.parse; print(urllib.parse.quote(sys.stdin.read()))")

echo -e "\n2. 检查文件夹内容（应该没有 .folder_meta.json）..."
sleep 2

# 查询文件夹内容
QUERY_RESPONSE=$(curl -s "${SERVER}/api/generate/card/query/${ENCODED_FOLDER}")

echo -e "\n查询响应:"
echo "$QUERY_RESPONSE" | python3 -c "
import json
import sys

try:
    data = json.load(sys.stdin)
    print(json.dumps(data, indent=2, ensure_ascii=False))
    
    if 'data' in data and 'availableFiles' in data['data']:
        files = data['data']['availableFiles']
        print('\\n文件夹中的文件:')
        for f in files:
            print(f'  - {f}')
        
        # 检查是否有元数据文件
        if any('.folder_meta.json' in f for f in files):
            print('\\n❌ 错误：在主题文件夹中发现了 .folder_meta.json')
        else:
            print('\\n✅ 正确：主题文件夹中没有元数据文件')
except Exception as e:
    print(f'解析错误: {e}')
"

echo -e "\n3. 检查 workspace/card 目录下的元数据文件..."
# 这需要服务器端权限，这里只是演示路径
echo "元数据应该在: /app/data/users/default/workspace/card/.card_workspace_meta.json"

echo -e "\n4. 等待生成完成后再次查询..."
sleep 10

FINAL_QUERY=$(curl -s "${SERVER}/api/generate/card/query/${ENCODED_FOLDER}")
echo -e "\n最终查询结果:"
echo "$FINAL_QUERY" | python3 -c "
import json
import sys

try:
    data = json.load(sys.stdin)
    
    if data.get('success'):
        if 'data' in data and 'files' in data['data']:
            files = data['data']['files']
            print(f'✅ 生成成功，找到 {len(files)} 个文件')
            for f in files:
                print(f\"  - {f['name']} ({f['type']})\")
                
            # 验证没有元数据文件
            meta_files = [f for f in files if '_meta' in f['name'] or f['name'].startswith('.')]
            if meta_files:
                print(f'\\n❌ 错误：发现元数据文件: {meta_files}')
            else:
                print('\\n✅ 正确：没有元数据文件混入生成的文件中')
    else:
        print('文件尚未生成完成')
        if 'data' in data and 'availableFiles' in data['data']:
            files = data['data']['availableFiles']
            print(f'当前文件: {files}')
            
except Exception as e:
    print(f'解析错误: {e}')
"

echo -e "\n==========================================="
echo "测试完成"
echo "==========================================="
echo ""
echo "预期结果："
echo "1. 主题文件夹中不应该有 .folder_meta.json"
echo "2. 元数据应该存储在 workspace/card/.card_workspace_meta.json"
echo "3. 查询接口不应该返回元数据文件"