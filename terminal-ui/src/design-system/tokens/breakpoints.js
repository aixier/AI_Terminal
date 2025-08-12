/**
 * 响应式断点系统
 * 为AI Terminal提供多端适配支持
 */

// 断点定义
export const breakpoints = {
  // 移动端断点
  mobile: '320px',
  mobileLarge: '425px',
  
  // 平板端断点  
  tablet: '768px',
  laptop: '1024px',
  
  // 桌面端断点
  desktop: '1440px',
  wide: '1920px'
}

// 数值断点 (用于JavaScript计算)
export const breakpointValues = {
  mobile: 320,
  mobileLarge: 425,
  tablet: 768,
  laptop: 1024,
  desktop: 1440,
  wide: 1920
}

// 媒体查询对象
export const media = {
  // 基础断点查询
  mobile: `@media (max-width: ${breakpointValues.tablet - 1}px)`,
  tablet: `@media (min-width: ${breakpointValues.tablet}px) and (max-width: ${breakpointValues.laptop - 1}px)`,
  desktop: `@media (min-width: ${breakpointValues.laptop}px)`,
  
  // 特殊查询
  touch: '@media (hover: none) and (pointer: coarse)',
  hover: '@media (hover: hover) and (pointer: fine)',
  
  // 高密度屏幕
  retina: '@media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 2dppx)',
  
  // 方向查询
  portrait: '@media (orientation: portrait)',
  landscape: '@media (orientation: landscape)',
  
  // 具体尺寸范围
  mobileOnly: `@media (max-width: ${breakpointValues.mobileLarge}px)`,
  tabletUp: `@media (min-width: ${breakpointValues.tablet}px)`,
  desktopUp: `@media (min-width: ${breakpointValues.laptop}px)`
}

// 设备类型判断工具函数
export function getDeviceType(width) {
  if (width < breakpointValues.tablet) return 'mobile'
  if (width < breakpointValues.laptop) return 'tablet'
  return 'desktop'
}

// 断点检测函数
export function isMobile(width = window.innerWidth) {
  return width < breakpointValues.tablet
}

export function isTablet(width = window.innerWidth) {
  return width >= breakpointValues.tablet && width < breakpointValues.laptop
}

export function isDesktop(width = window.innerWidth) {
  return width >= breakpointValues.laptop
}

// 当前断点检测
export function getCurrentBreakpoint(width = window.innerWidth) {
  if (width < breakpointValues.mobileLarge) return 'mobile'
  if (width < breakpointValues.tablet) return 'mobileLarge'
  if (width < breakpointValues.laptop) return 'tablet'
  if (width < breakpointValues.desktop) return 'laptop'
  if (width < breakpointValues.wide) return 'desktop'
  return 'wide'
}

// CSS变量生成
export function generateBreakpointVariables() {
  const cssVars = {}
  
  Object.entries(breakpoints).forEach(([key, value]) => {
    cssVars[`--breakpoint-${key}`] = value
  })
  
  return cssVars
}

// 媒体查询匹配检测
export function matchMedia(query) {
  if (typeof window === 'undefined') return false
  
  // 处理自定义查询格式
  const mediaQuery = query.startsWith('@media') ? query.slice(6) : query
  return window.matchMedia(mediaQuery).matches
}

// 响应式断点监听器
export class BreakpointWatcher {
  constructor() {
    this.listeners = new Map()
    this.currentBreakpoint = getCurrentBreakpoint()
  }
  
  // 添加断点变化监听
  addListener(callback) {
    const id = Math.random().toString(36).substr(2, 9)
    this.listeners.set(id, callback)
    
    if (this.listeners.size === 1) {
      this.startWatching()
    }
    
    return id
  }
  
  // 移除监听器
  removeListener(id) {
    this.listeners.delete(id)
    
    if (this.listeners.size === 0) {
      this.stopWatching()
    }
  }
  
  // 开始监听
  startWatching() {
    if (typeof window === 'undefined') return
    
    this.resizeHandler = () => {
      const newBreakpoint = getCurrentBreakpoint()
      if (newBreakpoint !== this.currentBreakpoint) {
        const oldBreakpoint = this.currentBreakpoint
        this.currentBreakpoint = newBreakpoint
        
        this.listeners.forEach(callback => {
          callback({
            from: oldBreakpoint,
            to: newBreakpoint,
            width: window.innerWidth
          })
        })
      }
    }
    
    window.addEventListener('resize', this.resizeHandler, { passive: true })
  }
  
  // 停止监听
  stopWatching() {
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler)
      this.resizeHandler = null
    }
  }
}

// 全局断点监听器实例
export const breakpointWatcher = new BreakpointWatcher()

export default {
  breakpoints,
  breakpointValues,
  media,
  getDeviceType,
  isMobile,
  isTablet,
  isDesktop,
  getCurrentBreakpoint,
  generateBreakpointVariables,
  matchMedia,
  breakpointWatcher
}