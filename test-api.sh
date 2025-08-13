#!/bin/bash

# AI Terminal API 测试脚本
# 用法: ./test-api.sh [选项]
#   stream    - 测试流式API (默认)
#   complete  - 测试非流式API  
#   background - 后台运行流式API测试
#   full      - 完整测试流式API (等待5-7分钟)

MODE=${1:-stream}
PORT=${2:-8083}
TOPIC=${3:-"测试主题"}
TEMPLATE=${4:-"daily-knowledge-card-template.md"}

echo "================================"
echo "AI Terminal API Test"
echo "================================"
echo "Mode: $MODE"
echo "Port: $PORT"
echo "Topic: $TOPIC"
echo "Template: $TEMPLATE"
echo "Time: $(date)"
echo "================================"
echo ""

case $MODE in
  stream)
    # 基础流式测试
    echo "Testing stream API..."
    curl -X POST http://127.0.0.1:$PORT/api/generate/card/stream \
      -H "Content-Type: application/json" \
      -d "{
        \"topic\": \"$TOPIC\",
        \"templateName\": \"$TEMPLATE\"
      }" \
      --no-buffer \
      -N 2>&1
    ;;

  complete)
    # 非流式API测试
    echo "Testing complete API..."
    curl -X POST http://127.0.0.1:$PORT/api/generate/card \
      -H "Content-Type: application/json" \
      -d "{
        \"topic\": \"$TOPIC\",
        \"templateName\": \"$TEMPLATE\"
      }" \
      -s | python3 -m json.tool
    ;;

  background)
    # 后台运行流式测试
    OUTPUT_FILE="test-output-$(date +%Y%m%d-%H%M%S).txt"
    LOG_FILE="test-log-$(date +%Y%m%d-%H%M%S).log"
    
    echo "Starting background stream test..."
    echo "Output: $OUTPUT_FILE"
    echo "Log: $LOG_FILE"
    
    nohup curl -X POST http://127.0.0.1:$PORT/api/generate/card/stream \
      -H "Content-Type: application/json" \
      -d "{
        \"topic\": \"$TOPIC\",
        \"templateName\": \"$TEMPLATE\"
      }" \
      --max-time 600 \
      --no-buffer \
      -N > "$OUTPUT_FILE" 2> "$LOG_FILE" &
    
    PID=$!
    echo "Started with PID: $PID"
    echo ""
    echo "Monitor with:"
    echo "  tail -f $OUTPUT_FILE"
    echo "  ps -p $PID"
    echo "  kill $PID  # to stop"
    ;;

  full)
    # 完整流式测试（等待完成）
    START_TIME=$(date +%s)
    OUTPUT_FILE="test-full-$(date +%Y%m%d-%H%M%S).txt"
    
    echo "Full stream test (may take 5-7 minutes)..."
    echo "Output: $OUTPUT_FILE"
    echo ""
    
    curl -X POST http://127.0.0.1:$PORT/api/generate/card/stream \
      -H "Content-Type: application/json" \
      -d "{
        \"topic\": \"$TOPIC\",
        \"templateName\": \"$TEMPLATE\"
      }" \
      --max-time 600 \
      --no-buffer \
      -N 2>&1 | tee "$OUTPUT_FILE" | while IFS= read -r line; do
        ELAPSED=$(($(date +%s) - START_TIME))
        echo "[${ELAPSED}s] $line"
        
        if [[ "$line" == "event: success" ]]; then
          echo "✅ SUCCESS at ${ELAPSED}s"
        elif [[ "$line" == "event: error" ]]; then
          echo "❌ ERROR at ${ELAPSED}s"
        elif [[ "$line" == "event: cleanup" ]]; then
          echo "🧹 CLEANUP at ${ELAPSED}s"
          break
        fi
      done
    
    END_TIME=$(date +%s)
    TOTAL_TIME=$((END_TIME - START_TIME))
    
    echo ""
    echo "================================"
    echo "Summary:"
    echo "- Total time: ${TOTAL_TIME}s"
    echo "- Output: $OUTPUT_FILE"
    
    if grep -q "event: success" "$OUTPUT_FILE"; then
      echo "✅ Success event found"
      grep -A 2 "event: success" "$OUTPUT_FILE" | tail -3
    else
      echo "❌ No success event"
    fi
    ;;

  *)
    echo "Usage: $0 [stream|complete|background|full] [port] [topic] [template]"
    exit 1
    ;;
esac