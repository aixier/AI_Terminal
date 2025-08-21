/**
 * 输入管理器 - 处理多端输入事件
 * 统一处理键盘、触摸、手势等输入
 */

import { EventEmitter } from '../utils/EventEmitter.js'

export class InputManager extends EventEmitter {
  constructor(options = {}, context = {}) {
    super()
    
    this.options = options
    this.device = context.device || 'desktop'
    this.container = context.container
    
    // 输入处理器
    this.keyboardHandler = null
    this.touchHandler = null
    this.gestureHandler = null
    
    // 输入状态
    this.isEnabled = true
    this.inputBuffer = []
    this.composing = false
    
    // 功能开关
    this.enableVirtualKeyboard = options.enableVirtualKeyboard || false
    this.enableGestureNavigation = options.enableGestureNavigation || false
    this.enableHapticFeedback = options.enableHapticFeedback || false
    
    this.initialize()
  }
  
  /**
   * 初始化输入管理器
   */
  initialize() {
    this.createInputHandlers()
    this.bindEvents()
    this.setupFeatures()
    this.emit('initialized')
  }
  
  /**
   * 创建输入处理器
   */
  createInputHandlers() {
    // 键盘处理器
    this.keyboardHandler = new KeyboardHandler({
      device: this.device,
      container: this.container
    })
    
    // 移动端特殊处理器
    if (this.device === 'mobile') {
      this.touchHandler = new TouchHandler({
        container: this.container,
        enableGestures: this.enableGestureNavigation
      })
      
      if (this.enableVirtualKeyboard) {
        this.virtualKeyboard = new VirtualKeyboard({
          container: this.container
        })
      }
    }
  }
  
  /**
   * 绑定事件
   */
  bindEvents() {
    // 键盘事件
    this.keyboardHandler.on('input', this.handleKeyboardInput.bind(this))
    this.keyboardHandler.on('command', this.handleKeyboardCommand.bind(this))
    
    // 触摸事件
    if (this.touchHandler) {
      this.touchHandler.on('input', this.handleTouchInput.bind(this))
      this.touchHandler.on('gesture', this.handleGesture.bind(this))
    }
    
    // 虚拟键盘事件
    if (this.virtualKeyboard) {
      this.virtualKeyboard.on('input', this.handleVirtualInput.bind(this))
      this.virtualKeyboard.on('command', this.handleVirtualCommand.bind(this))
    }
  }
  
  /**
   * 设置功能
   */
  setupFeatures() {
    // 设置虚拟键盘
    if (this.enableVirtualKeyboard && this.virtualKeyboard) {
      this.virtualKeyboard.show()
    }
    
    // 设置触觉反馈
    if (this.enableHapticFeedback && 'vibrate' in navigator) {
      this.hapticEnabled = true
    }
  }
  
  /**
   * 处理键盘输入
   */
  handleKeyboardInput(data) {
    if (!this.isEnabled) return
    
    this.emit('input', {
      type: 'keyboard',
      data: data.text,
      originalEvent: data.event
    })
  }
  
  /**
   * 处理键盘命令
   */
  handleKeyboardCommand(data) {
    if (!this.isEnabled) return
    
    this.emit('command', {
      type: 'keyboard',
      command: data.command,
      params: data.params,
      originalEvent: data.event
    })
  }
  
  /**
   * 处理触摸输入
   */
  handleTouchInput(data) {
    if (!this.isEnabled) return
    
    // 触觉反馈
    if (this.hapticEnabled) {
      navigator.vibrate(10)
    }
    
    this.emit('input', {
      type: 'touch',
      data: data.text,
      originalEvent: data.event
    })
  }
  
  /**
   * 处理手势
   */
  handleGesture(data) {
    if (!this.isEnabled) return
    
    this.emit('gesture', {
      type: data.gestureType,
      direction: data.direction,
      distance: data.distance,
      originalEvent: data.event
    })
  }
  
  /**
   * 处理虚拟键盘输入
   */
  handleVirtualInput(data) {
    if (!this.isEnabled) return
    
    this.emit('input', {
      type: 'virtual',
      data: data.text,
      originalEvent: data.event
    })
  }
  
  /**
   * 处理虚拟键盘命令
   */
  handleVirtualCommand(data) {
    if (!this.isEnabled) return
    
    this.emit('command', {
      type: 'virtual',
      command: data.command,
      params: data.params,
      originalEvent: data.event
    })
  }
  
  /**
   * 设置虚拟键盘启用状态
   */
  setVirtualKeyboardEnabled(enabled) {
    this.enableVirtualKeyboard = enabled
    
    if (this.virtualKeyboard) {
      if (enabled) {
        this.virtualKeyboard.show()
      } else {
        this.virtualKeyboard.hide()
      }
    }
  }
  
  /**
   * 设置手势导航启用状态
   */
  setGestureNavigationEnabled(enabled) {
    this.enableGestureNavigation = enabled
    
    if (this.touchHandler) {
      this.touchHandler.setGestureEnabled(enabled)
    }
  }
  
  /**
   * 启用/禁用输入
   */
  setEnabled(enabled) {
    this.isEnabled = enabled
    this.emit('enabledChange', enabled)
  }
  
  /**
   * 销毁输入管理器
   */
  destroy() {
    this.isEnabled = false
    
    // 销毁处理器
    if (this.keyboardHandler) {
      this.keyboardHandler.destroy()
    }
    
    if (this.touchHandler) {
      this.touchHandler.destroy()
    }
    
    if (this.virtualKeyboard) {
      this.virtualKeyboard.destroy()
    }
    
    // 清理事件
    this.removeAllListeners()
    
    this.emit('destroyed')
  }
}

/**
 * 键盘处理器
 */
class KeyboardHandler extends EventEmitter {
  constructor(options = {}) {
    super()
    
    this.device = options.device
    this.container = options.container
    this.isEnabled = true
    
    this.bindEvents()
  }
  
  bindEvents() {
    if (!this.container) return
    
    this.container.addEventListener('keydown', this.handleKeyDown.bind(this))
    this.container.addEventListener('keypress', this.handleKeyPress.bind(this))
    this.container.addEventListener('keyup', this.handleKeyUp.bind(this))
    
    // 确保容器可以接收焦点
    if (this.container.tabIndex < 0) {
      this.container.tabIndex = 0
    }
  }
  
  handleKeyDown(event) {
    if (!this.isEnabled) return
    
    // 处理特殊键
    const key = event.key
    const ctrl = event.ctrlKey
    const alt = event.altKey
    const shift = event.shiftKey
    
    // 组合键命令
    if (ctrl || alt) {
      this.emit('command', {
        command: this.getCommandFromKey(key, { ctrl, alt, shift }),
        params: { key, ctrl, alt, shift },
        event
      })
      return
    }
    
    // 功能键
    if (this.isFunctionKey(key)) {
      this.emit('command', {
        command: key.toLowerCase(),
        params: { key },
        event
      })
      event.preventDefault()
      return
    }
  }
  
  handleKeyPress(event) {
    if (!this.isEnabled) return
    
    const char = event.key
    
    // 只处理可打印字符
    if (char.length === 1 && !event.ctrlKey && !event.altKey) {
      this.emit('input', {
        text: char,
        event
      })
    }
  }
  
  handleKeyUp(event) {
    // 键盘抬起事件处理
  }
  
  getCommandFromKey(key, modifiers) {
    const { ctrl, alt, shift } = modifiers
    
    if (ctrl) {
      switch (key.toLowerCase()) {
        case 'c': return 'copy'
        case 'v': return 'paste'
        case 'a': return 'selectAll'
        case 'l': return 'clear'
        case 'd': return 'eof'
        default: return `ctrl+${key.toLowerCase()}`
      }
    }
    
    if (alt) {
      return `alt+${key.toLowerCase()}`
    }
    
    return key.toLowerCase()
  }
  
  isFunctionKey(key) {
    const functionKeys = [
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
      'Home', 'End', 'PageUp', 'PageDown',
      'Insert', 'Delete', 'Backspace',
      'Tab', 'Enter', 'Escape'
    ]
    
    return functionKeys.includes(key)
  }
  
  destroy() {
    this.isEnabled = false
    this.removeAllListeners()
  }
}

/**
 * 触摸处理器
 */
class TouchHandler extends EventEmitter {
  constructor(options = {}) {
    super()
    
    this.container = options.container
    this.enableGestures = options.enableGestures || false
    this.isEnabled = true
    
    // 触摸状态
    this.touchStart = null
    this.touchEnd = null
    this.longPressTimer = null
    
    this.bindEvents()
  }
  
  bindEvents() {
    if (!this.container) return
    
    this.container.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false })
    this.container.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false })
    this.container.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false })
    this.container.addEventListener('touchcancel', this.handleTouchCancel.bind(this))
  }
  
  handleTouchStart(event) {
    if (!this.isEnabled) return
    
    const touch = event.touches[0]
    this.touchStart = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    }
    
    // 长按检测
    this.longPressTimer = setTimeout(() => {
      this.handleLongPress(event)
    }, 500)
  }
  
  handleTouchMove(event) {
    if (!this.isEnabled || !this.touchStart) return
    
    // 清除长按定时器
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer)
      this.longPressTimer = null
    }
  }
  
  handleTouchEnd(event) {
    if (!this.isEnabled || !this.touchStart) return
    
    // 清除长按定时器
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer)
      this.longPressTimer = null
    }
    
    const touch = event.changedTouches[0]
    this.touchEnd = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    }
    
    // 手势检测
    if (this.enableGestures) {
      this.detectGesture()
    }
    
    // 点击检测
    this.detectTap()
    
    this.touchStart = null
    this.touchEnd = null
  }
  
  handleTouchCancel(event) {
    this.touchStart = null
    this.touchEnd = null
    
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer)
      this.longPressTimer = null
    }
  }
  
  handleLongPress(event) {
    this.emit('gesture', {
      gestureType: 'longpress',
      originalEvent: event
    })
  }
  
  detectGesture() {
    if (!this.touchStart || !this.touchEnd) return
    
    const deltaX = this.touchEnd.x - this.touchStart.x
    const deltaY = this.touchEnd.y - this.touchStart.y
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
    const time = this.touchEnd.time - this.touchStart.time
    
    // 滑动手势
    if (distance > 30 && time < 300) {
      const direction = Math.abs(deltaX) > Math.abs(deltaY)
        ? (deltaX > 0 ? 'right' : 'left')
        : (deltaY > 0 ? 'down' : 'up')
      
      this.emit('gesture', {
        gestureType: 'swipe',
        direction,
        distance,
        originalEvent: event
      })
    }
  }
  
  detectTap() {
    if (!this.touchStart || !this.touchEnd) return
    
    const deltaX = this.touchEnd.x - this.touchStart.x
    const deltaY = this.touchEnd.y - this.touchStart.y
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
    
    // 点击手势
    if (distance < 10) {
      this.emit('input', {
        text: ' ', // 简单的空格输入
        originalEvent: event
      })
    }
  }
  
  setGestureEnabled(enabled) {
    this.enableGestures = enabled
  }
  
  destroy() {
    this.isEnabled = false
    
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer)
    }
    
    this.removeAllListeners()
  }
}

/**
 * 虚拟键盘 (简化实现)
 */
class VirtualKeyboard extends EventEmitter {
  constructor(options = {}) {
    super()
    
    this.container = options.container
    this.isVisible = false
    this.element = null
    
    this.create()
  }
  
  create() {
    this.element = document.createElement('div')
    this.element.className = 'virtual-keyboard'
    this.element.style.cssText = `
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: #333;
      color: white;
      padding: 10px;
      display: none;
      z-index: 1000;
    `
    
    // 简单的按键布局
    const keys = [
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
      ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
      ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
      ['z', 'x', 'c', 'v', 'b', 'n', 'm']
    ]
    
    keys.forEach(row => {
      const rowElement = document.createElement('div')
      rowElement.style.display = 'flex'
      rowElement.style.marginBottom = '5px'
      
      row.forEach(key => {
        const keyElement = document.createElement('button')
        keyElement.textContent = key
        keyElement.style.cssText = `
          flex: 1;
          margin: 2px;
          padding: 10px;
          background: #555;
          color: white;
          border: none;
          border-radius: 3px;
        `
        
        keyElement.addEventListener('click', () => {
          this.emit('input', { text: key })
        })
        
        rowElement.appendChild(keyElement)
      })
      
      this.element.appendChild(rowElement)
    })
    
    // 特殊按键行
    const specialRow = document.createElement('div')
    specialRow.style.display = 'flex'
    specialRow.style.marginBottom = '5px'
    
    const spaceKey = document.createElement('button')
    spaceKey.textContent = 'Space'
    spaceKey.style.cssText = `
      flex: 3;
      margin: 2px;
      padding: 10px;
      background: #555;
      color: white;
      border: none;
      border-radius: 3px;
    `
    spaceKey.addEventListener('click', () => {
      this.emit('input', { text: ' ' })
    })
    
    const enterKey = document.createElement('button')
    enterKey.textContent = 'Enter'
    enterKey.style.cssText = `
      flex: 1;
      margin: 2px;
      padding: 10px;
      background: #555;
      color: white;
      border: none;
      border-radius: 3px;
    `
    enterKey.addEventListener('click', () => {
      this.emit('command', { command: 'enter' })
    })
    
    specialRow.appendChild(spaceKey)
    specialRow.appendChild(enterKey)
    this.element.appendChild(specialRow)
    
    document.body.appendChild(this.element)
  }
  
  show() {
    if (this.element) {
      this.element.style.display = 'block'
      this.isVisible = true
    }
  }
  
  hide() {
    if (this.element) {
      this.element.style.display = 'none'
      this.isVisible = false
    }
  }
  
  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element)
    }
    this.removeAllListeners()
  }
}