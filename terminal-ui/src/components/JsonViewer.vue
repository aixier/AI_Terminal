<template>
  <div class="json-viewer-container">
    <div class="json-toolbar">
      <button 
        class="toolbar-btn"
        @click="toggleExpandAll"
        :title="allExpanded ? '折叠全部' : '展开全部'"
      >
        {{ allExpanded ? '📄' : '📋' }}
      </button>
      <button 
        class="toolbar-btn"
        @click="copyToClipboard"
        title="复制JSON"
      >
        📋
      </button>
      <span class="json-info">
        {{ `${objectSize} 项` }}
      </span>
    </div>
    <div class="json-content-wrapper">
      <JsonViewer 
        :value="parsedData"
        theme="dark"
        class="custom-json-viewer"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { JsonViewer } from 'vue3-json-viewer'
import 'vue3-json-viewer/dist/vue3-json-viewer.css'

const props = defineProps({
  data: {
    type: [Object, String, Array],
    required: true
  },
  maxDepth: {
    type: Number,
    default: 3
  }
})

const allExpanded = ref(false)

// Parse JSON data
const parsedData = computed(() => {
  if (!props.data) return {}
  
  // If data is already an object/array, return it
  if (typeof props.data === 'object') {
    return props.data
  }
  
  // If data is a string, try to parse it
  if (typeof props.data === 'string') {
    try {
      return JSON.parse(props.data)
    } catch (error) {
      console.warn('Failed to parse JSON string:', error)
      return { rawData: props.data }
    }
  }
  
  return props.data
})

// Calculate object size
const objectSize = computed(() => {
  const countItems = (obj) => {
    if (Array.isArray(obj)) {
      return obj.length
    }
    if (typeof obj === 'object' && obj !== null) {
      return Object.keys(obj).length
    }
    return 1
  }
  
  return countItems(parsedData.value)
})

// Toggle expand/collapse all (placeholder for now)
const toggleExpandAll = () => {
  allExpanded.value = !allExpanded.value
  console.log('Toggle expand:', allExpanded.value)
}

// Copy to clipboard
const copyToClipboard = async () => {
  try {
    const jsonString = JSON.stringify(parsedData.value, null, 2)
    await navigator.clipboard.writeText(jsonString)
    console.log('JSON copied to clipboard')
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
  }
}
</script>

<style scoped>
.json-viewer-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #1a1a1a;
  color: #e0e0e0;
}

.json-toolbar {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: #2a2a2a;
  border-bottom: 1px solid #333;
  gap: 8px;
  flex-shrink: 0;
}

.toolbar-btn {
  background: #3a3a3a;
  border: 1px solid #444;
  color: #e0e0e0;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.toolbar-btn:hover {
  background: #4a4a4a;
  border-color: #4a9eff;
}

.json-info {
  margin-left: auto;
  font-size: 12px;
  color: #999;
}

.json-content-wrapper {
  flex: 1;
  overflow: auto;
  padding: 12px;
}

.custom-json-viewer {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace !important;
  font-size: 13px !important;
  line-height: 1.5 !important;
}

/* 自定义JSON查看器样式 */
:deep(.jv-container) {
  background: transparent !important;
  color: #e0e0e0 !important;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace !important;
  font-size: 13px !important;
}

:deep(.jv-code) {
  padding: 0 !important;
  background: transparent !important;
}

:deep(.jv-key) {
  color: #63b3ed !important;
  font-weight: 500 !important;
}

:deep(.jv-string) {
  color: #68d391 !important;
}

:deep(.jv-number) {
  color: #fbb6ce !important;
}

:deep(.jv-boolean) {
  color: #fc8181 !important;
}

:deep(.jv-null) {
  color: #a0aec0 !important;
}

:deep(.jv-item) {
  border-left: 1px solid #333 !important;
}

:deep(.jv-item:hover) {
  background: rgba(255, 255, 255, 0.05) !important;
}

:deep(.jv-button) {
  color: #cbd5e0 !important;
  background: transparent !important;
}

:deep(.jv-button:hover) {
  color: #4a9eff !important;
}

/* 滚动条样式 */
.json-content-wrapper::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.json-content-wrapper::-webkit-scrollbar-track {
  background: #2d3748;
  border-radius: 4px;
}

.json-content-wrapper::-webkit-scrollbar-thumb {
  background: #4a5568;
  border-radius: 4px;
  transition: background 0.2s;
}

.json-content-wrapper::-webkit-scrollbar-thumb:hover {
  background: #718096;
}

.json-content-wrapper::-webkit-scrollbar-corner {
  background: #2d3748;
}

/* Firefox 滚动条样式 */
.json-content-wrapper {
  scrollbar-width: thin;
  scrollbar-color: #4a5568 #2d3748;
}
</style>