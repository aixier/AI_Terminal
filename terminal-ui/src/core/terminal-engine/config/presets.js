/**
 * Terminal Engine 预设配置
 * 提供不同场景下的最优配置
 */

// 移动端预设
export const MOBILE_PRESET = {
  device: 'mobile',
  
  renderer: {
    type: 'canvas2d',
    optimizeForTouch: true,
    virtualScrolling: true,
    enableOffscreenRendering: true,
    enableTextBatching: true
  },
  
  buffer: {
    maxLines: 5000, // 移动端减少内存使用
    cols: 80,
    rows: 24
  },
  
  input: {
    enableVirtualKeyboard: true,
    enableGestureNavigation: true,
    enableHapticFeedback: true
  },
  
  performance: {
    targetFPS: 30, // 移动端降低FPS节省电池
    enableBatching: true,
    enableVirtualScrolling: true,
    memoryOptimization: true
  },
  
  theme: {
    background: '#1e1e1e',
    foreground: '#ffffff',
    cursor: '#ffffff'
  }
}

// 桌面端预设
export const DESKTOP_PRESET = {
  device: 'desktop',
  
  renderer: {
    type: 'webgl',
    enableWebGL2: true,
    enableTextAtlas: true,
    virtualScrolling: false
  },
  
  buffer: {
    maxLines: 20000, // 桌面端可以有更多历史
    cols: 120,
    rows: 30
  },
  
  input: {
    enableVirtualKeyboard: false,
    enableKeyboardShortcuts: true,
    enableMouseSupport: true
  },
  
  performance: {
    targetFPS: 60,
    enableBatching: true,
    enableWebGL: true,
    highQualityText: true
  },
  
  theme: {
    background: '#1e1e1e',
    foreground: '#ffffff',
    cursor: '#ffffff'
  }
}

// 平板端预设
export const TABLET_PRESET = {
  device: 'tablet',
  
  renderer: {
    type: 'auto', // 自动选择最优渲染器
    virtualScrolling: true,
    enableTextBatching: true
  },
  
  buffer: {
    maxLines: 10000,
    cols: 100,
    rows: 28
  },
  
  input: {
    enableVirtualKeyboard: true,
    enableGestureNavigation: true,
    enableKeyboardShortcuts: true // 平板可能有外接键盘
  },
  
  performance: {
    targetFPS: 45, // 平板端中等FPS
    enableBatching: true,
    adaptiveRendering: true
  },
  
  theme: {
    background: '#1e1e1e',
    foreground: '#ffffff',
    cursor: '#ffffff'
  }
}

// 高性能预设 (适合性能强劲的设备)
export const HIGH_PERFORMANCE_PRESET = {
  renderer: {
    type: 'webgl',
    enableWebGL2: true,
    enableTextAtlas: true,
    enableOffscreenRendering: true
  },
  
  buffer: {
    maxLines: 50000,
    cols: 150,
    rows: 40
  },
  
  performance: {
    targetFPS: 120,
    enableBatching: true,
    enableWebGL: true,
    highQualityText: true,
    enableAdvancedOptimizations: true
  }
}

// 低性能预设 (适合性能较弱的设备)
export const LOW_PERFORMANCE_PRESET = {
  renderer: {
    type: 'dom',
    virtualScrolling: true,
    enableAccessibility: true
  },
  
  buffer: {
    maxLines: 1000,
    cols: 60,
    rows: 20
  },
  
  performance: {
    targetFPS: 15,
    enableBatching: true,
    enableVirtualScrolling: true,
    memoryOptimization: true,
    reduceAnimations: true
  }
}

// 无障碍预设
export const ACCESSIBILITY_PRESET = {
  renderer: {
    type: 'dom',
    enableAccessibility: true,
    enableSelection: true,
    highContrast: true
  },
  
  input: {
    enableKeyboardNavigation: true,
    enableScreenReaderSupport: true,
    enableVoiceCommands: false
  },
  
  theme: {
    background: '#000000',
    foreground: '#ffffff',
    cursor: '#ffff00', // 高对比度光标
    selection: '#0078d4'
  },
  
  accessibility: {
    ariaLabels: true,
    keyboardNavigation: true,
    screenReaderOptimized: true,
    highContrast: true,
    fontSize: 16
  }
}

// 开发调试预设
export const DEBUG_PRESET = {
  renderer: {
    type: 'auto',
    debugMode: true,
    showPerformanceOverlay: true
  },
  
  performance: {
    enableMetrics: true,
    detailedLogging: true,
    profileRendering: true
  },
  
  debug: {
    showFPS: true,
    showRenderTime: true,
    showMemoryUsage: true,
    logEvents: true,
    enableDevTools: true
  }
}

// 默认预设映射
export const PRESETS = {
  mobile: MOBILE_PRESET,
  tablet: TABLET_PRESET,
  desktop: DESKTOP_PRESET,
  'high-performance': HIGH_PERFORMANCE_PRESET,
  'low-performance': LOW_PERFORMANCE_PRESET,
  accessibility: ACCESSIBILITY_PRESET,
  debug: DEBUG_PRESET
}

/**
 * 获取预设配置
 * @param {string} presetName - 预设名称
 * @returns {Object} 预设配置
 */
export function getPreset(presetName) {
  const preset = PRESETS[presetName]
  if (!preset) {
    console.warn(`[Presets] Unknown preset: ${presetName}, using mobile preset`)
    return { ...MOBILE_PRESET }
  }
  
  return { ...preset }
}

/**
 * 合并预设配置
 * @param {string} presetName - 基础预设名称
 * @param {Object} overrides - 覆盖配置
 * @returns {Object} 合并后的配置
 */
export function mergePreset(presetName, overrides = {}) {
  const basePreset = getPreset(presetName)
  return deepMerge(basePreset, overrides)
}

/**
 * 根据设备自动选择预设
 * @param {Object} deviceInfo - 设备信息
 * @returns {Object} 推荐的预设配置
 */
export function getRecommendedPreset(deviceInfo) {
  const { type, performanceLevel, accessibility } = deviceInfo
  
  // 无障碍需求优先
  if (accessibility?.screenReader || accessibility?.highContrast) {
    return getPreset('accessibility')
  }
  
  // 根据性能等级选择
  if (performanceLevel === 'low') {
    return getPreset('low-performance')
  }
  
  if (performanceLevel === 'high' && type === 'desktop') {
    return getPreset('high-performance')
  }
  
  // 根据设备类型选择
  switch (type) {
    case 'mobile':
      return getPreset('mobile')
    case 'tablet':
      return getPreset('tablet')
    case 'desktop':
    default:
      return getPreset('desktop')
  }
}

/**
 * 创建自定义预设
 * @param {string} name - 预设名称
 * @param {Object} config - 预设配置
 */
export function createCustomPreset(name, config) {
  PRESETS[name] = { ...config }
}

/**
 * 深度合并对象
 */
function deepMerge(target, source) {
  const result = { ...target }
  
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key])
    } else {
      result[key] = source[key]
    }
  }
  
  return result
}

/**
 * 验证预设配置
 * @param {Object} config - 配置对象
 * @returns {Object} 验证结果
 */
export function validatePreset(config) {
  const errors = []
  const warnings = []
  
  // 检查必需字段
  if (!config.renderer) {
    errors.push('Missing renderer configuration')
  }
  
  if (!config.buffer) {
    warnings.push('Missing buffer configuration, using defaults')
  }
  
  // 检查性能配置
  if (config.performance?.targetFPS > 120) {
    warnings.push('Very high target FPS may impact performance')
  }
  
  if (config.buffer?.maxLines > 100000) {
    warnings.push('Very high maxLines may impact memory usage')
  }
  
  // 检查兼容性
  if (config.renderer?.type === 'webgl' && config.device === 'mobile') {
    warnings.push('WebGL renderer on mobile may have compatibility issues')
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

// 导出所有预设
export default PRESETS