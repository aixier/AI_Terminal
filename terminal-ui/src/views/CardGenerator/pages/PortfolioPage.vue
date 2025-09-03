<template>
  <div class="portfolio-page">
    <!-- PC端布局 -->
    <div v-if="!isMobile" class="desktop-portfolio-layout">
      <!-- 文件管理器区域 -->
      <div class="file-manager-section">
        <FileManager
          title="我的卡片"
          :folders="folders"
          :selected-folder="selectedFolder"
          :selected-file="selectedFile"
          :generating-files="generatingFiles"
          :file-filter="fileFilter"
          :connection-status="connectionStatus"
          empty-message="暂无卡片文件夹"
          @refresh="$emit('refresh-folders')"
          @toggle-folder="$emit('toggle-folder', $event)"
          @select-file="(...args) => $emit('select-file', ...args)"
          @folder-context-menu="(...args) => $emit('folder-context-menu', ...args)"
          @file-context-menu="(...args) => $emit('file-context-menu', ...args)"
        />
      </div>
      
      <!-- 预览区域 -->
      <div class="preview-section">
        <div class="preview-header">
          <div class="preview-title">
            {{ selectedFile ? '文件内容预览' : '选择文件查看内容' }}
            <span v-if="selectedFile && previewType" class="preview-type-tag">
              {{ previewType.toUpperCase() }}
            </span>
          </div>
          
          <!-- 顶部操作按钮栏 -->
          <div v-if="selectedFile || selectedFolder" class="action-bar">
            <div class="selected-item-info">
              <span class="selected-icon">
                {{ selectedFolder ? '📁' : getFileIcon(selectedFile?.name) }}
              </span>
              <span class="selected-name">
                {{ selectedFolder ? selectedFolder.name : selectedFile?.name }}
              </span>
            </div>
            
            <div class="action-buttons">
              <template v-if="selectedFile">
                <template v-if="isHtmlFile(selectedFile.name)">
                  <button @click="$emit('preview-file', selectedFile)" class="action-btn">
                    <span>👁️</span> 预览
                  </button>
                  <button @click="shareToXiaohongshu(selectedFile, selectedFolder)" class="action-btn xhs-share-btn">
                    <span>📤</span> 分享小红书
                  </button>
                </template>
                <button @click="$emit('download-file', selectedFile)" class="action-btn">
                  <span>⬇️</span> 下载
                </button>
                <button @click="$emit('delete-file', selectedFile)" class="action-btn danger">
                  <span>🗑️</span> 删除
                </button>
              </template>
            </div>
          </div>
        </div>
        
        <!-- 预览内容 -->
        <div class="preview-content">
          <!-- HTML文件预览 -->
          <iframe 
            v-if="previewContent && isHtmlFile(selectedFile?.name)" 
            class="html-preview-iframe"
            :srcdoc="previewContent"
            sandbox="allow-same-origin allow-scripts"
          ></iframe>
          <!-- JSON文件预览 -->
          <div v-else-if="previewContent && isJsonFile(selectedFile?.name)" class="content-display json-display">
            <pre v-html="formatJsonContent(previewContent)"></pre>
          </div>
          <!-- 其他文件预览 -->
          <div v-else-if="previewContent" class="content-display">
            <pre>{{ previewContent }}</pre>
          </div>
          <div v-else class="empty-preview">
            <span class="empty-icon">📄</span>
            <span class="empty-text">选择文件查看内容</span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 移动端布局 -->
    <div v-else class="mobile-portfolio-layout">
      <!-- 移动端操作按钮栏 -->
      <div v-if="selectedFile || selectedFolder" class="mobile-action-bar">
        <div class="selected-item-info">
          <span class="selected-icon">
            {{ selectedFolder && !selectedFile ? '📁' : getFileIcon(selectedFile?.name) }}
          </span>
          <span class="selected-name">
            {{ selectedFolder && !selectedFile ? selectedFolder.name : selectedFile?.name }}
          </span>
        </div>
        
        <div class="action-buttons">
          <!-- 文件夹操作按钮 -->
          <template v-if="selectedFolder && !selectedFile">
            <button @click="$emit('delete-folder', selectedFolder)" class="action-btn danger" title="删除文件夹">
              <span>🗑️</span>
            </button>
          </template>
          <!-- 文件操作按钮 -->
          <template v-else-if="selectedFile">
            <template v-if="isHtmlFile(selectedFile.name)">
              <button @click="$emit('preview-file', selectedFile)" class="action-btn" title="预览">
                <span>👁️</span>
              </button>
              <button @click="shareToXiaohongshu(selectedFile, selectedFolder)" class="action-btn xhs-share-btn" title="分享">
                <span>📤</span>
              </button>
            </template>
            <button @click="$emit('download-file', selectedFile)" class="action-btn" title="下载">
              <span>⬇️</span>
            </button>
            <button @click="$emit('delete-file', selectedFile)" class="action-btn danger" title="删除">
              <span>🗑️</span>
            </button>
          </template>
        </div>
      </div>
      
      <!-- 文件管理器 -->
      <div class="mobile-file-manager">
        <FileManager
          title="作品集"
          :folders="folders"
          :selected-folder="selectedFolder"
          :selected-file="selectedFile"
          :generating-files="generatingFiles"
          :file-filter="fileFilter"
          empty-message="暂无作品"
          @refresh="$emit('refresh-folders')"
          @toggle-folder="$emit('toggle-folder', $event)"
          @select-file="(...args) => $emit('select-file', ...args)"
          @folder-context-menu="(...args) => $emit('folder-context-menu', ...args)"
          @file-context-menu="(...args) => $emit('file-context-menu', ...args)"
        />
      </div>
    </div>
  </div>
  
  <!-- 小红书分享对话框 -->
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
import { defineProps, defineEmits } from 'vue'
import FileManager from '../components/FileManager.vue'
import ShareDialog from '../components/ShareDialog.vue'
import { useXiaohongshuShare } from '../../../composables/useXiaohongshuShare'

const props = defineProps({
  // 数据属性
  folders: {
    type: Array,
    default: () => []
  },
  selectedFolder: {
    type: Object,
    default: null
  },
  selectedFile: {
    type: Object,
    default: null
  },
  generatingFiles: {
    type: Object,
    default: () => ({})
  },
  fileFilter: {
    type: Function,
    default: (files) => files
  },
  connectionStatus: {
    type: Object,
    default: null
  },
  previewContent: {
    type: String,
    default: ''
  },
  previewType: {
    type: String,
    default: ''
  },
  isMobile: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'refresh-folders',
  'toggle-folder',
  'select-file',
  'folder-context-menu',
  'file-context-menu',
  'preview-file',
  'download-file',
  'delete-file',
  'delete-folder'
])

// 使用小红书分享模块
const {
  isSharing,
  shareDialogVisible,
  shareResult,
  loadingProgress,
  shareToXiaohongshu,
  closeShareDialog,
  copyShareContent,
  copyLink,
  copyShortLink,
  openShareLink
} = useXiaohongshuShare()

// 工具函数
const isHtmlFile = (filename) => {
  if (!filename) return false
  const name = filename.toLowerCase()
  return name.endsWith('.html') || name.endsWith('.htm')
}

const isJsonFile = (filename) => {
  if (!filename) return false
  const name = filename.toLowerCase()
  return name.endsWith('.json')
}

const getFileIcon = (filename) => {
  if (!filename) return '📄'
  const name = filename.toLowerCase()
  if (name.endsWith('.html') || name.endsWith('.htm')) return '🌐'
  if (name.endsWith('.json')) return '📋'
  if (name.endsWith('.txt')) return '📄'
  return '📄'
}

// 格式化JSON内容并添加高亮
const formatJsonContent = (content) => {
  try {
    // 尝试解析JSON
    const jsonObj = JSON.parse(content)
    // 美化JSON
    const formatted = JSON.stringify(jsonObj, null, 2)
    
    // 添加语法高亮
    return formatted
      .replace(/"([^"]+)":/g, '<span class="json-key">"$1"</span>:')
      .replace(/:"([^"]*)"/g, ': <span class="json-string">"$1"</span>')
      .replace(/:\s*(true|false)/g, ': <span class="json-boolean">$1</span>')
      .replace(/:\s*(null)/g, ': <span class="json-null">$1</span>')
      .replace(/:\s*(-?\d+\.?\d*)/g, ': <span class="json-number">$1</span>')
  } catch (e) {
    // 如果JSON解析失败，返回原始内容
    return content
  }
}
</script>

<style scoped>
.portfolio-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* PC端布局 */
.desktop-portfolio-layout {
  height: 100%;
  display: flex;
  gap: 20px;
}

.file-manager-section {
  width: 350px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.preview-section {
  flex: 1;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.preview-header {
  padding: 16px;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.preview-title {
  font-size: 16px;
  font-weight: 500;
  color: #333;
  display: flex;
  align-items: center;
  gap: 8px;
}

.preview-type-tag {
  padding: 2px 8px;
  background: #e3f2fd;
  color: #1976d2;
  border-radius: 4px;
  font-size: 12px;
}

.action-bar {
  display: flex;
  align-items: center;
  gap: 16px;
}

.selected-item-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: #f5f5f5;
  border-radius: 6px;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.action-btn {
  padding: 6px 12px;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  transition: all 0.2s;
}

.action-btn:hover {
  background: #f5f5f5;
  border-color: #667eea;
}

.action-btn.danger:hover {
  background: #fff5f5;
  border-color: #ff4757;
  color: #ff4757;
}

.xhs-share-btn {
  background: linear-gradient(135deg, #ff2442 0%, #ff6b6b 100%) !important;
  border-color: #ff2442 !important;
  color: white !important;
}

.xhs-share-btn:hover {
  background: linear-gradient(135deg, #e01e3b 0%, #ff5252 100%) !important;
  border-color: #e01e3b !important;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(255, 36, 66, 0.3);
}

.preview-content {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  position: relative;
  background: #f8f9fa;
}

.html-preview-iframe {
  width: 100%;
  height: 100%;
  border: none;
  background: white;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.content-display {
  height: 100%;
  background: #1e1e1e;
  border-radius: 8px;
  overflow: hidden;
}

.content-display pre {
  margin: 0;
  padding: 20px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-wrap: break-word;
  color: #d4d4d4;
  background: #1e1e1e;
  height: 100%;
  overflow-y: auto;
}

/* 滚动条样式 */
.content-display pre::-webkit-scrollbar {
  width: 8px;
}

.content-display pre::-webkit-scrollbar-track {
  background: #2d2d2d;
}

.content-display pre::-webkit-scrollbar-thumb {
  background: #555;
  border-radius: 4px;
}

.content-display pre::-webkit-scrollbar-thumb:hover {
  background: #666;
}

/* JSON语法高亮样式 */
.json-display :deep(.json-key) {
  color: #9cdcfe;
  font-weight: 500;
}

.json-display :deep(.json-string) {
  color: #ce9178;
}

.json-display :deep(.json-number) {
  color: #b5cea8;
}

.json-display :deep(.json-boolean) {
  color: #569cd6;
  font-weight: 500;
}

.json-display :deep(.json-null) {
  color: #569cd6;
  font-style: italic;
}

.empty-preview {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #999;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.empty-text {
  font-size: 14px;
}

/* 移动端布局 */
.mobile-portfolio-layout {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.mobile-action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
  gap: 8px;
  position: sticky;
  top: 0;
  z-index: 10;
}

.mobile-action-bar .selected-item-info {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #333;
  flex: 1;
  min-width: 0;
}

.mobile-action-bar .selected-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-action-bar .action-buttons {
  display: flex;
  gap: 4px;
}

.mobile-action-bar .action-btn {
  padding: 6px 10px;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s;
}

.mobile-action-bar .action-btn:active {
  background: #f0f0f0;
  transform: scale(0.95);
}

.mobile-file-manager {
  flex: 1;
  overflow: hidden;
}
</style>