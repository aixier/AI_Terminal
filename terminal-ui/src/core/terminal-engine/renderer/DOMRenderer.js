/**
 * DOM 渲染器 - 兼容性回退方案
 * 使用DOM元素进行终端渲染，确保最大兼容性
 */

import { TerminalRenderer } from './TerminalRenderer.js'

export class DOMRenderer extends TerminalRenderer {
  constructor(options = {}) {
    super(options)
    
    this.type = 'dom'
    this.terminalElement = null
    this.lineElements = []
    
    // DOM特定配置
    this.enableAccessibility = options.enableAccessibility !== false
    this.enableSelection = options.enableSelection !== false
    this.virtualScrolling = options.virtualScrolling !== false
    
    // 虚拟滚动相关
    this.scrollContainer = null
    this.visibleStartIndex = 0
    this.visibleEndIndex = 0
    this.overscanCount = 5 // 预渲染行数
    
    // 性能优化
    this.renderCache = new Map()
    this.styleCache = new Map()
    this.lastViewport = null
    
    // 无障碍访问
    this.ariaLiveRegion = null
  }
  
  /**
   * 初始化DOM渲染器
   */
  initialize() {
    super.initialize()
    
    this.createTerminalElement()
    this.setupStyles()
    this.setupVirtualScrolling()
    this.setupAccessibility()
    
    this.emit('initialized')
  }
  
  /**
   * 创建终端DOM元素
   */
  createTerminalElement() {
    this.terminalElement = document.createElement('div')
    this.terminalElement.className = 'terminal-dom-renderer'
    
    // 基础样式
    Object.assign(this.terminalElement.style, {
      position: 'relative',
      width: '100%',
      height: '100%',
      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
      fontSize: '14px',
      lineHeight: '1.2',
      color: this.theme.foreground,
      backgroundColor: this.theme.background,
      overflow: 'hidden',
      whiteSpace: 'pre',
      cursor: 'text'
    })
    
    // 设备特定样式
    if (this.device === 'mobile') {
      Object.assign(this.terminalElement.style, {
        touchAction: 'manipulation',
        userSelect: this.enableSelection ? 'text' : 'none',
        webkitTouchCallout: 'none',
        webkitUserSelect: this.enableSelection ? 'text' : 'none'
      })
    }
    
    this.container.appendChild(this.terminalElement)
  }
  
  /**
   * 设置CSS样式
   */
  setupStyles() {
    // 创建样式表
    const styleSheet = document.createElement('style')
    styleSheet.textContent = this.generateCSS()
    document.head.appendChild(styleSheet)
    this.styleSheet = styleSheet
  }
  
  /**
   * 生成CSS样式
   */
  generateCSS() {
    return `
      .terminal-dom-renderer {
        tab-size: 8;
        -moz-tab-size: 8;
      }
      
      .terminal-line {
        display: block;
        min-height: 1.2em;
        word-wrap: break-word;
        word-break: break-all;
      }
      
      .terminal-char {
        display: inline;
      }
      
      /* ANSI颜色类 */
      .ansi-fg-black { color: ${this.theme.black}; }
      .ansi-fg-red { color: ${this.theme.red}; }
      .ansi-fg-green { color: ${this.theme.green}; }
      .ansi-fg-yellow { color: ${this.theme.yellow}; }
      .ansi-fg-blue { color: ${this.theme.blue}; }
      .ansi-fg-magenta { color: ${this.theme.magenta}; }
      .ansi-fg-cyan { color: ${this.theme.cyan}; }
      .ansi-fg-white { color: ${this.theme.white}; }
      
      .ansi-bg-black { background-color: ${this.theme.black}; }
      .ansi-bg-red { background-color: ${this.theme.red}; }
      .ansi-bg-green { background-color: ${this.theme.green}; }
      .ansi-bg-yellow { background-color: ${this.theme.yellow}; }
      .ansi-bg-blue { background-color: ${this.theme.blue}; }
      .ansi-bg-magenta { background-color: ${this.theme.magenta}; }
      .ansi-bg-cyan { background-color: ${this.theme.cyan}; }
      .ansi-bg-white { background-color: ${this.theme.white}; }
      
      /* 文本样式 */
      .ansi-bold { font-weight: bold; }
      .ansi-italic { font-style: italic; }
      .ansi-underline { text-decoration: underline; }
      .ansi-strikethrough { text-decoration: line-through; }
      
      /* 光标样式 */
      .terminal-cursor {
        background-color: ${this.theme.cursor};
        color: ${this.theme.background};
        animation: terminal-cursor-blink 1s step-end infinite;
      }
      
      @keyframes terminal-cursor-blink {
        0%, 50% { opacity: 1; }
        51%, 100% { opacity: 0; }
      }
      
      .terminal-cursor.cursor-block {
        display: inline-block;
        width: 1ch;
      }
      
      .terminal-cursor.cursor-underline {
        border-bottom: 2px solid ${this.theme.cursor};
        background-color: transparent;
        color: inherit;
      }
      
      .terminal-cursor.cursor-bar {
        border-left: 2px solid ${this.theme.cursor};
        background-color: transparent;
        color: inherit;
      }
      
      /* 选择样式 */
      .terminal-dom-renderer ::selection {
        background-color: ${this.theme.selection || 'rgba(255, 255, 255, 0.3)'};
      }
      
      /* 虚拟滚动 */
      .terminal-virtual-scroll {
        position: relative;
        height: 100%;
        overflow-y: auto;
      }
      
      .terminal-virtual-content {
        position: relative;
      }
      
      .terminal-virtual-spacer {
        height: 0;
      }
    `
  }
  
  /**
   * 设置虚拟滚动
   */
  setupVirtualScrolling() {
    if (!this.virtualScrolling) return
    
    this.scrollContainer = document.createElement('div')
    this.scrollContainer.className = 'terminal-virtual-scroll'
    
    this.virtualContent = document.createElement('div')
    this.virtualContent.className = 'terminal-virtual-content'
    
    this.topSpacer = document.createElement('div')
    this.topSpacer.className = 'terminal-virtual-spacer'
    
    this.bottomSpacer = document.createElement('div')
    this.bottomSpacer.className = 'terminal-virtual-spacer'
    
    this.virtualContent.appendChild(this.topSpacer)
    this.virtualContent.appendChild(this.terminalElement)
    this.virtualContent.appendChild(this.bottomSpacer)
    
    this.scrollContainer.appendChild(this.virtualContent)
    this.container.appendChild(this.scrollContainer)
    
    // 滚动事件监听
    this.scrollContainer.addEventListener('scroll', 
      this.throttle(this.handleScroll.bind(this), 16)
    )
  }
  
  /**
   * 设置无障碍访问
   */
  setupAccessibility() {
    if (!this.enableAccessibility) return
    
    // 设置ARIA属性
    this.terminalElement.setAttribute('role', 'textbox')
    this.terminalElement.setAttribute('aria-multiline', 'true')
    this.terminalElement.setAttribute('aria-readonly', 'true')
    this.terminalElement.setAttribute('aria-label', 'Terminal output')
    
    // 创建实时区域用于屏幕阅读器
    this.ariaLiveRegion = document.createElement('div')
    this.ariaLiveRegion.setAttribute('aria-live', 'polite')
    this.ariaLiveRegion.setAttribute('aria-atomic', 'false')
    this.ariaLiveRegion.style.position = 'absolute'
    this.ariaLiveRegion.style.left = '-10000px'
    this.ariaLiveRegion.style.width = '1px'
    this.ariaLiveRegion.style.height = '1px'
    this.ariaLiveRegion.style.overflow = 'hidden'
    
    document.body.appendChild(this.ariaLiveRegion)
  }
  
  /**
   * 主渲染方法
   * @param {Object} viewport - 视口数据
   */
  render(viewport) {
    if (!viewport || !this.terminalElement) return
    
    const startTime = performance.now()
    
    try {
      if (this.virtualScrolling) {
        this.renderVirtual(viewport)
      } else {
        this.renderDirect(viewport)
      }
      
      // 渲染光标
      this.renderCursor(viewport)
      
      // 更新无障碍信息
      this.updateAccessibility(viewport)
      
      const endTime = performance.now()
      this.lastRenderTime = endTime - startTime
      this.lastViewport = viewport
      
    } catch (error) {
      console.error('[DOMRenderer] Render error:', error)
      this.emit('renderError', error)
    }
  }
  
  /**
   * 虚拟滚动渲染
   */
  renderVirtual(viewport) {
    const { lines } = viewport
    if (!lines) return
    
    // 计算可见范围
    const visibleRange = this.calculateVisibleRange()
    const startIndex = Math.max(0, visibleRange.start - this.overscanCount)
    const endIndex = Math.min(lines.length, visibleRange.end + this.overscanCount)
    
    // 更新间隔元素高度
    this.topSpacer.style.height = `${startIndex * this.cellHeight}px`
    this.bottomSpacer.style.height = `${(lines.length - endIndex) * this.cellHeight}px`
    
    // 清空当前内容
    this.terminalElement.innerHTML = ''
    
    // 渲染可见行
    for (let i = startIndex; i < endIndex; i++) {
      const line = lines[i]
      if (line) {
        const lineElement = this.createLineElement(line, i)
        this.terminalElement.appendChild(lineElement)
      }
    }
    
    this.visibleStartIndex = startIndex
    this.visibleEndIndex = endIndex
  }
  
  /**
   * 直接渲染
   */
  renderDirect(viewport) {
    const { lines } = viewport
    if (!lines) return
    
    // 检查是否需要完全重建
    if (this.needsFullRebuild(viewport)) {
      this.terminalElement.innerHTML = ''
      this.lineElements = []
      
      lines.forEach((line, index) => {
        const lineElement = this.createLineElement(line, index)
        this.terminalElement.appendChild(lineElement)
        this.lineElements.push(lineElement)
      })
    } else {
      // 增量更新
      this.updateChangedLines(viewport)
    }
  }
  
  /**
   * 创建行元素
   */
  createLineElement(line, lineIndex) {
    const lineElement = document.createElement('div')
    lineElement.className = 'terminal-line'
    lineElement.dataset.lineIndex = lineIndex
    
    if (!line || !line.cells) {
      lineElement.innerHTML = '&nbsp;' // 空行占位
      return lineElement
    }
    
    let html = ''
    let currentSpan = null
    let currentStyle = null
    
    line.cells.forEach((cell, colIndex) => {
      if (!cell) {
        html += ' '
        return
      }
      
      const char = cell.char || ' '
      const style = cell.style || {}
      
      // 检查样式是否变化
      if (!this.isSameStyle(currentStyle, style)) {
        // 关闭当前span
        if (currentSpan) {
          html += '</span>'
        }
        
        // 开始新span
        const classes = this.getStyleClasses(style)
        if (classes.length > 0) {
          html += `<span class="${classes.join(' ')}">`
          currentSpan = true
        } else {
          currentSpan = false
        }
        
        currentStyle = style
      }
      
      // 添加字符
      html += this.escapeHtml(char)
    })
    
    // 关闭最后的span
    if (currentSpan) {
      html += '</span>'
    }
    
    lineElement.innerHTML = html || '&nbsp;'
    return lineElement
  }
  
  /**
   * 获取样式类名
   */
  getStyleClasses(style) {
    const classes = []
    
    if (style.foreground) {
      if (typeof style.foreground === 'number') {
        classes.push(`ansi-fg-${this.getColorName(style.foreground)}`)
      }
    }
    
    if (style.background) {
      if (typeof style.background === 'number') {
        classes.push(`ansi-bg-${this.getColorName(style.background)}`)
      }
    }
    
    if (style.bold) classes.push('ansi-bold')
    if (style.italic) classes.push('ansi-italic')
    if (style.underline) classes.push('ansi-underline')
    if (style.strikethrough) classes.push('ansi-strikethrough')
    
    return classes
  }
  
  /**
   * 获取颜色名称
   */
  getColorName(colorCode) {
    const colorNames = [
      'black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'
    ]
    return colorNames[colorCode] || 'white'
  }
  
  /**
   * 渲染光标
   */
  renderCursor(viewport) {
    // 移除现有光标
    const existingCursor = this.terminalElement.querySelector('.terminal-cursor')
    if (existingCursor) {
      existingCursor.classList.remove('terminal-cursor', 'cursor-block', 'cursor-underline', 'cursor-bar')
    }
    
    if (!viewport.cursor || !viewport.cursor.visible) return
    
    const { x, y, style = 'block' } = viewport.cursor
    
    // 找到光标位置的元素
    const lineElement = this.terminalElement.children[y]
    if (!lineElement) return
    
    // 创建光标元素或修改现有字符
    const cursorClass = `cursor-${style}`
    
    if (style === 'block') {
      // 块状光标：修改字符背景
      const charAtCursor = this.getCharElementAt(lineElement, x)
      if (charAtCursor) {
        charAtCursor.classList.add('terminal-cursor', cursorClass)
      }
    } else {
      // 其他光标样式：添加光标元素
      const cursorElement = document.createElement('span')
      cursorElement.className = `terminal-cursor ${cursorClass}`
      cursorElement.textContent = '\u00A0' // 非断空格
      
      this.insertCursorAt(lineElement, x, cursorElement)
    }
  }
  
  /**
   * 获取指定位置的字符元素
   */
  getCharElementAt(lineElement, x) {
    // 这里需要复杂的逻辑来精确定位字符
    // 简化实现：直接返回行元素
    return lineElement
  }
  
  /**
   * 在指定位置插入光标
   */
  insertCursorAt(lineElement, x, cursorElement) {
    // 简化实现：在行末添加光标
    lineElement.appendChild(cursorElement)
  }
  
  /**
   * 计算可见范围
   */
  calculateVisibleRange() {
    if (!this.scrollContainer) {
      return { start: 0, end: this.rows }
    }
    
    const scrollTop = this.scrollContainer.scrollTop
    const containerHeight = this.scrollContainer.clientHeight
    
    const startIndex = Math.floor(scrollTop / this.cellHeight)
    const endIndex = Math.ceil((scrollTop + containerHeight) / this.cellHeight)
    
    return { start: startIndex, end: endIndex }
  }
  
  /**
   * 处理滚动事件
   */
  handleScroll() {
    if (this.virtualScrolling && this.lastViewport) {
      this.renderVirtual(this.lastViewport)
    }
  }
  
  /**
   * 判断是否需要完全重建
   */
  needsFullRebuild(viewport) {
    if (!this.lastViewport) return true
    
    const lastLines = this.lastViewport.lines || []
    const currentLines = viewport.lines || []
    
    return lastLines.length !== currentLines.length
  }
  
  /**
   * 更新变化的行
   */
  updateChangedLines(viewport) {
    const { lines } = viewport
    const lastLines = this.lastViewport.lines || []
    
    lines.forEach((line, index) => {
      const lastLine = lastLines[index]
      if (this.isLineChanged(line, lastLine)) {
        const lineElement = this.lineElements[index]
        if (lineElement) {
          const newLineElement = this.createLineElement(line, index)
          lineElement.parentNode.replaceChild(newLineElement, lineElement)
          this.lineElements[index] = newLineElement
        }
      }
    })
  }
  
  /**
   * 判断行是否变化
   */
  isLineChanged(line1, line2) {
    if (!line1 && !line2) return false
    if (!line1 || !line2) return true
    
    const cells1 = line1.cells || []
    const cells2 = line2.cells || []
    
    if (cells1.length !== cells2.length) return true
    
    return cells1.some((cell, index) => {
      const otherCell = cells2[index]
      return !this.isCellEqual(cell, otherCell)
    })
  }
  
  /**
   * 判断单元格是否相等
   */
  isCellEqual(cell1, cell2) {
    if (!cell1 && !cell2) return true
    if (!cell1 || !cell2) return false
    
    return cell1.char === cell2.char && this.isSameStyle(cell1.style, cell2.style)
  }
  
  /**
   * 更新无障碍信息
   */
  updateAccessibility(viewport) {
    if (!this.enableAccessibility || !this.ariaLiveRegion) return
    
    // 获取新增的行内容用于屏幕阅读器
    const { lines } = viewport
    if (lines && lines.length > 0) {
      const lastLine = lines[lines.length - 1]
      if (lastLine && lastLine.cells) {
        const text = lastLine.cells.map(cell => cell ? cell.char : ' ').join('')
        if (text.trim()) {
          this.ariaLiveRegion.textContent = text
        }
      }
    }
  }
  
  /**
   * HTML转义
   */
  escapeHtml(text) {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }
  
  /**
   * 节流函数
   */
  throttle(func, wait) {
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
      style1.underline === style2.underline &&
      style1.strikethrough === style2.strikethrough
    )
  }
  
  /**
   * 清空内容
   */
  clear() {
    if (this.terminalElement) {
      this.terminalElement.innerHTML = ''
    }
    this.lineElements = []
    this.renderCache.clear()
  }
  
  /**
   * 销毁渲染器
   */
  destroy() {
    // 清理样式表
    if (this.styleSheet && this.styleSheet.parentNode) {
      this.styleSheet.parentNode.removeChild(this.styleSheet)
    }
    
    // 清理无障碍元素
    if (this.ariaLiveRegion && this.ariaLiveRegion.parentNode) {
      this.ariaLiveRegion.parentNode.removeChild(this.ariaLiveRegion)
    }
    
    // 清理事件监听
    if (this.scrollContainer) {
      this.scrollContainer.removeEventListener('scroll', this.handleScroll)
    }
    
    // 清理缓存
    this.renderCache.clear()
    this.styleCache.clear()
    
    super.destroy()
  }
  
  /**
   * 获取性能指标
   */
  getMetrics() {
    return {
      ...super.getMetrics(),
      virtualScrolling: this.virtualScrolling,
      accessibility: this.enableAccessibility,
      selection: this.enableSelection,
      cacheSize: this.renderCache.size,
      lineElements: this.lineElements.length
    }
  }
}