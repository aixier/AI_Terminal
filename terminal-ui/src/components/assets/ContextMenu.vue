<template>
  <teleport to="body">
    <div 
      class="context-menu-overlay" 
      @click="handleClose"
      @contextmenu.prevent
    >
      <div 
        class="context-menu"
        :style="{ 
          left: menuX + 'px', 
          top: menuY + 'px' 
        }"
        @click.stop
      >
        <template v-for="(item, index) in items" :key="index">
          <div v-if="item.divider" class="menu-divider"></div>
          <div 
            v-else
            class="menu-item"
            :class="{ 
              disabled: item.disabled,
              'has-submenu': item.submenu
            }"
            @click="handleItemClick(item)"
            @mouseenter="handleItemHover(item)"
          >
            <span class="menu-icon" v-if="item.icon">{{ item.icon }}</span>
            <span class="menu-label">{{ item.label }}</span>
            <span class="menu-shortcut" v-if="item.shortcut">{{ item.shortcut }}</span>
            <span class="menu-arrow" v-if="item.submenu">▶</span>
          </div>
        </template>
      </div>
      
      <!-- 子菜单 -->
      <div 
        v-if="activeSubmenu"
        class="context-menu submenu"
        :style="submenuStyle"
        @click.stop
      >
        <div 
          v-for="(item, index) in activeSubmenu.items" 
          :key="index"
          class="menu-item"
          :class="{ disabled: item.disabled }"
          @click="handleSubmenuClick(item)"
        >
          <span class="menu-icon" v-if="item.icon">{{ item.icon }}</span>
          <span class="menu-label">{{ item.label }}</span>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'

const props = defineProps({
  x: {
    type: Number,
    required: true
  },
  y: {
    type: Number,
    required: true
  },
  items: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['close', 'select'])

const menuX = ref(props.x)
const menuY = ref(props.y)
const activeSubmenu = ref(null)
const submenuX = ref(0)
const submenuY = ref(0)

const submenuStyle = computed(() => ({
  left: submenuX.value + 'px',
  top: submenuY.value + 'px'
}))

const handleClose = () => {
  emit('close')
}

const handleItemClick = (item) => {
  if (item.disabled || item.submenu) return
  emit('select', item.action)
  handleClose()
}

const handleItemHover = (item) => {
  if (item.submenu) {
    activeSubmenu.value = item.submenu
    // 计算子菜单位置
    nextTick(() => {
      submenuX.value = menuX.value + 200
      submenuY.value = menuY.value
    })
  } else {
    activeSubmenu.value = null
  }
}

const handleSubmenuClick = (item) => {
  if (item.disabled) return
  emit('select', item.action)
  handleClose()
}

// 调整菜单位置以确保不超出视窗
const adjustMenuPosition = () => {
  const menuWidth = 200
  const menuHeight = 300 // 估计高度
  const windowWidth = window.innerWidth
  const windowHeight = window.innerHeight
  
  if (menuX.value + menuWidth > windowWidth) {
    menuX.value = windowWidth - menuWidth - 10
  }
  
  if (menuY.value + menuHeight > windowHeight) {
    menuY.value = windowHeight - menuHeight - 10
  }
}

// 处理ESC键关闭
const handleEscape = (e) => {
  if (e.key === 'Escape') {
    handleClose()
  }
}

onMounted(() => {
  adjustMenuPosition()
  document.addEventListener('keydown', handleEscape)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscape)
})
</script>

<style scoped>
.context-menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
}

.context-menu {
  position: fixed;
  background: white;
  border: 1px solid #d1d1d1;
  border-radius: 2px;
  box-shadow: 2px 2px 8px rgba(0, 0, 0, 0.15);
  padding: 4px 0;
  min-width: 200px;
  font-size: 13px;
  z-index: 10000;
}

.context-menu.submenu {
  z-index: 10001;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  cursor: pointer;
  transition: background-color 0.1s;
  position: relative;
}

.menu-item:hover:not(.disabled) {
  background-color: #e8f4fd;
}

.menu-item.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.menu-divider {
  height: 1px;
  background-color: #e1e1e1;
  margin: 4px 8px;
}

.menu-icon {
  width: 20px;
  margin-right: 8px;
  text-align: center;
}

.menu-label {
  flex: 1;
  white-space: nowrap;
}

.menu-shortcut {
  margin-left: 20px;
  color: #999;
  font-size: 11px;
}

.menu-arrow {
  margin-left: 10px;
  color: #999;
  font-size: 10px;
}
</style>