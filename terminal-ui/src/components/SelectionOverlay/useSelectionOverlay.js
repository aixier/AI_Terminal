/**
 * 选择覆盖层组合式函数
 * 提供选择功能的逻辑封装
 */
import { ref, reactive, computed } from 'vue'

export function useSelectionOverlay(initialConfig = {}) {
  // 默认配置
  const defaultConfig = {
    mode: 'paint',
    brush: {
      size: 20,
      opacity: 0.3,
      color: '#007AFF',
      shape: 'circle'
    },
    behavior: {
      multiSelect: false,
      autoComplete: false,
      magneticSnap: false
    },
    performance: {
      throttleMs: 16,
      sampleRate: 10
    },
    visual: {
      showCursor: true,
      showGrid: false,
      showCoordinates: true,
      showDimensions: false
    },
    thresholds: {
      coverageMin: 0.3,
      selectionMin: 0.1
    }
  }

  // 合并配置
  const config = reactive({
    ...defaultConfig,
    ...initialConfig
  })

  // 状态
  const visible = ref(false)
  const selections = ref([])
  const isProcessing = ref(false)

  // 显示选择覆盖层
  const show = () => {
    visible.value = true
  }

  // 隐藏选择覆盖层
  const hide = () => {
    visible.value = false
  }

  // 切换显示状态
  const toggle = () => {
    visible.value = !visible.value
  }

  // 设置模式
  const setMode = (mode) => {
    config.mode = mode
  }

  // 设置画笔配置
  const setBrush = (brushConfig) => {
    Object.assign(config.brush, brushConfig)
  }

  // 处理选区完成
  const handleSelectionComplete = (selection) => {
    selections.value.push(selection)
    return processSelection(selection)
  }

  // 处理选区（可被覆盖）
  const processSelection = (selection) => {
    // 默认处理逻辑
    return detectElements(selection)
  }

  // 检测元素（针对HTML内容）
  const detectElements = (selection) => {
    const elements = []
    const { bounds } = selection

    // 获取所有元素
    const allElements = document.querySelectorAll('*')

    allElements.forEach(element => {
      const rect = element.getBoundingClientRect()

      // 检查是否相交
      if (isIntersecting(bounds, rect)) {
        const coverage = calculateCoverage(selection, rect)

        if (coverage >= config.thresholds.coverageMin) {
          elements.push({
            element,
            coverage,
            bounds: {
              x: rect.left,
              y: rect.top,
              width: rect.width,
              height: rect.height
            }
          })
        }
      }
    })

    return elements
  }

  // 检查边界是否相交
  const isIntersecting = (bounds1, bounds2) => {
    return !(
      bounds1.x + bounds1.width < bounds2.left ||
      bounds1.x > bounds2.right ||
      bounds1.y + bounds1.height < bounds2.top ||
      bounds1.y > bounds2.bottom
    )
  }

  // 计算覆盖率
  const calculateCoverage = (selection, rect) => {
    const { path } = selection
    const brushRadius = config.brush.size / 2

    // 简化的覆盖率计算
    let coveredPixels = 0
    const sampleSize = 5
    let totalSamples = 0

    for (let x = rect.left; x < rect.right; x += sampleSize) {
      for (let y = rect.top; y < rect.bottom; y += sampleSize) {
        totalSamples++

        for (const point of path) {
          const distance = Math.sqrt(
            Math.pow(x - point.x, 2) +
            Math.pow(y - point.y, 2)
          )

          if (distance <= brushRadius) {
            coveredPixels++
            break
          }
        }
      }
    }

    return totalSamples > 0 ? coveredPixels / totalSamples : 0
  }

  // 清除所有选区
  const clearSelections = () => {
    selections.value = []
  }

  // 获取所有选区
  const getSelections = () => {
    return selections.value
  }

  // 导出数据
  const exportData = (format = 'json') => {
    const data = {
      version: '1.0',
      timestamp: Date.now(),
      config: config,
      selections: selections.value
    }

    if (format === 'json') {
      return JSON.stringify(data, null, 2)
    }
    return data
  }

  // 导入数据
  const importData = (data) => {
    if (typeof data === 'string') {
      data = JSON.parse(data)
    }

    if (data.config) {
      Object.assign(config, data.config)
    }

    if (data.selections) {
      selections.value = data.selections
    }
  }

  return {
    // 状态
    visible,
    config,
    selections,
    isProcessing,

    // 方法
    show,
    hide,
    toggle,
    setMode,
    setBrush,
    handleSelectionComplete,
    processSelection,
    detectElements,
    clearSelections,
    getSelections,
    exportData,
    importData
  }
}

/**
 * HTML适配器
 * 专门处理HTML内容的选择
 */
export class HTMLSelectionAdapter {
  constructor(selectionOverlay) {
    this.overlay = selectionOverlay
  }

  /**
   * 获取选区内的元素
   */
  getElementsInSelection(selection) {
    const elements = []
    const container = this.overlay.container || document.body
    const allElements = container.querySelectorAll('*')

    allElements.forEach(element => {
      const rect = element.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()

      // 转换为相对坐标
      const relRect = {
        left: rect.left - containerRect.left,
        top: rect.top - containerRect.top,
        right: rect.right - containerRect.left,
        bottom: rect.bottom - containerRect.top,
        width: rect.width,
        height: rect.height
      }

      if (this.isIntersecting(selection.bounds, relRect)) {
        const coverage = this.calculateCoverage(selection, relRect)

        if (coverage > 0.1) {
          elements.push({
            element,
            coverage,
            bounds: relRect,
            content: this.extractContent(element)
          })
        }
      }
    })

    // 按覆盖率排序
    return elements.sort((a, b) => b.coverage - a.coverage)
  }

  /**
   * 检查是否相交
   */
  isIntersecting(bounds, rect) {
    return !(
      bounds.x + bounds.width < rect.left ||
      bounds.x > rect.right ||
      bounds.y + bounds.height < rect.top ||
      bounds.y > rect.bottom
    )
  }

  /**
   * 计算覆盖率
   */
  calculateCoverage(selection, rect) {
    const { path, bounds } = selection
    const brushRadius = this.overlay.config.brush.size / 2

    // 快速检查：如果选区完全包含元素
    if (bounds.x <= rect.left &&
        bounds.y <= rect.top &&
        bounds.x + bounds.width >= rect.right &&
        bounds.y + bounds.height >= rect.bottom) {
      return 1.0
    }

    // 精确计算覆盖率
    let coveredArea = 0
    const sampleSize = Math.max(5, Math.min(rect.width, rect.height) / 10)
    let totalSamples = 0

    for (let x = rect.left; x < rect.right; x += sampleSize) {
      for (let y = rect.top; y < rect.bottom; y += sampleSize) {
        totalSamples++

        // 检查点是否在路径内
        for (const point of path) {
          const distance = Math.sqrt(
            Math.pow(x - point.x, 2) +
            Math.pow(y - point.y, 2)
          )

          if (distance <= brushRadius) {
            coveredArea++
            break
          }
        }
      }
    }

    return totalSamples > 0 ? coveredArea / totalSamples : 0
  }

  /**
   * 提取元素内容
   */
  extractContent(element) {
    return {
      tagName: element.tagName.toLowerCase(),
      className: element.className,
      id: element.id,
      text: element.textContent?.trim().substring(0, 100),
      html: element.outerHTML.substring(0, 200)
    }
  }
}

/**
 * 图片适配器
 * 专门处理图片内容的选择
 */
export class ImageSelectionAdapter {
  constructor(selectionOverlay, imageElement) {
    this.overlay = selectionOverlay
    this.image = imageElement
  }

  /**
   * 获取选区图片数据
   */
  getImageData(selection) {
    const { bounds } = selection
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    canvas.width = bounds.width
    canvas.height = bounds.height

    ctx.drawImage(
      this.image,
      bounds.x, bounds.y,
      bounds.width, bounds.height,
      0, 0,
      bounds.width, bounds.height
    )

    return {
      dataUrl: canvas.toDataURL('image/png'),
      imageData: ctx.getImageData(0, 0, canvas.width, canvas.height),
      bounds: bounds
    }
  }

  /**
   * 裁剪图片
   */
  cropImage(selection) {
    const data = this.getImageData(selection)
    return data.dataUrl
  }
}