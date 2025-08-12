/**
 * 设备检测组合式API
 * 提供响应式的设备类型检测和窗口尺寸监听
 */

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { breakpointValues, getDeviceType, getCurrentBreakpoint } from '../design-system/tokens/breakpoints.js'

// 全局状态（单例模式）
const globalState = {
  windowWidth: ref(typeof window !== 'undefined' ? window.innerWidth : 1024),
  windowHeight: ref(typeof window !== 'undefined' ? window.innerHeight : 768),
  isListening: false,
  listeners: new Set(),
  resizeHandler: null
}

// 防抖函数
function debounce(func, wait) {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

// 全局resize处理器
function createResizeHandler() {
  return debounce(() => {
    if (typeof window !== 'undefined') {
      const oldWidth = globalState.windowWidth.value
      const newWidth = window.innerWidth
      const newHeight = window.innerHeight
      
      globalState.windowWidth.value = newWidth
      globalState.windowHeight.value = newHeight
      
      console.log('[useDevice] Resize事件触发:', {
        from: { width: oldWidth, height: globalState.windowHeight.value },
        to: { width: newWidth, height: newHeight },
        change: newWidth - oldWidth
      })
    }
  }, 100) // 减少防抖时间，提高响应速度
}

// 开始监听
function startListening() {
  if (globalState.isListening || typeof window === 'undefined') return
  
  console.log('[useDevice] 开始监听窗口resize事件')
  globalState.resizeHandler = createResizeHandler()
  window.addEventListener('resize', globalState.resizeHandler, { passive: true })
  globalState.isListening = true
  
  // 立即执行一次，确保当前状态正确
  if (globalState.resizeHandler) {
    console.log('[useDevice] 立即执行resize检查')
    globalState.resizeHandler()
  }
}

// 停止监听
function stopListening() {
  if (!globalState.isListening || typeof window === 'undefined') return
  
  if (globalState.resizeHandler) {
    window.removeEventListener('resize', globalState.resizeHandler)
    globalState.resizeHandler = null
  }
  globalState.isListening = false
}

// 添加监听器
function addListener(instance) {
  globalState.listeners.add(instance)
  if (globalState.listeners.size === 1) {
    startListening()
  }
}

// 移除监听器
function removeListener(instance) {
  globalState.listeners.delete(instance)
  if (globalState.listeners.size === 0) {
    stopListening()
  }
}

/**
 * 设备检测组合式API
 * @returns {Object} 设备检测相关的响应式状态和计算属性
 */
export function useDevice() {
  // 当前实例标识
  const instanceId = Symbol('useDevice')
  
  // 立即获取当前窗口尺寸（解决F12初始化问题）
  if (typeof window !== 'undefined') {
    globalState.windowWidth.value = window.innerWidth
    globalState.windowHeight.value = window.innerHeight
    console.log('[useDevice] 初始化窗口尺寸:', {
      width: window.innerWidth,
      height: window.innerHeight,
      userAgent: navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop'
    })
  }
  
  // 窗口尺寸（响应式）
  const windowWidth = globalState.windowWidth
  const windowHeight = globalState.windowHeight
  
  // 设备类型计算（响应式）
  const deviceType = computed(() => {
    const type = getDeviceType(windowWidth.value)
    console.log('[useDevice] 设备检测:', {
      windowWidth: windowWidth.value,
      windowHeight: windowHeight.value,
      deviceType: type,
      breakpoints: { mobile: '<768px', tablet: '768px-1023px', desktop: '≥1024px' }
    })
    return type
  })
  
  // 详细断点信息
  const breakpoint = computed(() => {
    return getCurrentBreakpoint(windowWidth.value)
  })
  
  // 设备类型布尔值（便捷检测）
  const isMobile = computed(() => deviceType.value === 'mobile')
  const isTablet = computed(() => deviceType.value === 'tablet')
  const isDesktop = computed(() => deviceType.value === 'desktop')
  
  // 设备方向检测
  const orientation = computed(() => {
    return windowWidth.value > windowHeight.value ? 'landscape' : 'portrait'
  })
  
  // 是否横屏
  const isLandscape = computed(() => orientation.value === 'landscape')
  const isPortrait = computed(() => orientation.value === 'portrait')
  
  // 触摸设备检测
  const isTouchDevice = computed(() => {
    if (typeof window === 'undefined') return false
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0
  })
  
  // 悬停支持检测
  const hasHover = computed(() => {
    if (typeof window === 'undefined') return true
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches
  })
  
  // 设备像素比
  const pixelRatio = computed(() => {
    if (typeof window === 'undefined') return 1
    return window.devicePixelRatio || 1
  })
  
  // 是否高密度屏幕
  const isRetina = computed(() => pixelRatio.value >= 2)
  
  // 屏幕尺寸分类
  const screenSize = computed(() => {
    const width = windowWidth.value
    if (width < breakpointValues.mobileLarge) return 'small'
    if (width < breakpointValues.tablet) return 'medium'
    if (width < breakpointValues.desktop) return 'large'
    return 'xlarge'
  })
  
  // 设备特性检测
  const deviceFeatures = computed(() => ({
    touch: isTouchDevice.value,
    hover: hasHover.value,
    retina: isRetina.value,
    orientation: orientation.value,
    screenSize: screenSize.value,
    pixelRatio: pixelRatio.value
  }))
  
  // 响应式类名计算
  const deviceClasses = computed(() => {
    const classes = [
      `device-${deviceType.value}`,
      `breakpoint-${breakpoint.value}`,
      `orientation-${orientation.value}`,
      `screen-${screenSize.value}`
    ]
    
    if (isTouchDevice.value) classes.push('device-touch')
    if (hasHover.value) classes.push('device-hover')
    if (isRetina.value) classes.push('device-retina')
    
    return classes
  })
  
  // CSS自定义属性对象
  const deviceCSSProperties = computed(() => ({
    '--device-width': `${windowWidth.value}px`,
    '--device-height': `${windowHeight.value}px`,
    '--device-pixel-ratio': pixelRatio.value,
    '--device-type': deviceType.value,
    '--device-orientation': orientation.value
  }))
  
  // 断点检测工具函数
  const matchBreakpoint = (bp) => {
    const width = windowWidth.value
    switch (bp) {
      case 'mobile': return width < breakpointValues.tablet
      case 'tablet': return width >= breakpointValues.tablet && width < breakpointValues.laptop
      case 'desktop': return width >= breakpointValues.laptop
      case 'mobileLarge': return width >= breakpointValues.mobileLarge && width < breakpointValues.tablet
      case 'laptop': return width >= breakpointValues.laptop && width < breakpointValues.desktop
      case 'wide': return width >= breakpointValues.wide
      default: return false
    }
  }
  
  // 媒体查询匹配
  const matchMedia = (query) => {
    if (typeof window === 'undefined') return false
    const mediaQuery = query.startsWith('@media') ? query.slice(6).trim() : query
    return window.matchMedia(mediaQuery).matches
  }
  
  // 获取当前设备的间距配置
  const getDeviceSpacing = () => {
    const device = deviceType.value
    // 这里可以从spacing.js导入相应的配置
    return device
  }
  
  // 生命周期管理
  onMounted(() => {
    addListener(instanceId)
    
    // 初始化时更新窗口尺寸
    if (typeof window !== 'undefined') {
      globalState.windowWidth.value = window.innerWidth
      globalState.windowHeight.value = window.innerHeight
    }
  })
  
  onUnmounted(() => {
    removeListener(instanceId)
  })
  
  // 返回API
  return {
    // 基础状态
    windowWidth,
    windowHeight,
    deviceType,
    breakpoint,
    
    // 设备类型检测
    isMobile,
    isTablet,
    isDesktop,
    
    // 方向检测
    orientation,
    isLandscape,
    isPortrait,
    
    // 设备特性
    isTouchDevice,
    hasHover,
    pixelRatio,
    isRetina,
    screenSize,
    deviceFeatures,
    
    // 样式相关
    deviceClasses,
    deviceCSSProperties,
    
    // 工具函数
    matchBreakpoint,
    matchMedia,
    getDeviceSpacing
  }
}

/**
 * 获取当前设备信息（非响应式）
 * 适用于不需要响应式更新的场景
 */
export function getDeviceInfo() {
  const width = typeof window !== 'undefined' ? window.innerWidth : 1024
  const height = typeof window !== 'undefined' ? window.innerHeight : 768
  
  return {
    width,
    height,
    deviceType: getDeviceType(width),
    breakpoint: getCurrentBreakpoint(width),
    isMobile: width < breakpointValues.tablet,
    isTablet: width >= breakpointValues.tablet && width < breakpointValues.laptop,
    isDesktop: width >= breakpointValues.laptop,
    orientation: width > height ? 'landscape' : 'portrait',
    pixelRatio: typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1
  }
}

/**
 * 设备检测工具类（非Vue组合式API版本）
 * 适用于非Vue环境
 */
export class DeviceDetector {
  constructor() {
    this.listeners = new Set()
    this.updateDeviceInfo()
    
    if (typeof window !== 'undefined') {
      this.resizeHandler = debounce(() => {
        this.updateDeviceInfo()
        this.notifyListeners()
      }, 150)
      
      window.addEventListener('resize', this.resizeHandler, { passive: true })
    }
  }
  
  updateDeviceInfo() {
    const width = typeof window !== 'undefined' ? window.innerWidth : 1024
    const height = typeof window !== 'undefined' ? window.innerHeight : 768
    
    this.width = width
    this.height = height
    this.deviceType = getDeviceType(width)
    this.breakpoint = getCurrentBreakpoint(width)
    this.isMobile = width < breakpointValues.tablet
    this.isTablet = width >= breakpointValues.tablet && width < breakpointValues.laptop
    this.isDesktop = width >= breakpointValues.laptop
    this.orientation = width > height ? 'landscape' : 'portrait'
    this.pixelRatio = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1
  }
  
  addListener(callback) {
    this.listeners.add(callback)
  }
  
  removeListener(callback) {
    this.listeners.delete(callback)
  }
  
  notifyListeners() {
    this.listeners.forEach(callback => callback(this))
  }
  
  destroy() {
    if (this.resizeHandler && typeof window !== 'undefined') {
      window.removeEventListener('resize', this.resizeHandler)
    }
    this.listeners.clear()
  }
}

export default useDevice