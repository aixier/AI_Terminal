#!/bin/bash

# ================================================================================================
# 双服务器流式接口压力测试脚本
# 测试 card.paitongai.com 和 aicard.paitongai.com 的流式生成接口
# 每个服务器10个并发请求
# ================================================================================================

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 服务器配置
declare -A SERVERS=(
    ["card-server"]="http://card.paitongai.com"
    ["aicard-server"]="http://aicard.paitongai.com"
)

CONCURRENT_REQUESTS=10
TIMEOUT=600  # 10分钟超时
STREAM_ENDPOINT="/api/generate/card/stream"

# 测试主题
TOPICS=(
    "人工智能技术"
    "区块链应用"
    "物联网发展"
    "云计算架构"
    "大数据分析"
    "5G通信技术"
    "虚拟现实VR"
    "增强现实AR"
    "机器学习算法"
    "深度学习网络"
    "自动驾驶汽车"
    "智能家居系统"
    "网络安全防护"
    "边缘计算技术"
    "数字孪生技术"
    "智慧城市建设"
    "自然语言处理"
    "计算机视觉"
    "机器人技术"
    "3D打印技术"
    "儿童舞蹈"
    "现代艺术"
    "传统文化"
    "科学实验"
    "健康生活"
)

echo -e "${CYAN}================================================================================================${NC}"
echo -e "${CYAN}🚀 双服务器流式接口压力测试${NC}"
echo -e "${CYAN}================================================================================================${NC}"
echo -e "${YELLOW}测试服务器: card.paitongai.com & aicard.paitongai.com${NC}"
echo -e "${YELLOW}流式接口: ${STREAM_ENDPOINT}${NC}"
echo -e "${YELLOW}每服务器并发数: ${CONCURRENT_REQUESTS}${NC}"
echo -e "${YELLOW}总并发数: $((CONCURRENT_REQUESTS * 2))${NC}"
echo -e "${YELLOW}请求超时: ${TIMEOUT}秒${NC}"
echo -e "${YELLOW}开始时间: $(date)${NC}"
echo ""

# 创建测试结果目录
TEST_DIR="two-servers-stream-test-$(date +%Y%m%d-%H%M%S)"
mkdir -p "${TEST_DIR}/logs"
mkdir -p "${TEST_DIR}/streams"

# 创建汇总CSV文件
SUMMARY_CSV="${TEST_DIR}/stream_summary.csv"
echo "global_id,server_name,server_url,topic,request_id,start_time,end_time,duration,total_events,success_event,error_event,connection_status,final_result" > "$SUMMARY_CSV"

# 全局计数器
GLOBAL_ID=1

# 流式请求测试函数
test_stream_request() {
    local server_name="$1"
    local server_url="$2"
    local topic="$3"
    local request_id="$4"
    local global_id="$5"
    
    local log_file="${TEST_DIR}/logs/${server_name}_request_${request_id}.log"
    local stream_file="${TEST_DIR}/streams/${server_name}_request_${request_id}_stream.log"
    local start_time=$(date +%s.%N)
    local start_timestamp=$(date -Iseconds)
    
    echo "[${start_timestamp}] 开始流式请求" > "$log_file"
    echo "全局ID: $global_id" >> "$log_file"
    echo "服务器: $server_name" >> "$log_file"
    echo "服务器URL: $server_url" >> "$log_file"
    echo "主题: $topic" >> "$log_file"
    echo "请求ID: $request_id" >> "$log_file"
    echo "模板: cardplanet-Sandra-json" >> "$log_file"
    echo "超时设置: ${TIMEOUT}秒" >> "$log_file"
    echo "----------------------------------------" >> "$log_file"
    
    # 初始化统计变量
    local total_events=0
    local success_event=""
    local error_event=""
    local connection_status="UNKNOWN"
    local final_result="UNKNOWN"
    local end_time
    local duration
    
    # 执行流式请求
    echo "开始curl流式请求..." >> "$log_file"
    
    # 使用curl执行流式请求，记录所有SSE事件
    local curl_output
    curl_output=$(curl -N -v --max-time $TIMEOUT -X POST \
        "${server_url}${STREAM_ENDPOINT}" \
        -H "Content-Type: application/json" \
        -H "connection: keep-alive" \
        -H "Accept: text/event-stream" \
        -H "Cache-Control: no-cache" \
        -d "{\"topic\": \"$topic\", \"templateName\": \"cardplanet-Sandra-json\"}" \
        2>&1 | tee "$stream_file")
    
    local curl_exit_code=${PIPESTATUS[0]}
    end_time=$(date +%s.%N)
    duration=$(echo "$end_time - $start_time" | bc)
    local end_timestamp=$(date -Iseconds)
    
    echo "[${end_timestamp}] 流式请求完成" >> "$log_file"
    echo "Curl退出代码: $curl_exit_code" >> "$log_file"
    echo "持续时间: ${duration}秒" >> "$log_file"
    echo "----------------------------------------" >> "$log_file"
    
    # 分析流式输出
    echo "分析流式输出..." >> "$log_file"
    
    # 检查连接状态
    if echo "$curl_output" | grep -q "Connected to"; then
        connection_status="CONNECTED"
        echo "✓ 成功建立连接" >> "$log_file"
    elif echo "$curl_output" | grep -q "Connection refused"; then
        connection_status="CONNECTION_REFUSED"
        echo "✗ 连接被拒绝" >> "$log_file"
    elif echo "$curl_output" | grep -q "Could not resolve host"; then
        connection_status="DNS_ERROR"
        echo "✗ DNS解析失败" >> "$log_file"
    elif echo "$curl_output" | grep -q "Operation timed out"; then
        connection_status="TIMEOUT"
        echo "✗ 连接超时" >> "$log_file"
    else
        connection_status="UNKNOWN_ERROR"
        echo "✗ 未知连接错误" >> "$log_file"
    fi
    
    # 统计SSE事件
    total_events=$(echo "$curl_output" | grep -c "^event:" || echo "0")
    echo "SSE事件总数: $total_events" >> "$log_file"
    
    # 检查特定事件
    if echo "$curl_output" | grep -q "event: success"; then
        success_event="YES"
        final_result="SUCCESS"
        echo "✓ 检测到成功事件" >> "$log_file"
    else
        success_event="NO"
        echo "✗ 未检测到成功事件" >> "$log_file"
    fi
    
    if echo "$curl_output" | grep -q "event: error"; then
        error_event="YES"
        final_result="ERROR"
        echo "✓ 检测到错误事件" >> "$log_file"
    else
        error_event="NO"
        echo "✗ 未检测到错误事件" >> "$log_file"
    fi
    
    # 如果有事件但没有明确的成功/错误，根据事件数量判断
    if [ "$total_events" -gt 0 ] && [ "$success_event" = "NO" ] && [ "$error_event" = "NO" ]; then
        if [ "$total_events" -gt 5 ]; then
            final_result="PARTIAL_SUCCESS"
        else
            final_result="INCOMPLETE"
        fi
    elif [ "$total_events" -eq 0 ]; then
        final_result="NO_EVENTS"
    fi
    
    # 检查特定的事件类型
    if echo "$curl_output" | grep -q "event: start"; then
        echo "✓ 检测到开始事件" >> "$log_file"
    fi
    
    if echo "$curl_output" | grep -q "event: parameters"; then
        echo "✓ 检测到参数事件" >> "$log_file"
    fi
    
    if echo "$curl_output" | grep -q "event: status"; then
        echo "✓ 检测到状态事件" >> "$log_file"
    fi
    
    # 记录响应摘要
    echo "响应摘要:" >> "$log_file"
    echo "- 连接状态: $connection_status" >> "$log_file"
    echo "- 总事件数: $total_events" >> "$log_file"
    echo "- 成功事件: $success_event" >> "$log_file"
    echo "- 错误事件: $error_event" >> "$log_file"
    echo "- 最终结果: $final_result" >> "$log_file"
    echo "- 请求用时: ${duration}秒" >> "$log_file"
    
    # 写入CSV结果（使用文件锁）
    (
        flock -x 200
        echo "$global_id,$server_name,$server_url,$topic,$request_id,$start_timestamp,$end_timestamp,$duration,$total_events,$success_event,$error_event,$connection_status,$final_result" >> "$SUMMARY_CSV"
    ) 200>"${SUMMARY_CSV}.lock"
    
    echo "[$(date -Iseconds)] 请求分析完成" >> "$log_file"
}

# 执行双服务器并发测试
echo -e "${BLUE}🚀 启动双服务器并发测试...${NC}"
echo ""

# 存储后台进程PID
pids=()
test_start_time=$(date +%s.%N)

# 为每个服务器启动并发请求
for server_name in "${!SERVERS[@]}"; do
    server_url="${SERVERS[$server_name]}"
    echo -e "${PURPLE}📡 启动 ${server_name} (${server_url}) 的 ${CONCURRENT_REQUESTS} 个并发请求...${NC}"
    
    for i in $(seq 1 $CONCURRENT_REQUESTS); do
        # 选择主题（循环使用）
        topic_index=$(( ($GLOBAL_ID - 1) % ${#TOPICS[@]} ))
        topic="${TOPICS[$topic_index]}"
        
        echo -e "${YELLOW}  启动请求 ${i}: ${topic}${NC}"
        
        # 后台执行测试
        test_stream_request "$server_name" "$server_url" "$topic" "$i" "$GLOBAL_ID" &
        pids+=($!)
        
        GLOBAL_ID=$((GLOBAL_ID + 1))
        
        # 小延迟避免同时启动过多请求
        sleep 0.2
    done
    
    echo ""
done

echo -e "${YELLOW}⏳ 等待所有 $((CONCURRENT_REQUESTS * 2)) 个并发请求完成...${NC}"
echo -e "${YELLOW}预计等待时间: 5-10分钟（流式生成需要较长时间）${NC}"

# 等待所有请求完成
completed=0
total_requests=$((CONCURRENT_REQUESTS * 2))

for pid in "${pids[@]}"; do
    wait $pid
    completed=$((completed + 1))
    echo -e "${GREEN}✅ 完成 ${completed}/${total_requests} 个请求${NC}"
done

test_end_time=$(date +%s.%N)
total_test_duration=$(echo "$test_end_time - $test_start_time" | bc)

echo ""
echo -e "${GREEN}🎉 所有请求完成！${NC}"
echo -e "${BLUE}📊 总测试时间: ${total_test_duration}秒${NC}"

# 生成测试报告
echo -e "${BLUE}📊 生成测试报告...${NC}"

REPORT_FILE="${TEST_DIR}/stream_test_report.md"

cat > "$REPORT_FILE" << EOF
# 🚀 双服务器流式接口压力测试报告

## 📋 测试配置
- **测试时间**: $(date)
- **测试服务器**: card.paitongai.com & aicard.paitongai.com
- **接口路径**: ${STREAM_ENDPOINT}
- **每服务器并发数**: ${CONCURRENT_REQUESTS}
- **总并发数**: $((CONCURRENT_REQUESTS * 2))
- **请求超时**: ${TIMEOUT}秒
- **模板类型**: cardplanet-Sandra-json
- **总测试时间**: ${total_test_duration}秒

## 📈 测试结果统计

EOF

# 分析结果
for server_name in "${!SERVERS[@]}"; do
    server_url="${SERVERS[$server_name]}"
    
    echo "### 🔍 ${server_name} 详细报告" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "**服务器地址**: ${server_url}" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    
    # 服务器统计
    SERVER_TOTAL=$(tail -n +2 "$SUMMARY_CSV" | awk -F',' -v server="$server_name" '$2 == server' | wc -l)
    SERVER_SUCCESS=$(tail -n +2 "$SUMMARY_CSV" | awk -F',' -v server="$server_name" '$2 == server && $13 == "SUCCESS"' | wc -l)
    SERVER_CONNECTED=$(tail -n +2 "$SUMMARY_CSV" | awk -F',' -v server="$server_name" '$2 == server && $12 == "CONNECTED"' | wc -l)
    SERVER_AVG_EVENTS=$(tail -n +2 "$SUMMARY_CSV" | awk -F',' -v server="$server_name" '$2 == server {sum+=$9; count++} END {if(count>0) printf "%.1f", sum/count; else print "0"}')
    SERVER_AVG_TIME=$(tail -n +2 "$SUMMARY_CSV" | awk -F',' -v server="$server_name" '$2 == server {sum+=$8; count++} END {if(count>0) printf "%.1f", sum/count; else print "0"}')
    
    if [ "$SERVER_TOTAL" -gt 0 ]; then
        SERVER_SUCCESS_RATE=$(echo "scale=1; $SERVER_SUCCESS * 100 / $SERVER_TOTAL" | bc)
        SERVER_CONNECTION_RATE=$(echo "scale=1; $SERVER_CONNECTED * 100 / $SERVER_TOTAL" | bc)
    else
        SERVER_SUCCESS_RATE="0"
        SERVER_CONNECTION_RATE="0"
    fi
    
    cat >> "$REPORT_FILE" << EOF
| 指标 | 数值 |
|------|------|
| 总请求数 | $SERVER_TOTAL |
| 成功请求数 | $SERVER_SUCCESS |
| 连接成功数 | $SERVER_CONNECTED |
| **成功率** | **${SERVER_SUCCESS_RATE}%** |
| **连接成功率** | **${SERVER_CONNECTION_RATE}%** |
| 平均事件数 | ${SERVER_AVG_EVENTS} |
| 平均响应时间 | ${SERVER_AVG_TIME}s |

### 📝 详细请求结果
| 全局ID | 请求ID | 主题 | 连接状态 | 事件数 | 最终结果 | 响应时间(s) |
|--------|--------|------|----------|--------|----------|------------|
EOF
    
    tail -n +2 "$SUMMARY_CSV" | awk -F',' -v server="$server_name" '$2 == server {
        result_icon = ($13 == "SUCCESS") ? "✅" : (($13 == "ERROR") ? "❌" : "⚠️")
        connection_icon = ($12 == "CONNECTED") ? "🟢" : "🔴"
        printf "| %s | %s | %s | %s %s | %s | %s %s | %s |\n", $1, $5, $4, connection_icon, $12, $9, result_icon, $13, $8
    }' >> "$REPORT_FILE"
    
    echo "" >> "$REPORT_FILE"
done

# 清理锁文件
rm -f "${SUMMARY_CSV}.lock"

# 显示汇总结果
echo -e "${BLUE}📊 测试汇总:${NC}"
echo ""

for server_name in "${!SERVERS[@]}"; do
    server_url="${SERVERS[$server_name]}"
    
    SERVER_TOTAL=$(tail -n +2 "$SUMMARY_CSV" | awk -F',' -v server="$server_name" '$2 == server' | wc -l)
    SERVER_SUCCESS=$(tail -n +2 "$SUMMARY_CSV" | awk -F',' -v server="$server_name" '$2 == server && $13 == "SUCCESS"' | wc -l)
    SERVER_CONNECTED=$(tail -n +2 "$SUMMARY_CSV" | awk -F',' -v server="$server_name" '$2 == server && $12 == "CONNECTED"' | wc -l)
    
    if [ "$SERVER_TOTAL" -gt 0 ]; then
        SERVER_SUCCESS_RATE=$(echo "scale=1; $SERVER_SUCCESS * 100 / $SERVER_TOTAL" | bc)
        SERVER_CONNECTION_RATE=$(echo "scale=1; $SERVER_CONNECTED * 100 / $SERVER_TOTAL" | bc)
    else
        SERVER_SUCCESS_RATE="0"
        SERVER_CONNECTION_RATE="0"
    fi
    
    echo -e "${GREEN}📡 ${server_name}:${NC}"
    echo -e "  🌐 地址: ${server_url}"
    echo -e "  📊 总请求: ${SERVER_TOTAL}, 成功: ${SERVER_SUCCESS} (${SERVER_SUCCESS_RATE}%)"
    echo -e "  🔗 连接成功: ${SERVER_CONNECTED} (${SERVER_CONNECTION_RATE}%)"
    echo ""
done

echo -e "${CYAN}📁 测试结果文件:${NC}"
echo -e "  📋 报告: ${TEST_DIR}/stream_test_report.md"
echo -e "  📊 数据: ${TEST_DIR}/stream_summary.csv"
echo -e "  📝 日志: ${TEST_DIR}/logs/"
echo -e "  🌊 流数据: ${TEST_DIR}/streams/"
echo ""
echo -e "${GREEN}✅ 双服务器流式接口压力测试完成！${NC}"