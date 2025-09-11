<template>
  <div class="asset-manager-v2">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <button class="btn-icon" @click="navigateUp" :disabled="!canGoUp" title="上级目录">
          <Icon name="arrow-up" />
        </button>
        <button class="btn-icon" @click="goBack" :disabled="!canGoBack" title="后退">
          <Icon name="arrow-left" />
        </button>
        <button class="btn-icon" @click="goForward" :disabled="!canGoForward" title="前进">
          <Icon name="arrow-right" />
        </button>
        <button class="btn-icon" @click="refresh" title="刷新">
          <Icon name="refresh" />
        </button>
        <div class="separator"></div>
        <button class="btn-primary" @click="createFolder">
          <Icon name="folder-plus" />
          新建文件夹
        </button>
        <button class="btn-primary" @click="triggerUpload">
          <Icon name="upload" />
          上传文件
        </button>
      </div>
      <div class="toolbar-right">
        <div class="search-box">
          <Icon name="search" />
          <input 
            v-model="searchQuery" 
            placeholder="搜索文件..." 
            @input="handleSearch"
            @keyup.enter="performSearch"
          />
        </div>
        <div class="view-switcher">
          <button 
            class="btn-icon" 
            :class="{ active: viewMode === 'grid' }"
            @click="viewMode = 'grid'"
            title="网格视图"
          >
            <Icon name="grid" />
          </button>
          <button 
            class="btn-icon" 
            :class="{ active: viewMode === 'list' }"
            @click="viewMode = 'list'"
            title="列表视图"
          >
            <Icon name="list" />
          </button>
        </div>
      </div>
    </div>

    <!-- 面包屑导航 -->
    <div class="breadcrumb" v-if="breadcrumb.length > 0">
      <span class="breadcrumb-item" @click="navigateToPath('/')">
        <Icon name="home" />
        我的素材
      </span>
      <template v-for="(item, index) in breadcrumb" :key="item.path">
        <span class="breadcrumb-separator">/</span>
        <span 
          class="breadcrumb-item" 
          :class="{ active: index === breadcrumb.length - 1 }"
          @click="navigateToPath(item.path)"
        >
          {{ item.name }}
        </span>
      </template>
    </div>

    <!-- 分栏布局 -->
    <div class="split-view">
      <!-- 左侧：文件树 -->
      <div class="tree-panel" v-show="showSidebar">
        <div class="tree-header">
          <span>文件夹</span>
          <button class="btn-icon small" @click="collapseAll" title="全部折叠">
            <Icon name="collapse" />
          </button>
        </div>
        <FileTree 
          :data="treeData"
          :current-path="currentPath"
          @select="navigateToPath"
          @drop="handleTreeDrop"
          @contextmenu="handleTreeContextMenu"
        />
      </div>

      <!-- 中间：分隔条 -->
      <div 
        class="splitter" 
        v-show="showSidebar"
        @mousedown="startResize"
      ></div>

      <!-- 右侧：文件区域 -->
      <div 
        class="file-panel"
        @drop.prevent="handleFileDrop"
        @dragover.prevent="handleDragOver"
        @dragleave="handleDragLeave"
        :class="{ 'drag-over': isDragging }"
      >
        <!-- 拖拽提示 -->
        <div v-if="isDragging" class="drop-overlay">
          <div class="drop-hint">
            <Icon name="upload" />
            <span>拖放文件到此处上传</span>
          </div>
        </div>

        <!-- 加载状态 -->
        <div v-if="loading" class="loading-state">
          <div class="spinner"></div>
          <span>加载中...</span>
        </div>

        <!-- 空状态 -->
        <div v-else-if="!loading && displayItems.length === 0" class="empty-state">
          <div class="empty-icon">
            <Icon name="folder-open" />
          </div>
          <div class="empty-text">文件夹为空</div>
          <div class="empty-actions">
            <button class="btn-primary" @click="triggerUpload">
              <Icon name="upload" />
              上传文件
            </button>
            <button class="btn-secondary" @click="createFolder">
              <Icon name="folder-plus" />
              新建文件夹
            </button>
          </div>
        </div>

        <!-- 文件视图 -->
        <FileGrid 
          v-else-if="viewMode === 'grid'"
          :items="displayItems"
          :selected-items="selectedItems"
          @select="selectItem"
          @open="openItem"
          @contextmenu="handleItemContextMenu"
        />
        
        <FileList 
          v-else
          :items="displayItems"
          :selected-items="selectedItems"
          @select="selectItem"
          @open="openItem"
          @contextmenu="handleItemContextMenu"
        />
      </div>
    </div>

    <!-- 状态栏 -->
    <div class="status-bar">
      <div class="status-left">
        <span v-if="selectedItems.length > 0">
          已选择 {{ selectedItems.length }} 项
        </span>
        <span v-else>
          {{ displayItems.length }} 个项目
        </span>
      </div>
      <div class="status-right">
        <span v-if="uploadProgress.active" class="upload-status">
          上传中: {{ uploadProgress.percent }}%
        </span>
        <span v-if="storageInfo" class="storage-info">
          已用: {{ formatSize(storageInfo.used) }} / {{ formatSize(storageInfo.total) }}
        </span>
      </div>
    </div>

    <!-- 文件上传input（隐藏） -->
    <input 
      ref="fileInput"
      type="file"
      multiple
      style="display: none"
      @change="handleFileSelect"
    />

    <!-- 右键菜单 -->
    <ContextMenu 
      v-if="contextMenu.show"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :items="contextMenu.items"
      @select="handleContextMenuAction"
      @close="contextMenu.show = false"
    />

    <!-- 新建文件夹对话框 -->
    <Modal 
      v-model="showNewFolderDialog"
      title="新建文件夹"
      @confirm="confirmCreateFolder"
    >
      <input 
        v-model="newFolderName"
        placeholder="请输入文件夹名称"
        @keyup.enter="confirmCreateFolder"
        ref="folderNameInput"
      />
    </Modal>

    <!-- 重命名对话框 -->
    <Modal 
      v-model="showRenameDialog"
      title="重命名"
      @confirm="confirmRename"
    >
      <input 
        v-model="renameName"
        placeholder="请输入新名称"
        @keyup.enter="confirmRename"
        ref="renameInput"
      />
    </Modal>

    <!-- 文件预览 -->
    <FilePreview 
      v-if="previewFile"
      :file="previewFile"
      @close="previewFile = null"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useAssetStore } from '../../store/assetsV2'
import { assetsApiV2 } from '../../api/assetsV2'
import { useSSE } from '../../composables/useSSE'
import { ElMessage, ElMessageBox } from 'element-plus'
import FileTree from './FileTree.vue'
import FileGrid from './FileGrid.vue'
import FileList from './FileList.vue'
import FilePreview from './FilePreview.vue'
import ContextMenu from '../common/ContextMenu.vue'
import Modal from '../common/Modal.vue'
import Icon from '../common/Icon.vue'
import { debounce } from 'lodash-es'

// Props
const props = defineProps({
  initialPath: {
    type: String,
    default: '/'
  }
})

// Emits
const emit = defineEmits(['select', 'change'])

// Store
const assetStore = useAssetStore()

// 状态
const loading = ref(false)
const currentPath = ref(props.initialPath)
const searchQuery = ref('')
const selectedItems = ref([])
const displayItems = ref([])
const treeData = ref([])
const viewMode = ref('grid') // grid | list
const showSidebar = ref(true)
const isDragging = ref(false)
const dragCounter = ref(0)
const previewFile = ref(null)
const uploadProgress = ref({ active: false, percent: 0 })
const storageInfo = ref(null)

// 导航历史
const navigationHistory = ref(['/'])
const navigationIndex = ref(0)

// 面包屑
const breadcrumb = computed(() => {
  if (currentPath.value === '/') return []
  const parts = currentPath.value.split('/').filter(Boolean)
  const result = []
  let path = ''
  for (const part of parts) {
    path += '/' + part
    result.push({ name: part, path })
  }
  return result
})

// 计算属性
const canGoBack = computed(() => navigationIndex.value > 0)
const canGoForward = computed(() => navigationIndex.value < navigationHistory.value.length - 1)
const canGoUp = computed(() => currentPath.value !== '/')

// 右键菜单
const contextMenu = ref({
  show: false,
  x: 0,
  y: 0,
  items: []
})

// 对话框
const showNewFolderDialog = ref(false)
const newFolderName = ref('')
const showRenameDialog = ref(false)
const renameItem = ref(null)
const renameName = ref('')

// Refs
const fileInput = ref(null)
const folderNameInput = ref(null)
const renameInput = ref(null)

// SSE 实时更新
const { subscribe, unsubscribe } = useSSE()

// 初始化 SSE 监听
const initSSE = () => {
  const userId = assetStore.userId || 'default'
  
  subscribe(`/api/v2/assets/events/${userId}`, (event) => {
    console.log('SSE Event:', event)
    
    switch (event.type) {
      case 'file:added':
        if (event.data.path.startsWith(currentPath.value)) {
          loadFiles()
        }
        break
      case 'file:modified':
      case 'file:deleted':
        if (event.data.path.startsWith(currentPath.value)) {
          loadFiles()
        }
        break
      case 'folder:created':
      case 'folder:deleted':
        loadTree()
        if (event.data.path.startsWith(currentPath.value)) {
          loadFiles()
        }
        break
    }
  })
}

// 加载文件树
const loadTree = async () => {
  try {
    const { data } = await assetsApiV2.getTree()
    treeData.value = data.tree
    assetStore.setTree(data.tree)
  } catch (error) {
    console.error('Failed to load tree:', error)
  }
}

// 加载文件列表
const loadFiles = async () => {
  loading.value = true
  try {
    const params = { 
      path: currentPath.value,
      search: searchQuery.value || undefined
    }
    
    const { data } = await assetsApiV2.getAssets(params)
    displayItems.value = data.items || []
    
    // 更新存储信息
    if (data.storage) {
      storageInfo.value = data.storage
    }
  } catch (error) {
    console.error('Failed to load files:', error)
    ElMessage.error('加载文件失败')
  } finally {
    loading.value = false
  }
}

// 导航到指定路径
const navigateToPath = (path) => {
  if (path === currentPath.value) return
  
  currentPath.value = path
  selectedItems.value = []
  
  // 更新导航历史
  navigationHistory.value = navigationHistory.value.slice(0, navigationIndex.value + 1)
  navigationHistory.value.push(path)
  navigationIndex.value++
  
  loadFiles()
}

// 导航功能
const navigateUp = () => {
  if (!canGoUp.value) return
  const parentPath = currentPath.value.split('/').slice(0, -1).join('/') || '/'
  navigateToPath(parentPath)
}

const goBack = () => {
  if (canGoBack.value) {
    navigationIndex.value--
    currentPath.value = navigationHistory.value[navigationIndex.value]
    loadFiles()
  }
}

const goForward = () => {
  if (canGoForward.value) {
    navigationIndex.value++
    currentPath.value = navigationHistory.value[navigationIndex.value]
    loadFiles()
  }
}

const refresh = () => {
  loadTree()
  loadFiles()
}

// 搜索功能
const handleSearch = debounce(() => {
  loadFiles()
}, 300)

const performSearch = () => {
  loadFiles()
}

// 文件选择
const selectItem = (event, item) => {
  if (event.ctrlKey || event.metaKey) {
    // 多选
    const index = selectedItems.value.findIndex(i => i.id === item.id)
    if (index > -1) {
      selectedItems.value.splice(index, 1)
    } else {
      selectedItems.value.push(item)
    }
  } else if (event.shiftKey && selectedItems.value.length > 0) {
    // 范围选择
    const lastSelected = selectedItems.value[selectedItems.value.length - 1]
    const lastIndex = displayItems.value.findIndex(i => i.id === lastSelected.id)
    const currentIndex = displayItems.value.findIndex(i => i.id === item.id)
    const start = Math.min(lastIndex, currentIndex)
    const end = Math.max(lastIndex, currentIndex)
    selectedItems.value = displayItems.value.slice(start, end + 1)
  } else {
    // 单选
    selectedItems.value = [item]
  }
  
  emit('select', selectedItems.value)
}

// 打开文件/文件夹
const openItem = (item) => {
  if (item.type === 'folder') {
    navigateToPath(item.path)
  } else {
    // 预览文件
    previewFile.value = item
  }
}

// 文件上传
const triggerUpload = () => {
  fileInput.value?.click()
}

const handleFileSelect = async (event) => {
  const files = Array.from(event.target.files)
  if (files.length === 0) return
  
  try {
    uploadProgress.value = { active: true, percent: 0 }
    
    const formData = new FormData()
    files.forEach(file => formData.append('files', file))
    formData.append('path', currentPath.value)
    
    const { data } = await assetsApiV2.uploadBatch(formData, {
      onUploadProgress: (progressEvent) => {
        uploadProgress.value.percent = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        )
      }
    })
    
    ElMessage.success(`成功上传 ${data.uploaded} 个文件`)
    loadFiles()
  } catch (error) {
    ElMessage.error('上传失败: ' + error.message)
  } finally {
    uploadProgress.value = { active: false, percent: 0 }
    event.target.value = ''
  }
}

// 拖拽上传
const handleFileDrop = async (event) => {
  isDragging.value = false
  dragCounter.value = 0
  
  const files = Array.from(event.dataTransfer.files)
  if (files.length === 0) return
  
  // 创建虚拟的 file input event
  const virtualEvent = {
    target: { 
      files,
      value: ''
    }
  }
  
  await handleFileSelect(virtualEvent)
}

const handleDragOver = (event) => {
  event.dataTransfer.dropEffect = 'copy'
}

const handleDragEnter = () => {
  dragCounter.value++
  isDragging.value = true
}

const handleDragLeave = () => {
  dragCounter.value--
  if (dragCounter.value === 0) {
    isDragging.value = false
  }
}

// 文件夹操作
const createFolder = () => {
  showNewFolderDialog.value = true
  newFolderName.value = '新建文件夹'
  nextTick(() => {
    folderNameInput.value?.select()
  })
}

const confirmCreateFolder = async () => {
  if (!newFolderName.value.trim()) {
    ElMessage.warning('请输入文件夹名称')
    return
  }
  
  try {
    // 新的API需要分离path和name
    const parentPath = currentPath.value === '/' ? '' : currentPath.value
    
    await assetsApiV2.createFolder({ 
      path: parentPath,
      name: newFolderName.value 
    })
    ElMessage.success('文件夹创建成功')
    showNewFolderDialog.value = false
    loadFiles()
    loadTree()
  } catch (error) {
    ElMessage.error('创建失败: ' + error.message)
  }
}

// 重命名
const handleRename = (item) => {
  renameItem.value = item
  renameName.value = item.name
  showRenameDialog.value = true
  nextTick(() => {
    renameInput.value?.select()
  })
}

const confirmRename = async () => {
  if (!renameName.value.trim()) {
    ElMessage.warning('请输入名称')
    return
  }
  
  if (renameName.value === renameItem.value.name) {
    showRenameDialog.value = false
    return
  }
  
  try {
    await assetsApiV2.rename({
      oldPath: renameItem.value.path,
      newName: renameName.value
    })
    ElMessage.success('重命名成功')
    showRenameDialog.value = false
    loadFiles()
    if (renameItem.value.type === 'folder') {
      loadTree()
    }
  } catch (error) {
    ElMessage.error('重命名失败: ' + error.message)
  }
}

// 删除
const handleDelete = async (items = selectedItems.value) => {
  if (items.length === 0) return
  
  const message = items.length === 1 
    ? `确定删除 "${items[0].name}" 吗？`
    : `确定删除选中的 ${items.length} 个项目吗？`
  
  try {
    await ElMessageBox.confirm(message, '删除确认', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    for (const item of items) {
      await assetsApiV2.delete(item.path)
    }
    
    ElMessage.success('删除成功')
    selectedItems.value = []
    loadFiles()
    
    // 如果删除了文件夹，更新树
    if (items.some(item => item.type === 'folder')) {
      loadTree()
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败: ' + error.message)
    }
  }
}

// 右键菜单
const handleItemContextMenu = (event, item) => {
  event.preventDefault()
  
  // 如果右键的项目未被选中，则单选它
  if (!selectedItems.value.find(i => i.id === item.id)) {
    selectedItems.value = [item]
  }
  
  const items = []
  
  if (item.type === 'folder') {
    items.push(
      { label: '打开', icon: 'folder-open', action: 'open' },
      { separator: true },
      { label: '重命名', icon: 'edit', action: 'rename' },
      { label: '删除', icon: 'delete', action: 'delete' }
    )
  } else {
    items.push(
      { label: '打开', icon: 'file', action: 'open' },
      { label: '下载', icon: 'download', action: 'download' },
      { separator: true },
      { label: '重命名', icon: 'edit', action: 'rename' },
      { label: '删除', icon: 'delete', action: 'delete' },
      { separator: true },
      { label: '属性', icon: 'info', action: 'properties' }
    )
  }
  
  contextMenu.value = {
    show: true,
    x: event.clientX,
    y: event.clientY,
    items
  }
}

const handleTreeContextMenu = (event, node) => {
  event.preventDefault()
  
  const items = [
    { label: '新建文件夹', icon: 'folder-plus', action: 'newFolder' },
    { label: '上传文件', icon: 'upload', action: 'upload' },
    { separator: true },
    { label: '刷新', icon: 'refresh', action: 'refresh' }
  ]
  
  if (node) {
    items.unshift(
      { label: '打开', icon: 'folder-open', action: 'open' },
      { separator: true }
    )
    items.push(
      { separator: true },
      { label: '重命名', icon: 'edit', action: 'rename' },
      { label: '删除', icon: 'delete', action: 'delete' }
    )
  }
  
  contextMenu.value = {
    show: true,
    x: event.clientX,
    y: event.clientY,
    items,
    target: node
  }
}

const handleContextMenuAction = (action) => {
  const target = contextMenu.value.target
  
  switch (action) {
    case 'open':
      if (target) {
        navigateToPath(target.path)
      } else if (selectedItems.value.length > 0) {
        openItem(selectedItems.value[0])
      }
      break
      
    case 'download':
      if (selectedItems.value.length > 0) {
        selectedItems.value.forEach(item => {
          if (item.type !== 'folder') {
            window.open(`/api/v2/assets/download?path=${encodeURIComponent(item.path)}`, '_blank')
          }
        })
      }
      break
      
    case 'rename':
      if (target) {
        handleRename(target)
      } else if (selectedItems.value.length === 1) {
        handleRename(selectedItems.value[0])
      }
      break
      
    case 'delete':
      if (target) {
        handleDelete([target])
      } else {
        handleDelete()
      }
      break
      
    case 'newFolder':
      createFolder()
      break
      
    case 'upload':
      triggerUpload()
      break
      
    case 'refresh':
      refresh()
      break
      
    case 'properties':
      // TODO: 显示文件属性
      break
  }
  
  contextMenu.value.show = false
}

// 文件树拖放
const handleTreeDrop = async (event, targetFolder) => {
  const files = Array.from(event.dataTransfer.files)
  if (files.length > 0) {
    // 上传文件到目标文件夹
    const formData = new FormData()
    files.forEach(file => formData.append('files', file))
    formData.append('path', targetFolder.path)
    
    try {
      await assetsApiV2.uploadBatch(formData)
      ElMessage.success('文件上传成功')
      if (targetFolder.path === currentPath.value) {
        loadFiles()
      }
    } catch (error) {
      ElMessage.error('上传失败: ' + error.message)
    }
  }
}

// 侧边栏调整大小
let isResizing = false
let startX = 0
let startWidth = 0

const startResize = (event) => {
  isResizing = true
  startX = event.pageX
  const panel = document.querySelector('.tree-panel')
  startWidth = panel.offsetWidth
  
  document.addEventListener('mousemove', doResize)
  document.addEventListener('mouseup', stopResize)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

const doResize = (event) => {
  if (!isResizing) return
  const panel = document.querySelector('.tree-panel')
  const newWidth = startWidth + event.pageX - startX
  panel.style.width = Math.max(150, Math.min(500, newWidth)) + 'px'
}

const stopResize = () => {
  isResizing = false
  document.removeEventListener('mousemove', doResize)
  document.removeEventListener('mouseup', stopResize)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

// 折叠所有文件夹
const collapseAll = () => {
  // TODO: 实现折叠所有文件夹
}

// 工具函数
const formatSize = (bytes) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 键盘快捷键
const handleKeydown = (event) => {
  // Ctrl+A 全选
  if (event.ctrlKey && event.key === 'a') {
    event.preventDefault()
    selectedItems.value = [...displayItems.value]
  }
  
  // Delete 删除
  if (event.key === 'Delete' && selectedItems.value.length > 0) {
    handleDelete()
  }
  
  // F2 重命名
  if (event.key === 'F2' && selectedItems.value.length === 1) {
    handleRename(selectedItems.value[0])
  }
  
  // Ctrl+C 复制
  if (event.ctrlKey && event.key === 'c' && selectedItems.value.length > 0) {
    // TODO: 实现复制功能
  }
  
  // Ctrl+V 粘贴
  if (event.ctrlKey && event.key === 'v') {
    // TODO: 实现粘贴功能
  }
}

// 生命周期
onMounted(() => {
  loadTree()
  loadFiles()
  initSSE()
  
  document.addEventListener('keydown', handleKeydown)
  document.addEventListener('dragenter', handleDragEnter)
})

onUnmounted(() => {
  unsubscribe()
  document.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('dragenter', handleDragEnter)
})

// 监听路径变化
watch(() => props.initialPath, (newPath) => {
  navigateToPath(newPath)
})
</script>

<style scoped>
.asset-manager-v2 {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* 工具栏样式 */
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-icon {
  width: 32px;
  height: 32px;
  border: 1px solid transparent;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.btn-icon:hover:not(:disabled) {
  background: #e9ecef;
}

.btn-icon:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-icon.active {
  background: #007bff;
  color: white;
}

.btn-primary {
  padding: 6px 12px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: background 0.2s;
}

.btn-primary:hover {
  background: #0056b3;
}

.btn-secondary {
  padding: 6px 12px;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.separator {
  width: 1px;
  height: 24px;
  background: #dee2e6;
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
}

.search-box input {
  width: 200px;
  height: 32px;
  padding: 0 8px 0 32px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 14px;
}

.search-box .icon {
  position: absolute;
  left: 8px;
  color: #6c757d;
}

.view-switcher {
  display: flex;
  gap: 2px;
}

/* 面包屑导航 */
.breadcrumb {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: #fff;
  border-bottom: 1px solid #e9ecef;
  font-size: 14px;
}

.breadcrumb-item {
  color: #007bff;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 2px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.breadcrumb-item:hover:not(.active) {
  background: #e7f3ff;
  text-decoration: underline;
}

.breadcrumb-item.active {
  color: #495057;
  cursor: default;
}

.breadcrumb-separator {
  color: #6c757d;
  margin: 0 4px;
}

/* 分栏布局 */
.split-view {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.tree-panel {
  width: 250px;
  background: #f8f9fa;
  border-right: 1px solid #dee2e6;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tree-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid #dee2e6;
  font-size: 14px;
  font-weight: 500;
}

.splitter {
  width: 3px;
  background: #dee2e6;
  cursor: col-resize;
  position: relative;
}

.splitter:hover {
  background: #007bff;
}

.file-panel {
  flex: 1;
  position: relative;
  overflow: auto;
}

.file-panel.drag-over {
  background: #f0f8ff;
}

/* 拖拽提示 */
.drop-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 123, 255, 0.1);
  border: 2px dashed #007bff;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.drop-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: #007bff;
  font-size: 18px;
  font-weight: 500;
}

.drop-hint .icon {
  font-size: 48px;
}

/* 加载状态 */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #007bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #6c757d;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.3;
}

.empty-text {
  font-size: 16px;
  margin-bottom: 24px;
}

.empty-actions {
  display: flex;
  gap: 12px;
}

/* 状态栏 */
.status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 12px;
  background: #f8f9fa;
  border-top: 1px solid #dee2e6;
  font-size: 12px;
  color: #6c757d;
}

.status-left,
.status-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.upload-status {
  color: #007bff;
}

.storage-info {
  color: #495057;
}
</style>