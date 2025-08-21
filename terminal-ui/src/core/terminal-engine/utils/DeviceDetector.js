/**
 * 设备检测工具 - 检测设备能力和特性
 */

export class DeviceDetector {
  static _cache = null
  
  /**
   * 检测设备信息
   * @returns {Object} 设备信息
   */
  static detect() {
    if (this._cache) {
      return this._cache
    }
    
    const userAgent = navigator.userAgent
    const width = window.innerWidth
    const height = window.innerHeight
    
    // 基础设备类型检测
    const isMobile = this.isMobileDevice(userAgent, width)
    const isTablet = this.isTabletDevice(userAgent, width)
    const isDesktop = !isMobile && !isTablet
    
    // 操作系统检测
    const os = this.detectOS(userAgent)
    
    // 浏览器检测
    const browser = this.detectBrowser(userAgent)
    
    // 硬件信息
    const hardware = this.detectHardware()
    
    this._cache = {
      type: isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop',
      isMobile,
      isTablet,
      isDesktop,
      
      screen: {
        width,
        height,
        pixelRatio: window.devicePixelRatio || 1,
        orientation: width > height ? 'landscape' : 'portrait'
      },
      
      os,
      browser,
      hardware,
      
      // 输入能力
      input: {
        touch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
        hover: window.matchMedia('(hover: hover)').matches,
        pointer: window.matchMedia('(pointer: fine)').matches ? 'fine' : 'coarse'
      },
      
      // 网络信息
      network: this.detectNetwork(),
      
      // 时间戳
      detectedAt: Date.now()
    }
    
    return this._cache
  }
  
  /**
   * 检测设备渲染能力
   * @returns {Object} 渲染能力信息
   */
  static getCapabilities() {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    const gl2 = canvas.getContext('webgl2')
    
    return {
      // Canvas支持
      canvas: !!canvas.getContext('2d'),
      offscreenCanvas: typeof OffscreenCanvas !== 'undefined',
      imageBitmap: typeof createImageBitmap !== 'undefined',
      
      // WebGL支持
      webgl: !!gl,
      webgl2: !!gl2,
      
      // WebGL扩展
      textureFloat: gl ? !!gl.getExtension('OES_texture_float') : false,
      instancedArrays: gl ? !!gl.getExtension('ANGLE_instanced_arrays') : false,
      
      // 其他Web API
      webAssembly: typeof WebAssembly !== 'undefined',
      webWorkers: typeof Worker !== 'undefined',
      sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
      
      // 性能API
      performanceObserver: typeof PerformanceObserver !== 'undefined',
      requestIdleCallback: typeof requestIdleCallback !== 'undefined',
      
      // 存储API
      localStorage: this.testLocalStorage(),
      indexedDB: !!window.indexedDB,
      
      // 网络API
      fetch: typeof fetch !== 'undefined',
      webSocket: typeof WebSocket !== 'undefined',
      webRTC: typeof RTCPeerConnection !== 'undefined'
    }
  }
  
  /**
   * 移动设备检测
   */
  static isMobileDevice(userAgent, width) {
    const mobileKeywords = [
      'Android', 'iPhone', 'iPad', 'iPod', 'BlackBerry', 
      'Windows Phone', 'Opera Mini', 'Mobile'
    ]
    
    const isMobileUA = mobileKeywords.some(keyword => 
      userAgent.includes(keyword)
    )
    
    // 结合屏幕宽度判断
    const isMobileWidth = width < 768
    
    return isMobileUA || isMobileWidth
  }
  
  /**
   * 平板设备检测
   */
  static isTabletDevice(userAgent, width) {
    const isIPad = userAgent.includes('iPad')
    const isAndroidTablet = userAgent.includes('Android') && !userAgent.includes('Mobile')
    const isTabletWidth = width >= 768 && width < 1024
    
    return isIPad || isAndroidTablet || isTabletWidth
  }
  
  /**
   * 操作系统检测
   */
  static detectOS(userAgent) {
    if (userAgent.includes('Windows')) return 'Windows'
    if (userAgent.includes('Mac OS')) return 'macOS'
    if (userAgent.includes('Linux')) return 'Linux'
    if (userAgent.includes('Android')) return 'Android'
    if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS'
    return 'Unknown'
  }
  
  /**
   * 浏览器检测
   */
  static detectBrowser(userAgent) {
    if (userAgent.includes('Chrome') && !userAgent.includes('Edge')) return 'Chrome'
    if (userAgent.includes('Firefox')) return 'Firefox'
    if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari'
    if (userAgent.includes('Edge')) return 'Edge'
    if (userAgent.includes('Opera')) return 'Opera'
    return 'Unknown'
  }
  
  /**
   * 硬件信息检测
   */
  static detectHardware() {
    return {
      // 内存信息（如果可用）
      deviceMemory: navigator.deviceMemory || null,
      hardwareConcurrency: navigator.hardwareConcurrency || null,
      
      // 连接信息
      connection: navigator.connection || navigator.mozConnection || navigator.webkitConnection || null
    }
  }
  
  /**
   * 网络信息检测
   */
  static detectNetwork() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection
    
    if (!connection) {
      return { available: false }
    }
    
    return {
      available: true,
      effectiveType: connection.effectiveType || 'unknown',
      downlink: connection.downlink || null,
      rtt: connection.rtt || null,
      saveData: connection.saveData || false
    }
  }
  
  /**
   * 测试localStorage可用性
   */
  static testLocalStorage() {
    try {
      const test = '__localStorage_test__'
      localStorage.setItem(test, test)
      localStorage.removeItem(test)
      return true
    } catch (e) {
      return false
    }
  }
  
  /**
   * 获取性能等级
   * @returns {string} 性能等级 ('low'|'medium'|'high')
   */
  static getPerformanceLevel() {
    const device = this.detect()
    const capabilities = this.getCapabilities()
    
    // 基于设备类型的基础评分
    let score = 0
    
    if (device.type === 'desktop') score += 40
    else if (device.type === 'tablet') score += 25
    else score += 15 // mobile
    
    // 基于内存的评分
    if (device.hardware.deviceMemory) {
      score += Math.min(device.hardware.deviceMemory * 5, 25)
    } else {
      score += 15 // 默认值
    }
    
    // 基于CPU核心数的评分
    if (device.hardware.hardwareConcurrency) {
      score += Math.min(device.hardware.hardwareConcurrency * 3, 15)
    } else {
      score += 8 // 默认值
    }
    
    // 基于渲染能力的评分
    if (capabilities.webgl2) score += 15
    else if (capabilities.webgl) score += 10
    else if (capabilities.canvas) score += 5
    
    // 基于其他能力的评分
    if (capabilities.webAssembly) score += 5
    if (capabilities.webWorkers) score += 5
    if (capabilities.sharedArrayBuffer) score += 5
    
    // 评级
    if (score >= 80) return 'high'
    if (score >= 50) return 'medium'
    return 'low'
  }
  
  /**
   * 清除缓存（用于测试或强制重新检测）
   */
  static clearCache() {
    this._cache = null
  }
  
  /**
   * 获取推荐配置
   * @returns {Object} 推荐的Terminal Engine配置
   */
  static getRecommendedConfig() {
    const device = this.detect()
    const capabilities = this.getCapabilities()
    const performanceLevel = this.getPerformanceLevel()
    
    const config = {
      device: device.type,
      
      renderer: {
        type: 'auto'
      },
      
      buffer: {
        maxLines: performanceLevel === 'high' ? 20000 : 
                  performanceLevel === 'medium' ? 10000 : 5000
      },
      
      performance: {
        targetFPS: device.type === 'mobile' ? 30 : 60,
        enableBatching: true,
        enableVirtualScrolling: true
      }
    }
    
    // 移动端特殊配置
    if (device.type === 'mobile') {
      config.input = {
        enableVirtualKeyboard: true,
        enableGestureNavigation: true,
        enableHapticFeedback: device.input.touch
      }
      
      config.renderer.optimizeForTouch = true
      config.performance.memoryOptimization = true
    }
    
    // 桌面端特殊配置
    if (device.type === 'desktop') {
      config.input = {
        enableKeyboardShortcuts: true,
        enableMouseSupport: true
      }
      
      if (capabilities.webgl) {
        config.renderer.enableTextAtlas = true
        config.renderer.enableWebGL2 = capabilities.webgl2
      }
    }
    
    return config
  }
}