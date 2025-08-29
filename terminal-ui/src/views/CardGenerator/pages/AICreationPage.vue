<template>
  <div class="ai-creation-page">
    <!-- PC端布局 -->
    <div v-if="!isMobile" class="desktop-creation-layout">
      <!-- 模板选择区域 -->
      <div class="template-section">
        <TemplateSelector
          :templates="templates"
          :selected-index="selectedTemplate"
          :quick-selected-index="selectedQuickTemplate"
          :show-refresh="false"
          :show-quick-buttons="false"
          @select="$emit('template-select', $event)"
        />
      </div>
      
      <!-- 聊天界面 -->
      <div class="chat-section">
        <ChatInterface
          :messages="messages"
          :model-value="inputText"
          :templates="templates"
          :selected-template="selectedQuickTemplate"
          :is-generating="isGenerating"
          :placeholder="placeholder"
          @send="$emit('send-message', $event)"
          @select-template="$emit('quick-template-select', $event)"
          @retry="$emit('retry-generation', $event)"
          @clear-history="$emit('clear-history')"
          @update:model-value="$emit('update:input-text', $event)"
        />
      </div>
    </div>
    
    <!-- 移动端布局 -->
    <div v-else class="mobile-creation-layout">
      <ChatInterface
        :messages="messages"
        :model-value="inputText"
        :templates="templates"
        :selected-template="selectedQuickTemplate"
        :is-generating="isGenerating"
        :placeholder="placeholder"
        @send="$emit('send-message', $event)"
        @select-template="$emit('quick-template-select', $event)"
        @retry="$emit('retry-generation', $event)"
        @clear-history="$emit('clear-history')"
        @update:model-value="$emit('update:input-text', $event)"
      />
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue'
import ChatInterface from '../components/ChatInterface.vue'
import TemplateSelector from '../components/TemplateSelector.vue'

const props = defineProps({
  // 数据属性
  messages: {
    type: Array,
    default: () => []
  },
  templates: {
    type: Array,
    default: () => []
  },
  inputText: {
    type: String,
    default: ''
  },
  selectedTemplate: {
    type: Number,
    default: 0
  },
  selectedQuickTemplate: {
    type: Number,
    default: null
  },
  isGenerating: {
    type: Boolean,
    default: false
  },
  placeholder: {
    type: String,
    default: '描述你的创作需求...'
  },
  isMobile: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'template-select',
  'quick-template-select', 
  'send-message',
  'retry-generation',
  'clear-history',
  'update:input-text'
])
</script>

<style scoped>
.ai-creation-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* PC端布局 */
.desktop-creation-layout {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.template-section {
  max-height: 200px;
  overflow-y: auto;
  border-bottom: 1px solid #e0e0e0;
  background: #fff;
}

.chat-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 移动端布局 */
.mobile-creation-layout {
  height: 100%;
  display: flex;
  flex-direction: column;
}
</style>