/**
 * Web Terminal Engine - 独立模块入口
 * 高性能多端终端渲染引擎
 */

export { WebTerminalEngine } from './engine/WebTerminalEngine.js'
export { TerminalRenderer } from './renderer/TerminalRenderer.js'
export { TerminalBuffer } from './buffer/TerminalBuffer.js'
export { ANSIParser } from './parser/ANSIParser.js'
export { InputManager } from './input/InputManager.js'

// 渲染器
export { Canvas2DRenderer } from './renderer/Canvas2DRenderer.js'
export { WebGLRenderer } from './renderer/WebGLRenderer.js'
export { DOMRenderer } from './renderer/DOMRenderer.js'

// 工具类
export { DeviceDetector } from './utils/DeviceDetector.js'
export { PerformanceMonitor } from './utils/PerformanceMonitor.js'
export { detectRendererSupport } from './renderer/RendererFactory.js'

// 预设配置
export * from './config/presets.js'

// 版本信息
export const VERSION = '1.0.0'
export const BUILD_DATE = new Date().toISOString()

/**
 * 创建Terminal Engine实例的便捷方法
 * @param {Object} options - 配置选项
 * @param {string} options.device - 设备类型 ('mobile'|'tablet'|'desktop')
 * @param {HTMLElement} options.container - 容器元素
 * @param {Object} options.config - 详细配置
 * @returns {WebTerminalEngine} Terminal Engine实例
 */
export function createTerminalEngine(options = {}) {
  const { device = 'auto', container, config = {} } = options
  
  // 自动检测设备类型
  const detectedDevice = device === 'auto' 
    ? DeviceDetector.detect().type 
    : device
  
  // 合并默认配置
  const engineConfig = {
    device: detectedDevice,
    container,
    renderer: {
      type: 'auto', // 自动选择最佳渲染器
      ...config.renderer
    },
    buffer: {
      maxLines: 10000,
      cols: 80,
      rows: 24,
      ...config.buffer
    },
    input: {
      enableVirtualKeyboard: detectedDevice === 'mobile',
      ...config.input
    },
    performance: {
      targetFPS: detectedDevice === 'mobile' ? 30 : 60,
      enableVirtualScrolling: true,
      ...config.performance
    },
    ...config
  }
  
  return new WebTerminalEngine(engineConfig)
}

/**
 * 快速创建移动端优化的Terminal Engine
 * @param {HTMLElement} container - 容器元素
 * @param {Object} options - 额外选项
 * @returns {WebTerminalEngine} 移动端优化的Terminal Engine
 */
export function createMobileTerminal(container, options = {}) {
  return createTerminalEngine({
    device: 'mobile',
    container,
    config: {
      renderer: {
        type: 'canvas2d',
        optimizeForTouch: true,
        virtualScrolling: true
      },
      input: {
        enableVirtualKeyboard: true,
        enableGestureNavigation: true,
        enableHapticFeedback: true
      },
      performance: {
        targetFPS: 30,
        enableBatching: true,
        memoryOptimization: true
      },
      ...options
    }
  })
}

/**
 * 快速创建桌面端高性能Terminal Engine
 * @param {HTMLElement} container - 容器元素  
 * @param {Object} options - 额外选项
 * @returns {WebTerminalEngine} 桌面端高性能Terminal Engine
 */
export function createDesktopTerminal(container, options = {}) {
  return createTerminalEngine({
    device: 'desktop',
    container,
    config: {
      renderer: {
        type: 'webgl',
        enableTextAtlas: true,
        enableWebGL2: true
      },
      input: {
        enableKeyboardShortcuts: true,
        enableMouseSupport: true
      },
      performance: {
        targetFPS: 60,
        enableWebGL: true,
        highQualityText: true
      },
      ...options
    }
  })
}