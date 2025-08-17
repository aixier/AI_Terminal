<template>
  <div 
    class="resizable-splitter"
    :class="{ 'is-dragging': isDragging }"
    @mousedown="startDrag"
    @touchstart="startDrag"
    :style="{ cursor: direction === 'horizontal' ? 'ns-resize' : 'ew-resize' }"
  >
    <div class="splitter-handle">
      <div class="splitter-dots">
        <span v-for="i in 3" :key="i" class="dot"></span>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ResizableSplitter',
  props: {
    direction: {
      type: String,
      default: 'horizontal', // 'horizontal' for vertical drag, 'vertical' for horizontal drag
      validator: value => ['horizontal', 'vertical'].includes(value)
    },
    minSize: {
      type: Number,
      default: 100
    },
    maxSize: {
      type: Number,
      default: Infinity
    }
  },
  emits: ['resize'],
  data() {
    return {
      isDragging: false,
      startPos: 0,
      startSize: 0
    }
  },
  methods: {
    startDrag(event) {
      event.preventDefault()
      this.isDragging = true
      
      const clientPos = event.type === 'touchstart' 
        ? event.touches[0][this.direction === 'horizontal' ? 'clientY' : 'clientX']
        : event[this.direction === 'horizontal' ? 'clientY' : 'clientX']
      
      this.startPos = clientPos
      
      // Get current size from the resizable element (terminal area)
      const targetElement = this.direction === 'horizontal' 
        ? this.$el.nextElementSibling  // 获取下一个兄弟元素(terminal-area)
        : this.$el.previousElementSibling // 或前一个兄弟元素
      
      if (targetElement) {
        const rect = targetElement.getBoundingClientRect()
        this.startSize = this.direction === 'horizontal' ? rect.height : rect.width
      }
      
      // Add global event listeners
      document.addEventListener('mousemove', this.doDrag)
      document.addEventListener('mouseup', this.stopDrag)
      document.addEventListener('touchmove', this.doDrag)
      document.addEventListener('touchend', this.stopDrag)
      
      // Prevent text selection during drag
      document.body.style.userSelect = 'none'
      document.body.style.cursor = this.direction === 'horizontal' ? 'ns-resize' : 'ew-resize'
    },
    
    doDrag(event) {
      if (!this.isDragging) return
      
      event.preventDefault()
      
      const clientPos = event.type === 'touchmove'
        ? event.touches[0][this.direction === 'horizontal' ? 'clientY' : 'clientX']
        : event[this.direction === 'horizontal' ? 'clientY' : 'clientX']
      
      const delta = clientPos - this.startPos
      let newSize = this.startSize + (this.direction === 'horizontal' ? -delta : delta)
      
      // Apply constraints
      newSize = Math.max(this.minSize, Math.min(this.maxSize, newSize))
      
      this.$emit('resize', newSize)
    },
    
    stopDrag() {
      if (!this.isDragging) return
      
      this.isDragging = false
      
      // Remove global event listeners
      document.removeEventListener('mousemove', this.doDrag)
      document.removeEventListener('mouseup', this.stopDrag)
      document.removeEventListener('touchmove', this.doDrag)
      document.removeEventListener('touchend', this.stopDrag)
      
      // Restore normal cursor and text selection
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
  },
  
  beforeUnmount() {
    this.stopDrag()
  }
}
</script>

<style scoped>
.resizable-splitter {
  position: relative;
  background: #333;
  border: 1px solid #444;
  transition: background-color 0.2s ease;
  user-select: none;
  z-index: 10;
}

.resizable-splitter:hover {
  background: #404040;
}

.resizable-splitter.is-dragging {
  background: #505050;
}

/* Horizontal splitter (for vertical dragging) */
.resizable-splitter {
  height: 8px;
  min-height: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.splitter-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.splitter-dots {
  display: flex;
  gap: 3px;
  align-items: center;
}

.dot {
  width: 3px;
  height: 3px;
  background: #666;
  border-radius: 50%;
  transition: background-color 0.2s ease;
}

.resizable-splitter:hover .dot {
  background: #888;
}

.resizable-splitter.is-dragging .dot {
  background: #aaa;
}

/* Global styles during drag */
body.dragging * {
  user-select: none !important;
  pointer-events: none !important;
}

body.dragging .resizable-splitter {
  pointer-events: auto !important;
}
</style>