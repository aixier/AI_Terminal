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
      <button 
        @click="reinitializeTerminal" 
        class="mobile-init-btn"
        title="重新初始化终端 (移动端)"
      >
        📱
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
import { createXTermEngine } from '../core/terminal-engine/xterm-engine.js'

const terminalContainer = ref(null)
const isConnected = ref(false)
const isReconnecting = ref(false)
const terminalEngine = ref(null)

// 计算属性
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
  fontSize: {
    type: Number,
    default: 14
  }
})

// Emits
const emit = defineEmits(['connected', 'disconnected', 'error'])

// 更新连接状态
const updateConnectionStatus = () => {
  if (terminalEngine.value?.websocket) {
    isConnected.value = terminalEngine.value.websocket.readyState === WebSocket.OPEN
  } else {
    isConnected.value = false
  }
}

// 初始化终端
const initializeTerminal = async () => {
  if (!terminalContainer.value) return

  const config = {
    container: terminalContainer.value,
    fontSize: props.fontSize
  }

  terminalEngine.value = createXTermEngine(config)

  // 监听 WebSocket 事件以更新 UI 状态
  if (terminalEngine.value.websocket) {
    const originalOnOpen = terminalEngine.value.websocket.onopen
    const originalOnClose = terminalEngine.value.websocket.onclose
    const originalOnError = terminalEngine.value.websocket.onerror

    terminalEngine.value.websocket.onopen = () => {
      originalOnOpen?.call(terminalEngine.value.websocket)
      isConnected.value = true
      emit('connected')
    }

    terminalEngine.value.websocket.onclose = () => {
      originalOnClose?.call(terminalEngine.value.websocket)
      isConnected.value = false
      emit('disconnected')
    }

    terminalEngine.value.websocket.onerror = (error) => {
      originalOnError?.call(terminalEngine.value.websocket, error)
      emit('error', error)
    }
  }
}

// 重新连接
const reconnect = async () => {
  try {
    isReconnecting.value = true
    terminalEngine.value?.destroy()
    await initializeTerminal()
    updateConnectionStatus()
  } catch (error) {
    console.error('[Terminal] Reconnection failed:', error)
    emit('error', error)
  } finally {
    isReconnecting.value = false
  }
}

// 刷新光标焦点
const refreshCursor = () => {
  if (terminalEngine.value?.contentEl) {
    terminalEngine.value.contentEl.focus()
  } else if (terminalContainer.value) {
    terminalContainer.value.focus()
  }
}

// 重新初始化终端
const reinitializeTerminal = async () => {
  try {
    terminalEngine.value?.destroy()
    await initializeTerminal()
    updateConnectionStatus()
  } catch (error) {
    console.error('[Terminal] Reinitialization failed:', error)
    emit('error', error)
  }
}

// 生命周期
onMounted(async () => {
  try {
    await initializeTerminal()

    // 定期更新连接状态
    const statusInterval = setInterval(updateConnectionStatus, 2000)
    onUnmounted(() => clearInterval(statusInterval))

    // 设置键盘快捷键
    setupKeyboardShortcuts()
  } catch (error) {
    console.error('[Terminal] Initialization failed:', error)
    emit('error', error)
  }
})

onUnmounted(() => {
  terminalEngine.value?.destroy()
})

// 键盘快捷键
function setupKeyboardShortcuts() {
  if (!terminalContainer.value) return

  terminalContainer.value.addEventListener('keydown', async (e) => {
    // Ctrl+L: 清屏
    if (e.ctrlKey && e.key === 'l') {
      e.preventDefault()
      clear()
    }
    // Ctrl+Shift+R: 刷新光标
    if (e.ctrlKey && e.shiftKey && e.key === 'R') {
      e.preventDefault()
      refreshCursor()
    }
    // Ctrl+Shift+C: 复制选中文本
    if (e.ctrlKey && e.shiftKey && e.key === 'C') {
      e.preventDefault()
      const copied = await terminalEngine.value?.copySelection()
      if (copied) {
        console.log('[TerminalBest] Text copied successfully')
      }
    }
    // Ctrl+Shift+V: 粘贴剪贴板内容
    if (e.ctrlKey && e.shiftKey && e.key === 'V') {
      e.preventDefault()
      const pasted = await terminalEngine.value?.pasteFromClipboard()
      if (pasted) {
        console.log('[TerminalBest] Text pasted successfully')
      }
    }
  })
}

// 公开的方法
const sendCommand = (command) => {
  terminalEngine.value?.sendInput(command + '\r')
}

const clear = () => {
  terminalEngine.value?.clear()
}

const getStatus = () => ({
  isConnected: isConnected.value,
  isReconnecting: isReconnecting.value
})

// 暴露给父组件
defineExpose({
  sendCommand,
  clear,
  getStatus,
  reconnect,
  refreshCursor,
  reinitializeTerminal,
  copySelection: () => terminalEngine.value?.copySelection(),
  pasteFromClipboard: () => terminalEngine.value?.pasteFromClipboard()
})
</script>

<style scoped>
.terminal-wrapper {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #1e1e1e;
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

.mobile-init-btn {
  font-weight: bold;
  min-width: 24px;
  text-align: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: 1px solid #5a6fd8;
}

.mobile-init-btn:hover {
  background: linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%);
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

.terminal-container {
  flex: 1;
  background: #1e1e1e;
  position: relative;
  overflow: hidden;
}

/* 隐藏 xterm.js 的输入 textarea（保留在DOM中以支持输入） */
:deep(.xterm-helper-textarea) {
  position: absolute;
  left: -9999px;
  top: -9999px;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

/* Terminal 样式优化 */
#terminal-content {
  padding: 8px;
  height: 100%;
  background-color: transparent;
  scrollbar-width: thin;
  scrollbar-color: #4a4a4a #1e1e1e;
}

#terminal-content::-webkit-scrollbar {
  width: 10px;
  background-color: #1e1e1e;
}

#terminal-content::-webkit-scrollbar-track {
  background-color: #1e1e1e;
}

#terminal-content::-webkit-scrollbar-thumb {
  background-color: #4a4a4a;
  border-radius: 5px;
}

#terminal-content::-webkit-scrollbar-thumb:hover {
  background-color: #5a5a5a;
}

/* 简化的终端样式 - 光标和选择等功能由SimpleTerminalEngine内部处理 */

/* 链接样式由SimpleTerminalEngine内部处理 */

/* 移动端优化 */
@media (max-width: 768px) {
  .connection-status {
    padding: 4px 8px;
    min-height: 28px;
    font-size: 11px;
  }
  
  .reconnect-btn, .cursor-btn, .mobile-init-btn {
    padding: 3px 6px;
    font-size: 10px;
    min-width: 20px;
  }
  
  .terminal-container {
    /* 移动端触摸优化 */
    touch-action: manipulation;
    -webkit-overflow-scrolling: touch;
  }
  
  /* 强制显示光标在移动端 */
  :deep(.xterm-cursor) {
    opacity: 1 !important;
    visibility: visible !important;
    display: block !important;
    background-color: #ffffff !important;
    color: #000000 !important;
    animation: mobile-cursor-blink 1s infinite !important;
  }
  
  /* 移动端光标和焦点样式 */
  .terminal-container {
    outline: none;
  }
  
  .terminal-container:focus {
    outline: 2px solid #0078d4;
    outline-offset: 2px;
  }
  
  /* 移动端字体大小调整 */
  #terminal-content {
    font-size: 12px !important;
  }
}

@media (max-width: 480px) {
  .connection-status {
    flex-wrap: wrap;
    gap: 4px;
  }
  
  .status-text {
    order: 1;
    flex-basis: 100%;
  }
  
  .reconnect-btn, .cursor-btn, .mobile-init-btn {
    order: 2;
  }
}

/* 处理虚拟键盘 */
@media screen and (max-height: 500px) {
  .terminal-container {
    height: calc(100vh - 100px) !important;
  }
}
</style>