<template>
  <button 
    :class="[
      'fluent-button-base',
      `fluent-button-${variant}`,
      `fluent-button-${size}`,
      disabled && 'fluent-button-disabled',
      loading && 'fluent-button-loading'
    ]"
    :disabled="disabled || loading"
    @click="handleClick"
  >
    <span v-if="loading" class="fluent-button-spinner">
      <svg viewBox="0 0 20 20" class="fluent-spinner">
        <circle cx="10" cy="10" r="8" />
      </svg>
    </span>
    <el-icon v-if="icon && !loading" class="fluent-button-icon">
      <component :is="icon" />
    </el-icon>
    <span v-if="$slots.default" class="fluent-button-text">
      <slot />
    </span>
  </button>
</template>

<script setup>
const props = defineProps({
  variant: {
    type: String,
    default: 'primary',
    validator: (value) => ['primary', 'secondary', 'accent', 'subtle', 'outline'].includes(value)
  },
  size: {
    type: String,
    default: 'medium',
    validator: (value) => ['small', 'medium', 'large'].includes(value)
  },
  icon: {
    type: [String, Object],
    default: null
  },
  disabled: {
    type: Boolean,
    default: false
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['click'])

const handleClick = (event) => {
  if (!props.disabled && !props.loading) {
    emit('click', event)
  }
}
</script>

<style scoped>
.fluent-button-base {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--fluent-space-xs);
  border: none;
  border-radius: var(--fluent-radius-medium);
  font-family: var(--fluent-font-family);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--fluent-duration-normal) var(--fluent-easing);
  text-decoration: none;
  overflow: hidden;
}

.fluent-button-base::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, 
    rgba(255, 255, 255, 0.2) 0%, 
    rgba(255, 255, 255, 0.1) 50%,
    transparent 100%
  );
  opacity: 0;
  transition: opacity var(--fluent-duration-fast) var(--fluent-easing);
}

.fluent-button-base:hover::before {
  opacity: 1;
}

.fluent-button-base:active {
  transform: scale(0.98);
}

/* 尺寸变体 */
.fluent-button-small {
  padding: var(--fluent-space-xs) var(--fluent-space-sm);
  font-size: var(--fluent-font-size-sm);
  min-height: 28px;
}

.fluent-button-medium {
  padding: var(--fluent-space-sm) var(--fluent-space-md);
  font-size: var(--fluent-font-size-md);
  min-height: 32px;
}

.fluent-button-large {
  padding: var(--fluent-space-md) var(--fluent-space-lg);
  font-size: var(--fluent-font-size-lg);
  min-height: 40px;
}

/* 样式变体 */
.fluent-button-primary {
  background: var(--fluent-blue);
  color: var(--fluent-neutral-white);
  box-shadow: var(--fluent-depth-2);
}

.fluent-button-primary:hover {
  background: var(--fluent-blue-light);
  box-shadow: var(--fluent-depth-4);
  transform: translateY(-1px);
}

.fluent-button-secondary {
  background: var(--fluent-neutral-lighter);
  color: var(--fluent-neutral-primary);
  box-shadow: var(--fluent-depth-2);
}

.fluent-button-secondary:hover {
  background: var(--fluent-neutral-lightest);
  box-shadow: var(--fluent-depth-4);
  transform: translateY(-1px);
}

.fluent-button-accent {
  background: linear-gradient(135deg, var(--fluent-blue) 0%, var(--fluent-blue-light) 100%);
  color: var(--fluent-neutral-white);
  box-shadow: var(--fluent-depth-4);
}

.fluent-button-accent:hover {
  box-shadow: var(--fluent-depth-8);
  transform: translateY(-1px);
}

.fluent-button-subtle {
  background: transparent;
  color: var(--fluent-neutral-primary);
  border: 1px solid var(--fluent-neutral-lighter);
}

.fluent-button-subtle:hover {
  background: var(--fluent-neutral-lighter);
  box-shadow: var(--fluent-depth-2);
}

.fluent-button-outline {
  background: transparent;
  color: var(--fluent-blue);
  border: 1px solid var(--fluent-blue);
}

.fluent-button-outline:hover {
  background: rgba(0, 120, 212, 0.1);
  box-shadow: var(--fluent-depth-2);
}

/* 状态 */
.fluent-button-disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: none !important;
}

.fluent-button-loading {
  cursor: wait;
}

/* 图标和文本 */
.fluent-button-icon {
  flex-shrink: 0;
}

.fluent-button-text {
  white-space: nowrap;
}

/* 加载动画 */
.fluent-button-spinner {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.fluent-spinner {
  width: 16px;
  height: 16px;
  animation: fluentSpin 1s linear infinite;
}

.fluent-spinner circle {
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-dasharray: 50;
  stroke-dashoffset: 25;
}

@keyframes fluentSpin {
  to {
    transform: rotate(360deg);
  }
}

/* PC端优化 */
@media (min-width: 1024px) {
  .fluent-button-base:hover {
    transform: translateY(-1px);
  }
  
  .fluent-button-base:active {
    transform: translateY(0) scale(0.98);
  }
}
</style>