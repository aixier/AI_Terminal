<template>
  <div 
    class="file-item"
    :class="{ 
      active: isSelected,
      generating: isGenerating 
    }"
    @click="$emit('click')"
    @contextmenu.prevent="$emit('contextmenu', $event)"
  >
    <span class="file-icon">
      {{ fileIcon }}
    </span>
    <span class="file-name" :title="file.name">
      {{ file.name }}
    </span>
    <div class="file-status">
      <span class="file-type">{{ fileType }}</span>
      <span v-if="isGenerating" class="status-indicator generating">⏳</span>
      <span v-else-if="isSelected" class="status-indicator selected">✓</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  file: {
    type: Object,
    required: true
  },
  isSelected: {
    type: Boolean,
    default: false
  },
  isGenerating: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['click', 'contextmenu'])

// 获取文件图标
const fileIcon = computed(() => {
  const name = props.file.name.toLowerCase()
  if (name.endsWith('.html') || name.endsWith('.htm')) return '🌐'
  if (name.endsWith('.json')) return '📋'
  if (name.endsWith('.js') || name.endsWith('.ts')) return '📜'
  if (name.endsWith('.css')) return '🎨'
  if (name.endsWith('.md')) return '📝'
  if (name.endsWith('.txt')) return '📄'
  if (name.endsWith('.jpg') || name.endsWith('.jpeg') || 
      name.endsWith('.png') || name.endsWith('.gif')) return '🖼️'
  if (name.endsWith('.mp4') || name.endsWith('.avi') || 
      name.endsWith('.mov')) return '🎬'
  if (name.endsWith('.pdf')) return '📑'
  if (name.endsWith('.zip') || name.endsWith('.rar')) return '📦'
  return '📄'
})

// 获取文件类型
const fileType = computed(() => {
  const name = props.file.name.toLowerCase()
  const ext = name.split('.').pop()
  return ext.toUpperCase()
})
</script>

<style scoped>
.file-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
  user-select: none;
  margin-bottom: 2px;
}

.file-item:hover {
  background: #e8e8e8;
}

.file-item.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}

.file-item.generating {
  animation: pulse 1.5s ease infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

.file-icon {
  margin-right: 8px;
  font-size: 16px;
}

.file-name {
  flex: 1;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-status {
  display: flex;
  align-items: center;
  gap: 6px;
}

.file-type {
  font-size: 10px;
  padding: 2px 6px;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 4px;
  font-weight: 500;
}

.file-item.active .file-type {
  background: rgba(255, 255, 255, 0.2);
}

.status-indicator {
  font-size: 12px;
}

.status-indicator.generating {
  animation: rotate 1s linear infinite;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>