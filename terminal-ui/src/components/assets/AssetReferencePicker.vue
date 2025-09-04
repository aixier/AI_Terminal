<template>
  <div class="asset-reference-picker">
    <!-- 遮罩层 -->
    <div class="picker-overlay" @click="$emit('close')"></div>
    
    <!-- 选择器弹窗 -->
    <div class="picker-popup" :style="popupStyle">
      <!-- 头部 -->
      <div class="picker-header">
        <input 
          ref="searchInput"
          v-model="searchQuery"
          type="text"
          placeholder="搜索素材..."
          @input="handleSearch"
        >
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>
      
      <!-- 内容 -->
      <div class="picker-body" v-loading="loading">
        <!-- 最近使用 -->
        <div v-if="recentAssets.length > 0" class="asset-section">
          <div class="section-title">最近使用</div>
          <div class="asset-list">
            <div 
              v-for="asset in recentAssets"
              :key="asset.id"
              class="asset-item"
              @click="selectAsset(asset)"
            >
              <span class="asset-icon">{{ getAssetIcon(asset.type) }}</span>
              <span class="asset-name">{{ asset.name }}</span>
              <span class="asset-ref">{{ asset.shortReference }}</span>
            </div>
          </div>
        </div>
        
        <!-- 所有素材 -->
        <div class="asset-section">
          <div class="section-title">
            所有素材
            <span class="section-count">({{ filteredAssets.length }})</span>
          </div>
          
          <!-- 类型筛选标签 -->
          <div class="type-tabs">
            <button 
              v-for="type in assetTypes"
              :key="type.value"
              class="type-tab"
              :class="{ active: selectedType === type.value }"
              @click="selectedType = type.value"
            >
              {{ type.icon }} {{ type.label }}
            </button>
          </div>
          
          <!-- 素材列表 -->
          <div class="asset-list">
            <div 
              v-for="asset in displayAssets"
              :key="asset.id"
              class="asset-item"
              @click="selectAsset(asset)"
            >
              <span class="asset-icon">{{ getAssetIcon(asset.type) }}</span>
              <div class="asset-details">
                <div class="asset-name">{{ asset.name }}</div>
                <div class="asset-meta">
                  {{ formatFileSize(asset.size) }} · {{ formatTime(asset.createdAt) }}
                </div>
              </div>
              <span class="asset-ref">{{ asset.shortReference }}</span>
            </div>
          </div>
          
          <!-- 空状态 -->
          <div v-if="displayAssets.length === 0" class="empty-state">
            <span>没有找到匹配的素材</span>
          </div>
        </div>
      </div>
      
      <!-- 底部提示 -->
      <div class="picker-footer">
        <div class="help-text">
          点击素材插入引用，或使用键盘上下键选择，Enter确认
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { assetsApi, assetUtils } from '../../api/assets'

// Props
const props = defineProps({
  position: {
    type: Object,
    default: () => ({ x: 0, y: 0 })
  },
  maxHeight: {
    type: Number,
    default: 400
  }
})

// Emits
const emit = defineEmits(['select', 'close'])

// 状态
const loading = ref(false)
const searchQuery = ref('')
const recentAssets = ref([])
const allAssets = ref([])
const selectedType = ref('')
const selectedIndex = ref(-1)
const searchInput = ref(null)

// 素材类型配置
const assetTypes = [
  { value: '', label: '全部', icon: '📦' },
  { value: 'image', label: '图片', icon: '🖼️' },
  { value: 'document', label: '文档', icon: '📄' },
  { value: 'other', label: '其他', icon: '📁' }
]

// 计算属性
const filteredAssets = computed(() => {
  let result = allAssets.value
  
  // 搜索过滤
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(asset => 
      asset.name.toLowerCase().includes(query) ||
      asset.originalName?.toLowerCase().includes(query) ||
      asset.tags?.some(tag => tag.toLowerCase().includes(query))
    )
  }
  
  // 类型过滤
  if (selectedType.value) {
    result = result.filter(asset => asset.type === selectedType.value)
  }
  
  return result
})

const displayAssets = computed(() => {
  // 限制显示数量，避免列表过长
  return filteredAssets.value.slice(0, 50)
})

// 弹窗位置样式
const popupStyle = computed(() => {
  const { x, y } = props.position
  
  // 计算位置，确保不超出视窗
  let left = x
  let top = y + 30 // 在输入位置下方显示
  
  // 检查右边界
  if (left + 400 > window.innerWidth) {
    left = window.innerWidth - 400 - 20
  }
  
  // 检查下边界
  if (top + props.maxHeight > window.innerHeight) {
    top = y - props.maxHeight - 30 // 改为在输入位置上方显示
  }
  
  return {
    left: `${left}px`,
    top: `${top}px`,
    maxHeight: `${props.maxHeight}px`
  }
})

// 方法
const loadAssets = async () => {
  loading.value = true
  try {
    // 加载最近使用的素材
    const recentResponse = await assetsApi.getReferences(true, 5)
    if (recentResponse.data.success) {
      recentAssets.value = recentResponse.data.data.references
    }
    
    // 加载所有素材
    const allResponse = await assetsApi.getReferences(false, 100)
    if (allResponse.data.success) {
      allAssets.value = allResponse.data.data.references
    }
  } catch (error) {
    console.error('加载素材失败:', error)
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  // 搜索时重置选择
  selectedIndex.value = -1
}

const selectAsset = (asset) => {
  emit('select', asset)
  emit('close')
}

const { getAssetIcon, formatFileSize } = assetUtils

const formatTime = (time) => {
  const date = new Date(time)
  const now = new Date()
  const diff = now - date
  
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`
  
  return date.toLocaleDateString()
}

// 键盘导航
const handleKeyDown = (event) => {
  const assets = displayAssets.value
  
  switch(event.key) {
    case 'ArrowUp':
      event.preventDefault()
      if (selectedIndex.value > 0) {
        selectedIndex.value--
      } else {
        selectedIndex.value = assets.length - 1
      }
      break
      
    case 'ArrowDown':
      event.preventDefault()
      if (selectedIndex.value < assets.length - 1) {
        selectedIndex.value++
      } else {
        selectedIndex.value = 0
      }
      break
      
    case 'Enter':
      event.preventDefault()
      if (selectedIndex.value >= 0 && selectedIndex.value < assets.length) {
        selectAsset(assets[selectedIndex.value])
      }
      break
      
    case 'Escape':
      event.preventDefault()
      emit('close')
      break
  }
}

// 生命周期
onMounted(async () => {
  await loadAssets()
  
  // 自动聚焦搜索框
  await nextTick()
  searchInput.value?.focus()
  
  // 添加键盘事件监听
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<style scoped>
.asset-reference-picker {
  position: fixed;
  z-index: 9999;
}

/* 遮罩层 */
.picker-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
}

/* 弹窗 */
.picker-popup {
  position: absolute;
  width: 400px;
  background: var(--bg-primary, #fff);
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 头部 */
.picker-header {
  display: flex;
  align-items: center;
  padding: 12px;
  border-bottom: 1px solid var(--border-color, #e0e0e0);
}

.picker-header input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 4px;
  font-size: 14px;
  background: var(--bg-secondary, #f5f5f5);
  color: var(--text-primary, #333);
}

.close-btn {
  width: 32px;
  height: 32px;
  margin-left: 8px;
  border: none;
  background: transparent;
  font-size: 20px;
  color: var(--text-secondary, #666);
  cursor: pointer;
}

.close-btn:hover {
  color: var(--text-primary, #333);
}

/* 内容 */
.picker-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

/* 分组 */
.asset-section {
  margin-bottom: 16px;
}

.asset-section:last-child {
  margin-bottom: 0;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary, #666);
  margin-bottom: 8px;
  text-transform: uppercase;
}

.section-count {
  font-weight: normal;
  color: var(--text-tertiary, #999);
}

/* 类型标签 */
.type-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.type-tab {
  padding: 4px 12px;
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 16px;
  background: var(--bg-secondary, #f5f5f5);
  font-size: 12px;
  color: var(--text-secondary, #666);
  cursor: pointer;
  transition: all 0.2s;
}

.type-tab.active {
  background: var(--primary-color, #007bff);
  color: white;
  border-color: var(--primary-color, #007bff);
}

/* 素材列表 */
.asset-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.asset-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.asset-item:hover {
  background: var(--bg-secondary, #f5f5f5);
}

.asset-icon {
  font-size: 20px;
  margin-right: 12px;
}

.asset-details {
  flex: 1;
  min-width: 0;
}

.asset-name {
  font-size: 14px;
  color: var(--text-primary, #333);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.asset-meta {
  font-size: 11px;
  color: var(--text-tertiary, #999);
  margin-top: 2px;
}

.asset-ref {
  font-family: monospace;
  font-size: 12px;
  color: var(--primary-color, #007bff);
  background: var(--bg-tertiary, #f0f0f0);
  padding: 2px 6px;
  border-radius: 3px;
  margin-left: 8px;
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 24px;
  color: var(--text-tertiary, #999);
  font-size: 14px;
}

/* 底部提示 */
.picker-footer {
  padding: 8px 12px;
  border-top: 1px solid var(--border-color, #e0e0e0);
  background: var(--bg-secondary, #f5f5f5);
}

.help-text {
  font-size: 12px;
  color: var(--text-tertiary, #999);
}

/* 移动端适配 */
@media (max-width: 768px) {
  .picker-popup {
    width: 90vw;
    max-width: 360px;
  }
}
</style>