<template>
  <div class="history-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>命令历史记录</span>
          <el-button type="danger" size="small" @click="clearHistory">清除历史</el-button>
        </div>
      </template>
      
      <el-table :data="commandHistory" stripe style="width: 100%">
        <el-table-column prop="timestamp" label="时间" width="180">
          <template #default="scope">
            {{ formatTime(scope.row.timestamp) }}
          </template>
        </el-table-column>
        <el-table-column prop="command" label="命令" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.status === 'success' ? 'success' : 'danger'">
              {{ scope.row.status === 'success' ? '成功' : '失败' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="scope">
            <el-button size="small" @click="rerunCommand(scope.row.command)">
              重新执行
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
// History management using localStorage directly

const router = useRouter()
const commandHistory = ref([])

// Helper functions for history management
const getHistoryFromStorage = () => {
  try {
    const history = localStorage.getItem('commandHistory')
    return history ? JSON.parse(history) : []
  } catch (e) {
    console.error('Failed to load history:', e)
    return []
  }
}

const saveHistoryToStorage = (history) => {
  try {
    localStorage.setItem('commandHistory', JSON.stringify(history))
  } catch (e) {
    console.error('Failed to save history:', e)
  }
}

const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleString('zh-CN')
}

const loadHistory = () => {
  commandHistory.value = getHistoryFromStorage()
}

const clearHistory = async () => {
  try {
    await ElMessageBox.confirm('确定要清除所有历史记录吗？', '警告', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    commandHistory.value = []
    saveHistoryToStorage([])
    ElMessage.success('历史记录已清除')
  } catch {
    // 用户取消
  }
}

const rerunCommand = (command) => {
  // Store the command to be rerun in sessionStorage
  sessionStorage.setItem('pendingCommand', JSON.stringify(command))
  router.push('/card-generator')
}

onMounted(() => {
  loadHistory()
})
</script>

<style scoped>
.history-page {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>