<template>
  <Teleport to="body">
    <div 
      v-if="visible"
      class="context-menu"
      :style="menuStyle"
      @click.stop
    >
      <template v-for="(item, index) in items" :key="index">
        <div 
          v-if="item.separator"
          class="menu-separator"
        ></div>
        <div 
          v-else
          class="menu-item"
          :class="{ disabled: item.disabled }"
          @click="handleSelect(item)"
        >
          <Icon v-if="item.icon" :name="item.icon" class="menu-icon" />
          <span class="menu-label">{{ item.label }}</span>
          <span v-if="item.shortcut" class="menu-shortcut">{{ item.shortcut }}</span>
        </div>
      </template>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import Icon from './Icon.vue'

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
    default: () => []
  }
})

const emit = defineEmits(['select', 'close'])

const visible = ref(true)
const menuRef = ref(null)

const menuStyle = computed(() => {
  let x = props.x
  let y = props.y
  
  // 防止菜单超出视窗
  const windowWidth = window.innerWidth
  const windowHeight = window.innerHeight
  const menuWidth = 200 // 估算宽度
  const menuHeight = props.items.length * 32 // 估算高度
  
  if (x + menuWidth > windowWidth) {
    x = windowWidth - menuWidth - 10
  }
  
  if (y + menuHeight > windowHeight) {
    y = windowHeight - menuHeight - 10
  }
  
  return {
    left: `${x}px`,
    top: `${y}px`
  }
})

const handleSelect = (item) => {
  if (item.disabled) return
  emit('select', item.action)
  close()
}

const close = () => {
  visible.value = false
  emit('close')
}

const handleClickOutside = (event) => {
  close()
}

const handleEscape = (event) => {
  if (event.key === 'Escape') {
    close()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleEscape)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleEscape)
})

watch(visible, (val) => {
  if (!val) {
    setTimeout(() => {
      emit('close')
    }, 200)
  }
})
</script>

<style scoped>
.context-menu {
  position: fixed;
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  padding: 4px 0;
  min-width: 180px;
  z-index: 10000;
  font-size: 14px;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.2s;
  user-select: none;
}

.menu-item:hover:not(.disabled) {
  background: #f8f9fa;
}

.menu-item.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.menu-icon {
  width: 20px;
  margin-right: 8px;
  color: #6c757d;
  font-size: 14px;
}

.menu-label {
  flex: 1;
  color: #212529;
}

.menu-shortcut {
  margin-left: 20px;
  color: #6c757d;
  font-size: 12px;
}

.menu-separator {
  height: 1px;
  background: #e9ecef;
  margin: 4px 0;
}
</style>