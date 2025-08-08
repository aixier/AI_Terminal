<template>
  <div 
    :class="[
      'fluent-card-base',
      acrylic ? 'fluent-card-acrylic' : 'fluent-card',
      depth && `fluent-depth-${depth}`,
      hover && 'fluent-glow-hover',
      className
    ]"
    :style="customStyle"
  >
    <slot />
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  acrylic: {
    type: Boolean,
    default: false
  },
  depth: {
    type: [Number, String],
    default: 4,
    validator: (value) => [2, 4, 8, 16, 64].includes(Number(value))
  },
  hover: {
    type: Boolean,
    default: true
  },
  padding: {
    type: String,
    default: 'var(--fluent-space-md)'
  },
  borderRadius: {
    type: String,
    default: 'var(--fluent-radius-large)'
  },
  className: {
    type: String,
    default: ''
  }
})

const customStyle = computed(() => ({
  padding: props.padding,
  borderRadius: props.borderRadius
}))
</script>

<style scoped>
.fluent-card-base {
  transition: all var(--fluent-duration-normal) var(--fluent-easing);
  position: relative;
  overflow: hidden;
}

.fluent-card-base::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, 
    transparent 0%, 
    rgba(255, 255, 255, 0.6) 50%, 
    transparent 100%
  );
  opacity: 0;
  transition: opacity var(--fluent-duration-normal) var(--fluent-easing);
}

.fluent-card-base:hover::before {
  opacity: 1;
}

/* Acrylic 特效增强 */
.fluent-card-acrylic {
  position: relative;
}

.fluent-card-acrylic::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, 
    rgba(255, 255, 255, 0.1) 0%, 
    rgba(255, 255, 255, 0.05) 100%
  );
  pointer-events: none;
  opacity: 0;
  transition: opacity var(--fluent-duration-normal) var(--fluent-easing);
}

.fluent-card-acrylic:hover::after {
  opacity: 1;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .fluent-card-base {
    border-radius: var(--fluent-radius-medium);
  }
}
</style>