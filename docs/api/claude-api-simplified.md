# Claude API 简化指南 (v3.33+)

## 概述

从 v3.33 版本开始，Claude API 采用了全新的简化架构，无需复杂的初始化流程，直接使用 `claude -p` 参数执行命令。

## 核心变更

### 旧方案 (已废弃)
```javascript
// 复杂的初始化流程
await apiTerminalService.initializeClaude(apiId)
await apiTerminalService.sendTextAndControl(apiId, prompt, '\r', 1000)
```

### 新方案 (v3.33+)
```javascript
// 直接执行，无需初始化
await apiTerminalService.executeClaude(apiId, prompt)
```

## API 接口

### POST /api/generate/card

生成知识卡片的简化API。

**请求参数：**
```json
{
  "topic": "主题名称",
  "templateName": "模板文件名" // 可选，默认 daily-knowledge-card-template.md
}
```

**内部实现：**
```javascript
const command = `claude --dangerously-skip-permissions -p "${prompt}"`
terminal.pty.write(command + '\r')
```

**响应格式：**
```json
{
  "code": 200,
  "success": true,
  "data": {
    "topic": "主题名称",
    "fileName": "生成的文件名",
    "content": {}, // JSON内容或HTML内容
    "generationTime": 12345,
    "apiId": "会话ID"
  },
  "message": "卡片生成成功"
}
```

### POST /api/generate/card/stream

流式生成API，返回 Server-Sent Events。

**事件类型：**
- `start`: 开始生成
- `status`: 状态更新  
- `success`: 生成成功
- `error`: 生成失败

## 核心服务

### ApiTerminalService.executeClaude()

**位置：** `terminal-backend/src/utils/apiTerminalService.js`

```javascript
async executeClaude(apiId, prompt) {
  const terminal = await this.createTerminalSession(apiId)
  
  // 直接执行claude命令，使用-p参数传递prompt
  const command = `claude --dangerously-skip-permissions -p "${prompt.replace(/"/g, '\\"')}"`
  terminal.pty.write(command + '\r')
  
  return true
}
```

**优势：**
- ✅ 无需复杂初始化
- ✅ 响应速度更快
- ✅ 代码更简洁
- ✅ 错误更少

## 环境配置

确保容器中设置了正确的环境变量：

```bash
ANTHROPIC_AUTH_TOKEN="your_token_here"
ANTHROPIC_BASE_URL="http://your_relay_server:3000/api/"
```

## 使用示例

### cURL 测试
```bash
curl -X POST http://127.0.0.1:8083/api/generate/card \
  -H "Content-Type: application/json" \
  -d '{"topic": "人工智能", "templateName": "daily-knowledge-card-template.md"}'
```

### JavaScript 调用
```javascript
const response = await fetch('/api/generate/card', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    topic: '人工智能',
    templateName: 'daily-knowledge-card-template.md'
  })
})

const result = await response.json()
console.log(result.data.content)
```

## 废弃的方法

以下方法在 v3.33+ 中已废弃：

- ❌ `initializeClaude()` - 使用 `executeClaude()` 替代
- ❌ `sendTextAndControl()` - 由 `executeClaude()` 内部处理
- ❌ 复杂的Claude初始化流程
- ❌ 主题选择处理
- ❌ 权限确认处理

## 迁移指南

如果你有基于旧版本的代码，请按以下方式迁移：

### 旧代码
```javascript
try {
  await apiTerminalService.initializeClaude(apiId)
  await apiTerminalService.sendTextAndControl(apiId, prompt, '\r', 1000)
} catch (error) {
  // 错误处理
}
```

### 新代码
```javascript
try {
  await apiTerminalService.executeClaude(apiId, prompt)
} catch (error) {
  // 错误处理
}
```

## 注意事项

1. **Prompt 转义**：`executeClaude` 方法会自动处理 prompt 中的引号转义
2. **会话管理**：仍需要手动调用 `destroySession()` 清理会话
3. **超时设置**：默认超时时间为 7 分钟 (420000ms)
4. **并发支持**：每个 API 请求使用独立的会话ID

## 版本历史

- **v3.33+**: 引入简化的 `executeClaude` 方法
- **v3.32-**: 使用复杂的 `initializeClaude` 流程（已废弃）