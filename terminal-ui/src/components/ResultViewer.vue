<template>
  <div class="result-viewer">
    <div class="viewer-header">
      <h3>执行结果</h3>
      <div class="viewer-actions">
        <el-button size="small" @click="exportResult">
          <el-icon><Download /></el-icon>
          导出结果
        </el-button>
        <el-button size="small" @click="copyResult">
          <el-icon><CopyDocument /></el-icon>
          复制
        </el-button>
      </div>
    </div>

    <div class="viewer-content">
      <!-- 文件树展示 -->
      <div v-if="resultType === 'file-tree'" class="file-tree-result">
        <el-tree
          :data="fileTreeData"
          :props="treeProps"
          default-expand-all
          @node-click="handleNodeClick"
        >
          <template #default="{ node, data }">
            <span class="tree-node">
              <el-icon>
                <Folder v-if="data.type === 'directory'" />
                <Document v-else />
              </el-icon>
              <span class="node-label">{{ node.label }}</span>
              <span class="node-info" v-if="data.size">
                {{ formatFileSize(data.size) }}
              </span>
            </span>
          </template>
        </el-tree>
      </div>

      <!-- 表格数据展示 -->
      <div v-else-if="resultType === 'table'" class="table-result">
        <el-table :data="tableData" stripe border>
          <el-table-column
            v-for="column in tableColumns"
            :key="column.prop"
            :prop="column.prop"
            :label="column.label"
            :width="column.width"
          />
        </el-table>
      </div>

      <!-- 文本结果展示 -->
      <div v-else-if="resultType === 'text'" class="text-result">
        <pre>{{ textContent }}</pre>
      </div>

      <!-- 代码结果展示 -->
      <div v-else-if="resultType === 'code'" class="code-result">
        <div class="code-header">
          <span class="code-language">{{ codeLanguage }}</span>
          <el-button text @click="copyCode">
            <el-icon><CopyDocument /></el-icon>
          </el-button>
        </div>
        <pre><code :class="`language-${codeLanguage}`">{{ codeContent }}</code></pre>
      </div>

      <!-- 图片结果展示 -->
      <div v-else-if="resultType === 'image'" class="image-result">
        <el-image
          :src="imageUrl"
          :preview-src-list="[imageUrl]"
          fit="contain"
        />
      </div>

      <!-- JSON结果展示 -->
      <div v-else-if="resultType === 'json'" class="json-result">
        <el-tree
          :data="[jsonData]"
          :props="jsonTreeProps"
          default-expand-all
        >
          <template #default="{ node }">
            <span class="json-node">
              <span class="json-key">{{ node.label }}:</span>
              <span class="json-value" v-if="node.data.value !== undefined">
                {{ formatJsonValue(node.data.value) }}
              </span>
            </span>
          </template>
        </el-tree>
      </div>

      <!-- 统计信息 -->
      <div class="result-stats" v-if="stats">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="文件数量">
            {{ stats.fileCount || 0 }}
          </el-descriptions-item>
          <el-descriptions-item label="总大小">
            {{ formatFileSize(stats.totalSize || 0) }}
          </el-descriptions-item>
          <el-descriptions-item label="执行时间">
            {{ stats.executionTime || 'N/A' }}
          </el-descriptions-item>
          <el-descriptions-item label="返回码">
            <el-tag :type="stats.exitCode === 0 ? 'success' : 'danger'" size="small">
              {{ stats.exitCode }}
            </el-tag>
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </div>

    <!-- 文件预览对话框 -->
    <el-dialog
      v-model="previewDialogVisible"
      :title="previewFile?.name"
      width="80%"
    >
      <div class="file-preview">
        <pre v-if="previewContent">{{ previewContent }}</pre>
        <el-empty v-else description="无法预览此文件" />
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'

const props = defineProps({
  result: {
    type: Object,
    default: () => ({})
  }
})

const previewDialogVisible = ref(false)
const previewFile = ref(null)
const previewContent = ref('')

const resultType = computed(() => {
  // 根据结果内容判断类型
  if (props.result.fileTree) return 'file-tree'
  if (props.result.table) return 'table'
  if (props.result.code) return 'code'
  if (props.result.image) return 'image'
  if (props.result.json) return 'json'
  return 'text'
})

const fileTreeData = computed(() => props.result.fileTree || [])
const tableData = computed(() => props.result.table?.data || [])
const tableColumns = computed(() => props.result.table?.columns || [])
const textContent = computed(() => props.result.text || props.result.output || '')
const codeContent = computed(() => props.result.code?.content || '')
const codeLanguage = computed(() => props.result.code?.language || 'plaintext')
const imageUrl = computed(() => props.result.image?.url || '')
const jsonData = computed(() => props.result.json || {})
const stats = computed(() => props.result.stats || null)

const treeProps = {
  children: 'children',
  label: 'name'
}

const jsonTreeProps = {
  children: 'children',
  label: 'key'
}

const formatFileSize = (size) => {
  if (size < 1024) return size + ' B'
  if (size < 1024 * 1024) return (size / 1024).toFixed(2) + ' KB'
  if (size < 1024 * 1024 * 1024) return (size / 1024 / 1024).toFixed(2) + ' MB'
  return (size / 1024 / 1024 / 1024).toFixed(2) + ' GB'
}

const formatJsonValue = (value) => {
  if (typeof value === 'string') return `"${value}"`
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  return String(value)
}

const handleNodeClick = async (data) => {
  if (data.type === 'file') {
    previewFile.value = data
    // 这里应该请求文件内容
    previewContent.value = '文件内容预览...'
    previewDialogVisible.value = true
  }
}

const exportResult = () => {
  // 根据结果类型导出不同格式
  const exportData = {
    type: resultType.value,
    content: props.result,
    timestamp: new Date().toISOString()
  }
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: 'application/json'
  })
  
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `result-${Date.now()}.json`
  link.click()
  URL.revokeObjectURL(url)
  
  ElMessage.success('结果已导出')
}

const copyResult = () => {
  let textToCopy = ''
  
  switch (resultType.value) {
    case 'text':
      textToCopy = textContent.value
      break
    case 'code':
      textToCopy = codeContent.value
      break
    case 'json':
      textToCopy = JSON.stringify(jsonData.value, null, 2)
      break
    default:
      textToCopy = JSON.stringify(props.result, null, 2)
  }
  
  navigator.clipboard.writeText(textToCopy).then(() => {
    ElMessage.success('已复制到剪贴板')
  }).catch(() => {
    ElMessage.error('复制失败')
  })
}

const copyCode = () => {
  navigator.clipboard.writeText(codeContent.value).then(() => {
    ElMessage.success('代码已复制')
  }).catch(() => {
    ElMessage.error('复制失败')
  })
}
</script>

<style scoped>
.result-viewer {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #fff;
  border-radius: 8px;
  overflow: hidden;
}

.viewer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #e4e7ed;
}

.viewer-header h3 {
  margin: 0;
  font-size: 16px;
  color: #303133;
}

.viewer-actions {
  display: flex;
  gap: 10px;
}

.viewer-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

/* 文件树样式 */
.file-tree-result {
  background-color: #f5f7fa;
  border-radius: 4px;
  padding: 16px;
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.node-label {
  flex: 1;
}

.node-info {
  font-size: 12px;
  color: #909399;
}

/* 表格样式 */
.table-result {
  overflow-x: auto;
}

/* 文本样式 */
.text-result pre {
  margin: 0;
  padding: 16px;
  background-color: #f5f7fa;
  border-radius: 4px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.5;
  overflow-x: auto;
}

/* 代码样式 */
.code-result {
  background-color: #1e1e1e;
  border-radius: 4px;
  overflow: hidden;
}

.code-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background-color: #2d2d2d;
  border-bottom: 1px solid #3e3e3e;
}

.code-language {
  font-size: 12px;
  color: #cccccc;
}

.code-result pre {
  margin: 0;
  padding: 16px;
  overflow-x: auto;
}

.code-result code {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.5;
  color: #d4d4d4;
}

/* 图片样式 */
.image-result {
  text-align: center;
  padding: 20px;
}

/* JSON样式 */
.json-result {
  background-color: #f5f7fa;
  border-radius: 4px;
  padding: 16px;
}

.json-node {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 14px;
}

.json-key {
  color: #409eff;
}

.json-value {
  color: #67c23a;
  margin-left: 8px;
}

/* 统计信息 */
.result-stats {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #e4e7ed;
}

/* 文件预览 */
.file-preview {
  max-height: 60vh;
  overflow-y: auto;
}

.file-preview pre {
  margin: 0;
  padding: 16px;
  background-color: #f5f7fa;
  border-radius: 4px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.5;
}

/* 滚动条 */
.viewer-content::-webkit-scrollbar {
  width: 6px;
}

.viewer-content::-webkit-scrollbar-track {
  background: #f5f7fa;
}

.viewer-content::-webkit-scrollbar-thumb {
  background: #dcdfe6;
  border-radius: 3px;
}
</style>