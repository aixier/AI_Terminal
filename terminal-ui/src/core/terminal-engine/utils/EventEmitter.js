/**
 * 事件发射器 - 轻量级事件系统
 */

export class EventEmitter {
  constructor() {
    this._events = new Map()
    this._maxListeners = 10
  }
  
  /**
   * 添加事件监听器
   * @param {string} event - 事件名称
   * @param {Function} listener - 监听函数
   * @returns {EventEmitter} 链式调用
   */
  on(event, listener) {
    if (typeof listener !== 'function') {
      throw new TypeError('Listener must be a function')
    }
    
    if (!this._events.has(event)) {
      this._events.set(event, [])
    }
    
    const listeners = this._events.get(event)
    listeners.push(listener)
    
    // 检查监听器数量警告
    if (listeners.length > this._maxListeners) {
      console.warn(`[EventEmitter] Possible memory leak detected. ${listeners.length} listeners added for event "${event}". Use setMaxListeners() to increase limit.`)
    }
    
    return this
  }
  
  /**
   * 添加一次性事件监听器
   * @param {string} event - 事件名称
   * @param {Function} listener - 监听函数
   * @returns {EventEmitter} 链式调用
   */
  once(event, listener) {
    const onceWrapper = (...args) => {
      this.off(event, onceWrapper)
      listener.apply(this, args)
    }
    
    return this.on(event, onceWrapper)
  }
  
  /**
   * 移除事件监听器
   * @param {string} event - 事件名称
   * @param {Function} listener - 要移除的监听函数
   * @returns {EventEmitter} 链式调用
   */
  off(event, listener) {
    if (!this._events.has(event)) {
      return this
    }
    
    const listeners = this._events.get(event)
    const index = listeners.indexOf(listener)
    
    if (index !== -1) {
      listeners.splice(index, 1)
      
      // 如果没有监听器了，删除事件
      if (listeners.length === 0) {
        this._events.delete(event)
      }
    }
    
    return this
  }
  
  /**
   * 移除所有监听器
   * @param {string} [event] - 可选的事件名称，不传则移除所有
   * @returns {EventEmitter} 链式调用
   */
  removeAllListeners(event) {
    if (event) {
      this._events.delete(event)
    } else {
      this._events.clear()
    }
    
    return this
  }
  
  /**
   * 触发事件
   * @param {string} event - 事件名称
   * @param {...any} args - 传递给监听器的参数
   * @returns {boolean} 是否有监听器处理了该事件
   */
  emit(event, ...args) {
    if (!this._events.has(event)) {
      return false
    }
    
    const listeners = this._events.get(event).slice() // 复制数组避免在循环中修改
    
    for (const listener of listeners) {
      try {
        listener.apply(this, args)
      } catch (error) {
        console.error(`[EventEmitter] Error in event listener for "${event}":`, error)
        this.emit('error', error)
      }
    }
    
    return true
  }
  
  /**
   * 获取事件的监听器数量
   * @param {string} event - 事件名称
   * @returns {number} 监听器数量
   */
  listenerCount(event) {
    if (!this._events.has(event)) {
      return 0
    }
    
    return this._events.get(event).length
  }
  
  /**
   * 获取事件的所有监听器
   * @param {string} event - 事件名称
   * @returns {Function[]} 监听器数组
   */
  listeners(event) {
    if (!this._events.has(event)) {
      return []
    }
    
    return this._events.get(event).slice() // 返回副本
  }
  
  /**
   * 获取所有事件名称
   * @returns {string[]} 事件名称数组
   */
  eventNames() {
    return Array.from(this._events.keys())
  }
  
  /**
   * 设置最大监听器数量
   * @param {number} n - 最大数量
   * @returns {EventEmitter} 链式调用
   */
  setMaxListeners(n) {
    if (typeof n !== 'number' || n < 0) {
      throw new TypeError('Max listeners must be a non-negative number')
    }
    
    this._maxListeners = n
    return this
  }
  
  /**
   * 获取最大监听器数量
   * @returns {number} 最大数量
   */
  getMaxListeners() {
    return this._maxListeners
  }
}