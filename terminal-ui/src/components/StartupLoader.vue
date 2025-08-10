<template>
  <div class="startup-loader" v-if="isLoading">
    <div class="loader-container">
      <div class="loader-content">
        <div class="logo">
          <div class="logo-icon">🤖</div>
          <h1 class="logo-text">AI Terminal</h1>
        </div>
        
        <div class="progress-section">
          <div class="step" :class="{ completed: steps.socketConnected, active: currentStep === 'socket' }">
            <div class="step-icon">
              <span v-if="steps.socketConnected">✓</span>
              <span v-else-if="currentStep === 'socket'" class="spinner">⟳</span>
              <span v-else>1</span>
            </div>
            <div class="step-text">
              <div class="step-title">连接服务器</div>
              <div class="step-status">{{ socketStatus }}</div>
            </div>
          </div>
          
          <div class="step" :class="{ completed: steps.claudeInitialized, active: currentStep === 'claude' }">
            <div class="step-icon">
              <span v-if="steps.claudeInitialized">✓</span>
              <span v-else-if="currentStep === 'claude'" class="spinner">⟳</span>
              <span v-else>2</span>
            </div>
            <div class="step-text">
              <div class="step-title">准备环境</div>
              <div class="step-status">{{ claudeStatus }}</div>
            </div>
          </div>
        </div>
        
        <div class="error-section" v-if="error">
          <div class="error-message">
            <span class="error-icon">⚠️</span>
            {{ error }}
          </div>
          <div class="error-actions">
            <button class="retry-btn" @click="retry">重试</button>
            <button class="skip-btn" @click="skipInit">跳过</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

const router = useRouter()
const emit = defineEmits(['initialized'])

// State
const isLoading = ref(true)
const currentStep = ref('socket')
const socketStatus = ref('正在连接...')
const claudeStatus = ref('等待中...')
const error = ref('')

const steps = ref({
  socketConnected: false,
  claudeInitialized: false
})

// Initialize socket connection
const connectSocket = async () => {
  currentStep.value = 'socket'
  socketStatus.value = '正在连接到服务器...'
  
  try {
    console.log('[StartupLoader] Checking backend health...')
    
    // Add timeout to fetch request
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout
    
    const testConnection = await fetch(`/api/terminal/health`, {
      signal: controller.signal,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    }).catch(error => {
      console.error('[StartupLoader] Fetch error:', error)
      return null
    })
    
    clearTimeout(timeoutId)
    
    if (!testConnection) {
      throw new Error('No response from backend server')
    }
    
    const healthData = await testConnection.json().catch(() => null)
    console.log('[StartupLoader] Health check response:', healthData)
    
    if (!testConnection.ok || !healthData?.success) {
      throw new Error('Backend server returned an error')
    }
    
    steps.value.socketConnected = true
    socketStatus.value = '已连接'
    
    console.log('[StartupLoader] Backend server is healthy and reachable')
    return true
  } catch (err) {
    console.error('[StartupLoader] Connection failed:', err)
    socketStatus.value = '连接失败'
    
    if (err.name === 'AbortError') {
      error.value = '连接超时，请检查后端服务是否正常运行'
    } else {
      error.value = '无法连接到后端服务器，请确保后端正在运行 (cd terminal-backend && npm start)'
    }
    
    return false
  }
}

// Prepare for Claude initialization (actual init happens in CardGenerator)
const prepareClaudeInit = async () => {
  currentStep.value = 'claude'
  claudeStatus.value = '准备初始化环境...'
  
  try {
    // Just mark as ready - actual Claude init will happen in CardGenerator
    await new Promise(resolve => setTimeout(resolve, 500))
    
    steps.value.claudeInitialized = true
    claudeStatus.value = '环境已就绪'
    console.log('[StartupLoader] Ready for Claude initialization')
    return true
  } catch (err) {
    console.error('[StartupLoader] Preparation failed:', err)
    claudeStatus.value = '准备失败'
    error.value = '环境准备失败: ' + err.message
    return false
  }
}

// Main initialization process
const initialize = async () => {
  console.log('[StartupLoader] Starting initialization process...')
  
  // Try to connect, but don't block if it fails
  const socketConnected = await connectSocket()
  
  // Even if connection fails, continue with initialization
  if (!socketConnected) {
    console.warn('[StartupLoader] Backend connection failed, continuing anyway...]')
    steps.value.socketConnected = false
    socketStatus.value = '离线模式'
  }
  
  // Step 2: Prepare for Claude initialization
  const claudePrepared = await prepareClaudeInit()
  
  // All steps completed (or skipped)
  console.log('[StartupLoader] Initialization completed (with warnings if any)')
  
  // Hide loader after a short delay
  setTimeout(() => {
    isLoading.value = false
    emit('initialized', {
      socketConnected: socketConnected || false,
      claudeInitialized: claudePrepared || false
    })
  }, 500)
  
  return true
}

// Retry initialization
const retry = async () => {
  error.value = ''
  steps.value = {
    socketConnected: false,
    claudeInitialized: false
  }
  await initialize()
}

// Start initialization on mount
onMounted(() => {
  initialize()
})
</script>

<style scoped>
.startup-loader {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.loader-container {
  width: 100%;
  max-width: 500px;
  padding: 20px;
}

.loader-content {
  background: #252525;
  border-radius: 16px;
  padding: 40px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.logo {
  text-align: center;
  margin-bottom: 40px;
}

.logo-icon {
  font-size: 64px;
  margin-bottom: 10px;
  animation: pulse 2s infinite;
}

.logo-text {
  font-size: 28px;
  font-weight: 600;
  color: #fff;
  margin: 0;
  letter-spacing: 1px;
}

.progress-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.step {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: #2a2a2a;
  border-radius: 8px;
  border: 1px solid #333;
  transition: all 0.3s;
}

.step.active {
  border-color: #4a9eff;
  background: rgba(74, 158, 255, 0.1);
}

.step.completed {
  border-color: #13a10e;
  background: rgba(19, 161, 14, 0.1);
}

.step-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #333;
  color: #888;
  font-size: 18px;
  font-weight: bold;
  flex-shrink: 0;
}

.step.active .step-icon {
  background: #4a9eff;
  color: white;
}

.step.completed .step-icon {
  background: #13a10e;
  color: white;
}

.step-text {
  flex: 1;
}

.step-title {
  font-size: 16px;
  font-weight: 500;
  color: #e0e0e0;
  margin-bottom: 4px;
}

.step-status {
  font-size: 13px;
  color: #888;
}

.step.active .step-status {
  color: #4a9eff;
}

.step.completed .step-status {
  color: #13a10e;
}

.spinner {
  animation: spin 1s linear infinite;
  display: inline-block;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

.error-section {
  margin-top: 20px;
  padding: 16px;
  background: rgba(197, 15, 31, 0.1);
  border: 1px solid #c50f1f;
  border-radius: 8px;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #ff6b6b;
  font-size: 14px;
  margin-bottom: 12px;
}

.error-icon {
  font-size: 20px;
}

.retry-btn {
  width: 100%;
  padding: 10px;
  background: #c50f1f;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.retry-btn:hover {
  background: #e74856;
}
</style>