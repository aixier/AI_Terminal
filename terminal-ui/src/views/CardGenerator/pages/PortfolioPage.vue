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
          @select-file="$emit('select-file', $event)"
          @folder-context-menu="$emit('folder-context-menu', $event)"
          @file-context-menu="$emit('file-context-menu', $event)"
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
                  <button @click="$emit('share-xiaohongshu', selectedFile)" class="action-btn xhs-share-btn">
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
          <div v-if="previewContent" class="content-display">
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
                <span>👁️</span>
              </button>
              <button @click="$emit('share-xiaohongshu', selectedFile)" class="action-btn xhs-share-btn">
                <span>📤</span>
              </button>
            </template>
            <button @click="$emit('download-file', selectedFile)" class="action-btn">
              <span>⬇️</span>
            </button>
            <button @click="$emit('delete-file', selectedFile)" class="action-btn danger">
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
          @select-file="$emit('select-file', $event)"
          @folder-context-menu="$emit('folder-context-menu', $event)"
          @file-context-menu="$emit('file-context-menu', $event)"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue'
import FileManager from '../components/FileManager.vue'

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
  'share-xiaohongshu',
  'download-file',
  'delete-file'
])

// 工具函数
const isHtmlFile = (filename) => {
  if (!filename) return false
  const name = filename.toLowerCase()
  return name.endsWith('.html') || name.endsWith('.htm')
}

const getFileIcon = (filename) => {
  if (!filename) return '📄'
  const name = filename.toLowerCase()
  if (name.endsWith('.html') || name.endsWith('.htm')) return '🌐'
  if (name.endsWith('.json')) return '📋'
  if (name.endsWith('.txt')) return '📄'
  return '📄'
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
  padding: 20px;
  overflow-y: auto;
}

.content-display pre {
  margin: 0;
  font-family: monospace;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
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