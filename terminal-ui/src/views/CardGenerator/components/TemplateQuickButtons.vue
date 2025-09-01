<template>
  <div class="template-quick-buttons">
    <div class="buttons-container">
      <button
        v-for="template in templates"
        :key="template.id"
        class="template-btn"
        :class="{ active: selectedTemplate === template.id }"
        @click="selectTemplate(template)"
        :title="template.description"
      >
        <span class="btn-icon">{{ template.icon || '📄' }}</span>
        <span class="btn-name">{{ template.name }}</span>
        <span v-if="template.outputCount > 1" class="btn-badge">
          {{ template.outputCount }}
        </span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getTemplateButtons } from '../../../api/templates.js'

const props = defineProps({
  modelValue: {
    type: String,
    default: 'cardplanet-Sandra-json'
  }
})

const emit = defineEmits(['update:modelValue', 'select'])

const templates = ref([
  // 默认模板，等待从API加载
])

const selectedTemplate = ref(props.modelValue)

const selectTemplate = (template) => {
  selectedTemplate.value = template.id
  emit('update:modelValue', template.id)
  emit('select', template)
}

// 加载模板按钮配置
const loadTemplates = async () => {
  try {
    const response = await getTemplateButtons()
    if (response.success && response.data) {
      // 直接使用API数据，不做任何覆盖
      const apiTemplates = response.data.map(t => ({
        ...t,
        icon: t.icon || (t.name === '快速' ? '⚡' : t.name === '精细' ? '✨' : '📄')
      }))
      
      // 只显示快速和精细两个按钮
      templates.value = apiTemplates.filter(t => 
        t.id === 'cardplanet-Sandra-json' || 
        t.id === 'daily-knowledge-card-template.md'
      )
    }
  } catch (error) {
    console.error('Failed to load template buttons:', error)
    // 错误时不设置默认值，等待重试
  }
}

onMounted(() => {
  loadTemplates()
})
</script>

<style scoped>
.template-quick-buttons {
  margin: 10px 0;
}

.buttons-container {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.template-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid #e0e0e0;
  border-radius: 20px;
  background: white;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 14px;
  position: relative;
}

.template-btn:hover {
  border-color: #667eea;
  background: #f7f8ff;
  transform: translateY(-1px);
}

.template-btn.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-color: transparent;
}

.btn-icon {
  font-size: 16px;
}

.btn-name {
  font-weight: 500;
}

.btn-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  background: #ff6b6b;
  color: white;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 10px;
  font-weight: bold;
}

/* 移动端优化 */
@media (max-width: 768px) {
  .buttons-container {
    justify-content: center;
  }
  
  .template-btn {
    flex: 0 1 calc(50% - 5px);
    justify-content: center;
  }
}
</style>