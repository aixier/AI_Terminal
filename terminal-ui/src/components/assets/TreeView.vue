<template>
  <div class="tree-view">
    <div 
      class="tree-node" 
      :class="{ 
        expanded: isExpanded, 
        selected: isSelected,
        'has-children': hasChildren
      }"
      :style="{ paddingLeft: level * 20 + 'px' }"
    >
      <span 
        class="tree-expand" 
        @click="toggleExpand"
        v-if="hasChildren"
      >
        {{ isExpanded ? '▼' : '▶' }}
      </span>
      <span v-else class="tree-expand-placeholder"></span>
      
      <div 
        class="tree-content"
        @click="handleClick"
        @contextmenu.prevent="handleContextMenu"
        @drop="handleDrop"
        @dragover.prevent="handleDragOver"
        @dragleave="handleDragLeave"
        :class="{ 'drag-over': isDragOver }"
      >
        <span class="tree-icon" :style="{ color: folder.color || '#4A90E2' }">
          📁
        </span>
        <span class="tree-label">{{ folder.name }}</span>
        <span class="tree-count" v-if="folder.assetCount > 0">
          ({{ folder.assetCount }})
        </span>
      </div>
    </div>
    
    <div v-if="isExpanded && hasChildren" class="tree-children">
      <TreeView
        v-for="child in folder.children"
        :key="child.id"
        :folder="child"
        :level="level + 1"
        :current-folder="currentFolder"
        @navigate="$emit('navigate', $event)"
        @context-menu="$emit('context-menu', $event)"
        @drop-files="$emit('drop-files', $event)"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  folder: {
    type: Object,
    required: true
  },
  level: {
    type: Number,
    default: 0
  },
  currentFolder: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['navigate', 'context-menu', 'drop-files'])

const isExpanded = ref(false)
const isDragOver = ref(false)

const hasChildren = computed(() => {
  return props.folder.children && props.folder.children.length > 0
})

const isSelected = computed(() => {
  return props.folder.id === props.currentFolder
})

const toggleExpand = () => {
  isExpanded.value = !isExpanded.value
}

const handleClick = () => {
  emit('navigate', props.folder.id)
}

const handleContextMenu = (event) => {
  emit('context-menu', {
    event,
    item: props.folder,
    type: 'folder'
  })
}

const handleDrop = (event) => {
  event.preventDefault()
  isDragOver.value = false
  
  const files = event.dataTransfer.files
  const items = event.dataTransfer.getData('items')
  
  if (files && files.length > 0) {
    // 处理外部文件拖入
    emit('drop-files', {
      files: Array.from(files),
      targetFolder: props.folder.id
    })
  } else if (items) {
    // 处理内部项目移动
    try {
      const itemsData = JSON.parse(items)
      emit('drop-files', {
        items: itemsData,
        targetFolder: props.folder.id
      })
    } catch (error) {
      console.error('Failed to parse drop data:', error)
    }
  }
}

const handleDragOver = (event) => {
  event.preventDefault()
  isDragOver.value = true
  event.dataTransfer.dropEffect = 'move'
}

const handleDragLeave = () => {
  isDragOver.value = false
}
</script>

<style scoped>
.tree-view {
  user-select: none;
}

.tree-node {
  display: flex;
  align-items: center;
  height: 28px;
  position: relative;
}

.tree-expand {
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #666;
  font-size: 10px;
}

.tree-expand:hover {
  color: #333;
}

.tree-expand-placeholder {
  width: 16px;
  display: inline-block;
}

.tree-content {
  flex: 1;
  display: flex;
  align-items: center;
  padding: 2px 6px;
  border-radius: 3px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.tree-content:hover {
  background-color: #e8f4fd;
}

.tree-node.selected .tree-content {
  background-color: #cce8ff;
}

.tree-content.drag-over {
  background-color: #b3d9ff;
  outline: 2px solid #0078d4;
  outline-offset: -2px;
}

.tree-icon {
  font-size: 16px;
  margin-right: 4px;
}

.tree-label {
  flex: 1;
  font-size: 13px;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tree-count {
  font-size: 11px;
  color: #999;
  margin-left: 4px;
}

.tree-children {
  position: relative;
}

/* 树形线条 */
.tree-children::before {
  content: '';
  position: absolute;
  left: 8px;
  top: 0;
  bottom: 0;
  width: 1px;
  background-color: #e0e0e0;
}
</style>