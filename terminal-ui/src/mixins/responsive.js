/**
 * 响应式混入工具集
 * 提供可复用的响应式功能混入
 */

import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useDevice } from '../composables/useDevice.js'
import { useLayoutStore } from '../store/layout.js'
import { breakpointValues } from '../design-system/tokens/breakpoints.js'
import { getResponsiveSpacing } from '../design-system/tokens/spacing.js'

// ================================
// 设备检测混入
// ================================

export const deviceMixin = {
  setup() {
    const device = useDevice()
    
    return {
      // 设备基础信息
      windowWidth: device.windowWidth,
      windowHeight: device.windowHeight,
      deviceType: device.deviceType,
      breakpoint: device.breakpoint,
      
      // 设备类型检测
      isMobile: device.isMobile,
      isTablet: device.isTablet,
      isDesktop: device.isDesktop,
      
      // 方向和特性
      orientation: device.orientation,
      isTouchDevice: device.isTouchDevice,
      hasHover: device.hasHover,
      isRetina: device.isRetina,
      
      // 工具方法
      matchBreakpoint: device.matchBreakpoint,
      matchMedia: device.matchMedia
    }
  }
}

// ================================
// 响应式类名混入
// ================================

export const responsiveClassMixin = {
  setup() {
    const device = useDevice()
    const layout = useLayoutStore()
    
    // 响应式类名计算
    const responsiveClasses = computed(() => {
      return [
        ...device.deviceClasses.value,
        ...layout.layoutClasses
      ]
    })
    
    // 设备特定样式
    const deviceSpecificStyles = computed(() => {
      const styles = {
        ...device.deviceCSSProperties.value,
        ...layout.layoutCSSProperties
      }
      
      return styles
    })
    
    return {
      responsiveClasses,
      deviceSpecificStyles
    }
  }
}

// ================================
// 断点监听混入
// ================================

export const breakpointMixin = {
  setup() {
    const device = useDevice()
    const breakpointCallbacks = ref(new Map())
    
    // 注册断点变化回调
    const onBreakpointChange = (callback, immediate = false) => {
      const id = Math.random().toString(36).substr(2, 9)
      breakpointCallbacks.value.set(id, callback)
      
      if (immediate) {
        callback({
          from: null,
          to: device.breakpoint.value,
          deviceType: device.deviceType.value
        })
      }
      
      return id
    }
    
    // 移除断点监听
    const offBreakpointChange = (id) => {
      breakpointCallbacks.value.delete(id)
    }
    
    // 监听断点变化
    let previousBreakpoint = device.breakpoint.value
    watch(
      () => device.breakpoint.value,
      (newBreakpoint) => {
        if (newBreakpoint !== previousBreakpoint) {
          breakpointCallbacks.value.forEach(callback => {
            callback({
              from: previousBreakpoint,
              to: newBreakpoint,
              deviceType: device.deviceType.value,
              windowWidth: device.windowWidth.value
            })
          })
          previousBreakpoint = newBreakpoint
        }
      }
    )
    
    return {
      currentBreakpoint: device.breakpoint,
      onBreakpointChange,
      offBreakpointChange
    }
  }
}

// ================================
// 触摸事件混入
// ================================

export const touchMixin = {
  setup() {
    const device = useDevice()
    const touchState = ref({
      startX: 0,
      startY: 0,
      endX: 0,
      endY: 0,
      startTime: 0,
      endTime: 0
    })
    
    // 触摸开始
    const handleTouchStart = (event) => {
      if (!device.isTouchDevice.value) return
      
      const touch = event.touches[0]
      touchState.value.startX = touch.clientX
      touchState.value.startY = touch.clientY
      touchState.value.startTime = Date.now()
    }
    
    // 触摸结束
    const handleTouchEnd = (event) => {
      if (!device.isTouchDevice.value) return
      
      const touch = event.changedTouches[0]
      touchState.value.endX = touch.clientX
      touchState.value.endY = touch.clientY
      touchState.value.endTime = Date.now()
    }
    
    // 计算滑动方向
    const getSwipeDirection = () => {
      const { startX, startY, endX, endY } = touchState.value
      const deltaX = endX - startX
      const deltaY = endY - startY
      const absDeltaX = Math.abs(deltaX)
      const absDeltaY = Math.abs(deltaY)
      
      // 最小滑动距离阈值
      const minSwipeDistance = 30
      
      if (Math.max(absDeltaX, absDeltaY) < minSwipeDistance) {
        return null
      }
      
      if (absDeltaX > absDeltaY) {
        return deltaX > 0 ? 'right' : 'left'
      } else {
        return deltaY > 0 ? 'down' : 'up'
      }
    }
    
    // 是否为长按
    const isLongPress = (threshold = 500) => {
      const duration = touchState.value.endTime - touchState.value.startTime
      const { startX, startY, endX, endY } = touchState.value
      const deltaX = Math.abs(endX - startX)
      const deltaY = Math.abs(endY - startY)
      
      return duration >= threshold && deltaX < 10 && deltaY < 10
    }
    
    // 计算滑动距离
    const getSwipeDistance = () => {
      const { startX, startY, endX, endY } = touchState.value
      const deltaX = endX - startX
      const deltaY = endY - startY
      
      return {
        deltaX,
        deltaY,
        distance: Math.sqrt(deltaX * deltaX + deltaY * deltaY)
      }
    }
    
    // 计算滑动速度
    const getSwipeVelocity = () => {
      const distance = getSwipeDistance().distance
      const duration = touchState.value.endTime - touchState.value.startTime
      
      return duration > 0 ? distance / duration : 0
    }
    
    return {
      isTouchDevice: device.isTouchDevice,
      touchState,
      handleTouchStart,
      handleTouchEnd,
      getSwipeDirection,
      isLongPress,
      getSwipeDistance,
      getSwipeVelocity
    }
  }
}

// ================================
// 响应式间距混入
// ================================

export const spacingMixin = {
  setup() {
    const device = useDevice()
    
    // 获取当前设备的间距值
    const getCurrentSpacing = (key, subKey = null) => {
      return getResponsiveSpacing(device.deviceType.value, key, subKey)
    }
    
    // 响应式间距样式
    const spacingStyles = computed(() => {
      const deviceType = device.deviceType.value
      const spacing = getResponsiveSpacing(deviceType, 'padding') || '16px'
      const gap = getResponsiveSpacing(deviceType, 'gap') || '8px'
      const margin = getResponsiveSpacing(deviceType, 'margin') || '8px'
      
      return {
        '--current-padding': spacing,
        '--current-gap': gap,
        '--current-margin': margin
      }
    })
    
    return {
      getCurrentSpacing,
      spacingStyles
    }
  }
}

// ================================
// 响应式可见性混入
// ================================

export const visibilityMixin = {
  setup() {
    const device = useDevice()
    
    // 设备可见性计算
    const visibility = computed(() => ({
      showOnMobile: device.isMobile.value,
      showOnTablet: device.isTablet.value,
      showOnDesktop: device.isDesktop.value,
      hideOnMobile: !device.isMobile.value,
      hideOnTablet: !device.isTablet.value,
      hideOnDesktop: !device.isDesktop.value,
      showOnTouch: device.isTouchDevice.value,
      showOnHover: device.hasHover.value
    }))
    
    // 条件渲染辅助函数
    const shouldRender = (conditions) => {
      if (typeof conditions === 'string') {
        return visibility.value[conditions] ?? true
      }
      
      if (Array.isArray(conditions)) {
        return conditions.some(condition => visibility.value[condition])
      }
      
      if (typeof conditions === 'object') {
        return Object.entries(conditions).every(([key, value]) => {
          return visibility.value[key] === value
        })
      }
      
      return true
    }
    
    return {
      visibility,
      shouldRender
    }
  }
}

// ================================
// 完整响应式混入（组合所有功能）
// ================================

export const responsiveMixin = {
  setup() {
    // 组合所有混入
    const deviceData = deviceMixin.setup()
    const classData = responsiveClassMixin.setup()
    const breakpointData = breakpointMixin.setup()
    const touchData = touchMixin.setup()
    const spacingData = spacingMixin.setup()
    const visibilityData = visibilityMixin.setup()
    
    // 布局store
    const layout = useLayoutStore()
    
    // 生命周期钩子：自动处理resize和设备变化
    onMounted(() => {
      // 初始化时适配设备
      layout.adaptToDevice()
    })
    
    // 组件卸载时清理
    onUnmounted(() => {
      // 清理断点监听器
      breakpointData.offBreakpointChange()
    })
    
    return {
      // 设备信息
      ...deviceData,
      
      // 样式类
      ...classData,
      
      // 断点监听
      ...breakpointData,
      
      // 触摸事件
      ...touchData,
      
      // 间距管理
      ...spacingData,
      
      // 可见性控制
      ...visibilityData,
      
      // 布局store访问
      layout
    }
  }
}

// ================================
// 导出工厂函数（便于选择性使用）
// ================================

export function createResponsiveMixin(options = {}) {
  const {
    includeDevice = true,
    includeClasses = true,
    includeBreakpoint = true,
    includeTouch = true,
    includeSpacing = true,
    includeVisibility = true,
    includeLayout = true
  } = options
  
  return {
    setup() {
      const mixins = {}
      
      if (includeDevice) {
        Object.assign(mixins, deviceMixin.setup())
      }
      
      if (includeClasses) {
        Object.assign(mixins, responsiveClassMixin.setup())
      }
      
      if (includeBreakpoint) {
        Object.assign(mixins, breakpointMixin.setup())
      }
      
      if (includeTouch) {
        Object.assign(mixins, touchMixin.setup())
      }
      
      if (includeSpacing) {
        Object.assign(mixins, spacingMixin.setup())
      }
      
      if (includeVisibility) {
        Object.assign(mixins, visibilityMixin.setup())
      }
      
      if (includeLayout) {
        mixins.layout = useLayoutStore()
      }
      
      return mixins
    }
  }
}

// ================================
// 默认导出
// ================================

export default {
  deviceMixin,
  responsiveClassMixin,
  breakpointMixin,
  touchMixin,
  spacingMixin,
  visibilityMixin,
  responsiveMixin,
  createResponsiveMixin
}