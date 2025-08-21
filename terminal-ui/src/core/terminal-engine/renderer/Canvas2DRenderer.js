/**
 * Canvas 2D 渲染器 - 移动端优化
 * 使用Canvas 2D API进行高性能文本渲染
 */

import { TerminalRenderer } from './TerminalRenderer.js'

export class Canvas2DRenderer extends TerminalRenderer {
  constructor(options = {}) {
    super(options)
    
    this.type = 'canvas2d'
    this.canvas = null
    this.ctx = null
    this.offscreenCanvas = null
    this.offscreenCtx = null
    
    // Canvas 2D 特定配置
    this.optimizeForTouch = options.optimizeForTouch || false
    this.enableOffscreenRendering = options.enableOffscreenRendering !== false
    this.enableTextBatching = options.enableTextBatching !== false
    this.pixelRatio = window.devicePixelRatio || 1
    
    // 性能优化
    this.textMetricsCache = new Map()
    this.renderBatch = []
    this.dirtyRegions = new Set()
    
    // 滚动优化
    this.scrollBuffer = null
    this.lastScrollTop = 0
  }
  
  /**
   * 初始化Canvas渲染器
   */
  initialize() {
    super.initialize()
    
    this.createCanvas()
    this.setupContext()
    this.setupOffscreenCanvas()
    this.bindEvents()
    
    // 移动端优化
    if (this.optimizeForTouch) {
      this.setupTouchOptimizations()
    }
    
    this.emit('initialized')
  }
  
  /**
   * 创建主Canvas
   */
  createCanvas() {
    this.canvas = document.createElement('canvas')
    this.canvas.style.position = 'absolute'
    this.canvas.style.top = '0'
    this.canvas.style.left = '0'
    this.canvas.style.width = '100%'
    this.canvas.style.height = '100%'
    this.canvas.style.imageRendering = 'optimizeSpeed'
    
    // 设备像素比适配
    this.canvas.width = this.canvasWidth * this.pixelRatio
    this.canvas.height = this.canvasHeight * this.pixelRatio
    this.canvas.style.width = this.canvasWidth + 'px'
    this.canvas.style.height = this.canvasHeight + 'px'
    
    this.container.appendChild(this.canvas)
    this.ctx = this.canvas.getContext('2d')
  }
  
  /**
   * 设置Canvas上下文
   */
  setupContext() {
    if (!this.ctx) return
    
    // 缩放适配高DPI屏幕
    this.ctx.scale(this.pixelRatio, this.pixelRatio)
    
    // 优化文本渲染
    this.ctx.textBaseline = 'top'
    this.ctx.textAlign = 'left'
    this.ctx.font = this.getFont()
    
    // 性能优化设置
    this.ctx.imageSmoothingEnabled = false
    
    // 移动端性能优化
    if (this.device === 'mobile') {
      this.ctx.globalCompositeOperation = 'source-over'
    }
  }
  
  /**
   * 设置离屏Canvas (用于缓存和预渲染)
   */
  setupOffscreenCanvas() {
    if (!this.enableOffscreenRendering) return
    
    try {
      // 尝试使用OffscreenCanvas (如果支持)
      if (typeof OffscreenCanvas !== 'undefined') {
        this.offscreenCanvas = new OffscreenCanvas(
          this.canvasWidth * this.pixelRatio,
          this.canvasHeight * this.pixelRatio
        )
        this.offscreenCtx = this.offscreenCanvas.getContext('2d')
      } else {
        // 回退到普通Canvas
        this.offscreenCanvas = document.createElement('canvas')
        this.offscreenCanvas.width = this.canvasWidth * this.pixelRatio
        this.offscreenCanvas.height = this.canvasHeight * this.pixelRatio
        this.offscreenCtx = this.offscreenCanvas.getContext('2d')
      }
      
      if (this.offscreenCtx) {
        this.offscreenCtx.scale(this.pixelRatio, this.pixelRatio)
        this.offscreenCtx.textBaseline = 'top'
        this.offscreenCtx.textAlign = 'left'
        this.offscreenCtx.font = this.getFont()
        this.offscreenCtx.imageSmoothingEnabled = false
      }
      
    } catch (error) {
      console.warn('[Canvas2DRenderer] OffscreenCanvas setup failed:', error)
      this.offscreenCanvas = null
      this.offscreenCtx = null
    }
  }
  
  /**
   * 移动端触摸优化
   */
  setupTouchOptimizations() {
    // 禁用上下文菜单
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault())
    
    // 触摸滚动优化
    this.canvas.style.touchAction = 'pan-y'
    
    // 减少重绘频率
    this.targetFPS = Math.min(this.targetFPS, 30)
  }
  
  /**
   * 绑定事件
   */
  bindEvents() {
    // 窗口尺寸变化
    window.addEventListener('resize', this.handleResize.bind(this))
    
    // 设备像素比变化 (例如缩放)
    if ('matchMedia' in window) {
      const mediaQuery = matchMedia(`(resolution: ${this.pixelRatio}dppx)`)
      mediaQuery.addListener(this.handlePixelRatioChange.bind(this))
    }
  }
  
  /**
   * 主渲染方法
   * @param {Object} viewport - 视口数据
   */
  render(viewport) {
    if (!this.ctx || !viewport) return
    
    const startTime = performance.now()
    
    try {
      // 选择渲染上下文
      const renderCtx = this.offscreenCtx || this.ctx
      
      // 清空画布
      this.clearCanvas(renderCtx)
      
      // 设置背景色
      this.drawBackground(renderCtx)
      
      // 渲染文本内容
      this.renderText(renderCtx, viewport)
      
      // 渲染光标
      this.renderCursor(renderCtx, viewport)
      
      // 如果使用离屏渲染，复制到主Canvas
      if (this.offscreenCtx && renderCtx === this.offscreenCtx) {
        this.ctx.drawImage(this.offscreenCanvas, 0, 0)
      }
      
      // 性能统计
      const endTime = performance.now()
      this.lastRenderTime = endTime - startTime
      
    } catch (error) {
      console.error('[Canvas2DRenderer] Render error:', error)
      this.emit('renderError', error)
    }
  }
  
  /**
   * 清空Canvas
   */
  clearCanvas(ctx) {
    ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight)
  }
  
  /**
   * 绘制背景
   */
  drawBackground(ctx) {
    ctx.fillStyle = this.theme.background
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight)
  }
  
  /**
   * 渲染文本内容
   */
  renderText(ctx, viewport) {
    if (!viewport.lines || viewport.lines.length === 0) return
    
    // 批量渲染优化
    if (this.enableTextBatching) {
      this.renderTextBatched(ctx, viewport)
    } else {
      this.renderTextDirect(ctx, viewport)
    }
  }
  
  /**
   * 批量文本渲染 (性能优化)
   */
  renderTextBatched(ctx, viewport) {
    const { lines } = viewport
    
    // 按样式分组文本
    const styleGroups = new Map()
    
    lines.forEach((line, rowIndex) => {
      if (!line || !line.cells) return
      
      line.cells.forEach((cell, colIndex) => {
        if (!cell || !cell.char || cell.char === ' ') return
        
        const styleKey = this.getStyleKey(cell.style)
        
        if (!styleGroups.has(styleKey)) {
          styleGroups.set(styleKey, {
            style: cell.style,
            chars: []
          })
        }
        
        styleGroups.get(styleKey).chars.push({
          char: cell.char,
          x: colIndex * this.cellWidth,
          y: rowIndex * this.cellHeight
        })
      })
    })
    
    // 按样式批量绘制
    styleGroups.forEach(({ style, chars }) => {
      this.applyTextStyle(ctx, style)
      
      chars.forEach(({ char, x, y }) => {
        ctx.fillText(char, x, y)
      })
    })
  }
  
  /**
   * 直接文本渲染
   */
  renderTextDirect(ctx, viewport) {
    const { lines } = viewport
    
    lines.forEach((line, rowIndex) => {
      if (!line || !line.cells) return
      
      const y = rowIndex * this.cellHeight
      let currentStyle = null
      let textBatch = ''
      let batchStartX = 0
      
      line.cells.forEach((cell, colIndex) => {
        const x = colIndex * this.cellWidth
        
        if (!cell || !cell.char) {
          // 处理当前批次
          if (textBatch) {
            this.applyTextStyle(ctx, currentStyle)
            ctx.fillText(textBatch, batchStartX, y)
            textBatch = ''
          }
          return
        }
        
        // 检查样式是否变化
        if (!this.isSameStyle(currentStyle, cell.style)) {
          // 绘制当前批次
          if (textBatch) {
            this.applyTextStyle(ctx, currentStyle)
            ctx.fillText(textBatch, batchStartX, y)
          }
          
          // 开始新批次
          currentStyle = cell.style
          textBatch = cell.char
          batchStartX = x
        } else {
          textBatch += cell.char
        }
      })
      
      // 绘制最后一个批次
      if (textBatch) {
        this.applyTextStyle(ctx, currentStyle)
        ctx.fillText(textBatch, batchStartX, y)
      }
    })
  }
  
  /**
   * 应用文本样式
   */
  applyTextStyle(ctx, style) {
    if (!style) style = {}
    
    // 设置字体
    let font = '14px'
    if (style.bold) font = 'bold ' + font
    if (style.italic) font = 'italic ' + font
    font += ' Monaco, Menlo, "Ubuntu Mono", monospace'
    ctx.font = font
    
    // 设置颜色
    ctx.fillStyle = this.parseColor(style.foreground || this.theme.foreground)
    
    // 背景色处理
    if (style.background && style.background !== this.theme.background) {
      // 这里可以实现背景色绘制
      // 由于需要知道文本位置，通常在绘制文本前单独处理
    }
  }
  
  /**
   * 渲染光标
   */
  renderCursor(ctx, viewport) {
    if (!viewport.cursor || !viewport.cursor.visible) return
    
    const { x, y } = viewport.cursor
    const cursorX = x * this.cellWidth
    const cursorY = y * this.cellHeight
    
    ctx.fillStyle = this.theme.cursor
    
    // 不同的光标样式
    switch (viewport.cursor.style || 'block') {
      case 'block':
        ctx.fillRect(cursorX, cursorY, this.cellWidth, this.cellHeight)
        break
      case 'underline':
        ctx.fillRect(cursorX, cursorY + this.cellHeight - 2, this.cellWidth, 2)
        break
      case 'bar':
        ctx.fillRect(cursorX, cursorY, 2, this.cellHeight)
        break
    }
  }
  
  /**
   * 获取样式键 (用于批量渲染)
   */
  getStyleKey(style) {
    if (!style) return 'default'
    
    return [
      style.foreground || 'default',
      style.background || 'default',
      style.bold || false,
      style.italic || false,
      style.underline || false
    ].join('|')
  }
  
  /**
   * 比较样式是否相同
   */
  isSameStyle(style1, style2) {
    if (!style1 && !style2) return true
    if (!style1 || !style2) return false
    
    return (
      style1.foreground === style2.foreground &&
      style1.background === style2.background &&
      style1.bold === style2.bold &&
      style1.italic === style2.italic &&
      style1.underline === style2.underline
    )
  }
  
  /**
   * 处理尺寸变化
   */
  handleResize() {
    this.calculateDimensions()
    this.updateCanvasSize()
    
    if (this.canvas) {
      this.canvas.width = this.canvasWidth * this.pixelRatio
      this.canvas.height = this.canvasHeight * this.pixelRatio
      this.canvas.style.width = this.canvasWidth + 'px'
      this.canvas.style.height = this.canvasHeight + 'px'
      
      this.setupContext()
    }
    
    if (this.offscreenCanvas) {
      this.setupOffscreenCanvas()
    }
  }
  
  /**
   * 处理像素比变化
   */
  handlePixelRatioChange() {
    const newPixelRatio = window.devicePixelRatio || 1
    if (newPixelRatio !== this.pixelRatio) {
      this.pixelRatio = newPixelRatio
      this.handleResize()
    }
  }
  
  /**
   * 清空内容
   */
  clear() {
    if (this.ctx) {
      this.clearCanvas(this.ctx)
      this.drawBackground(this.ctx)
    }
  }
  
  /**
   * 销毁渲染器
   */
  destroy() {
    // 清理事件监听
    window.removeEventListener('resize', this.handleResize.bind(this))
    
    // 清理Canvas
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas)
    }
    
    // 清理缓存
    this.textMetricsCache.clear()
    
    super.destroy()
  }
  
  /**
   * 获取性能指标
   */
  getMetrics() {
    return {
      ...super.getMetrics(),
      pixelRatio: this.pixelRatio,
      offscreenRendering: !!this.offscreenCanvas,
      textBatching: this.enableTextBatching,
      touchOptimized: this.optimizeForTouch,
      cacheSize: this.textMetricsCache.size
    }
  }
}