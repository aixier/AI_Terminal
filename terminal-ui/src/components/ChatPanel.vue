<template>
  <div class="chat-panel fluent-card-acrylic">
    <!-- 聊天头部 -->
    <div class="chat-header">
      <div class="chat-title">
        <el-icon class="chat-icon"><ChatDotRound /></el-icon>
        <span>AI 终端助手</span>
      </div>
      <div class="chat-controls">
        <FluentButton 
          variant="subtle" 
          size="small" 
          :icon="Delete"
          @click="clearChat"
        >
          清空
        </FluentButton>
      </div>
    </div>

    <!-- 聊天消息区域 -->
    <div class="chat-messages fluent-scrollbar" ref="messagesContainer">
      <div 
        v-for="(message, index) in messages" 
        :key="message.id" 
        class="message fluent-slide-up" 
        :class="`message-${message.role}`"
        :style="{ animationDelay: `${index * 0.1}s` }"
      >
        <FluentCard 
          class="message-card"
          :acrylic="message.role === 'assistant'"
          :depth="message.role === 'assistant' ? 4 : 2"
          padding="var(--fluent-space-md)"
        >
          <div class="message-header">
            <div class="avatar-wrapper">
              <el-avatar :size="36" class="message-avatar" :class="`avatar-${message.role}`">
                <el-icon v-if="message.role === 'user'"><User /></el-icon>
                <el-icon v-else><ChatDotRound /></el-icon>
              </el-avatar>
              <div class="avatar-glow" :class="`glow-${message.role}`"></div>
            </div>
            <div class="message-meta">
              <span class="message-author">{{ message.role === 'user' ? '用户' : 'Claude AI' }}</span>
              <span class="message-time">{{ formatTime(message.timestamp) }}</span>
            </div>
          </div>
          <div class="message-content">
            {{ message.content }}
          </div>
          <div v-if="message.command" class="message-command">
            <FluentCard class="command-card" acrylic :depth="8" padding="var(--fluent-space-md)">
              <div class="command-preview">
                <div class="command-code">
                  <el-icon class="command-icon"><Terminal /></el-icon>
                  <code>{{ message.command }}</code>
                </div>
                <FluentButton 
                  variant="primary" 
                  size="small"
                  :icon="Play"
                  @click="executeCommand(message.command)"
                  class="fluent-glow-hover"
                >
                  执行
                </FluentButton>
              </div>
            </FluentCard>
          </div>
        </FluentCard>
      </div>
      
      <div v-if="isTyping" class="typing-indicator fluent-fade-in">
        <FluentCard acrylic :depth="4" padding="var(--fluent-space-md)">
          <div class="typing-content">
            <div class="typing-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <span class="typing-text">Claude AI 正在思考...</span>
          </div>
        </FluentCard>
      </div>
    </div>
    
    <!-- 聊天输入区域 -->
    <div class="chat-input-area">
      <FluentCard class="input-card" acrylic :depth="4" padding="var(--fluent-space-md)">
        <div class="input-wrapper">
          <textarea
            v-model="inputMessage"
            class="chat-input"
            placeholder="用自然语言描述您想要执行的操作... (按 Ctrl+Enter 发送)"
            @keydown.ctrl.enter="sendMessage"
            :disabled="isTyping"
            rows="3"
            ref="chatInput"
          ></textarea>
          <div class="input-actions">
            <FluentButton 
              variant="primary" 
              :loading="isTyping"
              :disabled="!inputMessage.trim() || isTyping"
              @click="sendMessage"
              class="fluent-glow-hover"
            >
              <template #icon>
                <el-icon><Promotion /></el-icon>
              </template>
              {{ isTyping ? '思考中...' : '发送' }}
            </FluentButton>
          </div>
        </div>
      </FluentCard>
    </div>

    <!-- 提示信息 -->
    <div class="chat-tips">
      <FluentCard class="tips-card" acrylic :depth="2" padding="var(--fluent-space-sm)">
        <div class="tips-content">
          <el-icon class="tips-icon"><InfoFilled /></el-icon>
          <span>您可以用自然语言描述想要执行的操作，Claude AI 会帮您转换成相应的终端命令</span>
        </div>
      </FluentCard>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useTerminalStore } from '../store/terminal'
import websocket from '../services/websocket'
import request from '../api/config'
import FluentCard from './FluentCard.vue'
import FluentButton from './FluentButton.vue'
import { 
  User, ChatDotRound, Delete, Promotion, 
  Monitor as Terminal, VideoPlay as Play, InfoFilled, Loading 
} from '@element-plus/icons-vue'

const terminalStore = useTerminalStore()
const messagesContainer = ref(null)
const chatInput = ref(null)
const inputMessage = ref('')
const isTyping = ref(false)

// 自动聚焦输入框
onMounted(() => {
  if (chatInput.value) {
    chatInput.value.focus()
  }
})
const messages = ref([
  {
    id: 1,
    role: 'assistant',
    content: '您好！我是AI终端助手。请告诉我您想要执行什么操作，我会帮您生成相应的命令。',
    timestamp: new Date().toISOString()
  }
])

// 监听消息变化，自动滚动到底部
watch(messages, () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}, { deep: true })

const sendMessage = async () => {
  const content = inputMessage.value.trim()
  if (!content || isTyping.value) {
    return
  }

  // 添加用户消息
  const userMessage = {
    id: Date.now(),
    role: 'user',
    content,
    timestamp: new Date().toISOString()
  }
  messages.value.push(userMessage)
  inputMessage.value = ''

  // 显示加载状态
  isTyping.value = true

  try {
    // 调用Claude Code API
    const response = await request.post('/claude/parse', { input: content })
    
    if (response.data.success) {
      const aiMessage = {
        id: Date.now(),
        role: 'assistant',
        content: `${response.data.explanation}\n我建议执行以下命令：`,
        command: response.data.command,
        timestamp: new Date().toISOString()
      }
      messages.value.push(aiMessage)
    } else {
      const aiMessage = {
        id: Date.now(),
        role: 'assistant',
        content: response.data.message || '抱歉，我无法理解您的需求。',
        suggestions: response.data.suggestions,
        timestamp: new Date().toISOString()
      }
      messages.value.push(aiMessage)
    }
  } catch (error) {
    ElMessage.error('AI服务暂时不可用')
    const errorMessage = {
      id: Date.now(),
      role: 'assistant',
      content: '抱歉，服务暂时不可用。请稍后再试。',
      timestamp: new Date().toISOString()
    }
    messages.value.push(errorMessage)
  } finally {
    isTyping.value = false
  }
}

const simulateAIResponse = async (userInput) => {
  // 模拟延迟
  await new Promise(resolve => setTimeout(resolve, 1500))

  // 简单的命令匹配逻辑
  let response = ''
  let command = ''

  if (userInput.includes('列出文件') || userInput.includes('查看文件')) {
    response = '我理解您想要查看当前目录的文件。我将为您执行ls命令。'
    command = 'ls -la'
  } else if (userInput.includes('创建目录') || userInput.includes('新建文件夹')) {
    const match = userInput.match(/["""'](.+?)["""']/)
    const dirName = match ? match[1] : 'new_folder'
    response = `我将为您创建名为"${dirName}"的目录。`
    command = `mkdir ${dirName}`
  } else if (userInput.includes('查看进程')) {
    response = '我将为您显示当前运行的进程。'
    command = 'ps aux'
  } else if (userInput.includes('网络') && userInput.includes('测试')) {
    response = '我将为您进行网络连通性测试。'
    command = 'ping -c 4 baidu.com'
  } else {
    response = '抱歉，我还不太理解您的需求。您可以尝试更具体地描述，例如："列出当前目录的文件"或"创建一个名为test的文件夹"。'
  }

  // 添加AI响应
  const aiMessage = {
    id: Date.now(),
    role: 'assistant',
    content: response,
    command: command,
    timestamp: new Date().toISOString()
  }
  messages.value.push(aiMessage)
}

const executeCommand = (command) => {
  if (!command) return

  // 切换到终端标签
  const event = new CustomEvent('switch-to-terminal', { detail: { command } })
  window.dispatchEvent(event)
  
  // 执行命令
  terminalStore.addOutputLog({
    type: 'command',
    data: `$ ${command}`
  })
  websocket.sendInput(command + '\n')
  
  ElMessage.success('命令已发送到终端')
}

const clearChat = () => {
  messages.value = [{
    id: Date.now(),
    role: 'assistant',
    content: '对话已清空。有什么我可以帮助您的吗？',
    timestamp: new Date().toISOString()
  }]
}

const formatTime = (timestamp) => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', { 
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<style scoped>
/* 聊天面板 - Fluent Design 风格 */
.chat-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, 
    rgba(255, 255, 255, 0.95) 0%, 
    rgba(248, 249, 250, 0.95) 100%
  );
  backdrop-filter: blur(60px) saturate(150%);
  -webkit-backdrop-filter: blur(60px) saturate(150%);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: var(--fluent-radius-large);
  overflow: hidden;
  box-shadow: var(--fluent-depth-16);
  position: relative;
}

.chat-panel::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, 
    transparent 0%, 
    rgba(0, 120, 212, 0.5) 50%, 
    transparent 100%
  );
}

/* 聊天头部 */
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--fluent-space-md) var(--fluent-space-lg);
  background: rgba(255, 255, 255, 0.1);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(20px);
}

.chat-title {
  display: flex;
  align-items: center;
  gap: var(--fluent-space-sm);
  color: var(--fluent-neutral-primary);
  font-weight: 600;
  font-size: var(--fluent-font-size-md);
}

.chat-icon {
  color: var(--fluent-blue);
  font-size: 18px;
}

.chat-controls {
  display: flex;
  gap: var(--fluent-space-xs);
}

/* 聊天消息区域 */
.chat-messages {
  flex: 1;
  padding: var(--fluent-space-lg);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--fluent-space-md);
}

.message {
  max-width: 85%;
  transition: transform var(--fluent-duration-normal) var(--fluent-easing);
}

.message:hover {
  transform: translateY(-2px);
}

.message-user {
  align-self: flex-end;
}

.message-assistant {
  align-self: flex-start;
}

/* 消息卡片 */
.message-card {
  transition: all var(--fluent-duration-normal) var(--fluent-easing);
  position: relative;
  overflow: visible;
}

.message-card:hover {
  transform: translateY(-1px);
  box-shadow: var(--fluent-depth-16);
}

/* 消息头部 */
.message-header {
  display: flex;
  align-items: center;
  gap: var(--fluent-space-sm);
  margin-bottom: var(--fluent-space-sm);
}

.avatar-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.message-avatar {
  position: relative;
  z-index: 2;
  box-shadow: var(--fluent-depth-4);
  transition: all var(--fluent-duration-normal) var(--fluent-easing);
}

.avatar-user {
  background: linear-gradient(135deg, var(--fluent-blue) 0%, var(--fluent-blue-light) 100%);
  color: var(--fluent-neutral-white);
}

.avatar-assistant {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: var(--fluent-neutral-white);
}

.avatar-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 50px;
  height: 50px;
  border-radius: 50%;
  opacity: 0;
  transition: opacity var(--fluent-duration-normal) var(--fluent-easing);
  pointer-events: none;
}

.message:hover .avatar-glow {
  opacity: 0.3;
  animation: avatarPulse 2s ease-in-out infinite;
}

.glow-user {
  background: radial-gradient(circle, rgba(0, 120, 212, 0.4) 0%, transparent 70%);
}

.glow-assistant {
  background: radial-gradient(circle, rgba(139, 92, 246, 0.4) 0%, transparent 70%);
}

@keyframes avatarPulse {
  0%, 100% { transform: translate(-50%, -50%) scale(1); }
  50% { transform: translate(-50%, -50%) scale(1.1); }
}

.message-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.message-author {
  font-weight: 600;
  color: var(--fluent-neutral-primary);
  font-size: var(--fluent-font-size-sm);
}

.message-time {
  font-size: var(--fluent-font-size-xs);
  color: var(--fluent-neutral-tertiary);
  opacity: 0.8;
}

/* 消息内容 */
.message-content {
  color: var(--fluent-neutral-secondary);
  line-height: 1.6;
  font-size: var(--fluent-font-size-md);
  margin-bottom: var(--fluent-space-sm);
}

/* 命令预览 */
.message-command {
  margin-top: var(--fluent-space-md);
}

.command-card {
  transition: all var(--fluent-duration-normal) var(--fluent-easing);
  border: 1px solid rgba(0, 120, 212, 0.2);
}

.command-card:hover {
  border-color: rgba(0, 120, 212, 0.4);
  transform: translateY(-1px);
}

.command-preview {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--fluent-space-md);
}

.command-code {
  display: flex;
  align-items: center;
  gap: var(--fluent-space-sm);
  flex: 1;
  background: rgba(30, 30, 30, 0.05);
  padding: var(--fluent-space-sm) var(--fluent-space-md);
  border-radius: var(--fluent-radius-medium);
  border: 1px solid rgba(0, 120, 212, 0.1);
}

.command-icon {
  color: var(--fluent-blue);
  font-size: 16px;
}

.command-code code {
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: var(--fluent-font-size-sm);
  color: var(--fluent-neutral-primary);
  background: none;
  font-weight: 500;
}

/* 输入指示器 */
.typing-indicator {
  align-self: flex-start;
  max-width: 200px;
}

.typing-content {
  display: flex;
  align-items: center;
  gap: var(--fluent-space-md);
}

.typing-dots {
  display: flex;
  gap: 4px;
}

.typing-dots span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--fluent-blue);
  animation: typingDots 1.4s ease-in-out infinite;
}

.typing-dots span:nth-child(1) { animation-delay: 0s; }
.typing-dots span:nth-child(2) { animation-delay: 0.2s; }
.typing-dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes typingDots {
  0%, 60%, 100% {
    transform: scale(1);
    opacity: 0.7;
  }
  30% {
    transform: scale(1.2);
    opacity: 1;
  }
}

.typing-text {
  color: var(--fluent-neutral-secondary);
  font-size: var(--fluent-font-size-sm);
  font-style: italic;
}

/* 聊天输入区域 */
.chat-input-area {
  padding: var(--fluent-space-lg);
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
}

.input-card {
  transition: all var(--fluent-duration-normal) var(--fluent-easing);
}

.input-card:focus-within {
  transform: translateY(-2px);
  box-shadow: var(--fluent-depth-16);
}

.input-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--fluent-space-md);
}

.chat-input {
  width: 100%;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: var(--fluent-radius-medium);
  padding: var(--fluent-space-md);
  font-family: var(--fluent-font-family);
  font-size: var(--fluent-font-size-md);
  color: var(--fluent-neutral-primary);
  resize: none;
  transition: all var(--fluent-duration-normal) var(--fluent-easing);
  backdrop-filter: blur(10px);
}

.chat-input:focus {
  outline: none;
  border-color: var(--fluent-blue);
  box-shadow: 0 0 0 2px rgba(0, 120, 212, 0.2), var(--fluent-depth-4);
  background: rgba(255, 255, 255, 0.95);
}

.chat-input::placeholder {
  color: var(--fluent-neutral-tertiary);
  opacity: 0.8;
}

.chat-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.input-actions {
  display: flex;
  justify-content: flex-end;
}

/* 提示区域 */
.chat-tips {
  padding: 0 var(--fluent-space-lg) var(--fluent-space-lg);
}

.tips-card {
  border: 1px solid rgba(0, 120, 212, 0.2);
  background: rgba(0, 120, 212, 0.05);
}

.tips-content {
  display: flex;
  align-items: center;
  gap: var(--fluent-space-sm);
  color: var(--fluent-neutral-secondary);
  font-size: var(--fluent-font-size-sm);
}

.tips-icon {
  color: var(--fluent-blue);
  font-size: 16px;
  flex-shrink: 0;
}

/* 滚动条样式 - Fluent Design */
.chat-messages::-webkit-scrollbar {
  width: 12px;
}

.chat-messages::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: var(--fluent-radius-medium);
}

.chat-messages::-webkit-scrollbar-thumb {
  background: rgba(0, 120, 212, 0.3);
  border-radius: var(--fluent-radius-medium);
  border: 2px solid transparent;
  background-clip: content-box;
}

.chat-messages::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 120, 212, 0.5);
  background-clip: content-box;
}

/* PC端优化 */
@media (min-width: 1024px) {
  .chat-messages {
    padding: var(--fluent-space-xl);
  }
  
  .chat-input-area {
    padding: var(--fluent-space-xl);
  }
  
  .message {
    max-width: 80%;
  }
  
  .chat-input {
    font-size: var(--fluent-font-size-md);
  }
}

/* 高对比度模式 */
@media (prefers-contrast: high) {
  .chat-panel {
    border: 2px solid var(--fluent-blue);
  }
  
  .message-card {
    border: 1px solid var(--fluent-neutral-tertiary);
  }
  
  .chat-input:focus {
    border-width: 2px;
  }
}

/* 减少动画模式 */
@media (prefers-reduced-motion: reduce) {
  .chat-panel *,
  .chat-panel *::before,
  .chat-panel *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* 响应式调整 */
@media (max-width: 768px) {
  .message {
    max-width: 95%;
  }
  
  .command-preview {
    flex-direction: column;
    align-items: stretch;
    gap: var(--fluent-space-sm);
  }
  
  .chat-input-area {
    padding: var(--fluent-space-md);
  }
}
</style>