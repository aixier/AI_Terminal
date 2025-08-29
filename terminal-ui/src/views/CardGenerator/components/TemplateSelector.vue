<template>
  <div class="template-selector">
    <div class="selector-header">
      <span class="selector-title">选择模板</span>
      <button 
        v-if="showRefresh"
        class="refresh-btn" 
        @click="$emit('refresh')"
        title="刷新模板"
      >
        🔄
      </button>
    </div>
    
    <div class="template-list">
      <div 
        v-for="(template, index) in templates"
        :key="template.id || index"
        class="template-item"
        :class="{ active: selectedIndex === index }"
        @click="selectTemplate(index)"
      >
        <span class="template-icon">{{ getTemplateIcon(template.name) }}</span>
        <div class="template-info">
          <div class="template-name">{{ template.name }}</div>
          <div v-if="template.description" class="template-desc">
            {{ template.description }}
          </div>
        </div>
        <div v-if="selectedIndex === index" class="selected-indicator">
          ✓
        </div>
      </div>
      
      <div v-if="templates.length === 0" class="empty-templates">
        <span class="empty-icon">📝</span>
        <span class="empty-text">暂无可用模板</span>
      </div>
    </div>
    
    <!-- 快捷模板按钮 -->
    <div v-if="showQuickButtons" class="quick-templates">
      <div class="quick-header">快捷选择</div>
      <div class="quick-buttons">
        <button 
          v-for="(template, index) in quickTemplates"
          :key="index"
          class="quick-btn"
          :class="{ active: quickSelectedIndex === index }"
          @click="selectQuickTemplate(index)"
        >
          <span class="quick-icon">{{ template.icon }}</span>
          <span class="quick-name">{{ template.name }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  templates: {
    type: Array,
    default: () => []
  },
  selectedIndex: {
    type: Number,
    default: 0
  },
  quickSelectedIndex: {
    type: Number,
    default: null
  },
  showRefresh: {
    type: Boolean,
    default: true
  },
  showQuickButtons: {
    type: Boolean,
    default: true
  },
  maxQuickButtons: {
    type: Number,
    default: 4
  }
})

const emit = defineEmits([
  'select',
  'select-quick',
  'refresh'
])

// 获取快捷模板列表
const quickTemplates = computed(() => {
  return props.templates.slice(0, props.maxQuickButtons).map(t => ({
    id: t.id,
    name: t.name.split(' ')[0], // 取第一个单词
    icon: getTemplateIcon(t.name),
    fullName: t.name
  }))
})

// 获取模板图标
function getTemplateIcon(templateName) {
  const name = templateName.toLowerCase()
  if (name.includes('报告')) return '📊'
  if (name.includes('方案')) return '📋'
  if (name.includes('总结')) return '📝'
  if (name.includes('文章')) return '✍️'
  if (name.includes('代码')) return '💻'
  if (name.includes('邮件')) return '📧'
  if (name.includes('公告')) return '📢'
  if (name.includes('新闻')) return '📰'
  if (name.includes('产品')) return '📦'
  if (name.includes('营销')) return '📈'
  if (name.includes('活动')) return '🎉'
  if (name.includes('教程')) return '📚'
  if (name.includes('简历')) return '👤'
  if (name.includes('合同')) return '📄'
  return '📄'
}

// 选择模板
const selectTemplate = (index) => {
  emit('select', index)
}

// 选择快捷模板
const selectQuickTemplate = (index) => {
  emit('select-quick', index)
  emit('select', index) // 同时更新主模板选择
}
</script>

<style scoped>
.template-selector {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
}

.selector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #e0e0e0;
}

.selector-title {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.refresh-btn {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: background 0.2s;
}

.refresh-btn:hover {
  background: #f0f0f0;
}

.template-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.template-item {
  display: flex;
  align-items: center;
  padding: 12px;
  margin-bottom: 8px;
  background: #f8f9fa;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;
}

.template-item:hover {
  background: #e8e9ea;
  transform: translateX(2px);
}

.template-item.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border-color: #667eea;
}

.template-icon {
  font-size: 24px;
  margin-right: 12px;
}

.template-info {
  flex: 1;
}

.template-name {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
}

.template-desc {
  font-size: 12px;
  opacity: 0.8;
  line-height: 1.4;
}

.template-item.active .template-desc {
  opacity: 0.9;
}

.selected-indicator {
  font-size: 16px;
  font-weight: bold;
}

.empty-templates {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 150px;
  color: #999;
}

.empty-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.empty-text {
  font-size: 13px;
}

.quick-templates {
  border-top: 1px solid #e0e0e0;
  padding: 12px;
  background: #f8f9fa;
}

.quick-header {
  font-size: 12px;
  font-weight: 500;
  color: #666;
  margin-bottom: 8px;
}

.quick-buttons {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.quick-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.quick-btn:hover {
  background: #f0f0f0;
  border-color: #667eea;
}

.quick-btn.active {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  border-color: transparent;
}

.quick-icon {
  font-size: 16px;
}

.quick-name {
  font-weight: 500;
}

/* 滚动条样式 */
.template-list::-webkit-scrollbar {
  width: 6px;
}

.template-list::-webkit-scrollbar-track {
  background: transparent;
}

.template-list::-webkit-scrollbar-thumb {
  background: #c0c0c0;
  border-radius: 3px;
}

.template-list::-webkit-scrollbar-thumb:hover {
  background: #a0a0a0;
}

/* 响应式设计 */
@media (min-width: 768px) {
  .quick-buttons {
    grid-template-columns: repeat(4, 1fr);
  }
}
</style>