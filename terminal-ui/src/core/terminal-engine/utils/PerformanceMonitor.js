/**
 * 性能监控器 - 监控Terminal Engine性能指标
 * 提供FPS、渲染时间、内存使用等性能数据
 */

import { EventEmitter } from './EventEmitter.js'

export class PerformanceMonitor extends EventEmitter {
  constructor(options = {}) {
    super()
    
    this.options = {
      targetFPS: options.targetFPS || 60,
      enableMetrics: options.enableMetrics !== false,
      sampleSize: options.sampleSize || 60, // 采样数量
      updateInterval: options.updateInterval || 1000 // 更新间隔(ms)
    }
    
    // 性能数据
    this.metrics = {
      fps: 0,
      frameTime: 0,
      renderTime: 0,
      frameCount: 0,
      droppedFrames: 0,
      memoryUsage: 0,
      lastUpdateTime: 0
    }
    
    // 采样数据
    this.frameTimes = []
    this.renderTimes = []
    this.frameTimestamps = []
    
    // 监控状态
    this.isMonitoring = false
    this.lastFrameTime = 0
    this.updateTimer = null
    
    // 性能观察者
    this.performanceObserver = null
    this.memoryInfo = null
    
    this.initialize()
  }
  
  /**
   * 初始化性能监控
   */
  initialize() {
    if (!this.options.enableMetrics) return
    
    this.setupPerformanceObserver()
    this.setupMemoryMonitoring()
    this.startMonitoring()
    
    this.emit('initialized')
  }
  
  /**
   * 设置性能观察者
   */
  setupPerformanceObserver() {
    if (typeof PerformanceObserver === 'undefined') return
    
    try {
      this.performanceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        this.processPerformanceEntries(entries)
      })
      
      // 监控渲染相关性能
      this.performanceObserver.observe({
        entryTypes: ['measure', 'navigation', 'paint']
      })
      
    } catch (error) {
      console.warn('[PerformanceMonitor] PerformanceObserver setup failed:', error)
    }
  }
  
  /**
   * 设置内存监控
   */
  setupMemoryMonitoring() {
    // 检查是否支持内存API
    if (performance.memory) {
      this.memoryInfo = performance.memory
    }
  }
  
  /**
   * 开始监控
   */
  startMonitoring() {
    if (this.isMonitoring) return
    
    this.isMonitoring = true
    this.lastFrameTime = performance.now()
    
    // 定期更新指标
    this.updateTimer = setInterval(() => {
      this.updateMetrics()
      this.emit('performanceUpdate', { ...this.metrics })
    }, this.options.updateInterval)
    
    this.emit('monitoringStarted')
  }
  
  /**
   * 停止监控
   */
  stopMonitoring() {
    if (!this.isMonitoring) return
    
    this.isMonitoring = false
    
    if (this.updateTimer) {
      clearInterval(this.updateTimer)
      this.updateTimer = null
    }
    
    this.emit('monitoringStopped')
  }
  
  /**
   * 记录帧数据
   * @param {number} renderTime - 渲染时间(ms)
   */
  recordFrame(renderTime = 0) {
    if (!this.isMonitoring) return
    
    const now = performance.now()
    const frameTime = now - this.lastFrameTime
    
    // 记录数据
    this.frameTimes.push(frameTime)
    this.renderTimes.push(renderTime)
    this.frameTimestamps.push(now)
    this.metrics.frameCount++
    
    // 检测掉帧
    const targetFrameTime = 1000 / this.options.targetFPS
    if (frameTime > targetFrameTime * 1.5) {
      this.metrics.droppedFrames++
    }
    
    // 保持采样大小
    if (this.frameTimes.length > this.options.sampleSize) {
      this.frameTimes.shift()
      this.renderTimes.shift()
      this.frameTimestamps.shift()
    }
    
    this.lastFrameTime = now
  }
  
  /**
   * 记录渲染完成
   * @param {Object} metrics - 渲染指标
   */
  recordRender(metrics) {
    if (!this.isMonitoring) return
    
    if (metrics.renderTime) {
      this.recordFrame(metrics.renderTime)
    }
    
    this.emit('renderRecorded', metrics)
  }
  
  /**
   * 更新性能指标
   */
  updateMetrics() {
    const now = performance.now()
    
    // 计算FPS
    this.calculateFPS()
    
    // 计算平均帧时间
    this.calculateFrameTime()
    
    // 计算平均渲染时间
    this.calculateRenderTime()
    
    // 更新内存使用
    this.updateMemoryUsage()
    
    this.metrics.lastUpdateTime = now
  }
  
  /**
   * 计算FPS
   */
  calculateFPS() {
    if (this.frameTimestamps.length < 2) return
    
    const timeSpan = this.frameTimestamps[this.frameTimestamps.length - 1] - 
                    this.frameTimestamps[0]
    
    if (timeSpan > 0) {
      this.metrics.fps = (this.frameTimestamps.length - 1) * 1000 / timeSpan
    }
  }
  
  /**
   * 计算平均帧时间
   */
  calculateFrameTime() {
    if (this.frameTimes.length === 0) return
    
    const sum = this.frameTimes.reduce((a, b) => a + b, 0)
    this.metrics.frameTime = sum / this.frameTimes.length
  }
  
  /**
   * 计算平均渲染时间
   */
  calculateRenderTime() {
    if (this.renderTimes.length === 0) return
    
    const sum = this.renderTimes.reduce((a, b) => a + b, 0)
    this.metrics.renderTime = sum / this.renderTimes.length
  }
  
  /**
   * 更新内存使用
   */
  updateMemoryUsage() {
    if (!this.memoryInfo) return
    
    // 转换为MB
    this.metrics.memoryUsage = this.memoryInfo.usedJSHeapSize / (1024 * 1024)
  }
  
  /**
   * 处理性能条目
   */
  processPerformanceEntries(entries) {
    entries.forEach(entry => {
      switch (entry.entryType) {
        case 'paint':
          this.processPaintEntry(entry)
          break
        case 'measure':
          this.processMeasureEntry(entry)
          break
        case 'navigation':
          this.processNavigationEntry(entry)
          break
      }
    })
  }
  
  /**
   * 处理绘制条目
   */
  processPaintEntry(entry) {
    this.emit('paintMetric', {
      name: entry.name,
      startTime: entry.startTime,
      duration: entry.duration
    })
  }
  
  /**
   * 处理测量条目
   */
  processMeasureEntry(entry) {
    this.emit('measureMetric', {
      name: entry.name,
      startTime: entry.startTime,
      duration: entry.duration
    })
  }
  
  /**
   * 处理导航条目
   */
  processNavigationEntry(entry) {
    this.emit('navigationMetric', {
      loadEventEnd: entry.loadEventEnd,
      domContentLoadedEventEnd: entry.domContentLoadedEventEnd,
      responseEnd: entry.responseEnd
    })
  }
  
  /**
   * 获取性能指标
   */
  getMetrics() {
    return { ...this.metrics }
  }
  
  /**
   * 获取详细性能数据
   */
  getDetailedMetrics() {
    return {
      ...this.metrics,
      samples: {
        frameTimes: [...this.frameTimes],
        renderTimes: [...this.renderTimes],
        frameTimestamps: [...this.frameTimestamps]
      },
      statistics: this.calculateStatistics()
    }
  }
  
  /**
   * 计算统计数据
   */
  calculateStatistics() {
    return {
      frameTime: this.calculateStats(this.frameTimes),
      renderTime: this.calculateStats(this.renderTimes),
      memoryInfo: this.getMemoryInfo()
    }
  }
  
  /**
   * 计算数组统计
   */
  calculateStats(array) {
    if (array.length === 0) {
      return { min: 0, max: 0, avg: 0, median: 0, p95: 0, p99: 0 }
    }
    
    const sorted = [...array].sort((a, b) => a - b)
    const sum = array.reduce((a, b) => a + b, 0)
    
    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / array.length,
      median: this.getPercentile(sorted, 0.5),
      p95: this.getPercentile(sorted, 0.95),
      p99: this.getPercentile(sorted, 0.99)
    }
  }
  
  /**
   * 获取百分位数
   */
  getPercentile(sortedArray, percentile) {
    const index = Math.ceil(sortedArray.length * percentile) - 1
    return sortedArray[Math.max(0, index)]
  }
  
  /**
   * 获取内存信息
   */
  getMemoryInfo() {
    if (!this.memoryInfo) {
      return { available: false }
    }
    
    return {
      available: true,
      usedJSHeapSize: this.memoryInfo.usedJSHeapSize,
      totalJSHeapSize: this.memoryInfo.totalJSHeapSize,
      jsHeapSizeLimit: this.memoryInfo.jsHeapSizeLimit,
      usedMB: this.memoryInfo.usedJSHeapSize / (1024 * 1024),
      totalMB: this.memoryInfo.totalJSHeapSize / (1024 * 1024)
    }
  }
  
  /**
   * 重置统计数据
   */
  reset() {
    this.frameTimes = []
    this.renderTimes = []
    this.frameTimestamps = []
    
    this.metrics = {
      fps: 0,
      frameTime: 0,
      renderTime: 0,
      frameCount: 0,
      droppedFrames: 0,
      memoryUsage: 0,
      lastUpdateTime: 0
    }
    
    this.emit('reset')
  }
  
  /**
   * 设置目标FPS
   */
  setTargetFPS(fps) {
    this.options.targetFPS = fps
    this.emit('targetFPSChanged', fps)
  }
  
  /**
   * 获取性能等级评估
   */
  getPerformanceGrade() {
    const { fps, frameTime, renderTime, droppedFrames } = this.metrics
    const frameCount = this.metrics.frameCount || 1
    
    let score = 100
    
    // FPS评分 (40分)
    const targetFPS = this.options.targetFPS
    const fpsRatio = fps / targetFPS
    if (fpsRatio < 0.5) score -= 40
    else if (fpsRatio < 0.7) score -= 30
    else if (fpsRatio < 0.9) score -= 20
    else if (fpsRatio < 0.95) score -= 10
    
    // 掉帧率评分 (30分)
    const dropRate = droppedFrames / frameCount
    if (dropRate > 0.2) score -= 30
    else if (dropRate > 0.1) score -= 20
    else if (dropRate > 0.05) score -= 10
    else if (dropRate > 0.02) score -= 5
    
    // 渲染时间评分 (20分)
    const targetRenderTime = 1000 / targetFPS * 0.5 // 期望渲染时间不超过帧时间的50%
    if (renderTime > targetRenderTime * 3) score -= 20
    else if (renderTime > targetRenderTime * 2) score -= 15
    else if (renderTime > targetRenderTime * 1.5) score -= 10
    else if (renderTime > targetRenderTime) score -= 5
    
    // 内存使用评分 (10分)
    if (this.metrics.memoryUsage > 200) score -= 10
    else if (this.metrics.memoryUsage > 100) score -= 5
    else if (this.metrics.memoryUsage > 50) score -= 2
    
    // 评级
    if (score >= 90) return { grade: 'A', score, description: '优秀' }
    if (score >= 80) return { grade: 'B', score, description: '良好' }
    if (score >= 70) return { grade: 'C', score, description: '一般' }
    if (score >= 60) return { grade: 'D', score, description: '较差' }
    return { grade: 'F', score, description: '很差' }
  }
  
  /**
   * 销毁监控器
   */
  destroy() {
    this.stopMonitoring()
    
    if (this.performanceObserver) {
      this.performanceObserver.disconnect()
      this.performanceObserver = null
    }
    
    this.removeAllListeners()
    this.emit('destroyed')
  }
}