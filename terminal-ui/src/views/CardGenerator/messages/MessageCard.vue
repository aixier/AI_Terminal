<template>
  <div :class="['message-card', `message-${type}`]">
    <div class="message-header" v-if="showHeader">
      <span class="message-type">{{ typeLabel }}</span>
      <span class="message-time">{{ formatTime(timestamp) }}</span>
    </div>
    <div class="message-content">
      <slot></slot>
    </div>
    <div class="message-actions" v-if="showActions">
      <slot name="actions">
        <el-button 
          v-if="canCopy" 
          size="small" 
          @click="handleCopy"
          :icon="CopyDocument"
        >
          复制
        </el-button>
        <el-button 
          v-if="canDownload" 
          size="small" 
          @click="handleDownload"
          :icon="Download"
        >
          下载
        </el-button>
      </slot>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ElButton, ElMessage } from 'element-plus'
import { CopyDocument, Download } from '@element-plus/icons-vue'

const props = defineProps({
  type: {
    type: String,
    default: 'text',
    validator: (value) => ['text', 'html', 'json', 'markdown', 'image', 'video', 'error'].includes(value)
  },
  content: {
    type: [String, Object, Array],
    default: ''
  },
  timestamp: {
    type: [Date, Number],
    default: () => new Date()
  },
  showHeader: {
    type: Boolean,
    default: true
  },
  showActions: {
    type: Boolean,
    default: true
  },
  canCopy: {
    type: Boolean,
    default: true
  },
  canDownload: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['copy', 'download'])

const typeLabel = computed(() => {
  const labels = {
    text: '文本',
    html: 'HTML',
    json: 'JSON',
    markdown: 'Markdown',
    image: '图片',
    video: '视频',
    error: '错误'
  }
  return labels[props.type] || props.type
})

const formatTime = (time) => {
  const date = new Date(time)
  return date.toLocaleTimeString('zh-CN', { 
    hour: '2-digit', 
    minute: '2-digit' 
  })
}

const handleCopy = async () => {
  try {
    const textContent = typeof props.content === 'string' 
      ? props.content 
      : JSON.stringify(props.content, null, 2)
    
    await navigator.clipboard.writeText(textContent)
    ElMessage.success('复制成功')
    emit('copy', textContent)
  } catch (error) {
    console.error('Copy failed:', error)
    ElMessage.error('复制失败')
  }
}

const handleDownload = () => {
  emit('download', props.content)
}
</script>

<style scoped>
.message-card {
  background: #fff;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
}

.message-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e8e8e8;
}

.message-type {
  font-size: 12px;
  font-weight: 500;
  color: #666;
  padding: 2px 8px;
  background: #f0f0f0;
  border-radius: 4px;
}

.message-time {
  font-size: 12px;
  color: #999;
}

.message-content {
  padding: 8px 0;
  min-height: 40px;
}

.message-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #e8e8e8;
}

.message-html .message-type {
  background: #e3f2fd;
  color: #1976d2;
}

.message-json .message-type {
  background: #f3e5f5;
  color: #7b1fa2;
}

.message-markdown .message-type {
  background: #e8f5e9;
  color: #388e3c;
}

.message-image .message-type {
  background: #fff3e0;
  color: #f57c00;
}

.message-video .message-type {
  background: #fce4ec;
  color: #c2185b;
}

.message-error {
  background: #fef0f0;
  border: 1px solid #fde2e2;
}

.message-error .message-type {
  background: #fde2e2;
  color: #f56c6c;
}
</style>