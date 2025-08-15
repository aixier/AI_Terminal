<template>
  <teleport to="body">
    <div
      v-if="visible"
      class="context-menu"
      :style="{ left: position.x + 'px', top: position.y + 'px' }"
      @click.stop
      @contextmenu.prevent
    >
      <div class="context-menu-item" v-for="item in menuItems" :key="item.key">
        <button
          v-if="!item.separator"
          class="menu-button"
          :class="{ disabled: item.disabled }"
          @click="handleClick(item)"
          :disabled="item.disabled"
        >
          <span class="menu-icon">{{ item.icon }}</span>
          <span class="menu-text">{{ item.text }}</span>
          <span v-if="item.shortcut" class="menu-shortcut">{{ item.shortcut }}</span>
        </button>
        <div v-else class="menu-separator"></div>
      </div>
    </div>
  </teleport>
</template>

<script>
export default {
  name: 'ContextMenu',
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    position: {
      type: Object,
      default: () => ({ x: 0, y: 0 })
    },
    menuItems: {
      type: Array,
      default: () => []
    }
  },
  emits: ['menu-click', 'close'],
  mounted() {
    document.addEventListener('click', this.handleOutsideClick)
    document.addEventListener('scroll', this.handleScroll)
    document.addEventListener('keydown', this.handleKeydown)
  },
  beforeUnmount() {
    document.removeEventListener('click', this.handleOutsideClick)
    document.removeEventListener('scroll', this.handleScroll)
    document.removeEventListener('keydown', this.handleKeydown)
  },
  methods: {
    handleClick(item) {
      if (!item.disabled) {
        this.$emit('menu-click', item)
        this.$emit('close')
      }
    },
    handleOutsideClick() {
      this.$emit('close')
    },
    handleScroll() {
      this.$emit('close')
    },
    handleKeydown(e) {
      if (e.key === 'Escape') {
        this.$emit('close')
      }
    }
  }
}
</script>

<style scoped>
.context-menu {
  position: fixed;
  background: #ffffff;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 4px 0;
  min-width: 160px;
  z-index: 9999;
  font-size: 14px;
  user-select: none;
}

.context-menu-item {
  padding: 0;
}

.menu-button {
  width: 100%;
  padding: 8px 16px;
  border: none;
  background: none;
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #333;
  transition: background-color 0.2s;
}

.menu-button:hover:not(.disabled) {
  background-color: #f5f5f5;
}

.menu-button.disabled {
  color: #999;
  cursor: not-allowed;
}

.menu-icon {
  font-size: 16px;
  width: 20px;
  text-align: center;
}

.menu-text {
  flex: 1;
}

.menu-shortcut {
  color: #666;
  font-size: 12px;
}

.menu-separator {
  height: 1px;
  background-color: #e0e0e0;
  margin: 4px 8px;
}

/* Dark theme support */
.dark .context-menu {
  background: #2d2d2d;
  border-color: #555;
  color: #fff;
}

.dark .menu-button {
  color: #fff;
}

.dark .menu-button:hover:not(.disabled) {
  background-color: #404040;
}

.dark .menu-button.disabled {
  color: #888;
}

.dark .menu-separator {
  background-color: #555;
}

.dark .menu-shortcut {
  color: #aaa;
}
</style>