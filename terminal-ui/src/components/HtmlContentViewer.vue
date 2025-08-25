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
        <el-button @click="handleShareToXHS" :loading="isSharing" type="danger">
          <el-icon><Share /></el-icon>
          分享小红书
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
    
    <!-- 分享结果对话框 - 产品化设计 -->
    <el-dialog
      v-model="shareDialogVisible"
      :title="props.isMobile ? '分享成功' : '分享到小红书'"
      :width="props.isMobile ? '95%' : '900px'"
      :fullscreen="props.isMobile"
      class="share-dialog"
    >
      <div v-if="shareResult" class="share-result-container">
        <!-- 顶部成功提示 -->
        <div class="share-success-banner">
          <el-icon class="success-icon"><CircleCheckFilled /></el-icon>
          <div class="success-text">
            <h3>内容已成功生成！</h3>
            <p>已生成 {{ shareResult.data.cardCount || 0 }} 张精美卡片，可直接分享到小红书</p>
          </div>
        </div>

        <!-- 主要内容区 -->
        <div class="share-content-layout" :class="{ 'mobile-layout': props.isMobile }">
          <!-- 左侧：卡片预览 -->
          <div class="cards-preview-section">
            <div class="section-header">
              <h4>📸 生成的卡片</h4>
              <el-tag type="success">{{ shareResult.extractedData.images?.length || 0 }} 张</el-tag>
            </div>
            <div class="cards-grid">
              <div 
                v-for="(image, index) in (shareResult.extractedData.images || []).slice(0, 9)"
                :key="index"
                class="card-thumbnail"
                @click="openInNewWindow(image.src)"
              >
                <img :src="image.src" :alt="`卡片 ${index + 1}`" />
                <div class="card-overlay">
                  <span class="card-number">{{ index + 1 }}</span>
                  <el-icon class="expand-icon"><ZoomIn /></el-icon>
                </div>
              </div>
            </div>
            <div v-if="shareResult.extractedData.images?.length > 9" class="more-cards-hint">
              还有 {{ shareResult.extractedData.images.length - 9 }} 张卡片...
            </div>
          </div>

          <!-- 右侧：分享操作 -->
          <div class="share-actions-section">
            <!-- 快速分享 -->
            <div class="quick-share-panel">
              <h4>🚀 快速分享</h4>
              
              <!-- 分享链接 -->
              <div class="share-link-card">
                <label>分享链接</label>
                <div class="link-input-group">
                  <el-input 
                    v-model="shareResult.shareLink" 
                    readonly
                    placeholder="分享链接"
                  />
                  <el-button type="primary" @click="copyShareLink(shareResult.shareLink)">
                    <el-icon><CopyDocument /></el-icon>
                    复制
                  </el-button>
                </div>
              </div>

              <!-- 短链接 -->
              <div class="share-link-card">
                <label>短链接</label>
                <div class="link-input-group">
                  <el-input 
                    v-model="shareResult.data.shortUrl" 
                    readonly
                    placeholder="短链接"
                  />
                  <el-button @click="copyShareLink(shareResult.data.shortUrl)">
                    <el-icon><CopyDocument /></el-icon>
                    复制
                  </el-button>
                </div>
              </div>

              <!-- 二维码 -->
              <div class="qr-code-section">
                <label>扫码访问</label>
                <div class="qr-code-wrapper">
                  <img 
                    :src="shareResult.data.qrCodeUrl" 
                    alt="QR Code"
                    class="qr-code-image"
                  />
                  <el-button 
                    size="small" 
                    @click="downloadQRCode(shareResult.data.qrCodeUrl)"
                    class="download-qr-btn"
                  >
                    <el-icon><Download /></el-icon>
                    下载二维码
                  </el-button>
                </div>
              </div>
            </div>

            <!-- 操作按钮组 -->
            <div class="action-buttons">
              <el-button 
                type="danger" 
                size="large"
                @click="openInNewWindow(shareResult.shareLink)"
                class="primary-action-btn"
              >
                <el-icon><Position /></el-icon>
                在小红书中打开
              </el-button>
              
              <el-button 
                type="primary" 
                size="large"
                @click="openInNewWindow(shareResult.data.originalUrl)"
                plain
              >
                <el-icon><View /></el-icon>
                查看原始页面
              </el-button>
            </div>

            <!-- 使用提示 -->
            <div class="usage-tips">
              <h5>💡 使用提示</h5>
              <ul>
                <li>点击卡片可查看大图</li>
                <li>长按卡片图片可保存到相册</li>
                <li>复制链接后可直接粘贴分享</li>
                <li>扫描二维码可在手机上查看</li>
              </ul>
            </div>
          </div>
        </div>

        <!-- 底部信息 -->
        <div class="share-footer-info">
          <el-descriptions :column="props.isMobile ? 1 : 3" size="small">
            <el-descriptions-item label="文件ID">
              {{ shareResult.fileId }}
            </el-descriptions-item>
            <el-descriptions-item label="文件大小">
              {{ (shareResult.fileSize / 1024).toFixed(2) }} KB
            </el-descriptions-item>
            <el-descriptions-item label="生成时间">
              {{ new Date().toLocaleString() }}
            </el-descriptions-item>
          </el-descriptions>
        </div>
      </div>

      <template #footer>
        <span class="dialog-footer">
          <el-button @click="shareDialogVisible = false">关闭</el-button>
        </span>
      </template>
    </el-dialog>
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
  CircleCloseFilled,
  Share,
  CircleCheckFilled,
  ZoomIn,
  Download,
  Position
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
const isSharing = ref(false) // 分享状态
const shareDialogVisible = ref(false) // 分享结果对话框
const shareResult = ref(null) // 分享结果数据

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
  
  // 移动端延迟执行动画，确保渲染完成
  if (props.isMobile) {
    // 先设置为25%
    scalePercent.value = 25
    
    // 等待一段时间确保内容完全渲染后再开始动画
    setTimeout(() => {
      console.log('[HtmlContentViewer] Starting delayed animation after rendering')
      animateToTargetScale()
    }, 300) // 300ms延迟确保渲染完成
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
  // 确保从25%开始
  const currentScale = scalePercent.value
  console.log('[HtmlContentViewer] Current scale before animation:', currentScale + '%')
  
  // 计算目标缩放比例 - 修改为100%
  let targetScale = 100 // 移动端动画到100%
  
  if (props.scaleMode === 'fit') {
    // 如果是适应模式，也设置为100%
    targetScale = 100
  }
  
  console.log('[HtmlContentViewer] Starting scale animation from', currentScale + '% to', targetScale + '%')
  
  // 动画参数 - 修改为3秒
  const startScale = currentScale
  const endScale = targetScale
  const duration = 3000 // 3秒动画
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
    const newScale = startScale + (endScale - startScale) * easedProgress
    scalePercent.value = Math.round(newScale)
    
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

// 分享到小红书
const handleShareToXHS = async () => {
  if (!props.htmlContent) {
    ElMessage.warning('没有可分享的内容')
    return
  }

  isSharing.value = true
  shareResult.value = null

  try {
    // 调用 Engagia API
    const response = await fetch('http://engagia-s3.paitongai.net/api/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        html: props.htmlContent
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()

    if (!result.success) {
      throw new Error(result.message || '处理失败')
    }

    // 保存分享结果
    shareResult.value = result
    
    // 显示分享结果对话框
    shareDialogVisible.value = true
    
    ElMessage.success('生成分享内容成功！')
    
  } catch (error) {
    console.error('分享失败:', error)
    ElMessage.error('分享失败: ' + error.message)
  } finally {
    isSharing.value = false
  }
}

// 复制分享链接
const copyShareLink = async (url) => {
  try {
    await navigator.clipboard.writeText(url)
    ElMessage.success('链接已复制到剪贴板')
  } catch (e) {
    ElMessage.error('复制失败: ' + e.message)
  }
}

// 下载二维码
const downloadQRCode = (url) => {
  const link = document.createElement('a')
  link.href = url
  link.download = 'share-qrcode.png'
  link.click()
}

// 在新窗口打开
const openInNewWindow = (url) => {
  window.open(url, '_blank')
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

/* 分享对话框样式 - 产品化设计 */
.share-dialog {
  .el-dialog__body {
    padding: 0;
  }
}

.share-result-container {
  background: #f8f9fa;
}

/* 成功提示横幅 */
.share-success-banner {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  
  .success-icon {
    font-size: 48px;
    color: #4ade80;
  }
  
  .success-text {
    h3 {
      margin: 0 0 8px 0;
      font-size: 20px;
      font-weight: 600;
    }
    
    p {
      margin: 0;
      opacity: 0.95;
      font-size: 14px;
    }
  }
}

/* 主内容布局 */
.share-content-layout {
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 24px;
  padding: 24px;
  
  &.mobile-layout {
    grid-template-columns: 1fr;
    padding: 16px;
  }
}

/* 卡片预览区 */
.cards-preview-section {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    
    h4 {
      margin: 0;
      font-size: 16px;
      color: #303133;
    }
  }
  
  .cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 12px;
    
    @media (max-width: 768px) {
      grid-template-columns: repeat(3, 1fr);
    }
  }
  
  .card-thumbnail {
    position: relative;
    aspect-ratio: 3/4;
    border-radius: 8px;
    overflow: hidden;
    cursor: pointer;
    transition: transform 0.3s ease;
    background: #f5f5f5;
    
    &:hover {
      transform: scale(1.05);
      
      .card-overlay {
        opacity: 1;
      }
    }
    
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    .card-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, 0.7) 100%);
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      align-items: center;
      padding: 8px;
      opacity: 0;
      transition: opacity 0.3s ease;
      
      .card-number {
        color: white;
        font-size: 12px;
        font-weight: 600;
      }
      
      .expand-icon {
        color: white;
        font-size: 20px;
        margin-top: 4px;
      }
    }
  }
  
  .more-cards-hint {
    text-align: center;
    color: #909399;
    font-size: 14px;
    margin-top: 12px;
    padding: 8px;
    background: #f5f7fa;
    border-radius: 6px;
  }
}

/* 分享操作区 */
.share-actions-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.quick-share-panel {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  
  h4 {
    margin: 0 0 16px 0;
    font-size: 16px;
    color: #303133;
  }
  
  .share-link-card {
    margin-bottom: 16px;
    
    label {
      display: block;
      margin-bottom: 8px;
      font-size: 13px;
      color: #606266;
      font-weight: 500;
    }
    
    .link-input-group {
      display: flex;
      gap: 8px;
      
      .el-input {
        flex: 1;
      }
    }
  }
  
  .qr-code-section {
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid #e4e7ed;
    
    label {
      display: block;
      margin-bottom: 12px;
      font-size: 13px;
      color: #606266;
      font-weight: 500;
    }
    
    .qr-code-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      
      .qr-code-image {
        width: 150px;
        height: 150px;
        border: 1px solid #e4e7ed;
        border-radius: 8px;
        padding: 8px;
        background: white;
      }
      
      .download-qr-btn {
        width: 100%;
        max-width: 150px;
      }
    }
  }
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
  
  .el-button {
    width: 100%;
    height: 44px;
    font-size: 15px;
    
    &.primary-action-btn {
      background: linear-gradient(135deg, #ff6b6b 0%, #ff3838 100%);
      border-color: #ff3838;
      
      &:hover {
        background: linear-gradient(135deg, #ff5252 0%, #ff1f1f 100%);
        border-color: #ff1f1f;
      }
    }
  }
}

.usage-tips {
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 8px;
  padding: 16px;
  
  h5 {
    margin: 0 0 12px 0;
    font-size: 14px;
    color: #92400e;
  }
  
  ul {
    margin: 0;
    padding-left: 20px;
    
    li {
      color: #78350f;
      font-size: 13px;
      line-height: 1.8;
    }
  }
}

.share-footer-info {
  background: white;
  padding: 16px 24px;
  border-top: 1px solid #e4e7ed;
  
  .el-descriptions {
    margin: 0;
  }
}

/* 移动端适配 */
@media (max-width: 768px) {
  .share-content-layout {
    .cards-preview-section {
      .cards-grid {
        gap: 8px;
      }
    }
    
    .share-actions-section {
      .quick-share-panel {
        .qr-code-section {
          .qr-code-wrapper {
            .qr-code-image {
              width: 120px;
              height: 120px;
            }
          }
        }
      }
    }
  }
}
</style>