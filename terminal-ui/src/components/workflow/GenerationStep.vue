<template>
  <div class="generation-step">
    <div class="step-header">
      <h2 class="step-title">AI 正在生成您的知识卡片</h2>
      <p class="step-description">
        请稍候，我们正在为您创建专业的知识卡片...
      </p>
    </div>

    <div class="generation-progress">
      <div class="progress-circle">
        <div class="progress-animation">
          <div class="circle-bg"></div>
          <div class="circle-fill" :style="{ transform: `rotate(${progress * 3.6}deg)` }"></div>
          <div class="progress-text">{{ progress }}%</div>
        </div>
      </div>

      <div class="progress-steps">
        <div 
          v-for="(step, index) in generationSteps" 
          :key="step.id"
          class="progress-step"
          :class="{ 
            active: currentGenerationStep === index,
            completed: index < currentGenerationStep 
          }"
        >
          <div class="step-icon">
            <el-icon v-if="index < currentGenerationStep"><Check /></el-icon>
            <el-icon v-else-if="currentGenerationStep === index" class="loading"><Loading /></el-icon>
            <el-icon v-else><Clock /></el-icon>
          </div>
          <div class="step-text">
            <div class="step-name">{{ step.name }}</div>
            <div class="step-desc">{{ step.description }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="generation-preview" v-if="previewCards.length > 0">
      <h3 class="preview-title">生成预览</h3>
      <div class="preview-grid">
        <div 
          v-for="card in previewCards" 
          :key="card.id"
          class="preview-card"
        >
          <div class="card-thumbnail">
            <img :src="card.thumbnail" :alt="card.title" />
          </div>
          <div class="card-info">
            <div class="card-title">{{ card.title }}</div>
            <div class="card-status">{{ card.status }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="action-buttons">
      <FluentButton variant="subtle" @click="$emit('prev')" :disabled="isGenerating">
        <template #icon><ArrowLeft /></template>
        上一步
      </FluentButton>
      
      <FluentButton 
        variant="primary" 
        :disabled="progress < 100"
        @click="handleNext"
        :loading="isGenerating"
      >
        <span v-if="progress < 100">生成中...</span>
        <span v-else>查看结果</span>
        <template #icon v-if="progress >= 100"><ArrowRight /></template>
      </FluentButton>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import FluentButton from '../FluentButton.vue'
import { ArrowLeft, ArrowRight, Check, Loading, Clock } from '@element-plus/icons-vue'

const emit = defineEmits(['next', 'prev'])

const progress = ref(0)
const currentGenerationStep = ref(0)
const isGenerating = ref(true)
const previewCards = ref([])

// 真实的 AI 生成流程步骤
const generationSteps = ref([
  { id: 1, name: '构造提示词', description: '根据风格.md和主题构造Claude提示' },
  { id: 2, name: 'Claude 生成', description: '调用Claude Code生成结构化JSON' },
  { id: 3, name: '验证JSON', description: '检查JSON格式和内容完整性' },
  { id: 4, name: 'MCP渲染', description: '传递给MCP server生成页面' },
  { id: 5, name: '获取URL', description: '返回HTML卡片预览链接' }
])

let progressInterval = null
let stepInterval = null

const startGeneration = () => {
  // 模拟进度更新
  progressInterval = setInterval(() => {
    if (progress.value < 100) {
      progress.value += Math.random() * 10
      if (progress.value > 100) progress.value = 100
    }
  }, 500)

  // 模拟步骤更新
  stepInterval = setInterval(() => {
    if (currentGenerationStep.value < generationSteps.value.length - 1) {
      currentGenerationStep.value++
    }
    
    // 在第3步时添加预览卡片
    if (currentGenerationStep.value === 2 && previewCards.value.length === 0) {
      previewCards.value = [
        { 
          id: 1, 
          title: '版本 A', 
          status: '生成中...', 
          thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmOWZmIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMiIgZmlsbD0iIzAwNzhmOSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPueJiOacrCBBPC90ZXh0Pjwvc3ZnPg==' 
        },
        { 
          id: 2, 
          title: '版本 B', 
          status: '等待中...', 
          thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZmZmN2VkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMiIgZmlsbD0iI2Y1OTc0MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPueJiOacrCBCPC90ZXh0Pjwvc3ZnPg==' 
        }
      ]
    }
  }, 2000)

  // 6秒后完成生成
  setTimeout(() => {
    progress.value = 100
    currentGenerationStep.value = generationSteps.value.length - 1
    isGenerating.value = false
    
    // 更新预览状态
    previewCards.value.forEach(card => {
      card.status = '已完成'
    })
    
    clearInterval(progressInterval)
    clearInterval(stepInterval)
  }, 6000)
}

const handleNext = () => {
  emit('next', {
    cards: previewCards.value,
    step: 'generation'
  })
}

onMounted(() => {
  startGeneration()
})

onUnmounted(() => {
  if (progressInterval) clearInterval(progressInterval)
  if (stepInterval) clearInterval(stepInterval)
})
</script>

<style scoped>
.generation-step {
  display: flex;
  flex-direction: column;
  gap: var(--fluent-space-xl);
  max-width: 800px;
  margin: 0 auto;
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

.generation-progress {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--fluent-space-xl);
}

.progress-circle {
  position: relative;
}

.progress-animation {
  position: relative;
  width: 120px;
  height: 120px;
}

.circle-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 8px solid rgba(0, 120, 212, 0.1);
}

.circle-fill {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 8px solid transparent;
  border-top-color: var(--fluent-blue);
  transform-origin: center;
  transition: transform var(--fluent-duration-normal) var(--fluent-easing);
}

.progress-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: var(--fluent-font-size-xl);
  font-weight: 600;
  color: var(--fluent-blue);
}

.progress-steps {
  display: flex;
  flex-direction: column;
  gap: var(--fluent-space-md);
  width: 100%;
  max-width: 400px;
}

.progress-step {
  display: flex;
  align-items: center;
  gap: var(--fluent-space-md);
  padding: var(--fluent-space-md);
  background: rgba(255, 255, 255, 0.6);
  border-radius: var(--fluent-radius-medium);
  transition: all var(--fluent-duration-normal) var(--fluent-easing);
}

.progress-step.active {
  background: rgba(0, 120, 212, 0.1);
  border: 1px solid rgba(0, 120, 212, 0.2);
}

.progress-step.completed {
  background: rgba(16, 124, 16, 0.1);
  border: 1px solid rgba(16, 124, 16, 0.2);
}

.step-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--fluent-neutral-lighter);
  color: var(--fluent-neutral-secondary);
}

.progress-step.active .step-icon {
  background: var(--fluent-blue);
  color: var(--fluent-neutral-white);
}

.progress-step.completed .step-icon {
  background: var(--fluent-success);
  color: var(--fluent-neutral-white);
}

.step-icon .loading {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.step-text {
  flex: 1;
}

.step-name {
  font-weight: 600;
  color: var(--fluent-neutral-primary);
  margin-bottom: 2px;
}

.step-desc {
  font-size: var(--fluent-font-size-sm);
  color: var(--fluent-neutral-secondary);
}

.generation-preview {
  margin-top: var(--fluent-space-lg);
}

.preview-title {
  font-size: var(--fluent-font-size-lg);
  font-weight: 600;
  color: var(--fluent-neutral-primary);
  margin-bottom: var(--fluent-space-md);
  text-align: center;
}

.preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--fluent-space-md);
}

.preview-card {
  background: rgba(255, 255, 255, 0.8);
  border-radius: var(--fluent-radius-medium);
  padding: var(--fluent-space-md);
  text-align: center;
}

.card-thumbnail {
  width: 100%;
  height: 80px;
  border-radius: var(--fluent-radius-small);
  overflow: hidden;
  margin-bottom: var(--fluent-space-sm);
}

.card-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.card-title {
  font-weight: 600;
  color: var(--fluent-neutral-primary);
  margin-bottom: 4px;
}

.card-status {
  font-size: var(--fluent-font-size-sm);
  color: var(--fluent-neutral-secondary);
}

.action-buttons {
  display: flex;
  justify-content: space-between;
  padding-top: var(--fluent-space-lg);
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}
</style>