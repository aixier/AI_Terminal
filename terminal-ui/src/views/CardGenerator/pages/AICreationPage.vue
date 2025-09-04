<template>
  <div class="ai-creation-page" :class="{ mobile: isMobile }">
    <!-- PC端布局 -->
    <div v-if="!isMobile" class="desktop-creation-layout">
      <!-- 中间素材栏 -->
      <div class="assets-section">
        <AssetManager
          title="我的素材"
          empty-message="暂无素材，点击上传添加"
          @select-asset="handleSelectAsset"
          @preview-asset="handlePreviewAsset"
        />
      </div>
      
      <!-- 右侧对话区域 -->
      <div class="chat-section">
        <!-- 消息列表（可滚动） -->
        <div class="messages-area">
          <MessageListView
            :messages="messages"
            :is-mobile="false"
            @retry-generation="$emit('retry-generation', $event)"
            @preview-content="handlePreviewContent"
            @save-content="handleSaveContent"
            @share-content="handleShareContent"
            @clear-chat="$emit('clear-history')"
          />
        </div>
        
        <!-- 输入面板（固定底部） -->
        <div class="input-area">
          <ChatInputPanel
            :input-text="inputText"
            :is-generating="isGenerating"
            :placeholder="placeholder"
            :is-mobile="false"
            :max-templates="6"
            @send-message="$emit('send-message', $event)"
            @clear-history="$emit('clear-history')"
            @update:input-text="$emit('update:input-text', $event)"
          />
        </div>
      </div>
    </div>
    
    <!-- 移动端布局 -->
    <div v-else class="mobile-creation-layout">
      <!-- 消息列表（全屏滚动） -->
      <MessageListView
        :messages="messages"
        :is-mobile="true"
        @retry-generation="$emit('retry-generation', $event)"
        @preview-content="handlePreviewContent"
        @save-content="handleSaveContent"
        @share-content="handleShareContent"
        @clear-chat="$emit('clear-history')"
      />
      
      <!-- 输入面板（浮动在底部） -->
      <ChatInputPanel
        :input-text="inputText"
        :is-generating="isGenerating"
        :placeholder="placeholder"
        :is-mobile="true"
        :max-templates="4"
        @send-message="$emit('send-message', $event)"
        @clear-history="$emit('clear-history')"
        @update:input-text="$emit('update:input-text', $event)"
      />
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue'
import MessageListView from '../components/MessageListView.vue'
import ChatInputPanel from '../components/ChatInputPanel.vue'
import AssetManager from '../../../components/assets/AssetManagerSimple.vue'

const props = defineProps({
  // 数据属性
  messages: {
    type: Array,
    default: () => []
  },
  inputText: {
    type: String,
    default: ''
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
  'send-message',
  'retry-generation',
  'clear-history',
  'update:input-text'
])

// 处理素材选择
const handleSelectAsset = (asset) => {
  // 将素材引用插入到输入框
  const reference = `@${asset.name}`
  emit('update:input-text', props.inputText + reference)
}

// 处理素材预览
const handlePreviewAsset = (asset) => {
  // 根据资源类型预览
  if (asset.type === 'image') {
    // 使用代理端点获取完整图片
    const imageUrl = `/api/assets/file/${asset.id}`
    window.open(imageUrl, '_blank')
  } else if (asset.type === 'document') {
    // 文档类型也通过代理下载
    const fileUrl = `/api/assets/file/${asset.id}`
    window.open(fileUrl, '_blank')
  } else {
    console.log('Preview asset:', asset)
  }
}

// 处理消息操作
const handlePreviewContent = (message) => {
  // TODO: 实现预览功能
  console.log('Preview content:', message)
}

const handleSaveContent = (message) => {
  // TODO: 实现保存功能  
  console.log('Save content:', message)
}

const handleShareContent = (message) => {
  // TODO: 实现分享功能
  console.log('Share content:', message)
}
</script>

<style scoped>
.ai-creation-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* PC端布局 - 三栏式 */
.desktop-creation-layout {
  height: 100%;
  display: flex;
  gap: 20px;
}

/* 中间素材栏 */
.assets-section {
  width: 400px;
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* 右侧对话区域 */
.chat-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.messages-area {
  flex: 1;
  overflow: hidden;
  position: relative;
  min-height: 0; /* 确保flex布局正常工作 */
}

.input-area {
  position: sticky;
  bottom: 0;
  z-index: 100;
  background: #fff;
  border-top: 1px solid #e0e0e0;
}

/* 移动端布局 */
.mobile-creation-layout {
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: visible; /* 允许内容超出 */
}

</style>