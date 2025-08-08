<template>
  <div class="vscode-layout" :class="layoutClasses" :style="layoutStyles">
    <!-- Activity Bar (左侧图标栏) -->
    <aside class="activity-bar" v-if="showActivityBar">
      <div class="activity-bar-top">
        <ActivityBarItem
          v-for="item in topActivities"
          :key="item.id"
          :icon="item.icon"
          :tooltip="item.tooltip"
          :active="currentActivity === item.id"
          :badge="item.badge"
          @click="switchActivity(item.id)"
        />
      </div>
      <div class="activity-bar-bottom">
        <ActivityBarItem
          v-for="item in bottomActivities"
          :key="item.id"
          :icon="item.icon"
          :tooltip="item.tooltip"
          :active="currentActivity === item.id"
          @click="switchActivity(item.id)"
        />
      </div>
    </aside>
    
    <!-- Side Bar (侧边栏) -->
    <aside 
      class="side-bar" 
      v-if="showSideBar"
      :style="{ width: sideBarWidth + 'px' }"
    >
      <div class="side-bar-header">
        <span class="side-bar-title">{{ currentSideBarTitle }}</span>
        <div class="side-bar-actions">
          <slot name="sidebar-actions"></slot>
        </div>
      </div>
      <div class="side-bar-content">
        <component 
          :is="currentSideBarComponent" 
          v-bind="currentSideBarProps"
        />
      </div>
    </aside>
    
    <!-- Side Bar Resizer -->
    <div 
      v-if="showSideBar"
      class="resizer vertical"
      @mousedown="startResizeSideBar"
    ></div>
    
    <!-- Main Editor Area -->
    <main class="editor-area">
      <!-- Tab Bar -->
      <div class="tab-bar" v-if="showTabs">
        <div class="tabs-container">
          <EditorTab
            v-for="tab in openTabs"
            :key="tab.id"
            :tab="tab"
            :active="activeTab === tab.id"
            @click="switchTab(tab.id)"
            @close="closeTab(tab.id)"
          />
        </div>
        <div class="tab-actions">
          <slot name="tab-actions"></slot>
        </div>
      </div>
      
      <!-- Breadcrumb -->
      <div class="breadcrumb-bar" v-if="showBreadcrumb">
        <Breadcrumb :items="breadcrumbItems" />
      </div>
      
      <!-- Content Area -->
      <div class="content-area">
        <slot></slot>
      </div>
    </main>
    
    <!-- Secondary Side Bar (右侧边栏) -->
    <aside 
      class="secondary-side-bar"
      v-if="showSecondarySideBar"
      :style="{ width: secondarySideBarWidth + 'px' }"
    >
      <div class="secondary-side-bar-content">
        <slot name="secondary-sidebar"></slot>
      </div>
    </aside>
    
    <!-- Panel (底部面板) -->
    <section 
      class="panel"
      v-if="showPanel"
      :style="{ height: panelHeight + 'px' }"
    >
      <!-- Panel Resizer -->
      <div class="resizer horizontal" @mousedown="startResizePanel"></div>
      
      <!-- Panel Header -->
      <div class="panel-header">
        <div class="panel-tabs">
          <PanelTab
            v-for="tab in panelTabs"
            :key="tab.id"
            :tab="tab"
            :active="activePanelTab === tab.id"
            @click="switchPanelTab(tab.id)"
          />
        </div>
        <div class="panel-actions">
          <button class="panel-action" @click="maximizePanel" title="Maximize">
            <i class="codicon codicon-chevron-up"></i>
          </button>
          <button class="panel-action" @click="closePanel" title="Close">
            <i class="codicon codicon-close"></i>
          </button>
        </div>
      </div>
      
      <!-- Panel Content -->
      <div class="panel-content">
        <component 
          :is="currentPanelComponent"
          v-bind="currentPanelProps"
        />
      </div>
    </section>
    
    <!-- Status Bar -->
    <footer class="status-bar" v-if="showStatusBar">
      <div class="status-bar-left">
        <StatusBarItem
          v-for="item in leftStatusItems"
          :key="item.id"
          :item="item"
          @click="handleStatusItemClick(item)"
        />
      </div>
      <div class="status-bar-right">
        <StatusBarItem
          v-for="item in rightStatusItems"
          :key="item.id"
          :item="item"
          @click="handleStatusItemClick(item)"
        />
      </div>
    </footer>
    
    <!-- Command Palette (命令面板) -->
    <CommandPalette
      v-if="showCommandPalette"
      @close="showCommandPalette = false"
      @execute="executeCommand"
    />
    
    <!-- Quick Open (快速打开) -->
    <QuickOpen
      v-if="showQuickOpen"
      @close="showQuickOpen = false"
      @open="openFile"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, provide } from 'vue'
import ActivityBarItem from './components/ActivityBarItem.vue'
import EditorTab from './components/EditorTab.vue'
import PanelTab from './components/PanelTab.vue'
import StatusBarItem from './components/StatusBarItem.vue'
import Breadcrumb from './components/Breadcrumb.vue'
import CommandPalette from './components/CommandPalette.vue'
import QuickOpen from './components/QuickOpen.vue'

// Props
const props = defineProps({
  // 布局配置
  showActivityBar: { type: Boolean, default: true },
  showSideBar: { type: Boolean, default: true },
  showSecondarySideBar: { type: Boolean, default: false },
  showPanel: { type: Boolean, default: true },
  showStatusBar: { type: Boolean, default: true },
  showTabs: { type: Boolean, default: true },
  showBreadcrumb: { type: Boolean, default: false },
  
  // 尺寸配置
  sideBarDefaultWidth: { type: Number, default: 260 },
  secondarySideBarDefaultWidth: { type: Number, default: 320 },
  panelDefaultHeight: { type: Number, default: 200 },
  
  // 活动栏配置
  topActivities: { type: Array, default: () => [] },
  bottomActivities: { type: Array, default: () => [] },
  
  // 标签配置
  openTabs: { type: Array, default: () => [] },
  activeTab: { type: String, default: null },
  
  // 面板配置
  panelTabs: { type: Array, default: () => [] },
  activePanelTab: { type: String, default: null },
  
  // 状态栏配置
  leftStatusItems: { type: Array, default: () => [] },
  rightStatusItems: { type: Array, default: () => [] },
  
  // 面包屑配置
  breadcrumbItems: { type: Array, default: () => [] }
})

// Emits
const emit = defineEmits([
  'activity-change',
  'tab-change',
  'tab-close',
  'panel-tab-change',
  'panel-close',
  'command-execute',
  'file-open',
  'status-item-click'
])

// State
const currentActivity = ref(props.topActivities[0]?.id || null)
const sideBarWidth = ref(props.sideBarDefaultWidth)
const secondarySideBarWidth = ref(props.secondarySideBarDefaultWidth)
const panelHeight = ref(props.panelDefaultHeight)
const isPanelMaximized = ref(false)
const showCommandPalette = ref(false)
const showQuickOpen = ref(false)

// Resize state
const isResizing = ref(false)
const resizeTarget = ref(null)
const startX = ref(0)
const startY = ref(0)
const startWidth = ref(0)
const startHeight = ref(0)

// Computed
const layoutClasses = computed(() => ({
  'has-activity-bar': props.showActivityBar,
  'has-side-bar': props.showSideBar,
  'has-secondary-side-bar': props.showSecondarySideBar,
  'has-panel': props.showPanel,
  'has-status-bar': props.showStatusBar,
  'panel-maximized': isPanelMaximized.value
}))

const layoutStyles = computed(() => ({
  '--sidebar-width': `${sideBarWidth.value}px`,
  '--secondary-sidebar-width': `${secondarySideBarWidth.value}px`,
  '--panel-height': `${panelHeight.value}px`
}))

const currentSideBarTitle = computed(() => {
  const activity = props.topActivities.find(a => a.id === currentActivity.value)
  return activity?.title || 'EXPLORER'
})

const currentSideBarComponent = computed(() => {
  const activity = props.topActivities.find(a => a.id === currentActivity.value)
  return activity?.component || null
})

const currentSideBarProps = computed(() => {
  const activity = props.topActivities.find(a => a.id === currentActivity.value)
  return activity?.props || {}
})

const currentPanelComponent = computed(() => {
  const tab = props.panelTabs.find(t => t.id === props.activePanelTab)
  return tab?.component || null
})

const currentPanelProps = computed(() => {
  const tab = props.panelTabs.find(t => t.id === props.activePanelTab)
  return tab?.props || {}
})

// Methods
const switchActivity = (id) => {
  currentActivity.value = id
  emit('activity-change', id)
}

const switchTab = (id) => {
  emit('tab-change', id)
}

const closeTab = (id) => {
  emit('tab-close', id)
}

const switchPanelTab = (id) => {
  emit('panel-tab-change', id)
}

const closePanel = () => {
  emit('panel-close')
}

const maximizePanel = () => {
  isPanelMaximized.value = !isPanelMaximized.value
  if (isPanelMaximized.value) {
    panelHeight.value = window.innerHeight - 100
  } else {
    panelHeight.value = props.panelDefaultHeight
  }
}

// Resize handlers
const startResizeSideBar = (e) => {
  isResizing.value = true
  resizeTarget.value = 'sidebar'
  startX.value = e.clientX
  startWidth.value = sideBarWidth.value
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
  document.body.style.cursor = 'col-resize'
  e.preventDefault()
}

const startResizePanel = (e) => {
  isResizing.value = true
  resizeTarget.value = 'panel'
  startY.value = e.clientY
  startHeight.value = panelHeight.value
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
  document.body.style.cursor = 'row-resize'
  e.preventDefault()
}

const handleResize = (e) => {
  if (!isResizing.value) return
  
  if (resizeTarget.value === 'sidebar') {
    const deltaX = e.clientX - startX.value
    const newWidth = Math.min(600, Math.max(200, startWidth.value + deltaX))
    sideBarWidth.value = newWidth
  } else if (resizeTarget.value === 'panel') {
    const deltaY = startY.value - e.clientY
    const newHeight = Math.min(600, Math.max(100, startHeight.value + deltaY))
    panelHeight.value = newHeight
  }
}

const stopResize = () => {
  isResizing.value = false
  resizeTarget.value = null
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
  document.body.style.cursor = ''
  
  // Save sizes to localStorage
  localStorage.setItem('vscode-layout-sidebar-width', sideBarWidth.value)
  localStorage.setItem('vscode-layout-panel-height', panelHeight.value)
}

// Command handlers
const executeCommand = (command) => {
  showCommandPalette.value = false
  emit('command-execute', command)
}

const openFile = (file) => {
  showQuickOpen.value = false
  emit('file-open', file)
}

const handleStatusItemClick = (item) => {
  emit('status-item-click', item)
}

// Keyboard shortcuts
const handleKeydown = (e) => {
  // Ctrl/Cmd + Shift + P: Command Palette
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
    showCommandPalette.value = true
    e.preventDefault()
  }
  
  // Ctrl/Cmd + P: Quick Open
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'p') {
    showQuickOpen.value = true
    e.preventDefault()
  }
  
  // Ctrl/Cmd + B: Toggle Sidebar
  if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
    emit('toggle-sidebar')
    e.preventDefault()
  }
  
  // Ctrl/Cmd + J: Toggle Panel
  if ((e.ctrlKey || e.metaKey) && e.key === 'j') {
    emit('toggle-panel')
    e.preventDefault()
  }
}

// Lifecycle
onMounted(() => {
  // Load saved sizes
  const savedSidebarWidth = localStorage.getItem('vscode-layout-sidebar-width')
  const savedPanelHeight = localStorage.getItem('vscode-layout-panel-height')
  
  if (savedSidebarWidth) sideBarWidth.value = parseInt(savedSidebarWidth)
  if (savedPanelHeight) panelHeight.value = parseInt(savedPanelHeight)
  
  // Add keyboard listeners
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

// Provide layout context
provide('vscode-layout', {
  sideBarWidth,
  panelHeight,
  currentActivity,
  isPanelMaximized
})
</script>

<style scoped>
@import './styles/layout.css';
@import './styles/activity-bar.css';
@import './styles/side-bar.css';
@import './styles/editor-area.css';
@import './styles/panel.css';
@import './styles/status-bar.css';
</style>