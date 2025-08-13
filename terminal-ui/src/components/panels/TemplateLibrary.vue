<template>
  <div class="template-library">
    <div v-if="loading" class="loading-state">
      <span>加载模板中...</span>
    </div>
    <div v-else-if="templates.length === 0" class="empty-state">
      <span>暂无可用模板</span>
    </div>
    <div v-else class="library-grid">
      <div 
        v-for="template in templates" 
        :key="template.id"
        class="template-thumbnail"
        @click="selectTemplate(template)"
      >
        <div class="thumbnail-image">
          <img :src="template.thumbnail" :alt="template.name" />
        </div>
        <div class="thumbnail-info">
          <div class="template-name">{{ template.name }}</div>
          <div class="template-category">{{ template.category }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, defineEmits } from 'vue'
import { ElMessage } from 'element-plus'
import { getTemplates } from '@/api/terminal'

const emit = defineEmits(['select-template'])

const templates = ref([])
const loading = ref(false)

const fetchTemplates = async () => {
  loading.value = true
  try {
    console.log('[debug0.0.1] Fetching templates from API...')
    const response = await getTemplates()
    console.log('[debug0.0.1] templates API response:', response)
    
    if (response.success && response.templates) {
      console.log('[debug0.0.1] templates data:', response.templates)
      templates.value = response.templates.map((template, index) => ({
        id: template.fileName,
        name: template.displayName,
        category: template.type === 'folder' ? '文件夹模板' : '文件模板',
        type: template.type,
        fileName: template.fileName,
        thumbnail: generateThumbnail(template.displayName, template.type)
      }))
      console.log('[debug0.0.1] Processed templates:', templates.value)
    } else {
      console.log('[debug0.0.1] No templates found in response')
    }
  } catch (error) {
    console.error('[debug0.0.1] Failed to fetch templates:', error)
    ElMessage.error('获取模板列表失败')
  } finally {
    loading.value = false
  }
}

const generateThumbnail = (name, type) => {
  const colors = {
    folder: '#ffa500',
    file: '#4a90e2'
  }
  const color = colors[type] || '#999'
  
  // 截取较短的显示名称以适应缩略图
  const displayName = name.length > 20 ? name.substring(0, 17) + '...' : name
  
  const svg = `<svg width="100" height="60" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="${color}20"/>
    <text x="50%" y="50%" font-family="Arial" font-size="8" fill="${color}" text-anchor="middle" dy=".3em">${displayName}</text>
  </svg>`
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`
}

const selectTemplate = (template) => {
  ElMessage.success(`已选择模板: ${template.name}`)
  // 向父组件发送选中的模板信息
  emit('select-template', {
    fileName: template.fileName,
    displayName: template.name,
    type: template.type
  })
}

onMounted(() => {
  fetchTemplates()
})
</script>

<style scoped>
.template-library {
  display: flex;
  flex-direction: column;
}

.library-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--fluent-space-sm);
}

.template-thumbnail {
  cursor: pointer;
  transition: all var(--fluent-duration-normal) var(--fluent-easing);
}

.template-thumbnail:hover {
  transform: translateY(-2px);
}

.thumbnail-image {
  width: 100%;
  height: 60px;
  border-radius: var(--fluent-radius-medium);
  overflow: hidden;
  margin-bottom: var(--fluent-space-xs);
}

.thumbnail-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumbnail-info {
  text-align: center;
}

.template-name {
  font-size: var(--fluent-font-size-xs);
  font-weight: 600;
  color: var(--fluent-neutral-primary);
  margin-bottom: 2px;
}

.template-category {
  font-size: 10px;
  color: var(--fluent-neutral-tertiary);
}

.loading-state,
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100px;
  color: var(--fluent-neutral-secondary);
  font-size: var(--fluent-font-size-sm);
}
</style>