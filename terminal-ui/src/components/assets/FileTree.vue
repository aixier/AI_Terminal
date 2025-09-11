<template>
  <div class="file-tree">
    <div class="tree-content">
      <TreeNode
        v-for="node in treeData"
        :key="node.id"
        :node="node"
        :level="0"
        :current-path="currentPath"
        @select="handleSelect"
        @drop="handleDrop"
        @contextmenu="handleContextMenu"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import TreeNode from './TreeNode.vue'

const props = defineProps({
  data: {
    type: Array,
    default: () => []
  },
  currentPath: {
    type: String,
    default: '/'
  }
})

const emit = defineEmits(['select', 'drop', 'contextmenu'])

const treeData = ref(props.data)

watch(() => props.data, (newData) => {
  treeData.value = newData
})

const handleSelect = (node) => {
  emit('select', node.path)
}

const handleDrop = (event, node) => {
  emit('drop', event, node)
}

const handleContextMenu = (event, node) => {
  emit('contextmenu', event, node)
}
</script>

<style scoped>
.file-tree {
  height: 100%;
  overflow: auto;
  padding: 8px 0;
}

.tree-content {
  min-width: max-content;
}
</style>