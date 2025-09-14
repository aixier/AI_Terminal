<template>
  <div class="asset-manager-simple">
    <!-- 标题栏 -->
    <div class="header">
      <span class="title" @click="navigateToRoot">{{ title || '我的素材' }}</span>
      <button class="upload-btn" @click="selectFiles">上传文件</button>
    </div>

    <!-- 面包屑导航 - 只在不是根目录时显示 -->
    <div class="breadcrumb" v-if="breadcrumb.length > 0">
      <template v-for="(folder, index) in breadcrumb" :key="folder.key">
        <span v-if="index > 0" class="breadcrumb-separator">›</span>
        <span class="breadcrumb-item" @click="navigateToCategory(folder.key)">{{ folder.label }}</span>
      </template>
    </div>

    <!-- 主体区域 -->
    <div class="main-area">
      <!-- 文件列表区 -->
      <div 
        class="content-area"
        @contextmenu.prevent="handleContextMenu($event)"
        @click="clearSelection"
      >
        <!-- 空状态 -->
        <div v-if="!loading && displayItems.length === 0" class="empty-state">
          <div class="empty-icon">📁</div>
          <div class="empty-text">暂无素材，点击上传添加</div>
          <button class="upload-btn" @click="selectFiles">上传文件</button>
        </div>

        <!-- 文件网格 -->
        <div v-else class="file-grid">
          <div 
            v-for="item in displayItems" 
            :key="item.key || item.name"
            class="file-item"
            :class="{ 
              selected: isSelected(item),
              folder: item.type === 'category'
            }"
            @click.stop="selectItem($event, item)"
            @dblclick="openItem(item)"
            @contextmenu.prevent.stop="handleItemContextMenu($event, item)"
          >
            <div class="file-icon">
              <span v-if="item.type === 'category'">📁</span>
              <span v-else-if="item.type === 'image'">🖼️</span>
              <span v-else>📄</span>
            </div>
            <div class="file-name" :title="item.label || item.name">
              {{ item.label || item.name }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 状态栏 -->
    <div class="status-bar">
      <span>{{ selectedItems.length > 0 ? `已选择 ${selectedItems.length} 项` : `${displayItems.length} 个项目` }}</span>
    </div>

    <!-- 右键菜单 -->
    <div 
      v-if="contextMenu.show" 
      class="context-menu"
      :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
      @click.stop
    >
      <div 
        v-for="item in contextMenu.items" 
        :key="item.action"
        class="menu-item"
        :class="{ 
          separator: item.separator,
          disabled: item.disabled 
        }"
        @click="handleMenuAction(item.action)"
      >
        <span v-if="!item.separator">{{ item.label }}</span>
      </div>
    </div>

    <!-- 文件上传 -->
    <input 
      ref="fileInput" 
      type="file" 
      multiple 
      style="display: none"
      @change="handleFileSelect"
    >

    <!-- 新建文件夹对话框 -->
    <div v-if="showNewFolderDialog" class="dialog-overlay" @click.self="closeNewFolderDialog">
      <div class="dialog">
        <div class="dialog-header">新建文件夹</div>
        <div class="dialog-body">
          <input 
            v-model="newFolderName" 
            placeholder="文件夹名称"
            @keyup.enter="createFolder"
            ref="folderNameInput"
          >
        </div>
        <div class="dialog-footer">
          <button @click="createFolder" class="btn-primary">确定</button>
          <button @click="closeNewFolderDialog">取消</button>
        </div>
      </div>
    </div>
    
    <!-- 重命名对话框 -->
    <div v-if="showRenameDialog" class="dialog-overlay" @click.self="closeRenameDialog">
      <div class="dialog">
        <div class="dialog-header">重命名</div>
        <div class="dialog-body">
          <input 
            v-model="renameName" 
            placeholder="请输入新名称"
            @keyup.enter="renameCategory"
            ref="renameInput"
          >
        </div>
        <div class="dialog-footer">
          <button @click="renameCategory" class="btn-primary">确定</button>
          <button @click="closeRenameDialog">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { assetsApiV2 } from '../../api/assetsV2'

// 解码文件名的工具函数
const decodeFileName = (fileName) => {
  if (!fileName) return fileName
  
  // 如果文件名看起来像是Latin-1编码的中文（包含特定字符）
  if (fileName.includes('æ') || fileName.includes('å') || fileName.includes('Ã')) {
    try {
      // 尝试修复乱码
      // 这种乱码通常是UTF-8被错误地解释为Latin-1
      const bytes = []
      for (let i = 0; i < fileName.length; i++) {
        bytes.push(fileName.charCodeAt(i))
      }
      // 尝试将字节数组解释为UTF-8
      const decoder = new TextDecoder('utf-8')
      const uint8Array = new Uint8Array(bytes)
      const decoded = decoder.decode(uint8Array)
      
      if (decoded && !decoded.includes('�')) {
        console.log(`[AssetManager] Decoded filename: ${fileName} -> ${decoded}`)
        return decoded
      }
    } catch (e) {
      console.log('[AssetManager] Failed to decode filename:', fileName)
    }
  }
  
  return fileName
}

// 状态
const loading = ref(false)
const currentCategory = ref('')  // 当前分类的key，空字符串表示根目录
const breadcrumb = ref([])
const searchQuery = ref('')
const selectedItems = ref([])
const displayItems = ref([])
const categoryTree = ref([])
const categoriesData = ref({})  // 存储分类原始数据
const labelsData = ref({})  // 存储分类标签
const navigationHistory = ref([''])
const navigationIndex = ref(0)
const showSidebar = ref(false) // 默认隐藏侧边栏，单列布局
const contextMenu = ref({
  show: false,
  x: 0,
  y: 0,
  items: []
})
const showNewFolderDialog = ref(false)
const newFolderName = ref('')
const showRenameDialog = ref(false)
const renameItem = ref(null)
const renameName = ref('')

// Refs
const fileInput = ref(null)
const folderNameInput = ref(null)
const renameInput = ref(null)

// 计算属性
const canGoBack = computed(() => navigationIndex.value > 0)
const canGoForward = computed(() => navigationIndex.value < navigationHistory.value.length - 1)

// 保存元数据到缓存（供 @ 功能使用）
const saveMetadataToCache = (data) => {
  try {
    // 转换数据格式：categories -> assets
    const metadata = {
      version: data.version || '3.0',
      userId: data.userId || 'default',
      lastUpdated: data.lastUpdated || new Date().toISOString(),
      assets: data.categories || {},  // categories 映射到 assets
      labels: data.labels || {},
      tree: data.tree || []  // 保留树形结构
    }
    
    // 包装成缓存格式
    const cacheData = {
      data: metadata,
      timestamp: Date.now(),
      version: metadata.version,
      lastUpdated: metadata.lastUpdated
    }
    
    // 直接保存 JSON，不进行编码
    localStorage.setItem('asset_metadata', JSON.stringify(cacheData))
    localStorage.setItem('asset_metadata_version', cacheData.lastUpdated)
    
    console.log('[AssetManagerSimple] Asset metadata saved to localStorage:', metadata)
  } catch (error) {
    console.error('[AssetManagerSimple] Failed to save metadata to cache:', error)
  }
}

// 方法
const loadData = async () => {
  loading.value = true
  try {
    // 获取完整的元数据（包含作品集）
    const metadataRes = await assetsApiV2.getMetadata()
    let metadata = null

    if (metadataRes.success && metadataRes.data) {
      // 使用元数据中的 tree 结构（包含作品集）
      categoryTree.value = metadataRes.data.tree || []

      // 保存元数据到缓存
      metadata = {
        categories: metadataRes.data.assets || {},
        labels: metadataRes.data.labels || {},
        tree: categoryTree.value,
        lastUpdated: metadataRes.data.lastUpdated || new Date().toISOString()
      }
      saveMetadataToCache(metadata)
      updateBreadcrumb()
    }

    // 如果在根目录，显示作品集文件夹
    if (!currentCategory.value && metadata) {
      // 从元数据中获取作品集列表
      const metadataCategories = metadata.categories || {}
      const metadataLabels = metadata.labels || {}

      // 构建显示项
      displayItems.value = [
        // 显示作品集文件夹
        ...Object.keys(metadataCategories).map(key => ({
          key: key,
          label: metadataLabels[key] || key,
          type: 'category',
          fileCount: metadataCategories[key]?.length || 0,
          isCollection: true
        }))
      ]
    } else if (metadata) {
      // 对于作品集，直接从缓存的元数据中获取文件
      const metadataCategories = metadata.categories || {}

      if (metadataCategories[currentCategory.value]) {
        // 作品集中的文件
        const files = metadataCategories[currentCategory.value] || []
        displayItems.value = files.map(file => ({
          name: file.name || file.fileName,
          path: file.path,
          size: file.size,
          type: 'file',
          mimeType: file.type,
          isNewApi: true,
          category: currentCategory.value
        }))
      } else {
        // 普通文件夹，从API获取
        const params = { path: currentCategory.value }
        if (searchQuery.value) {
          params.search = searchQuery.value
        }

        const assetsRes = await assetsApiV2.getAssets(params)
        if (assetsRes.success) {
          // 新API直接返回数组，不再嵌套在assets属性中
          const assets = Array.isArray(assetsRes.data) ? assetsRes.data : (assetsRes.data.assets || [])

        // 从新API响应中分离文件夹和文件
        const folders = assets.filter(item => item.isDirectory || item.type === 'folder')
        const files = assets.filter(item => !item.isDirectory && item.type !== 'folder')
      
        // 合并文件夹和文件显示
        displayItems.value = [
          // 显示新API返回的文件夹
          ...folders.map(folder => ({
            key: folder.path || folder.name,
            label: folder.name,
            type: 'category',
            fileCount: 0,
            isNewApi: true
          })),
          // 显示文件
          ...files.map(file => ({
            name: file.name,
            path: file.path,
            size: file.size,
            type: 'file',
            mimeType: file.mimeType,
            isNewApi: true
          }))
        ]
        }
      }
    }
  } catch (error) {
    console.error('Failed to load data:', error)
  } finally {
    loading.value = false
  }
}

const updateBreadcrumb = () => {
  const path = []
  let current = currentCategory.value
  
  // 新系统使用路径分隔符而不是点号
  if (current && current.length > 0) {
    const parts = current.split('/')
    let accumulated = ''
    
    for (const part of parts) {
      if (part) {
        accumulated = accumulated ? `${accumulated}/${part}` : part
        path.push({ 
          key: accumulated, 
          label: part 
        })
      }
    }
  }
  
  breadcrumb.value = path
}

const navigateToCategory = (categoryKey) => {
  // 对于新API的文件夹，使用path作为导航键
  currentCategory.value = categoryKey || ''
  selectedItems.value = []
  
  // 更新导航历史
  navigationHistory.value = navigationHistory.value.slice(0, navigationIndex.value + 1)
  navigationHistory.value.push(categoryKey)
  navigationIndex.value++
  
  loadData()
}

const navigateToRoot = () => {
  navigateToCategory('')
}

const goBack = () => {
  if (canGoBack.value) {
    navigationIndex.value--
    currentCategory.value = navigationHistory.value[navigationIndex.value]
    loadData()
  }
}

const goForward = () => {
  if (canGoForward.value) {
    navigationIndex.value++
    currentCategory.value = navigationHistory.value[navigationIndex.value]
    loadData()
  }
}

const goUp = () => {
  if (currentCategory.value) {
    // Helper function to find folder in nested structure
    const findFolder = (folders, id) => {
      for (const folder of folders) {
        if (folder.id === id) {
          return folder
        }
        if (folder.children && folder.children.length > 0) {
          const found = findFolder(folder.children, id)
          if (found) return found
        }
      }
      return null
    }
    
    // 获取当前分类的子分类
    const subCategories = Object.keys(categoriesData.value)
      .filter(key => key.startsWith(currentCategory.value + '.') && key.split('.').length === currentCategory.value.split('.').length + 1)
    if (current) {
      // 获取父分类
      const parts = current.key ? current.key.split('.') : []
      const parentKey = parts.length > 1 ? parts.slice(0, -1).join('.') : ''
      navigateToCategory(parentKey)
    }
  }
}

const handleSearch = () => {
  loadData()
}

const isSelected = (item) => {
  return selectedItems.value.some(i => (i.key || i.name) === (item.key || item.name))
}

const selectItem = (event, item) => {
  if (event.ctrlKey || event.metaKey) {
    // 多选
    if (isSelected(item)) {
      selectedItems.value = selectedItems.value.filter(i => (i.key || i.name) !== (item.key || item.name))
    } else {
      selectedItems.value.push(item)
    }
  } else {
    // 单选
    selectedItems.value = [item]
  }
}

const clearSelection = () => {
  selectedItems.value = []
}

const openItem = (item) => {
  console.log('openItem:', item)
  if (item.type === 'category') {
    navigateToCategory(item.key)
  } else if (item.type === 'file') {
    // 预览文件 - 使用分类和文件名
    const fileUrl = `/api/assets/file/${item.category ? item.category + '/' : ''}${item.name}`
    window.open(fileUrl, '_blank')
  } else {
    console.warn('Unknown item type:', item.type)
  }
}

// 右键菜单
const handleContextMenu = (event) => {
  contextMenu.value = {
    show: true,
    x: event.clientX,
    y: event.clientY,
    items: [
      { label: '新建文件夹', action: 'newFolder' },
      { separator: true },
      { label: '上传文件', action: 'upload' },
      { separator: true },
      { label: '刷新', action: 'refresh' }
    ]
  }
}

const handleItemContextMenu = (event, item) => {
  // 如果未选中，先选中
  if (!isSelected(item)) {
    selectedItems.value = [item]
  }
  
  const items = []
  
  if (item.type === 'category') {
    items.push(
      { label: '打开', action: 'open' },
      { separator: true },
      { label: '重命名', action: 'rename' },
      { label: '删除', action: 'delete' }
    )
  } else {
    items.push(
      { label: '打开', action: 'open' },
      { label: '下载', action: 'download' },
      { separator: true },
      { label: '重命名', action: 'rename' },
      { label: '删除', action: 'delete' }
    )
  }
  
  contextMenu.value = {
    show: true,
    x: event.clientX,
    y: event.clientY,
    items
  }
}

const handleTreeContextMenu = (event, folder) => {
  const items = folder ? [
    { label: '打开', action: 'open' },
    { separator: true },
    { label: '新建子文件夹', action: 'newSubfolder' },
    { separator: true },
    { label: '重命名', action: 'rename' },
    { label: '删除', action: 'delete' }
  ] : [
    { label: '新建文件夹', action: 'newFolder' },
    { separator: true },
    { label: '上传文件', action: 'upload' }
  ]
  
  if (folder) {
    selectedItems.value = [folder]
  }
  
  contextMenu.value = {
    show: true,
    x: event.clientX,
    y: event.clientY,
    items
  }
}

const handleMenuAction = async (action) => {
  contextMenu.value.show = false
  
  switch (action) {
    case 'newFolder':
    case 'newSubfolder':
      showNewFolderDialog.value = true
      newFolderName.value = '新建文件夹'
      nextTick(() => {
        folderNameInput.value?.select()
      })
      break
      
    case 'upload':
      selectFiles()
      break
      
    case 'open':
      if (selectedItems.value.length > 0) {
        openItem(selectedItems.value[0])
      }
      break
      
    case 'download':
      if (selectedItems.value.length > 0) {
        const item = selectedItems.value[0]
        window.open(`/api/assets/file/${item.id}`, '_blank')
      }
      break
      
    case 'rename':
      if (selectedItems.value.length > 0) {
        const item = selectedItems.value[0]
        renameItem.value = item
        renameName.value = item.name
        showRenameDialog.value = true
        nextTick(() => {
          renameInput.value?.select()
        })
      }
      break
      
    case 'delete':
      if (selectedItems.value.length > 0) {
        if (confirm(`确定删除选中的 ${selectedItems.value.length} 个项目吗？`)) {
          await deleteSelected()
        }
      }
      break
      
    case 'refresh':
      loadData()
      break
  }
}

const selectFiles = () => {
  fileInput.value?.click()
}

const handleFileSelect = async (event) => {
  const files = Array.from(event.target.files)
  if (files.length === 0) return
  
  try {
    const formData = new FormData()
    
    // 处理每个文件，确保文件名正确编码并替换空格
    files.forEach(file => {
      // 替换文件名中的空格为下划线
      let fileName = file.name.replace(/\s+/g, '_')
      
      // 如果文件名包含中文或特殊字符，需要特别处理
      if (fileName && /[^\x00-\x7F]/.test(fileName)) {
        // 文件名包含非ASCII字符
        console.log('[AssetManager] Original filename:', file.name, '-> Processed:', fileName)
        
        // 使用处理后的文件名
        formData.append('files', file, fileName)
      } else {
        // 即使是纯ASCII文件名，也使用处理后的文件名（已替换空格）
        console.log('[AssetManager] Original filename:', file.name, '-> Processed:', fileName)
        formData.append('files', file, fileName)
      }
    })
    
    // 新API使用path而不是category
    if (currentCategory.value) {
      formData.append('path', currentCategory.value)
    }
    
    // 添加编码标记，告诉后端这是UTF-8编码的
    formData.append('encoding', 'utf-8')
    
    await assetsApiV2.uploadBatch(formData)
    ElMessage.success('上传成功')
    loadData()
  } catch (error) {
    // 特殊处理文件名冲突错误
    if (error.response?.data?.error?.includes('已存在')) {
      ElMessage.error(error.response.data.error)
    } else {
      ElMessage.error('上传失败: ' + (error.response?.data?.error || error.message))
    }
  }
  
  event.target.value = ''
}

const createFolder = async () => {
  if (!newFolderName.value.trim()) {
    ElMessage.warning('请输入文件夹名称')
    return
  }
  
  try {
    // 使用新的真实文件系统 API
    await assetsApiV2.createFolder({
      path: currentCategory.value || '',
      name: newFolderName.value
    })
    ElMessage.success('文件夹创建成功')
    closeNewFolderDialog()
    loadData()
  } catch (error) {
    ElMessage.error('创建失败: ' + error.message)
  }
}

const closeNewFolderDialog = () => {
  showNewFolderDialog.value = false
  newFolderName.value = ''
}

const renameCategory = async () => {
  if (!renameName.value.trim()) {
    ElMessage.warning('请输入名称')
    return
  }
  
  if (renameName.value === renameItem.value.name) {
    closeRenameDialog()
    return
  }
  
  try {
    if (renameItem.value.type === 'category') {
      // 使用新的rename API重命名文件夹
      const folderPath = renameItem.value.key || renameItem.value.path
      await assetsApiV2.rename({ oldPath: folderPath, newName: renameName.value })
      ElMessage.success('文件夹重命名成功')
    } else {
      // 重命名文件
      const filePath = renameItem.value.path || renameItem.value.originalName || renameItem.value.name
      await assetsApiV2.rename({ oldPath: filePath, newName: renameName.value })
      ElMessage.success('文件重命名成功')
    }
    closeRenameDialog()
    loadData()
  } catch (error) {
    ElMessage.error('重命名失败: ' + error.message)
  }
}

const closeRenameDialog = () => {
  showRenameDialog.value = false
  renameItem.value = null
  renameName.value = ''
}

const deleteSelected = async () => {
  try {
    for (const item of selectedItems.value) {
      // 使用统一的delete方法
      const itemPath = item.path || item.key || (item.category ? `${item.category}/${item.originalName || item.name}` : item.originalName || item.name)
      await assetsApiV2.delete(itemPath)
    }
    ElMessage.success('删除成功')
    selectedItems.value = []
    loadData()
  } catch (error) {
    ElMessage.error('删除失败: ' + error.message)
  }
}

// 点击外部关闭右键菜单
const handleClickOutside = () => {
  contextMenu.value.show = false
}

// 生命周期
onMounted(() => {
  loadData()
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.asset-manager-simple {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
  font-size: 13px;
  font-family: 'Segoe UI', system-ui, sans-serif;
  user-select: none;
}

/* 标题栏 */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #f8f8f8;
  border-bottom: 1px solid #e0e0e0;
}

.title {
  font-size: 16px;
  font-weight: 500;
  color: #333;
  cursor: pointer;
  transition: color 0.3s;
}

.title:hover {
  color: #0078d4;
}

.header .upload-btn {
  padding: 6px 16px;
  background: #0078d4;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: background-color 0.2s;
}

.header .upload-btn:hover {
  background: #106ebe;
}

/* 面包屑 */
.breadcrumb {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  background: #fff;
  border-bottom: 1px solid #e0e0e0;
  font-size: 12px;
}

.breadcrumb-item {
  color: #0078d4;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 2px;
}

.breadcrumb-item:hover {
  background: #e8f4fd;
  text-decoration: underline;
}

.breadcrumb-separator {
  color: #666;
  margin: 0 4px;
}

/* 主体区域 */
.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 内容区域 */
.content-area {
  flex: 1;
  overflow: auto;
  padding: 16px;
  background: white;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #999;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 10px;
  opacity: 0.3;
}

.empty-text {
  margin-bottom: 20px;
}

.empty-state .upload-btn {
  padding: 8px 20px;
  background: #0078d4;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.empty-state .upload-btn:hover {
  background: #106ebe;
}

/* 文件网格 */
.file-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 10px;
  padding: 4px;
}

.file-item {
  width: 90px;
  padding: 10px 5px;
  display: flex;
  flex-direction: column;
  align-items: center;
  border-radius: 3px;
  cursor: pointer;
}

.file-item:hover {
  background: #f0f0f0;
}

.file-item.selected {
  background: #cce5ff;
}

.file-icon {
  font-size: 32px;
  margin-bottom: 5px;
}

.file-name {
  font-size: 12px;
  text-align: center;
  word-break: break-all;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 状态栏 */
.status-bar {
  height: 24px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  background: #f0f0f0;
  border-top: 1px solid #ddd;
  font-size: 12px;
  color: #666;
}

/* 右键菜单 */
.context-menu {
  position: fixed;
  background: white;
  border: 1px solid #ccc;
  box-shadow: 2px 2px 8px rgba(0,0,0,0.15);
  padding: 4px 0;
  min-width: 150px;
  z-index: 1000;
}

.menu-item {
  padding: 6px 20px;
  cursor: pointer;
  font-size: 13px;
}

.menu-item:hover:not(.disabled):not(.separator) {
  background: #e8f0fe;
}

.menu-item.disabled {
  color: #999;
  cursor: not-allowed;
}

.menu-item.separator {
  height: 1px;
  background: #e0e0e0;
  margin: 4px 0;
  padding: 0;
}

/* 对话框 */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.dialog {
  background: white;
  border-radius: 4px;
  width: 400px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.2);
}

.dialog-header {
  padding: 15px;
  border-bottom: 1px solid #e0e0e0;
  font-weight: 500;
}

.dialog-body {
  padding: 20px;
}

.dialog-body input {
  width: 100%;
  height: 32px;
  padding: 0 10px;
  border: 1px solid #ddd;
  border-radius: 3px;
}

.dialog-body input:focus {
  outline: none;
  border-color: #0066cc;
}

.dialog-footer {
  padding: 15px;
  border-top: 1px solid #e0e0e0;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.dialog-footer button {
  padding: 6px 20px;
  border: 1px solid #ddd;
  border-radius: 3px;
  background: white;
  cursor: pointer;
}

.dialog-footer button:hover {
  background: #f0f0f0;
}

.dialog-footer .btn-primary {
  background: #0066cc;
  color: white;
  border-color: #0066cc;
}

.dialog-footer .btn-primary:hover {
  background: #0052a3;
}
</style>