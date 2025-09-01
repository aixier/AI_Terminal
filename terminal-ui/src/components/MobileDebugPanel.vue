<template>
  <div v-if="isVisible && isMobile" class="mobile-debug-panel">
    <div class="debug-header">
      <span>调试信息</span>
      <button @click="togglePanel" class="toggle-btn">{{ isExpanded ? '收起' : '展开' }}</button>
      <button @click="clearLogs" class="clear-btn">清空</button>
    </div>
    <div v-if="isExpanded" class="debug-content">
      <div v-for="(log, index) in logs" :key="index" class="log-item" :class="log.type">
        <span class="log-time">{{ log.time }}</span>
        <span class="log-type">{{ log.type }}</span>
        <span class="log-message">{{ log.message }}</span>
      </div>
      <div v-if="logs.length === 0" class="no-logs">暂无日志</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'

// 调试日志
const logs = ref([])
const isExpanded = ref(false)
const isVisible = ref(false)

// 检测是否是移动端
const isMobile = computed(() => {
  return /Mobile|Android|iPhone/i.test(navigator.userAgent)
})

// 添加日志
const addLog = (type, message) => {
  const now = new Date()
  const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
  
  logs.value.unshift({
    type,
    message,
    time
  })
  
  // 限制日志数量
  if (logs.value.length > 50) {
    logs.value.pop()
  }
}

// 清空日志
const clearLogs = () => {
  logs.value = []
}

// 切换面板
const togglePanel = () => {
  isExpanded.value = !isExpanded.value
}

// 拦截console方法
const interceptConsole = () => {
  const originalLog = console.log
  const originalError = console.error
  const originalWarn = console.warn
  
  console.log = function(...args) {
    originalLog.apply(console, args)
    // 只记录XHS Share相关的日志
    const message = args.join(' ')
    if (message.includes('[XHS Share')) {
      addLog('info', message)
    }
  }
  
  console.error = function(...args) {
    originalError.apply(console, args)
    const message = args.join(' ')
    if (message.includes('[XHS Share') || message.includes('分享')) {
      addLog('error', message)
    }
  }
  
  console.warn = function(...args) {
    originalWarn.apply(console, args)
    const message = args.join(' ')
    if (message.includes('[XHS Share') || message.includes('localStorage')) {
      addLog('warn', message)
    }
  }
}

// 监听错误事件
const listenErrors = () => {
  window.addEventListener('error', (event) => {
    addLog('error', `全局错误: ${event.message}`)
  })
  
  window.addEventListener('unhandledrejection', (event) => {
    addLog('error', `未处理的Promise拒绝: ${event.reason}`)
  })
}

onMounted(() => {
  // 只在移动端启用
  if (isMobile.value) {
    isVisible.value = true
    interceptConsole()
    listenErrors()
    addLog('info', '移动端调试面板已启动')
    addLog('info', `User Agent: ${navigator.userAgent}`)
  }
})

// 暴露方法供外部使用
defineExpose({
  addLog
})
</script>

<style scoped>
.mobile-debug-panel {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.9);
  color: #fff;
  font-size: 12px;
  z-index: 10000;
  max-height: 50vh;
  font-family: 'Courier New', monospace;
}

.debug-header {
  padding: 8px 10px;
  background: rgba(0, 0, 0, 0.95);
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 2px solid #409eff;
}

.debug-header span {
  flex: 1;
  font-weight: bold;
}

.toggle-btn,
.clear-btn {
  padding: 4px 8px;
  background: #409eff;
  color: #fff;
  border: none;
  border-radius: 3px;
  font-size: 11px;
  margin-left: 8px;
}

.debug-content {
  max-height: 40vh;
  overflow-y: auto;
  padding: 5px;
}

.log-item {
  padding: 4px 5px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: flex-start;
  word-break: break-all;
}

.log-item.error {
  background: rgba(245, 108, 108, 0.1);
  color: #f56c6c;
}

.log-item.warn {
  background: rgba(230, 162, 60, 0.1);
  color: #e6a23c;
}

.log-item.info {
  color: #909399;
}

.log-time {
  color: #606266;
  margin-right: 8px;
  flex-shrink: 0;
}

.log-type {
  padding: 1px 4px;
  border-radius: 2px;
  margin-right: 8px;
  font-size: 10px;
  flex-shrink: 0;
}

.log-item.error .log-type {
  background: #f56c6c;
  color: #fff;
}

.log-item.warn .log-type {
  background: #e6a23c;
  color: #fff;
}

.log-item.info .log-type {
  background: #909399;
  color: #fff;
}

.log-message {
  flex: 1;
  line-height: 1.4;
}

.no-logs {
  text-align: center;
  padding: 20px;
  color: #606266;
}

/* 移动端优化 */
@media (max-width: 768px) {
  .mobile-debug-panel {
    font-size: 11px;
  }
  
  .debug-header {
    padding: 6px 8px;
  }
  
  .log-item {
    padding: 3px 4px;
  }
}
</style>