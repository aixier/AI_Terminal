<template>
  <div class="message-list-view" :class="{ mobile: isMobile }">
    <!-- 清除聊天记录按钮（右上角） -->
    <div class="clear-chat-container">
      <button 
        class="clear-chat-btn"
        @click="handleClearChat"
        :disabled="messages.length === 0"
        title="清除聊天记录"
      >
        🗑️ 清空
      </button>
    </div>
    
    <!-- 消息列表滚动区域 -->
    <div class="messages-container" ref="messagesContainer">
      <div 
        v-for="message in messages" 
        :key="message.id"
        class="message-item"
        :class="message.type"
      >
        <!-- 用户消息 -->
        <div v-if="message.type === 'user'" class="user-message">
          <div class="message-bubble user-bubble">
            {{ message.content }}
          </div>
          <div class="message-time">{{ formatMessageTime(message.timestamp) }}</div>
        </div>
        
        <!-- AI响应 -->
        <div v-else class="ai-message">
          <div class="ai-avatar">🤖</div>
          <div class="ai-response">
            <!-- 生成中状态 -->
            <div v-if="message.isGenerating" class="generating-message">
              <div class="typing-indicator">
                <span></span><span></span><span></span>
              </div>
              <div class="generating-text">AI正在创作中...</div>
            </div>
            <!-- 错误消息 -->
            <div v-else-if="message.error" class="error-card">
              <div class="error-header">
                <span class="error-icon">⚠️</span>
                <span class="error-title">生成失败</span>
              </div>
              <div class="error-content">
                {{ message.content }}
              </div>
              <button class="retry-btn" @click="$emit('retry-generation', message)">
                🔄 重试
              </button>
            </div>
            <!-- 生成完成的卡片 -->
            <div v-else class="result-card">
              <!-- 自定义模式消息 -->
              <template v-if="isCustomMode(message)">
                <div class="card-header">
                  <span class="card-icon">📁</span>
                  <span class="card-title">{{ message.title || '文件生成' }}</span>
                  <span class="file-count">{{ getFileCount(message) }} 个文件</span>
                </div>
                <div class="custom-files-list">
                  <div v-for="(file, index) in getMessageFiles(message)" :key="index" class="file-item">
                    <span class="file-icon">{{ getFileIcon(file.fileType) }}</span>
                    <span class="file-name">{{ file.fileName }}</span>
                    <span class="file-size">{{ formatFileSize(file.size) }}</span>
                  </div>
                  <div v-if="message.resultData?.mayHaveMore" class="generating-hint">
                    <span class="hint-icon">💡</span>
                    <span>Claude 可能还在生成更多文件...</span>
                  </div>
                </div>
                <div class="card-actions">
                  <button 
                    class="card-btn refresh-btn" 
                    @click="handleRefreshFiles(message)"
                    :class="{ refreshing: message.isRefreshing }"
                  >
                    {{ message.isRefreshing ? '⏳ 检查中' : '🔄 刷新文件' }}
                  </button>
                  <button class="card-btn primary" @click="$emit('preview-content', message)">
                    👁️ 查看
                  </button>
                </div>
              </template>
              <!-- HTML类型消息使用HtmlMessageCard渲染 -->
              <HtmlMessageCard 
                v-else-if="isHtmlMessage(message)"
                :result-data="message.resultData || message"
                :html-content="getMessageHtmlContent(message)"
                :topic="getMessageTopic(message)"
                :timestamp="message.timestamp"
                @copy="handleCopy"
                @download="handleDownload"
                @fullscreen="handleFullscreen"
              />
              <!-- 其他类型消息使用原有渲染方式 -->
              <template v-else>
                <div class="card-header">
                  <span class="card-icon">{{ getTemplateIcon(message.template) }}</span>
                  <span class="card-title">{{ message.title || '生成结果' }}</span>
                </div>
                <div class="card-preview">
                  {{ typeof message.content === 'string' ? message.content.substring(0, 100) + '...' : '' }}
                </div>
                <div class="card-actions">
                  <button class="card-btn primary" @click="$emit('preview-content', message)">
                    👁️ 预览
                  </button>
                  <button class="card-btn" @click="$emit('save-content', message)">
                    💾 保存
                  </button>
                  <button v-if="!isMobile" class="card-btn" @click="$emit('share-content', message)">
                    🔗 分享
                  </button>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 空状态提示 -->
      <div v-if="messages.length === 0" class="empty-state">
        <div class="empty-icon">💬</div>
        <div class="empty-text">{{ isMobile ? '开始你的AI创作之旅' : '开始创作' }}</div>
        <div v-if="isMobile" class="empty-hint">选择一个模板或直接输入你的需求</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits, ref, nextTick, watch, onMounted, onUpdated } from 'vue'
import HtmlMessageCard from '../messages/HtmlMessageCard.vue'

const props = defineProps({
  messages: {
    type: Array,
    default: () => []
  },
  isMobile: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'retry-generation',
  'refresh-files',
  'preview-content',
  'save-content',
  'share-content',
  'clear-chat'
])

const messagesContainer = ref(null)

// 格式化消息时间
const formatMessageTime = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', { 
    hour: '2-digit', 
    minute: '2-digit' 
  })
}

// 获取模板图标
const getTemplateIcon = (template) => {
  if (!template) return '📄'
  // 根据模板类型返回不同图标
  const iconMap = {
    'blog': '📝',
    'card': '🎴',
    'report': '📊',
    'story': '📚',
    'default': '📄'
  }
  return iconMap[template] || iconMap.default
}

// 判断是否为自定义模式消息
const isCustomMode = (message) => {
  return message.resultData?.mode === 'custom'
}

// 获取消息文件列表
const getMessageFiles = (message) => {
  return message.resultData?.files || []
}

// 获取文件数量
const getFileCount = (message) => {
  return message.resultData?.totalFiles || 0
}

// 获取文件图标
const getFileIcon = (fileType) => {
  const iconMap = {
    'html': '🌐',
    'json': '📋',
    'markdown': '📝',
    'text': '📄',
    'image': '🖼️',
    'pdf': '📑',
    'javascript': '📜',
    'css': '🎨',
    'python': '🐍',
    'excel': '📊',
    'video': '🎬',
    'audio': '🎵'
  }
  return iconMap[fileType] || '📄'
}

// 格式化文件大小
const formatFileSize = (size) => {
  if (!size) return ''
  if (size < 1024) return size + ' B'
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB'
  return (size / 1024 / 1024).toFixed(1) + ' MB'
}

// 处理刷新文件
const handleRefreshFiles = (message) => {
  emit('refresh-files', message)
}

// 自动滚动到底部
const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      // 获取最后一条消息
      const messages = messagesContainer.value.querySelectorAll('.message-item')
      const lastMessage = messages[messages.length - 1]
      
      if (lastMessage) {
        // 使用 scrollIntoView 确保消息可见，但不过度滚动
        // 使用 'nearest' 而不是 'end'，避免内容被截断
        lastMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        
        // 检查并微调滚动位置
        setTimeout(() => {
          const containerHeight = messagesContainer.value.clientHeight
          const messageTop = lastMessage.offsetTop
          const messageBottom = lastMessage.offsetTop + lastMessage.offsetHeight
          const currentScroll = messagesContainer.value.scrollTop
          const visibleBottom = currentScroll + containerHeight
          
          // 如果消息底部没有完全显示，温和地调整滚动
          if (messageBottom > visibleBottom - 80) { // 留80px缓冲区
            // 滚动到能看到完整消息的位置
            const targetScroll = messageBottom - containerHeight + 100 // 100px底部缓冲
            messagesContainer.value.scrollTop = Math.max(0, targetScroll)
          }
        }, 400) // 等待内容渲染
      } else {
        // 备用方案：直接设置scrollTop
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
      }
    }
  })
}

// 监听消息变化，自动滚动到底部
watch(() => props.messages, (newMessages, oldMessages) => {
  // 只在有新消息添加时滚动（而不是每次更新）
  if (newMessages.length > (oldMessages?.length || 0)) {
    // 延迟执行，确保DOM更新完成
    setTimeout(scrollToBottom, 100)
  }
}, { deep: true })

// 组件挂载时滚动到底部
onMounted(() => {
  scrollToBottom()
})

// 组件更新后也尝试滚动（用于处理异步内容加载）
onUpdated(() => {
  // 检查是否有生成中的消息
  const hasGenerating = props.messages.some(msg => msg.isGenerating)
  if (hasGenerating || props.messages.length > 0) {
    scrollToBottom()
  }
})

// 判断是否为HTML消息
const isHtmlMessage = (message) => {
  // 检查消息是否包含HTML内容
  if (message.resultData) {
    // 1. 有HTML内容
    if (message.resultData.content) {
      return true
    }
    // 2. 有HTML文件列表（恢复的消息可能只有文件列表）
    if (message.resultData.allFiles && 
        message.resultData.allFiles.some(file => file.fileType === 'html')) {
      return true
    }
    // 3. 类型为html
    if (message.resultData.type === 'html') {
      return true
    }
  }
  if (message.content && typeof message.content === 'string' && 
      (message.content.includes('<html') || message.content.includes('<!DOCTYPE'))) {
    return true // 直接HTML内容
  }
  return false
}

// 获取消息的HTML内容
const getMessageHtmlContent = (message) => {
  if (message.resultData && message.resultData.content) {
    if (typeof message.resultData.content === 'object' && message.resultData.content.html) {
      return message.resultData.content.html
    }
    if (typeof message.resultData.content === 'string') {
      return message.resultData.content
    }
  }
  return message.content || ''
}

// 获取消息主题
const getMessageTopic = (message) => {
  if (message.resultData && message.resultData.topic) {
    return message.resultData.topic
  }
  return message.title || message.topic || ''
}

// 处理复制事件
const handleCopy = (content) => {
  console.log('Content copied:', content)
}

// 处理下载事件
const handleDownload = (fileName) => {
  console.log('Content downloaded:', fileName)
}

// 处理全屏事件
const handleFullscreen = () => {
  console.log('Fullscreen activated')
}

// 处理清除聊天记录
const handleClearChat = () => {
  if (props.messages.length === 0) return
  
  if (confirm('确定要清除所有聊天记录吗？此操作不可撤销。')) {
    emit('clear-chat')
  }
}

// 组件挂载后滚动到底部
nextTick(() => {
  scrollToBottom()
})
</script>

<style scoped>
.message-list-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

/* 移动端允许更自由的滚动 */
.message-list-view.mobile {
  overflow: visible; /* 移动端不限制overflow */
}

/* 清除聊天记录按钮容器 */
.clear-chat-container {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 100;
}

.clear-chat-btn {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 12px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
  backdrop-filter: blur(10px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.clear-chat-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 1);
  border-color: #dc3545;
  color: #dc3545;
  transform: translateY(-1px);
}

.clear-chat-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px 20px 100px 20px; /* 底部增加更多内边距 */
  scroll-behavior: smooth;
  min-height: 100%; /* 确保容器至少占满父元素高度 */
  position: relative; /* 添加相对定位 */
}

/* 移动端样式 */
.message-list-view.mobile .messages-container {
  padding: 16px 12px 180px 12px; /* 适度的底部空间，避免过度 */
  min-height: 100%; /* 至少占满容器高度 */
  /* 不设置超出视口的min-height，让内容自然撑开 */
}

/* 在消息容器底部添加额外的空白区域，确保最后消息可见 */
.message-list-view.mobile .messages-container::after {
  content: '';
  display: block;
  height: 60px; /* 适度的底部缓冲空间 */
  width: 100%;
}

.message-item {
  margin-bottom: 24px;
}

/* 用户消息样式 */
.user-message {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  margin-bottom: 16px;
}

.user-bubble {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 12px 16px;
  border-radius: 18px 18px 4px 18px;
  max-width: 70%;
  word-wrap: break-word;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
}

.message-time {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
  padding: 0 8px;
}

/* AI消息样式 */
.ai-message {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
}

.ai-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
}

.ai-response {
  flex: 1;
  max-width: 80%;
}

/* 移除ai-response内部div之间的间距 */
.ai-response > div {
  margin: 0;
}

.ai-response > div + div {
  margin-top: 0;
}

/* 生成中状态 */
.generating-message {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.typing-indicator {
  display: flex;
  gap: 4px;
}

.typing-indicator span {
  width: 8px;
  height: 8px;
  background: #667eea;
  border-radius: 50%;
  animation: typing 1.4s infinite;
}

.typing-indicator span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-indicator span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%, 60%, 100% {
    transform: translateY(0);
  }
  30% {
    transform: translateY(-10px);
  }
}

.generating-text {
  color: #666;
  font-size: 14px;
}

/* 错误卡片 */
.error-card {
  background: #fff5f5;
  border: 1px solid #fed7d7;
  border-radius: 12px;
  padding: 16px;
}

.error-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.error-icon {
  font-size: 18px;
}

.error-title {
  font-weight: 600;
  color: #e53e3e;
}

.error-content {
  color: #666;
  margin-bottom: 12px;
  line-height: 1.5;
}

.retry-btn {
  background: #e53e3e;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.retry-btn:hover {
  background: #c53030;
}

/* 结果卡片 */
.result-card {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

/* 当result-card包含HtmlMessageCard时，移除padding避免双重边距 */
.result-card:has(.message-card) {
  padding: 0;
  border: none;
  box-shadow: none;
  background: transparent;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.card-icon {
  font-size: 18px;
}

.card-title {
  font-weight: 600;
  color: #333;
}

.card-preview {
  color: #666;
  line-height: 1.5;
  margin-bottom: 12px;
  font-size: 14px;
}

.card-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.card-btn {
  padding: 6px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  background: white;
  color: #333;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 4px;
}

.card-btn:hover {
  border-color: #667eea;
  color: #667eea;
}

.card-btn.primary {
  background: #667eea;
  border-color: #667eea;
  color: white;
}

.card-btn.primary:hover {
  background: #5a67d8;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh; /* 增加空状态高度，提供更多滚动空间 */
  color: #999;
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.empty-text {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 4px;
}

.empty-hint {
  font-size: 14px;
  opacity: 0.8;
}

/* 移动端适配 */
.message-list-view.mobile .user-bubble {
  max-width: 85%;
}

.message-list-view.mobile .ai-response {
  max-width: 85%;
}

.message-list-view.mobile .card-actions {
  gap: 6px;
}

.message-list-view.mobile .card-btn {
  font-size: 11px;
  padding: 5px 10px;
}

/* iOS Safari 兼容性修复 */
@supports (-webkit-touch-callout: none) {
  .messages-container {
    -webkit-overflow-scrolling: touch;
    overflow-scrolling: touch;
  }
  
  .result-card {
    -webkit-transform: translateZ(0);
    transform: translateZ(0);
  }
  
  /* 修复iOS上的卡片显示问题 */
  .message-list-view.mobile .result-card {
    width: 100%;
    box-sizing: border-box;
  }
}

/* 自定义模式文件列表样式 */
.file-count {
  background: #e3f2fd;
  color: #1976d2;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  margin-left: 8px;
}

.custom-files-list {
  margin: 12px 0;
  max-height: 200px;
  overflow-y: auto;
}

.file-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: #f8f9fa;
  border-radius: 6px;
  margin-bottom: 6px;
  transition: background 0.2s;
}

.file-item:hover {
  background: #e9ecef;
}

.file-icon {
  font-size: 18px;
  margin-right: 8px;
}

.file-name {
  flex: 1;
  font-size: 13px;
  font-family: monospace;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  font-size: 11px;
  color: #666;
  margin-left: 8px;
}

.generating-hint {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: #fff3cd;
  border-radius: 6px;
  margin-top: 8px;
  font-size: 12px;
  color: #856404;
}

.hint-icon {
  margin-right: 6px;
}

.refresh-btn.refreshing {
  animation: spin 1s linear infinite;
  opacity: 0.7;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>