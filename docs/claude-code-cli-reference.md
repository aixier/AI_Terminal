# Claude Code CLI 参考文档

## 概述
Claude Code CLI 是 Anthropic 官方提供的命令行工具，用于与 Claude AI 进行交互。本文档基于官方文档整理，重点关注在容器和 Web Terminal 环境中的使用。

## 基本命令

### 1. 交互式 REPL 模式
```bash
# 启动交互式会话
claude

# 带初始提示词启动
claude "你的问题"

# 继续最近的会话
claude -c

# 恢复特定会话
claude -r "<session-id>" "继续的问题"
```

### 2. 非交互式模式（重要）
```bash
# 打印响应并退出（适合脚本和自动化）
claude -p "你的问题"
claude --print "你的问题"

# 通过管道输入
cat file.txt | claude -p "分析这个文件"
echo "内容" | claude -p "处理这个内容"
```

## 关键参数

### 模型选择
```bash
claude --model sonnet "问题"  # 使用 Sonnet 模型
claude --model opus "问题"    # 使用 Opus 模型
```

### 输出格式
```bash
# 文本格式（默认）
claude -p --output-format text "问题"

# JSON 格式（单一结果）
claude -p --output-format json "问题"

# 流式 JSON（实时流）
claude -p --output-format stream-json "问题"
```

### 输入格式
```bash
# 文本输入（默认）
claude -p --input-format text "问题"

# 流式 JSON 输入
claude -p --input-format stream-json
```

### 权限和工具控制
```bash
# 跳过权限检查（危险，仅用于自动化）
claude --dangerously-skip-permissions -p "问题"

# 设置权限模式
claude --permission-mode auto     # 自动模式
claude --permission-mode review   # 审查模式
claude --permission-mode deny     # 拒绝模式

# 指定允许的工具
claude --allowedTools read,write -p "问题"

# 添加工作目录
claude --add-dir /path/to/dir -p "问题"
```

### 会话控制
```bash
# 限制 agentic turns
claude --max-turns 5 -p "问题"

# 详细日志
claude --verbose -p "问题"

# 调试模式
claude --debug -p "问题"
```

## 环境变量配置

### 认证相关
```bash
# Anthropic API Token（必需）
export ANTHROPIC_AUTH_TOKEN="your_token_here"

# API Base URL（可选，用于自定义端点）
export ANTHROPIC_BASE_URL="https://api.anthropic.com"
```

### 终端环境
```bash
# 终端类型
export TERM=xterm-256color

# 颜色支持
export COLORTERM=truecolor

# 禁用颜色（在某些环境中有用）
export NO_COLOR=1
```

## 容器环境最佳实践

### 1. PTY 兼容性问题

**问题描述**：
- Claude Code CLI 在非交互式 PTY 环境中可能卡死
- 特别是使用 `--dangerously-skip-permissions` 参数时

**解决方案**：

#### 方案 A: 使用管道输入（推荐）
```bash
# 使用 echo 管道
echo "你的提示词" | claude -p

# 使用 printf 避免转义问题
printf "%s" "你的提示词" | claude -p

# 使用 heredoc
claude -p << EOF
你的多行
提示词
EOF
```

#### 方案 B: 使用临时文件
```bash
# 写入临时文件
echo "提示词" > /tmp/prompt.txt
cat /tmp/prompt.txt | claude -p
rm /tmp/prompt.txt
```

#### 方案 C: 使用 script 命令创建伪终端
```bash
script -qc "echo '提示词' | claude -p" /dev/null
```

### 2. Docker 容器配置

```dockerfile
# Dockerfile 示例
FROM node:22-alpine

# 安装必要工具
RUN apk add --no-cache bash

# 安装 Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# 设置环境变量
ENV ANTHROPIC_AUTH_TOKEN="your_token"
ENV TERM=dumb
ENV NO_COLOR=1

# 工作目录
WORKDIR /app
```

### 3. Node.js 集成示例

```javascript
// 使用 child_process 执行
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function executeClaude(prompt) {
  // 转义特殊字符
  const escapedPrompt = prompt
    .replace(/"/g, '\\"')
    .replace(/\$/g, '\\$')
    .replace(/`/g, '\\`');
  
  try {
    // 使用管道方式执行
    const { stdout, stderr } = await execPromise(
      `echo "${escapedPrompt}" | claude -p`,
      {
        env: {
          ...process.env,
          ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN,
          TERM: 'dumb',
          NO_COLOR: '1'
        },
        timeout: 30000
      }
    );
    
    return stdout;
  } catch (error) {
    console.error('Claude execution error:', error);
    throw error;
  }
}
```

### 4. Node-pty 集成注意事项

```javascript
// 创建 PTY 时的推荐配置
const pty = spawn(shell, [], {
  name: 'xterm-256color',
  cols: 120,
  rows: 30,
  cwd: process.cwd(),
  env: {
    ...process.env,
    ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN,
    TERM: 'dumb',        // 简化终端模式
    NO_COLOR: '1',       // 禁用颜色
    FORCE_COLOR: '0'     // 强制禁用颜色
  }
});

// 执行命令时避免交互式输入
pty.write('echo "prompt" | claude -p\r');
```

## 常见问题和解决方案

### 1. Claude 命令卡死
**原因**：等待交互式输入
**解决**：
- 使用 `-p` 参数强制非交互模式
- 使用管道输入而不是直接传递参数
- 设置 `TERM=dumb` 环境变量

### 2. 输出包含 ANSI 转义序列
**原因**：终端颜色支持
**解决**：
- 设置 `NO_COLOR=1`
- 使用 `--no-color` 参数（如果支持）
- 在输出后清理 ANSI 序列

### 3. 认证失败
**原因**：Token 未设置或无效
**解决**：
- 确保 `ANTHROPIC_AUTH_TOKEN` 环境变量正确设置
- 检查 Token 有效性
- 使用 `claude login <token>` 命令（交互式环境）

### 4. 权限被拒绝
**原因**：安全模式阻止操作
**解决**：
- 使用 `--dangerously-skip-permissions`（仅限自动化环境）
- 配置适当的 `--permission-mode`
- 使用 `--allowedTools` 明确指定允许的工具

## 更新和维护

```bash
# 检查版本
claude --version

# 更新到最新版本
claude update

# 或通过 npm
npm update -g @anthropic-ai/claude-code
```

## 安全建议

1. **生产环境**：
   - 不要使用 `--dangerously-skip-permissions`
   - 使用受限的工具集
   - 实施适当的权限控制

2. **Token 管理**：
   - 使用环境变量而不是硬编码
   - 定期轮换 Token
   - 使用密钥管理服务

3. **输入验证**：
   - 始终转义用户输入
   - 限制输入长度
   - 验证输入内容

## 总结

Claude Code CLI 在容器和 Web Terminal 环境中使用时，关键是：
1. 使用非交互式模式（`-p` 参数）
2. 通过管道传递输入
3. 正确配置环境变量
4. 处理 PTY 兼容性问题
5. 实施适当的错误处理和超时控制

这些实践可以确保 Claude Code 在自动化环境中稳定运行。