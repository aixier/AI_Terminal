<template>
  <div class="file-list">
    <table class="list-table">
      <thead>
        <tr>
          <th class="col-name">名称</th>
          <th class="col-date">修改日期</th>
          <th class="col-type">类型</th>
          <th class="col-size">大小</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="item in items"
          :key="item.id"
          class="list-item"
          :class="{
            selected: isSelected(item),
            folder: item.type === 'folder'
          }"
          @click="handleClick($event, item)"
          @dblclick="handleDoubleClick(item)"
          @contextmenu.prevent="handleContextMenu($event, item)"
          draggable="true"
          @dragstart="handleDragStart($event, item)"
        >
          <td class="col-name">
            <div class="name-cell">
              <Icon :name="item.type === 'folder' ? 'folder' : getFileIcon(item)" />
              <span>{{ item.name }}</span>
            </div>
          </td>
          <td class="col-date">{{ formatDate(item.modified) }}</td>
          <td class="col-type">{{ getFileType(item) }}</td>
          <td class="col-size">{{ item.type === 'folder' ? '-' : formatSize(item.size) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import Icon from '../common/Icon.vue'

const props = defineProps({
  items: {
    type: Array,
    default: () => []
  },
  selectedItems: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['select', 'open', 'contextmenu'])

const isSelected = (item) => {
  return props.selectedItems.some(s => s.id === item.id)
}

const handleClick = (event, item) => {
  emit('select', event, item)
}

const handleDoubleClick = (item) => {
  emit('open', item)
}

const handleContextMenu = (event, item) => {
  emit('contextmenu', event, item)
}

const handleDragStart = (event, item) => {
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData('application/json', JSON.stringify(item))
}

const getFileIcon = (item) => {
  const ext = item.name.split('.').pop().toLowerCase()
  const iconMap = {
    jpg: 'image', jpeg: 'image', png: 'image', gif: 'image',
    mp4: 'video', avi: 'video', mov: 'video',
    mp3: 'audio', wav: 'audio',
    pdf: 'file-pdf', doc: 'file-word', docx: 'file-word',
    xls: 'file-excel', xlsx: 'file-excel',
    txt: 'file-text', md: 'file-text',
    js: 'file-code', ts: 'file-code', vue: 'file-code',
    zip: 'file-zip', rar: 'file-zip'
  }
  return iconMap[ext] || 'file'
}

const getFileType = (item) => {
  if (item.type === 'folder') return '文件夹'
  const ext = item.name.split('.').pop().toUpperCase()
  return ext + ' 文件'
}

const formatDate = (date) => {
  if (!date) return '-'
  const d = new Date(date)
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString()
}

const formatSize = (bytes) => {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
</script>

<style scoped>
.file-list {
  width: 100%;
  height: 100%;
  overflow: auto;
}

.list-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.list-table thead {
  position: sticky;
  top: 0;
  background: #f8f9fa;
  z-index: 1;
}

.list-table th {
  padding: 8px 12px;
  text-align: left;
  font-weight: 500;
  color: #495057;
  border-bottom: 2px solid #dee2e6;
  user-select: none;
}

.list-item {
  cursor: pointer;
  transition: background 0.2s;
}

.list-item:hover {
  background: #f8f9fa;
}

.list-item.selected {
  background: #e3f2fd;
}

.list-item.selected:hover {
  background: #bbdefb;
}

.list-item td {
  padding: 8px 12px;
  border-bottom: 1px solid #e9ecef;
}

.name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.name-cell .icon {
  font-size: 16px;
  flex-shrink: 0;
}

.list-item.folder .name-cell .icon {
  color: #ffc107;
}

.col-name {
  min-width: 300px;
}

.col-date {
  width: 180px;
  color: #6c757d;
}

.col-type {
  width: 120px;
  color: #6c757d;
}

.col-size {
  width: 100px;
  text-align: right;
  color: #6c757d;
}
</style>