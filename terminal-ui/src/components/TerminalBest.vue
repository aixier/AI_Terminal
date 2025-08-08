<template>
  <div class="terminal-container" ref="terminalContainer">
    <!-- 终端将挂载到这里 -->
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import terminalService from '../services/terminalService'

const terminalContainer = ref(null)

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
    
    emit('connected')
  } catch (error) {
    console.error('Failed to initialize terminal:', error)
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
.terminal-container {
  width: 100%;
  height: 100%;
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