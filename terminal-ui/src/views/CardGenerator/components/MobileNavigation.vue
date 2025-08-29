<template>
  <div class="mobile-navigation">
    <button 
      v-for="tab in tabs" 
      :key="tab.key"
      :class="['nav-item', { active: activeTab === tab.key }]"
      @click="$emit('update:activeTab', tab.key)"
    >
      <span class="nav-icon">{{ tab.icon }}</span>
      <span class="nav-label">{{ tab.label }}</span>
    </button>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue'

const props = defineProps({
  tabs: {
    type: Array,
    required: true
  },
  activeTab: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['update:activeTab'])
</script>

<style scoped>
.mobile-navigation {
  display: flex;
  background: #fff;
  border-top: 1px solid #e0e0e0;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  height: 60px;
}

.nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 4px;
  border: none;
  background: transparent;
  color: #999;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  gap: 4px;
}

.nav-item:active {
  background: rgba(102, 126, 234, 0.1);
  transform: scale(0.95);
}

.nav-item.active {
  color: #667eea;
  background: rgba(102, 126, 234, 0.05);
}

.nav-icon {
  font-size: 20px;
  line-height: 1;
}

.nav-label {
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
}

.nav-item.active .nav-label {
  font-weight: 600;
}
</style>