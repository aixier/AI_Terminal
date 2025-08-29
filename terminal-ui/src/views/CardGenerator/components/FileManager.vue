<template>
  <div class="file-manager">
    <div class="sidebar-header">
      <span class="sidebar-title">{{ title }}</span>
      <span v-if="connectionStatus" class="connection-indicator" :title="connectionStatus.text">
        {{ connectionStatus.icon }}
      </span>
      <button class="refresh-btn" @click="$emit('refresh')" title="刷新">
        🔄
      </button>
    </div>
    
    <div class="folder-tree">
      <div 
        v-for="folder in folders" 
        :key="folder.id"
        class="folder-container"
      >
        <div 
          class="folder-item"
          :class="{ 
            expanded: expandedFolders.includes(folder.id),
            selected: selectedFolder?.id === folder.id
          }"
          @click="toggleFolder(folder.id)"
          @contextmenu.prevent="$emit('folder-context-menu', $event, folder)"
        >
          <span class="folder-icon">
            {{ expandedFolders.includes(folder.id) ? '📂' : '📁' }}
          </span>
          <span class="folder-name">{{ folder.name }}</span>
          <span class="folder-count">({{ getFolderFileCount(folder) }})</span>
          <div class="folder-status">
            <span v-if="selectedFolder?.id === folder.id" class="status-indicator selected">✓</span>
          </div>
        </div>
        
        <!-- 子文件夹和文件 -->
        <div v-if="expandedFolders.includes(folder.id)" class="cards-list">
          <!-- 渲染子文件夹 -->
          <div 
            v-for="subfolder in folder.subfolders" 
            :key="subfolder.id"
            class="folder-container subfolder"
          >
            <div 
              class="folder-item subfolder-item"
              :class="{ 
                expanded: expandedFolders.includes(subfolder.id),
                selected: selectedFolder?.id === subfolder.id
              }"
              @click="toggleFolder(subfolder.id)"
              @contextmenu.prevent="$emit('folder-context-menu', $event, subfolder)"
            >
              <span class="folder-icon">
                {{ expandedFolders.includes(subfolder.id) ? '📂' : '📁' }}
              </span>
              <span class="folder-name">{{ subfolder.name }}</span>
              <span class="folder-count">({{ getFilteredFiles(subfolder.cards).length }})</span>
            </div>
            
            <!-- 子文件夹的文件 -->
            <div v-if="expandedFolders.includes(subfolder.id)" class="cards-list subfolder-cards">
              <FileItem
                v-for="file in getFilteredFiles(subfolder.cards)" 
                :key="file.id"
                :file="file"
                :is-selected="selectedFile?.id === file.id"
                :is-generating="generatingFiles[file.id]"
                @click="$emit('select-file', file, subfolder)"
                @contextmenu="$emit('file-context-menu', $event, file, subfolder)"
              />
            </div>
          </div>
          
          <!-- 直接文件 -->
          <FileItem
            v-for="file in getFilteredFiles(folder.cards)" 
            :key="file.id"
            :file="file"
            :is-selected="selectedFile?.id === file.id"
            :is-generating="generatingFiles[file.id]"
            @click="$emit('select-file', file, folder)"
            @contextmenu="$emit('file-context-menu', $event, file, folder)"
          />
        </div>
      </div>
      
      <div v-if="folders.length === 0" class="empty-message">
        {{ emptyMessage }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import FileItem from './FileItem.vue'

const props = defineProps({
  title: {
    type: String,
    default: '我的文件'
  },
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
  emptyMessage: {
    type: String,
    default: '暂无文件'
  }
})

const emit = defineEmits([
  'refresh',
  'toggle-folder',
  'select-file',
  'select-folder',
  'folder-context-menu',
  'file-context-menu'
])

const expandedFolders = ref([])

// 切换文件夹展开状态
const toggleFolder = (folderId) => {
  const index = expandedFolders.value.indexOf(folderId)
  if (index > -1) {
    expandedFolders.value.splice(index, 1)
  } else {
    expandedFolders.value.push(folderId)
  }
  emit('toggle-folder', folderId)
}

// 获取过滤后的文件
const getFilteredFiles = (files) => {
  return props.fileFilter(files || [])
}

// 获取文件夹文件数量
const getFolderFileCount = (folder) => {
  let count = getFilteredFiles(folder.cards).length
  if (folder.subfolders) {
    count += folder.subfolders.reduce((sum, sf) => 
      sum + getFilteredFiles(sf.cards).length, 0
    )
  }
  return count
}

// 展开指定文件夹
const expandFolder = (folderId) => {
  if (!expandedFolders.value.includes(folderId)) {
    expandedFolders.value.push(folderId)
  }
}

// 折叠指定文件夹
const collapseFolder = (folderId) => {
  const index = expandedFolders.value.indexOf(folderId)
  if (index > -1) {
    expandedFolders.value.splice(index, 1)
  }
}

// 展开所有文件夹
const expandAll = () => {
  expandedFolders.value = []
  props.folders.forEach(folder => {
    expandedFolders.value.push(folder.id)
    if (folder.subfolders) {
      folder.subfolders.forEach(sf => {
        expandedFolders.value.push(sf.id)
      })
    }
  })
}

// 折叠所有文件夹
const collapseAll = () => {
  expandedFolders.value = []
}

defineExpose({
  expandFolder,
  collapseFolder,
  expandAll,
  collapseAll,
  expandedFolders
})
</script>

<style scoped>
.file-manager {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f8f9fa;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #fff;
  border-bottom: 1px solid #e0e0e0;
}

.sidebar-title {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.connection-indicator {
  font-size: 12px;
  cursor: help;
}

.refresh-btn {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: background 0.2s;
}

.refresh-btn:hover {
  background: #f0f0f0;
}

.folder-tree {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.folder-container {
  margin-bottom: 2px;
}

.folder-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
  user-select: none;
}

.folder-item:hover {
  background: #e8e8e8;
}

.folder-item.selected {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}

.folder-item.expanded {
  font-weight: 500;
}

.subfolder-item {
  padding-left: 32px;
}

.folder-icon {
  margin-right: 8px;
  font-size: 16px;
}

.folder-name {
  flex: 1;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-count {
  margin-left: 8px;
  font-size: 11px;
  opacity: 0.7;
}

.folder-status {
  margin-left: 8px;
}

.status-indicator {
  font-size: 12px;
}

.cards-list {
  margin-left: 20px;
  margin-top: 2px;
}

.subfolder-cards {
  margin-left: 20px;
}

.empty-message {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100px;
  color: #999;
  font-size: 13px;
}

/* 滚动条样式 */
.folder-tree::-webkit-scrollbar {
  width: 6px;
}

.folder-tree::-webkit-scrollbar-track {
  background: transparent;
}

.folder-tree::-webkit-scrollbar-thumb {
  background: #c0c0c0;
  border-radius: 3px;
}

.folder-tree::-webkit-scrollbar-thumb:hover {
  background: #a0a0a0;
}
</style>