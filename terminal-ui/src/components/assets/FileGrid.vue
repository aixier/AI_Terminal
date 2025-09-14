<template>
  <div class="file-grid">
    <div
      v-for="item in items"
      :key="item.id"
      class="grid-item"
      :class="{
        selected: isSelected(item),
        folder: item.type === 'folder',
        workspace: item.source === 'workspace' || item.path?.startsWith('作品集'),
        readonly: item.readonly
      }"
      @click="handleClick($event, item)"
      @dblclick="handleDoubleClick(item)"
      @contextmenu.prevent="handleContextMenu($event, item)"
      draggable="true"
      @dragstart="handleDragStart($event, item)"
    >
      <div class="item-icon">
        <Icon v-if="item.virtual && item.icon === 'collection'" name="folder-star" class="collection-icon" />
        <Icon v-else-if="item.type === 'folder'" :name="item.icon || 'folder'" />
        <img v-else-if="item.thumbnail" :src="item.thumbnail" :alt="item.name" />
        <Icon v-else :name="getFileIcon(item)" />
      </div>
      <div class="item-name" :title="item.name">
        {{ item.name }}
      </div>
      <div v-if="item.size" class="item-size">
        {{ formatSize(item.size) }}
      </div>
    </div>
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
    // 图片
    jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', 
    svg: 'image', webp: 'image', ico: 'image', bmp: 'image',
    // 视频
    mp4: 'video', avi: 'video', mov: 'video', wmv: 'video',
    flv: 'video', mkv: 'video', webm: 'video',
    // 音频
    mp3: 'audio', wav: 'audio', flac: 'audio', aac: 'audio',
    ogg: 'audio', wma: 'audio', m4a: 'audio',
    // 文档
    pdf: 'file-pdf', doc: 'file-word', docx: 'file-word',
    xls: 'file-excel', xlsx: 'file-excel', ppt: 'file-ppt',
    pptx: 'file-ppt', txt: 'file-text', md: 'file-text',
    // 代码
    js: 'file-code', ts: 'file-code', jsx: 'file-code',
    tsx: 'file-code', vue: 'file-code', html: 'file-code',
    css: 'file-code', scss: 'file-code', json: 'file-code',
    py: 'file-code', java: 'file-code', cpp: 'file-code',
    // 压缩包
    zip: 'file-zip', rar: 'file-zip', '7z': 'file-zip',
    tar: 'file-zip', gz: 'file-zip'
  }
  return iconMap[ext] || 'file'
}

const formatSize = (bytes) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
</script>

<style scoped>
.file-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 16px;
  padding: 16px;
}

.grid-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
}

.grid-item:hover {
  background: #f8f9fa;
}

.grid-item.selected {
  background: #e3f2fd;
}

.grid-item.selected:hover {
  background: #bbdefb;
}

.item-icon {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
  font-size: 48px;
}

.item-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 4px;
}

.grid-item.folder .item-icon {
  color: #ffc107;
}

/* 作品集样式 */
.grid-item.workspace {
  background: linear-gradient(135deg, #f5f7fa 0%, #e8f4fd 100%);
  border: 1px solid #d1e9ff;
}

.grid-item.workspace:hover {
  background: linear-gradient(135deg, #e8f4fd 0%, #d1e9ff 100%);
}

.grid-item.workspace .item-icon {
  color: #1890ff;
}

.grid-item.workspace .item-name {
  color: #1890ff;
  font-weight: 500;
}

/* 只读项样式 */
.grid-item.readonly {
  opacity: 0.9;
}

.grid-item.readonly .item-name::after {
  content: ' 🔒';
  font-size: 10px;
}

/* 特殊的作品集图标 */
.collection-icon {
  color: #722ed1 !important;
  font-size: 48px;
}

.item-name {
  font-size: 13px;
  text-align: center;
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
  color: #212529;
}

.item-size {
  font-size: 11px;
  color: #6c757d;
  margin-top: 4px;
}
</style>