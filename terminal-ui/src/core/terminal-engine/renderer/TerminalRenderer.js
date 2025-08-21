/**
 * Terminal 渲染器基类
 * 定义所有渲染器的通用接口和基础功能
 */

import { EventEmitter } from '../utils/EventEmitter.js'

export class TerminalRenderer extends EventEmitter {
  constructor(options = {}) {
    super()
    
    this.type = 'base'
    this.container = options.container
    this.device = options.device || 'desktop'
    this.theme = options.theme || this.getDefaultTheme()
    this.buffer = options.buffer
    
    // 渲染状态
    this.isInitialized = false
    this.isDestroyed = false
    this.lastRenderTime = 0
    this.renderCount = 0
    
    // 尺寸信息
    this.cellWidth = 8
    this.cellHeight = 16
    this.cols = 80
    this.rows = 24
    this.canvasWidth = 0
    this.canvasHeight = 0
    
    // 性能配置
    this.enableVirtualScrolling = options.virtualScrolling !== false
    this.enableBatching = options.enableBatching !== false
    this.targetFPS = options.targetFPS || 60
    
    // 渲染队列
    this.renderQueue = []
    this.isRenderScheduled = false
    
    this.initialize()
  }
  
  /**
   * 初始化渲染器 - 子类需要实现
   */
  initialize() {
    this.calculateDimensions()
    this.setupContainer()
    this.isInitialized = true
    this.emit('initialized')
  }
  
  /**
   * 计算字符和画布尺寸
   */
  calculateDimensions() {
    if (!this.container) return
    
    // 基础字符尺寸计算
    const measureElement = document.createElement('span')
    measureElement.style.font = this.getFont()
    measureElement.style.position = 'absolute'
    measureElement.style.visibility = 'hidden'
    measureElement.textContent = 'W' // 使用宽字符测量
    
    document.body.appendChild(measureElement)
    const rect = measureElement.getBoundingClientRect()
    
    this.cellWidth = Math.ceil(rect.width)
    this.cellHeight = Math.ceil(rect.height)
    
    document.body.removeChild(measureElement)
    
    // 计算画布尺寸
    this.updateCanvasSize()
  }
  
  /**
   * 更新画布尺寸
   */
  updateCanvasSize() {
    if (this.buffer) {
      const size = this.buffer.getSize()
      this.cols = size.cols
      this.rows = size.rows
    }
    
    this.canvasWidth = this.cols * this.cellWidth
    this.canvasHeight = this.rows * this.cellHeight
  }
  
  /**
   * 设置容器
   */
  setupContainer() {
    if (!this.container) {
      throw new Error('Container element is required')
    }
    
    // 设置容器样式
    this.container.style.position = 'relative'
    this.container.style.overflow = 'hidden'
    this.container.style.fontFamily = 'Monaco, Menlo, "Ubuntu Mono", monospace'
    this.container.style.fontSize = '14px'
    this.container.style.lineHeight = '1.2'
    
    // 设备特定样式
    if (this.device === 'mobile') {
      this.container.style.touchAction = 'manipulation'
      this.container.style.userSelect = 'none'
    }
  }
  
  /**
   * 获取字体设置
   */
  getFont() {
    return `14px Monaco, Menlo, "Ubuntu Mono", monospace`
  }
  
  /**
   * 获取默认主题
   */
  getDefaultTheme() {
    return {
      background: '#1e1e1e',
      foreground: '#ffffff',
      cursor: '#ffffff',
      selection: 'rgba(255, 255, 255, 0.3)',
      
      // ANSI 颜色
      black: '#000000',
      red: '#cd3131',
      green: '#0dbc79',
      yellow: '#e5e510',
      blue: '#2472c8',
      magenta: '#bc3fbc',
      cyan: '#11a8cd',
      white: '#e5e5e5',
      
      // 高亮颜色
      brightBlack: '#666666',
      brightRed: '#f14c4c',
      brightGreen: '#23d18b',
      brightYellow: '#f5f543',
      brightBlue: '#3b8eea',
      brightMagenta: '#d670d6',
      brightCyan: '#29b8db',
      brightWhite: '#ffffff'
    }
  }
  
  /**
   * 主渲染方法 - 子类必须实现
   * @param {Object} viewport - 视口数据
   */
  render(viewport) {
    throw new Error('render() method must be implemented by subclass')
  }
  
  /**
   * 调度渲染 - 防止过度渲染
   */
  scheduleRender(viewport) {
    if (this.isRenderScheduled) return
    
    this.isRenderScheduled = true
    
    requestAnimationFrame(() => {
      this.isRenderScheduled = false
      
      if (!this.isDestroyed) {
        this.performRender(viewport)
      }
    })
  }
  
  /**
   * 执行渲染并记录性能
   */
  performRender(viewport) {
    const startTime = performance.now()
    
    try {
      this.render(viewport)
      this.renderCount++
      
      const endTime = performance.now()
      const renderTime = endTime - startTime
      this.lastRenderTime = renderTime
      
      // 发射性能事件
      this.emit('renderComplete', {
        renderTime,
        renderCount: this.renderCount,
        viewport
      })
      
    } catch (error) {
      this.emit('renderError', error)
    }
  }
  
  /**
   * 重置终端尺寸
   * @param {number} cols - 列数
   * @param {number} rows - 行数
   */
  resize(cols, rows) {
    this.cols = cols
    this.rows = rows
    this.updateCanvasSize()
    this.onResize()
    this.emit('resize', { cols, rows })
  }
  
  /**
   * 尺寸变化处理 - 子类可以重写
   */
  onResize() {
    // 子类实现具体的重置逻辑
  }
  
  /**
   * 设置主题
   * @param {Object} theme - 主题配置
   */
  setTheme(theme) {
    this.theme = { ...this.theme, ...theme }
    this.onThemeChange()
    this.emit('themeChange', this.theme)
  }
  
  /**
   * 主题变化处理 - 子类可以重写
   */
  onThemeChange() {
    // 子类实现具体的主题更新逻辑
  }
  
  /**
   * 设置虚拟滚动
   * @param {boolean} enabled - 是否启用
   */
  setVirtualScrollingEnabled(enabled) {
    this.enableVirtualScrolling = enabled
    this.emit('virtualScrollingChange', enabled)
  }
  
  /**
   * 获取渲染器性能指标
   */
  getMetrics() {
    return {
      type: this.type,
      renderCount: this.renderCount,
      lastRenderTime: this.lastRenderTime,
      cellWidth: this.cellWidth,
      cellHeight: this.cellHeight,
      canvasWidth: this.canvasWidth,
      canvasHeight: this.canvasHeight,
      enableVirtualScrolling: this.enableVirtualScrolling
    }
  }
  
  /**
   * 清空渲染内容
   */
  clear() {
    // 子类实现具体的清空逻辑
  }
  
  /**
   * 销毁渲染器
   */
  destroy() {
    if (this.isDestroyed) return
    
    this.isDestroyed = true
    this.clear()
    
    // 清理容器
    if (this.container) {
      this.container.innerHTML = ''
    }
    
    // 清理事件监听
    this.removeAllListeners()
    
    this.emit('destroyed')
  }
  
  /**
   * 工具方法：颜色处理
   */
  parseColor(color) {
    if (typeof color === 'string') {
      return color
    }
    
    if (typeof color === 'number') {
      // ANSI 颜色码转换
      return this.ansiToColor(color)
    }
    
    return '#ffffff' // 默认颜色
  }
  
  /**
   * ANSI颜色码转换
   */
  ansiToColor(code) {
    const colorMap = {
      0: this.theme.black,
      1: this.theme.red,
      2: this.theme.green,
      3: this.theme.yellow,
      4: this.theme.blue,
      5: this.theme.magenta,
      6: this.theme.cyan,
      7: this.theme.white,
      8: this.theme.brightBlack,
      9: this.theme.brightRed,
      10: this.theme.brightGreen,
      11: this.theme.brightYellow,
      12: this.theme.brightBlue,
      13: this.theme.brightMagenta,
      14: this.theme.brightCyan,
      15: this.theme.brightWhite
    }
    
    return colorMap[code] || this.theme.foreground
  }
  
  /**
   * 检查是否在可见区域内
   */
  isInViewport(row, viewport) {
    if (!viewport || !this.enableVirtualScrolling) return true
    
    const { startRow = 0, endRow = this.rows } = viewport
    return row >= startRow && row < endRow
  }
  
  /**
   * 计算可见行范围
   */
  getVisibleRange(scrollTop = 0) {
    if (!this.enableVirtualScrolling) {
      return { start: 0, end: this.rows }
    }
    
    const startRow = Math.floor(scrollTop / this.cellHeight)
    const endRow = Math.min(
      startRow + this.rows + 1, // +1 for partial visibility
      this.buffer ? this.buffer.getLineCount() : this.rows
    )
    
    return { start: startRow, end: endRow }
  }
}