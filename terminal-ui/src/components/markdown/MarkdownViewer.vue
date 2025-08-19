<template>
  <div 
    ref="containerRef" 
    class="markdown-viewer-container"
    :class="{
      'loading': isLoading,
      'error': hasError,
      [`theme-${theme}`]: true
    }"
  >
    <!-- 加载状态 -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-spinner"></div>
      <div class="loading-text">加载Markdown内容...</div>
    </div>
    
    <!-- 错误状态 -->
    <div v-else-if="hasError" class="error-overlay">
      <div class="error-icon">⚠️</div>
      <div class="error-message">{{ errorMessage }}</div>
      <button @click="retry" class="retry-button">重试</button>
    </div>
    
    <!-- 工具栏 -->
    <div v-if="showToolbar && !isLoading && !hasError" class="markdown-toolbar">
      <div class="toolbar-left">
        <button 
          v-if="enableFullscreen"
          @click="toggleFullscreen" 
          class="toolbar-button"
          :title="isFullscreen ? '退出全屏' : '全屏显示'"
        >
          <span v-if="isFullscreen">⊞</span>
          <span v-else>⛶</span>
        </button>
        
        <button 
          v-if="enableThemeToggle"
          @click="toggleTheme" 
          class="toolbar-button"
          title="切换主题"
        >
          <span v-if="isDarkTheme">☀️</span>
          <span v-else>🌙</span>
        </button>
        
        <button 
          v-if="enableExport"
          @click="exportContent" 
          class="toolbar-button"
          title="导出"
        >
          📤
        </button>
      </div>
      
      <div class="toolbar-right">
        <span class="word-count" v-if="showWordCount">
          {{ wordCount }} 字
        </span>
      </div>
    </div>
    
    <!-- Markdown内容容器 -->
    <div 
      ref="editorRef" 
      class="markdown-content"
      :style="{ minHeight: minHeight }"
    ></div>
    
    <!-- 底部信息栏 -->
    <div v-if="showFooter" class="markdown-footer">
      <div class="footer-info">
        <span v-if="lastUpdated">最后更新: {{ formatDate(lastUpdated) }}</span>
        <span v-if="fileSize">大小: {{ formatFileSize(fileSize) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, computed, nextTick } from 'vue'
import { createMarkdownViewer, EDITOR_PRESETS } from './core/editor.js'
import { MATH_CONFIG, MERMAID_THEMES } from './core/plugins.js'
import './themes/fluent.css'

// Props定义
const props = defineProps({
  // 内容相关
  content: {
    type: String,
    default: ''
  },
  
  // 外观配置
  theme: {
    type: String,
    default: 'fluent',
    validator: (value) => ['fluent', 'fluent-dark'].includes(value)
  },
  
  // 功能配置
  preset: {
    type: String,
    default: 'full',
    validator: (value) => Object.keys(EDITOR_PRESETS).includes(value)
  },
  
  // UI配置
  showToolbar: {
    type: Boolean,
    default: true
  },
  
  showFooter: {
    type: Boolean,
    default: false
  },
  
  showWordCount: {
    type: Boolean,
    default: true
  },
  
  // 功能开关
  enableFullscreen: {
    type: Boolean,
    default: true
  },
  
  enableThemeToggle: {
    type: Boolean,
    default: true
  },
  
  enableExport: {
    type: Boolean,
    default: true
  },
  
  // 尺寸配置
  minHeight: {
    type: String,
    default: '300px'
  },
  
  // 元数据
  lastUpdated: {
    type: [Date, String, Number],
    default: null
  },
  
  fileSize: {
    type: Number,
    default: null
  }
})

// Emits定义
const emit = defineEmits([
  'loaded',
  'error',
  'fullscreen-change',
  'theme-change',
  'export'
])

// 响应式数据
const containerRef = ref(null)
const editorRef = ref(null)
const isLoading = ref(true)
const hasError = ref(false)
const errorMessage = ref('')
const isFullscreen = ref(false)
const currentTheme = ref(props.theme)
const editor = ref(null)

// 计算属性
const isDarkTheme = computed(() => currentTheme.value.includes('dark'))

const wordCount = computed(() => {
  if (!props.content) return 0
  // 简单的字数统计，去除markdown语法
  const text = props.content
    .replace(/[#*_`~\[\]()]/g, '') // 移除markdown符号
    .replace(/\s+/g, ' ') // 合并空白字符
    .trim()
  return text.length
})

// 方法
const initEditor = async () => {
  try {
    isLoading.value = true
    hasError.value = false
    
    if (!editorRef.value) {
      throw new Error('编辑器容器未找到')
    }
    
    // 获取预设配置
    const presetConfig = EDITOR_PRESETS[props.preset] || EDITOR_PRESETS.full
    
    // 创建编辑器配置
    const editorConfig = {
      content: props.content,
      theme: currentTheme.value,
      container: editorRef.value,
      ...presetConfig,
      onLoad: () => {
        isLoading.value = false
        emit('loaded')
      },
      onError: (error) => {
        console.error('Markdown editor error:', error)
        hasError.value = true
        errorMessage.value = error.message || '加载Markdown内容时出错'
        isLoading.value = false
        emit('error', error)
      }
    }
    
    // 创建编辑器实例
    editor.value = createMarkdownViewer(editorConfig)
    await editor.value.create()
    
  } catch (error) {
    console.error('Failed to initialize markdown editor:', error)
    hasError.value = true
    errorMessage.value = error.message || '初始化编辑器失败'
    isLoading.value = false
    emit('error', error)
  }
}

const destroyEditor = () => {
  if (editor.value) {
    try {
      editor.value.destroy()
    } catch (error) {
      console.warn('Error destroying editor:', error)
    }
    editor.value = null
  }
}

const updateContent = async (newContent) => {
  if (!editor.value || !newContent) return
  
  try {
    // 更新编辑器内容
    const ctx = editor.value.ctx
    ctx.set(defaultValueCtx, newContent)
    await editor.value.action(ctx)
  } catch (error) {
    console.error('Error updating content:', error)
  }
}

const toggleFullscreen = () => {
  if (!document.fullscreenElement) {
    containerRef.value?.requestFullscreen?.()
    isFullscreen.value = true
  } else {
    document.exitFullscreen?.()
    isFullscreen.value = false
  }
  emit('fullscreen-change', isFullscreen.value)
}

const toggleTheme = () => {
  currentTheme.value = isDarkTheme.value ? 'fluent' : 'fluent-dark'
  emit('theme-change', currentTheme.value)
  
  // 重新初始化编辑器以应用新主题
  nextTick(() => {
    destroyEditor()
    initEditor()
  })
}

const exportContent = () => {
  const exportData = {
    content: props.content,
    wordCount: wordCount.value,
    theme: currentTheme.value,
    timestamp: new Date().toISOString()
  }
  emit('export', exportData)
}

const retry = () => {
  hasError.value = false
  errorMessage.value = ''
  initEditor()
}

const formatDate = (date) => {
  if (!date) return ''
  const d = new Date(date)
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatFileSize = (bytes) => {
  if (!bytes) return ''
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`
}

// 监听器
watch(() => props.content, (newContent) => {
  updateContent(newContent)
})

watch(() => props.theme, (newTheme) => {
  currentTheme.value = newTheme
  nextTick(() => {
    destroyEditor()
    initEditor()
  })
})

// 全屏状态监听
const handleFullscreenChange = () => {
  isFullscreen.value = !!document.fullscreenElement
}

// 生命周期
onMounted(() => {
  initEditor()
  document.addEventListener('fullscreenchange', handleFullscreenChange)
})

onUnmounted(() => {
  destroyEditor()
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
})
</script>

<style scoped>
.markdown-viewer-container {
  position: relative;
  background: var(--md-background, #faf9f8);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.markdown-viewer-container.loading {
  min-height: 200px;
}

.markdown-viewer-container.error {
  border: 2px solid #d13438;
}

.markdown-viewer-container:fullscreen {
  border-radius: 0;
  box-shadow: none;
}

/* 加载状态 */
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.9);
  z-index: 10;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e1e1e1;
  border-top: 3px solid #0078d4;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-text {
  margin-top: 16px;
  color: #605e5c;
  font-size: 14px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 错误状态 */
.error-overlay {
  padding: 32px;
  text-align: center;
  color: #d13438;
}

.error-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.error-message {
  margin-bottom: 16px;
  font-size: 16px;
}

.retry-button {
  background: #0078d4;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s ease;
}

.retry-button:hover {
  background: #106ebe;
}

/* 工具栏 */
.markdown-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: var(--md-surface-variant, #f3f2f1);
  border-bottom: 1px solid var(--md-border, #edebe9);
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-button {
  background: none;
  border: none;
  padding: 6px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  transition: background 0.2s ease;
}

.toolbar-button:hover {
  background: var(--md-border, #edebe9);
}

.word-count {
  font-size: 12px;
  color: var(--md-text-tertiary, #a19f9d);
}

/* 内容区域 */
.markdown-content {
  position: relative;
  overflow: auto;
}

/* 底部信息栏 */
.markdown-footer {
  padding: 8px 16px;
  background: var(--md-surface-variant, #f3f2f1);
  border-top: 1px solid var(--md-border, #edebe9);
  font-size: 12px;
  color: var(--md-text-tertiary, #a19f9d);
}

.footer-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* 主题样式 */
.theme-fluent-dark {
  --md-background: #1e1e1e;
  --md-surface: #2d2d30;
  --md-surface-variant: #3e3e42;
  --md-border: #484848;
  --md-text-primary: #ffffff;
  --md-text-secondary: #cccccc;
  --md-text-tertiary: #969696;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .markdown-toolbar {
    padding: 6px 12px;
  }
  
  .toolbar-button {
    padding: 4px;
    font-size: 14px;
  }
  
  .word-count {
    display: none;
  }
  
  .footer-info {
    flex-direction: column;
    gap: 4px;
    align-items: flex-start;
  }
}
</style>