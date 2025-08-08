<template>
  <div class="preview-renderer">
    <!-- 模式选择器 -->
    <div class="preview-mode-selector" v-if="showModeSelector">
      <button 
        v-for="mode in availableModes" 
        :key="mode.value"
        @click="currentMode = mode.value"
        :class="['mode-btn', { active: currentMode === mode.value }]"
      >
        <span class="mode-icon">{{ mode.icon }}</span>
        <span class="mode-label">{{ mode.label }}</span>
      </button>
    </div>

    <!-- 不同的预览模式 -->
    <div class="preview-content">
      <!-- 1. 卡片模式 - 最佳用户体验 -->
      <div v-if="currentMode === 'card'" class="card-preview">
        <div class="card-container">
          <div class="card-header">
            <img :src="metadata.favicon" class="site-icon" v-if="metadata.favicon" />
            <div class="site-info">
              <div class="site-name">{{ metadata.siteName || getDomain(url) }}</div>
              <div class="site-url">{{ url }}</div>
            </div>
            <a :href="url" target="_blank" class="open-external">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M10.5 1H15v4.5h-1V2.707l-7.146 7.147-.708-.708L13.293 2H10.5V1zM13 13V7h1v6a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h6v1H2v10h11z"/>
              </svg>
            </a>
          </div>
          
          <div class="card-body">
            <h2 class="card-title">{{ metadata.title }}</h2>
            <p class="card-description">{{ metadata.description }}</p>
            
            <!-- 图片预览 -->
            <div class="card-images" v-if="metadata.images && metadata.images.length > 0">
              <div 
                v-for="(img, index) in metadata.images.slice(0, 4)" 
                :key="index"
                class="card-image"
                :style="{ backgroundImage: `url(${img})` }"
                @click="openImageViewer(img)"
              />
            </div>
            
            <!-- 元数据标签 -->
            <div class="card-meta">
              <span class="meta-tag" v-if="metadata.author">
                <span class="meta-icon">👤</span> {{ metadata.author }}
              </span>
              <span class="meta-tag" v-if="metadata.publishDate">
                <span class="meta-icon">📅</span> {{ formatDate(metadata.publishDate) }}
              </span>
              <span class="meta-tag" v-if="metadata.readTime">
                <span class="meta-icon">⏱️</span> {{ metadata.readTime }}
              </span>
            </div>
          </div>
          
          <div class="card-footer">
            <button @click="fetchContent" class="btn-fetch" :disabled="loading">
              {{ loading ? '加载中...' : '获取完整内容' }}
            </button>
            <button @click="copyLink" class="btn-copy">复制链接</button>
          </div>
        </div>
      </div>

      <!-- 2. 阅读模式 - 专注内容 -->
      <div v-else-if="currentMode === 'reader'" class="reader-preview">
        <div class="reader-container">
          <div class="reader-header">
            <button @click="currentMode = 'card'" class="back-btn">← 返回</button>
            <div class="reader-actions">
              <button @click="adjustFontSize(-1)" class="font-size-btn">A-</button>
              <button @click="adjustFontSize(1)" class="font-size-btn">A+</button>
              <button @click="toggleTheme" class="theme-btn">
                {{ readerTheme === 'light' ? '🌙' : '☀️' }}
              </button>
            </div>
          </div>
          
          <article class="reader-content" :class="`theme-${readerTheme}`" :style="{ fontSize: fontSize + 'px' }">
            <h1>{{ metadata.title }}</h1>
            <div class="article-meta">
              <span v-if="metadata.author">作者：{{ metadata.author }}</span>
              <span v-if="metadata.publishDate">{{ formatDate(metadata.publishDate) }}</span>
            </div>
            <div class="article-body" v-html="sanitizedContent"></div>
          </article>
        </div>
      </div>

      <!-- 3. 截图模式 - 使用后端截图服务 -->
      <div v-else-if="currentMode === 'screenshot'" class="screenshot-preview">
        <div class="screenshot-container">
          <div class="screenshot-controls">
            <button @click="captureScreenshot" :disabled="capturing">
              {{ capturing ? '截图中...' : '刷新截图' }}
            </button>
            <select v-model="screenshotDevice" @change="captureScreenshot">
              <option value="desktop">桌面版</option>
              <option value="tablet">平板版</option>
              <option value="mobile">手机版</option>
            </select>
          </div>
          <img 
            v-if="screenshotUrl" 
            :src="screenshotUrl" 
            alt="网页截图"
            class="screenshot-image"
            @click="openImageViewer(screenshotUrl)"
          />
          <div v-else class="screenshot-placeholder">
            <p>点击"刷新截图"按钮生成网页截图</p>
          </div>
        </div>
      </div>

      <!-- 4. Webview模式 - 如果确实需要嵌入 -->
      <div v-else-if="currentMode === 'webview'" class="webview-preview">
        <div class="webview-notice">
          <p>⚠️ 某些网站可能因安全策略无法在嵌入式视图中正常显示</p>
        </div>
        <div class="webview-container">
          <webview 
            v-if="isElectron"
            :src="url"
            class="webview-element"
            :preload="preloadScript"
            :partition="partition"
            :useragent="userAgent"
            @did-finish-load="onWebviewLoad"
          />
          <iframe 
            v-else
            :src="proxyUrl || url"
            class="iframe-fallback"
            :sandbox="iframeSandbox"
            @load="onIframeLoad"
          />
        </div>
      </div>

      <!-- 5. API模式 - 直接调用平台API -->
      <div v-else-if="currentMode === 'api'" class="api-preview">
        <div class="api-container">
          <div class="api-status">
            <span class="status-indicator" :class="apiStatus"></span>
            <span>{{ apiStatusText }}</span>
          </div>
          <div class="api-content" v-if="apiData">
            <pre class="json-display">{{ JSON.stringify(apiData, null, 2) }}</pre>
          </div>
          <div class="api-actions">
            <button @click="callPlatformAPI" :disabled="loadingAPI">
              {{ loadingAPI ? '调用中...' : '调用API' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 图片查看器 -->
    <div v-if="showImageViewer" class="image-viewer" @click="closeImageViewer">
      <img :src="viewerImage" @click.stop />
      <button class="close-viewer" @click="closeImageViewer">×</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import DOMPurify from 'dompurify'

const props = defineProps({
  url: {
    type: String,
    required: true
  },
  type: {
    type: String,
    default: 'auto' // auto, xiaohongshu, weibo, zhihu, etc.
  },
  showModeSelector: {
    type: Boolean,
    default: true
  }
})

// 状态
const currentMode = ref('card')
const metadata = ref({})
const loading = ref(false)
const screenshotUrl = ref('')
const capturing = ref(false)
const screenshotDevice = ref('desktop')
const content = ref('')
const fontSize = ref(16)
const readerTheme = ref('light')
const showImageViewer = ref(false)
const viewerImage = ref('')
const apiData = ref(null)
const loadingAPI = ref(false)
const apiStatus = ref('idle')

// 计算属性
const apiStatusText = computed(() => {
  switch (apiStatus.value) {
    case 'loading': return '正在加载...'
    case 'success': return '加载成功'
    case 'error': return '加载失败'
    default: return '等待加载'
  }
})

const isElectron = computed(() => {
  return typeof window !== 'undefined' && window.process && window.process.type
})

const proxyUrl = computed(() => {
  // 使用代理服务绕过CORS
  return `/api/preview/proxy?url=${encodeURIComponent(props.url)}`
})

// 检测平台类型
const detectPlatform = (url) => {
  if (url.includes('xiaohongshu.com')) return 'xiaohongshu'
  if (url.includes('weibo.com')) return 'weibo'
  if (url.includes('zhihu.com')) return 'zhihu'
  if (url.includes('bilibili.com')) return 'bilibili'
  if (url.includes('douyin.com')) return 'douyin'
  return 'generic'
}

// 可用的预览模式
const availableModes = computed(() => {
  const platform = detectPlatform(props.url)
  const modes = [
    { value: 'card', label: '卡片视图', icon: '🎴' },
    { value: 'reader', label: '阅读模式', icon: '📖' },
    { value: 'screenshot', label: '网页截图', icon: '📸' }
  ]
  
  // 某些平台支持API模式
  if (['xiaohongshu', 'weibo', 'zhihu'].includes(platform)) {
    modes.push({ value: 'api', label: 'API数据', icon: '🔌' })
  }
  
  // Webview作为最后的选择
  modes.push({ value: 'webview', label: '嵌入视图', icon: '🌐' })
  
  return modes
})

// 获取元数据
const fetchMetadata = async () => {
  loading.value = true
  try {
    // 调用后端API获取网页元数据
    const response = await fetch('/api/preview/metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: props.url })
    })
    
    if (response.ok) {
      metadata.value = await response.json()
    }
  } catch (error) {
    console.error('Failed to fetch metadata:', error)
    // 使用默认值
    metadata.value = {
      title: '加载中...',
      description: '正在获取内容...',
      siteName: getDomain(props.url)
    }
  } finally {
    loading.value = false
  }
}

// 获取内容（用于阅读模式）
const fetchContent = async () => {
  loading.value = true
  try {
    const response = await fetch('/api/preview/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: props.url })
    })
    
    if (response.ok) {
      const data = await response.json()
      content.value = data.content
      metadata.value = { ...metadata.value, ...data.metadata }
      currentMode.value = 'reader'
    }
  } catch (error) {
    ElMessage.error('获取内容失败')
  } finally {
    loading.value = false
  }
}

// 截图功能
const captureScreenshot = async () => {
  capturing.value = true
  try {
    const response = await fetch('/api/preview/screenshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        url: props.url,
        device: screenshotDevice.value
      })
    })
    
    if (response.ok) {
      const blob = await response.blob()
      screenshotUrl.value = URL.createObjectURL(blob)
    }
  } catch (error) {
    ElMessage.error('截图失败')
  } finally {
    capturing.value = false
  }
}

// 调用平台API
const callPlatformAPI = async () => {
  loadingAPI.value = true
  apiStatus.value = 'loading'
  
  try {
    const platform = detectPlatform(props.url)
    const response = await fetch(`/api/platform/${platform}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: props.url })
    })
    
    if (response.ok) {
      apiData.value = await response.json()
      apiStatus.value = 'success'
    } else {
      apiStatus.value = 'error'
    }
  } catch (error) {
    apiStatus.value = 'error'
    ElMessage.error('API调用失败')
  } finally {
    loadingAPI.value = false
  }
}

// 工具函数
const getDomain = (url) => {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

const formatDate = (date) => {
  return new Date(date).toLocaleDateString('zh-CN')
}

const sanitizedContent = computed(() => {
  return DOMPurify.sanitize(content.value)
})

const adjustFontSize = (delta) => {
  fontSize.value = Math.max(12, Math.min(24, fontSize.value + delta))
}

const toggleTheme = () => {
  readerTheme.value = readerTheme.value === 'light' ? 'dark' : 'light'
}

const openImageViewer = (img) => {
  viewerImage.value = img
  showImageViewer.value = true
}

const closeImageViewer = () => {
  showImageViewer.value = false
  viewerImage.value = ''
}

const copyLink = async () => {
  try {
    await navigator.clipboard.writeText(props.url)
    ElMessage.success('链接已复制')
  } catch {
    ElMessage.error('复制失败')
  }
}

// 生命周期
onMounted(() => {
  fetchMetadata()
})

watch(() => props.url, () => {
  fetchMetadata()
})
</script>

<style scoped>
.preview-renderer {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
}

/* 模式选择器 */
.preview-mode-selector {
  display: flex;
  gap: 8px;
  padding: 12px;
  background: white;
  border-bottom: 1px solid #e0e0e0;
}

.mode-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
}

.mode-btn:hover {
  background: #e8e8e8;
}

.mode-btn.active {
  background: #4a9eff;
  color: white;
  border-color: #4a9eff;
}

.mode-icon {
  font-size: 16px;
}

/* 卡片模式 */
.card-preview {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}

.card-container {
  max-width: 600px;
  margin: 0 auto;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.card-header {
  display: flex;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #f0f0f0;
}

.site-icon {
  width: 24px;
  height: 24px;
  margin-right: 12px;
}

.site-info {
  flex: 1;
}

.site-name {
  font-weight: 500;
  color: #333;
}

.site-url {
  font-size: 12px;
  color: #999;
  margin-top: 2px;
}

.open-external {
  padding: 8px;
  color: #666;
  transition: color 0.2s;
}

.open-external:hover {
  color: #4a9eff;
}

.card-body {
  padding: 20px;
}

.card-title {
  font-size: 20px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 12px 0;
  line-height: 1.4;
}

.card-description {
  color: #666;
  line-height: 1.6;
  margin: 0 0 16px 0;
}

.card-images {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px;
  margin: 16px 0;
}

.card-image {
  aspect-ratio: 1;
  background-size: cover;
  background-position: center;
  border-radius: 8px;
  cursor: pointer;
  transition: transform 0.2s;
}

.card-image:hover {
  transform: scale(1.05);
}

.card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 16px;
}

.meta-tag {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #666;
}

.meta-icon {
  font-size: 14px;
}

.card-footer {
  display: flex;
  gap: 8px;
  padding: 16px;
  background: #fafafa;
  border-top: 1px solid #f0f0f0;
}

.btn-fetch,
.btn-copy {
  flex: 1;
  padding: 10px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-fetch {
  background: #4a9eff;
  color: white;
}

.btn-fetch:hover:not(:disabled) {
  background: #3a8eef;
}

.btn-fetch:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-copy {
  background: white;
  border: 1px solid #ddd;
  color: #666;
}

.btn-copy:hover {
  background: #f5f5f5;
}

/* 阅读模式 */
.reader-preview {
  flex: 1;
  background: white;
}

.reader-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.reader-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  border-bottom: 1px solid #e0e0e0;
}

.reader-actions {
  display: flex;
  gap: 8px;
}

.font-size-btn,
.theme-btn,
.back-btn {
  padding: 6px 12px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.font-size-btn:hover,
.theme-btn:hover,
.back-btn:hover {
  background: #f5f5f5;
}

.reader-content {
  flex: 1;
  overflow-y: auto;
  padding: 40px;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
}

.reader-content.theme-light {
  background: white;
  color: #333;
}

.reader-content.theme-dark {
  background: #1a1a1a;
  color: #e0e0e0;
}

.article-meta {
  display: flex;
  gap: 16px;
  margin: 16px 0 32px 0;
  padding-bottom: 16px;
  border-bottom: 1px solid #e0e0e0;
  font-size: 14px;
  color: #666;
}

.theme-dark .article-meta {
  border-color: #333;
  color: #999;
}

.article-body {
  line-height: 1.8;
}

.article-body img {
  max-width: 100%;
  height: auto;
  margin: 16px 0;
  border-radius: 8px;
}

/* 截图模式 */
.screenshot-preview {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.screenshot-container {
  max-width: 1200px;
  margin: 0 auto;
}

.screenshot-controls {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.screenshot-controls button,
.screenshot-controls select {
  padding: 8px 16px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.screenshot-image {
  width: 100%;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  cursor: zoom-in;
}

.screenshot-placeholder {
  height: 400px;
  background: white;
  border: 2px dashed #ddd;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
}

/* 图片查看器 */
.image-viewer {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  cursor: zoom-out;
}

.image-viewer img {
  max-width: 90%;
  max-height: 90%;
  cursor: default;
}

.close-viewer {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 40px;
  height: 40px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  font-size: 24px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-viewer:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* Webview模式 */
.webview-preview {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.webview-notice {
  padding: 12px;
  background: #fff3cd;
  border-bottom: 1px solid #ffc107;
  color: #856404;
  font-size: 14px;
}

.webview-container {
  flex: 1;
  position: relative;
}

.webview-element,
.iframe-fallback {
  width: 100%;
  height: 100%;
  border: none;
}

/* API模式 */
.api-preview {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.api-container {
  max-width: 1200px;
  margin: 0 auto;
}

.api-status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  padding: 12px;
  background: white;
  border-radius: 6px;
}

.status-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #ccc;
}

.status-indicator.loading {
  background: #ffc107;
  animation: pulse 1s infinite;
}

.status-indicator.success {
  background: #4caf50;
}

.status-indicator.error {
  background: #f44336;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.api-content {
  background: white;
  border-radius: 6px;
  padding: 20px;
  margin-bottom: 16px;
}

.api-actions {
  display: flex;
  gap: 12px;
}

.api-actions button {
  padding: 10px 20px;
  border: none;
  background: #4a9eff;
  color: white;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.api-actions button:hover:not(:disabled) {
  background: #3a8eef;
}

.api-actions button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.json-display {
  background: #f5f5f5;
  padding: 16px;
  border-radius: 4px;
  overflow-x: auto;
  font-family: 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.4;
  color: #333;
}
</style>