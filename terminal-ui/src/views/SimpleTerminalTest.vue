<!--
  简化的Terminal Engine测试页面
  用于调试初始化问题
-->
<template>
  <div class="simple-terminal-test">
    <div class="header">
      <h1>🔧 Terminal Engine 调试</h1>
      <div class="status">
        <span :class="['status-dot', engineStatus]"></span>
        {{ statusText }}
      </div>
    </div>
    
    <!-- 调试信息 -->
    <div class="debug-info">
      <h3>调试信息</h3>
      <pre>{{ debugInfo }}</pre>
    </div>
    
    <!-- 错误信息 -->
    <div v-if="errors.length > 0" class="error-section">
      <h3>错误信息</h3>
      <div v-for="(error, index) in errors" :key="index" class="error-item">
        {{ error }}
      </div>
    </div>
    
    <!-- 简单控制 -->
    <div class="simple-controls">
      <button @click="initializeEngine" :disabled="engineStatus === 'initializing'">
        {{ engineStatus === 'initializing' ? '初始化中...' : '重新初始化' }}
      </button>
      <button @click="testBasicRender" :disabled="!engine">
        测试基础渲染
      </button>
      <button @click="clearTerminal" :disabled="!engine">
        清空
      </button>
    </div>
    
    <!-- Terminal容器 -->
    <div class="terminal-section">
      <h3>Terminal 显示区域</h3>
      <div class="terminal-container" ref="terminalContainer">
        <div class="placeholder" v-if="!engine">
          等待Terminal Engine初始化...
        </div>
      </div>
    </div>
    
    <!-- 日志 -->
    <div class="log-section">
      <h3>实时日志</h3>
      <div class="log-content" ref="logContainer">
        <div v-for="(log, index) in logs" :key="index" class="log-entry">
          <span class="log-time">{{ formatTime(log.time) }}</span>
          <span class="log-message">{{ log.message }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'

// 基础状态
const terminalContainer = ref(null)
const logContainer = ref(null)
const engine = ref(null)
const engineStatus = ref('not-initialized') // not-initialized, initializing, ready, error
const errors = ref([])
const logs = ref([])

// 调试信息
const debugInfo = ref({
  containerElement: false,
  deviceDetected: false,
  engineCreated: false,
  currentError: null
})

// 状态文本
const statusText = computed(() => {
  switch (engineStatus.value) {
    case 'not-initialized': return '未初始化'
    case 'initializing': return '初始化中...'
    case 'ready': return '就绪'
    case 'error': return '错误'
    default: return '未知状态'
  }
})

// 添加日志
function addLog(message) {
  logs.value.push({
    time: Date.now(),
    message
  })
  
  // 滚动到底部
  nextTick(() => {
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight
    }
  })
}

// 格式化时间
function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString()
}

// 更新调试信息
function updateDebugInfo() {
  debugInfo.value = {
    containerElement: !!terminalContainer.value,
    deviceDetected: typeof window !== 'undefined',
    engineCreated: !!engine.value,
    currentError: errors.value.length > 0 ? errors.value[errors.value.length - 1] : null,
    windowSize: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'unknown',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
  }
}

// 初始化引擎
async function initializeEngine() {
  try {
    engineStatus.value = 'initializing'
    errors.value = []
    addLog('开始初始化Terminal Engine...')
    
    // 检查容器
    await nextTick()
    if (!terminalContainer.value) {
      throw new Error('Terminal容器元素未找到')
    }
    addLog('✓ Terminal容器已找到')
    
    // 动态导入Terminal Engine
    addLog('导入Terminal Engine模块...')
    const { createTerminalEngine, DeviceDetector } = await import('../core/terminal-engine/index.js')
    addLog('✓ Terminal Engine模块导入成功')
    
    // 检测设备
    addLog('检测设备信息...')
    const deviceInfo = DeviceDetector.detect()
    addLog(`✓ 设备检测完成: ${deviceInfo.type}`)
    
    // 创建简单配置
    const config = {
      device: 'auto',
      container: terminalContainer.value,
      config: {
        renderer: {
          type: 'auto'
        },
        buffer: {
          maxLines: 1000,
          cols: 80,
          rows: 24
        },
        performance: {
          targetFPS: 30
        },
        theme: {
          background: '#1e1e1e',
          foreground: '#ffffff',
          cursor: '#ffffff'
        }
      }
    }
    
    addLog('创建Terminal Engine实例...')
    engine.value = createTerminalEngine(config)
    addLog('✓ Terminal Engine实例创建成功')
    
    // 绑定事件
    engine.value.on('ready', () => {
      addLog('✓ Terminal Engine就绪')
      engineStatus.value = 'ready'
      
      // 发送欢迎消息
      engine.value.write('🎉 Terminal Engine 初始化成功!\n')
      engine.value.write('设备类型: ' + deviceInfo.type + '\n')
      engine.value.write('渲染器: ' + (engine.value.renderer?.type || 'unknown') + '\n')
      engine.value.write('\n输入命令开始测试...\n')
    })
    
    engine.value.on('error', (error) => {
      addLog('❌ Engine错误: ' + error.message)
      errors.value.push(error.message)
      engineStatus.value = 'error'
    })
    
    addLog('等待Engine就绪...')
    
  } catch (error) {
    addLog('❌ 初始化失败: ' + error.message)
    errors.value.push(error.message)
    engineStatus.value = 'error'
    console.error('Terminal Engine初始化失败:', error)
  }
  
  updateDebugInfo()
}

// 测试基础渲染
function testBasicRender() {
  if (!engine.value) return
  
  addLog('执行基础渲染测试...')
  engine.value.write('\n=== 基础渲染测试 ===\n')
  engine.value.write('普通文本\n')
  engine.value.write('\x1b[31m红色文本\x1b[0m\n')
  engine.value.write('\x1b[32m绿色文本\x1b[0m\n')
  engine.value.write('\x1b[34m蓝色文本\x1b[0m\n')
  engine.value.write('\x1b[1m粗体文本\x1b[0m\n')
  engine.value.write('测试完成!\n\n')
}

// 清空终端
function clearTerminal() {
  if (!engine.value) return
  
  engine.value.clear()
  addLog('终端已清空')
}

// 组件挂载
onMounted(() => {
  addLog('页面已加载，准备初始化...')
  updateDebugInfo()
  
  // 自动初始化
  setTimeout(() => {
    initializeEngine()
  }, 100)
})
</script>

<style scoped>
.simple-terminal-test {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.header {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 1px solid #ddd;
}

.header h1 {
  margin: 0;
  color: #333;
}

.status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.status-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #ccc;
}

.status-dot.not-initialized {
  background: #ccc;
}

.status-dot.initializing {
  background: #ffa500;
  animation: pulse 1s infinite;
}

.status-dot.ready {
  background: #28a745;
}

.status-dot.error {
  background: #dc3545;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.debug-info, .error-section, .simple-controls, .terminal-section, .log-section {
  margin-bottom: 20px;
  padding: 15px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #f9f9f9;
}

.debug-info h3, .error-section h3, .terminal-section h3, .log-section h3 {
  margin: 0 0 10px 0;
  color: #333;
}

.debug-info pre {
  background: #fff;
  padding: 10px;
  border-radius: 3px;
  overflow-x: auto;
  font-size: 12px;
}

.error-item {
  color: #dc3545;
  margin-bottom: 5px;
  font-family: monospace;
}

.simple-controls {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.simple-controls button {
  padding: 8px 16px;
  background: #007ACC;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.simple-controls button:hover:not(:disabled) {
  background: #005999;
}

.simple-controls button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.terminal-container {
  min-height: 300px;
  background: #1e1e1e;
  border: 1px solid #333;
  border-radius: 4px;
  position: relative;
  overflow: hidden;
}

.placeholder {
  color: #888;
  text-align: center;
  padding: 50px;
  font-style: italic;
}

.log-content {
  height: 200px;
  overflow-y: auto;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 3px;
  padding: 10px;
  font-size: 12px;
}

.log-entry {
  margin-bottom: 4px;
  display: flex;
  gap: 10px;
}

.log-time {
  color: #666;
  min-width: 80px;
  font-size: 11px;
}

.log-message {
  flex: 1;
  word-break: break-word;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .simple-terminal-test {
    padding: 10px;
  }
  
  .header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
  
  .simple-controls {
    flex-direction: column;
  }
  
  .simple-controls button {
    width: 100%;
  }
  
  .terminal-container {
    min-height: 200px;
  }
  
  .log-content {
    height: 150px;
  }
}
</style>