<template>
  <MessageCard 
    type="file"
    :content="actualHtmlContent"
    :timestamp="timestamp"
    :show-actions="true"
    :can-download="true"
    :title="cardTitle"
    :subtitle="displayTopic"
    @copy="handleCopy"
    @download="handleDownload"
  >
    <!-- 简化层级，直接显示预览 -->
    <div v-show="isLoading" class="preview-loading">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>加载中...</span>
    </div>
    <iframe
      v-show="!isLoading"
      ref="previewFrame"
      :srcdoc="processedHtml"
      class="preview-iframe"
      @load="handleIframeLoad"
      sandbox="allow-scripts allow-same-origin"
    ></iframe>
    
    <template #actions>
      <el-button 
        size="small"
        @click="handleFullscreen"
        :icon="FullScreen"
        circle
        title="全屏预览"
      />
      <el-button 
        size="small"
        @click="handleDownload"
        :icon="Download"
        circle
        title="下载HTML"
      />
      <el-button 
        size="small"
        @click="refreshPreview"
        :icon="Refresh"
        circle
        title="刷新预览"
      />
      <el-button 
        size="small"
        @click="handleShare"
        :icon="Share"
        circle
        title="分享"
      />
    </template>
  </MessageCard>
  
  <!-- 社媒分享选择对话框 -->
  <SocialShareDialog
    :visible="showSocialShareDialog"
    :share-data="shareData"
    :is-mobile="isMobile"
    @close="closeSocialShareDialog"
    @share-success="handleShareSuccess"
  />
  
  <!-- 小红书分享结果对话框 -->
  <ShareDialog
    :visible="shareDialogVisible"
    :share-result="shareResult"
    :loading-progress="loadingProgress"
    :is-mobile="isMobile"
    @close="closeShareDialog"
    @copy-content="copyShareContent"
    @copy-link="copyLink"
    @copy-short-link="copyShortLink"
    @open-link="openShareLink"
  />
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { ElButton, ElIcon, ElMessage } from 'element-plus'
import { Refresh, FullScreen, CopyDocument, Download, Loading, Share } from '@element-plus/icons-vue'
import MessageCard from './MessageCard.vue'
import SocialShareDialog from '../components/SocialShareDialog.vue'
import ShareDialog from '../components/ShareDialog.vue'
import { useXiaohongshuShare } from '../../../composables/useXiaohongshuShare'
// 移除highlight.js相关导入，不再需要代码高亮

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

// 移除viewMode，直接使用预览模式
const isLoading = ref(false) // 初始设为false，因为使用v-show
const previewFrame = ref(null)

// 备用方案：通过文件路径从后端获取HTML内容
const fetchHtmlContentByFilePath = async () => {
  try {
    console.log('[debug0.01][HtmlMessageCard] 开始从后端获取HTML文件')
    console.log('[debug0.01] resultData:', props.resultData)
    
    const username = localStorage.getItem('username') || 'default'
    
    let relativePath = null
    
    // 方法1：从 resultData.allFiles 中找到 HTML 文件
    if (props.resultData && props.resultData.allFiles) {
      const htmlFile = props.resultData.allFiles.find(file => file.fileType === 'html')
      if (htmlFile && htmlFile.fileName) {
        // 使用 topic 和 fileName 构建路径
        const sanitizedTopic = props.resultData.sanitizedTopic || props.resultData.topic?.trim().replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')
        relativePath = `card/${sanitizedTopic}/${htmlFile.fileName}`
        console.log('[debug0.01] 从 allFiles 构建路径:', relativePath)
        console.log('[debug0.01] HTML文件信息:', htmlFile)
      }
    }
    
    // 方法2：从 resultData.fileName 构建路径
    if (!relativePath && props.resultData && props.resultData.fileName && props.resultData.fileName.endsWith('.html')) {
      const sanitizedTopic = props.resultData.sanitizedTopic || props.resultData.topic?.trim().replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')
      relativePath = `card/${sanitizedTopic}/${props.resultData.fileName}`
      console.log('[debug0.01] 从 fileName 构建路径:', relativePath)
    }
    
    // 方法3：后备方案，使用传入的参数
    if (!relativePath) {
      const fileName = actualFileName.value
      const topic = displayTopic.value
      if (fileName && fileName.endsWith('.html')) {
        const sanitizedTopic = topic.trim().replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')
        relativePath = `card/${sanitizedTopic}/${fileName}`
        console.log('[debug0.01] 使用后备方案构建路径:', relativePath)
      }
    }
    
    if (!relativePath) {
      console.warn('[debug0.01] 无法构建有效的文件路径')
      return null
    }
    
    console.log('[debug0.01] 请求参数 - 用户名:', username)
    console.log('[debug0.01] 请求参数 - 路径:', relativePath)
    
    const response = await fetch(`/api/workspace/${username}/file/${encodeURIComponent(relativePath)}`)
    
    if (response.ok) {
      const data = await response.json()
      console.log('[debug0.01] 返回结果 - 成功获取HTML文件，长度:', data.content?.length)
      return data.content
    } else {
      console.warn('[debug0.01] 返回结果 - 获取失败:', response.status, response.statusText)
      return null
    }
  } catch (error) {
    console.error('[debug0.01] 返回结果 - 出错:', error)
    return null
  }
}

// 响应式HTML内容（支持异步加载）
const htmlContentFromApi = ref('')
const isLoadingContent = ref(false)

// 计算实际的HTML内容
const actualHtmlContent = computed(() => {
  console.log('[debug0.01][HtmlMessageCard] 计算HTML内容')
  console.log('[debug0.01] props.resultData:', props.resultData)
  console.log('[debug0.01] props.htmlContent 长度:', props.htmlContent?.length)
  console.log('[debug0.01] props.topic:', props.topic)
  console.log('[debug0.01] props.fileName:', props.fileName)
  
  // 如果已经通过API获取到内容，使用它
  if (htmlContentFromApi.value) {
    console.log('[debug0.01] 使用API获取的HTML内容，长度:', htmlContentFromApi.value.length)
    return htmlContentFromApi.value
  }
  
  // 优先使用API响应数据
  if (props.resultData) {
    console.log('[debug0.01] 检查 resultData 结构:', {
      hasContent: !!props.resultData.content,
      contentType: typeof props.resultData.content,
      hasAllFiles: !!props.resultData.allFiles,
      allFilesLength: props.resultData.allFiles?.length
    })
    
    // 优先使用 resultData.content（如果是有效的HTML字符串）
    if (props.resultData.content && typeof props.resultData.content === 'string') {
      const contentStr = props.resultData.content
      if (contentStr.includes('<!DOCTYPE') || contentStr.includes('<html')) {
        console.log('[debug0.01] 使用 resultData.content (HTML), 长度:', contentStr.length)
        return contentStr
      }
    }
    
    // 其次从 allFiles 中获取 HTML 内容
    if (props.resultData.allFiles && props.resultData.allFiles.length > 0) {
      const htmlFile = props.resultData.allFiles.find(file => file.fileType === 'html')
      if (htmlFile) {
        console.log('[debug0.01] 找到 HTML 文件:', htmlFile.fileName)
        // 如果 htmlFile 有 content 属性，直接使用
        if (htmlFile.content && typeof htmlFile.content === 'string') {
          console.log('[debug0.01] 使用 allFiles 中的 HTML 内容, 长度:', htmlFile.content.length)
          return htmlFile.content
        }
        // 如果没有 content，需要从 API 获取
        console.log('[debug0.01] HTML 文件没有 content 属性，需要从 API 获取')
        tryFetchHtmlFile()
      }
    }
    
    // 如果没有找到有效的HTML内容，尝试从API获取
    console.log('[debug0.01] 未找到有效HTML内容，尝试从API获取')
    tryFetchHtmlFile()
  }
  
  // 兼容旧格式
  if (props.htmlContent) {
    console.log('[debug0.01] 使用 props.htmlContent, 长度:', props.htmlContent.length)
    return props.htmlContent
  }
  
  console.log('[debug0.01] 没有找到任何HTML内容')
  return ''
})

// 尝试获取HTML文件
const tryFetchHtmlFile = async () => {
  if (isLoadingContent.value) return // 防止重复请求
  
  console.log('[debug0.01][HtmlMessageCard] 开始异步获取HTML文件')
  isLoadingContent.value = true
  const content = await fetchHtmlContentByFilePath()
  if (content) {
    console.log('[debug0.01][HtmlMessageCard] 异步获取成功，内容长度:', content.length)
    htmlContentFromApi.value = content
  } else {
    console.log('[debug0.01][HtmlMessageCard] 异步获取失败')
  }
  isLoadingContent.value = false
}

// 获取卡片标题 - 只显示文件名
const cardTitle = computed(() => {
  const fileName = actualFileName.value
  // 如果文件名太长，截取显示
  if (fileName && fileName.length > 30) {
    return fileName.substring(0, 27) + '...'
  }
  return fileName || 'HTML预览'
})

// 保留displayTopic用于其他地方引用
const displayTopic = computed(() => {
  return props.resultData?.topic || props.topic || 'HTML卡片'
})

// 获取文件名
const actualFileName = computed(() => {
  // 优先从 allFiles 中获取 HTML 文件名
  if (props.resultData && props.resultData.allFiles) {
    const htmlFile = props.resultData.allFiles.find(file => file.fileType === 'html')
    if (htmlFile && htmlFile.fileName) {
      console.log('[debug0.01] 使用 allFiles 中的文件名:', htmlFile.fileName)
      return htmlFile.fileName
    }
  }
  // 其次使用 resultData.fileName
  if (props.resultData && props.resultData.fileName) {
    console.log('[debug0.01] 使用 resultData.fileName:', props.resultData.fileName)
    return props.resultData.fileName
  }
  // 最后使用默认值
  console.log('[debug0.01] 使用默认文件名:', props.fileName)
  return props.fileName
})

const processedHtml = computed(() => {
  const content = actualHtmlContent.value
  console.log('[debug0.01] processedHtml - 输入内容长度:', content?.length || 0)
  
  if (!content) {
    console.log('[debug0.01] processedHtml - 内容为空')
    return ''
  }
  
  // 如果HTML内容不包含完整的文档结构，添加基础结构
  if (!content.includes('<!DOCTYPE') && !content.includes('<html')) {
    console.log('[debug0.01] processedHtml - 添加HTML结构包装')
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
            color: #e2e8f0;
            background-color: #2d3748;
            padding: 20px;
            margin: 0;
          }
        </style>
      </head>
      <body>
        ${content}
      </body>
      </html>
    `
  }
  
  console.log('[debug0.01] processedHtml - 返回原始HTML内容')
  return content
})

// 移除highlightedCode，不再需要代码视图

const refreshPreview = () => {
  console.log('[debug0.01] refreshPreview 被调用')
  const htmlContent = processedHtml.value
  console.log('[debug0.01] 设置iframe srcdoc，内容长度:', htmlContent?.length || 0)
  
  if (!htmlContent) {
    console.log('[debug0.01] 没有HTML内容，跳过刷新')
    isLoading.value = false
    return
  }
  
  isLoading.value = true
  
  // 使用nextTick确保DOM已更新
  nextTick(() => {
    if (previewFrame.value) {
      previewFrame.value.srcdoc = htmlContent
      console.log('[debug0.01] iframe srcdoc 已设置')
      // 如果iframe没有触发load事件，3秒后强制隐藏loading
      setTimeout(() => {
        if (isLoading.value) {
          console.log('[debug0.01] 强制隐藏loading')
          isLoading.value = false
        }
      }, 3000)
    } else {
      console.log('[debug0.01] previewFrame.value 不存在')
      isLoading.value = false
    }
  })
}

const handleIframeLoad = () => {
  console.log('[debug0.01] iframe加载完成')
  isLoading.value = false
  
  // 延迟一下让内容完全渲染
  setTimeout(() => {
    adjustIframeHeight()
  }, 100)
}

const adjustIframeHeight = () => {
  if (previewFrame.value && previewFrame.value.contentWindow) {
    try {
      const doc = previewFrame.value.contentWindow.document
      console.log('[debug0.01] iframe文档内容长度:', doc.documentElement.innerHTML?.length || 0)
      
      // 获取内容实际高度（添加延迟确保内容渲染完成）
      let height = Math.max(
        doc.body.scrollHeight,
        doc.body.offsetHeight,
        doc.documentElement.clientHeight,
        doc.documentElement.scrollHeight,
        doc.documentElement.offsetHeight
      )
      
      console.log('[debug0.01] 计算的iframe高度:', height)
      
      // 如果高度为0，设置默认高度
      if (height === 0) {
        console.log('[debug0.01] 高度为0，使用默认高度')
        height = 320
      }
      
      // 移动端：设置4:3比例高度
      const isMobile = window.innerWidth < 768
      if (isMobile) {
        // 移动端使用4:3比例（宽度:高度 = 4:3，即高度 = 宽度 * 3/4）
        // 获取卡片容器的实际宽度
        const cardWidth = previewFrame.value.offsetWidth || window.innerWidth * 0.9
        const proportionalHeight = Math.round(cardWidth * 3 / 4) // 4:3比例
        const maxHeight = window.innerHeight * 0.4 // 最大不超过视口高度的40%
        const minHeight = 240 // 最小高度
        
        const finalHeight = Math.max(minHeight, Math.min(proportionalHeight, maxHeight))
        previewFrame.value.style.height = `${finalHeight}px`
        previewFrame.value.style.overflow = 'auto'
        previewFrame.value.style.webkitOverflowScrolling = 'touch'
      } else {
        // 桌面端：设置高度，最小250px，最大为视口的60%  
        const viewportHeight = window.innerHeight * 0.6
        const finalHeight = Math.max(250, Math.min(height, viewportHeight))
        previewFrame.value.style.height = `${finalHeight}px`
      }
    } catch (error) {
      console.error('[debug0.01] 调整iframe高度失败:', error)
      // 失败时设置默认高度
      previewFrame.value.style.height = '320px'
    }
  } else {
    console.log('[debug0.01] iframe引用不存在')
    // 设置默认高度
    if (previewFrame.value) {
      previewFrame.value.style.height = '320px'
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

// 检测是否移动端
const isMobile = computed(() => {
  return window.innerWidth <= 768
})

// 获取文件名（用于分享）
const fileName = computed(() => actualFileName.value)

// 获取文件夹名（用于分享）
const folderName = computed(() => {
  if (props.resultData) {
    // 优先从resultData中查找文件夹信息
    if (props.resultData.folderName) return props.resultData.folderName
    if (props.resultData.folder) return props.resultData.folder
    if (props.resultData.taskId) return props.resultData.taskId
    
    // 尝试从文件路径中提取文件夹名
    if (props.resultData.filePath) {
      const pathParts = props.resultData.filePath.split('/')
      // 查找card目录后的文件夹名
      const cardIndex = pathParts.indexOf('card')
      if (cardIndex >= 0 && cardIndex < pathParts.length - 2) {
        return pathParts[cardIndex + 1]
      }
    }
    
    // 从fileName中提取（如"8月的川西.html" -> "8月的川西"）
    if (props.resultData.fileName || props.fileName) {
      const name = props.resultData.fileName || props.fileName
      return name.replace(/\.(html|htm)$/i, '')
    }
  }
  return null
})

// 社媒分享相关状态
const showSocialShareDialog = ref(false)
const shareData = ref(null)

// 使用小红书分享hook
const {
  shareDialogVisible,
  shareResult,
  loadingProgress,
  closeShareDialog,
  copyShareContent,
  copyLink,
  copyShortLink,
  openShareLink
} = useXiaohongshuShare()

// 处理分享按钮点击
const handleShare = () => {
  // 准备分享数据
  shareData.value = {
    file: {
      name: fileName.value,
      content: actualHtmlContent.value
    },
    folder: {
      name: folderName.value || getFolderFromResultData()
    }
  }
  
  // 显示社媒选择对话框
  showSocialShareDialog.value = true
}

// 从resultData中获取文件夹名
const getFolderFromResultData = () => {
  if (!props.resultData) return null
  
  // 尝试从多个可能的字段获取文件夹名
  if (props.resultData.folderName) return props.resultData.folderName
  if (props.resultData.folder) return props.resultData.folder
  if (props.resultData.taskId) return props.resultData.taskId
  
  // 从文件路径提取
  if (props.resultData.filePath) {
    const pathParts = props.resultData.filePath.split('/')
    const cardIndex = pathParts.indexOf('card')
    if (cardIndex >= 0 && cardIndex < pathParts.length - 2) {
      return pathParts[cardIndex + 1]
    }
  }
  
  // 从文件名提取
  const name = props.resultData.fileName || props.fileName || ''
  return name.replace(/\.(html|htm)$/i, '') || null
}

// 处理社媒分享对话框关闭
const closeSocialShareDialog = () => {
  showSocialShareDialog.value = false
}

// 处理分享成功
const handleShareSuccess = (platform) => {
  console.log(`[HtmlMessageCard] 分享到${platform}成功`)
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

// 监听HTML内容变化，自动刷新预览
watch(actualHtmlContent, (newContent) => {
  console.log('[debug0.01] actualHtmlContent变化，新内容长度:', newContent?.length || 0)
  if (newContent) {
    nextTick(() => {
      refreshPreview()
    })
  }
})

// 监听processedHtml变化
watch(processedHtml, (newHtml) => {
  console.log('[debug0.01] processedHtml变化，新内容长度:', newHtml?.length || 0)
})

// 监听API获取的内容变化
watch(htmlContentFromApi, (newContent) => {
  if (newContent) {
    console.log('[debug0.01] API内容更新，长度:', newContent.length)
    nextTick(() => {
      refreshPreview()
    })
  }
})

onMounted(async () => {
  console.log('[debug0.01] HtmlMessageCard组件已挂载')
  console.log('[debug0.01] actualHtmlContent长度:', actualHtmlContent.value?.length || 0)
  
  // 如果没有HTML内容，但有文件信息，尝试从后端获取
  if (!actualHtmlContent.value && props.resultData && props.resultData.allFiles) {
    console.log('[debug0.01] 没有HTML内容，尝试从后端获取')
    isLoadingContent.value = true
    const content = await fetchHtmlContentByFilePath()
    if (content) {
      console.log('[debug0.01] 成功获取HTML内容，长度:', content.length)
      htmlContentFromApi.value = content
    } else {
      console.log('[debug0.01] 无法从后端获取HTML内容')
    }
    isLoadingContent.value = false
  }
  
  // 延迟刷新预览，确保DOM已就绪
  nextTick(() => {
    refreshPreview()
  })
})
</script>

<style scoped>
/* iOS Safari 全局兼容性修复 */
* {
  -webkit-tap-highlight-color: transparent; /* 移除点击高亮 */
}

/* 直接应用到iframe和loading，完全去除边距 */
.preview-loading {
  width: 100%; /* 占满宽度 */
  margin: 0; /* 无边距 */
  padding: 0; /* 无内边距 */
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 150px; /* 进一步降低最小高度 */
  height: 250px; /* 降低固定高度 */
  color: #666;
  background: #f8f9fa;
  border-radius: 4px;
}

.preview-loading span {
  margin-left: 8px;
  font-size: 14px;
}

.preview-iframe {
  width: 100%; /* 占满宽度 */
  margin: 0; /* 无边距 */
  padding: 0; /* 无内边距 */
  min-height: 240px; /* 最小高度240px */
  height: 280px; /* 默认高度（适配4:3比例） */
  max-height: 40vh; /* 最大高度为视口的40% */
  border: none;
  background: #ffffff;
  display: block;
  border-radius: 4px;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.05); /* 轻微边框效果 */
  overflow: auto; /* 允许滚动 */
  /* Safari/iOS 兼容性修复 */
  -webkit-overflow-scrolling: touch;
  -webkit-transform: translateZ(0); /* 启用硬件加速 */
  transform: translateZ(0);
}

/* 优化圆形按钮样式 */
:deep(.el-button.is-circle) {
  width: 32px;
  height: 32px;
  padding: 8px;
}

/* 让加载动画更明显 */
:deep(.is-loading) {
  font-size: 24px;
  color: #409eff;
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

/* iOS设备特殊处理 */
@supports (-webkit-touch-callout: none) {
  .preview-iframe {
    min-height: 200px; /* iOS上增加最小高度 */
    position: relative;
    overflow: auto;
    -webkit-overflow-scrolling: touch;
  }
}

/* iPhone横屏模式优化 */
@media screen and (max-width: 812px) and (orientation: landscape) {
  .preview-iframe {
    max-height: 35vh; /* 横屏时降低最大高度 */
  }
}
</style>