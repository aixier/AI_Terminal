<template>
  <div class="html-content-viewer">
    <!-- 工具栏 -->
    <div class="viewer-toolbar">
      <div class="toolbar-left">
        <el-button-group>
          <el-button @click="viewMode = 'render'" :type="viewMode === 'render' ? 'primary' : ''">
            <el-icon><View /></el-icon>
            预览
          </el-button>
          <el-button @click="viewMode = 'code'" :type="viewMode === 'code' ? 'primary' : ''">
            <el-icon><Document /></el-icon>
            源码
          </el-button>
        </el-button-group>
      </div>
      <div class="toolbar-right">
        <el-button @click="handleRefresh" :loading="isLoading">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
        <el-button @click="handleCopy">
          <el-icon><CopyDocument /></el-icon>
          复制
        </el-button>
        <el-button @click="handleFullscreen">
          <el-icon><FullScreen /></el-icon>
          全屏
        </el-button>
      </div>
    </div>

    <!-- 内容区域 -->
    <div class="viewer-content" ref="contentArea">
      <!-- 渲染模式 -->
      <div v-if="viewMode === 'render'" class="render-mode">
        <div v-if="isLoading" class="loading-state">
          <el-icon class="is-loading"><Loading /></el-icon>
          <span>正在加载HTML内容...</span>
        </div>
        <div v-else-if="error" class="error-state">
          <el-icon><CircleCloseFilled /></el-icon>
          <span>{{ error }}</span>
        </div>
        <iframe
          v-else
          ref="htmlFrame"
          :srcdoc="processedHtml"
          class="html-iframe"
          :style="iframeStyle"
          @load="handleIframeLoad"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        ></iframe>
      </div>

      <!-- 源码模式 -->
      <div v-else-if="viewMode === 'code'" class="code-mode">
        <pre class="html-code"><code>{{ formattedHtml }}</code></pre>
      </div>
    </div>

    <!-- 缩放控制 -->
    <div v-if="viewMode === 'render' && !error" class="scale-controls">
      <el-slider
        v-model="scalePercent"
        :min="25"
        :max="200"
        :step="5"
        :show-tooltip="true"
        :format-tooltip="(val) => `${val}%`"
        @input="handleScaleChange"
      />
      <div class="scale-buttons">
        <el-button size="small" @click="resetScale">重置</el-button>
        <el-button size="small" @click="fitToWidth">适应宽度</el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { 
  View, 
  Document, 
  Refresh, 
  CopyDocument, 
  FullScreen, 
  Loading,
  CircleCloseFilled 
} from '@element-plus/icons-vue'

const props = defineProps({
  htmlContent: {
    type: String,
    required: true
  },
  scaleMode: {
    type: String,
    default: 'fit' // 'fit' | 'fill'
  }
})

const emit = defineEmits(['refresh', 'error'])

// 状态
const viewMode = ref('render') // 'render' | 'code'
const isLoading = ref(false)
const error = ref('')
const scalePercent = ref(100)
const htmlFrame = ref(null)
const contentArea = ref(null)

// 处理后的HTML（添加基础样式和viewport）
const processedHtml = computed(() => {
  if (!props.htmlContent) return ''
  
  // 检查是否已经有完整的HTML结构
  const hasHtmlTag = /<html/i.test(props.htmlContent)
  const hasHeadTag = /<head/i.test(props.htmlContent)
  const hasBodyTag = /<body/i.test(props.htmlContent)
  
  // 如果是完整的HTML文档，直接返回
  if (hasHtmlTag && hasBodyTag) {
    return props.htmlContent
  }
  
  // 如果是片段，包装成完整的HTML
  const baseStyles = `
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        line-height: 1.6;
        color: #333;
        background: #fff;
        padding: 20px;
      }
      img {
        max-width: 100%;
        height: auto;
      }
      pre {
        overflow-x: auto;
        background: #f5f5f5;
        padding: 10px;
        border-radius: 4px;
      }
      code {
        background: #f5f5f5;
        padding: 2px 4px;
        border-radius: 3px;
        font-family: 'Courier New', monospace;
      }
    </style>
  `
  
  const viewport = '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
  const charset = '<meta charset="UTF-8">'
  
  if (!hasHtmlTag) {
    // 完全没有HTML结构，创建完整文档
    return `<!DOCTYPE html>
      <html>
        <head>
          ${charset}
          ${viewport}
          ${baseStyles}
        </head>
        <body>
          ${props.htmlContent}
        </body>
      </html>`
  } else if (!hasHeadTag) {
    // 有html标签但没有head，插入head
    return props.htmlContent.replace(/<html[^>]*>/i, (match) => {
      return `${match}
        <head>
          ${charset}
          ${viewport}
          ${baseStyles}
        </head>`
    })
  } else {
    // 有head标签，在head中插入viewport和样式
    return props.htmlContent.replace(/<head[^>]*>/i, (match) => {
      return `${match}
        ${charset}
        ${viewport}
        ${baseStyles}`
    })
  }
})

// 格式化的HTML（用于源码显示）
const formattedHtml = computed(() => {
  if (!props.htmlContent) return ''
  
  // 简单的格式化，实际项目中可以使用专门的格式化库
  try {
    // 基础缩进处理
    let formatted = props.htmlContent
      .replace(/></g, '>\n<')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line)
      .join('\n')
    
    // 添加缩进
    let indentLevel = 0
    const lines = formatted.split('\n')
    const formattedLines = []
    
    for (const line of lines) {
      // 闭合标签减少缩进
      if (line.match(/^<\/\w/)) {
        indentLevel = Math.max(0, indentLevel - 1)
      }
      
      // 添加缩进
      formattedLines.push('  '.repeat(indentLevel) + line)
      
      // 开始标签增加缩进（排除自闭合标签）
      if (line.match(/^<\w[^>]*[^\/]>$/) && !line.match(/^<(br|hr|img|input|meta|link)/i)) {
        indentLevel++
      }
    }
    
    return formattedLines.join('\n')
  } catch (e) {
    console.error('Format HTML error:', e)
    return props.htmlContent
  }
})

// iframe样式
const iframeStyle = computed(() => {
  const scale = scalePercent.value / 100
  return {
    transform: `scale(${scale})`,
    transformOrigin: 'top left',
    width: `${100 / scale}%`,
    height: `${100 / scale}%`
  }
})

// 处理iframe加载
const handleIframeLoad = () => {
  console.log('[HtmlContentViewer] iframe loaded')
  error.value = ''
  
  // 自动适应内容
  if (props.scaleMode === 'fit') {
    nextTick(() => {
      fitToWidth()
    })
  }
}

// 刷新
const handleRefresh = async () => {
  isLoading.value = true
  error.value = ''
  
  try {
    // 触发父组件刷新
    emit('refresh')
    
    // 重新加载iframe
    if (htmlFrame.value) {
      htmlFrame.value.srcdoc = processedHtml.value
    }
  } catch (e) {
    error.value = '刷新失败: ' + e.message
    emit('error', e)
  } finally {
    isLoading.value = false
  }
}

// 复制HTML内容
const handleCopy = async () => {
  try {
    await navigator.clipboard.writeText(props.htmlContent)
    ElMessage.success('HTML内容已复制到剪贴板')
  } catch (e) {
    ElMessage.error('复制失败: ' + e.message)
  }
}

// 全屏查看
const handleFullscreen = () => {
  if (htmlFrame.value) {
    if (htmlFrame.value.requestFullscreen) {
      htmlFrame.value.requestFullscreen()
    } else if (htmlFrame.value.webkitRequestFullscreen) {
      htmlFrame.value.webkitRequestFullscreen()
    } else if (htmlFrame.value.mozRequestFullScreen) {
      htmlFrame.value.mozRequestFullScreen()
    }
  }
}

// 缩放控制
const handleScaleChange = (value) => {
  scalePercent.value = value
}

// 重置缩放
const resetScale = () => {
  scalePercent.value = 100
}

// 适应宽度
const fitToWidth = () => {
  if (!contentArea.value || !htmlFrame.value) return
  
  const containerWidth = contentArea.value.offsetWidth
  const iframeWidth = 375 // 移动端基准宽度
  
  const scale = Math.min((containerWidth / iframeWidth) * 0.95, 200)
  scalePercent.value = Math.round(scale)
}

// 监听内容变化
watch(() => props.htmlContent, (newContent) => {
  if (newContent) {
    error.value = ''
    isLoading.value = false
  }
})

// 响应式处理
const handleResize = () => {
  if (props.scaleMode === 'fit' && viewMode.value === 'render') {
    fitToWidth()
  }
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
.html-content-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f5f5f5;
}

.viewer-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  background: white;
  border-bottom: 1px solid #e0e0e0;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  gap: 10px;
}

.viewer-content {
  flex: 1;
  position: relative;
  overflow: auto;
  background: white;
}

.render-mode {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: auto;
}

.loading-state,
.error-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 10px;
  color: #666;
}

.error-state {
  color: #f56c6c;
}

.html-iframe {
  border: none;
  display: block;
  min-height: 100%;
}

.code-mode {
  height: 100%;
  overflow: auto;
}

.html-code {
  margin: 0;
  padding: 20px;
  background: #2d2d2d;
  color: #f8f8f2;
  font-family: 'Monaco', 'Consolas', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre;
  overflow-x: auto;
}

.scale-controls {
  position: absolute;
  bottom: 20px;
  right: 20px;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 10px 15px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 15px;
  z-index: 100;
}

.scale-controls .el-slider {
  width: 150px;
}

.scale-buttons {
  display: flex;
  gap: 5px;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .viewer-toolbar {
    flex-direction: column;
    gap: 10px;
  }
  
  .toolbar-left,
  .toolbar-right {
    width: 100%;
    justify-content: center;
  }
  
  .scale-controls {
    bottom: 10px;
    right: 10px;
    left: 10px;
    flex-direction: column;
  }
  
  .scale-controls .el-slider {
    width: 100%;
  }
  
  .scale-buttons {
    width: 100%;
    justify-content: space-between;
  }
}
</style>