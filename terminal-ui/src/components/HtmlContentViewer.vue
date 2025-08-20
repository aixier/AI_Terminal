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
          {{ props.isMobile ? '新窗口浏览' : '复制源码' }}
        </el-button>
        <el-button v-if="!props.isMobile" @click="handleFullscreen">
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

    <!-- 缩放控制 - 移动端总是显示 -->
    <div v-if="viewMode === 'render' && !error" class="scale-controls" :class="{ 'mobile': props.isMobile }">
      <el-slider
        v-model="scalePercent"
        :min="25"
        :max="200"
        :step="5"
        :show-tooltip="true"
        :format-tooltip="(val) => `${val}%`"
        @input="handleScaleChange"
      />
      <!-- 移动端只保留一个适应按钮，桌面端保留两个按钮 -->
      <div v-if="!props.isMobile" class="scale-buttons">
        <el-button size="small" @click="resetScale">重置</el-button>
        <el-button size="small" @click="fitToWidth">适应宽度</el-button>
      </div>
      <div v-else class="scale-buttons mobile-buttons">
        <el-button size="small" @click="() => fitToWidth(true)">适应</el-button>
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
  },
  isMobile: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['refresh', 'error', 'openLink'])

// 状态
const viewMode = ref('render') // 'render' | 'code'
const isLoading = ref(false)
const error = ref('')
const scalePercent = ref(props.isMobile ? 150 : 100) // 移动端默认150%，桌面端100%
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
  
  // 开始动画缩放效果
  if (props.isMobile) {
    // 移动端：从25%开始动画到目标缩放比例
    animateToTargetScale()
  } else {
    // 桌面端：直接适应
    if (props.scaleMode === 'fit') {
      nextTick(() => {
        fitToWidth()
      })
    }
  }
}

// 动画缩放到目标比例
const animateToTargetScale = () => {
  // 先设置为25%作为起始点
  scalePercent.value = 25
  
  // 计算目标缩放比例
  let targetScale = 150 // 移动端默认150%
  
  if (props.scaleMode === 'fit') {
    // 如果是适应模式，计算适应的缩放比例
    if (contentArea.value && htmlFrame.value) {
      const containerWidth = contentArea.value.offsetWidth
      const iframeWidth = 320
      targetScale = Math.min((containerWidth / iframeWidth) * 1.2, 200)
      targetScale = Math.round(targetScale)
    }
  }
  
  console.log('[HtmlContentViewer] Starting scale animation from 25% to', targetScale + '%')
  
  // 动画参数
  const startScale = 25
  const endScale = targetScale
  const duration = 1500 // 1.5秒动画
  const startTime = performance.now()
  
  // 缓动函数 (easeOutCubic)
  const easeOutCubic = (t) => {
    return 1 - Math.pow(1 - t, 3)
  }
  
  const animate = (currentTime) => {
    const elapsed = currentTime - startTime
    const progress = Math.min(elapsed / duration, 1)
    
    // 应用缓动函数
    const easedProgress = easeOutCubic(progress)
    
    // 计算当前缩放值
    const currentScale = startScale + (endScale - startScale) * easedProgress
    scalePercent.value = Math.round(currentScale)
    
    // 继续动画或结束
    if (progress < 1) {
      requestAnimationFrame(animate)
    } else {
      console.log('[HtmlContentViewer] Scale animation completed at', scalePercent.value + '%')
    }
  }
  
  // 开始动画
  requestAnimationFrame(animate)
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

// 复制HTML内容或打开新窗口
const handleCopy = async () => {
  if (props.isMobile) {
    // 移动端打开新窗口浏览
    emit('openLink')
  } else {
    // 桌面端复制源码
    try {
      await navigator.clipboard.writeText(props.htmlContent)
      ElMessage.success('HTML源码已复制到剪贴板')
    } catch (e) {
      ElMessage.error('复制失败: ' + e.message)
    }
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
const fitToWidth = (animated = false) => {
  if (!contentArea.value || !htmlFrame.value) return
  
  const containerWidth = contentArea.value.offsetWidth
  
  let targetScale
  if (props.isMobile) {
    // 移动端：更大的缩放比例，让内容更容易阅读
    const iframeWidth = 320 // 减小基准宽度，增加缩放比例
    targetScale = Math.min((containerWidth / iframeWidth) * 1.2, 200) // 提高倍数到1.2
    targetScale = Math.round(targetScale)
  } else {
    // 桌面端：保持原有逻辑
    const iframeWidth = 375
    targetScale = Math.min((containerWidth / iframeWidth) * 0.95, 200)
    targetScale = Math.round(targetScale)
  }
  
  if (animated && props.isMobile) {
    // 移动端使用动画
    animateToScale(targetScale)
  } else {
    // 直接设置
    scalePercent.value = targetScale
  }
}

// 动画到指定缩放比例
const animateToScale = (targetScale) => {
  const startScale = scalePercent.value
  const duration = 800 // 0.8秒动画
  const startTime = performance.now()
  
  console.log('[HtmlContentViewer] Animating scale from', startScale + '% to', targetScale + '%')
  
  // 缓动函数 (easeOutQuart)
  const easeOutQuart = (t) => {
    return 1 - Math.pow(1 - t, 4)
  }
  
  const animate = (currentTime) => {
    const elapsed = currentTime - startTime
    const progress = Math.min(elapsed / duration, 1)
    
    // 应用缓动函数
    const easedProgress = easeOutQuart(progress)
    
    // 计算当前缩放值
    const currentScale = startScale + (targetScale - startScale) * easedProgress
    scalePercent.value = Math.round(currentScale)
    
    // 继续动画或结束
    if (progress < 1) {
      requestAnimationFrame(animate)
    }
  }
  
  // 开始动画
  requestAnimationFrame(animate)
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

.scale-controls.mobile {
  position: fixed;
  bottom: 10px;
  left: 10px;
  right: 10px;
  background: rgba(0, 0, 0, 0.8);
  border: 1px solid #444;
  color: white;
  backdrop-filter: blur(10px);
}

.scale-controls .el-slider {
  width: 150px;
}

.scale-buttons {
  display: flex;
  gap: 5px;
}

.scale-buttons.mobile-buttons {
  justify-content: center;
}

.scale-buttons.mobile-buttons .el-button {
  padding: 4px 12px;
  font-size: 11px;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .viewer-toolbar {
    padding: 8px 10px; /* 减少内边距 */
    gap: 8px; /* 减少间距 */
    /* 保持flex-direction: row，让按钮在一行显示 */
  }
  
  .toolbar-left {
    flex: 1;
    justify-content: flex-start;
  }
  
  .toolbar-right {
    flex: 1;
    justify-content: flex-end;
  }
  
  /* 移动端按钮样式优化 */
  .toolbar-left .el-button,
  .toolbar-right .el-button {
    padding: 6px 12px;
    font-size: 12px;
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