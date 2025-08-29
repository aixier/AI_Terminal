<template>
  <MessageCard 
    type="html"
    :content="actualHtmlContent"
    :timestamp="timestamp"
    :show-actions="true"
    :can-download="true"
    :title="displayTopic"
    @copy="handleCopy"
    @download="handleDownload"
  >
    <div class="html-preview-container">
      <div class="preview-toolbar">
        <el-radio-group v-model="viewMode" size="small">
          <el-radio-button label="preview">预览</el-radio-button>
          <el-radio-button label="code">代码</el-radio-button>
        </el-radio-group>
      </div>
      
      <div v-if="viewMode === 'preview'" class="html-preview">
        <div v-if="isLoading" class="preview-loading">
          <el-icon class="is-loading"><Loading /></el-icon>
          <span>加载中...</span>
        </div>
        <iframe
          v-else
          ref="previewFrame"
          :srcdoc="processedHtml"
          class="preview-iframe"
          @load="handleIframeLoad"
          sandbox="allow-scripts allow-same-origin"
        ></iframe>
      </div>
      
      <div v-else class="html-code">
        <pre class="code-block"><code v-html="highlightedCode"></code></pre>
      </div>
    </div>
    
    <template #actions>
      <el-button 
        size="small"
        @click="handleFullscreen"
        :icon="FullScreen"
      >
        全屏预览
      </el-button>
      <el-button 
        size="small"
        @click="handleDownload"
        :icon="Download"
      >
        下载
      </el-button>
      <el-button 
        size="small"
        @click="refreshPreview"
        :icon="Refresh"
      >
        刷新
      </el-button>
    </template>
  </MessageCard>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { ElButton, ElRadioGroup, ElRadioButton, ElIcon, ElMessage } from 'element-plus'
import { Refresh, FullScreen, CopyDocument, Download, Loading } from '@element-plus/icons-vue'
import MessageCard from './MessageCard.vue'
import hljs from 'highlight.js/lib/core'
import xml from 'highlight.js/lib/languages/xml'
import 'highlight.js/styles/github.css'

hljs.registerLanguage('html', xml)

const props = defineProps({
  // API响应数据
  resultData: {
    type: Object,
    default: null
  },
  // 兼容旧格式
  htmlContent: {
    type: String,
    default: ''
  },
  timestamp: {
    type: [Date, Number],
    default: () => new Date()
  },
  fileName: {
    type: String,
    default: 'generated.html'
  },
  // 主题名称
  topic: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['copy', 'download', 'fullscreen'])

const viewMode = ref('preview')
const isLoading = ref(true)
const previewFrame = ref(null)

// 计算实际的HTML内容
const actualHtmlContent = computed(() => {
  // 优先使用API响应数据
  if (props.resultData && props.resultData.content) {
    // 如果content是对象并且包含HTML内容
    if (typeof props.resultData.content === 'object' && props.resultData.content.html) {
      return props.resultData.content.html
    }
    // 如果content直接是HTML字符串
    if (typeof props.resultData.content === 'string') {
      return props.resultData.content
    }
  }
  // 兼容旧格式
  return props.htmlContent
})

// 获取卡片名称（使用content作为标题）
const displayTopic = computed(() => {
  // 根据需求：使用content作为卡片信息名称
  if (props.resultData && props.resultData.content) {
    // 如果content是HTML，提取前50个字符作为标题
    if (typeof props.resultData.content === 'string') {
      const plainText = props.resultData.content.replace(/<[^>]*>/g, '').trim()
      return plainText.length > 50 ? plainText.substring(0, 50) + '...' : plainText
    }
    if (typeof props.resultData.content === 'object' && props.resultData.content.html) {
      const plainText = props.resultData.content.html.replace(/<[^>]*>/g, '').trim()
      return plainText.length > 50 ? plainText.substring(0, 50) + '...' : plainText
    }
  }
  // 后备方案
  if (props.resultData && props.resultData.topic) {
    return props.resultData.topic
  }
  return props.topic || 'HTML卡片'
})

// 获取文件名
const actualFileName = computed(() => {
  if (props.resultData && props.resultData.fileName) {
    return props.resultData.fileName
  }
  return props.fileName
})

const processedHtml = computed(() => {
  if (!actualHtmlContent.value) return ''
  
  // 如果HTML内容不包含完整的文档结构，添加基础结构
  if (!actualHtmlContent.value.includes('<!DOCTYPE') && !actualHtmlContent.value.includes('<html')) {
    return `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            padding: 20px;
            margin: 0;
          }
        </style>
      </head>
      <body>
        ${actualHtmlContent.value}
      </body>
      </html>
    `
  }
  return actualHtmlContent.value
})

const highlightedCode = computed(() => {
  if (!actualHtmlContent.value) return ''
  try {
    return hljs.highlight(actualHtmlContent.value, { language: 'html' }).value
  } catch (error) {
    console.error('Code highlighting failed:', error)
    return actualHtmlContent.value
  }
})

const refreshPreview = () => {
  isLoading.value = true
  if (previewFrame.value) {
    previewFrame.value.srcdoc = processedHtml.value
  }
}

const handleIframeLoad = () => {
  isLoading.value = false
  
  // 自动调整iframe高度
  if (previewFrame.value && previewFrame.value.contentWindow) {
    try {
      const doc = previewFrame.value.contentWindow.document
      const height = Math.max(
        doc.body.scrollHeight,
        doc.body.offsetHeight,
        doc.documentElement.clientHeight,
        doc.documentElement.scrollHeight,
        doc.documentElement.offsetHeight
      )
      previewFrame.value.style.height = `${Math.min(height + 20, 600)}px`
    } catch (error) {
      console.error('Failed to adjust iframe height:', error)
    }
  }
}

const handleCopy = async () => {
  try {
    await navigator.clipboard.writeText(actualHtmlContent.value)
    ElMessage.success('HTML代码已复制')
    emit('copy', actualHtmlContent.value)
  } catch (error) {
    console.error('Copy failed:', error)
    ElMessage.error('复制失败')
  }
}

const handleDownload = () => {
  const blob = new Blob([actualHtmlContent.value], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = actualFileName.value
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  
  ElMessage.success('下载成功')
  emit('download', actualFileName.value)
}

const handleFullscreen = () => {
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.top = '0'
  iframe.style.left = '0'
  iframe.style.width = '100%'
  iframe.style.height = '100%'
  iframe.style.zIndex = '9999'
  iframe.style.backgroundColor = '#fff'
  iframe.style.border = 'none'
  iframe.srcdoc = processedHtml.value
  
  const closeBtn = document.createElement('button')
  closeBtn.innerHTML = '✕'
  closeBtn.style.position = 'fixed'
  closeBtn.style.top = '20px'
  closeBtn.style.right = '20px'
  closeBtn.style.zIndex = '10000'
  closeBtn.style.width = '40px'
  closeBtn.style.height = '40px'
  closeBtn.style.borderRadius = '50%'
  closeBtn.style.border = 'none'
  closeBtn.style.backgroundColor = '#f56c6c'
  closeBtn.style.color = '#fff'
  closeBtn.style.fontSize = '20px'
  closeBtn.style.cursor = 'pointer'
  closeBtn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)'
  
  closeBtn.onclick = () => {
    document.body.removeChild(iframe)
    document.body.removeChild(closeBtn)
  }
  
  document.body.appendChild(iframe)
  document.body.appendChild(closeBtn)
  
  emit('fullscreen')
}

watch(viewMode, (newMode) => {
  if (newMode === 'preview') {
    isLoading.value = true
  }
})

onMounted(() => {
  if (viewMode.value === 'preview') {
    refreshPreview()
  }
})
</script>

<style scoped>
.html-preview-container {
  width: 100%;
}

.preview-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding: 8px;
  background: #f5f5f5;
  border-radius: 4px;
}

.html-preview {
  position: relative;
  width: 100%;
  min-height: 200px;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
}

.preview-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: #999;
}

.preview-loading span {
  margin-left: 8px;
}

.preview-iframe {
  width: 100%;
  min-height: 200px;
  border: none;
  background: #fff;
}

.html-code {
  width: 100%;
  max-height: 500px;
  overflow: auto;
  background: #f8f8f8;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
}

.code-block {
  margin: 0;
  padding: 16px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  line-height: 1.5;
}

.code-block code {
  background: transparent;
  padding: 0;
}

:deep(.is-loading) {
  animation: rotating 2s linear infinite;
}

@keyframes rotating {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>