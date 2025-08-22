<template>
  <div class="startup-initializer">
    <div class="abstract-container">
      <div class="abstract-bar">
        <div class="fill" :style="{ width: overallProgress + '%' }"></div>
        <div class="shine"></div>
      </div>
      <div class="dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import sseService from '../services/sseService'

// 终端服务现在使用SimpleTerminalEngine，不需要预初始化

const emit = defineEmits(['initialization-complete'])
const router = useRouter()

const initSteps = ref([
  { id: 'backend', title: '后端服务', message: '检查后端服务连接...', status: 'pending', progress: 0 },
  { id: 'terminal', title: '终端服务 & WebSocket', message: '等待初始化...', status: 'pending', progress: 0 },
  { id: 'sse', title: 'SSE事件流', message: '等待初始化...', status: 'pending', progress: 0 },
  { id: 'claude', title: 'Claude AI', message: '等待初始化...', status: 'pending', progress: 0 }
])

const hasError = computed(() => initSteps.value.some(step => step.status === 'error'))
const allCompleted = computed(() => initSteps.value.every(step => step.status === 'completed'))

// 抽象进度（无语义）：按完成步数占比 + 运行中轻微推进
const overallProgress = computed(() => {
  const total = initSteps.value.length || 1
  const completed = initSteps.value.filter(s => s.status === 'completed').length
  const running = initSteps.value.some(s => s.status === 'running') ? 0.35 : 0
  return Math.min(100, Math.round(((completed + running) / total) * 100))
})

// 更新步骤状态
const updateStep = (stepId, updates) => {
  const step = initSteps.value.find(s => s.id === stepId)
  if (step) Object.assign(step, updates)
}

// 检查后端服务
const checkBackend = async () => {
  updateStep('backend', { status: 'running' })
  try {
    const response = await fetch('/api/terminal/health')
    if (response.ok) {
      updateStep('backend', { status: 'completed', progress: 100 })
      return true
    }
    throw new Error('Backend health check failed')
  } catch (error) {
    updateStep('backend', { status: 'error' })
    return false
  }
}

// 初始化终端
const initTerminal = async () => {
  updateStep('terminal', { status: 'running' })
  try {
    const response = await fetch('/api/terminal/health')
    if (!response.ok) throw new Error('Terminal service not available')
    updateStep('terminal', { status: 'completed', progress: 100 })
    return true
  } catch (error) {
    updateStep('terminal', { status: 'error' })
    return false
  }
}

// 连接SSE
const connectSSE = async () => {
  updateStep('sse', { status: 'running' })
  try {
    sseService.connect()
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('SSE connection timeout')), 5000)
      const check = setInterval(() => {
        if (sseService.eventSource && sseService.eventSource.readyState === EventSource.OPEN) {
          clearInterval(check)
          clearTimeout(timeout)
          resolve()
        }
      }, 100)
    })
    updateStep('sse', { status: 'completed', progress: 100 })
    return true
  } catch (error) {
    updateStep('sse', { status: 'error' })
    return false
  }
}

// 初始化Claude（标记为就绪）
const initClaude = async () => {
  updateStep('claude', { status: 'running' })
  try {
    updateStep('claude', { status: 'completed', progress: 100 })
    return true
  } catch (error) {
    updateStep('claude', { status: 'error' })
    return false
  }
}

// 执行初始化序列
const runInitSequence = async () => {
  const backendOk = await checkBackend(); if (!backendOk) return false
  const terminalOk = await initTerminal(); if (!terminalOk) return false
  const sseOk = await connectSSE(); if (!sseOk) return false
  const claudeOk = await initClaude(); if (!claudeOk) { /* 不中断 */ }
  return true
}

// 重试与跳过仍保留（但无UI呈现）
const retry = async () => {
  initSteps.value.forEach(step => { step.status = 'pending'; step.progress = 0 })
  await runInitSequence()
}

const skipInit = () => {
  emit('initialization-complete', { skipped: true })
}

onMounted(async () => {
  const success = await runInitSequence()
  if (success && allCompleted.value) {
    setTimeout(() => emit('initialization-complete', { success: true }), 1200)
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
  background: radial-gradient(1200px 600px at 50% 0%, rgba(88, 166, 255, 0.08), transparent 40%),
              radial-gradient(1000px 500px at 10% 100%, rgba(56, 139, 253, 0.06), transparent 40%),
              #0d1117;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.abstract-container {
  width: min(520px, 80vw);
  padding: 28px 24px;
  border-radius: 16px;
  background: rgba(22, 27, 34, 0.6);
  border: 1px solid rgba(48, 54, 61, 0.8);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.35), inset 0 0 0 1px rgba(255, 255, 255, 0.02);
}

.abstract-bar {
  position: relative;
  height: 10px;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(49,54,61,1), rgba(30,34,39,1));
  overflow: hidden;
}

.fill {
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 0%;
  background: linear-gradient(90deg, #58a6ff, #1f6feb);
  box-shadow: 0 0 18px rgba(31, 111, 235, 0.45);
  transition: width 400ms cubic-bezier(0.22, 1, 0.36, 1);
}

.shine {
  position: absolute;
  top: -40%;
  left: -30%;
  width: 40%;
  height: 200%;
  background: linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.18) 50%, transparent 100%);
  transform: skewX(-20deg);
  animation: slide 2.2s infinite;
}

@keyframes slide { from { left: -30%; } to { left: 130%; } }

.dots {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-top: 18px;
}

.dots span {
  width: 6px; height: 6px; border-radius: 50%;
  background: #30363d;
  animation: pulse 1.2s infinite ease-in-out;
}

.dots span:nth-child(1) { animation-delay: 0s; }
.dots span:nth-child(2) { animation-delay: 0.2s; }
.dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes pulse {
  0%, 100% { transform: scale(0.9); opacity: 0.6; background: #30363d; }
  50% { transform: scale(1.3); opacity: 1; background: #58a6ff; box-shadow: 0 0 10px rgba(88,166,255,0.6); }
}
</style>