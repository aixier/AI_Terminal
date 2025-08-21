/**
 * Web Terminal Engine - 核心引擎类
 * 统一管理渲染、缓冲、输入和性能优化
 */

import { TerminalBuffer } from '../buffer/TerminalBuffer.js'
import { ANSIParser } from '../parser/ANSIParser.js'
import { InputManager } from '../input/InputManager.js'
import { PerformanceMonitor } from '../utils/PerformanceMonitor.js'
import { createRenderer } from '../renderer/RendererFactory.js'
import { EventEmitter } from '../utils/EventEmitter.js'

export class WebTerminalEngine extends EventEmitter {
  constructor(options = {}) {
    super()
    
    this.options = this.mergeDefaultOptions(options)
    this.state = 'initializing'
    
    // 核心组件
    this.buffer = null
    this.renderer = null
    this.parser = null
    this.inputManager = null
    this.performanceMonitor = null
    
    // 状态管理
    this.isConnected = false
    this.connectionState = 'disconnected'
    this.lastRenderTime = 0
    this.renderRequestId = null
    
    // 初始化
    this.initialize()
  }
  
  /**
   * 合并默认配置
   */
  mergeDefaultOptions(options) {
    const defaults = {
      device: 'desktop',
      container: null,
      
      renderer: {
        type: 'auto',
        optimizeForTouch: false,
        virtualScrolling: true
      },
      
      buffer: {
        maxLines: 10000,
        cols: 80,
        rows: 24
      },
      
      input: {
        enableVirtualKeyboard: false,
        enableGestureNavigation: false
      },
      
      performance: {
        targetFPS: 60,
        enableBatching: true,
        enableVirtualScrolling: true
      },
      
      theme: {
        background: '#1e1e1e',
        foreground: '#ffffff',
        cursor: '#ffffff'
      }
    }
    
    return this.deepMerge(defaults, options)
  }
  
  /**
   * 初始化Engine
   */
  async initialize() {
    try {
      this.state = 'initializing'
      this.emit('stateChange', { state: this.state })
      
      // 1. 初始化性能监控
      this.performanceMonitor = new PerformanceMonitor({
        targetFPS: this.options.performance.targetFPS,
        enableMetrics: true
      })
      
      // 2. 初始化缓冲区
      this.buffer = new TerminalBuffer(this.options.buffer)
      
      // 3. 初始化ANSI解析器
      this.parser = new ANSIParser()
      
      // 4. 初始化渲染器
      this.renderer = createRenderer(this.options.renderer, {
        container: this.options.container,
        device: this.options.device,
        theme: this.options.theme,
        buffer: this.buffer
      })
      
      // 5. 初始化输入管理器
      this.inputManager = new InputManager(this.options.input, {
        device: this.options.device,
        container: this.options.container
      })
      
      // 6. 绑定事件
      this.bindEvents()
      
      // 7. 启动渲染循环
      this.startRenderLoop()
      
      this.state = 'ready'
      this.emit('stateChange', { state: this.state })
      this.emit('ready')
      
    } catch (error) {
      this.state = 'error'
      this.emit('stateChange', { state: this.state, error })
      this.emit('error', error)
      throw error
    }
  }
  
  /**
   * 绑定事件监听
   */
  bindEvents() {
    // 缓冲区变化监听
    this.buffer.on('change', (data) => {
      this.scheduleRender()
      this.emit('bufferChange', data)
    })
    
    // 输入事件监听
    this.inputManager.on('input', (inputData) => {
      this.emit('input', inputData)
    })
    
    // 渲染器事件监听
    this.renderer.on('renderComplete', (metrics) => {
      this.performanceMonitor.recordRender(metrics)
    })
    
    // 性能监控
    this.performanceMonitor.on('performanceUpdate', (metrics) => {
      this.emit('performance', metrics)
    })
  }
  
  /**
   * 启动渲染循环
   */
  startRenderLoop() {
    const targetFrameTime = 1000 / this.options.performance.targetFPS
    
    const renderLoop = (currentTime) => {
      // 检查是否需要渲染
      if (this.shouldRender(currentTime)) {
        this.performRender(currentTime)
        this.lastRenderTime = currentTime
      }
      
      // 继续循环
      this.renderRequestId = requestAnimationFrame(renderLoop)
    }
    
    this.renderRequestId = requestAnimationFrame(renderLoop)
  }
  
  /**
   * 判断是否需要渲染
   */
  shouldRender(currentTime) {
    const targetFrameTime = 1000 / this.options.performance.targetFPS
    const timeSinceLastRender = currentTime - this.lastRenderTime
    
    return timeSinceLastRender >= targetFrameTime || this.buffer.hasChanges()
  }
  
  /**
   * 执行渲染
   */
  performRender(currentTime) {
    const startTime = performance.now()
    
    try {
      // 获取视口数据
      const viewport = this.buffer.getViewport()
      
      // 执行渲染
      this.renderer.render(viewport)
      
      // 清除缓冲区变化标记
      this.buffer.clearChanges()
      
      // 记录性能指标
      const renderTime = performance.now() - startTime
      this.performanceMonitor.recordFrame(renderTime)
      
    } catch (error) {
      console.error('[WebTerminalEngine] Render error:', error)
      this.emit('renderError', error)
    }
  }
  
  /**
   * 计划渲染（防抖）
   */
  scheduleRender() {
    if (this.options.performance.enableBatching) {
      // 使用requestAnimationFrame批处理渲染
      if (!this.renderScheduled) {
        this.renderScheduled = true
        requestAnimationFrame(() => {
          this.renderScheduled = false
        })
      }
    }
  }
  
  /**
   * 处理输出数据
   * @param {string|Uint8Array} data - 输出数据
   */
  write(data) {
    if (this.state !== 'ready') {
      console.warn('[WebTerminalEngine] Engine not ready, ignoring write')
      return
    }
    
    try {
      // 解析ANSI转义序列
      const commands = this.parser.parse(data)
      
      // 应用到缓冲区
      for (const command of commands) {
        this.buffer.applyCommand(command)
      }
      
      this.emit('write', { data, commands })
      
    } catch (error) {
      console.error('[WebTerminalEngine] Write error:', error)
      this.emit('writeError', error)
    }
  }
  
  /**
   * 清空终端
   */
  clear() {
    this.buffer.clear()
    this.scheduleRender()
    this.emit('clear')
  }
  
  /**
   * 重置终端尺寸
   * @param {number} cols - 列数
   * @param {number} rows - 行数
   */
  resize(cols, rows) {
    if (this.buffer) {
      this.buffer.resize(cols, rows)
    }
    
    if (this.renderer) {
      this.renderer.resize(cols, rows)
    }
    
    this.emit('resize', { cols, rows })
  }
  
  /**
   * 获取终端尺寸
   */
  getSize() {
    return this.buffer ? this.buffer.getSize() : { cols: 80, rows: 24 }
  }
  
  /**
   * 获取性能指标
   */
  getPerformanceMetrics() {
    return this.performanceMonitor ? this.performanceMonitor.getMetrics() : {}
  }
  
  /**
   * 设置主题
   * @param {Object} theme - 主题配置
   */
  setTheme(theme) {
    this.options.theme = { ...this.options.theme, ...theme }
    
    if (this.renderer) {
      this.renderer.setTheme(this.options.theme)
    }
    
    this.emit('themeChange', this.options.theme)
  }
  
  /**
   * 启用/禁用功能
   * @param {string} feature - 功能名称
   * @param {boolean} enabled - 是否启用
   */
  setFeature(feature, enabled) {
    switch (feature) {
      case 'virtualKeyboard':
        if (this.inputManager) {
          this.inputManager.setVirtualKeyboardEnabled(enabled)
        }
        break
        
      case 'gestureNavigation':
        if (this.inputManager) {
          this.inputManager.setGestureNavigationEnabled(enabled)
        }
        break
        
      case 'virtualScrolling':
        if (this.renderer) {
          this.renderer.setVirtualScrollingEnabled(enabled)
        }
        break
    }
    
    this.emit('featureChange', { feature, enabled })
  }
  
  /**
   * 销毁Engine
   */
  destroy() {
    this.state = 'destroyed'
    
    // 停止渲染循环
    if (this.renderRequestId) {
      cancelAnimationFrame(this.renderRequestId)
      this.renderRequestId = null
    }
    
    // 销毁组件
    if (this.renderer) {
      this.renderer.destroy()
    }
    
    if (this.inputManager) {
      this.inputManager.destroy()
    }
    
    if (this.performanceMonitor) {
      this.performanceMonitor.destroy()
    }
    
    // 清除事件监听
    this.removeAllListeners()
    
    this.emit('destroyed')
  }
  
  /**
   * 深度合并对象
   */
  deepMerge(target, source) {
    const result = { ...target }
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key])
      } else {
        result[key] = source[key]
      }
    }
    
    return result
  }
}