/**
 * Terminal Buffer - 终端缓冲区管理
 * 高效管理终端显示数据和历史记录
 */

import { EventEmitter } from '../utils/EventEmitter.js'

export class TerminalBuffer extends EventEmitter {
  constructor(options = {}) {
    super()
    
    // 缓冲区配置
    this.maxLines = options.maxLines || 10000
    this.cols = options.cols || 80
    this.rows = options.rows || 24
    
    // 缓冲区数据
    this.lines = []
    this.alternateLines = [] // 备用缓冲区
    this.useAlternateBuffer = false
    
    // 光标状态
    this.cursor = {
      x: 0,
      y: 0,
      visible: true,
      style: 'block' // 'block' | 'underline' | 'bar'
    }
    
    // 滚动区域
    this.scrollTop = 0
    this.scrollBottom = this.rows - 1
    this.scrollbackPosition = 0
    
    // 显示状态
    this.viewport = {
      startLine: 0,
      endLine: this.rows
    }
    
    // 样式状态
    this.currentStyle = {
      foreground: null,
      background: null,
      bold: false,
      italic: false,
      underline: false,
      strikethrough: false,
      inverse: false
    }
    
    // 变化追踪
    this.hasChanges = false
    this.dirtyLines = new Set()
    this.lastChangeTime = 0
    
    // 选择区域
    this.selection = {
      active: false,
      startX: 0,
      startY: 0,
      endX: 0,
      endY: 0
    }
    
    // 初始化缓冲区
    this.initialize()
  }
  
  /**
   * 初始化缓冲区
   */
  initialize() {
    this.clear()
    this.emit('initialized')
  }
  
  /**
   * 清空缓冲区
   */
  clear() {
    this.lines = []
    this.alternateLines = []
    
    // 创建空行
    for (let i = 0; i < this.rows; i++) {
      this.lines.push(this.createEmptyLine())
      this.alternateLines.push(this.createEmptyLine())
    }
    
    // 重置状态
    this.cursor = { x: 0, y: 0, visible: true, style: 'block' }
    this.scrollTop = 0
    this.scrollBottom = this.rows - 1
    this.scrollbackPosition = 0
    this.selection.active = false
    
    this.markAllDirty()
    this.emit('clear')
  }
  
  /**
   * 创建空行
   */
  createEmptyLine() {
    return {
      cells: new Array(this.cols).fill(null).map(() => ({
        char: ' ',
        style: { ...this.getDefaultStyle() }
      })),
      length: 0,
      wrapped: false
    }
  }
  
  /**
   * 获取默认样式
   */
  getDefaultStyle() {
    return {
      foreground: null,
      background: null,
      bold: false,
      italic: false,
      underline: false,
      strikethrough: false,
      inverse: false
    }
  }
  
  /**
   * 写入字符
   * @param {string} char - 字符
   */
  writeChar(char) {
    const line = this.getCurrentLine()
    
    // 确保行有足够的单元格
    this.ensureLineLength(line, this.cursor.x + 1)
    
    // 写入字符
    line.cells[this.cursor.x] = {
      char: char,
      style: { ...this.currentStyle }
    }
    
    // 更新行长度
    line.length = Math.max(line.length, this.cursor.x + 1)
    
    // 移动光标
    this.cursor.x++
    
    // 自动换行
    if (this.cursor.x >= this.cols) {
      this.lineFeed()
      this.cursor.x = 0
    }
    
    this.markLineDirty(this.cursor.y)
  }
  
  /**
   * 写入文本
   * @param {string} text - 文本内容
   */
  writeText(text) {
    for (const char of text) {
      if (char === '\n') {
        this.lineFeed()
      } else if (char === '\r') {
        this.carriageReturn()
      } else if (char === '\b') {
        this.backspace()
      } else if (char === '\t') {
        this.tab()
      } else if (char.charCodeAt(0) >= 32) { // 可打印字符
        this.writeChar(char)
      }
    }
  }
  
  /**
   * 应用ANSI命令
   * @param {Object} command - 解析后的ANSI命令
   */
  applyCommand(command) {
    switch (command.type) {
      case 'CHAR':
        this.writeChar(command.char)
        break
        
      case 'CSI':
        this.applyCsiCommand(command)
        break
        
      case 'ESC':
        this.applyEscCommand(command)
        break
        
      case 'CONTROL':
        this.applyControlCommand(command)
        break
        
      default:
        console.warn('[TerminalBuffer] Unknown command type:', command.type)
    }
  }
  
  /**
   * 应用CSI命令
   */
  applyCsiCommand(command) {
    const { finalChar, params = [] } = command
    
    switch (finalChar) {
      case 'A': // 光标上移
        this.cursorUp(params[0] || 1)
        break
        
      case 'B': // 光标下移
        this.cursorDown(params[0] || 1)
        break
        
      case 'C': // 光标右移
        this.cursorForward(params[0] || 1)
        break
        
      case 'D': // 光标左移
        this.cursorBackward(params[0] || 1)
        break
        
      case 'H': // 设置光标位置
      case 'f':
        this.setCursorPosition(params[0] || 1, params[1] || 1)
        break
        
      case 'J': // 清除屏幕
        this.eraseInDisplay(params[0] || 0)
        break
        
      case 'K': // 清除行
        this.eraseInLine(params[0] || 0)
        break
        
      case 'm': // 设置图形模式 (颜色和样式)
        this.setGraphicsMode(params)
        break
        
      case 'r': // 设置滚动区域
        this.setScrollRegion(params[0] || 1, params[1] || this.rows)
        break
        
      case 's': // 保存光标位置
        this.saveCursor()
        break
        
      case 'u': // 恢复光标位置
        this.restoreCursor()
        break
        
      default:
        console.warn('[TerminalBuffer] Unknown CSI command:', finalChar)
    }
  }
  
  /**
   * 光标移动
   */
  cursorUp(lines) {
    this.cursor.y = Math.max(this.scrollTop, this.cursor.y - lines)
    this.markCursorDirty()
  }
  
  cursorDown(lines) {
    this.cursor.y = Math.min(this.scrollBottom, this.cursor.y + lines)
    this.markCursorDirty()
  }
  
  cursorForward(cols) {
    this.cursor.x = Math.min(this.cols - 1, this.cursor.x + cols)
    this.markCursorDirty()
  }
  
  cursorBackward(cols) {
    this.cursor.x = Math.max(0, this.cursor.x - cols)
    this.markCursorDirty()
  }
  
  setCursorPosition(row, col) {
    this.cursor.y = Math.max(0, Math.min(this.rows - 1, row - 1))
    this.cursor.x = Math.max(0, Math.min(this.cols - 1, col - 1))
    this.markCursorDirty()
  }
  
  /**
   * 换行
   */
  lineFeed() {
    if (this.cursor.y < this.scrollBottom) {
      this.cursor.y++
    } else {
      this.scrollUp(1)
    }
    this.markCursorDirty()
  }
  
  /**
   * 回车
   */
  carriageReturn() {
    this.cursor.x = 0
    this.markCursorDirty()
  }
  
  /**
   * 退格
   */
  backspace() {
    if (this.cursor.x > 0) {
      this.cursor.x--
      this.markCursorDirty()
    }
  }
  
  /**
   * 制表符
   */
  tab() {
    const nextTabStop = Math.ceil((this.cursor.x + 1) / 8) * 8
    this.cursor.x = Math.min(this.cols - 1, nextTabStop)
    this.markCursorDirty()
  }
  
  /**
   * 向上滚动
   */
  scrollUp(lines) {
    const currentLines = this.getCurrentLines()
    
    for (let i = 0; i < lines; i++) {
      // 移除第一行，在末尾添加新行
      currentLines.splice(this.scrollTop, 1)
      currentLines.splice(this.scrollBottom, 0, this.createEmptyLine())
      
      // 如果超过最大行数，移除最旧的行
      if (currentLines.length > this.maxLines) {
        currentLines.shift()
      }
    }
    
    this.markAllDirty()
  }
  
  /**
   * 设置图形模式 (ANSI颜色和样式)
   */
  setGraphicsMode(params) {
    if (params.length === 0) {
      // 重置所有样式
      this.currentStyle = { ...this.getDefaultStyle() }
      return
    }
    
    for (const param of params) {
      switch (param) {
        case 0: // 重置
          this.currentStyle = { ...this.getDefaultStyle() }
          break
          
        case 1: // 粗体
          this.currentStyle.bold = true
          break
          
        case 3: // 斜体
          this.currentStyle.italic = true
          break
          
        case 4: // 下划线
          this.currentStyle.underline = true
          break
          
        case 7: // 反色
          this.currentStyle.inverse = true
          break
          
        case 9: // 删除线
          this.currentStyle.strikethrough = true
          break
          
        case 22: // 非粗体
          this.currentStyle.bold = false
          break
          
        case 23: // 非斜体
          this.currentStyle.italic = false
          break
          
        case 24: // 非下划线
          this.currentStyle.underline = false
          break
          
        case 27: // 非反色
          this.currentStyle.inverse = false
          break
          
        case 29: // 非删除线
          this.currentStyle.strikethrough = false
          break
          
        default:
          // 前景色 (30-37, 90-97)
          if (param >= 30 && param <= 37) {
            this.currentStyle.foreground = param - 30
          } else if (param >= 90 && param <= 97) {
            this.currentStyle.foreground = param - 90 + 8
          }
          // 背景色 (40-47, 100-107)
          else if (param >= 40 && param <= 47) {
            this.currentStyle.background = param - 40
          } else if (param >= 100 && param <= 107) {
            this.currentStyle.background = param - 100 + 8
          }
          // 重置前景色/背景色
          else if (param === 39) {
            this.currentStyle.foreground = null
          } else if (param === 49) {
            this.currentStyle.background = null
          }
      }
    }
  }
  
  /**
   * 清除显示内容
   */
  eraseInDisplay(mode) {
    switch (mode) {
      case 0: // 从光标到屏幕末尾
        this.clearFromCursorToEnd()
        break
      case 1: // 从屏幕开始到光标
        this.clearFromStartToCursor()
        break
      case 2: // 整个屏幕
        this.clearScreen()
        break
    }
  }
  
  /**
   * 清除行内容
   */
  eraseInLine(mode) {
    const line = this.getCurrentLine()
    
    switch (mode) {
      case 0: // 从光标到行末
        for (let x = this.cursor.x; x < this.cols; x++) {
          line.cells[x] = { char: ' ', style: { ...this.getDefaultStyle() } }
        }
        break
      case 1: // 从行首到光标
        for (let x = 0; x <= this.cursor.x; x++) {
          line.cells[x] = { char: ' ', style: { ...this.getDefaultStyle() } }
        }
        break
      case 2: // 整行
        for (let x = 0; x < this.cols; x++) {
          line.cells[x] = { char: ' ', style: { ...this.getDefaultStyle() } }
        }
        line.length = 0
        break
    }
    
    this.markLineDirty(this.cursor.y)
  }
  
  /**
   * 重置尺寸
   */
  resize(cols, rows) {
    const oldCols = this.cols
    const oldRows = this.rows
    
    this.cols = cols
    this.rows = rows
    this.scrollBottom = this.rows - 1
    
    // 调整现有行
    const currentLines = this.getCurrentLines()
    
    currentLines.forEach(line => {
      if (line.cells.length < cols) {
        // 增加列
        while (line.cells.length < cols) {
          line.cells.push({ char: ' ', style: { ...this.getDefaultStyle() } })
        }
      } else if (line.cells.length > cols) {
        // 减少列
        line.cells = line.cells.slice(0, cols)
        line.length = Math.min(line.length, cols)
      }
    })
    
    // 调整行数
    if (rows > oldRows) {
      // 增加行
      while (currentLines.length < rows) {
        currentLines.push(this.createEmptyLine())
      }
    } else if (rows < oldRows) {
      // 减少行
      currentLines.splice(rows)
    }
    
    // 调整光标位置
    this.cursor.x = Math.min(this.cursor.x, this.cols - 1)
    this.cursor.y = Math.min(this.cursor.y, this.rows - 1)
    
    this.markAllDirty()
    this.emit('resize', { cols, rows, oldCols, oldRows })
  }
  
  /**
   * 获取当前行
   */
  getCurrentLine() {
    const lines = this.getCurrentLines()
    return lines[this.cursor.y] || this.createEmptyLine()
  }
  
  /**
   * 获取当前缓冲区
   */
  getCurrentLines() {
    return this.useAlternateBuffer ? this.alternateLines : this.lines
  }
  
  /**
   * 确保行长度
   */
  ensureLineLength(line, length) {
    while (line.cells.length < length) {
      line.cells.push({ char: ' ', style: { ...this.getDefaultStyle() } })
    }
  }
  
  /**
   * 获取视口数据
   */
  getViewport() {
    const lines = this.getCurrentLines()
    const visibleLines = lines.slice(
      this.viewport.startLine,
      this.viewport.endLine
    )
    
    return {
      lines: visibleLines,
      cursor: { ...this.cursor },
      viewport: { ...this.viewport },
      selection: this.selection.active ? { ...this.selection } : null,
      hasChanges: this.hasChanges
    }
  }
  
  /**
   * 获取缓冲区尺寸
   */
  getSize() {
    return {
      cols: this.cols,
      rows: this.rows
    }
  }
  
  /**
   * 获取行数
   */
  getLineCount() {
    return this.getCurrentLines().length
  }
  
  /**
   * 标记行为脏
   */
  markLineDirty(lineIndex) {
    this.dirtyLines.add(lineIndex)
    this.markChanged()
  }
  
  /**
   * 标记所有行为脏
   */
  markAllDirty() {
    this.dirtyLines.clear()
    for (let i = 0; i < this.rows; i++) {
      this.dirtyLines.add(i)
    }
    this.markChanged()
  }
  
  /**
   * 标记光标为脏
   */
  markCursorDirty() {
    this.markChanged()
  }
  
  /**
   * 标记已变化
   */
  markChanged() {
    this.hasChanges = true
    this.lastChangeTime = Date.now()
    this.emit('change', {
      dirtyLines: Array.from(this.dirtyLines),
      cursor: { ...this.cursor },
      timestamp: this.lastChangeTime
    })
  }
  
  /**
   * 清除变化标记
   */
  clearChanges() {
    this.hasChanges = false
    this.dirtyLines.clear()
  }
  
  /**
   * 检查是否有变化
   */
  hasChanges() {
    return this.hasChanges
  }
  
  /**
   * 获取行内容 (纯文本)
   */
  getLineText(lineIndex) {
    const lines = this.getCurrentLines()
    const line = lines[lineIndex]
    
    if (!line) return ''
    
    return line.cells
      .slice(0, line.length)
      .map(cell => cell ? cell.char : ' ')
      .join('')
      .trimEnd()
  }
  
  /**
   * 获取选择的文本
   */
  getSelectedText() {
    if (!this.selection.active) return ''
    
    const { startY, startX, endY, endX } = this.selection
    let text = ''
    
    for (let y = startY; y <= endY; y++) {
      const lineText = this.getLineText(y)
      
      if (y === startY && y === endY) {
        // 单行选择
        text += lineText.slice(startX, endX + 1)
      } else if (y === startY) {
        // 第一行
        text += lineText.slice(startX) + '\n'
      } else if (y === endY) {
        // 最后一行
        text += lineText.slice(0, endX + 1)
      } else {
        // 中间行
        text += lineText + '\n'
      }
    }
    
    return text
  }
  
  /**
   * 保存光标位置
   */
  saveCursor() {
    this.savedCursor = { ...this.cursor }
  }
  
  /**
   * 恢复光标位置
   */
  restoreCursor() {
    if (this.savedCursor) {
      this.cursor = { ...this.savedCursor }
      this.markCursorDirty()
    }
  }
  
  /**
   * 清除屏幕相关方法
   */
  clearFromCursorToEnd() {
    // 清除当前行从光标到末尾
    this.eraseInLine(0)
    
    // 清除下面所有行
    const lines = this.getCurrentLines()
    for (let y = this.cursor.y + 1; y < this.rows; y++) {
      const line = lines[y]
      if (line) {
        for (let x = 0; x < this.cols; x++) {
          line.cells[x] = { char: ' ', style: { ...this.getDefaultStyle() } }
        }
        line.length = 0
        this.markLineDirty(y)
      }
    }
  }
  
  clearFromStartToCursor() {
    // 清除上面所有行
    const lines = this.getCurrentLines()
    for (let y = 0; y < this.cursor.y; y++) {
      const line = lines[y]
      if (line) {
        for (let x = 0; x < this.cols; x++) {
          line.cells[x] = { char: ' ', style: { ...this.getDefaultStyle() } }
        }
        line.length = 0
        this.markLineDirty(y)
      }
    }
    
    // 清除当前行从开始到光标
    this.eraseInLine(1)
  }
  
  clearScreen() {
    const lines = this.getCurrentLines()
    for (let y = 0; y < this.rows; y++) {
      const line = lines[y]
      if (line) {
        for (let x = 0; x < this.cols; x++) {
          line.cells[x] = { char: ' ', style: { ...this.getDefaultStyle() } }
        }
        line.length = 0
        this.markLineDirty(y)
      }
    }
  }
}