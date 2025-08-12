<template>
  <div class="mobile-tab-navigation" :class="navigationClasses">
    <!-- 调试信息 -->
    <div class="debug-tab-info">
      <p>[TabNavigation] 组件渲染</p>
      <p>Tabs数量: {{ tabs.length }}</p>
      <p>当前Tab: {{ activeTab }}</p>
    </div>
    
    <!-- Tab导航栏 -->
    <div class="tab-bar" :style="tabBarStyle">
      <div class="tab-container">
        <div class="tab-list" role="tablist">
          <!-- 四个主要Tab项 -->
          <button
            v-for="tab in tabs"
            :key="tab.key"
            :class="getTabClasses(tab)"
            :aria-selected="isActive(tab.key)"
            role="tab"
            @click="handleTabClick(tab.key)"
            @touchstart="handleTouchStart"
            @touchend="handleTouchEnd"
          >
            <!-- Tab图标 -->
            <div class="tab-icon" :class="{ 'has-badge': tab.badge > 0 }">
              <span class="icon-emoji">{{ tab.icon }}</span>
              <!-- 徽章指示器 -->
              <div v-if="tab.badge > 0" class="tab-badge">
                <span class="badge-count">{{ formatBadgeCount(tab.badge) }}</span>
              </div>
            </div>
            
            <!-- Tab文字标签 -->
            <div class="tab-label">
              <span class="label-text">{{ tab.label }}</span>
            </div>
            
            <!-- 活跃指示器 -->
            <div v-if="isActive(tab.key)" class="tab-indicator"></div>
          </button>
        </div>
        
        <!-- 滑动指示条 -->
        <div 
          class="slide-indicator" 
          :style="indicatorStyle"
        ></div>
      </div>
    </div>
    
    <!-- 安全区域占位 -->
    <div class="safe-area-spacer"></div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useLayoutStore, MOBILE_TABS } from '../../store/layout.js'
import { useDevice } from '../../composables/useDevice.js'
import { touchMixin } from '../../mixins/responsive.js'

// Props
const props = defineProps({
  // 是否启用滑动切换
  swipeEnabled: {
    type: Boolean,
    default: true
  },
  // 是否显示徽章
  showBadges: {
    type: Boolean,
    default: true
  },
  // 自定义Tab配置
  customTabs: {
    type: Array,
    default: () => []
  }
})

// Emits
const emits = defineEmits([
  'tab-change',
  'tab-swipe',
  'tab-long-press'
])

// 组合式API
const layout = useLayoutStore()
const device = useDevice()
const touch = touchMixin.setup()

console.log('[TabNavigation] 组件初始化:', {
  layout: !!layout,
  device: !!device,
  touch: !!touch,
  isMobile: device?.isMobile?.value
})

// 响应式状态
const tabBarRef = ref(null)
const isTransitioning = ref(false)
const touchStartX = ref(0)
const currentSwipeOffset = ref(0)

// Tab配置
const tabs = computed(() => {
  if (props.customTabs.length > 0) {
    return props.customTabs
  }
  
  return [
    {
      key: MOBILE_TABS.CREATE,
      label: '创建卡片',
      icon: '📝',
      description: '模板选择和卡片创建',
      badge: 0  // 可以根据实际需要设置徽章数量
    },
    {
      key: MOBILE_TABS.FILES,
      label: '文件',
      icon: '📁', 
      description: '卡片文件管理和浏览',
      badge: 0
    },
    {
      key: MOBILE_TABS.TERMINAL,
      label: 'Terminal',
      icon: '💻',
      description: '命令行终端交互',
      badge: 0
    }
  ]
})

// 当前活跃Tab（注意：返回字符串值，而不是ref本身）
const activeTab = computed(() => layout.activeMobileTab.value)

// 导航样式类
const navigationClasses = computed(() => [
  'mobile-navigation',
  `active-tab-${activeTab.value}`,
  {
    'navigation-transitioning': isTransitioning.value,
    'swipe-enabled': props.swipeEnabled,
    'has-safe-area': device.isMobile.value
  }
])

// Tab栏样式
const tabBarStyle = computed(() => ({
  '--tab-count': tabs.value.length,
  '--active-tab-index': getActiveTabIndex(),
  '--swipe-offset': `${currentSwipeOffset.value}px`
}))

// 滑动指示条样式
const indicatorStyle = computed(() => {
  const activeIndex = getActiveTabIndex()
  const tabWidth = 100 / tabs.value.length
  
  return {
    width: `${tabWidth}%`,
    transform: `translateX(${activeIndex * 100}%)`,
    transition: isTransitioning.value ? 'transform 300ms ease-out' : 'none'
  }
})

// 计算方法
const isActive = (tabKey) => {
  return activeTab.value === tabKey
}

const getActiveTabIndex = () => {
  return tabs.value.findIndex(tab => tab.key === activeTab.value)
}

const getTabClasses = (tab) => [
  'tab-item',
  {
    'tab-active': isActive(tab.key),
    'tab-has-badge': props.showBadges && tab.badge > 0,
    'tab-transitioning': isTransitioning.value
  }
]

const formatBadgeCount = (count) => {
  if (count > 99) return '99+'
  if (count > 0) return count.toString()
  return ''
}

// 事件处理
const handleTabClick = async (tabKey) => {
  console.log('[TabNavigation] Tab点击:', { tabKey, currentTab: activeTab.value, isTransitioning: isTransitioning.value })
  if (tabKey === activeTab.value) return
  if (isTransitioning.value) return
  isTransitioning.value = true
  console.log('[TabNavigation] 开始切换Tab:', `${activeTab.value} -> ${tabKey}`)
  try {
    const result = layout.switchMobileTab(tabKey)
    console.log('[TabNavigation] switchMobileTab结果:', result)
    const eventData = { from: activeTab.value, to: tabKey, tabInfo: tabs.value.find(t => t.key === tabKey) }
    emits('tab-change', eventData)
    await nextTick()
    setTimeout(() => { 
      isTransitioning.value = false 
      console.log('[TabNavigation] 切换完成，当前 activeTab:', activeTab.value)
    }, 300)
  } catch (error) {
    console.error('[TabNavigation] Tab切换失败:', error)
    isTransitioning.value = false
  }
}

// 触摸事件处理
const handleTouchStart = (event) => {
  if (!props.swipeEnabled) return
  
  touchStartX.value = event.touches[0].clientX
  touch.handleTouchStart(event)
}

const handleTouchEnd = (event) => {
  if (!props.swipeEnabled) return
  
  touch.handleTouchEnd(event)
  
  const swipeDirection = touch.getSwipeDirection()
  const swipeDistance = touch.getSwipeDistance()
  
  // 长按检测
  if (touch.isLongPress()) {
    const target = event.target.closest('.tab-item')
    if (target) {
      const tabKey = tabs.value[Array.from(target.parentElement.children).indexOf(target)].key
      emits('tab-long-press', { tabKey, event })
    }
    return
  }
  
  // 滑动切换检测
  if (swipeDirection && Math.abs(swipeDistance.deltaX) > 50) {
    handleSwipeGesture(swipeDirection)
  }
  
  // 重置滑动偏移
  currentSwipeOffset.value = 0
}

// 滑动手势处理
const handleSwipeGesture = (direction) => {
  if (isTransitioning.value) return
  console.log('[TabNavigation] Swipe gesture:', direction)
  const currentIndex = getActiveTabIndex()
  let targetIndex = currentIndex
  if (direction === 'left' && currentIndex < tabs.value.length - 1) targetIndex = currentIndex + 1
  else if (direction === 'right' && currentIndex > 0) targetIndex = currentIndex - 1
  if (targetIndex !== currentIndex) {
    const targetTab = tabs.value[targetIndex]
    console.log('[TabNavigation] Swipe跳转 ->', targetTab.key)
    handleTabClick(targetTab.key)
    emits('tab-swipe', { direction, from: currentIndex, to: targetIndex, tabKey: targetTab.key })
  }
}

// 键盘导航支持
const handleKeydown = (event) => {
  const currentIndex = getActiveTabIndex()
  let targetIndex = currentIndex
  
  switch (event.key) {
    case 'ArrowLeft':
      targetIndex = Math.max(0, currentIndex - 1)
      break
    case 'ArrowRight':
      targetIndex = Math.min(tabs.value.length - 1, currentIndex + 1)
      break
    case 'Home':
      targetIndex = 0
      break
    case 'End':
      targetIndex = tabs.value.length - 1
      break
    default:
      return
  }
  
  if (targetIndex !== currentIndex) {
    event.preventDefault()
    handleTabClick(tabs.value[targetIndex].key)
  }
}

// 生命周期
onMounted(() => { 
  console.log('[TabNavigation] mounted. activeTab:', activeTab.value)
  document.addEventListener('keydown', handleKeydown) 
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
/* ===========================
   移动端Tab导航基础样式
   =========================== */

.debug-tab-info {
  display: none;
}

.mobile-tab-navigation {
  display: flex;
  flex-direction: column;
  background-color: var(--color-bg-default, #161b22);
  border-top: 1px solid var(--color-border-default, #30363d);
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  width: 100%;
  z-index: var(--z-fixed, 1000);
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.3);
}

.tab-bar {
  height: var(--spacing-mobile-tabbar, 60px);
  position: relative;
  overflow: hidden;
}

.tab-container {
  width: 100%;
  height: 100%;
  position: relative;
}

.tab-list {
  display: flex;
  height: 100%;
  width: 100%;
  margin: 0;
  padding: 0;
  gap: 0;
}

/* ===========================
   Tab项样式
   =========================== */

.tab-item {
  flex: 1 1 0;     /* 关键：确保等分并允许收缩 */
  min-width: 0;     /* 关键：允许内容在小屏下收缩 */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  min-height: var(--spacing-mobile-touch-target, 44px);
  color: var(--color-text-secondary, #8b949e);
  transition: all var(--duration-fast, 200ms) ease-out;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.tab-item:focus {
  outline: none;
  background-color: rgba(88, 166, 255, 0.1);
}

.tab-item:active {
  transform: scale(0.95);
  background-color: rgba(88, 166, 255, 0.05);
}

/* 活跃Tab样式 */
.tab-active {
  color: var(--color-brand-primary, #58a6ff) !important;
}

.tab-active .tab-icon {
  transform: scale(1.1);
}

.tab-active .tab-label {
  font-weight: var(--font-weight-medium, 500);
}

/* ===========================
   Tab图标样式
   =========================== */

.tab-icon {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin-bottom: 2px;
  transition: transform var(--duration-fast, 200ms) ease-out;
}

.icon-emoji {
  font-size: 18px;
  line-height: 1;
  display: block;
}

/* 徽章样式 */
.tab-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  min-width: 16px;
  height: 16px;
  background-color: var(--color-error, #f85149);
  border-radius: var(--radius-full, 50%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}

.badge-count {
  color: white;
  font-size: 10px;
  font-weight: var(--font-weight-bold, 700);
  line-height: 1;
  padding: 0 4px;
}

.has-badge {
  overflow: visible;
}

/* ===========================
   Tab文字标签样式
   =========================== */

.tab-label {
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  max-width: 100%;
}

.label-text {
  font-size: var(--font-size-xs, 11px);
  line-height: 1.2;
  font-weight: var(--font-weight-normal, 400);
  transition: font-weight var(--duration-fast, 200ms);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ===========================
   活跃指示器
   =========================== */

.tab-indicator {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 20px;
  height: 3px;
  background-color: var(--color-brand-primary, #58a6ff);
  border-radius: var(--radius-sm, 3px) var(--radius-sm, 3px) 0 0;
  animation: indicatorSlideIn 200ms ease-out;
}

@keyframes indicatorSlideIn {
  from { opacity: 0; transform: translateX(-50%) scale(0.8); }
  to { opacity: 1; transform: translateX(-50%) scale(1); }
}

/* ===========================
   滑动指示条
   =========================== */

.slide-indicator {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--color-brand-primary, #58a6ff) 20%, var(--color-brand-primary, #58a6ff) 80%, transparent);
  transition: transform 300ms cubic-bezier(0.4, 0, 0.2, 1);
  opacity: 0.8;
}

/* ===========================
   安全区域适配
   =========================== */

.safe-area-spacer {
  height: var(--spacing-mobile-safe-area, env(safe-area-inset-bottom));
  background-color: var(--color-bg-default, #161b22);
}

/* ===========================
   过渡动画
   =========================== */

.navigation-transitioning .tab-item { pointer-events: none; }
.navigation-transitioning .slide-indicator { transition: transform 300ms cubic-bezier(0.4, 0, 0.2, 1); }

/* ===========================
   滑动手势支持
   =========================== */

.swipe-enabled .tab-list { touch-action: pan-y; }
.swipe-enabled .tab-item { transition: transform var(--duration-fast, 200ms) ease-out; }

/* ===========================
   响应式优化
   =========================== */

@media (max-width: 380px) {
  .label-text { font-size: 10px; }
  .icon-emoji { font-size: 16px; }
  .tab-badge { min-width: 14px; height: 14px; top: -5px; right: -5px; }
  .badge-count { font-size: 9px; }
}

/* 横屏优化 */
@media (orientation: landscape) and (max-height: 500px) {
  .tab-bar { height: 50px; }
  .tab-item { padding: 2px 4px; }
  .tab-icon { margin-bottom: 1px; }
  .icon-emoji { font-size: 16px; }
  .label-text { font-size: 10px; }
}

/* 触摸设备优化 */
@media (hover: none) and (pointer: coarse) {
  .tab-item { min-height: var(--spacing-mobile-touch-target, 44px); }
  .tab-item:hover { background-color: transparent; }
  .tab-item:active { background-color: rgba(88, 166, 255, 0.1); }
}

/* 高密度屏幕优化 */
@media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 2dppx) {
  .tab-indicator, .slide-indicator { height: 3px; }
  .mobile-tab-navigation { border-top-width: 0.5px; }
}

/* 暗色模式适配 */
@media (prefers-color-scheme: dark) {
  .mobile-tab-navigation { background-color: var(--color-bg-default, #161b22); border-top-color: var(--color-border-default, #30363d); }
  .tab-item { color: var(--color-text-secondary, #8b949e); }
  .tab-active { color: var(--color-brand-primary, #58a6ff); }
}

/* 减少动画 */
@media (prefers-reduced-motion: reduce) {
  .tab-item, .tab-icon, .slide-indicator, .tab-indicator { transition: none; }
  .tab-indicator { animation: none; }
}
</style>