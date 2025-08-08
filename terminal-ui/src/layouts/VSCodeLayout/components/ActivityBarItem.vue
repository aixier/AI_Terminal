<template>
  <div 
    class="activity-bar-item"
    :class="{ active, 'has-badge': badge }"
    :title="tooltip"
    @click="$emit('click')"
  >
    <i :class="iconClass"></i>
    <span v-if="badge" class="badge">{{ badge }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  icon: { type: String, required: true },
  tooltip: { type: String, default: '' },
  active: { type: Boolean, default: false },
  badge: { type: [String, Number], default: null }
})

const emit = defineEmits(['click'])

const iconClass = computed(() => {
  if (props.icon.startsWith('codicon-')) {
    return `codicon ${props.icon}`
  }
  return props.icon
})
</script>

<style scoped>
.activity-bar-item {
  position: relative;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: all var(--duration-fast) var(--easing-standard);
}

.activity-bar-item:hover {
  color: var(--color-text-primary);
}

.activity-bar-item.active {
  color: var(--color-text-primary);
  position: relative;
}

.activity-bar-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 2px;
  background: var(--color-brand-primary);
}

.activity-bar-item i {
  font-size: 24px;
}

.badge {
  position: absolute;
  top: 8px;
  right: 8px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  background: var(--color-brand-primary);
  color: white;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>