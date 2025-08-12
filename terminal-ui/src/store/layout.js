/**
 * 响应式布局状态管理
 * 使用Pinia管理跨设备的布局状态
 */

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useDevice } from '../composables/useDevice.js'

// 移动端Tab类型常量
export const MOBILE_TABS = {
  CREATE: 'create',    // 创建卡片 (对应PC端右边栏)
  FILES: 'files',      // 文件管理 (对应PC端左边栏)
  PREVIEW: 'preview',  // 预览显示 (对应PC端中上区域)
  TERMINAL: 'terminal' // 终端交互 (对应PC端中下区域)
}

// 默认移动端Tab顺序
export const MOBILE_TAB_ORDER = [
  MOBILE_TABS.CREATE,
  MOBILE_TABS.FILES,
  // 移动端不再保留独立预览Tab
  // MOBILE_TABS.PREVIEW,
  MOBILE_TABS.TERMINAL
]

// 布局历史记录项
class LayoutHistoryItem {
  constructor(state, timestamp = Date.now()) {
    this.state = { ...state }
    this.timestamp = timestamp
  }
}

export const useLayoutStore = defineStore('layout', () => {
  // ================================
  // 响应式状态
  // ================================
  
  // 设备检测hook
  const deviceInfo = useDevice()
  
  // 设备状态
  const deviceType = computed(() => deviceInfo.deviceType.value)
  const windowSize = computed(() => ({
    width: deviceInfo.windowWidth.value,
    height: deviceInfo.windowHeight.value
  }))
  const breakpoint = computed(() => deviceInfo.breakpoint.value)
  
  // 侧栏状态 (桌面端和平板端)
  const leftSidebarCollapsed = ref(false)
  const rightSidebarCollapsed = ref(false)
  
  // 移动端Tab状态
  const activeMobileTab = ref(MOBILE_TABS.CREATE) // 默认显示创建卡片Tab
  
  // 全屏状态
  const isFullScreen = ref(false)
  const fullScreenComponent = ref(null)
  
  // 平板端抽屉状态
  const leftDrawerOpen = ref(false)
  const rightDrawerOpen = ref(false)
  
  // 布局历史记录（最多保存10个状态）
  const layoutHistory = ref([])
  const maxHistoryLength = 10
  
  // 布局偏好设置（持久化）
  const preferences = ref({
    // 桌面端偏好
    desktop: {
      leftSidebarWidth: 240,
      rightSidebarWidth: 320,
      rememberSidebarState: true
    },
    // 平板端偏好  
    tablet: {
      autoCollapseDrawers: true,
      drawerSwipeEnabled: true
    },
    // 移动端偏好
    mobile: {
      defaultTab: MOBILE_TABS.FILES,
      swipeEnabled: true,
      rememberLastTab: true
    }
  })
  
  // ================================
  // 计算属性
  // ================================
  
  // 当前布局模式
  const layoutMode = computed(() => {
    const type = deviceType.value
    if (type === 'mobile') return 'mobile'
    if (type === 'tablet') return 'tablet'
    return 'desktop'
  })
  
  // 是否显示左侧栏 (桌面端)
  const shouldShowLeftSidebar = computed(() => {
    return layoutMode.value === 'desktop' && !leftSidebarCollapsed.value
  })
  
  // 是否显示右侧栏 (桌面端)
  const shouldShowRightSidebar = computed(() => {
    return layoutMode.value === 'desktop' && !rightSidebarCollapsed.value
  })
  
  // 移动端当前Tab信息
  const currentMobileTabInfo = computed(() => {
    const tab = activeMobileTab.value
    const tabConfig = {
      [MOBILE_TABS.CREATE]: {
        label: '创建卡片',
        icon: '📝',
        description: '模板选择和卡片创建'
      },
      [MOBILE_TABS.FILES]: {
        label: '文件',
        icon: '📁',
        description: '卡片文件管理'
      },
      [MOBILE_TABS.PREVIEW]: {
        label: '预览',
        icon: '👁️',
        description: '卡片内容预览'
      },
      [MOBILE_TABS.TERMINAL]: {
        label: 'Terminal',
        icon: '💻',
        description: '命令行终端'
      }
    }
    
    return {
      key: tab,
      ...tabConfig[tab],
      index: MOBILE_TAB_ORDER.indexOf(tab)
    }
  })
  
  // 布局CSS类
  const layoutClasses = computed(() => {
    const classes = [
      `layout-${layoutMode.value}`,
      `device-${deviceType.value}`,
      `breakpoint-${breakpoint.value}`
    ]
    
    if (layoutMode.value === 'desktop') {
      if (leftSidebarCollapsed.value) classes.push('left-sidebar-collapsed')
      if (rightSidebarCollapsed.value) classes.push('right-sidebar-collapsed')
    }
    
    if (layoutMode.value === 'tablet') {
      if (leftDrawerOpen.value) classes.push('left-drawer-open')
      if (rightDrawerOpen.value) classes.push('right-drawer-open')
    }
    
    if (layoutMode.value === 'mobile') {
      classes.push(`mobile-tab-${activeMobileTab.value}`)
    }
    
    if (isFullScreen.value) {
      classes.push('layout-fullscreen')
    }
    
    return classes
  })
  
  // 布局CSS变量
  const layoutCSSProperties = computed(() => {
    const props = {
      '--window-width': `${windowSize.value.width}px`,
      '--window-height': `${windowSize.value.height}px`,
      '--device-type': deviceType.value,
      '--layout-mode': layoutMode.value
    }
    
    if (layoutMode.value === 'desktop') {
      props['--left-sidebar-width'] = leftSidebarCollapsed.value 
        ? '60px' 
        : `${preferences.value.desktop.leftSidebarWidth}px`
      props['--right-sidebar-width'] = rightSidebarCollapsed.value 
        ? '0px' 
        : `${preferences.value.desktop.rightSidebarWidth}px`
    }
    
    if (layoutMode.value === 'mobile') {
      props['--mobile-tab-height'] = '60px'
      props['--mobile-view-height'] = 'calc(100vh - 60px)'
    }
    
    return props
  })
  
  // ================================
  // 动作方法
  // ================================
  
  // 保存布局历史
  const saveLayoutHistory = () => {
    const currentState = {
      deviceType: deviceType.value,
      leftSidebarCollapsed: leftSidebarCollapsed.value,
      rightSidebarCollapsed: rightSidebarCollapsed.value,
      activeMobileTab: activeMobileTab.value,
      leftDrawerOpen: leftDrawerOpen.value,
      rightDrawerOpen: rightDrawerOpen.value,
      isFullScreen: isFullScreen.value
    }
    
    const historyItem = new LayoutHistoryItem(currentState)
    layoutHistory.value.push(historyItem)
    
    // 保持历史记录长度
    if (layoutHistory.value.length > maxHistoryLength) {
      layoutHistory.value.shift()
    }
  }
  
  // 恢复布局历史
  const restoreLayoutHistory = (index = -1) => {
    const history = layoutHistory.value
    if (history.length === 0) return false
    
    const targetIndex = index < 0 ? history.length + index : index
    const historyItem = history[targetIndex]
    
    if (!historyItem) return false
    
    const state = historyItem.state
    leftSidebarCollapsed.value = state.leftSidebarCollapsed
    rightSidebarCollapsed.value = state.rightSidebarCollapsed
    activeMobileTab.value = state.activeMobileTab
    leftDrawerOpen.value = state.leftDrawerOpen
    rightDrawerOpen.value = state.rightDrawerOpen
    isFullScreen.value = state.isFullScreen
    
    return true
  }
  
  // 设备自适应
  const adaptToDevice = () => {
    const currentDevice = deviceType.value
    const mode = layoutMode.value
    
    // 保存当前状态到历史记录
    saveLayoutHistory()
    
    // 根据设备类型调整布局
    if (mode === 'mobile') {
      // 移动端: 关闭所有侧栏，显示Tab导航
      leftSidebarCollapsed.value = true
      rightSidebarCollapsed.value = true
      leftDrawerOpen.value = false
      rightDrawerOpen.value = false
      
      // 恢复上次的Tab选择或使用默认Tab
      if (preferences.value.mobile.rememberLastTab) {
        const lastTab = localStorage.getItem('mobile-last-tab')
        if (lastTab && MOBILE_TAB_ORDER.includes(lastTab)) {
          activeMobileTab.value = lastTab
        }
      } else {
        activeMobileTab.value = preferences.value.mobile.defaultTab
      }
    } else if (mode === 'tablet') {
      // 平板端: 自动收起抽屉，保持主内容区域
      if (preferences.value.tablet.autoCollapseDrawers) {
        leftDrawerOpen.value = false
        rightDrawerOpen.value = false
      }
      leftSidebarCollapsed.value = true
      rightSidebarCollapsed.value = true
    } else if (mode === 'desktop') {
      // 桌面端: 恢复侧栏状态
      if (preferences.value.desktop.rememberSidebarState) {
        const leftState = localStorage.getItem('desktop-left-sidebar-collapsed')
        const rightState = localStorage.getItem('desktop-right-sidebar-collapsed')
        
        if (leftState !== null) {
          leftSidebarCollapsed.value = leftState === 'true'
        } else {
          leftSidebarCollapsed.value = false
        }
        
        if (rightState !== null) {
          rightSidebarCollapsed.value = rightState === 'true'
        } else {
          rightSidebarCollapsed.value = false
        }
      } else {
        leftSidebarCollapsed.value = false
        rightSidebarCollapsed.value = false
      }
      
      // 关闭抽屉
      leftDrawerOpen.value = false
      rightDrawerOpen.value = false
    }
  }
  
  // 切换侧栏状态
  const toggleSidebar = (side = 'left') => {
    if (layoutMode.value === 'desktop') {
      if (side === 'left') {
        leftSidebarCollapsed.value = !leftSidebarCollapsed.value
        // 持久化存储
        if (preferences.value.desktop.rememberSidebarState) {
          localStorage.setItem('desktop-left-sidebar-collapsed', leftSidebarCollapsed.value.toString())
        }
      } else if (side === 'right') {
        rightSidebarCollapsed.value = !rightSidebarCollapsed.value
        // 持久化存储
        if (preferences.value.desktop.rememberSidebarState) {
          localStorage.setItem('desktop-right-sidebar-collapsed', rightSidebarCollapsed.value.toString())
        }
      }
    } else if (layoutMode.value === 'tablet') {
      // 平板端切换抽屉
      if (side === 'left') {
        leftDrawerOpen.value = !leftDrawerOpen.value
        // 如果打开左抽屉，关闭右抽屉
        if (leftDrawerOpen.value) {
          rightDrawerOpen.value = false
        }
      } else if (side === 'right') {
        rightDrawerOpen.value = !rightDrawerOpen.value
        // 如果打开右抽屉，关闭左抽屉
        if (rightDrawerOpen.value) {
          leftDrawerOpen.value = false
        }
      }
    }
  }
  
  // 切换移动端Tab
  const switchMobileTab = (tab) => {
    console.log('[LayoutStore] switchMobileTab调用:', { tab, currentTab: activeMobileTab.value, validTabs: MOBILE_TAB_ORDER })
    
    if (!MOBILE_TAB_ORDER.includes(tab)) {
      console.warn(`[LayoutStore] Invalid mobile tab: ${tab}`)
      return false
    }
    
    if (activeMobileTab.value === tab) {
      console.log('[LayoutStore] Tab相同，跳过切换')
      return true
    }
    
    console.log('[LayoutStore] 切换Tab:', `${activeMobileTab.value} -> ${tab}`)
    activeMobileTab.value = tab
    
    // 持久化存储
    if (preferences.value.mobile.rememberLastTab) {
      localStorage.setItem('mobile-last-tab', tab)
      console.log('[LayoutStore] 保存Tab到localStorage:', tab)
    }
    
    console.log('[LayoutStore] Tab切换完成，当前Tab:', activeMobileTab.value)
    return true
  }
  
  // 移动端Tab导航 (下一个/上一个)
  const navigateMobileTab = (direction = 'next') => {
    const currentIndex = MOBILE_TAB_ORDER.indexOf(activeMobileTab.value)
    let nextIndex
    
    if (direction === 'next') {
      nextIndex = (currentIndex + 1) % MOBILE_TAB_ORDER.length
    } else {
      nextIndex = currentIndex === 0 ? MOBILE_TAB_ORDER.length - 1 : currentIndex - 1
    }
    
    return switchMobileTab(MOBILE_TAB_ORDER[nextIndex])
  }
  
  // 全屏模式切换
  const toggleFullScreen = (component = null) => {
    if (isFullScreen.value) {
      // 退出全屏
      isFullScreen.value = false
      fullScreenComponent.value = null
    } else {
      // 进入全屏
      isFullScreen.value = true
      fullScreenComponent.value = component
    }
  }
  
  // 更新偏好设置
  const updatePreferences = (newPreferences) => {
    preferences.value = { ...preferences.value, ...newPreferences }
    // 可以在这里添加持久化存储逻辑
  }
  
  // 重置布局到默认状态
  const resetLayout = () => {
    leftSidebarCollapsed.value = false
    rightSidebarCollapsed.value = false
    activeMobileTab.value = MOBILE_TABS.CREATE
    leftDrawerOpen.value = false
    rightDrawerOpen.value = false
    isFullScreen.value = false
    fullScreenComponent.value = null
    
    // 清除持久化存储
    localStorage.removeItem('desktop-left-sidebar-collapsed')
    localStorage.removeItem('desktop-right-sidebar-collapsed')
    localStorage.removeItem('mobile-last-tab')
  }
  
  // ================================
  // 监听器设置
  // ================================
  
  // 监听设备类型变化，自动适配布局
  watch(
    () => deviceType.value,
    (newType, oldType) => {
      if (newType !== oldType) {
        adaptToDevice()
      }
    }
  )

  // 调试：监听移动端 Tab 切换
  watch(
    () => activeMobileTab.value,
    (newTab, oldTab) => {
      console.log('[LayoutStore] activeMobileTab changed:', { from: oldTab, to: newTab })
    }
  )
  
  // 初始化时适配设备
  adaptToDevice()
  
  // ================================
  // 返回Store接口
  // ================================
  
  return {
    // 状态
    deviceType,
    windowSize,
    breakpoint,
    layoutMode,
    leftSidebarCollapsed,
    rightSidebarCollapsed,
    activeMobileTab,
    isFullScreen,
    fullScreenComponent,
    leftDrawerOpen,
    rightDrawerOpen,
    layoutHistory,
    preferences,
    
    // 计算属性
    shouldShowLeftSidebar,
    shouldShowRightSidebar,
    currentMobileTabInfo,
    layoutClasses,
    layoutCSSProperties,
    
    // 动作
    adaptToDevice,
    toggleSidebar,
    switchMobileTab,
    navigateMobileTab,
    toggleFullScreen,
    updatePreferences,
    resetLayout,
    saveLayoutHistory,
    restoreLayoutHistory,
    
    // 常量
    MOBILE_TABS,
    MOBILE_TAB_ORDER
  }
})