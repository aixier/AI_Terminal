<template>
  <div>
    <!-- FAB按钮 (可选) -->
    <div v-if="showFab && !modelValue" class="terminal-fab" @click="openDrawer">
      <el-icon><Monitor /></el-icon>
    </div>
    
    <!-- 抽屉组件 -->
    <el-drawer
      v-model="drawerVisible"
      :title="drawerTitle"
      direction="btt"
      :size="drawerSize"
      :close-on-click-modal="false"
      :close-on-press-escape="true"
      :show-close="true"
      class="terminal-drawer"
      @close="handleClose"
    >
      <!-- 抽屉头部工具栏 -->
      <template #header>
        <div class="drawer-header">
          <div class="header-left">
            <h3>{{ drawerTitle }}</h3>
            <span v-if="isExecuting" class="status-badge executing">
              <el-icon class="is-loading"><Loading /></el-icon>
              执行中
            </span>
            <span v-else-if="isConnected" class="status-badge connected">
              <el-icon><CircleCheck /></el-icon>
              已连接
            </span>
            <span v-else class="status-badge disconnected">
              <el-icon><CircleClose /></el-icon>
              未连接
            </span>
          </div>
          <div class="header-right">
            <el-button size="small" @click="clearTerminal">清屏</el-button>
            <el-button size="small" @click="toggleSize">
              <el-icon><FullScreen /></el-icon>
            </el-button>
          </div>
        </div>
      </template>
      
      <!-- 终端内容区 -->
      <div class="drawer-body">
        <!-- 终端容器 -->
        <div class="terminal-container">
          <TerminalBest 
            ref="terminalRef"
            @connected="handleConnected"
            @disconnected="handleDisconnected"
            @error="handleError"
          />
        </div>
        
        <!-- 进度指示器 -->
        <div v-if="isExecuting" class="progress-indicator">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: `${progress}%` }"></div>
          </div>
          <p class="progress-text">{{ progressText }}</p>
        </div>
      </div>
      
      <!-- 命令输入区 (可选) -->
      <div v-if="showCommandInput" class="command-input-area">
        <el-input
          v-model="commandInput"
          placeholder="输入命令..."
          @keyup.enter="sendCommand"
        >
          <template #append>
            <el-button @click="sendCommand">发送</el-button>
          </template>
        </el-input>
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { Monitor, Loading, CircleCheck, CircleClose, FullScreen } from '@element-plus/icons-vue'
import TerminalBest from './TerminalBest.vue'
import terminalIntegration from '../services/terminalIntegration'

// Props
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: 'Terminal'
  },
  size: {
    type: String,
    default: '50%'
  },
  showFab: {
    type: Boolean,
    default: false
  },
  autoHide: {
    type: Boolean,
    default: false
  },
  showCommandInput: {
    type: Boolean,
    default: false
  }
})

// Emits
const emit = defineEmits(['update:modelValue', 'connected', 'disconnected', 'error'])

// 状态
const drawerVisible = ref(false)
const drawerTitle = ref(props.title)
const drawerSize = ref(props.size)
const terminalRef = ref(null)
const isConnected = ref(false)
const isExecuting = ref(false)
const progress = ref(0)
const progressText = ref('')
const commandInput = ref('')
const commandHistory = ref([])
const isFullSize = ref(false)

// 监听v-model变化
watch(() => props.modelValue, (newVal) => {
  drawerVisible.value = newVal
  if (newVal) {
    // 打开时确保终端已连接
    ensureConnected()
  }
})

// 监听抽屉可见性变化
watch(drawerVisible, (newVal) => {
  emit('update:modelValue', newVal)
})

// 打开抽屉
const openDrawer = () => {
  drawerVisible.value = true
}

// 关闭抽屉
const handleClose = () => {
  if (props.autoHide && !isExecuting.value) {
    drawerVisible.value = false
  }
}

// 确保终端已连接
const ensureConnected = async () => {
  if (!terminalIntegration.isReady()) {
    try {
      await terminalIntegration.connect()
      isConnected.value = true
    } catch (error) {
      console.error('Failed to connect terminal:', error)
      ElMessage.error('终端连接失败')
    }
  } else {
    isConnected.value = true
  }
  
  // 设置输出监听器
  setupOutputListener()
}

// 设置输出监听器
const setupOutputListener = () => {
  // 监听终端输出并显示
  terminalIntegration.onOutput((data) => {
    // 输出会自动显示在TerminalBest组件中
    console.log('[TerminalDrawer] Output received:', data.substring(0, 50))
  })
}

// 处理连接事件
const handleConnected = () => {
  isConnected.value = true
  emit('connected')
}

// 处理断开连接事件
const handleDisconnected = () => {
  isConnected.value = false
  emit('disconnected')
}

// 处理错误事件
const handleError = (error) => {
  emit('error', error)
}

// 清屏
const clearTerminal = () => {
  terminalRef.value?.clear()
  commandHistory.value = []
}

// 切换大小
const toggleSize = () => {
  isFullSize.value = !isFullSize.value
  drawerSize.value = isFullSize.value ? '90%' : props.size
}

// 发送命令
const sendCommand = () => {
  if (!commandInput.value.trim()) return
  
  if (!isConnected.value) {
    ElMessage.warning('终端未连接')
    return
  }
  
  const command = commandInput.value
  terminalRef.value?.sendCommand(command)
  commandHistory.value.push(command)
  commandInput.value = ''
}

// 执行命令（供外部调用）
const executeCommand = (command) => {
  if (!isConnected.value) {
    ensureConnected().then(() => {
      terminalIntegration.sendCommand(command + '\n')
    })
  } else {
    terminalIntegration.sendCommand(command + '\n')
  }
  
  // 记录到历史
  commandHistory.value.push(command)
}

// 更新进度（供外部调用）
const updateProgress = (value, text) => {
  progress.value = Math.min(100, Math.max(0, value))
  progressText.value = text || ''
  isExecuting.value = value < 100
}

// 完成执行（供外部调用）
const completeExecution = () => {
  progress.value = 100
  isExecuting.value = false
  
  if (props.autoHide) {
    setTimeout(() => {
      drawerVisible.value = false
    }, 2000)
  }
}

// 暴露方法
defineExpose({
  executeCommand,
  updateProgress,
  completeExecution,
  clearTerminal,
  openDrawer
})
</script>

<style scoped>
/* FAB按钮样式 */
.terminal-fab {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: all 0.3s ease;
  z-index: 2000;
}

.terminal-fab:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
}

.terminal-fab .el-icon {
  font-size: 24px;
}

/* 抽屉样式 */
:deep(.terminal-drawer) {
  background: #1e1e1e;
}

:deep(.terminal-drawer .el-drawer__header) {
  background: #2d2d2d;
  border-bottom: 1px solid #3a3a3a;
  padding: 0;
  margin: 0;
}

:deep(.terminal-drawer .el-drawer__body) {
  padding: 0;
  background: #1e1e1e;
  display: flex;
  flex-direction: column;
}

/* 头部样式 */
.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  height: 60px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-left h3 {
  margin: 0;
  color: #e0e0e0;
  font-size: 16px;
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge.connected {
  background: rgba(76, 175, 80, 0.1);
  color: #4caf50;
}

.status-badge.disconnected {
  background: rgba(244, 67, 54, 0.1);
  color: #f44336;
}

.status-badge.executing {
  background: rgba(33, 150, 243, 0.1);
  color: #2196f3;
}

.header-right {
  display: flex;
  gap: 8px;
}

/* 主体样式 */
.drawer-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}

.terminal-container {
  flex: 1;
  position: relative;
  min-height: 300px;
}

/* 进度指示器 */
.progress-indicator {
  position: absolute;
  bottom: 20px;
  left: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.8);
  border-radius: 8px;
  padding: 16px;
  backdrop-filter: blur(10px);
}

.progress-bar {
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.progress-text {
  margin: 8px 0 0;
  color: #b0b0b0;
  font-size: 12px;
}

/* 命令输入区 */
.command-input-area {
  padding: 12px 20px;
  background: #2d2d2d;
  border-top: 1px solid #3a3a3a;
}

:deep(.command-input-area .el-input__wrapper) {
  background: #1e1e1e;
  border-color: #3a3a3a;
}

:deep(.command-input-area .el-input__inner) {
  color: #e0e0e0;
  font-family: 'Consolas', 'Monaco', monospace;
}

/* 动画 */
.is-loading {
  animation: rotate 1s linear infinite;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>