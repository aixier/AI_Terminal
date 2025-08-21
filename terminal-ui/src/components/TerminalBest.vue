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
import { createSimpleTerminalEngine } from '../core/terminal-engine/simple-engine.js'

const terminalContainer = ref(null)
const isConnected = ref(false)
const isReconnecting = ref(false)
const isMobile = ref(false)
const terminalEngine = ref(null)

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
  if (terminalEngine.value && terminalEngine.value.websocket) {
    isConnected.value = terminalEngine.value.websocket.readyState === WebSocket.OPEN
  } else {
    isConnected.value = false
  }
}

// 重连方法
const reconnect = async () => {
  try {
    isReconnecting.value = true
    if (terminalEngine.value) {
      terminalEngine.value.destroy()
    }
    await initializeTerminal()
    updateConnectionStatus()
  } catch (error) {
    console.error('Reconnection failed:', error)
  } finally {
    isReconnecting.value = false
  }
}

// 刷新光标
const refreshCursor = () => {
  if (terminalEngine.value && terminalEngine.value.contentEl) {
    terminalEngine.value.contentEl.focus()
  }
}

// 重新初始化终端（移动端）
const reinitializeTerminal = async () => {
  console.log('[TerminalBest] Mobile terminal reinitialization triggered')
  
  try {
    if (terminalEngine.value) {
      terminalEngine.value.destroy()
    }
    await initializeTerminal()
    
    // 移动端额外执行光标恢复
    if (isMobile.value) {
      setTimeout(() => {
        refreshCursor()
        console.log('[TerminalBest] Mobile cursor restored after reinit')
      }, 300)
    }
    
    // 更新连接状态
    updateConnectionStatus()
    console.log('[TerminalBest] Terminal reinitialization successful')
  } catch (error) {
    console.error('[TerminalBest] Terminal reinitialization error:', error)
  }
}

// 检测移动设备
const isMobileDevice = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         (navigator.maxTouchPoints && navigator.maxTouchPoints > 2)
}

// 初始化终端
const initializeTerminal = async () => {
  if (!terminalContainer.value) return
  
  const config = {
    container: terminalContainer.value,
    device: isMobile.value ? 'mobile' : 'desktop',
    config: {
      renderer: {
        type: 'auto',
        optimizeForTouch: isMobile.value
      },
      buffer: {
        maxLines: 10000,
        cols: 80,
        rows: 24
      },
      theme: {
        background: '#000000',
        foreground: '#00ff00',
        cursor: '#00ff00'
      }
    }
  }
  
  terminalEngine.value = createSimpleTerminalEngine(config)
  
  // 设置WebSocket事件监听
  if (terminalEngine.value.websocket) {
    terminalEngine.value.websocket.onopen = () => {
      isConnected.value = true
      emit('connected')
    }
    
    terminalEngine.value.websocket.onclose = () => {
      isConnected.value = false
      emit('disconnected')
    }
    
    terminalEngine.value.websocket.onerror = (error) => {
      console.error('[TerminalBest] WebSocket error:', error)
      emit('error', error)
    }
  }
}

// 生命周期
onMounted(async () => {
  try {
    // 检测移动端设备
    isMobile.value = isMobileDevice()
    console.log('[TerminalBest] Mobile device detected:', isMobile.value)
    
    // 初始化终端
    await initializeTerminal()
    
    // 设置快捷键
    setupKeyboardShortcuts()
    
    // 定期检查连接状态
    setInterval(updateConnectionStatus, 2000)
    
    // 移动端特殊处理
    if (isMobile.value) {
      // 延迟初始化，确保移动端布局完成
      setTimeout(() => {
        reinitializeTerminal()
      }, 500)
    }
    
  } catch (error) {
    console.error('Failed to initialize terminal:', error)
    updateConnectionStatus()
    emit('error', error)
  }
})

onUnmounted(() => {
  // 清理终端
  if (terminalEngine.value) {
    terminalEngine.value.destroy()
  }
})

// 设置键盘快捷键
function setupKeyboardShortcuts() {
  const container = terminalContainer.value
  if (!container) return
  
  container.addEventListener('keydown', (e) => {
    // Ctrl+Shift+C: 复制 (暂时禁用，因为需要实现复制功能)
    if (e.ctrlKey && e.shiftKey && e.key === 'C') {
      e.preventDefault()
      // TODO: 实现复制功能
    }
    
    // Ctrl+Shift+V: 粘贴 (暂时禁用)
    if (e.ctrlKey && e.shiftKey && e.key === 'V') {
      e.preventDefault()
      // TODO: 实现粘贴功能
    }
    
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
  })
}

// 公开的方法
const sendCommand = (command) => {
  if (terminalEngine.value) {
    terminalEngine.value.sendInput(command + '\r')
  }
}

const clear = () => {
  if (terminalEngine.value) {
    terminalEngine.value.clear()
  }
}

const getStatus = () => {
  return {
    isConnected: isConnected.value,
    isReconnecting: isReconnecting.value
  }
}

// 暴露给父组件
defineExpose({
  sendCommand,
  clear,
  getStatus,
  reconnect,
  refreshCursor
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
  
  /* 移动端光标闪烁动画 */
  @keyframes mobile-cursor-blink {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0.3; }
  }
  
  /* 确保光标层在最顶层 */
  :deep(.xterm-cursor-layer) {
    z-index: 10 !important;
  }
  
  /* 移动端terminal容器可获得焦点 */
  .terminal-container {
    outline: none;
  }
  
  .terminal-container:focus {
    outline: 2px solid #0078d4;
    outline-offset: 2px;
  }
  
  /* 移动端字体大小调整 */
  :deep(.xterm) {
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