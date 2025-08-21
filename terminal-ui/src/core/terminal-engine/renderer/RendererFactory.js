/**
 * 渲染器工厂 - 根据设备和配置选择最佳渲染器
 */

import { Canvas2DRenderer } from './Canvas2DRenderer.js'
import { WebGLRenderer } from './WebGLRenderer.js'
import { DOMRenderer } from './DOMRenderer.js'
import { DeviceDetector } from '../utils/DeviceDetector.js'

/**
 * 创建最适合的渲染器
 * @param {Object} rendererConfig - 渲染器配置
 * @param {Object} context - 上下文信息
 * @returns {TerminalRenderer} 渲染器实例
 */
export function createRenderer(rendererConfig, context) {
  const { type, ...config } = rendererConfig
  const { device, container } = context
  
  // 自动选择渲染器类型
  let rendererType = type
  if (type === 'auto') {
    rendererType = selectOptimalRenderer(device, container)
  }
  
  // 创建对应的渲染器
  switch (rendererType) {
    case 'canvas2d':
      return new Canvas2DRenderer({ ...config, ...context })
      
    case 'webgl':
      return new WebGLRenderer({ ...config, ...context })
      
    case 'dom':
      return new DOMRenderer({ ...config, ...context })
      
    default:
      console.warn(`[RendererFactory] Unknown renderer type: ${rendererType}, falling back to DOM`)
      return new DOMRenderer({ ...config, ...context })
  }
}

/**
 * 选择最优渲染器
 * @param {string} device - 设备类型
 * @param {HTMLElement} container - 容器元素
 * @returns {string} 渲染器类型
 */
function selectOptimalRenderer(device, container) {
  const capabilities = DeviceDetector.getCapabilities()
  
  // 移动端优先选择Canvas2D
  if (device === 'mobile') {
    if (capabilities.canvas && capabilities.offscreenCanvas) {
      return 'canvas2d'
    }
    return 'dom' // 移动端兜底
  }
  
  // 桌面端优先选择WebGL
  if (device === 'desktop') {
    if (capabilities.webgl2) {
      return 'webgl'
    }
    if (capabilities.webgl) {
      return 'webgl'
    }
    if (capabilities.canvas) {
      return 'canvas2d'
    }
    return 'dom' // 桌面端兜底
  }
  
  // 平板端选择Canvas2D或WebGL
  if (device === 'tablet') {
    if (capabilities.webgl && window.innerWidth > 1024) {
      return 'webgl'
    }
    if (capabilities.canvas) {
      return 'canvas2d'
    }
    return 'dom'
  }
  
  // 默认回退到DOM渲染器
  return 'dom'
}

/**
 * 检测渲染器支持情况
 * @returns {Object} 支持情况报告
 */
export function detectRendererSupport() {
  const capabilities = DeviceDetector.getCapabilities()
  const device = DeviceDetector.detect()
  
  return {
    device: device.type,
    recommended: selectOptimalRenderer(device.type),
    
    support: {
      canvas2d: {
        available: capabilities.canvas,
        performance: device.type === 'mobile' ? 'good' : 'excellent',
        features: {
          offscreenCanvas: capabilities.offscreenCanvas,
          imageBitmap: capabilities.imageBitmap
        }
      },
      
      webgl: {
        available: capabilities.webgl,
        version: capabilities.webgl2 ? '2.0' : capabilities.webgl ? '1.0' : 'none',
        performance: device.type === 'desktop' ? 'excellent' : 'good',
        features: {
          textureFloat: capabilities.textureFloat,
          instancedArrays: capabilities.instancedArrays
        }
      },
      
      dom: {
        available: true,
        performance: 'moderate',
        features: {
          virtualScrolling: true,
          accessibility: true
        }
      }
    },
    
    recommendations: generateRecommendations(device.type, capabilities)
  }
}

/**
 * 生成性能建议
 */
function generateRecommendations(deviceType, capabilities) {
  const recommendations = []
  
  if (deviceType === 'mobile') {
    if (!capabilities.offscreenCanvas) {
      recommendations.push('考虑使用Web Workers优化渲染性能')
    }
    if (!capabilities.canvas) {
      recommendations.push('设备不支持Canvas，将使用DOM渲染器')
    }
    recommendations.push('移动端建议启用虚拟滚动和触摸优化')
  }
  
  if (deviceType === 'desktop') {
    if (!capabilities.webgl2) {
      recommendations.push('建议升级浏览器以获得WebGL 2.0支持')
    }
    if (capabilities.webgl) {
      recommendations.push('可以启用高质量文本渲染和纹理缓存')
    }
  }
  
  if (deviceType === 'tablet') {
    recommendations.push('平板设备建议根据屏幕尺寸动态选择渲染器')
    if (capabilities.webgl && window.innerWidth > 1024) {
      recommendations.push('大屏平板可以使用WebGL渲染器')
    }
  }
  
  return recommendations
}