<template>
  <teleport to="body">
    <div 
      v-if="visible"
      class="asset-reference-picker"
      :style="pickerStyle"
      @click.stop
    >
      <!-- 初始选择界面 -->
      <div v-if="mode === 'initial'" class="picker-menu">
        <div class="menu-header">选择引用类型</div>
        <div class="menu-item" @click="selectMode('category')">
          <el-icon class="menu-icon"><Folder /></el-icon>
          <span>按分类浏览</span>
        </div>
        <div class="menu-item" @click="selectMode('file')">
          <el-icon class="menu-icon"><Document /></el-icon>
          <span>按文件浏览</span>
        </div>
        <div class="menu-divider"></div>
        <div class="menu-item" @click="handleClose">
          <el-icon class="menu-icon"><Close /></el-icon>
          <span>取消</span>
        </div>
      </div>
      
      <!-- 分类选择界面 -->
      <div v-else-if="mode === 'category'" class="picker-menu">
        <div class="menu-header">
          <el-icon class="back-btn" @click="backToInitial"><ArrowLeft /></el-icon>
          选择分类
        </div>
        
        <!-- 搜索框 -->
        <div class="search-box">
          <el-input
            v-model="searchQuery"
            placeholder="搜索分类..."
            size="small"
            clearable
            @input="handleSearch"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
        </div>
        
        <!-- 分类列表 -->
        <div class="menu-list">
          <div 
            v-for="cat in filteredCategories" 
            :key="cat.key"
            class="menu-item"
            @click="selectCategory(cat)"
            :title="cat.fullLabel || cat.label"
          >
            <el-icon class="menu-icon"><Folder /></el-icon>
            <span class="item-text">{{ cat.label }}</span>
            <span class="item-count">{{ cat.fileCount || 0 }}</span>
          </div>
        </div>
        
        <div v-if="filteredCategories.length === 0" class="empty-message">
          没有找到匹配的分类
        </div>
      </div>
      
      <!-- 文件选择界面 -->
      <div v-else-if="mode === 'file'" class="picker-menu">
        <div class="menu-header">
          <el-icon class="back-btn" @click="backToInitial"><ArrowLeft /></el-icon>
          选择文件
        </div>
        
        <!-- 搜索框 -->
        <div class="search-box">
          <el-input
            v-model="searchQuery"
            placeholder="搜索文件..."
            size="small"
            clearable
            @input="handleSearch"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
        </div>
        
        <!-- 文件列表 -->
        <div class="menu-list">
          <div 
            v-for="file in filteredFiles" 
            :key="file.name"
            class="menu-item"
            @click="selectFile(file)"
            :title="`${file.categoryLabel}/${file.name}`"
          >
            <el-icon class="menu-icon">
              <component :is="getFileIcon(file.name)" />
            </el-icon>
            <span class="item-text">{{ file.name }}</span>
            <span class="item-category">{{ file.categoryLabel }}</span>
          </div>
        </div>
        
        <div v-if="filteredFiles.length === 0" class="empty-message">
          没有找到匹配的文件
        </div>
      </div>
    </div>
  </teleport>
  
  <!-- 点击外部关闭 -->
  <div 
    v-if="visible"
    class="picker-backdrop"
    @click="handleClose"
  ></div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { ElInput, ElIcon } from 'element-plus'
import { 
  Folder, 
  Document, 
  Close, 
  ArrowLeft, 
  Search,
  Picture,
  VideoPlay,
  Tickets,
  DataAnalysis
} from '@element-plus/icons-vue'
import { useAssetCache } from '@/composables/useAssetCache'

// Props
const props = defineProps({
  position: {
    type: Object,
    default: () => ({ x: 0, y: 0 })
  },
  visible: {
    type: Boolean,
    default: false
  }
})

// Emits
const emit = defineEmits(['select', 'close'])

// 状态
const mode = ref('initial')  // initial | category | file
const searchQuery = ref('')
const assetMetadata = ref(null)
const assetIndex = ref(null)
const assetCache = useAssetCache()

// 计算选择器位置
const pickerStyle = computed(() => {
  const maxWidth = 320
  const maxHeight = 400
  const padding = 10
  
  let x = props.position.x
  let y = props.position.y + 30  // 向下偏移
  
  // 防止超出视窗
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  
  if (x + maxWidth + padding > viewportWidth) {
    x = viewportWidth - maxWidth - padding
  }
  
  if (y + maxHeight + padding > viewportHeight) {
    y = props.position.y - maxHeight - 10  // 改为向上显示
  }
  
  return {
    left: `${Math.max(padding, x)}px`,
    top: `${Math.max(padding, y)}px`,
    maxWidth: `${maxWidth}px`,
    maxHeight: `${maxHeight}px`
  }
})

// 过滤后的分类列表
const filteredCategories = computed(() => {
  if (!assetIndex.value) return []
  
  const categories = Object.values(assetIndex.value.categories)
  
  if (!searchQuery.value) {
    return categories
  }
  
  const query = searchQuery.value.toLowerCase()
  return categories.filter(cat => 
    cat.label.toLowerCase().includes(query) ||
    cat.key.toLowerCase().includes(query)
  )
})

// 过滤后的文件列表
const filteredFiles = computed(() => {
  if (!assetIndex.value) return []
  
  let files = assetIndex.value.files || []
  
  if (!searchQuery.value) {
    return files.slice(0, 50)  // 限制显示数量
  }
  
  const query = searchQuery.value.toLowerCase()
  return files.filter(file => 
    file.name.toLowerCase().includes(query) ||
    file.categoryLabel.toLowerCase().includes(query)
  ).slice(0, 50)
})

// 获取文件图标
const getFileIcon = (fileName) => {
  const ext = fileName.split('.').pop().toLowerCase()
  
  const iconMap = {
    // 图片
    jpg: Picture,
    jpeg: Picture,
    png: Picture,
    gif: Picture,
    svg: Picture,
    webp: Picture,
    
    // 视频
    mp4: VideoPlay,
    avi: VideoPlay,
    mov: VideoPlay,
    wmv: VideoPlay,
    
    // 文档
    pdf: Tickets,
    doc: Document,
    docx: Document,
    txt: Document,
    md: Document,
    
    // 数据
    xlsx: DataAnalysis,
    xls: DataAnalysis,
    csv: DataAnalysis,
    json: DataAnalysis
  }
  
  return iconMap[ext] || Document
}

// 方法
const selectMode = (newMode) => {
  mode.value = newMode
  searchQuery.value = ''
}

const backToInitial = () => {
  mode.value = 'initial'
  searchQuery.value = ''
}

const selectCategory = (category) => {
  emit('select', {
    type: 'category',
    key: category.key,
    label: category.label,
    ...category
  })
  handleClose()
}

const selectFile = (file) => {
  emit('select', {
    type: 'file',
    name: file.name,
    fileName: file.name,
    category: file.category,
    categoryLabel: file.categoryLabel,
    ...file
  })
  handleClose()
}

const handleClose = () => {
  mode.value = 'initial'
  searchQuery.value = ''
  emit('close')
}

const handleSearch = () => {
  // 搜索逻辑已通过computed属性实现
}

// 加载元数据
const loadMetadata = async () => {
  try {
    console.log('[AssetReferencePicker] Loading metadata...')
    
    // 先清空旧数据
    assetMetadata.value = null
    assetIndex.value = null
    
    // 重新获取数据
    assetMetadata.value = await assetCache.getMetadata()
    console.log('[AssetReferencePicker] Metadata loaded:', JSON.stringify(assetMetadata.value, null, 2))
    
    if (assetMetadata.value) {
      buildAssetIndex()
      console.log('[AssetReferencePicker] Asset index built:', JSON.stringify(assetIndex.value, null, 2))
    } else {
      console.log('[AssetReferencePicker] No metadata available')
    }
  } catch (error) {
    console.error('[AssetReferencePicker] Failed to load asset metadata:', error)
  }
}

// 构建索引
const buildAssetIndex = () => {
  if (!assetMetadata.value) return
  
  assetIndex.value = {
    categories: {},
    files: []
  }
  
  // 新格式：使用 assets 和 labels
  if (assetMetadata.value.assets) {
    // 处理所有分类和文件
    Object.entries(assetMetadata.value.assets).forEach(([categoryKey, files]) => {
      const categoryLabel = categoryKey === '' 
        ? '根目录' 
        : (assetMetadata.value.labels?.[categoryKey] || categoryKey)
      
      // 添加分类（不包括根目录）
      if (categoryKey !== '') {
        // 计算文件数量
        const fileCount = files ? files.length : 0
        
        assetIndex.value.categories[categoryKey] = {
          key: categoryKey,
          label: categoryLabel,
          fullLabel: categoryLabel,
          files: files,
          fileCount: fileCount
        }
        
        console.log(`[AssetReferencePicker] Added category: key="${categoryKey}", label="${categoryLabel}"`)
      }
      
      // 添加文件
      if (files && files.length > 0) {
        files.forEach(file => {
          assetIndex.value.files.push({
            name: file,
            fileName: file,
            category: categoryKey,
            categoryLabel: categoryLabel
          })
        })
      }
    })
  }
  
  // 如果有树形结构，也处理它（用于分层显示）
  // 但不要覆盖已经从 labels 设置的正确标签
  if (assetMetadata.value.tree) {
    assetMetadata.value.tree.forEach(cat => {
      // 只处理尚未添加的分类
      if (!assetIndex.value.categories[cat.key]) {
        processCategory(cat)
      }
    })
  }
}

// 递归处理分类
const processCategory = (category, parentLabel = '') => {
  const fullLabel = parentLabel 
    ? `${parentLabel}/${category.label}` 
    : category.label
  
  // 计算文件数量
  let fileCount = category.files ? category.files.length : 0
  if (category.children) {
    category.children.forEach(child => {
      const childCount = countCategoryFiles(child)
      fileCount += childCount
    })
  }
  
  assetIndex.value.categories[category.key] = {
    ...category,
    fullLabel,
    fileCount
  }
  
  // 索引文件
  if (category.files) {
    category.files.forEach(file => {
      assetIndex.value.files.push({
        name: file,
        fileName: file,
        category: category.key,
        categoryLabel: category.label
      })
    })
  }
  
  // 递归处理子分类
  if (category.children) {
    category.children.forEach(child => 
      processCategory(child, fullLabel)
    )
  }
}

// 统计分类文件数
const countCategoryFiles = (category) => {
  let count = category.files ? category.files.length : 0
  
  if (category.children) {
    category.children.forEach(child => {
      count += countCategoryFiles(child)
    })
  }
  
  return count
}

// 键盘事件处理
const handleKeyDown = (event) => {
  if (event.key === 'Escape') {
    handleClose()
  }
}

// 生命周期
onMounted(() => {
  loadMetadata()
  document.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
})

// 监听visible变化
watch(() => props.visible, (newVal) => {
  if (newVal) {
    mode.value = 'initial'
    searchQuery.value = ''
    
    // 清空内存缓存，强制从 localStorage 重新加载
    assetCache.clearMemoryCache()
    
    // 每次显示时都重新加载数据，确保最新
    loadMetadata()
  }
})
</script>

<style scoped>
.asset-reference-picker {
  position: fixed;
  z-index: 3000;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  animation: fadeIn 0.2s ease;
}

.picker-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2999;
}

.picker-menu {
  width: 100%;
  max-height: 400px;
  display: flex;
  flex-direction: column;
}

.menu-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  border-bottom: 1px solid #ebeef5;
  background: #f5f7fa;
}

.back-btn {
  cursor: pointer;
  transition: color 0.3s;
}

.back-btn:hover {
  color: #409eff;
}

.search-box {
  padding: 12px;
  border-bottom: 1px solid #ebeef5;
}

.menu-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  cursor: pointer;
  transition: background 0.2s;
  font-size: 14px;
  color: #606266;
}

.menu-item:hover {
  background: #f5f7fa;
}

.menu-item:active {
  background: #ecf5ff;
}

.menu-icon {
  font-size: 16px;
  color: #909399;
}

.item-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-count {
  font-size: 12px;
  color: #909399;
  background: #f0f2f5;
  padding: 2px 6px;
  border-radius: 10px;
}

.item-category {
  font-size: 12px;
  color: #909399;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100px;
}

.menu-divider {
  height: 1px;
  background: #ebeef5;
  margin: 4px 0;
}

.empty-message {
  padding: 20px;
  text-align: center;
  color: #909399;
  font-size: 13px;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 移动端适配 */
@media (max-width: 768px) {
  .asset-reference-picker {
    position: fixed;
    left: 10px !important;
    right: 10px !important;
    top: auto !important;
    bottom: 10px !important;
    max-width: none !important;
    max-height: 50vh !important;
  }
}
</style>