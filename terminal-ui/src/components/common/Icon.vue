<template>
  <i :class="iconClass"></i>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  name: {
    type: String,
    required: true
  },
  size: {
    type: String,
    default: 'normal'
  }
})

const iconClass = computed(() => {
  const iconMap = {
    // 文件夹
    'folder': 'fas fa-folder',
    'folder-open': 'fas fa-folder-open',
    'folder-plus': 'fas fa-folder-plus',
    
    // 文件
    'file': 'fas fa-file',
    'file-pdf': 'fas fa-file-pdf',
    'file-word': 'fas fa-file-word',
    'file-excel': 'fas fa-file-excel',
    'file-ppt': 'fas fa-file-powerpoint',
    'file-text': 'fas fa-file-alt',
    'file-code': 'fas fa-file-code',
    'file-zip': 'fas fa-file-archive',
    
    // 媒体
    'image': 'fas fa-image',
    'video': 'fas fa-video',
    'audio': 'fas fa-music',
    
    // 导航
    'arrow-up': 'fas fa-arrow-up',
    'arrow-down': 'fas fa-arrow-down',
    'arrow-left': 'fas fa-arrow-left',
    'arrow-right': 'fas fa-arrow-right',
    'chevron-up': 'fas fa-chevron-up',
    'chevron-down': 'fas fa-chevron-down',
    'chevron-left': 'fas fa-chevron-left',
    'chevron-right': 'fas fa-chevron-right',
    
    // 操作
    'refresh': 'fas fa-sync',
    'upload': 'fas fa-upload',
    'download': 'fas fa-download',
    'search': 'fas fa-search',
    'edit': 'fas fa-edit',
    'delete': 'fas fa-trash',
    'copy': 'fas fa-copy',
    'paste': 'fas fa-paste',
    'cut': 'fas fa-cut',
    
    // 视图
    'grid': 'fas fa-th',
    'list': 'fas fa-list',
    'home': 'fas fa-home',
    'collapse': 'fas fa-compress',
    'expand': 'fas fa-expand',
    
    // 其他
    'info': 'fas fa-info-circle',
    'warning': 'fas fa-exclamation-triangle',
    'error': 'fas fa-times-circle',
    'success': 'fas fa-check-circle',
    'close': 'fas fa-times',
    'plus': 'fas fa-plus',
    'minus': 'fas fa-minus'
  }
  
  const sizeClass = {
    'small': 'icon-small',
    'normal': '',
    'large': 'icon-large'
  }
  
  return `${iconMap[props.name] || 'fas fa-question'} ${sizeClass[props.size] || ''}`
})
</script>

<style scoped>
i {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.icon-small {
  font-size: 12px;
}

.icon-large {
  font-size: 20px;
}
</style>