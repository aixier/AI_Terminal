<template>
  <div v-if="showTaskStatus" class="global-task-status">
    <div class="task-info">
      <span class="task-icon">
        {{ isGenerating ? '⏳' : (isGeneratingHtml ? '🔄' : '') }}
      </span>
      <span class="task-text">
        {{ taskText }}
      </span>
      <span v-if="streamCount > 0" class="task-counter">
        {{ streamCount }}
      </span>
    </div>
    
    <!-- 进度条（可选） -->
    <div v-if="isGenerating && showProgress" class="task-progress">
      <div class="progress-bar" :style="{ width: `${progress}%` }"></div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  // 主要生成状态
  isGenerating: {
    type: Boolean,
    default: false
  },
  
  // HTML生成状态
  isGeneratingHtml: {
    type: Boolean, 
    default: false
  },
  
  // 任务提示文本
  generatingHint: {
    type: String,
    default: ''
  },
  
  // 流消息数量
  streamCount: {
    type: Number,
    default: 0
  },
  
  // 流消息总字符数
  totalChars: {
    type: Number,
    default: 0
  },
  
  // 进度百分比
  progress: {
    type: Number,
    default: 0
  },
  
  // 是否显示进度条
  showProgress: {
    type: Boolean,
    default: false
  }
})

// 是否显示任务状态栏
const showTaskStatus = computed(() => {
  return props.isGenerating || props.isGeneratingHtml
})

// 任务状态文本
const taskText = computed(() => {
  if (props.isGenerating) {
    return props.generatingHint || '正在生成...'
  } else if (props.isGeneratingHtml) {
    return '正在生成HTML...'
  }
  return ''
})

// 设置CSS变量
const updateGlobalStyles = () => {
  const root = document.documentElement
  if (showTaskStatus.value) {
    root.style.setProperty('--global-task-status-height', '40px')
  } else {
    root.style.setProperty('--global-task-status-height', '0px')
  }
}

onMounted(() => {
  updateGlobalStyles()
})

onUnmounted(() => {
  const root = document.documentElement
  root.style.setProperty('--global-task-status-height', '0px')
})

// 监听状态变化，更新CSS变量
import { watch } from 'vue'
watch(showTaskStatus, () => {
  updateGlobalStyles()
})
</script>

<style scoped>
.global-task-status {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9999;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.95) 0%, rgba(5, 150, 105, 0.95) 100%);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(16, 185, 129, 0.3);
  padding: 8px 16px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.task-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 500;
  color: white;
}

.task-icon {
  font-size: 16px;
  animation: spin 2s linear infinite;
}

.task-text {
  flex: 1;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 60%;
}

.task-counter {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  min-width: 20px;
  text-align: center;
}

.task-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: rgba(255, 255, 255, 0.2);
}

.progress-bar {
  height: 100%;
  background: rgba(255, 255, 255, 0.8);
  transition: width 0.3s ease;
  border-radius: 1px;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 移动端优化 */
@media (max-width: 768px) {
  .global-task-status {
    padding: 6px 12px;
  }
  
  .task-info {
    font-size: 13px;
    gap: 4px;
  }
  
  .task-icon {
    font-size: 14px;
  }
  
  .task-text {
    font-size: 12px;
    max-width: 50%;
  }
  
  .task-counter {
    font-size: 11px;
    padding: 1px 6px;
  }
}

/* HTML生成时的不同颜色 */
.global-task-status.html-generating {
  background: linear-gradient(135deg, rgba(74, 158, 255, 0.95) 0%, rgba(59, 130, 246, 0.95) 100%);
  border-bottom-color: rgba(74, 158, 255, 0.3);
}
</style>