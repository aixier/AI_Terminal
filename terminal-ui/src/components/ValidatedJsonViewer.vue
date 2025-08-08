<template>
  <div class="validated-json-viewer">
    <!-- 验证状态栏 -->
    <div class="validation-bar" :class="validationClass">
      <div class="validation-status">
        <span class="status-icon">{{ statusIcon }}</span>
        <span class="status-text">{{ statusText }}</span>
        <button 
          v-if="hasIssues" 
          class="toggle-details-btn"
          @click="showDetails = !showDetails"
        >
          {{ showDetails ? '隐藏详情' : '查看详情' }}
        </button>
        <button 
          v-if="canAutoFix" 
          class="auto-fix-btn"
          @click="handleAutoFix"
        >
          🔧 自动修复
        </button>
      </div>
    </div>
    
    <!-- 验证详情面板 -->
    <div v-if="showDetails && hasIssues" class="validation-details">
      <!-- 错误列表 -->
      <div v-if="validation.errors.length > 0" class="issue-group errors">
        <div class="issue-header">❌ 错误 ({{ validation.errors.length }})</div>
        <div 
          v-for="(error, index) in validation.errors" 
          :key="`error-${index}`"
          class="issue-item"
        >
          <span class="issue-field">{{ error.field }}</span>
          <span class="issue-message">{{ error.message }}</span>
        </div>
      </div>
      
      <!-- 警告列表 -->
      <div v-if="validation.warnings.length > 0" class="issue-group warnings">
        <div class="issue-header">⚠️ 警告 ({{ validation.warnings.length }})</div>
        <div 
          v-for="(warning, index) in validation.warnings" 
          :key="`warning-${index}`"
          class="issue-item"
        >
          <span class="issue-field">{{ warning.field }}</span>
          <span class="issue-message">{{ warning.message }}</span>
        </div>
      </div>
      
      <!-- 建议列表 -->
      <div v-if="validation.suggestions.length > 0" class="issue-group suggestions">
        <div class="issue-header">💡 建议 ({{ validation.suggestions.length }})</div>
        <div 
          v-for="(suggestion, index) in validation.suggestions" 
          :key="`suggestion-${index}`"
          class="issue-item"
        >
          <span class="issue-field">{{ suggestion.field }}</span>
          <span class="issue-message">{{ suggestion.message }}</span>
        </div>
      </div>
    </div>
    
    <!-- JSON内容展示 -->
    <div class="json-content">
      <SimpleJsonViewer 
        :data="displayData" 
        :highlight-errors="highlightFields"
      />
    </div>
    
    <!-- 操作按钮栏 -->
    <div class="action-bar">
      <button class="action-btn" @click="copyJson" title="复制JSON">
        📋 复制
      </button>
      <button class="action-btn" @click="downloadJson" title="下载JSON">
        💾 下载
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import SimpleJsonViewer from './SimpleJsonViewer.vue'
import { validateJsonFormat, formatValidationMessage, autoFixJsonFormat } from '../utils/jsonValidator'

const props = defineProps({
  data: {
    type: Object,
    required: true
  },
  autoValidate: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['fixed', 'preview'])

// 状态
const validation = ref({ valid: true, errors: [], warnings: [], suggestions: [] })
const showDetails = ref(false)
const displayData = ref(props.data)
const highlightFields = ref([])

// 计算属性
const hasIssues = computed(() => {
  return validation.value.errors.length > 0 || 
         validation.value.warnings.length > 0 || 
         validation.value.suggestions.length > 0
})

const canAutoFix = computed(() => {
  return validation.value.errors.length > 0 || validation.value.warnings.length > 0
})

const validationClass = computed(() => {
  if (validation.value.errors.length > 0) return 'error'
  if (validation.value.warnings.length > 0) return 'warning'
  if (validation.value.suggestions.length > 0) return 'suggestion'
  return 'valid'
})

const statusIcon = computed(() => {
  if (validation.value.errors.length > 0) return '❌'
  if (validation.value.warnings.length > 0) return '⚠️'
  if (validation.value.suggestions.length > 0) return '💡'
  return '✅'
})

const statusText = computed(() => {
  if (validation.value.errors.length > 0) {
    return `${validation.value.errors.length} 个错误需要修复`
  }
  if (validation.value.warnings.length > 0) {
    return `${validation.value.warnings.length} 个警告`
  }
  if (validation.value.suggestions.length > 0) {
    return `${validation.value.suggestions.length} 个优化建议`
  }
  return '格式符合API要求'
})

// 方法
const validateData = () => {
  if (!props.autoValidate) return
  
  validation.value = validateJsonFormat(displayData.value)
  
  // 高亮有问题的字段
  highlightFields.value = [
    ...validation.value.errors.map(e => e.field),
    ...validation.value.warnings.map(w => w.field)
  ]
  
  // 如果有错误，自动展开详情
  if (validation.value.errors.length > 0) {
    showDetails.value = true
  }
}

const handleAutoFix = () => {
  try {
    const fixed = autoFixJsonFormat(displayData.value)
    displayData.value = fixed
    emit('fixed', fixed)
    
    // 重新验证
    validateData()
    
    ElMessage.success('已自动修复格式问题')
  } catch (error) {
    console.error('Auto fix error:', error)
    ElMessage.error('自动修复失败: ' + error.message)
  }
}

const copyJson = () => {
  const jsonStr = JSON.stringify(displayData.value, null, 2)
  
  // 检查是否支持 clipboard API
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(jsonStr).then(() => {
      ElMessage.success('JSON已复制到剪贴板')
    }).catch(err => {
      // 如果 clipboard API 失败，使用降级方案
      fallbackCopy(jsonStr)
    })
  } else {
    // 使用降级方案
    fallbackCopy(jsonStr)
  }
}

// 降级的复制方法
const fallbackCopy = (text) => {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.left = '-999999px'
  textarea.style.top = '-999999px'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()
  
  try {
    const successful = document.execCommand('copy')
    if (successful) {
      ElMessage.success('JSON已复制到剪贴板')
    } else {
      ElMessage.error('复制失败')
    }
  } catch (err) {
    ElMessage.error('复制失败: ' + err.message)
  } finally {
    document.body.removeChild(textarea)
  }
}

const downloadJson = () => {
  try {
    const jsonStr = JSON.stringify(displayData.value, null, 2)
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${displayData.value.title || 'data'}.json`
    a.style.display = 'none'
    document.body.appendChild(a)
    
    // 触发下载
    a.click()
    
    // 清理
    setTimeout(() => {
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }, 100)
    
    ElMessage.success('JSON文件已下载')
  } catch (error) {
    console.error('Download error:', error)
    ElMessage.error('下载失败: ' + error.message)
    
    // 降级方案：使用 data URI
    try {
      const jsonStr = JSON.stringify(displayData.value, null, 2)
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(jsonStr)
      const a = document.createElement('a')
      a.href = dataUri
      a.download = `${displayData.value.title || 'data'}.json`
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      ElMessage.success('JSON文件已下载（使用备用方法）')
    } catch (fallbackError) {
      ElMessage.error('下载失败，请尝试复制内容')
    }
  }
}

const previewAsCard = () => {
  emit('preview', displayData.value)
}

// 监听数据变化
watch(() => props.data, (newData) => {
  displayData.value = newData
  validateData()
}, { deep: true })

// 生命周期
onMounted(() => {
  validateData()
})
</script>

<style scoped>
.validated-json-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #1e1e1e;
  border-radius: 8px;
  overflow: hidden;
}

/* 验证状态栏 */
.validation-bar {
  padding: 12px 16px;
  border-bottom: 1px solid #2d2d2d;
  transition: all 0.3s;
}

.validation-bar.valid {
  background: linear-gradient(90deg, #1e3a1e 0%, #1e1e1e 100%);
  border-left: 3px solid #4caf50;
}

.validation-bar.suggestion {
  background: linear-gradient(90deg, #1e2a3a 0%, #1e1e1e 100%);
  border-left: 3px solid #2196f3;
}

.validation-bar.warning {
  background: linear-gradient(90deg, #3a2a1e 0%, #1e1e1e 100%);
  border-left: 3px solid #ff9800;
}

.validation-bar.error {
  background: linear-gradient(90deg, #3a1e1e 0%, #1e1e1e 100%);
  border-left: 3px solid #f44336;
}

.validation-status {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-icon {
  font-size: 18px;
}

.status-text {
  flex: 1;
  color: #e0e0e0;
  font-size: 14px;
  font-weight: 500;
}

.toggle-details-btn,
.auto-fix-btn {
  padding: 4px 12px;
  background: #2a2a2a;
  border: 1px solid #444;
  color: #e0e0e0;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.toggle-details-btn:hover,
.auto-fix-btn:hover {
  background: #333;
  border-color: #4a9eff;
}

.auto-fix-btn {
  background: #2a4a2a;
  border-color: #4caf50;
}

.auto-fix-btn:hover {
  background: #3a5a3a;
}

/* 验证详情面板 */
.validation-details {
  max-height: 300px;
  overflow-y: auto;
  background: #252525;
  border-bottom: 1px solid #2d2d2d;
  padding: 12px;
}

.issue-group {
  margin-bottom: 16px;
}

.issue-group:last-child {
  margin-bottom: 0;
}

.issue-header {
  font-weight: 600;
  margin-bottom: 8px;
  color: #e0e0e0;
  font-size: 13px;
}

.issue-item {
  display: flex;
  gap: 12px;
  padding: 6px 8px;
  background: #1a1a1a;
  border-radius: 4px;
  margin-bottom: 4px;
  font-size: 12px;
}

.issue-field {
  color: #4a9eff;
  font-family: 'Consolas', 'Monaco', monospace;
  min-width: 120px;
}

.issue-message {
  color: #999;
  flex: 1;
}

.errors .issue-item {
  border-left: 2px solid #f44336;
}

.warnings .issue-item {
  border-left: 2px solid #ff9800;
}

.suggestions .issue-item {
  border-left: 2px solid #2196f3;
}

/* JSON内容展示 */
.json-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: #1a1a1a;
}

/* 操作按钮栏 */
.action-bar {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  background: #252525;
  border-top: 1px solid #2d2d2d;
}

.action-btn {
  padding: 6px 12px;
  background: #2a2a2a;
  border: 1px solid #444;
  color: #e0e0e0;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;
}

.action-btn:hover {
  background: #333;
  border-color: #4a9eff;
  transform: translateY(-1px);
}

.preview-btn {
  margin-left: auto;
  background: #2a3a4a;
  border-color: #4a9eff;
}

.preview-btn:hover {
  background: #3a4a5a;
}

/* 滚动条样式 */
.validation-details::-webkit-scrollbar,
.json-content::-webkit-scrollbar {
  width: 8px;
}

.validation-details::-webkit-scrollbar-track,
.json-content::-webkit-scrollbar-track {
  background: #1a1a1a;
}

.validation-details::-webkit-scrollbar-thumb,
.json-content::-webkit-scrollbar-thumb {
  background: #444;
  border-radius: 4px;
}

.validation-details::-webkit-scrollbar-thumb:hover,
.json-content::-webkit-scrollbar-thumb:hover {
  background: #555;
}
</style>