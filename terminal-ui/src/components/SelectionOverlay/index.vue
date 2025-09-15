<template>
  <div
    v-if="visible"
    class="selection-overlay-container"
    ref="containerRef"
  >
    <!-- Canvas 绘制层 -->
    <canvas
      ref="canvasRef"
      class="selection-canvas"
      :class="{
        'is-drawing': isDrawing,
        'brush-cursor': config.mode === 'paint'
      }"
      @mousedown="handleStart"
      @mousemove="handleMove"
      @mouseup="handleEnd"
      @mouseleave="handleEnd"
      @touchstart="handleTouchStart"
      @touchmove="handleTouchMove"
      @touchend="handleTouchEnd"
      @touchcancel="handleEnd"
    />

    <!-- 画笔光标预览 -->
    <div
      v-if="config.mode === 'paint' && showBrushCursor"
      class="brush-cursor-preview"
      :style="brushCursorStyle"
    />

    <!-- 坐标显示 -->
    <div
      v-if="config.visual.showCoordinates && currentPoint"
      class="coord-display"
    >
      {{ Math.round(currentPoint.x) }}, {{ Math.round(currentPoint.y) }}
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  container: {
    type: HTMLElement,
    default: null
  },
  config: {
    type: Object,
    default: () => ({
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
      }
    })
  }
})

const emit = defineEmits([
  'selection-start',
  'selection-update',
  'selection-complete',
  'selections-change'
])

// Refs
const containerRef = ref(null)
const canvasRef = ref(null)

// State
const isDrawing = ref(false)
const currentPath = ref([])
const selections = ref([])
const currentPoint = ref(null)
const showBrushCursor = ref(false)
const brushCursorPos = reactive({ x: 0, y: 0 })

// Canvas context
let ctx = null
let offscreenCanvas = null
let offscreenCtx = null
let resizeObserver = null
let lastDrawTime = 0

// Computed
const brushCursorStyle = computed(() => ({
  width: `${props.config.brush.size}px`,
  height: `${props.config.brush.size}px`,
  left: `${brushCursorPos.x}px`,
  top: `${brushCursorPos.y}px`,
  borderColor: props.config.brush.color,
  opacity: props.config.brush.opacity * 2,
  transform: 'translate(-50%, -50%)'
}))

// Methods
const setupCanvas = () => {
  if (!canvasRef.value || !containerRef.value) return

  const rect = containerRef.value.getBoundingClientRect()

  // 不使用 devicePixelRatio，保持1:1的坐标映射
  canvasRef.value.width = rect.width
  canvasRef.value.height = rect.height
  canvasRef.value.style.width = `${rect.width}px`
  canvasRef.value.style.height = `${rect.height}px`

  // 获取绘图上下文
  ctx = canvasRef.value.getContext('2d')

  // 创建离屏Canvas - 用于累积绘制
  if (!offscreenCanvas) {
    offscreenCanvas = document.createElement('canvas')
    offscreenCtx = offscreenCanvas.getContext('2d')
  }
  offscreenCanvas.width = canvasRef.value.width
  offscreenCanvas.height = canvasRef.value.height
}

const getPointFromEvent = (event) => {
  if (!canvasRef.value) return null

  const rect = canvasRef.value.getBoundingClientRect()
  let clientX, clientY

  if (event.touches && event.touches.length > 0) {
    clientX = event.touches[0].clientX
    clientY = event.touches[0].clientY
  } else {
    clientX = event.clientX
    clientY = event.clientY
  }

  // 直接使用相对坐标，不需要缩放
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
    pressure: event.pressure || 1.0,
    timestamp: Date.now()
  }
}

const drawBrush = (point) => {
  if (!ctx) return

  const { size, opacity, color, shape } = props.config.brush
  const radius = size / 2

  // 直接绘制到主Canvas，提高性能
  ctx.globalAlpha = opacity
  ctx.fillStyle = color

  if (shape === 'circle') {
    ctx.beginPath()
    ctx.arc(point.x, point.y, radius, 0, 2 * Math.PI)
    ctx.fill()
  } else {
    ctx.fillRect(
      point.x - radius,
      point.y - radius,
      size,
      size
    )
  }

  // 同时在离屏Canvas记录，用于持久化
  if (offscreenCtx) {
    offscreenCtx.globalAlpha = opacity
    offscreenCtx.fillStyle = color

    if (shape === 'circle') {
      offscreenCtx.beginPath()
      offscreenCtx.arc(point.x, point.y, radius, 0, 2 * Math.PI)
      offscreenCtx.fill()
    } else {
      offscreenCtx.fillRect(
        point.x - radius,
        point.y - radius,
        size,
        size
      )
    }
  }
}

const drawRectangle = () => {
  if (!ctx || currentPath.value.length < 2) return

  ctx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height)

  const start = currentPath.value[0]
  const current = currentPath.value[currentPath.value.length - 1]

  ctx.strokeStyle = props.config.brush.color
  ctx.lineWidth = 2
  ctx.setLineDash([5, 5])
  ctx.globalAlpha = 1

  const width = current.x - start.x
  const height = current.y - start.y

  ctx.strokeRect(start.x, start.y, width, height)

  // 填充半透明区域
  ctx.fillStyle = props.config.brush.color
  ctx.globalAlpha = props.config.brush.opacity
  ctx.fillRect(start.x, start.y, width, height)
}

const drawLasso = (point) => {
  if (!ctx) return

  if (currentPath.value.length === 1) {
    ctx.beginPath()
    ctx.moveTo(currentPath.value[0].x, currentPath.value[0].y)
  }

  ctx.strokeStyle = props.config.brush.color
  ctx.lineWidth = 2
  ctx.globalAlpha = 1
  ctx.lineTo(point.x, point.y)
  ctx.stroke()
}

let updateScheduled = false
const updateMainCanvas = () => {
  if (!updateScheduled) {
    updateScheduled = true
    requestAnimationFrame(() => {
      if (ctx && offscreenCanvas) {
        ctx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height)
        ctx.drawImage(offscreenCanvas, 0, 0)
      }
      updateScheduled = false
    })
  }
}

const calculateBounds = (path) => {
  if (!path || path.length === 0) return null

  const offset = props.config.mode === 'paint' ? props.config.brush.size / 2 : 0
  let minX = Infinity, minY = Infinity
  let maxX = -Infinity, maxY = -Infinity

  for (const point of path) {
    minX = Math.min(minX, point.x - offset)
    minY = Math.min(minY, point.y - offset)
    maxX = Math.max(maxX, point.x + offset)
    maxY = Math.max(maxY, point.y + offset)
  }

  return {
    x: Math.round(minX),
    y: Math.round(minY),
    width: Math.round(maxX - minX),
    height: Math.round(maxY - minY)
  }
}

const createSelection = () => {
  const bounds = calculateBounds(currentPath.value)

  return {
    id: `selection_${Date.now()}`,
    type: props.config.mode,
    bounds,
    path: [...currentPath.value],
    metadata: {
      timestamp: Date.now(),
      tool: props.config.mode,
      brushSize: props.config.brush.size
    }
  }
}

// Event handlers
const handleStart = (event) => {
  event.preventDefault()
  event.stopPropagation()

  const point = getPointFromEvent(event)
  if (!point) return

  isDrawing.value = true
  currentPath.value = [point]
  currentPoint.value = point

  emit('selection-start', { point })

  if (props.config.mode === 'paint') {
    drawBrush(point)
  }
}

const handleMove = (event) => {
  event.preventDefault()
  event.stopPropagation()

  const point = getPointFromEvent(event)
  if (!point) return

  currentPoint.value = point

  // 更新画笔光标位置
  if (props.config.mode === 'paint') {
    showBrushCursor.value = true
    brushCursorPos.x = point.x
    brushCursorPos.y = point.y
  }

  if (!isDrawing.value) return

  // 性能优化：使用时间节流而不是距离采样
  const now = Date.now()
  if (now - lastDrawTime < props.config.performance.throttleMs) {
    return
  }
  lastDrawTime = now

  currentPath.value.push(point)

  // 根据模式绘制
  switch (props.config.mode) {
    case 'paint':
      drawBrush(point)
      break
    case 'rectangle':
      drawRectangle()
      break
    case 'lasso':
      drawLasso(point)
      break
  }

  // 减少事件触发频率
  if (currentPath.value.length % 5 === 0) {
    emit('selection-update', {
      bounds: calculateBounds(currentPath.value),
      path: currentPath.value
    })
  }
}

const handleEnd = (event) => {
  if (!isDrawing.value) return

  event.preventDefault()
  event.stopPropagation()

  isDrawing.value = false
  showBrushCursor.value = false

  if (currentPath.value.length > 0) {
    const selection = createSelection()

    if (!props.config.behavior.multiSelect) {
      selections.value = [selection]
    } else {
      selections.value.push(selection)
    }

    emit('selection-complete', selection)
    emit('selections-change', selections.value)
  }

  currentPath.value = []
}

// Touch event handlers
const handleTouchStart = (event) => {
  event.preventDefault()
  handleStart(event)
}

const handleTouchMove = (event) => {
  event.preventDefault()
  handleMove(event)
}

const handleTouchEnd = (event) => {
  event.preventDefault()
  handleEnd(event)
}

// Public methods
const clearSelections = () => {
  selections.value = []
  currentPath.value = []
  if (ctx && canvasRef.value) {
    ctx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height)
  }
  if (offscreenCtx && offscreenCanvas) {
    offscreenCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height)
  }
  emit('selections-change', [])
}

const getSelections = () => {
  return selections.value.map(sel => ({
    id: sel.id,
    bounds: sel.bounds,
    path: sel.path
  }))
}

const exportData = (format = 'json') => {
  const data = {
    version: '1.0',
    timestamp: Date.now(),
    viewport: canvasRef.value ? {
      width: canvasRef.value.width,
      height: canvasRef.value.height
    } : null,
    selections: selections.value
  }

  if (format === 'json') {
    return JSON.stringify(data, null, 2)
  }
  return data
}

// Lifecycle
onMounted(() => {
  nextTick(() => {
    if (props.visible) {
      setupCanvas()

      // 监听容器尺寸变化
      if (containerRef.value) {
        resizeObserver = new ResizeObserver(() => {
          setupCanvas()
        })
        resizeObserver.observe(containerRef.value)
      }
    }
  })
})

onBeforeUnmount(() => {
  if (resizeObserver && containerRef.value) {
    resizeObserver.unobserve(containerRef.value)
    resizeObserver.disconnect()
  }
})

// Watch
watch(() => props.visible, (newVal) => {
  if (newVal) {
    nextTick(() => {
      setupCanvas()
    })
  }
})

watch(() => props.config.mode, () => {
  clearSelections()
})

// Expose
defineExpose({
  clearSelections,
  getSelections,
  exportData
})
</script>

<style scoped>
.selection-overlay-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1000;
}

.selection-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: auto;
  cursor: crosshair;
}

.selection-canvas.brush-cursor {
  cursor: none;
}

.selection-canvas.is-drawing {
  cursor: crosshair;
}

.brush-cursor-preview {
  position: absolute;
  pointer-events: none;
  border: 2px solid;
  border-radius: 50%;
  z-index: 10000;
}

.coord-display {
  position: fixed;
  bottom: 10px;
  right: 10px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 5px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-family: monospace;
  z-index: 10001;
  pointer-events: none;
}
</style>