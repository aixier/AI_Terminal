#!/bin/bash

# 通用元数据生成测试脚本
# 测试所有模板的meta文件生成和daily模板的四文件生成功能

set -e

# 配置
API_BASE="http://localhost:3000/api/generate/card"
TEST_USER="test_user_$(date +%s)"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 创建测试结果目录
TEST_RESULTS_DIR="test-results-${TIMESTAMP}"
mkdir -p "$TEST_RESULTS_DIR"
log_info "Created test results directory: $TEST_RESULTS_DIR"

# 等待函数
wait_for_completion() {
    local max_wait=$1
    local check_interval=2
    local elapsed=0
    
    log_info "Waiting for completion (max ${max_wait}s)..."
    
    while [ $elapsed -lt $max_wait ]; do
        sleep $check_interval
        elapsed=$((elapsed + check_interval))
        echo -n "."
    done
    echo
}

# API调用函数
call_api() {
    local method=$1
    local endpoint=$2
    local data=$3
    local output_file="$TEST_RESULTS_DIR/response_$(date +%s).json"
    
    log_info "Calling $method $endpoint"
    
    if [ "$method" = "POST" ]; then
        curl -s -X POST \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$endpoint" > "$output_file"
    else
        curl -s "$endpoint" > "$output_file"
    fi
    
    echo "$output_file"
}

# 检查文件是否存在
check_files_exist() {
    local folder_path=$1
    shift
    local expected_files=("$@")
    local all_exist=true
    
    log_info "Checking files in: $folder_path"
    
    for file in "${expected_files[@]}"; do
        if [ -f "$folder_path/$file" ]; then
            log_success "✓ Found: $file"
        else
            log_error "✗ Missing: $file"
            all_exist=false
        fi
    done
    
    return $([ "$all_exist" = true ] && echo 0 || echo 1)
}

# 验证meta文件内容
validate_meta_file() {
    local meta_file=$1
    
    if [ ! -f "$meta_file" ]; then
        log_error "Meta file not found: $meta_file"
        return 1
    fi
    
    log_info "Validating meta file: $(basename $meta_file)"
    
    # 检查JSON格式
    if ! jq . "$meta_file" > /dev/null 2>&1; then
        log_error "Invalid JSON format in meta file"
        return 1
    fi
    
    # 检查必要字段
    local required_fields=("sessionInfo" "request" "execution" "output" "logs")
    for field in "${required_fields[@]}"; do
        if jq -e "has(\"$field\")" "$meta_file" > /dev/null; then
            log_success "✓ Has required field: $field"
        else
            log_error "✗ Missing required field: $field"
            return 1
        fi
    done
    
    # 检查会话信息
    local session_id=$(jq -r '.sessionInfo.sessionId' "$meta_file")
    local user_id=$(jq -r '.sessionInfo.userId' "$meta_file")
    local created_at=$(jq -r '.sessionInfo.createdAt' "$meta_file")
    
    log_info "Session ID: $session_id"
    log_info "User ID: $user_id"
    log_info "Created At: $created_at"
    
    # 检查文件记录
    local file_count=$(jq '.output.generatedFiles | length' "$meta_file")
    log_info "Recorded $file_count generated files"
    
    return 0
}

# 测试1：Daily模板四文件生成
test_daily_template() {
    log_info "=== Testing Daily Knowledge Card Template ==="
    
    local topic="人工智能的未来发展"
    local template="daily-knowledge-card-template.md"
    
    local test_data='{
        "topic": "'"$topic"'",
        "templateName": "'"$template"'",
        "userId": "'"$TEST_USER"'"
    }'
    
    local response_file=$(call_api "POST" "$API_BASE" "$test_data")
    
    # 检查响应
    if jq -e '.success' "$response_file" > /dev/null; then
        log_success "API call successful"
        
        local folder_name=$(jq -r '.data.sanitizedTopic // .data.folderName' "$response_file")
        local folder_path="terminal-backend/data/users/$TEST_USER/workspace/card/$folder_name"
        
        # 等待文件生成完成
        wait_for_completion 300  # 5分钟超时
        
        # 检查预期文件
        local expected_files=(
            "knowledge-cards.json"
            "knowledge-cards-response.json"
            "knowledge-cards.html"
        )
        
        # 查找meta文件（使用通配符）
        local meta_files=("$folder_path"/*_meta.json)
        if [ ${#meta_files[@]} -gt 0 ] && [ -f "${meta_files[0]}" ]; then
            expected_files+=("$(basename "${meta_files[0]}")")
        fi
        
        if check_files_exist "$folder_path" "${expected_files[@]}"; then
            log_success "Daily template four-file generation test PASSED"
            
            # 验证meta文件
            if [ -f "${meta_files[0]}" ]; then
                validate_meta_file "${meta_files[0]}"
            fi
        else
            log_error "Daily template four-file generation test FAILED"
        fi
    else
        log_error "API call failed"
        cat "$response_file"
    fi
}

# 测试2：其他模板通用meta文件生成
test_other_templates() {
    log_info "=== Testing Other Templates Meta File Generation ==="
    
    local templates=(
        "cardplanet-Sandra-json"
        "cardplanet-Sandra-cover"
    )
    
    for template in "${templates[@]}"; do
        log_info "Testing template: $template"
        
        local topic="测试主题_$(date +%s)"
        local test_data='{
            "topic": "'"$topic"'",
            "templateName": "'"$template"'",
            "userId": "'"$TEST_USER"'"
        }'
        
        local response_file=$(call_api "POST" "$API_BASE" "$test_data")
        
        if jq -e '.success' "$response_file" > /dev/null; then
            log_success "API call successful for $template"
            
            local folder_name=$(jq -r '.data.sanitizedTopic // .data.folderName' "$response_file")
            local folder_path="terminal-backend/data/users/$TEST_USER/workspace/card/$folder_name"
            
            # 等待文件生成完成
            wait_for_completion 180  # 3分钟超时
            
            # 查找meta文件
            local meta_files=("$folder_path"/*_meta.json)
            if [ ${#meta_files[@]} -gt 0 ] && [ -f "${meta_files[0]}" ]; then
                log_success "Meta file found for $template: $(basename "${meta_files[0]}")"
                
                # 验证meta文件
                if validate_meta_file "${meta_files[0]}"; then
                    log_success "Template $template meta generation test PASSED"
                else
                    log_error "Template $template meta validation FAILED"
                fi
            else
                log_error "Meta file not found for $template"
            fi
        else
            log_error "API call failed for $template"
            cat "$response_file"
        fi
    done
}

# 测试3：异步API测试
test_async_api() {
    log_info "=== Testing Async API Meta Generation ==="
    
    local topic="异步测试主题"
    local template="daily-knowledge-card-template.md"
    
    local test_data='{
        "topic": "'"$topic"'",
        "templateName": "'"$template"'",
        "userId": "'"$TEST_USER"'"
    }'
    
    local response_file=$(call_api "POST" "$API_BASE/async" "$test_data")
    
    if jq -e '.success' "$response_file" > /dev/null; then
        log_success "Async API call successful"
        
        local task_id=$(jq -r '.data.taskId' "$response_file")
        local folder_name=$(jq -r '.data.folderName' "$response_file")
        local folder_path="terminal-backend/data/users/$TEST_USER/workspace/card/$folder_name"
        
        log_info "Task ID: $task_id"
        log_info "Folder: $folder_name"
        
        # 等待异步任务完成
        wait_for_completion 300  # 5分钟超时
        
        # 检查meta文件
        local meta_files=("$folder_path"/*_meta.json)
        if [ ${#meta_files[@]} -gt 0 ] && [ -f "${meta_files[0]}" ]; then
            log_success "Async API meta generation test PASSED"
            validate_meta_file "${meta_files[0]}"
        else
            log_error "Async API meta generation test FAILED - no meta file found"
        fi
    else
        log_error "Async API call failed"
        cat "$response_file"
    fi
}

# 生成测试报告
generate_report() {
    local report_file="$TEST_RESULTS_DIR/test_report.md"
    
    cat > "$report_file" << EOF
# Universal Metadata Generation Test Report

**Test Run:** $TIMESTAMP
**Test User:** $TEST_USER

## Test Summary

This report covers the testing of:
1. Daily template four-file generation (JSON + Response + HTML + Meta)
2. Other templates universal meta file generation
3. Async API meta file generation

## Test Results

### Files Generated
\`\`\`
$(find terminal-backend/data/users/$TEST_USER -name "*.json" -o -name "*.html" 2>/dev/null || echo "No files found")
\`\`\`

### Meta Files Found
\`\`\`
$(find terminal-backend/data/users/$TEST_USER -name "*_meta.json" 2>/dev/null || echo "No meta files found")
\`\`\`

## Recommendations

1. Verify all templates generate meta files correctly
2. Check daily template four-file generation completeness
3. Ensure meta file JSON schema compliance

EOF

    log_success "Test report generated: $report_file"
}

# 主测试流程
main() {
    log_info "Starting Universal Metadata Generation Tests"
    log_info "Timestamp: $TIMESTAMP"
    log_info "Test User: $TEST_USER"
    
    # 确保服务器运行
    if ! curl -s "$API_BASE" > /dev/null; then
        log_error "API server is not running at $API_BASE"
        log_info "Please start the server first: npm run dev"
        exit 1
    fi
    
    log_success "API server is running"
    
    # 执行测试
    test_daily_template
    echo
    test_other_templates  
    echo
    test_async_api
    echo
    
    # 生成报告
    generate_report
    
    log_success "All tests completed. Check results in: $TEST_RESULTS_DIR"
}

# 清理函数
cleanup() {
    log_info "Cleaning up test data..."
    # 这里可以添加清理逻辑，比如删除测试用户数据
    # rm -rf "terminal-backend/data/users/$TEST_USER"
}

# 错误处理
trap cleanup EXIT

# 运行测试
main "$@"