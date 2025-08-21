<template>
  <div class="split-panel-container" :class="layoutClasses">
    <!-- Main content area -->
    <div class="content-panel" :style="contentStyle">
      <slot></slot>
    </div>
    
    <!-- Splitter -->
    <div 
      v-if="!isCollapsed"
      class="panel-splitter"
      @mousedown="startResize"
      @touchstart="startResize"
    >
      <div class="splitter-handle">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
    
    <!-- Terminal panel -->
    <div 
      class="terminal-panel"
      :style="terminalStyle"
    >
      <!-- Terminal header -->
      <div class="terminal-header">
        <div class="header-tabs">
          <div class="tab active">
            <span class="tab-icon">▶</span>
            <span class="tab-title">Terminal</span>
            <span class="tab-close">×</span>
          </div>
          <div class="tab-add">+</div>
        </div>
        
        <div class="header-actions">
          <button class="action-btn" @click="splitTerminal" title="Split Terminal">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M7 2v12h2V2H7zm-4 0v12h2V2H3zm8 0v12h2V2h-2z"/>
            </svg>
          </button>
          <button class="action-btn" @click="clearTerminal" title="Clear">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M5.5 5.5A.5.5 0 0 1 6 5h4a.5.5 0 0 1 .5.5v5a.5.5 0 0 1-.5.5H6a.5.5 0 0 1-.5-.5v-5z"/>
              <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1z"/>
            </svg>
          </button>
          <button class="action-btn" @click="toggleMaximize" title="Maximize">
            <svg v-if="!isMaximized" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M3 3v10h10V3H3zm9 9H4V4h8v8z"/>
            </svg>
            <svg v-else width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M5 3v2H3v8h8v-2h2V3H5zm6 6H5V5h6v4z"/>
            </svg>
          </button>
          <button class="action-btn" @click="toggleCollapse" title="Toggle Panel">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path v-if="!isCollapsed" d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"/>
              <path v-else d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
            </svg>
          </button>
        </div>
      </div>
      
      <!-- Terminal content -->
      <div class="terminal-body">
        <div class="terminal-toolbar">
          <select class="terminal-select" v-model="selectedShell">
            <option value="bash">bash</option>
            <option value="zsh">zsh</option>
            <option value="powershell">PowerShell</option>
            <option value="cmd">Command Prompt</option>
          </select>
          <div class="terminal-path">~/work/AI_Terminal</div>
          <div class="terminal-status">
            <span class="status-indicator" :class="{ active: isConnected }"></span>
            <span class="status-text">{{ isConnected ? 'Connected' : 'Disconnected' }}</span>
          </div>
        </div>
        
        <div class="terminal-container">
          <TerminalBest 
            ref="terminalRef"
            @connected="handleConnected"
            @disconnected="handleDisconnected"
            @error="handleError"
          />
        </div>
      </div>
      
      <!-- Collapsed state -->
      <div v-if="isCollapsed" class="collapsed-indicator" @click="toggleCollapse">
        <span>Terminal</span>
        <span class="collapsed-badge" v-if="hasActivity">!</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import TerminalBest from './TerminalBest.vue'
import terminalIntegration from '../services/terminalIntegration'

// Props
const props = defineProps({
  layout: {
    type: String,
    default: 'horizontal', // 'horizontal' or 'vertical'
    validator: (value) => ['horizontal', 'vertical'].includes(value)
  },
  defaultSize: {
    type: Number,
    default: 30 // 默认占30%
  },
  minSize: {
    type: Number,
    default: 200 // 最小尺寸(px)
  },
  maxSize: {
    type: Number,
    default: 80 // 最大尺寸(百分比)
  }
})

// Emits
const emit = defineEmits(['connected', 'disconnected', 'error', 'resize'])

// State
const terminalRef = ref(null)
const isConnected = ref(false)
const isCollapsed = ref(false)
const isMaximized = ref(false)
const terminalSize = ref(props.defaultSize)
const isResizing = ref(false)
const startPos = ref(0)
const startSize = ref(0)
const selectedShell = ref('bash')
const hasActivity = ref(false)

// Computed
const layoutClasses = computed(() => ({
  'layout-horizontal': props.layout === 'horizontal',
  'layout-vertical': props.layout === 'vertical',
  'is-collapsed': isCollapsed.value,
  'is-maximized': isMaximized.value,
  'is-resizing': isResizing.value
}))

const contentStyle = computed(() => {
  if (isMaximized.value) {
    return { display: 'none' }
  }
  if (isCollapsed.value) {
    return props.layout === 'horizontal' 
      ? { width: '100%' }
      : { height: '100%' }
  }
  return props.layout === 'horizontal'
    ? { width: `calc(100% - ${terminalSize.value}%)` }
    : { height: `calc(100% - ${terminalSize.value}%)` }
})

const terminalStyle = computed(() => {
  if (isMaximized.value) {
    return { width: '100%', height: '100%' }
  }
  if (isCollapsed.value) {
    return props.layout === 'horizontal'
      ? { width: '48px' }
      : { height: '48px' }
  }
  return props.layout === 'horizontal'
    ? { width: `${terminalSize.value}%` }
    : { height: `${terminalSize.value}%` }
})

// Load saved state
const loadState = () => {
  const savedState = localStorage.getItem('terminal-split-state')
  if (savedState) {
    try {
      const state = JSON.parse(savedState)
      isCollapsed.value = state.isCollapsed || false
      terminalSize.value = state.terminalSize || props.defaultSize
      isMaximized.value = state.isMaximized || false
      selectedShell.value = state.selectedShell || 'bash'
    } catch (e) {
      console.error('Failed to load terminal state:', e)
    }
  }
}

// Save state
const saveState = () => {
  localStorage.setItem('terminal-split-state', JSON.stringify({
    isCollapsed: isCollapsed.value,
    terminalSize: terminalSize.value,
    isMaximized: isMaximized.value,
    selectedShell: selectedShell.value
  }))
}

// Watch state changes
watch([isCollapsed, terminalSize, isMaximized, selectedShell], () => {
  saveState()
})

// Resize handling
const startResize = (e) => {
  if (isMaximized.value) return
  
  isResizing.value = true
  const isHorizontal = props.layout === 'horizontal'
  startPos.value = e.type.includes('mouse') 
    ? (isHorizontal ? e.clientX : e.clientY)
    : (isHorizontal ? e.touches[0].clientX : e.touches[0].clientY)
  startSize.value = terminalSize.value
  
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
  document.addEventListener('touchmove', handleResize)
  document.addEventListener('touchend', stopResize)
  
  document.body.style.userSelect = 'none'
  document.body.style.cursor = isHorizontal ? 'col-resize' : 'row-resize'
  e.preventDefault()
}

const handleResize = (e) => {
  if (!isResizing.value) return
  
  const isHorizontal = props.layout === 'horizontal'
  const currentPos = e.type.includes('mouse')
    ? (isHorizontal ? e.clientX : e.clientY)
    : (isHorizontal ? e.touches[0].clientX : e.touches[0].clientY)
  
  const containerSize = isHorizontal ? window.innerWidth : window.innerHeight
  const deltaPos = startPos.value - currentPos
  const deltaPercent = (deltaPos / containerSize) * 100
  
  let newSize = startSize.value + deltaPercent
  newSize = Math.max(props.minSize / containerSize * 100, newSize)
  newSize = Math.min(props.maxSize, newSize)
  
  terminalSize.value = newSize
  emit('resize', newSize)
}

const stopResize = () => {
  isResizing.value = false
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
  document.removeEventListener('touchmove', handleResize)
  document.removeEventListener('touchend', stopResize)
  document.body.style.userSelect = ''
  document.body.style.cursor = ''
  saveState()
}

// Panel controls
const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value
  if (!isCollapsed.value) {
    nextTick(() => {
      terminalRef.value?.resize()
      ensureConnected()
    })
  }
  hasActivity.value = false
}

const toggleMaximize = () => {
  isMaximized.value = !isMaximized.value
  nextTick(() => {
    terminalRef.value?.resize()
  })
}

const splitTerminal = () => {
  ElMessage.info('Split terminal feature coming soon')
}

const clearTerminal = () => {
  terminalRef.value?.clear()
}

// Connection management
const ensureConnected = async () => {
  if (!terminalIntegration.isReady()) {
    try {
      await terminalIntegration.connect()
      isConnected.value = true
    } catch (error) {
      console.error('Failed to connect terminal:', error)
      ElMessage.error('Terminal connection failed')
    }
  } else {
    isConnected.value = true
  }
}

const handleConnected = () => {
  isConnected.value = true
  emit('connected')
}

const handleDisconnected = () => {
  isConnected.value = false
  emit('disconnected')
}

const handleError = (error) => {
  emit('error', error)
}

// Public methods
const executeCommand = (command) => {
  if (!isConnected.value) {
    ensureConnected().then(() => {
      terminalIntegration.sendCommand(command + '\n')
    })
  } else {
    terminalIntegration.sendCommand(command + '\n')
  }
  
  // Show panel if collapsed
  if (isCollapsed.value) {
    hasActivity.value = true
  }
}

const showPanel = () => {
  if (isCollapsed.value) {
    toggleCollapse()
  }
}

const updateProgress = (value, text) => {
  console.log(`Progress: ${value}% - ${text}`)
}

const completeExecution = () => {
  console.log('Execution completed')
}

// Lifecycle
onMounted(() => {
  loadState()
  if (!isCollapsed.value) {
    ensureConnected()
  }
})

onUnmounted(() => {
  if (isResizing.value) {
    stopResize()
  }
})

// Expose methods
defineExpose({
  executeCommand,
  updateProgress,
  completeExecution,
  clearTerminal,
  showPanel,
  toggleCollapse,
  toggleMaximize
})
</script>

<style scoped>
/* Container */
.split-panel-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  background: #f8f9fa;
}

.layout-horizontal {
  flex-direction: row;
}

.layout-vertical {
  flex-direction: column;
}

/* Content panel */
.content-panel {
  flex: 1;
  overflow: auto;
  background: #ffffff;
}

/* Splitter */
.panel-splitter {
  flex-shrink: 0;
  background: #e1e4e8;
  position: relative;
  user-select: none;
  transition: background 0.2s;
}

.layout-horizontal .panel-splitter {
  width: 4px;
  cursor: col-resize;
}

.layout-vertical .panel-splitter {
  height: 4px;
  cursor: row-resize;
}

.panel-splitter:hover {
  background: #c9ced3;
}

.is-resizing .panel-splitter {
  background: #0969da;
}

.splitter-handle {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  gap: 2px;
}

.layout-horizontal .splitter-handle {
  flex-direction: column;
}

.layout-vertical .splitter-handle {
  flex-direction: row;
}

.splitter-handle span {
  width: 3px;
  height: 3px;
  background: #8b949e;
  border-radius: 50%;
}

/* Terminal panel */
.terminal-panel {
  background: #0d1117;
  display: flex;
  flex-direction: column;
  position: relative;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.is-collapsed .terminal-panel {
  overflow: hidden;
}

/* Terminal header */
.terminal-header {
  height: 36px;
  background: #161b22;
  border-bottom: 1px solid #30363d;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
  flex-shrink: 0;
}

.header-tabs {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: 1;
}

.tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: transparent;
  color: #8b949e;
  font-size: 12px;
  cursor: pointer;
  border-radius: 6px 6px 0 0;
  transition: all 0.2s;
  position: relative;
}

.tab.active {
  background: #0d1117;
  color: #f0f6fc;
}

.tab:hover:not(.active) {
  background: rgba(139, 148, 158, 0.1);
}

.tab-icon {
  font-size: 10px;
  opacity: 0.7;
}

.tab-close {
  opacity: 0;
  transition: opacity 0.2s;
  font-size: 16px;
  line-height: 1;
  padding: 0 2px;
}

.tab:hover .tab-close {
  opacity: 0.7;
}

.tab-close:hover {
  opacity: 1 !important;
  color: #f85149;
}

.tab-add {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #8b949e;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.tab-add:hover {
  background: rgba(139, 148, 158, 0.1);
  color: #f0f6fc;
}

.header-actions {
  display: flex;
  gap: 4px;
}

.action-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: #8b949e;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.action-btn:hover {
  background: rgba(139, 148, 158, 0.1);
  color: #f0f6fc;
}

/* Terminal body */
.terminal-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.terminal-toolbar {
  height: 32px;
  background: #010409;
  border-bottom: 1px solid #30363d;
  display: flex;
  align-items: center;
  padding: 0 12px;
  gap: 12px;
  font-size: 12px;
}

.terminal-select {
  background: #0d1117;
  border: 1px solid #30363d;
  color: #f0f6fc;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  outline: none;
}

.terminal-select:hover {
  border-color: #8b949e;
}

.terminal-path {
  flex: 1;
  color: #8b949e;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
}

.terminal-status {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #8b949e;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #f85149;
  transition: all 0.3s;
}

.status-indicator.active {
  background: #3fb950;
  box-shadow: 0 0 4px #3fb950;
}

.status-text {
  font-size: 11px;
}

.terminal-container {
  flex: 1;
  overflow: hidden;
  position: relative;
}

/* Collapsed indicator */
.collapsed-indicator {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  background: #0d1117;
  color: #8b949e;
  font-size: 12px;
  transition: all 0.2s;
}

.layout-horizontal .collapsed-indicator {
  writing-mode: vertical-rl;
  text-orientation: mixed;
}

.collapsed-indicator:hover {
  background: #161b22;
  color: #f0f6fc;
}

.collapsed-badge {
  width: 16px;
  height: 16px;
  background: #f85149;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: bold;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.1); opacity: 0.8; }
}

/* Dark theme adjustments */
#terminal-content {
  padding: 8px;
}

/* Animations */
.terminal-panel {
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

.layout-vertical .terminal-panel {
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

/* Responsive */
@media (max-width: 768px) {
  .terminal-header {
    height: 32px;
  }
  
  .tab {
    padding: 4px 8px;
    font-size: 11px;
  }
  
  .action-btn {
    width: 24px;
    height: 24px;
  }
  
  .terminal-toolbar {
    height: 28px;
    font-size: 11px;
  }
}
</style>