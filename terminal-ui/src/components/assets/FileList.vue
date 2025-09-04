<template>
  <table class="file-list">
    <thead>
      <tr>
        <th class="checkbox-col">
          <input 
            type="checkbox" 
            :checked="allSelected"
            :indeterminate="someSelected && !allSelected"
            @change="$emit('select-all', $event.target.checked)"
          >
        </th>
        <th 
          class="name-col sortable" 
          @click="$emit('sort', 'name')"
        >
          名称 
          <span v-if="sortBy === 'name'" class="sort-arrow">
            {{ sortOrder === 'asc' ? '↑' : '↓' }}
          </span>
        </th>
        <th 
          class="date-col sortable" 
          @click="$emit('sort', 'date')"
        >
          修改时间
          <span v-if="sortBy === 'date'" class="sort-arrow">
            {{ sortOrder === 'asc' ? '↑' : '↓' }}
          </span>
        </th>
        <th 
          class="type-col sortable" 
          @click="$emit('sort', 'type')"
        >
          类型
          <span v-if="sortBy === 'type'" class="sort-arrow">
            {{ sortOrder === 'asc' ? '↑' : '↓' }}
          </span>
        </th>
        <th 
          class="size-col sortable" 
          @click="$emit('sort', 'size')"
        >
          大小
          <span v-if="sortBy === 'size'" class="sort-arrow">
            {{ sortOrder === 'asc' ? '↑' : '↓' }}
          </span>
        </th>
      </tr>
    </thead>
    <tbody>
      <tr 
        v-for="item in items"
        :key="item.id"
        class="file-row"
        :class="{ 
          selected: isSelected(item),
          folder: item.type === 'folder',
          dragging: draggedItem?.id === item.id
        }"
        @click="handleClick($event, item)"
        @dblclick="handleDoubleClick(item)"
        @contextmenu.prevent="handleContextMenu($event, item)"
        @dragstart="handleDragStart($event, item)"
        @dragend="handleDragEnd"
        @dragover.prevent="handleDragOver($event, item)"
        @dragleave="handleDragLeave($event, item)"
        @drop="handleDrop($event, item)"
        :draggable="true"
      >
        <td class="checkbox-col">
          <input 
            type="checkbox" 
            :checked="isSelected(item)"
            @click.stop="toggleSelection(item)"
          >
        </td>
        <td class="name-col">
          <span class="file-icon">{{ getIcon(item) }}</span>
          <span class="file-name">{{ item.name }}</span>
        </td>
        <td class="date-col">{{ formatDate(item.updatedAt) }}</td>
        <td class="type-col">{{ getType(item) }}</td>
        <td class="size-col">
          {{ item.type === 'folder' ? '-' : formatSize(item.size) }}
        </td>
      </tr>
    </tbody>
  </table>
</template>

<script setup>
import { ref } from 'vue'
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
  sortBy: {
    type: String,
    default: 'name'
  },
  sortOrder: {
    type: String,
    default: 'asc'
  },
  allSelected: {
    type: Boolean,
    default: false
  },
  someSelected: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'select',
  'select-all',
  'open',
  'context-menu',
  'sort',
  'drag-drop'
])

const draggedItem = ref(null)
const dragOverItem = ref(null)

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
  
  // 设置拖拽图像
  const dragImage = document.createElement('div')
  dragImage.innerHTML = `📄 ${dragData.length} 个项目`
  dragImage.style.position = 'absolute'
  dragImage.style.left = '-1000px'
  document.body.appendChild(dragImage)
  event.dataTransfer.setDragImage(dragImage, 0, 0)
  setTimeout(() => document.body.removeChild(dragImage), 0)
}

const handleDragEnd = () => {
  draggedItem.value = null
  dragOverItem.value = null
}

const handleDragOver = (event, item) => {
  if (item.type === 'folder' && item.id !== draggedItem.value?.id) {
    event.dataTransfer.dropEffect = 'move'
    dragOverItem.value = item
  }
}

const handleDragLeave = (event, item) => {
  if (dragOverItem.value?.id === item.id) {
    dragOverItem.value = null
  }
}

const handleDrop = (event, item) => {
  event.preventDefault()
  
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

const getType = (item) => {
  if (item.type === 'folder') return '文件夹'
  
  const ext = item.name.split('.').pop().toLowerCase()
  const typeMap = {
    jpg: 'JPG图片', jpeg: 'JPEG图片', png: 'PNG图片', gif: 'GIF图片',
    pdf: 'PDF文档', doc: 'Word文档', docx: 'Word文档', txt: '文本文档',
    js: 'JavaScript', ts: 'TypeScript', html: 'HTML文档', css: '样式表',
    zip: 'ZIP压缩包', rar: 'RAR压缩包'
  }
  
  return typeMap[ext] || `${ext.toUpperCase()}文件`
}

const formatSize = (bytes) => {
  return formatFileSize(bytes)
}
</script>

<style scoped>
.file-list {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  user-select: none;
}

.file-list thead {
  background: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
}

.file-list th {
  padding: 8px 12px;
  text-align: left;
  font-weight: normal;
  color: #666;
  white-space: nowrap;
}

.file-list th.sortable {
  cursor: pointer;
}

.file-list th.sortable:hover {
  background: #ebebeb;
}

.checkbox-col {
  width: 30px;
  text-align: center !important;
}

.name-col {
  min-width: 200px;
}

.date-col {
  width: 150px;
}

.type-col {
  width: 120px;
}

.size-col {
  width: 100px;
  text-align: right !important;
}

.sort-arrow {
  margin-left: 4px;
  color: #333;
}

.file-row {
  border-bottom: 1px solid #f0f0f0;
  transition: background-color 0.1s;
}

.file-row:hover {
  background-color: #f8f8f8;
}

.file-row.selected {
  background-color: #e3f2fd;
}

.file-row.selected:hover {
  background-color: #bbdefb;
}

.file-row.folder {
  font-weight: 500;
}

.file-row.dragging {
  opacity: 0.5;
}

.file-row td {
  padding: 6px 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-icon {
  margin-right: 6px;
  font-size: 16px;
  vertical-align: middle;
}

.file-name {
  vertical-align: middle;
}

/* 拖拽悬停效果 */
.file-row.folder.drag-over {
  background-color: #bbdefb;
  outline: 2px solid #2196f3;
  outline-offset: -2px;
}
</style>