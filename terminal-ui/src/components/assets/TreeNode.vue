<template>
  <div class="tree-node">
    <div 
      class="node-content"
      :class="{ 
        selected: isSelected,
        expanded: expanded
      }"
      :style="{ paddingLeft: level * 20 + 8 + 'px' }"
      @click="handleClick"
      @contextmenu.prevent="handleContextMenu"
      @drop.prevent="handleDrop"
      @dragover.prevent="handleDragOver"
      @dragleave="handleDragLeave"
    >
      <span 
        class="expand-icon"
        @click.stop="toggleExpand"
        v-if="node.children && node.children.length > 0"
      >
        <Icon :name="expanded ? 'chevron-down' : 'chevron-right'" />
      </span>
      <span v-else class="expand-placeholder"></span>
      
      <span class="node-icon">
        <Icon :name="expanded ? 'folder-open' : 'folder'" />
      </span>
      
      <span class="node-label">{{ node.name }}</span>
      
      <span v-if="node.fileCount" class="file-count">{{ node.fileCount }}</span>
    </div>
    
    <div v-if="expanded && node.children" class="children">
      <TreeNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :level="level + 1"
        :current-path="currentPath"
        @select="emit('select', $event)"
        @drop="emit('drop', $event)"
        @contextmenu="emit('contextmenu', $event)"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import Icon from '../common/Icon.vue'

const props = defineProps({
  node: {
    type: Object,
    required: true
  },
  level: {
    type: Number,
    default: 0
  },
  currentPath: {
    type: String,
    default: '/'
  }
})

const emit = defineEmits(['select', 'drop', 'contextmenu'])

const expanded = ref(false)
const isDragOver = ref(false)

const isSelected = computed(() => {
  return props.currentPath === props.node.path
})

const handleClick = () => {
  emit('select', props.node)
}

const toggleExpand = () => {
  expanded.value = !expanded.value
}

const handleContextMenu = (event) => {
  emit('contextmenu', event, props.node)
}

const handleDrop = (event) => {
  isDragOver.value = false
  emit('drop', event, props.node)
}

const handleDragOver = (event) => {
  if (props.node.type === 'folder') {
    event.dataTransfer.dropEffect = 'copy'
    isDragOver.value = true
  }
}

const handleDragLeave = () => {
  isDragOver.value = false
}
</script>

<style scoped>
.tree-node {
  user-select: none;
}

.node-content {
  display: flex;
  align-items: center;
  height: 28px;
  cursor: pointer;
  border-radius: 3px;
  transition: background 0.2s;
}

.node-content:hover {
  background: rgba(0, 0, 0, 0.05);
}

.node-content.selected {
  background: #e3f2fd;
}

.node-content.drag-over {
  background: #bbdefb;
}

.expand-icon {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.expand-placeholder {
  width: 16px;
  flex-shrink: 0;
}

.node-icon {
  width: 20px;
  height: 20px;
  margin-right: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffc107;
  flex-shrink: 0;
}

.node-label {
  flex: 1;
  font-size: 14px;
  color: #212529;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-count {
  margin-left: 8px;
  padding: 2px 6px;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 10px;
  font-size: 11px;
  color: #6c757d;
}

.children {
  overflow: hidden;
}
</style>