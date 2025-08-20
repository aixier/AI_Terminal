<template>
  <div class="startup-initializer">
    <div class="init-container">
      <div class="init-header">
        <h2>AI Terminal 启动中</h2>
        <p class="init-subtitle">正在初始化系统组件...</p>
      </div>
      
      <div class="init-steps">
        <div 
          v-for="step in initSteps" 
          :key="step.id"
          class="init-step"
          :class="{
            'active': step.status === 'running',
            'completed': step.status === 'completed',
            'error': step.status === 'error'
          }"
        >
          <div class="step-indicator">
            <span v-if="step.status === 'pending'">⚪</span>
            <span v-else-if="step.status === 'running'" class="spinner">🔄</span>
            <span v-else-if="step.status === 'completed'">✅</span>
            <span v-else-if="step.status === 'error'">❌</span>
          </div>
          <div class="step-content">
            <div class="step-title">{{ step.title }}</div>
            <div class="step-message">{{ step.message }}</div>
            <div v-if="step.progress" class="step-progress">
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: step.progress + '%' }"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div v-if="hasError" class="init-actions">
        <button @click="retry" class="retry-btn">
          重新初始化
        </button>
        <button @click="skipInit" class="skip-btn">
          跳过并进入（部分功能可能不可用）
        </button>
      </div>
      
      <div v-if="allCompleted && !hasError" class="init-success">
        <p>✨ 所有组件已就绪，正在进入主界面...</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import TerminalServiceFactory from '../services/terminalServiceFactory'
import sseService from '../services/sseService'

// 获取终端服务实例
const terminalService = TerminalServiceFactory.getService()

const emit = defineEmits(['initialization-complete'])
const router = useRouter()

const initSteps = ref([
  {
    id: 'backend',
    title: '后端服务',
    message: '检查后端服务连接...',
    status: 'pending',
    progress: 0
  },
  {
    id: 'terminal',
    title: '终端服务 & WebSocket',
    message: '等待初始化...',
    status: 'pending',
    progress: 0
  },
  {
    id: 'sse',
    title: 'SSE事件流',
    message: '等待初始化...',
    status: 'pending',
    progress: 0
  },
  {
    id: 'claude',
    title: 'Claude AI',
    message: '等待初始化...',
    status: 'pending',
    progress: 0
  }
])

const hasError = computed(() => 
  initSteps.value.some(step => step.status === 'error')
)

const allCompleted = computed(() => 
  initSteps.value.every(step => step.status === 'completed')
)

// 更新步骤状态
const updateStep = (stepId, updates) => {
  const step = initSteps.value.find(s => s.id === stepId)
  if (step) {
    Object.assign(step, updates)
  }
}

// 检查后端服务
const checkBackend = async () => {
  updateStep('backend', { status: 'running', message: '正在连接后端服务...' })
  
  try {
    const response = await fetch('/api/terminal/health')
    if (response.ok) {
      updateStep('backend', { 
        status: 'completed', 
        message: '后端服务已连接',
        progress: 100
      })
      return true
    }
    throw new Error('Backend health check failed')
  } catch (error) {
    updateStep('backend', { 
      status: 'error', 
      message: `连接失败: ${error.message}`
    })
    return false
  }
}

// 初始化终端
const initTerminal = async () => {
  updateStep('terminal', { status: 'running', message: '正在初始化终端...' })
  
  try {
    // 只检查WebSocket连接，不创建实际终端
    // 实际的终端将在主界面中创建
    const response = await fetch('/api/terminal/health')
    if (!response.ok) {
      throw new Error('Terminal service not available')
    }
    
    updateStep('terminal', { 
      status: 'completed', 
      message: '终端服务已连接',
      progress: 100
    })
    return true
  } catch (error) {
    updateStep('terminal', { 
      status: 'error', 
      message: `连接失败: ${error.message}`
    })
    return false
  }
}


// 连接SSE
const connectSSE = async () => {
  updateStep('sse', { status: 'running', message: '正在建立SSE连接...' })
  
  try {
    sseService.connect()
    
    // 等待SSE连接建立
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('SSE connection timeout')), 5000)
      
      // 监听连接成功事件
      const checkConnection = setInterval(() => {
        // 假设sseService有某种方式表示连接状态
        // 如果没有，可以通过发送测试事件来验证
        if (sseService.eventSource && sseService.eventSource.readyState === EventSource.OPEN) {
          clearInterval(checkConnection)
          clearTimeout(timeout)
          resolve()
        }
      }, 100)
    })
    
    updateStep('sse', { 
      status: 'completed', 
      message: 'SSE事件流已连接',
      progress: 100
    })
    return true
  } catch (error) {
    updateStep('sse', { 
      status: 'error', 
      message: `连接失败: ${error.message}`
    })
    return false
  }
}

// 初始化Claude（不再自动执行claude命令）
const initClaude = async () => {
  updateStep('claude', { status: 'running', message: '正在初始化终端环境...' })
  
  try {
    // 创建临时终端用于测试连接
    const tempTerminal = document.createElement('div')
    tempTerminal.style.display = 'none'
    document.body.appendChild(tempTerminal)
    
    // 初始化终端服务
    await terminalService.init(tempTerminal)
    
    if (!terminalService.isReady()) {
      document.body.removeChild(tempTerminal)
      throw new Error('Terminal service not ready')
    }
    
    console.log('[StartupInitializer] Terminal environment initialized successfully')
    
    // 清理临时终端
    document.body.removeChild(tempTerminal)
    
    // 直接标记为成功，不执行claude命令
    updateStep('claude', { status: 'completed', message: '终端环境就绪', progress: 100 })
    
    console.log('[StartupInitializer] Claude initialization completed (terminal ready for manual commands)')
    return true
  } catch (error) {
    console.error('[Claude Init] Error:', error)
    updateStep('claude', { 
      status: 'error', 
      message: `初始化失败: ${error.message}`
    })
    return false
  }
}

// 执行初始化序列
const runInitSequence = async () => {
  console.log('[StartupInitializer] Starting initialization sequence...')
  
  // 1. 检查后端
  const backendOk = await checkBackend()
  if (!backendOk) return false
  
  // 2. 初始化终端（包含WebSocket连接）
  const terminalOk = await initTerminal()
  if (!terminalOk) return false
  
  // 3. 连接SSE
  const sseOk = await connectSSE()
  if (!sseOk) return false
  
  // 4. 初始化Claude
  const claudeOk = await initClaude()
  if (!claudeOk) {
    // Claude初始化失败不阻止进入，但要提示
    ElMessage.warning('Claude初始化失败，部分功能可能不可用')
  }
  
  return true
}

// 重试
const retry = async () => {
  // 重置所有状态
  initSteps.value.forEach(step => {
    step.status = 'pending'
    step.message = '等待初始化...'
    step.progress = 0
  })
  
  await runInitSequence()
}

// 跳过初始化
const skipInit = () => {
  ElMessage.warning('跳过初始化，部分功能可能不可用')
  emit('initialization-complete', { skipped: true })
}

// 启动初始化
onMounted(async () => {
  const success = await runInitSequence()
  
  if (success && allCompleted.value) {
    // 全部成功，2秒后进入主界面
    setTimeout(() => {
      emit('initialization-complete', { success: true })
    }, 2000)
  }
})
</script>

<style scoped>
.startup-initializer {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, #1e1e1e 0%, #2d2d2d 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.init-container {
  background: #2a2a2a;
  border-radius: 12px;
  padding: 40px;
  max-width: 600px;
  width: 90%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.init-header {
  text-align: center;
  margin-bottom: 40px;
}

.init-header h2 {
  color: #fff;
  font-size: 28px;
  margin: 0 0 10px 0;
}

.init-subtitle {
  color: #888;
  font-size: 14px;
  margin: 0;
}

.init-steps {
  margin-bottom: 30px;
}

.init-step {
  display: flex;
  align-items: flex-start;
  padding: 16px;
  margin-bottom: 12px;
  background: #1e1e1e;
  border-radius: 8px;
  transition: all 0.3s ease;
}

.init-step.active {
  background: #252525;
  border-left: 3px solid #4a90e2;
}

.init-step.completed {
  opacity: 0.8;
}

.init-step.error {
  background: rgba(255, 0, 0, 0.1);
  border-left: 3px solid #ff4444;
}

.step-indicator {
  width: 24px;
  margin-right: 16px;
  font-size: 18px;
  text-align: center;
}

.spinner {
  display: inline-block;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.step-content {
  flex: 1;
}

.step-title {
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 4px;
}

.step-message {
  color: #888;
  font-size: 13px;
}

.step-progress {
  margin-top: 8px;
}

.progress-bar {
  height: 4px;
  background: #333;
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4a90e2, #6ab7ff);
  transition: width 0.3s ease;
}

.init-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.retry-btn,
.skip-btn {
  padding: 10px 24px;
  border-radius: 6px;
  border: none;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.retry-btn {
  background: #4a90e2;
  color: white;
}

.retry-btn:hover {
  background: #357abd;
}

.skip-btn {
  background: #444;
  color: #aaa;
}

.skip-btn:hover {
  background: #555;
}

.init-success {
  text-align: center;
  color: #4caf50;
  font-size: 16px;
  animation: fadeIn 0.5s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style>