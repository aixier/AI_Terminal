#!/bin/bash

# 测试脚本 - 测试流式和非流式API，保存JSON结果
TEST_DIR="/mnt/d/work/AI_Terminal/test_results/$(date +%Y%m%d)"
mkdir -p "$TEST_DIR"

echo "================================"
echo "API 完整测试 - $(date)"
echo "================================"
echo ""

# 测试1: 流式API - 瑜伽入门
echo "📝 测试1: 流式API - 主题: 瑜伽入门"
echo "--------------------------------"
curl -X POST http://127.0.0.1:8082/api/generate/card/stream \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "瑜伽入门",
    "templateName": "daily-knowledge-card-template.md"
  }' \
  -N \
  --max-time 180 2>/dev/null > "$TEST_DIR/stream_yoga.txt"

# 提取completed事件的JSON
echo "提取JSON内容..."
grep "event: completed" -A 1 "$TEST_DIR/stream_yoga.txt" | grep "^data:" | sed 's/^data: //' > "$TEST_DIR/stream_yoga_raw.json"
if [ -s "$TEST_DIR/stream_yoga_raw.json" ]; then
    python3 -m json.tool "$TEST_DIR/stream_yoga_raw.json" > "$TEST_DIR/stream_yoga.json"
    echo "✅ 流式API测试1完成，JSON保存至: $TEST_DIR/stream_yoga.json"
    # 提取content字段并保存
    python3 -c "import json; data=json.load(open('$TEST_DIR/stream_yoga.json')); json.dump(data.get('content', {}), open('$TEST_DIR/yoga_content.json', 'w'), indent=2, ensure_ascii=False)" 2>/dev/null
else
    echo "❌ 流式API测试1失败"
fi
echo ""

# 等待一下避免并发问题
sleep 5

# 测试2: 流式API - 编程技巧
echo "📝 测试2: 流式API - 主题: 编程技巧"
echo "--------------------------------"
curl -X POST http://127.0.0.1:8082/api/generate/card/stream \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "编程技巧",
    "templateName": "daily-knowledge-card-template.md"
  }' \
  -N \
  --max-time 180 2>/dev/null > "$TEST_DIR/stream_programming.txt"

# 提取completed事件的JSON
echo "提取JSON内容..."
grep "event: completed" -A 1 "$TEST_DIR/stream_programming.txt" | grep "^data:" | sed 's/^data: //' > "$TEST_DIR/stream_programming_raw.json"
if [ -s "$TEST_DIR/stream_programming_raw.json" ]; then
    python3 -m json.tool "$TEST_DIR/stream_programming_raw.json" > "$TEST_DIR/stream_programming.json"
    echo "✅ 流式API测试2完成，JSON保存至: $TEST_DIR/stream_programming.json"
    # 提取content字段并保存
    python3 -c "import json; data=json.load(open('$TEST_DIR/stream_programming.json')); json.dump(data.get('content', {}), open('$TEST_DIR/programming_content.json', 'w'), indent=2, ensure_ascii=False)" 2>/dev/null
else
    echo "❌ 流式API测试2失败"
fi
echo ""

# 等待一下
sleep 5

# 测试3: 非流式API - 瑜伽入门
echo "📝 测试3: 非流式API - 主题: 瑜伽入门"
echo "--------------------------------"
curl -X POST http://127.0.0.1:8082/api/generate/card \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "瑜伽入门",
    "templateName": "daily-knowledge-card-template.md"
  }' \
  --max-time 180 2>/dev/null > "$TEST_DIR/nonstream_yoga_raw.json"

if [ -s "$TEST_DIR/nonstream_yoga_raw.json" ]; then
    python3 -m json.tool "$TEST_DIR/nonstream_yoga_raw.json" > "$TEST_DIR/nonstream_yoga.json"
    echo "✅ 非流式API测试3完成，JSON保存至: $TEST_DIR/nonstream_yoga.json"
    # 提取content字段并保存
    python3 -c "import json; data=json.load(open('$TEST_DIR/nonstream_yoga.json')); json.dump(data.get('data', {}).get('content', {}), open('$TEST_DIR/nonstream_yoga_content.json', 'w'), indent=2, ensure_ascii=False)" 2>/dev/null
else
    echo "❌ 非流式API测试3失败"
fi
echo ""

# 等待一下
sleep 5

# 测试4: 非流式API - 编程技巧
echo "📝 测试4: 非流式API - 主题: 编程技巧"
echo "--------------------------------"
curl -X POST http://127.0.0.1:8082/api/generate/card \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "编程技巧",
    "templateName": "daily-knowledge-card-template.md"
  }' \
  --max-time 180 2>/dev/null > "$TEST_DIR/nonstream_programming_raw.json"

if [ -s "$TEST_DIR/nonstream_programming_raw.json" ]; then
    python3 -m json.tool "$TEST_DIR/nonstream_programming_raw.json" > "$TEST_DIR/nonstream_programming.json"
    echo "✅ 非流式API测试4完成，JSON保存至: $TEST_DIR/nonstream_programming.json"
    # 提取content字段并保存
    python3 -c "import json; data=json.load(open('$TEST_DIR/nonstream_programming.json')); json.dump(data.get('data', {}).get('content', {}), open('$TEST_DIR/nonstream_programming_content.json', 'w'), indent=2, ensure_ascii=False)" 2>/dev/null
else
    echo "❌ 非流式API测试4失败"
fi
echo ""

echo "================================"
echo "测试完成！结果保存在: $TEST_DIR"
echo "================================"
echo ""
echo "文件列表:"
ls -la "$TEST_DIR"/*.json 2>/dev/null | grep -E "(yoga|programming)" | awk '{print $9}' | xargs -I {} basename {}