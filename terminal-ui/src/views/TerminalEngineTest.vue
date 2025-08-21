<!--
  Terminal Engine 测试页面
  独立验证新Terminal Engine的功能和性能
-->
<template>
  <div class="terminal-engine-test">
    <!-- 折叠控制栏 -->
    <div class="control-bar" :class="{ collapsed: controlsCollapsed }">
      <div class="control-header">
        <h1>AI Terminal</h1>
        <button class="collapse-btn" @click="controlsCollapsed = !controlsCollapsed">
          {{ controlsCollapsed ? '展开' : '折叠' }}
        </button>
      </div>
      
      <div class="collapsible-content" v-show="!controlsCollapsed">
        <div class="controls">
          <div class="control-group">
            <label>渲染器:</label>
            <select v-model="selectedRenderer" @change="recreateEngine">
              <option value="auto">自动选择</option>
              <option value="canvas2d">Canvas 2D</option>
            </select>
          </div>
          
          <div class="control-group">
            <label>设备:</label>
            <select v-model="selectedDevice" @change="recreateEngine">
              <option value="auto">自动检测</option>
              <option value="mobile">移动端</option>
              <option value="desktop">桌面端</option>
            </select>
          </div>
        </div>
        
        <div class="actions">
          <button @click="clearTerminal">清空</button>
          <button @click="sendTestData">测试</button>
        </div>
      </div>
    </div>
    
    <!-- 状态栏 -->
    <div class="status-bar">
      <span class="status-item">设备: {{ deviceInfo.type }}</span>
      <span class="status-item">渲染器: {{ currentRenderer }}</span>
      <span class="status-item">状态: {{ engineReady ? '就绪' : '初始化中' }}</span>
    </div>
    
    <!-- Terminal容器 -->
    <div class="terminal-container">
      <div class="terminal-wrapper" ref="terminalContainer"></div>
    </div>
    
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
// 导入简化版本
import { createSimpleTerminalEngine } from '../core/terminal-engine/simple-engine.js'

// 模拟设备检测
const mockDeviceDetector = {
  detect: () => ({
    type: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
    screen: {
      width: window.innerWidth,
      height: window.innerHeight,
      pixelRatio: window.devicePixelRatio || 1
    },
    browser: navigator.userAgent.includes('Chrome') ? 'Chrome' : 'Other'
  }),
  getCapabilities: () => ({
    canvas: !!document.createElement('canvas').getContext,
    webgl: !!document.createElement('canvas').getContext('webgl'),
    webgl2: !!document.createElement('canvas').getContext('webgl2')
  }),
  getPerformanceLevel: () => 'medium'
}

// 模拟渲染器支持检测
function mockDetectRendererSupport() {
  return {
    recommended: 'canvas2d',
    support: { canvas2d: true, webgl: false, dom: true }
  }
}

// 响应式状态
const terminalContainer = ref(null)
const logContainer = ref(null)

// Engine实例和配置
const engine = ref(null)
const selectedRenderer = ref('auto')
const selectedDevice = ref('auto')
const targetFPS = ref(60)
const enableVirtualScrolling = ref(true)
const enableTouchOptimization = ref(false)
const darkTheme = ref(true)

// 测试状态
const testing = ref(false)
const testLogs = ref([])
const controlsCollapsed = ref(true)
const engineReady = ref(false)

// 设备和性能信息
const deviceInfo = ref({})
const capabilities = ref({})
const performanceLevel = ref('unknown')
const currentRenderer = ref('unknown')
const recommendedRenderer = ref('unknown')
const performanceMetrics = ref({})

// 生命周期
onMounted(async () => {
  await initializeTest()
})

onUnmounted(() => {
  if (engine.value) {
    engine.value.destroy()
  }
})

/**
 * 初始化测试环境
 */
async function initializeTest() {
  try {
    // 检测设备信息
    deviceInfo.value = mockDeviceDetector.detect()
    capabilities.value = mockDeviceDetector.getCapabilities()
    performanceLevel.value = mockDeviceDetector.getPerformanceLevel()
    
    // 检测渲染器支持
    const rendererSupport = mockDetectRendererSupport()
    recommendedRenderer.value = rendererSupport.recommended
    
    // 根据设备类型设置默认值
    if (deviceInfo.value.type === 'mobile') {
      enableTouchOptimization.value = true
      targetFPS.value = 30
    }
    
    addLog('info', '设备检测完成')
    addLog('info', `设备类型: ${deviceInfo.value.type}`)
    addLog('info', `性能等级: ${performanceLevel.value}`)
    addLog('info', `推荐渲染器: ${recommendedRenderer.value}`)
    
    // 创建Terminal Engine
    await createEngine()
    
  } catch (error) {
    addLog('error', `初始化失败: ${error.message}`)
  }
}

/**
 * 创建Terminal Engine
 */
async function createEngine() {
  try {
    // 销毁现有实例
    if (engine.value) {
      engine.value.destroy()
      engine.value = null
    }
    
    // 等待DOM更新
    await nextTick()
    
    if (!terminalContainer.value) {
      throw new Error('Terminal container not found')
    }
    
    addLog('info', '开始创建Terminal Engine...')
    
    // 清空容器
    terminalContainer.value.innerHTML = ''
    
    // 简化配置 - 经典Terminal样式
    const config = {
      device: selectedDevice.value === 'auto' ? deviceInfo.value.type : selectedDevice.value,
      container: terminalContainer.value,
      config: {
        renderer: {
          type: selectedRenderer.value === 'auto' ? 'canvas2d' : selectedRenderer.value,
          optimizeForTouch: enableTouchOptimization.value,
          virtualScrolling: enableVirtualScrolling.value
        },
        buffer: {
          maxLines: 1000,
          cols: 80,
          rows: 24
        },
        performance: {
          targetFPS: parseInt(targetFPS.value),
          enableBatching: true
        },
        theme: {
          background: '#000000',    // 纯黑背景
          foreground: '#00ff00',    // 经典绿色文字
          cursor: '#00ff00',        // 绿色光标
          // ANSI 颜色
          black: '#000000',
          red: '#ff0000',
          green: '#00ff00',
          yellow: '#ffff00',
          blue: '#0000ff',
          magenta: '#ff00ff',
          cyan: '#00ffff',
          white: '#ffffff'
        }
      }
    }
    
    addLog('info', '配置已准备，正在创建实例...')
    
    // 创建引擎实例 - 使用简化版本
    engine.value = createSimpleTerminalEngine(config)
    
    addLog('info', 'Engine实例已创建，绑定事件...')
    
    // 绑定事件监听
    bindEngineEvents()
    
    // Engine就绪处理
    setTimeout(() => {
      if (engine.value && engine.value.state === 'ready') {
        currentRenderer.value = 'websocket-terminal'
        addLog('success', `Terminal Engine就绪，正在连接终端...`)
        engineReady.value = true
      } else {
        addLog('info', '等待Engine就绪...')
        
        setTimeout(() => {
          if (engine.value) {
            currentRenderer.value = 'websocket-terminal'
            addLog('info', '终端连接已建立')
            engineReady.value = true
          }
        }, 1000)
      }
    }, 500)
    
    addLog('info', 'Engine创建完成')
    
  } catch (error) {
    addLog('error', `创建Engine失败: ${error.message}`)
    console.error('Engine creation error:', error)
    
    // 创建fallback显示
    if (terminalContainer.value) {
      terminalContainer.value.innerHTML = `
        <div style="
          background: #000000;
          color: #00ff00;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          padding: 20px;
          height: 400px;
          overflow-y: auto;
          white-space: pre-wrap;
          font-size: 14px;
          line-height: 1.4;
        ">
Terminal Engine 初始化失败，请检查网络连接

Error: ${error.message}
        </div>
      `
      addLog('info', '已启用fallback Terminal显示')
    }
  }
}

/**
 * 绑定Engine事件
 */
function bindEngineEvents() {
  if (!engine.value) return
  
  // 性能监控
  engine.value.on('performance', (metrics) => {
    performanceMetrics.value = metrics
  })
  
  // 状态变化
  engine.value.on('stateChange', ({ state, error }) => {
    addLog('info', `Engine状态: ${state}`)
    if (error) {
      addLog('error', `状态错误: ${error.message}`)
    }
  })
  
  // 渲染错误
  engine.value.on('renderError', (error) => {
    addLog('error', `渲染错误: ${error.message}`)
  })
}

/**
 * 发送欢迎信息（现在由真实终端处理）
 */
function sendWelcomeMessage() {
  // 不再发送静态欢迎信息，让真实的shell处理
  addLog('info', '真实终端已连接，可以输入命令')
}

/**
 * 重新创建Engine
 */
async function recreateEngine() {
  addLog('info', '重新创建Terminal Engine...')
  await createEngine()
}

/**
 * 更新性能配置
 */
function updatePerformance() {
  if (engine.value) {
    // 这里可以动态更新性能配置
    addLog('info', `更新FPS目标: ${targetFPS.value}`)
    recreateEngine()
  }
}

/**
 * 更新功能配置
 */
function updateFeatures() {
  if (engine.value) {
    engine.value.setFeature('virtualScrolling', enableVirtualScrolling.value)
    addLog('info', `虚拟滚动: ${enableVirtualScrolling.value ? '启用' : '禁用'}`)
    
    // 触摸优化需要重新创建引擎
    if (enableTouchOptimization.value !== (deviceInfo.value.type === 'mobile')) {
      recreateEngine()
    }
  }
}

/**
 * 运行性能测试
 */
async function runPerformanceTest() {
  if (!engine.value || testing.value) return
  
  testing.value = true
  addLog('info', '开始性能测试...')
  
  try {
    // 清空终端
    engine.value.clear()
    
    // 测试大量文本输出
    const testText = 'This is a performance test line with some ANSI colors \x1b[31mRED\x1b[0m \x1b[32mGREEN\x1b[0m \x1b[34mBLUE\x1b[0m\n'
    const startTime = performance.now()
    
    // 批量写入1000行
    for (let i = 0; i < 1000; i++) {
      engine.value.write(`[${i.toString().padStart(4, '0')}] ${testText}`)
      
      // 每100行暂停一下，让浏览器响应
      if (i % 100 === 0) {
        await new Promise(resolve => setTimeout(resolve, 10))
      }
    }
    
    const endTime = performance.now()
    const duration = endTime - startTime
    
    addLog('success', `性能测试完成，耗时: ${duration.toFixed(2)}ms`)
    addLog('info', `平均每行: ${(duration / 1000).toFixed(2)}ms`)
    
    // 获取最终性能指标
    const metrics = engine.value.getPerformanceMetrics()
    addLog('info', `最终FPS: ${Math.round(metrics.fps || 0)}`)
    
  } catch (error) {
    addLog('error', `性能测试失败: ${error.message}`)
  } finally {
    testing.value = false
  }
}

/**
 * 清空终端
 */
function clearTerminal() {
  if (engine.value) {
    engine.value.clear()
    addLog('info', '终端已清空')
  }
}

/**
 * 发送测试数据
 */
function sendTestData() {
  if (!engine.value) return
  
  // 简单的测试命令
  engine.value.sendInput('echo "Terminal Engine test"\r')
  addLog('info', '已发送测试命令')
}

/**
 * 切换主题
 */
function toggleTheme() {
  darkTheme.value = !darkTheme.value
  
  const theme = darkTheme.value ? {
    background: '#1e1e1e',
    foreground: '#ffffff',
    cursor: '#ffffff'
  } : {
    background: '#ffffff',
    foreground: '#000000',
    cursor: '#000000'
  }
  
  if (engine.value) {
    engine.value.setTheme(theme)
  }
  
  addLog('info', `切换到${darkTheme.value ? '深色' : '浅色'}主题`)
}

/**
 * 添加测试日志
 */
function addLog(level, message) {
  testLogs.value.push({
    timestamp: Date.now(),
    level,
    message
  })
  
  // 限制日志数量
  if (testLogs.value.length > 100) {
    testLogs.value.shift()
  }
  
  // 滚动到底部
  nextTick(() => {
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight
    }
  })
}

/**
 * 格式化时间
 */
function formatTime(timestamp) {
  const date = new Date(timestamp)
  return date.toLocaleTimeString()
}
</script>

<style scoped>
.terminal-engine-test {
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 16px;
  gap: 16px;
  background-color: #f5f5f5;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

/* 控制栏 */
.control-bar {
  background: white;
  border-radius: 8px;
  padding: 8px 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  transition: all 0.3s ease;
}

.control-bar.collapsed {
  padding: 8px 16px;
}

.control-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.control-header h1 {
  margin: 0;
  color: #333;
  font-size: 18px;
}

.collapse-btn {
  padding: 4px 12px;
  background: #f0f0f0;
  color: #666;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.collapse-btn:hover {
  background: #e0e0e0;
}

.collapsible-content {
  margin-top: 12px;
}

.controls {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.control-group label {
  font-weight: 500;
  color: #555;
  font-size: 12px;
}

.control-group select {
  padding: 2px 6px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
}

.actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.actions button {
  padding: 4px 12px;
  background: #007ACC;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
  font-size: 12px;
}

.actions button:hover:not(:disabled) {
  background: #005999;
}

.actions button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

/* 状态栏 */
.status-bar {
  background: #f8f9fa;
  border-radius: 4px;
  padding: 8px 12px;
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #666;
  flex-wrap: wrap;
}

.status-item {
  font-weight: 500;
}


/* Terminal容器 */
.terminal-container {
  flex: 1;
  background: #000000;
  border-radius: 8px;
  padding: 4px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  min-height: 400px;
}

.terminal-wrapper {
  width: 100%;
  height: 100%;
  border: none;
  border-radius: 4px;
  background: #000000;
}


/* 响应式设计 */
@media (max-width: 768px) {
  .terminal-engine-test {
    padding: 8px;
    gap: 8px;
  }
  
  .controls {
    flex-direction: column;
    gap: 8px;
  }
  
  .terminal-container {
    min-height: 300px;
  }
}
</style>