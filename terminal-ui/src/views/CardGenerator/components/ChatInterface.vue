<template>
  <div class="chat-interface">
    <!-- 聊天历史区域 -->
    <div class="chat-history" ref="chatContainer">
      <div 
        v-for="message in messages" 
        :key="message.id"
        class="chat-message"
        :class="`message-${message.type}`"
      >
        <!-- 用户消息 -->
        <div v-if="message.type === 'user'" class="user-message">
          <div class="message-bubble user-bubble">
            <div class="message-content">{{ message.content }}</div>
            <div v-if="message.template !== null" class="message-template">
              使用模板: {{ getTemplateName(message.template) }}
            </div>
          </div>
          <div class="message-time">{{ formatTime(message.timestamp) }}</div>
        </div>
        
        <!-- AI响应消息 -->
        <div v-else-if="message.type === 'ai'" class="ai-message">
          <div class="ai-avatar">🤖</div>
          <div class="ai-content">
            <!-- 生成中状态 -->
            <div v-if="message.isGenerating" class="generating-card">
              <div class="generating-header">
                <span class="generating-icon">✨</span>
                <span class="generating-text">AI创作中...</span>
              </div>
              <div v-if="message.content" class="generating-preview">
                <pre>{{ message.content }}</pre>
              </div>
              <div class="generating-progress">
                <div class="progress-bar">
                  <div class="progress-fill" :style="{ width: '60%' }"></div>
                </div>
              </div>
            </div>
            
            <!-- 生成完成 - HTML结果 -->
            <div v-else-if="message.resultData" class="result-card">
              <div class="result-header">
                <span class="result-icon">📄</span>
                <span class="result-title">{{ message.title || '生成完成' }}</span>
                <span class="result-type">{{ message.resultData.type || 'HTML' }}</span>
              </div>
              
              <!-- 使用HTML消息卡片组件 -->
              <HtmlMessageCard
                v-if="message.resultData.type === 'html' || message.resultData.content"
                :html-content="message.resultData.content || message.content"
                :file-name="message.resultData.fileName || 'generated.html'"
                :timestamp="message.timestamp"
                @copy="handleCopy"
                @download="handleDownload"
                @fullscreen="handleFullscreen"
              />
              
              <!-- 其他类型结果的后备显示 -->
              <div v-else class="result-content">
                <pre>{{ message.content }}</pre>
              </div>
              
              <div class="result-actions">
                <button 
                  v-if="message.resultData.fileName"
                  @click="$emit('open-file', message.resultData)"
                  class="action-btn"
                >
                  <span>📂</span> 打开文件
                </button>
                <!-- 自定义模式下的刷新按钮 -->
                <button 
                  v-if="message.resultData.mode === 'custom' && message.resultData.folderName"
                  @click="$emit('refresh-files', message)"
                  class="action-btn"
                  :class="{ refreshing: message.isRefreshing }"
                >
                  <span>{{ message.isRefreshing ? '⏳' : '🔄' }}</span> 
                  {{ message.isRefreshing ? '检查中' : '刷新文件' }}
                </button>
                <button 
                  @click="$emit('retry', message)"
                  class="action-btn"
                >
                  <span>🔄</span> 重新生成
                </button>
              </div>
            </div>
            
            <!-- 错误状态 -->
            <div v-else-if="message.error" class="error-card">
              <div class="error-header">
                <span class="error-icon">⚠️</span>
                <span class="error-text">生成失败</span>
              </div>
              <div class="error-content">{{ message.content || '生成过程中出现错误' }}</div>
              <button @click="$emit('retry', message)" class="retry-btn">
                重试
              </button>
            </div>
            
            <!-- 普通文本消息 -->
            <div v-else class="text-card">
              {{ message.content }}
            </div>
          </div>
          <div class="message-time">{{ formatTime(message.timestamp) }}</div>
        </div>
      </div>
      
      <!-- 空状态提示 -->
      <div v-if="messages.length === 0" class="chat-empty-state">
        <div class="empty-icon">💬</div>
        <div class="empty-text">开始你的AI创作之旅</div>
        <div class="empty-hint">选择模板或直接输入需求</div>
      </div>
    </div>
    
    <!-- 输入区域 -->
    <div class="chat-input-area">
      <!-- 快捷模板按钮 -->
      <div class="quick-templates" v-if="templates && templates.length > 0">
        <button 
          v-for="(template, index) in quickTemplates"
          :key="index"
          class="template-btn"
          :class="{ active: selectedTemplate === index }"
          @click="handleTemplateClick(index)"
        >
          {{ template.icon }} {{ template.name }}
        </button>
      </div>
      
      <!-- 输入框 -->
      <div class="input-container">
        <textarea
          v-model="inputText"
          class="chat-input"
          :placeholder="placeholder"
          @keydown.enter.prevent="handleSend"
          @input="$emit('update:modelValue', inputText)"
          :disabled="disabled"
          rows="3"
        ></textarea>
        
        <div class="input-actions">
          <div class="char-count">
            {{ inputText.length }}/2000
          </div>
          <button 
            class="send-btn"
            :class="{ disabled: !canSend }"
            @click="handleSend"
            :disabled="!canSend"
          >
            <span v-if="isGenerating">⏸️ 停止</span>
            <span v-else>✈️ 发送</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import HtmlMessageCard from '../messages/HtmlMessageCard.vue'

const props = defineProps({
  messages: {
    type: Array,
    default: () => []
  },
  modelValue: {
    type: String,
    default: ''
  },
  templates: {
    type: Array,
    default: () => []
  },
  selectedTemplate: {
    type: Number,
    default: null
  },
  isGenerating: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  },
  placeholder: {
    type: String,
    default: '描述你的创作需求...'
  }
})

const emit = defineEmits([
  'send',
  'update:modelValue',
  'select-template',
  'retry',
  'open-file',
  'refresh-files',
  'clear-history'
])

const chatContainer = ref(null)
const inputText = ref(props.modelValue)

// 提取模板名称中的第一个英文单词
const extractFirstEnglishWord = (name) => {
  // 匹配第一个英文单词（连续的英文字母）
  const match = name.match(/[a-zA-Z]+/)
  if (match) {
    // 返回首字母大写的英文单词
    return match[0].charAt(0).toUpperCase() + match[0].slice(1).toLowerCase()
  }
  // 如果没有英文，返回原名称的前4个字符
  return name.slice(0, 4)
}

// 计算快捷模板（取前4个）
const quickTemplates = computed(() => {
  return props.templates.slice(0, 4).map(t => ({
    name: extractFirstEnglishWord(t.name),
    icon: getTemplateIcon(t.name),
    fullName: t.name
  }))
})

// 计算是否可以发送
const canSend = computed(() => {
  return inputText.value.trim().length > 0 && !props.isGenerating && !props.disabled
})

// 获取模板名称
const getTemplateName = (templateIndex) => {
  if (templateIndex === null || !props.templates[templateIndex]) {
    return '默认模板'
  }
  return props.templates[templateIndex].name
}

// 获取模板图标
const getTemplateIcon = (templateName) => {
  const name = templateName.toLowerCase()
  if (name.includes('报告')) return '📊'
  if (name.includes('方案')) return '📋'
  if (name.includes('总结')) return '📝'
  if (name.includes('文章')) return '✍️'
  if (name.includes('代码')) return '💻'
  if (name.includes('邮件')) return '📧'
  return '📄'
}

// 格式化时间
const formatTime = (timestamp) => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 处理模板点击
const handleTemplateClick = (index) => {
  emit('select-template', index)
  // 可以在输入框添加提示
  if (quickTemplates.value[index]) {
    const template = quickTemplates.value[index]
    if (!inputText.value) {
      inputText.value = `帮我写一份${template.fullName || template.name}`
    }
  }
}

// 处理发送
const handleSend = () => {
  if (!canSend.value) return
  
  emit('send', inputText.value.trim())
  inputText.value = ''
}

// 处理复制
const handleCopy = (content) => {
  console.log('Copy content:', content)
}

// 处理下载
const handleDownload = (fileName) => {
  console.log('Download file:', fileName)
}

// 处理全屏
const handleFullscreen = () => {
  console.log('Fullscreen mode')
}

// 滚动到底部
const scrollToBottom = () => {
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight
    }
  })
}

// 监听消息变化，自动滚动
watch(() => props.messages, () => {
  scrollToBottom()
}, { deep: true })

// 监听外部输入值变化
watch(() => props.modelValue, (newVal) => {
  inputText.value = newVal
})

// 监听内部输入值变化
watch(inputText, (newVal) => {
  emit('update:modelValue', newVal)
})

onMounted(() => {
  scrollToBottom()
})

defineExpose({
  scrollToBottom
})
</script>

<style scoped>
.chat-interface {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f5f5f5;
}

.chat-history {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.chat-message {
  margin-bottom: 20px;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.user-message {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.message-bubble {
  max-width: 70%;
  padding: 12px 16px;
  border-radius: 18px;
  word-wrap: break-word;
}

.user-bubble {
  background: #fff;
  color: #333;
  border-bottom-right-radius: 4px;
}

.message-content {
  font-size: 14px;
  line-height: 1.5;
}

.message-template {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #e0e0e0;
  font-size: 12px;
  color: #666;
}

.message-time {
  margin-top: 4px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
}

.ai-message {
  display: flex;
  gap: 12px;
}

.ai-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

.ai-content {
  flex: 1;
  max-width: 80%;
}

.generating-card,
.result-card,
.error-card,
.text-card {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.generating-header,
.result-header,
.error-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.generating-icon {
  animation: pulse 1.5s ease infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.generating-preview {
  background: #f8f8f8;
  border-radius: 8px;
  padding: 12px;
  margin: 12px 0;
  max-height: 200px;
  overflow-y: auto;
}

.generating-preview pre {
  margin: 0;
  font-family: monospace;
  font-size: 12px;
  white-space: pre-wrap;
}

.generating-progress {
  margin-top: 12px;
}

.progress-bar {
  height: 4px;
  background: #e0e0e0;
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea, #764ba2);
  transition: width 0.3s ease;
  animation: shimmer 1.5s ease infinite;
}

@keyframes shimmer {
  0% {
    opacity: 0.8;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.8;
  }
}

.result-type {
  padding: 2px 8px;
  background: #e3f2fd;
  color: #1976d2;
  border-radius: 4px;
  font-size: 12px;
}

.result-content {
  background: #f8f8f8;
  border-radius: 8px;
  padding: 12px;
  margin: 12px 0;
}

.result-content pre {
  margin: 0;
  font-family: monospace;
  font-size: 13px;
  white-space: pre-wrap;
}

.result-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.action-btn {
  padding: 6px 12px;
  background: #f5f5f5;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.2s;
}

.action-btn:hover {
  background: #e8e8e8;
}

.action-btn.refreshing {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.error-icon {
  color: #f56c6c;
}

.error-content {
  color: #f56c6c;
  margin: 12px 0;
}

.retry-btn {
  padding: 6px 16px;
  background: #f56c6c;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.retry-btn:hover {
  background: #f78989;
}

.chat-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: rgba(255, 255, 255, 0.9);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-text {
  font-size: 18px;
  font-weight: 500;
  margin-bottom: 8px;
}

.empty-hint {
  font-size: 14px;
  opacity: 0.8;
}

.chat-input-area {
  background: #fff;
  border-top: 1px solid #e0e0e0;
  padding: 16px;
}

.quick-templates {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.template-btn {
  padding: 6px 12px;
  background: #f5f5f5;
  border: 1px solid #e0e0e0;
  border-radius: 20px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 4px;
}

.template-btn:hover {
  background: #e8e8e8;
}

.template-btn.active {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  border-color: transparent;
}

.input-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chat-input {
  width: 100%;
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
  resize: none;
  font-family: inherit;
}

.chat-input:focus {
  outline: none;
  border-color: #667eea;
}

.chat-input:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}

.input-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.char-count {
  font-size: 12px;
  color: #999;
}

.send-btn {
  padding: 8px 20px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  border: none;
  border-radius: 20px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 4px;
}

.send-btn:hover:not(.disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.send-btn.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 移动端响应式布局 */
@media (max-width: 768px) {
  .chat-input-area {
    padding: 12px;
  }
  
  .quick-templates {
    gap: 6px;
    margin-bottom: 10px;
  }
  
  .template-btn {
    padding: 5px 10px;
    font-size: 12px;
    flex: 0 0 auto;
  }
  
  .input-container {
    position: relative;
  }
  
  .chat-input {
    font-size: 14px;
    padding: 10px;
    padding-bottom: 40px; /* 为底部操作栏留出空间 */
  }
  
  .input-actions {
    position: absolute;
    bottom: 8px;
    left: 10px;
    right: 10px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: transparent;
    gap: 8px; /* 添加间距 */
    padding-right: 5px; /* 给右侧留出一点空间 */
  }
  
  .char-count {
    font-size: 11px;
    color: #999;
  }
  
  .send-btn {
    padding: 6px 12px;
    font-size: 13px;
    min-width: 70px;
    flex-shrink: 0; /* 防止按钮被压缩 */
    white-space: nowrap; /* 防止文字换行 */
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  
  .chat-message {
    padding: 8px 12px;
  }
  
  .message-bubble {
    max-width: 85%;
  }
  
  .result-card,
  .generating-card {
    font-size: 13px;
  }
  
  .result-actions {
    flex-direction: column;
    gap: 8px;
  }
  
  .result-actions .action-btn {
    width: 100%;
    justify-content: center;
  }
}

/* 超小屏幕适配 */
@media (max-width: 480px) {
  .quick-templates {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
  }
  
  .template-btn {
    width: 100%;
    justify-content: center;
  }
}
</style>