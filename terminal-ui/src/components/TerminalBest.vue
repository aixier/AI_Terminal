<template>
  <div class="terminal-wrapper">
    <!-- 连接状态栏 -->
    <div class="connection-status" :class="connectionStatusClass">
      <span class="status-indicator"></span>
      <span class="status-text">{{ connectionStatusText }}</span>
      <button 
        v-if="!isConnected" 
        @click="reconnect" 
        class="reconnect-btn"
        :disabled="isReconnecting"
      >
        {{ isReconnecting ? '重连中...' : '重新连接' }}
      </button>
      <button 
        v-if="isConnected" 
        @click="refreshCursor" 
        class="cursor-btn"
        title="刷新光标 (Ctrl+Shift+R)"
      >
        ⟲
      </button>
    </div>
    
    <!-- 终端容器 -->
    <div class="terminal-container" ref="terminalContainer">
      <!-- 终端将挂载到这里 -->
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import terminalService from '../services/terminalService'

const terminalContainer = ref(null)
const isConnected = ref(false)
const isReconnecting = ref(false)

// 连接状态计算属性
const connectionStatusClass = computed(() => ({
  'connected': isConnected.value,
  'disconnected': !isConnected.value,
  'reconnecting': isReconnecting.value
}))

const connectionStatusText = computed(() => {
  if (isReconnecting.value) return '重连中...'
  return isConnected.value ? '已连接' : '连接断开'
})

// Props
const props = defineProps({
  serverUrl: {
    type: String,
    default: ''
  },
  theme: {
    type: String,
    default: 'dark'
  },
  fontSize: {
    type: Number,
    default: 14
  }
})

// Emits
const emit = defineEmits(['connected', 'disconnected', 'error'])

// 连接状态监听
const updateConnectionStatus = () => {
  const status = terminalService.getStatus()
  isConnected.value = status.isConnected
  isReconnecting.value = status.isReconnecting || false
}

// 重连方法
const reconnect = async () => {
  try {
    isReconnecting.value = true
    await terminalService.reconnect()
    updateConnectionStatus()
  } catch (error) {
    console.error('Reconnection failed:', error)
  } finally {
    isReconnecting.value = false
  }
}

// 刷新光标
const refreshCursor = () => {
  terminalService.refreshCursor()
  terminalService.focus()
}

// 生命周期
onMounted(async () => {
  try {
    // 初始化终端
    await terminalService.init(terminalContainer.value, {
      serverUrl: props.serverUrl,
      terminal: {
        fontSize: props.fontSize
      }
    })
    
    // 启用自动调整大小
    terminalService.enableAutoResize()
    
    // 设置快捷键
    setupKeyboardShortcuts()
    
    // 监听连接状态变化
    terminalService.onConnectionChange = updateConnectionStatus
    updateConnectionStatus()
    
    // 定期检查连接状态
    setInterval(updateConnectionStatus, 2000)
    
    emit('connected')
  } catch (error) {
    console.error('Failed to initialize terminal:', error)
    updateConnectionStatus()
    emit('error', error)
  }
})

onUnmounted(() => {
  // 清理终端
  terminalService.destroy()
})

// 设置键盘快捷键
function setupKeyboardShortcuts() {
  const container = terminalContainer.value
  if (!container) return
  
  container.addEventListener('keydown', (e) => {
    // Ctrl+Shift+C: 复制
    if (e.ctrlKey && e.shiftKey && e.key === 'C') {
      e.preventDefault()
      terminalService.copyToClipboard()
    }
    
    // Ctrl+Shift+V: 粘贴
    if (e.ctrlKey && e.shiftKey && e.key === 'V') {
      e.preventDefault()
      terminalService.pasteFromClipboard()
    }
    
    // Ctrl+Shift+F: 搜索
    if (e.ctrlKey && e.shiftKey && e.key === 'F') {
      e.preventDefault()
      const term = prompt('Search for:')
      if (term) {
        terminalService.search(term)
      }
    }
    
    // Ctrl+L: 清屏
    if (e.ctrlKey && e.key === 'l') {
      e.preventDefault()
      terminalService.clear()
    }
    
    // Ctrl+Shift+R: 刷新光标
    if (e.ctrlKey && e.shiftKey && e.key === 'R') {
      e.preventDefault()
      refreshCursor()
    }
  })
}

// 公开的方法
const sendCommand = (command) => {
  terminalService.sendCommand(command)
}

const clear = () => {
  terminalService.clear()
}

const getStatus = () => {
  return terminalService.getStatus()
}

// 暴露给父组件
defineExpose({
  sendCommand,
  clear,
  getStatus
})
</script>

<style scoped>
.terminal-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: #2d2d2d;
  border-bottom: 1px solid #404040;
  font-size: 12px;
  color: #cccccc;
  min-height: 32px;
}

.connection-status.connected {
  background: #1a3d1a;
  border-color: #2d5a2d;
}

.connection-status.disconnected {
  background: #3d1a1a;
  border-color: #5a2d2d;
}

.connection-status.reconnecting {
  background: #3d3d1a;
  border-color: #5a5a2d;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #666;
}

.connected .status-indicator {
  background: #4caf50;
  box-shadow: 0 0 4px rgba(76, 175, 80, 0.5);
}

.disconnected .status-indicator {
  background: #f44336;
  box-shadow: 0 0 4px rgba(244, 67, 54, 0.5);
}

.reconnecting .status-indicator {
  background: #ff9800;
  box-shadow: 0 0 4px rgba(255, 152, 0, 0.5);
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.reconnect-btn, .cursor-btn {
  padding: 4px 8px;
  background: #404040;
  border: 1px solid #666;
  border-radius: 3px;
  color: #cccccc;
  font-size: 11px;
  cursor: pointer;
  transition: background 0.2s;
}

.reconnect-btn:hover:not(:disabled), .cursor-btn:hover {
  background: #505050;
}

.reconnect-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.cursor-btn {
  font-weight: bold;
  min-width: 24px;
  text-align: center;
}

.terminal-container {
  flex: 1;
  background: #1e1e1e;
  position: relative;
  overflow: hidden;
}

/* XTerm.js 样式优化 */
:deep(.xterm) {
  padding: 8px;
  height: 100%;
}

:deep(.xterm-viewport) {
  background-color: transparent;
  scrollbar-width: thin;
  scrollbar-color: #4a4a4a #1e1e1e;
}

:deep(.xterm-viewport::-webkit-scrollbar) {
  width: 10px;
  background-color: #1e1e1e;
}

:deep(.xterm-viewport::-webkit-scrollbar-track) {
  background-color: #1e1e1e;
}

:deep(.xterm-viewport::-webkit-scrollbar-thumb) {
  background-color: #4a4a4a;
  border-radius: 5px;
}

:deep(.xterm-viewport::-webkit-scrollbar-thumb:hover) {
  background-color: #5a5a5a;
}

/* 光标样式 */
:deep(.xterm-cursor-layer) {
  z-index: 4;
}

:deep(.xterm-screen) {
  overflow: hidden;
}

/* 选择高亮 */
:deep(.xterm-selection-layer) {
  z-index: 3;
}

/* 链接样式 */
:deep(.xterm-link-layer) {
  z-index: 2;
}

:deep(.xterm-link) {
  text-decoration: underline;
  cursor: pointer;
}

:deep(.xterm-link:hover) {
  opacity: 0.8;
}
</style>