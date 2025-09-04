<template>
  <div 
    class="file-grid"
    :class="viewMode"
    @click="handleBackgroundClick"
  >
    <div 
      v-for="item in items"
      :key="item.id"
      class="grid-item"
      :class="{ 
        selected: isSelected(item),
        folder: item.type === 'folder',
        dragging: draggedItem?.id === item.id
      }"
      @click.stop="handleClick($event, item)"
      @dblclick="handleDoubleClick(item)"
      @contextmenu.prevent="handleContextMenu($event, item)"
      @dragstart="handleDragStart($event, item)"
      @dragend="handleDragEnd"
      @dragover.prevent="handleDragOver($event, item)"
      @dragleave="handleDragLeave($event, item)"
      @drop="handleDrop($event, item)"
      :draggable="true"
    >
      <!-- 缩略图 -->
      <div class="item-thumbnail">
        <div v-if="item.type === 'folder'" class="folder-icon">
          <span :style="{ color: item.color || '#4A90E2' }">📁</span>
        </div>
        <img 
          v-else-if="item.type === 'image' && item.id" 
          :src="`/api/assets/thumbnail/${item.id}`"
          @error="handleImageError($event, item)"
          loading="lazy"
        >
        <div v-else class="file-icon-large">
          <span>{{ getIcon(item) }}</span>
        </div>
      </div>
      
      <!-- 选择框 -->
      <div class="item-checkbox" v-if="showCheckbox">
        <input 
          type="checkbox" 
          :checked="isSelected(item)"
          @click.stop="toggleSelection(item)"
        >
      </div>
      
      <!-- 名称 -->
      <div class="item-name" :title="item.name">
        {{ item.name }}
      </div>
      
      <!-- 额外信息（小图标模式下隐藏） -->
      <div class="item-info" v-if="viewMode !== 'grid-small'">
        <span v-if="item.type !== 'folder'" class="item-size">
          {{ formatSize(item.size) }}
        </span>
        <span class="item-date">
          {{ formatDate(item.updatedAt) }}
        </span>
      </div>
    </div>
    
    <!-- 拖拽选择框 -->
    <div 
      v-if="isSelecting"
      class="selection-box"
      :style="selectionBoxStyle"
    ></div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { formatFileSize, formatDate } from '../../utils/format'

const props = defineProps({
  items: {
    type: Array,
    required: true
  },
  selectedItems: {
    type: Array,
    default: () => []
  },
  viewMode: {
    type: String,
    default: 'grid-medium',
    validator: (value) => ['grid-large', 'grid-medium', 'grid-small'].includes(value)
  },
  showCheckbox: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'select',
  'select-all',
  'open',
  'context-menu',
  'drag-drop'
])

const draggedItem = ref(null)
const dragOverItem = ref(null)
const isSelecting = ref(false)
const selectionStart = ref({ x: 0, y: 0 })
const selectionEnd = ref({ x: 0, y: 0 })

const selectionBoxStyle = computed(() => {
  const x1 = Math.min(selectionStart.value.x, selectionEnd.value.x)
  const y1 = Math.min(selectionStart.value.y, selectionEnd.value.y)
  const x2 = Math.max(selectionStart.value.x, selectionEnd.value.x)
  const y2 = Math.max(selectionStart.value.y, selectionEnd.value.y)
  
  return {
    left: x1 + 'px',
    top: y1 + 'px',
    width: (x2 - x1) + 'px',
    height: (y2 - y1) + 'px'
  }
})

const isSelected = (item) => {
  return props.selectedItems.some(i => i.id === item.id)
}

const toggleSelection = (item) => {
  emit('select', item, { toggle: true })
}

const handleClick = (event, item) => {
  const multi = event.ctrlKey || event.metaKey
  const range = event.shiftKey
  emit('select', item, { multi, range })
}

const handleDoubleClick = (item) => {
  emit('open', item)
}

const handleBackgroundClick = (event) => {
  // 点击背景时清除选择
  if (!event.ctrlKey && !event.metaKey) {
    emit('select-all', false)
  }
}

const handleContextMenu = (event, item) => {
  // 如果右键的项目未被选中，先选中它
  if (!isSelected(item)) {
    emit('select', item, { multi: false })
  }
  emit('context-menu', event, item)
}

const handleDragStart = (event, item) => {
  draggedItem.value = item
  
  // 如果拖拽的项目未被选中，先选中它
  if (!isSelected(item)) {
    emit('select', item, { multi: false })
  }
  
  // 设置拖拽数据
  const dragData = props.selectedItems.length > 1 
    ? props.selectedItems 
    : [item]
  
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('items', JSON.stringify(dragData))
}

const handleDragEnd = () => {
  draggedItem.value = null
  dragOverItem.value = null
}

const handleDragOver = (event, item) => {
  if (item.type === 'folder' && item.id !== draggedItem.value?.id) {
    event.dataTransfer.dropEffect = 'move'
    dragOverItem.value = item
    event.currentTarget.classList.add('drag-over')
  }
}

const handleDragLeave = (event, item) => {
  if (dragOverItem.value?.id === item.id) {
    dragOverItem.value = null
    event.currentTarget.classList.remove('drag-over')
  }
}

const handleDrop = (event, item) => {
  event.preventDefault()
  event.currentTarget.classList.remove('drag-over')
  
  if (item.type === 'folder') {
    const items = event.dataTransfer.getData('items')
    if (items) {
      try {
        const draggedItems = JSON.parse(items)
        emit('drag-drop', draggedItems, item)
      } catch (error) {
        console.error('Failed to parse drop data:', error)
      }
    }
  }
  
  dragOverItem.value = null
}

const handleImageError = (event, item) => {
  // 图片加载失败时显示默认图标
  event.target.style.display = 'none'
  event.target.parentElement.innerHTML = '<span class="fallback-icon">🖼️</span>'
}

const getIcon = (item) => {
  if (item.type === 'folder') return '📁'
  
  const ext = item.name.split('.').pop().toLowerCase()
  const iconMap = {
    // 图片
    jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', webp: '🖼️', svg: '🖼️',
    // 文档
    pdf: '📄', doc: '📄', docx: '📄', txt: '📝', md: '📝',
    // 代码
    js: '📜', ts: '📜', html: '🌐', css: '🎨', json: '📋',
    // 压缩包
    zip: '📦', rar: '📦', '7z': '📦',
    // 音视频
    mp3: '🎵', mp4: '🎬', wav: '🎵', avi: '🎬'
  }
  
  return iconMap[ext] || '📄'
}

const formatSize = (bytes) => {
  return formatFileSize(bytes)
}
</script>

<style scoped>
.file-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 10px;
  position: relative;
  min-height: 200px;
}

.grid-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px;
  border-radius: 4px;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s;
  position: relative;
}

/* 大图标 */
.file-grid.grid-large .grid-item {
  width: 120px;
}

.file-grid.grid-large .item-thumbnail {
  width: 80px;
  height: 80px;
}

/* 中图标 */
.file-grid.grid-medium .grid-item {
  width: 100px;
}

.file-grid.grid-medium .item-thumbnail {
  width: 60px;
  height: 60px;
}

/* 小图标 */
.file-grid.grid-small .grid-item {
  width: 80px;
}

.file-grid.grid-small .item-thumbnail {
  width: 40px;
  height: 40px;
}

.grid-item:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.grid-item.selected {
  background-color: #e3f2fd;
}

.grid-item.selected:hover {
  background-color: #bbdefb;
}

.grid-item.dragging {
  opacity: 0.5;
}

.grid-item.drag-over {
  background-color: #bbdefb;
  outline: 2px solid #2196f3;
  outline-offset: -2px;
}

.item-thumbnail {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 4px;
  border-radius: 4px;
  overflow: hidden;
  background: #f5f5f5;
}

.item-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.folder-icon {
  font-size: 48px;
}

.file-grid.grid-medium .folder-icon {
  font-size: 40px;
}

.file-grid.grid-small .folder-icon {
  font-size: 32px;
}

.file-icon-large {
  font-size: 36px;
}

.file-grid.grid-medium .file-icon-large {
  font-size: 30px;
}

.file-grid.grid-small .file-icon-large {
  font-size: 24px;
}

.fallback-icon {
  font-size: inherit;
}

.item-checkbox {
  position: absolute;
  top: 4px;
  left: 4px;
  background: white;
  border-radius: 2px;
  padding: 2px;
}

.item-name {
  font-size: 12px;
  text-align: center;
  word-break: break-word;
  line-height: 1.2;
  max-width: 100%;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  text-overflow: ellipsis;
}

.item-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 11px;
  color: #666;
  margin-top: 2px;
}

.selection-box {
  position: absolute;
  border: 1px solid #2196f3;
  background-color: rgba(33, 150, 243, 0.1);
  pointer-events: none;
  z-index: 10;
}
</style>