<template>
  <div class="smart-url-preview">
    <!-- 智能预览容器 -->
    <div ref="previewContainer" class="preview-container" :class="previewStatus">
      <!-- 加载中状态 -->
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <p>正在加载预览...</p>
      </div>
      
      <!-- iframe预览（如果支持） -->
      <iframe 
        v-else-if="canEmbed"
        :src="embedUrl"
        class="preview-iframe"
        :sandbox="sandboxPolicy"
        @load="onIframeLoad"
        @error="onIframeError"
        frameborder="0"
      ></iframe>
      
      <!-- 降级方案：预览卡片 -->
      <div v-else class="fallback-card">
        <div class="card-icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/>
          </svg>
        </div>
        
        <div class="card-content">
          <h3 class="card-title">{{ metadata.title || '外部链接' }}</h3>
          <p class="card-description">{{ metadata.description || url }}</p>
          
          <div class="card-meta" v-if="metadata.siteName">
            <span class="meta-site">{{ metadata.siteName }}</span>
            <span class="meta-domain">{{ getDomain(url) }}</span>
          </div>
        </div>
        
        <div class="card-actions">
          <button @click="openInNewWindow" class="btn-open">
            <span>在新窗口打开</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M10.5 1H15v4.5h-1V2.707l-7.146 7.147-.708-.708L13.293 2H10.5V1zM13 13V7h1v6a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h6v1H2v10h11z"/>
            </svg>
          </button>
          
          <button @click="copyUrl" class="btn-copy">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
              <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
    
    <!-- 错误提示 -->
    <div v-if="error" class="error-message">
      <span>⚠️ {{ error }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'

const props = defineProps({
  url: {
    type: String,
    required: true
  }
})

// 状态
const loading = ref(true)
const canEmbed = ref(false)
const embedUrl = ref('')
const metadata = ref({})
const previewStatus = ref('')
const error = ref('')

// 沙箱策略
const sandboxPolicy = ref('allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox')

// 可嵌入的域名白名单
const EMBEDDABLE_DOMAINS = [
  'youtube.com',
  'youtu.be',
  'vimeo.com',
  'dailymotion.com',
  'bilibili.com',
  'codepen.io',
  'codesandbox.io',
  'jsfiddle.net',
  'stackblitz.com',
  'github.com/gist',
  'spotify.com',
  'soundcloud.com'
]

// 检查URL是否可以嵌入
const checkEmbeddable = async (url) => {
  const domain = getDomain(url)
  
  // 特殊处理某些平台
  if (domain.includes('youtube.com') || domain.includes('youtu.be')) {
    embedUrl.value = convertYoutubeUrl(url)
    return true
  }
  if (domain.includes('bilibili.com')) {
    embedUrl.value = convertBilibiliUrl(url)
    return true
  }
  
  // 直接允许所有URL嵌入
  embedUrl.value = url
  return true
}

// YouTube URL转换
const convertYoutubeUrl = (url) => {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)
  if (match) {
    return `https://www.youtube.com/embed/${match[1]}`
  }
  return url
}

// Bilibili URL转换
const convertBilibiliUrl = (url) => {
  const match = url.match(/bilibili\.com\/video\/(BV[\w]+)/)
  if (match) {
    return `https://player.bilibili.com/player.html?bvid=${match[1]}`
  }
  return url
}

// 尝试代理（检查后端是否支持）
const tryProxy = async (url) => {
  // 暂时禁用代理检查，因为后端未实现此 API
  // TODO: 将来可以实现这个 API 来支持更好的跨域预览
  return false
  
  /* 保留原代码供将来实现时参考
  try {
    const response = await fetch('/api/preview/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    })
    return response.ok
  } catch {
    return false
  }
  */
}

// 获取元数据（用于降级显示）
const fetchMetadata = async (url) => {
  // 直接使用默认值，因为后端未实现元数据 API
  // TODO: 将来可以实现这个 API 来获取页面的 Open Graph 元数据
  metadata.value = {
    title: getDomain(url),
    description: url,
    siteName: getDomain(url)
  }
  return
  
  /* 保留原代码供将来实现时参考
  try {
    const response = await fetch('/api/preview/metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    })
    
    if (response.ok) {
      metadata.value = await response.json()
    } else {
      // 使用默认值
      metadata.value = {
        title: getDomain(url),
        description: url,
        siteName: getDomain(url)
      }
    }
  } catch (err) {
    console.error('Failed to fetch metadata:', err)
    metadata.value = {
      title: '外部链接',
      description: url
    }
  }
  */
}

// 获取域名
const getDomain = (url) => {
  try {
    const u = new URL(url)
    return u.hostname.replace('www.', '')
  } catch {
    return url
  }
}

// iframe加载成功
const onIframeLoad = () => {
  loading.value = false
  previewStatus.value = 'loaded'
  error.value = ''
}

// iframe加载失败
const onIframeError = () => {
  console.warn('Iframe failed to load, falling back to card view')
  canEmbed.value = false
  loading.value = false
  previewStatus.value = 'fallback'
}

// 在新窗口打开
const openInNewWindow = () => {
  window.open(props.url, '_blank', 'noopener,noreferrer')
}

// 复制URL
const copyUrl = async () => {
  try {
    await navigator.clipboard.writeText(props.url)
    ElMessage.success('链接已复制')
  } catch {
    ElMessage.error('复制失败')
  }
}

// 初始化
const init = async () => {
  loading.value = true
  error.value = ''
  
  try {
    // 检查是否可以嵌入
    canEmbed.value = await checkEmbeddable(props.url)
    
    if (!canEmbed.value) {
      // 如果不能嵌入，获取元数据用于卡片显示
      await fetchMetadata(props.url)
      previewStatus.value = 'fallback'
    }
  } catch (err) {
    console.error('Preview initialization failed:', err)
    error.value = '预览加载失败'
    canEmbed.value = false
    previewStatus.value = 'error'
  } finally {
    loading.value = false
  }
}

// 生命周期
onMounted(() => {
  init()
})

// 监听URL变化
watch(() => props.url, () => {
  init()
})
</script>

<style scoped>
.smart-url-preview {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.preview-container {
  flex: 1;
  background: #f5f5f5;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  min-height: 400px;
}

/* 加载状态 */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #666;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e0e0e0;
  border-top-color: #4a9eff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* iframe预览 */
.preview-iframe {
  width: 100%;
  height: 100%;
  border: none;
  background: white;
}

/* 降级卡片 */
.fallback-card {
  background: white;
  border-radius: 8px;
  padding: 40px;
  text-align: center;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 90%;
  max-width: 500px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.card-icon {
  color: #4a9eff;
  margin-bottom: 24px;
}

.card-content {
  margin-bottom: 24px;
}

.card-title {
  font-size: 20px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 12px 0;
}

.card-description {
  color: #666;
  font-size: 14px;
  line-height: 1.5;
  margin: 0 0 16px 0;
  word-break: break-all;
  max-height: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.card-meta {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 12px;
  color: #999;
}

.meta-site {
  padding: 4px 8px;
  background: #f0f0f0;
  border-radius: 4px;
}

.card-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.btn-open,
.btn-copy {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-open {
  background: #4a9eff;
  color: white;
}

.btn-open:hover {
  background: #3a8eef;
  transform: translateY(-1px);
}

.btn-copy {
  background: white;
  color: #666;
  border: 1px solid #ddd;
}

.btn-copy:hover {
  background: #f5f5f5;
  border-color: #4a9eff;
  color: #4a9eff;
}

/* 错误提示 */
.error-message {
  padding: 12px;
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 4px;
  color: #856404;
  font-size: 14px;
  margin-top: 12px;
}

/* 状态样式 */
.preview-container.loaded {
  background: white;
}

.preview-container.fallback {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.preview-container.error {
  background: #fef2f2;
}
</style>