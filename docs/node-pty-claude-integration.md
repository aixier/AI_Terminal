# Node-PTY 与 Claude CLI 集成经验总结

## 核心问题
Claude CLI 在 node-pty 环境中执行时会遇到 TTY 交互模式问题，主要表现为：
1. Raw mode 不支持错误
2. 交互式输入等待导致超时
3. 权限问题（不能以 root 用户运行）

## 测试结果汇总

### ✅ 成功的方法

#### 1. Child Process Spawn with Echo Pipe（推荐）
```javascript
import { spawn } from 'child_process';

const child = spawn('sh', ['-c', `echo "${prompt}" | claude --dangerously-skip-permissions`], {
  env: { ...process.env }
});
```
- **优点**：简单可靠，不需要 PTY
- **性能**：6-9秒响应时间
- **成功率**：100%

#### 2. PTY Background with File Redirection（PTY环境可用）
```javascript
import pty from 'node-pty';

const outputFile = `/tmp/claude_output_${Date.now()}.txt`;
const command = `echo "${prompt}" | claude --dangerously-skip-permissions > ${outputFile} 2>&1 && cat ${outputFile} && rm ${outputFile}`;

const ptyProcess = pty.spawn('sh', ['-c', command], {
  name: 'xterm-256color',
  cols: 80,
  rows: 30,
  cwd: process.cwd(),
  env: process.env
});
```
- **优点**：在 PTY 环境中可用，适合 Web Terminal
- **性能**：7-8秒响应时间
- **成功率**：100%

### ❌ 失败的方法

1. **直接 Spawn Claude**：超时，等待交互输入
2. **PTY 直接执行**：Raw mode 错误
3. **PTY 非交互模式**：仍然触发 Raw mode 错误

## 环境要求

### 1. 用户权限
- **必须**：以非 root 用户运行（UID != 0）
- Docker 中使用 `USER node` 或类似配置
- 测试环境：UID=1000, GID=1000

### 2. 环境变量
```bash
export ANTHROPIC_API_KEY="your-api-key"
export ANTHROPIC_BASE_URL="http://your-api-endpoint/api/"
```

### 3. Docker 配置示例
```dockerfile
# 安装 Claude CLI
RUN npm install -g @anthropic-ai/claude-code

# 切换到非 root 用户
USER node

# 设置环境变量
ENV ANTHROPIC_API_KEY="your-key" \
    ANTHROPIC_BASE_URL="your-url"
```

## 实现建议

### 1. 服务层实现
```javascript
// services/claudeService.js
export class ClaudeService {
  async executePrompt(prompt) {
    // 优先使用 spawn + echo pipe
    return new Promise((resolve, reject) => {
      const child = spawn('sh', ['-c', `echo "${prompt}" | claude --dangerously-skip-permissions`], {
        env: process.env,
        timeout: 30000
      });
      
      let output = '';
      child.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      child.on('close', (code) => {
        if (code === 0) {
          resolve(output.trim());
        } else {
          reject(new Error(`Claude CLI exited with code ${code}`));
        }
      });
    });
  }
}
```

### 2. Web Terminal 集成
对于需要在 Web Terminal 中执行的场景，使用文件重定向方法：
```javascript
// 在 PTY session 中执行
const executeInPty = async (ptyProcess, prompt) => {
  const outputFile = `/tmp/claude_${Date.now()}.txt`;
  const command = `echo "${prompt}" | claude --dangerously-skip-permissions > ${outputFile} 2>&1 && cat ${outputFile} && rm ${outputFile}`;
  
  ptyProcess.write(command + '\n');
  // 处理输出...
};
```

## 性能优化

1. **缓存机制**：对相同 prompt 实现缓存
2. **并发控制**：限制同时执行的 Claude 进程数
3. **超时处理**：设置合理的超时时间（建议 30秒）
4. **错误重试**：实现指数退避重试机制

## 故障排查

### 常见错误及解决方案

| 错误信息 | 原因 | 解决方案 |
|---------|------|----------|
| "Raw mode is not supported" | TTY 交互模式问题 | 使用 echo pipe 或文件重定向 |
| "cannot be used with root/sudo" | root 权限运行 | 切换到普通用户 |
| 命令超时 | 等待交互输入 | 使用 echo 管道提供输入 |
| "command not found" | Claude CLI 未安装 | 安装 @anthropic-ai/claude-code |

### 调试技巧

1. **测试环境检查**
```bash
# 检查用户
whoami
id

# 检查 Claude CLI
which claude
claude --version

# 测试简单命令
echo "1+1=" | claude --dangerously-skip-permissions
```

2. **日志记录**
- 记录命令执行时间
- 保存错误输出
- 监控进程状态

## 最佳实践

1. **错误处理**：始终实现超时和错误处理
2. **资源清理**：确保临时文件被删除
3. **安全性**：验证和清理用户输入
4. **监控**：记录执行指标和错误率
5. **文档**：保持环境配置文档更新

## 实际应用案例

### AI Terminal 项目中的成功实现

#### 1. 服务层完整实现（v3.10.21）

```javascript
// terminal-backend/src/services/claudeExecutorDirect.js
import { spawn } from 'child_process'

class ClaudeExecutorDirectService {
  async executePrompt(prompt, timeout = 30000, purpose = 'general') {
    const startTime = Date.now()
    
    return new Promise((resolve) => {
      let output = ''
      let errorOutput = ''
      let processExited = false
      
      // 关键：使用 echo pipe 避免 TTY 交互
      const escapedPrompt = prompt
        .replace(/"/g, '\\"')
        .replace(/\$/g, '\\$')
        .replace(/`/g, '\\`')
      const command = `echo "${escapedPrompt}" | claude --dangerously-skip-permissions`
      
      const child = spawn('sh', ['-c', command], {
        env: {
          ...process.env,
          ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN,
          ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL
        },
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd()
      })
      
      child.stdout.on('data', (data) => {
        output += data.toString()
      })
      
      child.stderr.on('data', (data) => {
        errorOutput += data.toString()
      })
      
      child.on('exit', (code) => {
        processExited = true
        if (code === 0 && output) {
          resolve({
            success: true,
            output: output.trim(),
            executionTime: Date.now() - startTime
          })
        } else {
          resolve({
            success: false,
            output: '',
            executionTime: Date.now() - startTime,
            error: errorOutput || `Process exited with code ${code}`
          })
        }
      })
      
      setTimeout(() => {
        if (!processExited) {
          child.kill('SIGTERM')
          resolve({
            success: false,
            output: output,
            executionTime: timeout,
            error: 'Execution timeout'
          })
        }
      }, timeout)
    })
  }
}

export default new ClaudeExecutorDirectService()
```

#### 2. API 接口实现

```javascript
// terminal-backend/src/routes/generate.js
router.post('/cc', async (req, res) => {
  const { prompt, timeout = 30000 } = req.body
  
  if (!prompt) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: 'Prompt is required'
    })
  }
  
  const result = await claudeExecutorDirect.executePrompt(
    prompt, 
    Math.min(timeout, 600000), 
    'cc_api'
  )
  
  res.json({
    code: result.success ? 200 : 500,
    success: result.success,
    output: result.output,
    executionTime: result.executionTime,
    message: result.error
  })
})
```

### 测试结果与性能指标

| 测试用例 | 请求内容 | 响应时间 | 结果 |
|---------|---------|---------|------|
| 简单计算 | `1+1=` | 7.7秒 | `2` |
| 知识问答 | `What is the capital of France?` | 9.3秒 | `Paris` |
| 中文理解 | `人工智能的定义是什么？` | 10.2秒 | 完整定义 |
| 代码生成 | `Write a Python quicksort function` | 12.5秒 | 完整代码 |

### 关键改进点

1. **字符转义处理**：处理双引号、美元符号、反引号等特殊字符
2. **环境变量传递**：确保 API 密钥正确传递
3. **超时机制**：防止进程挂起，最大超时 600 秒
4. **错误处理**：完整的错误捕获和日志记录

## 参考链接

- [Claude Code CLI Documentation](https://docs.anthropic.com/en/docs/claude-code/cli-reference)
- [Node-PTY Documentation](https://github.com/microsoft/node-pty)
- [Ink Raw Mode Issue](https://github.com/vadimdemedes/ink/#israwmodesupported)