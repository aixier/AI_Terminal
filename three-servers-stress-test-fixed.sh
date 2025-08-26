#!/bin/bash

# ================================================================================================
# 三服务器并发压力测试脚本 - 修复版本
# 测试服务器: 
# 1. http://8.130.13.226 (新部署服务器)
# 2. http://aicard.paitongai.com (生产服务器)
# 3. http://127.0.0.1:8083 (本地Docker)
# 每个服务器10个并发请求，总计30个并发
# ================================================================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 配置参数
TIMEOUT=420  # 7分钟超时
LOG_DIR="three-servers-test-fixed-$(date +%Y%m%d-%H%M%S)"
TEMPLATE="cardplanet-Sandra-json"

# 服务器配置
declare -A SERVERS=(
    ["new-server"]="http://8.130.13.226"
    ["aicard-server"]="http://aicard.paitongai.com"
    ["local-docker"]="http://127.0.0.1:8083"
)

# 测试主题（增加到30个，每服务器10个）
TOPICS=(
    "特斯拉电动汽车技术"
    "人工智能发展趋势"  
    "可持续能源技术"
    "太空探索技术"
    "自动驾驶技术"
    "清洁能源革命"
    "电池技术创新"
    "智能制造工艺"
    "绿色出行方案"
    "未来交通系统"
    "量子计算技术"
    "生物医学工程"
    "纳米材料科学"
    "机器学习算法"
    "云计算架构"
    "物联网应用"
    "区块链技术"
    "虚拟现实技术"
    "增强现实应用"
    "5G通信技术"
    "边缘计算技术"
    "数字孪生技术"
    "智慧城市建设"
    "自然语言处理"
    "计算机视觉"
    "机器人技术"
    "3D打印技术"
    "基因编辑技术"
    "新材料研发"
    "航空航天技术"
)

echo -e "${CYAN}================================================================================================${NC}"
echo -e "${CYAN}🚀 三服务器并发压力测试 - 修复版本${NC}"
echo -e "${CYAN}================================================================================================${NC}"
echo -e "${YELLOW}测试时间: $(date)${NC}"
echo -e "${YELLOW}测试模式: 每服务器10个并发请求${NC}"
echo -e "${YELLOW}总并发数: 30个请求${NC}"
echo -e "${YELLOW}请求超时: ${TIMEOUT}秒${NC}"
echo -e "${YELLOW}测试模板: ${TEMPLATE}${NC}"
echo -e "${YELLOW}日志目录: ${LOG_DIR}${NC}"
echo ""

echo -e "${BLUE}🎯 测试服务器:${NC}"
for server_name in "${!SERVERS[@]}"; do
    echo -e "  ${server_name}: ${SERVERS[$server_name]}"
done
echo ""

# 创建日志目录
mkdir -p "${LOG_DIR}"

# 创建汇总CSV文件
summary_csv="${LOG_DIR}/summary.csv"
echo "global_id,server_name,server_url,topic,request_id,http_code,duration,response_size,field_check,missing_fields" > "$summary_csv"

# 创建CSV锁文件避免并发写入冲突
csv_lock="${LOG_DIR}/csv.lock"

# 开始时间
START_TIME=$(date +%s)

echo -e "${GREEN}🚀 开始三服务器并发压力测试...${NC}"
echo ""

# 全局请求计数器
GLOBAL_ID=0

# 存储所有进程PID
declare -a ALL_PIDS=()

# CSV写入函数
write_csv_line() {
    local line="$1"
    (
        flock 200
        echo "$line" >> "$summary_csv"
    ) 200>"$csv_lock"
}

# 为每个服务器启动10个并发请求
for server_name in "${!SERVERS[@]}"; do
    server_url="${SERVERS[$server_name]}"
    
    echo -e "${PURPLE}🔥 启动 ${server_name} (${server_url}) 的10个并发请求...${NC}"
    
    for i in {1..10}; do
        GLOBAL_ID=$((GLOBAL_ID + 1))
        topic_index=$(((GLOBAL_ID - 1) % ${#TOPICS[@]}))
        topic="${TOPICS[$topic_index]}"
        
        log_file="${LOG_DIR}/${server_name}_request_${i}.log"
        
        echo -e "  ${CYAN}[${GLOBAL_ID}]${NC} ${server_name} 请求 ${i}: ${topic}"
        
        # 后台执行请求 - 使用函数避免变量作用域问题
        (
            # 复制需要的变量到子shell
            local_global_id=$GLOBAL_ID
            local_server_name=$server_name
            local_server_url=$server_url
            local_topic="$topic"
            local_i=$i
            local_template=$TEMPLATE
            local_timeout=$TIMEOUT
            local_log_file="$log_file"
            local_summary_csv="$summary_csv"
            local_csv_lock="$csv_lock"
            
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] 开始请求" > "$local_log_file"
            echo "全局ID: $local_global_id" >> "$local_log_file"
            echo "服务器: $local_server_name" >> "$local_log_file"
            echo "服务器URL: $local_server_url" >> "$local_log_file"
            echo "主题: $local_topic" >> "$local_log_file"
            echo "请求ID: $local_i" >> "$local_log_file"
            echo "模板: $local_template" >> "$local_log_file"
            echo "超时设置: ${local_timeout}秒" >> "$local_log_file"
            echo "----------------------------------------" >> "$local_log_file"
            
            start_time=$(date +%s.%N)
            
            echo "开始发送cURL请求..." >> "$local_log_file"
            
            # 增加详细的cURL调试
            response=$(curl -v -s -w "\nHTTP_CODE:%{http_code}\nTIME_TOTAL:%{time_total}\nTIME_CONNECT:%{time_connect}\nTIME_NAMELOOKUP:%{time_namelookup}" \
                --max-time $local_timeout \
                --connect-timeout 30 \
                -X POST \
                -H "Content-Type: application/json" \
                -H "User-Agent: stress-test-script/1.0" \
                -d "{\"topic\":\"$local_topic\",\"templateName\":\"$local_template\"}" \
                "$local_server_url/api/generate/card" 2>&1)
            
            curl_exit_code=$?
            end_time=$(date +%s.%N)
            duration=$(echo "$end_time - $start_time" | bc 2>/dev/null || echo "0")
            
            echo "cURL完成，退出码: $curl_exit_code" >> "$local_log_file"
            echo "请求完成时间: $(date '+%Y-%m-%d %H:%M:%S')" >> "$local_log_file"
            echo "请求耗时: ${duration}秒" >> "$local_log_file"
            echo "----------------------------------------" >> "$local_log_file"
            echo "原始响应内容:" >> "$local_log_file"
            echo "$response" >> "$local_log_file"
            echo "----------------------------------------" >> "$local_log_file"
            
            # 解析响应
            http_code="000"
            time_total="$duration"
            response_body=""
            field_check="HTTP_ERROR"
            missing_fields=""
            response_size=0
            
            if [ $curl_exit_code -eq 0 ]; then
                # 提取HTTP状态码和响应时间
                http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d: -f2 | tr -d ' \n' || echo "000")
                time_total=$(echo "$response" | grep "TIME_TOTAL:" | cut -d: -f2 | tr -d ' \n' || echo "$duration")
                
                # 提取响应体（移除调试信息）
                response_body=$(echo "$response" | sed '/HTTP_CODE:/,$d' | sed '/^[<>]/d' | sed '/^\*/d' | sed '/^{.*}$/!d' | head -1)
                
                echo "提取的HTTP状态码: $http_code" >> "$local_log_file"
                echo "提取的响应时间: $time_total" >> "$local_log_file"
                echo "响应体长度: ${#response_body} 字符" >> "$local_log_file"
                echo "响应体内容: $response_body" >> "$local_log_file"
                
                if [ "$http_code" = "200" ] && [ -n "$response_body" ]; then
                    response_size=${#response_body}
                    
                    # 检查字段完整性
                    if echo "$response_body" | jq -e '.success and .data.topic and .data.fileName and .data.content' > /dev/null 2>&1; then
                        if echo "$response_body" | jq -e '.data.pageinfo and .data.allFiles' > /dev/null 2>&1; then
                            field_check="PASS"
                            missing_fields=""
                        else
                            field_check="PARTIAL"
                            missing_fields="pageinfo,allFiles"
                        fi
                    else
                        field_check="FAIL"
                        missing_fields="basic_fields"
                    fi
                    
                    echo "字段检查结果: $field_check" >> "$local_log_file"
                else
                    echo "请求失败或响应为空" >> "$local_log_file"
                    field_check="HTTP_ERROR"
                    http_code="${http_code:-000}"
                fi
            else
                echo "cURL请求失败，错误码: $curl_exit_code" >> "$local_log_file"
                field_check="CURL_ERROR"
                http_code="000"
            fi
            
            # 写入CSV行 - 使用锁避免并发问题
            csv_line="$local_global_id,$local_server_name,$local_server_url,$local_topic,$local_i,$http_code,$duration,$response_size,$field_check,$missing_fields"
            echo "准备写入CSV: $csv_line" >> "$local_log_file"
            
            (
                flock -x 200
                echo "$csv_line" >> "$local_summary_csv"
                echo "CSV写入完成" >> "$local_log_file"
            ) 200>"$local_csv_lock"
            
            echo "请求处理完成" >> "$local_log_file"
            
        ) &
        
        # 记录进程PID
        ALL_PIDS+=($!)
        
        # 小延迟避免瞬间并发过高
        sleep 0.2
    done
    
    echo -e "${GREEN}✅ ${server_name} 的10个并发请求已启动${NC}"
    echo ""
done

echo -e "${YELLOW}⏳ 等待所有请求完成（最大等待时间: $((TIMEOUT + 60))秒）...${NC}"
echo -e "${YELLOW}总共启动了 ${#ALL_PIDS[@]} 个并发请求${NC}"
echo ""

# 等待所有后台进程完成
wait_start=$(date +%s)
completed=0
total=${#ALL_PIDS[@]}

while [ $completed -lt $total ]; do
    completed=0
    for pid in "${ALL_PIDS[@]}"; do
        if ! kill -0 $pid 2>/dev/null; then
            completed=$((completed + 1))
        fi
    done
    
    current_time=$(date +%s)
    elapsed=$((current_time - wait_start))
    
    echo -ne "\r${CYAN}进度: ${completed}/${total} 完成, 已等待: ${elapsed}秒${NC}"
    
    # 超时保护
    if [ $elapsed -gt $((TIMEOUT + 60)) ]; then
        echo -e "\n${RED}⚠️ 等待超时，强制终止剩余进程${NC}"
        for pid in "${ALL_PIDS[@]}"; do
            kill -9 $pid 2>/dev/null || true
        done
        break
    fi
    
    sleep 2
done

echo ""
END_TIME=$(date +%s)
TOTAL_DURATION=$((END_TIME - START_TIME))

echo -e "${GREEN}✅ 所有请求已完成！${NC}"
echo -e "${YELLOW}总耗时: ${TOTAL_DURATION}秒${NC}"
echo ""

# 清理锁文件
rm -f "$csv_lock"

# 按全局ID排序CSV
sort -t, -k1,1n "$summary_csv" > "${summary_csv}.tmp" && mv "${summary_csv}.tmp" "$summary_csv"

# 生成统计报告
echo -e "${BLUE}📈 生成统计报告...${NC}"

# 生成报告
cat > "${LOG_DIR}/test_report.md" << 'EOF'
# 🚀 三服务器并发压力测试报告 - 修复版本

## 📋 测试配置
EOF

echo "- **测试时间**: $(date)" >> "${LOG_DIR}/test_report.md"
echo "- **测试模式**: 每服务器10个并发请求" >> "${LOG_DIR}/test_report.md"
echo "- **总并发数**: 30" >> "${LOG_DIR}/test_report.md"
echo "- **请求超时**: ${TIMEOUT}秒" >> "${LOG_DIR}/test_report.md"
echo "- **模板类型**: ${TEMPLATE}" >> "${LOG_DIR}/test_report.md"
echo "- **测试主题数**: ${#TOPICS[@]} 种不同主题" >> "${LOG_DIR}/test_report.md"
echo "" >> "${LOG_DIR}/test_report.md"

echo "## 🎯 测试服务器" >> "${LOG_DIR}/test_report.md"
for server_name in "${!SERVERS[@]}"; do
    echo "- **${server_name}**: ${SERVERS[$server_name]}" >> "${LOG_DIR}/test_report.md"
done
echo "" >> "${LOG_DIR}/test_report.md"

# 统计每个服务器的结果
echo "## 📈 测试结果统计" >> "${LOG_DIR}/test_report.md"

for server_name in "${!SERVERS[@]}"; do
    server_url="${SERVERS[$server_name]}"
    
    # 统计该服务器的结果
    total_requests=$(grep ",$server_name," "$summary_csv" | wc -l)
    success_requests=$(grep ",$server_name," "$summary_csv" | awk -F, '$6 == 200' | wc -l)
    field_complete_requests=$(grep ",$server_name," "$summary_csv" | awk -F, '$6 == 200 && $9 == "PASS"' | wc -l)
    
    if [ $total_requests -gt 0 ]; then
        success_rate=$(echo "scale=1; $success_requests * 100 / $total_requests" | bc)
        field_complete_rate=$(echo "scale=1; $field_complete_requests * 100 / $total_requests" | bc)
        
        # 计算平均响应时间（只统计成功的请求）
        avg_time=$(grep ",$server_name," "$summary_csv" | awk -F, '$6 == 200 {sum += $7; count++} END {if (count > 0) printf "%.2f", sum/count; else print "N/A"}')
    else
        success_rate="0"
        field_complete_rate="0"
        avg_time="N/A"
    fi
    
    echo "" >> "${LOG_DIR}/test_report.md"
    echo "### 🔍 ${server_name} 详细报告" >> "${LOG_DIR}/test_report.md"
    echo "" >> "${LOG_DIR}/test_report.md"
    echo "**服务器地址**: ${server_url}" >> "${LOG_DIR}/test_report.md"
    echo "" >> "${LOG_DIR}/test_report.md"
    echo "| 指标 | 数值 |" >> "${LOG_DIR}/test_report.md"
    echo "|------|------|" >> "${LOG_DIR}/test_report.md"
    echo "| 总请求数 | ${total_requests} |" >> "${LOG_DIR}/test_report.md"
    echo "| 成功请求数 | ${success_requests} |" >> "${LOG_DIR}/test_report.md"
    echo "| 字段完整请求数 | ${field_complete_requests} |" >> "${LOG_DIR}/test_report.md"
    echo "| **成功率** | **${success_rate}%** |" >> "${LOG_DIR}/test_report.md"
    echo "| **字段完整性** | **${field_complete_rate}%** |" >> "${LOG_DIR}/test_report.md"
    echo "| 平均响应时间 | ${avg_time}s |" >> "${LOG_DIR}/test_report.md"
    echo "" >> "${LOG_DIR}/test_report.md"
    
    # 详细请求结果表格
    echo "### 📝 详细请求结果" >> "${LOG_DIR}/test_report.md"
    echo "| 全局ID | 请求ID | 主题 | HTTP状态 | 响应时间(s) | 字段检查 |" >> "${LOG_DIR}/test_report.md"
    echo "|--------|--------|------|----------|------------|----------|" >> "${LOG_DIR}/test_report.md"
    
    grep ",$server_name," "$summary_csv" | while IFS=, read -r global_id server_name_csv server_url_csv topic request_id http_code duration response_size field_check missing_fields; do
        # 截断主题名称显示
        short_topic=$(echo "$topic" | cut -c1-10)
        status_icon="❌"
        [ "$http_code" = "200" ] && status_icon="✅"
        
        echo "| $global_id | $request_id | ${short_topic} | $http_code $status_icon | $duration | $field_check |" >> "${LOG_DIR}/test_report.md"
    done
done

# 显示汇总结果
echo -e "${GREEN}🎉 测试完成！结果汇总:${NC}"
echo ""

# 全局统计
total_requests_all=$(tail -n +2 "$summary_csv" | wc -l)
success_requests_all=$(tail -n +2 "$summary_csv" | awk -F, '$6 == 200' | wc -l)
field_complete_all=$(tail -n +2 "$summary_csv" | awk -F, '$6 == 200 && $9 == "PASS"' | wc -l)

if [ $total_requests_all -gt 0 ]; then
    global_success_rate=$(echo "scale=1; $success_requests_all * 100 / $total_requests_all" | bc)
    global_field_rate=$(echo "scale=1; $field_complete_all * 100 / $total_requests_all" | bc)
else
    global_success_rate="0"
    global_field_rate="0"
fi

echo -e "${BLUE}📊 全局统计:${NC}"
echo -e "  总请求数: ${total_requests_all}"
echo -e "  成功请求数: ${success_requests_all}"
echo -e "  字段完整数: ${field_complete_all}"
echo -e "  全局成功率: ${global_success_rate}%"
echo -e "  字段完整性: ${global_field_rate}%"
echo -e "  总耗时: ${TOTAL_DURATION}秒"
echo ""

# 各服务器简要统计
for server_name in "${!SERVERS[@]}"; do
    total=$(grep ",$server_name," "$summary_csv" | wc -l)
    success=$(grep ",$server_name," "$summary_csv" | awk -F, '$6 == 200' | wc -l)
    
    if [ $total -gt 0 ]; then
        rate=$(echo "scale=0; $success * 100 / $total" | bc)
    else
        rate="0"
    fi
    
    echo -e "${PURPLE}${server_name}${NC}: ${success}/${total} 成功 (${rate}%)"
done

echo ""
echo -e "${CYAN}📁 详细结果文件:${NC}"
echo -e "  📋 报告: ${LOG_DIR}/test_report.md"
echo -e "  📊 CSV: ${LOG_DIR}/summary.csv"
echo -e "  📝 日志: ${LOG_DIR}/*.log"
echo ""
echo -e "${GREEN}✅ 三服务器并发压力测试完成！${NC}"