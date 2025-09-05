<template>
  <button
    :class="['template-btn', { 'active': modelValue }]"
    @click="toggleMode"
    title="自定义模式 - 输入 @ 可引用素材文件"
  >
    自定义
  </button>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'change'])

const toggleMode = () => {
  const newValue = !props.modelValue
  emit('update:modelValue', newValue)
  emit('change', newValue)
}
</script>

<style scoped>
/* 使用父组件的 template-btn 样式，无需额外定义 */
</style>