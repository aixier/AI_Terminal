<template>
  <div class="file-preview-overlay" @click.self="handleClose">
    <div class="preview-container">
      <div class="preview-header">
        <div class="preview-title">
          <Icon :name="getFileIcon(file)" />
          <span>{{ file.name }}</span>
        </div>
        <div class="preview-actions">
          <button class="btn-icon" @click="handleDownload" title="下载">
            <Icon name="download" />
          </button>
          <button class="btn-icon" @click="handleClose" title="关闭">
            <Icon name="close" />
          </button>
        </div>
      </div>
      
      <div class="preview-content">
        <!-- 图片预览 -->
        <div v-if="isImage" class="image-preview">
          <img :src="previewUrl" :alt="file.name" @load="handleImageLoad" />
        </div>
        
        <!-- 视频预览 -->
        <div v-else-if="isVideo" class="video-preview">
          <video controls :src="previewUrl">
            您的浏览器不支持视频播放
          </video>
        </div>
        
        <!-- 音频预览 -->
        <div v-else-if="isAudio" class="audio-preview">
          <div class="audio-icon">
            <Icon name="audio" size="large" />
          </div>
          <audio controls :src="previewUrl">
            您的浏览器不支持音频播放
          </audio>
        </div>
        
        <!-- PDF预览 -->
        <div v-else-if="isPDF" class="pdf-preview">
          <iframe :src="previewUrl" frameborder="0"></iframe>
        </div>
        
        <!-- 文本预览 -->
        <div v-else-if="isText" class="text-preview">
          <pre>{{ textContent }}</pre>
        </div>
        
        <!-- 代码预览 -->
        <div v-else-if="isCode" class="code-preview">
          <pre><code :class="`language-${getLanguage()}`">{{ textContent }}</code></pre>
        </div>
        
        <!-- 其他文件 -->
        <div v-else class="default-preview">
          <div class="file-info">
            <Icon :name="getFileIcon(file)" size="large" />
            <h3>{{ file.name }}</h3>
            <p>{{ formatSize(file.size) }}</p>
            <p>{{ formatDate(file.modified) }}</p>
            <button class="btn-primary" @click="handleDownload">
              <Icon name="download" />
              下载文件
            </button>
          </div>
        </div>
      </div>
      
      <div class="preview-footer">
        <div class="file-details">
          <span>大小: {{ formatSize(file.size) }}</span>
          <span>修改时间: {{ formatDate(file.modified) }}</span>
          <span v-if="imageDimensions">尺寸: {{ imageDimensions.width }} × {{ imageDimensions.height }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import Icon from '../common/Icon.vue'
import { assetsApiV2 } from '../../api/assetsV2'

const props = defineProps({
  file: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close'])

const textContent = ref('')
const imageDimensions = ref(null)

const fileExt = computed(() => {
  return props.file.name.split('.').pop().toLowerCase()
})

const isImage = computed(() => {
  return ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'ico', 'bmp'].includes(fileExt.value)
})

const isVideo = computed(() => {
  return ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm'].includes(fileExt.value)
})

const isAudio = computed(() => {
  return ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a'].includes(fileExt.value)
})

const isPDF = computed(() => {
  return fileExt.value === 'pdf'
})

const isText = computed(() => {
  return ['txt', 'md', 'log', 'csv'].includes(fileExt.value)
})

const isCode = computed(() => {
  return ['js', 'ts', 'jsx', 'tsx', 'vue', 'html', 'css', 'scss', 'json', 'xml', 'py', 'java', 'cpp', 'c', 'h', 'php', 'rb', 'go', 'rs', 'swift'].includes(fileExt.value)
})

const previewUrl = computed(() => {
  return `/api/v2/assets/preview?path=${encodeURIComponent(props.file.path)}`
})

const getFileIcon = (file) => {
  const ext = file.name.split('.').pop().toLowerCase()
  const iconMap = {
    // 图片
    jpg: 'image', jpeg: 'image', png: 'image', gif: 'image',
    // 视频
    mp4: 'video', avi: 'video', mov: 'video',
    // 音频
    mp3: 'audio', wav: 'audio',
    // 文档
    pdf: 'file-pdf', doc: 'file-word', docx: 'file-word',
    xls: 'file-excel', xlsx: 'file-excel',
    txt: 'file-text', md: 'file-text',
    // 代码
    js: 'file-code', ts: 'file-code', vue: 'file-code',
    // 压缩包
    zip: 'file-zip', rar: 'file-zip'
  }
  return iconMap[ext] || 'file'
}

const getLanguage = () => {
  const langMap = {
    js: 'javascript',
    ts: 'typescript',
    jsx: 'javascript',
    tsx: 'typescript',
    vue: 'vue',
    html: 'html',
    css: 'css',
    scss: 'scss',
    json: 'json',
    xml: 'xml',
    py: 'python',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    h: 'c',
    php: 'php',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    swift: 'swift'
  }
  return langMap[fileExt.value] || 'plaintext'
}

const formatSize = (bytes) => {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const formatDate = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleString()
}

const handleClose = () => {
  emit('close')
}

const handleDownload = () => {
  window.open(`/api/v2/assets/download?path=${encodeURIComponent(props.file.path)}`, '_blank')
}

const handleImageLoad = (event) => {
  imageDimensions.value = {
    width: event.target.naturalWidth,
    height: event.target.naturalHeight
  }
}

const loadTextContent = async () => {
  if (isText.value || isCode.value) {
    try {
      const { data } = await assetsApiV2.getFileContent(props.file.path)
      textContent.value = data.content
    } catch (error) {
      console.error('Failed to load text content:', error)
      textContent.value = '无法加载文件内容'
    }
  }
}

onMounted(() => {
  loadTextContent()
})
</script>

<style scoped>
.file-preview-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.preview-container {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 1200px;
  height: 90%;
  max-height: 800px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e9ecef;
}

.preview-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 500;
  color: #212529;
}

.preview-actions {
  display: flex;
  gap: 8px;
}

.btn-icon {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.btn-icon:hover {
  background: #f8f9fa;
}

.preview-content {
  flex: 1;
  overflow: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f9fa;
}

/* 图片预览 */
.image-preview {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.image-preview img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

/* 视频预览 */
.video-preview {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.video-preview video {
  max-width: 100%;
  max-height: 100%;
  background: black;
}

/* 音频预览 */
.audio-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 30px;
}

.audio-icon {
  font-size: 80px;
  color: #6c757d;
}

.audio-preview audio {
  width: 400px;
}

/* PDF预览 */
.pdf-preview {
  width: 100%;
  height: 100%;
  padding: 20px;
}

.pdf-preview iframe {
  width: 100%;
  height: 100%;
  border: none;
  background: white;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

/* 文本预览 */
.text-preview,
.code-preview {
  width: 100%;
  height: 100%;
  padding: 20px;
  overflow: auto;
}

.text-preview pre,
.code-preview pre {
  background: white;
  padding: 20px;
  border-radius: 4px;
  margin: 0;
  min-height: 100%;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.code-preview pre {
  background: #282c34;
  color: #abb2bf;
}

/* 默认预览 */
.default-preview {
  display: flex;
  align-items: center;
  justify-content: center;
}

.file-info {
  text-align: center;
  padding: 40px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.file-info .icon {
  font-size: 64px;
  color: #6c757d;
  margin-bottom: 20px;
}

.file-info h3 {
  margin: 0 0 10px;
  font-size: 20px;
  color: #212529;
  word-break: break-all;
}

.file-info p {
  margin: 5px 0;
  color: #6c757d;
}

.btn-primary {
  margin-top: 20px;
  padding: 10px 20px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.btn-primary:hover {
  background: #0056b3;
}

/* 底部信息栏 */
.preview-footer {
  padding: 12px 20px;
  border-top: 1px solid #e9ecef;
  background: white;
}

.file-details {
  display: flex;
  gap: 20px;
  font-size: 13px;
  color: #6c757d;
}
</style>