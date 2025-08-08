<template>
  <div class="execution-progress" v-if="currentCommand">
    <div class="progress-header">
      <h3>命令执行进度</h3>
      <el-button size="small" type="danger" @click="cancelExecution">
        <el-icon><Close /></el-icon>
        取消执行
      </el-button>
    </div>
    
    <div class="progress-content">
      <div class="command-info">
        <el-icon class="command-icon"><Terminal /></el-icon>
        <div class="command-details">
          <div class="command-text">{{ currentCommand.command }}</div>
          <div class="command-time">开始时间：{{ formatTime(currentCommand.startTime) }}</div>
        </div>
      </div>

      <div class="progress-bar-container">
        <el-progress
          :percentage="progress"
          :status="progressStatus"
          :stroke-width="10"
        />
        <div class="progress-text">
          <span v-if="currentCommand.status === 'running'">执行中...</span>
          <span v-else-if="currentCommand.status === 'completed'" class="success">执行完成</span>
          <span v-else-if="currentCommand.status === 'failed'" class="error">执行失败</span>
          <span v-else-if="currentCommand.status === 'cancelled'" class="warning">已取消</span>
        </div>
      </div>

      <div class="execution-steps" v-if="currentCommand.steps?.length > 0">
        <h4>执行步骤：</h4>
        <el-timeline>
          <el-timeline-item
            v-for="(step, index) in currentCommand.steps"
            :key="index"
            :icon="getStepIcon(step.status)"
            :color="getStepColor(step.status)"
            :timestamp="step.timestamp"
          >
            <div class="step-content">
              <div class="step-name">{{ step.name }}</div>
              <div class="step-output" v-if="step.output">
                <code>{{ step.output }}</code>
              </div>
            </div>
          </el-timeline-item>
        </el-timeline>
      </div>

      <div class="execution-logs" v-if="recentLogs.length > 0">
        <h4>实时日志：</h4>
        <div class="log-container" ref="logContainer">
          <div v-for="log in recentLogs" :key="log.id" class="log-line">
            <span class="log-time">{{ formatLogTime(log.timestamp) }}</span>
            <span class="log-content" :class="`log-${log.type}`">{{ log.data }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useTerminalStore } from '../store/terminal'
import { ElMessage } from 'element-plus'

const terminalStore = useTerminalStore()
const logContainer = ref(null)

const currentCommand = computed(() => terminalStore.currentCommand)
const recentLogs = computed(() => {
  // 只显示当前命令执行期间的日志
  if (!currentCommand.value) return []
  return terminalStore.outputLogs.filter(log => 
    new Date(log.timestamp) >= new Date(currentCommand.value.startTime)
  ).slice(-20) // 只显示最近20条
})

const progress = computed(() => {
  if (!currentCommand.value) return 0
  if (currentCommand.value.status === 'completed') return 100
  if (currentCommand.value.status === 'failed') return 100
  return currentCommand.value.progress || 0
})

const progressStatus = computed(() => {
  if (!currentCommand.value) return ''
  if (currentCommand.value.status === 'completed') return 'success'
  if (currentCommand.value.status === 'failed') return 'exception'
  return ''
})

// 监听日志变化，自动滚动
watch(recentLogs, () => {
  nextTick(() => {
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight
    }
  })
})

const getStepIcon = (status) => {
  switch (status) {
    case 'completed':
      return 'Check'
    case 'running':
      return 'Loading'
    case 'failed':
      return 'Close'
    default:
      return 'Timer'
  }
}

const getStepColor = (status) => {
  switch (status) {
    case 'completed':
      return '#67c23a'
    case 'running':
      return '#409eff'
    case 'failed':
      return '#f56c6c'
    default:
      return '#909399'
  }
}

const formatTime = (timestamp) => {
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN')
}

const formatLogTime = (timestamp) => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', { 
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    millisecond: '3-digit'
  })
}

const cancelExecution = () => {
  ElMessage.warning('正在取消执行...')
  // 发送取消命令（Ctrl+C）
  terminalStore.setCurrentCommand({
    ...currentCommand.value,
    status: 'cancelled'
  })
}
</script>

<style scoped>
.execution-progress {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 480px;
  max-height: 600px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  z-index: 2000;
}

.progress-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #e4e7ed;
}

.progress-header h3 {
  margin: 0;
  font-size: 16px;
  color: #303133;
}

.progress-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.command-info {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 20px;
}

.command-icon {
  font-size: 24px;
  color: #409eff;
  flex-shrink: 0;
}

.command-details {
  flex: 1;
}

.command-text {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 14px;
  color: #303133;
  margin-bottom: 4px;
}

.command-time {
  font-size: 12px;
  color: #909399;
}

.progress-bar-container {
  margin-bottom: 20px;
}

.progress-text {
  margin-top: 8px;
  text-align: center;
  font-size: 14px;
}

.progress-text .success {
  color: #67c23a;
}

.progress-text .error {
  color: #f56c6c;
}

.progress-text .warning {
  color: #e6a23c;
}

.execution-steps h4,
.execution-logs h4 {
  font-size: 14px;
  color: #606266;
  margin-bottom: 12px;
}

.step-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.step-name {
  font-size: 14px;
  color: #303133;
}

.step-output {
  margin-top: 4px;
}

.step-output code {
  display: block;
  padding: 8px;
  background-color: #f5f7fa;
  border-radius: 4px;
  font-size: 12px;
  color: #606266;
  white-space: pre-wrap;
}

.log-container {
  max-height: 200px;
  overflow-y: auto;
  background-color: #1e1e1e;
  border-radius: 4px;
  padding: 12px;
}

.log-line {
  display: flex;
  gap: 8px;
  margin-bottom: 4px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 12px;
}

.log-time {
  color: #6b6b6b;
  flex-shrink: 0;
}

.log-content {
  flex: 1;
  word-wrap: break-word;
  color: #d4d4d4;
}

.log-output {
  color: #d4d4d4;
}

.log-error {
  color: #f48771;
}

.log-system {
  color: #4ec9b0;
}

/* 滚动条样式 */
.progress-content::-webkit-scrollbar,
.log-container::-webkit-scrollbar {
  width: 6px;
}

.progress-content::-webkit-scrollbar-track {
  background: #f5f7fa;
}

.log-container::-webkit-scrollbar-track {
  background: #1e1e1e;
}

.progress-content::-webkit-scrollbar-thumb {
  background: #dcdfe6;
  border-radius: 3px;
}

.log-container::-webkit-scrollbar-thumb {
  background: #464647;
  border-radius: 3px;
}
</style>