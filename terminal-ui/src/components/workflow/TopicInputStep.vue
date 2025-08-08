<template>
  <div class="topic-input-step">
    <!-- 步骤标题 -->
    <div class="step-header">
      <h2 class="step-title">创建您的知识卡片</h2>
      <p class="step-description">
        输入您想要分享的主题或内容，AI 将帮助您生成专业的知识卡片
      </p>
    </div>

    <!-- 主输入区域 -->
    <div class="input-section">
      <FluentCard class="input-card" acrylic :depth="4" padding="0">
        <div class="input-wrapper">
          <div class="input-header">
            <el-icon class="input-icon"><Edit /></el-icon>
            <span class="input-label">主题内容</span>
            <div class="input-counter">{{ inputText.length }} / 500</div>
          </div>
          
          <textarea
            v-model="inputText"
            class="topic-input"
            placeholder="例如：&quot;如何提高工作效率的5个技巧&quot; 或 &quot;Vue 3 组合式 API 核心概念&quot;&#10;&#10;您可以描述：&#10;• 技术教程和知识点&#10;• 生活技巧和方法&#10;• 商业洞察和观点&#10;• 创意想法和灵感&#10;&#10;越详细的描述，生成的卡片效果越好！"
            maxlength="500"
            rows="8"
            @input="handleInput"
          ></textarea>

          <div class="input-suggestions" v-if="suggestions.length > 0">
            <div class="suggestions-header">
              <el-icon><Lightbulb /></el-icon>
              <span>智能建议</span>
            </div>
            <div class="suggestions-list">
              <div 
                v-for="suggestion in suggestions" 
                :key="suggestion.id"
                class="suggestion-item"
                @click="applySuggestion(suggestion.text)"
              >
                <span class="suggestion-text">{{ suggestion.text }}</span>
                <el-icon class="suggestion-icon"><ArrowRight /></el-icon>
              </div>
            </div>
          </div>
        </div>
      </FluentCard>
    </div>

    <!-- 快速主题标签 -->
    <div class="topic-tags-section">
      <h3 class="tags-title">
        <el-icon><Collection /></el-icon>
        热门主题
      </h3>
      <div class="topic-tags">
        <div 
          v-for="tag in popularTopics" 
          :key="tag.id"
          class="topic-tag"
          @click="selectTopic(tag.title)"
        >
          <el-icon><component :is="tag.icon" /></el-icon>
          <span>{{ tag.title }}</span>
        </div>
      </div>
    </div>

    <!-- 历史记录 -->
    <div class="history-section" v-if="recentTopics.length > 0">
      <h3 class="history-title">
        <el-icon><Clock /></el-icon>
        最近使用
      </h3>
      <div class="history-items">
        <div 
          v-for="item in recentTopics" 
          :key="item.id"
          class="history-item"
          @click="selectTopic(item.title)"
        >
          <div class="history-content">
            <span class="history-title-text">{{ item.title }}</span>
            <span class="history-time">{{ formatTime(item.timestamp) }}</span>
          </div>
          <el-icon class="history-icon"><ArrowRight /></el-icon>
        </div>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="action-buttons">
      <div class="action-left">
        <FluentButton variant="subtle" :icon="Microphone">
          语音输入
        </FluentButton>
        <FluentButton variant="subtle" :icon="DocumentCopy">
          粘贴内容
        </FluentButton>
      </div>
      
      <div class="action-right">
        <FluentButton 
          variant="primary" 
          size="large"
          :disabled="!inputText.trim()"
          @click="handleNext"
          class="next-button fluent-glow-hover"
        >
          下一步：选择模板
          <template #icon>
            <el-icon><ArrowRight /></el-icon>
          </template>
        </FluentButton>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import FluentCard from '../FluentCard.vue'
import FluentButton from '../FluentButton.vue'
import { 
  Edit, InfoFilled as Lightbulb, ArrowRight, Collection, Clock,
  Mic as Microphone, DocumentCopy, Monitor, Reading, 
  OfficeBuilding, PictureFilled, Cpu
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const emit = defineEmits(['next'])

const inputText = ref('')
const suggestions = ref([])

// 热门主题
const popularTopics = ref([
  { id: 1, title: 'Vue 3 开发技巧', icon: Monitor },
  { id: 2, title: '工作效率提升', icon: OfficeBuilding },
  { id: 3, title: '学习方法总结', icon: Reading },
  { id: 4, title: '设计思维', icon: PictureFilled },
  { id: 5, title: 'AI 工具使用', icon: Cpu },
])

// 最近主题
const recentTopics = ref([])

// 智能建议生成
const generateSuggestions = (text) => {
  if (text.length < 3) {
    suggestions.value = []
    return
  }

  // 模拟AI建议
  const baseSuggestions = [
    '添加具体的数据和案例支撑',
    '包含实际操作步骤',
    '提供相关工具推荐',
    '添加注意事项和常见问题'
  ]

  suggestions.value = baseSuggestions.slice(0, 2).map((text, index) => ({
    id: index,
    text: `${text}：${inputText.value}`
  }))
}

const handleInput = () => {
  generateSuggestions(inputText.value)
}

const applySuggestion = (suggestion) => {
  inputText.value = suggestion
  suggestions.value = []
  ElMessage.success('已应用建议')
}

const selectTopic = (topic) => {
  inputText.value = topic
  suggestions.value = []
}

const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleDateString('zh-CN')
}

const handleNext = () => {
  if (!inputText.value.trim()) {
    ElMessage.warning('请输入主题内容')
    return
  }

  // 保存到历史记录
  const newTopic = {
    id: Date.now(),
    title: inputText.value.trim(),
    timestamp: new Date().toISOString()
  }
  
  recentTopics.value.unshift(newTopic)
  if (recentTopics.value.length > 5) {
    recentTopics.value = recentTopics.value.slice(0, 5)
  }

  emit('next', {
    topic: inputText.value.trim(),
    step: 'topic-input'
  })
}

// 加载历史记录
onMounted(() => {
  const saved = localStorage.getItem('recentTopics')
  if (saved) {
    recentTopics.value = JSON.parse(saved)
  }
})

// 保存历史记录
watch(recentTopics, (newTopics) => {
  localStorage.setItem('recentTopics', JSON.stringify(newTopics))
}, { deep: true })
</script>

<style scoped>
.topic-input-step {
  display: flex;
  flex-direction: column;
  gap: var(--fluent-space-xl);
  max-width: 900px;
  margin: 0 auto;
}

/* 步骤标题 */
.step-header {
  text-align: center;
  margin-bottom: var(--fluent-space-lg);
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
  line-height: 1.6;
  margin: 0;
  max-width: 600px;
  margin: 0 auto;
}

/* 输入区域 */
.input-section {
  margin-bottom: var(--fluent-space-lg);
}

.input-card {
  transition: all var(--fluent-duration-normal) var(--fluent-easing);
}

.input-card:focus-within {
  transform: translateY(-4px);
  box-shadow: var(--fluent-depth-16);
}

.input-wrapper {
  padding: var(--fluent-space-lg);
}

.input-header {
  display: flex;
  align-items: center;
  gap: var(--fluent-space-sm);
  margin-bottom: var(--fluent-space-md);
}

.input-icon {
  color: var(--fluent-blue);
  font-size: 18px;
}

.input-label {
  font-weight: 600;
  color: var(--fluent-neutral-primary);
  flex: 1;
}

.input-counter {
  font-size: var(--fluent-font-size-sm);
  color: var(--fluent-neutral-tertiary);
}

.topic-input {
  width: 100%;
  background: rgba(255, 255, 255, 0.8);
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: var(--fluent-radius-large);
  padding: var(--fluent-space-lg);
  font-family: var(--fluent-font-family);
  font-size: var(--fluent-font-size-md);
  color: var(--fluent-neutral-primary);
  resize: none;
  transition: all var(--fluent-duration-normal) var(--fluent-easing);
  backdrop-filter: blur(10px);
  line-height: 1.6;
}

.topic-input:focus {
  outline: none;
  border-color: var(--fluent-blue);
  box-shadow: 0 0 0 4px rgba(0, 120, 212, 0.2);
  background: rgba(255, 255, 255, 0.95);
}

.topic-input::placeholder {
  color: var(--fluent-neutral-tertiary);
  line-height: 1.6;
}

/* 智能建议 */
.input-suggestions {
  margin-top: var(--fluent-space-md);
  padding: var(--fluent-space-md);
  background: rgba(0, 120, 212, 0.05);
  border-radius: var(--fluent-radius-medium);
  border: 1px solid rgba(0, 120, 212, 0.2);
}

.suggestions-header {
  display: flex;
  align-items: center;
  gap: var(--fluent-space-xs);
  margin-bottom: var(--fluent-space-sm);
  color: var(--fluent-blue);
  font-weight: 600;
  font-size: var(--fluent-font-size-sm);
}

.suggestions-list {
  display: flex;
  flex-direction: column;
  gap: var(--fluent-space-xs);
}

.suggestion-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--fluent-space-sm);
  background: rgba(255, 255, 255, 0.6);
  border-radius: var(--fluent-radius-medium);
  cursor: pointer;
  transition: all var(--fluent-duration-normal) var(--fluent-easing);
}

.suggestion-item:hover {
  background: rgba(255, 255, 255, 0.8);
  transform: translateX(4px);
}

.suggestion-text {
  font-size: var(--fluent-font-size-sm);
  color: var(--fluent-neutral-primary);
}

.suggestion-icon {
  color: var(--fluent-blue);
  font-size: 14px;
}

/* 主题标签 */
.topic-tags-section {
  margin-bottom: var(--fluent-space-lg);
}

.tags-title {
  display: flex;
  align-items: center;
  gap: var(--fluent-space-sm);
  margin-bottom: var(--fluent-space-md);
  font-size: var(--fluent-font-size-lg);
  font-weight: 600;
  color: var(--fluent-neutral-primary);
}

.tags-title el-icon {
  color: var(--fluent-blue);
}

.topic-tags {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--fluent-space-md);
}

.topic-tag {
  display: flex;
  align-items: center;
  gap: var(--fluent-space-sm);
  padding: var(--fluent-space-md);
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: var(--fluent-radius-medium);
  cursor: pointer;
  transition: all var(--fluent-duration-normal) var(--fluent-easing);
  backdrop-filter: blur(10px);
}

.topic-tag:hover {
  background: rgba(255, 255, 255, 0.8);
  border-color: var(--fluent-blue);
  transform: translateY(-2px);
  box-shadow: var(--fluent-depth-4);
}

.topic-tag el-icon {
  color: var(--fluent-blue);
}

.topic-tag span {
  font-weight: 500;
  color: var(--fluent-neutral-primary);
}

/* 历史记录 */
.history-section {
  margin-bottom: var(--fluent-space-lg);
}

.history-title {
  display: flex;
  align-items: center;
  gap: var(--fluent-space-sm);
  margin-bottom: var(--fluent-space-md);
  font-size: var(--fluent-font-size-lg);
  font-weight: 600;
  color: var(--fluent-neutral-primary);
}

.history-title el-icon {
  color: var(--fluent-blue);
}

.history-items {
  display: flex;
  flex-direction: column;
  gap: var(--fluent-space-sm);
}

.history-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--fluent-space-md);
  background: rgba(255, 255, 255, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: var(--fluent-radius-medium);
  cursor: pointer;
  transition: all var(--fluent-duration-normal) var(--fluent-easing);
}

.history-item:hover {
  background: rgba(255, 255, 255, 0.6);
  transform: translateX(4px);
}

.history-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.history-title-text {
  font-weight: 500;
  color: var(--fluent-neutral-primary);
}

.history-time {
  font-size: var(--fluent-font-size-xs);
  color: var(--fluent-neutral-tertiary);
}

.history-icon {
  color: var(--fluent-blue);
  font-size: 16px;
}

/* 操作按钮 */
.action-buttons {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: var(--fluent-space-lg);
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.action-left {
  display: flex;
  gap: var(--fluent-space-md);
}

.action-right {
  display: flex;
  gap: var(--fluent-space-md);
}

.next-button {
  font-size: var(--fluent-font-size-md);
  padding: var(--fluent-space-md) var(--fluent-space-xl);
}

/* 响应式调整 */
@media (max-width: 768px) {
  .topic-tags {
    grid-template-columns: 1fr;
  }
  
  .action-buttons {
    flex-direction: column;
    gap: var(--fluent-space-md);
    align-items: stretch;
  }
  
  .action-left,
  .action-right {
    justify-content: center;
  }
}
</style>