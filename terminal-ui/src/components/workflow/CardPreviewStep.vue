<template>
  <div class="card-preview-step">
    <div class="step-header">
      <h2 class="step-title">预览与编辑</h2>
      <p class="step-description">
        预览生成的卡片，进行最后的调整和优化
      </p>
    </div>

    <div class="preview-container">
      <!-- 卡片版本选择 -->
      <div class="version-selector">
        <div 
          v-for="card in cards" 
          :key="card.id"
          class="version-item"
          :class="{ active: selectedCard === card.id }"
          @click="selectCard(card.id)"
        >
          <div class="version-thumbnail">
            <img :src="card.thumbnail" :alt="card.title" />
          </div>
          <span class="version-label">{{ card.title }}</span>
        </div>
      </div>

      <!-- 主预览区域 -->
      <div class="main-preview">
        <div class="preview-canvas">
          <div class="card-mockup">
            <div class="mockup-content">
              <h3>您的知识卡片</h3>
              <p>这里是卡片的主要内容预览...</p>
              <div class="mockup-footer">
                <span>AI Generated Knowledge Card</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 编辑工具栏 -->
        <div class="edit-toolbar">
          <div class="toolbar-section">
            <span class="toolbar-label">字体大小</span>
            <el-slider v-model="fontSize" :min="12" :max="24" show-input />
          </div>
          
          <div class="toolbar-section">
            <span class="toolbar-label">主色调</span>
            <div class="color-picker">
              <div 
                v-for="color in colors" 
                :key="color"
                class="color-option"
                :style="{ backgroundColor: color }"
                :class="{ active: selectedColor === color }"
                @click="selectedColor = color"
              ></div>
            </div>
          </div>

          <div class="toolbar-section">
            <span class="toolbar-label">布局</span>
            <div class="layout-options">
              <FluentButton 
                v-for="layout in layouts" 
                :key="layout.id"
                variant="subtle" 
                size="small"
                :class="{ active: selectedLayout === layout.id }"
                @click="selectedLayout = layout.id"
              >
                {{ layout.name }}
              </FluentButton>
            </div>
          </div>
        </div>
      </div>

      <!-- 尺寸预览 -->
      <div class="size-preview">
        <h4 class="size-title">平台适配</h4>
        <div class="size-options">
          <div 
            v-for="size in socialSizes" 
            :key="size.id"
            class="size-option"
            :class="{ active: selectedSize === size.id }"
            @click="selectedSize = size.id"
          >
            <div class="size-icon">
              <el-icon><component :is="size.icon" /></el-icon>
            </div>
            <div class="size-info">
              <div class="size-name">{{ size.name }}</div>
              <div class="size-dimensions">{{ size.dimensions }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="action-buttons">
      <FluentButton variant="subtle" @click="$emit('prev')">
        <template #icon><ArrowLeft /></template>
        上一步
      </FluentButton>
      
      <div class="action-right">
        <FluentButton variant="subtle" @click="regenerateCard">
          <template #icon><Refresh /></template>
          重新生成
        </FluentButton>
        
        <FluentButton 
          variant="primary" 
          @click="handleNext"
        >
          完成编辑
          <template #icon><ArrowRight /></template>
        </FluentButton>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import FluentButton from '../FluentButton.vue'
import { 
  ArrowLeft, ArrowRight, Refresh,
  Platform, Promotion as Brand, Monitor
} from '@element-plus/icons-vue'

const emit = defineEmits(['next', 'prev'])

const selectedCard = ref(1)
const selectedColor = ref('#0078d4')
const selectedLayout = ref(1)
const selectedSize = ref(1)
const fontSize = ref(16)

const cards = ref([
  { 
    id: 1, 
    title: '版本 A', 
    thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmOWZmIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMiIgZmlsbD0iIzAwNzhmOSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPueJiOacrCBBPC90ZXh0Pjwvc3ZnPg==' 
  },
  { 
    id: 2, 
    title: '版本 B', 
    thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZmZmN2VkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMiIgZmlsbD0iI2Y1OTc0MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPueJiOacrCBCPC90ZXh0Pjwvc3ZnPg==' 
  },
  { 
    id: 3, 
    title: '版本 C', 
    thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmZGY0Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMiIgZmlsbD0iIzEwNzI0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+54mI5pysMEM8L3RleHQ+PC9zdmc+' 
  }
])

const colors = ref(['#0078d4', '#d83b01', '#107c10', '#5c2d91', '#e3008c'])

const layouts = ref([
  { id: 1, name: '标准' },
  { id: 2, name: '居中' },
  { id: 3, name: '左对齐' }
])

const socialSizes = ref([
  { id: 1, name: 'Instagram', dimensions: '1080x1080', icon: Platform },
  { id: 2, name: 'Twitter', dimensions: '1200x675', icon: Brand },
  { id: 3, name: '微博', dimensions: '900x500', icon: Monitor },
  { id: 4, name: '通用', dimensions: '1200x800', icon: Monitor }
])

const selectCard = (cardId) => {
  selectedCard.value = cardId
}

const regenerateCard = () => {
  // 重新生成逻辑
}

const handleNext = () => {
  emit('next', {
    selectedCard: selectedCard.value,
    settings: {
      color: selectedColor.value,
      layout: selectedLayout.value,
      size: selectedSize.value,
      fontSize: fontSize.value
    },
    step: 'card-preview'
  })
}
</script>

<style scoped>
.card-preview-step {
  display: flex;
  flex-direction: column;
  gap: var(--fluent-space-xl);
}

.step-header {
  text-align: center;
}

.step-title {
  font-size: var(--fluent-font-size-hero);
  font-weight: 600;
  color: var(--fluent-neutral-primary);
  margin: 0 0 var(--fluent-space-md) 0;
  background: linear-gradient(135deg, var(--fluent-blue) 0%, var(--fluent-blue-light) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.step-description {
  font-size: var(--fluent-font-size-lg);
  color: var(--fluent-neutral-secondary);
  margin: 0;
}

.preview-container {
  display: grid;
  grid-template-columns: 200px 1fr 250px;
  gap: var(--fluent-space-lg);
  height: 600px;
}

.version-selector {
  display: flex;
  flex-direction: column;
  gap: var(--fluent-space-sm);
}

.version-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--fluent-space-xs);
  padding: var(--fluent-space-sm);
  background: rgba(255, 255, 255, 0.6);
  border: 2px solid transparent;
  border-radius: var(--fluent-radius-medium);
  cursor: pointer;
  transition: all var(--fluent-duration-normal) var(--fluent-easing);
}

.version-item:hover {
  background: rgba(255, 255, 255, 0.8);
  transform: translateY(-2px);
}

.version-item.active {
  border-color: var(--fluent-blue);
  background: rgba(0, 120, 212, 0.1);
}

.version-thumbnail {
  width: 80px;
  height: 50px;
  border-radius: var(--fluent-radius-small);
  overflow: hidden;
}

.version-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.version-label {
  font-size: var(--fluent-font-size-sm);
  font-weight: 500;
  color: var(--fluent-neutral-primary);
}

.main-preview {
  display: flex;
  flex-direction: column;
  gap: var(--fluent-space-md);
}

.preview-canvas {
  flex: 1;
  background: rgba(255, 255, 255, 0.8);
  border-radius: var(--fluent-radius-large);
  padding: var(--fluent-space-xl);
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-mockup {
  width: 400px;
  height: 300px;
  background: white;
  border-radius: var(--fluent-radius-medium);
  box-shadow: var(--fluent-depth-8);
  padding: var(--fluent-space-lg);
  display: flex;
  flex-direction: column;
}

.mockup-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  text-align: center;
}

.mockup-content h3 {
  font-size: var(--fluent-font-size-xl);
  color: var(--fluent-neutral-primary);
  margin-bottom: var(--fluent-space-md);
}

.mockup-content p {
  color: var(--fluent-neutral-secondary);
  line-height: 1.6;
}

.mockup-footer {
  border-top: 1px solid var(--fluent-neutral-lighter);
  padding-top: var(--fluent-space-sm);
  font-size: var(--fluent-font-size-xs);
  color: var(--fluent-neutral-tertiary);
  text-align: center;
}

.edit-toolbar {
  display: flex;
  flex-direction: column;
  gap: var(--fluent-space-md);
  background: rgba(255, 255, 255, 0.8);
  border-radius: var(--fluent-radius-medium);
  padding: var(--fluent-space-lg);
}

.toolbar-section {
  display: flex;
  flex-direction: column;
  gap: var(--fluent-space-sm);
}

.toolbar-label {
  font-weight: 600;
  font-size: var(--fluent-font-size-sm);
  color: var(--fluent-neutral-primary);
}

.color-picker {
  display: flex;
  gap: var(--fluent-space-xs);
}

.color-option {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  cursor: pointer;
  border: 3px solid transparent;
  transition: all var(--fluent-duration-normal) var(--fluent-easing);
}

.color-option:hover {
  transform: scale(1.1);
}

.color-option.active {
  border-color: var(--fluent-neutral-white);
  box-shadow: 0 0 0 2px var(--fluent-neutral-primary);
}

.layout-options {
  display: flex;
  gap: var(--fluent-space-xs);
}

.layout-options .active {
  background: var(--fluent-blue);
  color: var(--fluent-neutral-white);
}

.size-preview {
  display: flex;
  flex-direction: column;
  gap: var(--fluent-space-md);
}

.size-title {
  font-size: var(--fluent-font-size-md);
  font-weight: 600;
  color: var(--fluent-neutral-primary);
  margin: 0;
}

.size-options {
  display: flex;
  flex-direction: column;
  gap: var(--fluent-space-sm);
}

.size-option {
  display: flex;
  align-items: center;
  gap: var(--fluent-space-sm);
  padding: var(--fluent-space-sm);
  background: rgba(255, 255, 255, 0.6);
  border: 2px solid transparent;
  border-radius: var(--fluent-radius-medium);
  cursor: pointer;
  transition: all var(--fluent-duration-normal) var(--fluent-easing);
}

.size-option:hover {
  background: rgba(255, 255, 255, 0.8);
}

.size-option.active {
  border-color: var(--fluent-blue);
  background: rgba(0, 120, 212, 0.1);
}

.size-icon {
  color: var(--fluent-blue);
}

.size-info {
  flex: 1;
}

.size-name {
  font-weight: 600;
  font-size: var(--fluent-font-size-sm);
  color: var(--fluent-neutral-primary);
}

.size-dimensions {
  font-size: var(--fluent-font-size-xs);
  color: var(--fluent-neutral-secondary);
}

.action-buttons {
  display: flex;
  justify-content: space-between;
  padding-top: var(--fluent-space-lg);
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.action-right {
  display: flex;
  gap: var(--fluent-space-md);
}

/* 响应式调整 */
@media (max-width: 1200px) {
  .preview-container {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto auto;
    height: auto;
  }
  
  .version-selector {
    flex-direction: row;
    justify-content: center;
  }
}
</style>