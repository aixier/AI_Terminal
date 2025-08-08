<template>
  <div class="simple-json-viewer">
    <div class="json-toolbar">
      <button 
        class="toolbar-btn"
        @click="toggleFormat"
        :title="formatted ? '收缩为紧凑格式' : '展开为格式化'"
      >
        {{ formatted ? '📦' : '📋' }}
        <span class="btn-text">{{ formatted ? '收缩' : '展开' }}</span>
      </button>
      <button 
        class="toolbar-btn"
        @click="copyToClipboard"
        title="复制JSON"
      >
        📋
      </button>
      <span class="json-info">
        {{ getObjectInfo() }}
      </span>
    </div>
    <div class="json-content">
      <pre class="json-code"><code v-html="highlightedJson"></code></pre>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  data: {
    type: [Object, String, Array],
    required: true
  }
})

const formatted = ref(true)  // 默认展开格式化

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
      return { rawData: props.data, parseError: error.message }
    }
  }
  
  return props.data
})

// Format JSON string
const jsonString = computed(() => {
  try {
    return JSON.stringify(parsedData.value, null, formatted.value ? 2 : 0)
  } catch (error) {
    return JSON.stringify({ error: 'Failed to stringify data', data: String(props.data) }, null, 2)
  }
})

// Simple syntax highlighting
const highlightedJson = computed(() => {
  let json = jsonString.value
  
  // Escape HTML first
  json = json.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
  
  // Apply syntax highlighting
  json = json.replace(/"([^"]+)":\s*/g, '<span class="json-key">"$1"</span>: ') // Keys
  json = json.replace(/:\s*"([^"]*)"/g, ': <span class="json-string">"$1"</span>') // String values
  json = json.replace(/:\s*(-?\d+\.?\d*)/g, ': <span class="json-number">$1</span>') // Numbers
  json = json.replace(/:\s*(true|false)/g, ': <span class="json-boolean">$1</span>') // Booleans
  json = json.replace(/:\s*(null)/g, ': <span class="json-null">$1</span>') // Null
  json = json.replace(/([{}\[\],])/g, '<span class="json-punctuation">$1</span>') // Punctuation
  
  return json
})

// Get object information
const getObjectInfo = () => {
  const data = parsedData.value
  if (Array.isArray(data)) {
    return `数组 ${data.length} 项`
  } else if (typeof data === 'object' && data !== null) {
    const keys = Object.keys(data)
    return `对象 ${keys.length} 属性`
  } else {
    return typeof data
  }
}

// Toggle format
const toggleFormat = () => {
  formatted.value = !formatted.value
}

// Copy to clipboard
const copyToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(jsonString.value)
    console.log('JSON copied to clipboard')
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
  }
}
</script>

<style scoped>
.simple-json-viewer {
  height: 100%;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  background: #1a1a1a;
  color: #e0e0e0;
  overflow: hidden; /* 确保子元素的滚动条正常工作 */
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
  display: flex;
  align-items: center;
  gap: 4px;
}

.toolbar-btn:hover {
  background: #4a4a4a;
  border-color: #4a9eff;
}

.btn-text {
  font-size: 11px;
  color: #ccc;
}

.json-info {
  margin-left: auto;
  font-size: 12px;
  color: #999;
}

.json-content {
  flex: 1;
  min-height: 0; /* 允许flex子元素缩小 */
  overflow: auto; /* 允许滚动 */
  padding: 12px 12px 12px 8px; /* 左边留较少边距，实现靠左效果 */
}

.json-code {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  line-height: 1.5;
  margin: 0;
  padding: 0;
  color: #e0e0e0;
  white-space: pre;  /* 改为pre确保格式化 */
  word-break: normal; /* 不强制换行 */
  text-align: left;  /* 强制左对齐 */
  overflow-x: auto;  /* 水平滚动 */
}

/* JSON Syntax Highlighting */
.json-code :deep(.json-key) {
  color: #63b3ed;
  font-weight: 500;
}

.json-code :deep(.json-string) {
  color: #68d391;
}

.json-code :deep(.json-number) {
  color: #fbb6ce;
}

.json-code :deep(.json-boolean) {
  color: #fc8181;
}

.json-code :deep(.json-null) {
  color: #a0aec0;
}

.json-code :deep(.json-punctuation) {
  color: #cbd5e0;
}

/* 滚动条样式 */
.json-content::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

.json-content::-webkit-scrollbar-track {
  background: #2d3748;
  border-radius: 5px;
}

.json-content::-webkit-scrollbar-thumb {
  background: #4a5568;
  border-radius: 5px;
  transition: background 0.2s;
  min-height: 20px;
}

.json-content::-webkit-scrollbar-thumb:hover {
  background: #718096;
}

.json-content::-webkit-scrollbar-corner {
  background: #2d3748;
}

/* JSON代码区域也需要水平滚动条 */
.json-code::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.json-code::-webkit-scrollbar-track {
  background: #1a1a1a;
  border-radius: 4px;
}

.json-code::-webkit-scrollbar-thumb {
  background: #4a5568;
  border-radius: 4px;
}

.json-code::-webkit-scrollbar-thumb:hover {
  background: #718096;
}

/* Firefox 滚动条样式 */
.json-content {
  scrollbar-width: auto;
  scrollbar-color: #4a5568 #2d3748;
}

.json-code {
  scrollbar-width: thin;
  scrollbar-color: #4a5568 #1a1a1a;
}
</style>