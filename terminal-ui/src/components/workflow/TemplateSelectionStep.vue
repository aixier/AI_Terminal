<template>
  <div class="template-selection-step">
    <div class="step-header">
      <h2 class="step-title">选择风格规范</h2>
      <p class="step-description">
        选择公共风格模板(.md规范文档)，AI将根据规范文档生成符合该风格的知识卡片内容
      </p>
    </div>

    <!-- AI推荐模板 -->
    <div class="recommended-section" v-if="recommendedTemplates.length > 0">
      <h3 class="section-title">
        <el-icon><StarFilled /></el-icon>
        AI推荐风格
      </h3>
      <div class="recommended-notice">
        <el-icon><InfoFilled /></el-icon>
        <span>基于您的主题内容，为您推荐以下风格规范</span>
      </div>
      <div class="templates-grid recommended">
        <div 
          v-for="template in recommendedTemplates" 
          :key="template.id"
          class="template-card recommended"
          :class="{ selected: selectedTemplate === template.id }"
          @click="selectTemplate(template)"
        >
          <div class="template-preview">
            <div class="template-icon" :style="{ backgroundColor: template.color }">
              <el-icon><component :is="template.icon" /></el-icon>
            </div>
          </div>
          <div class="template-info">
            <div class="template-name">{{ template.name }}</div>
            <div class="template-file">{{ template.filename }}</div>
            <div class="template-description">{{ template.description }}</div>
            <div class="template-features">
              <span v-for="feature in template.features" :key="feature" class="feature">{{ feature }}</span>
            </div>
          </div>
          <div class="selection-indicator" v-if="selectedTemplate === template.id">
            <el-icon><Check /></el-icon>
          </div>
        </div>
      </div>
    </div>

    <!-- 所有模板 -->
    <div class="all-templates-section">
      <h3 class="section-title">
        <el-icon><Document /></el-icon>
        所有风格规范
      </h3>
      <div class="templates-grid">
        <div 
          v-for="template in templates" 
          :key="template.id"
          class="template-card"
          :class="{ selected: selectedTemplate === template.id }"
          @click="selectTemplate(template)"
        >
          <div class="template-preview">
            <div class="template-icon" :style="{ backgroundColor: template.color }">
              <el-icon><component :is="template.icon" /></el-icon>
            </div>
          </div>
          <div class="template-info">
            <div class="template-name">{{ template.name }}</div>
            <div class="template-file">{{ template.filename }}</div>
            <div class="template-description">{{ template.description }}</div>
            <div class="template-usage">
              <strong>适用场景：</strong>{{ template.usage }}
            </div>
            <div class="template-features">
              <span v-for="feature in template.features" :key="feature" class="feature">{{ feature }}</span>
            </div>
          </div>
          <div class="selection-indicator" v-if="selectedTemplate === template.id">
            <el-icon><Check /></el-icon>
          </div>
        </div>
      </div>
    </div>

    <div class="action-buttons">
      <FluentButton variant="subtle" @click="$emit('prev')">
        <template #icon><ArrowLeft /></template>
        上一步
      </FluentButton>
      
      <FluentButton 
        variant="primary" 
        :disabled="!selectedTemplate"
        @click="handleNext"
      >
        下一步：生成卡片
        <template #icon><ArrowRight /></template>
      </FluentButton>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import FluentButton from '../FluentButton.vue'
import { ArrowLeft, ArrowRight, Document, StarFilled, InfoFilled, Check, OfficeBuilding, PictureFilled, Reading, Monitor } from '@element-plus/icons-vue'

const emit = defineEmits(['next', 'prev'])

const selectedTemplate = ref(null)

// 公共风格模板 - 对应后端 templates/ 文件夹中的 .md 文件
const templates = ref([
  {
    id: 'business',
    name: '商务专业风格',
    filename: 'business.md',
    description: '正式、专业的商务演示风格，适合企业培训、产品介绍、工作汇报',
    color: '#0078d4',
    icon: OfficeBuilding,
    features: ['简洁布局', '商务配色', '数据图表', '专业字体'],
    usage: '企业培训、产品介绍、工作汇报、商业计划'
  },
  {
    id: 'creative',
    name: '创意设计风格',
    filename: 'creative.md',
    description: '活泼、创新的视觉风格，适合创意展示、品牌宣传、艺术设计',
    color: '#ff4081',
    icon: PictureFilled,
    features: ['渐变色彩', '创意布局', '艺术字体', '视觉冲击'],
    usage: '创意展示、品牌宣传、艺术设计、营销推广'
  },
  {
    id: 'educational',
    name: '教育科普风格',
    filename: 'educational.md',
    description: '清晰、易懂的教学风格，适合知识科普、教程制作、学习分享',
    color: '#107c10',
    icon: Reading,
    features: ['清晰结构', '重点标注', '步骤分解', '易读字体'],
    usage: '知识科普、教程制作、学习分享、技能培训'
  },
  {
    id: 'tech',
    name: '科技前沿风格',
    filename: 'tech.md',
    description: '现代、科技感的设计风格，适合技术分享、产品发布、创新展示',
    color: '#00d4ff',
    icon: Monitor,
    features: ['科技配色', '几何元素', '代码风格', '未来感'],
    usage: '技术分享、产品发布、创新展示、开发教程'
  }
])

// AI推荐模板(基于主题内容分析)
const recommendedTemplates = ref([templates.value[0], templates.value[2]]) // 示例推荐

const selectTemplate = (template) => {
  selectedTemplate.value = template.id
  selectedTemplateData.value = template
}

const selectedTemplateData = ref(null)

const handleNext = () => {
  if (!selectedTemplateData.value) return
  
  emit('next', {
    templateId: selectedTemplate.value,
    templateData: selectedTemplateData.value,
    step: 'template-selection'
  })
}
</script>

<style scoped>
.template-selection-step {
  display: flex;
  flex-direction: column;
  gap: var(--fluent-space-xl);
  max-width: 1000px;
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

/* 章节标题样式 */
.section-title {
  display: flex;
  align-items: center;
  gap: var(--fluent-space-sm);
  font-size: var(--fluent-font-size-lg);
  font-weight: 600;
  color: var(--fluent-neutral-primary);
  margin-bottom: var(--fluent-space-md);
}

.section-title el-icon {
  color: var(--fluent-blue);
}

.recommended-notice {
  display: flex;
  align-items: center;
  gap: var(--fluent-space-xs);
  background: rgba(0, 120, 212, 0.1);
  border: 1px solid rgba(0, 120, 212, 0.2);
  border-radius: var(--fluent-radius-medium);
  padding: var(--fluent-space-sm) var(--fluent-space-md);
  margin-bottom: var(--fluent-space-lg);
  color: var(--fluent-blue);
  font-size: var(--fluent-font-size-sm);
}

.recommended-section {
  margin-bottom: var(--fluent-space-xxl);
}

.all-templates-section {
  margin-bottom: var(--fluent-space-lg);
}

/* 模板网格布局 */
.templates-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: var(--fluent-space-lg);
}

.templates-grid.recommended {
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
}

/* 模板卡片样式 */
.template-card {
  position: relative;
  background: rgba(255, 255, 255, 0.8);
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: var(--fluent-radius-large);
  padding: var(--fluent-space-lg);
  cursor: pointer;
  transition: all var(--fluent-duration-normal) var(--fluent-easing);
  backdrop-filter: blur(10px);
  display: flex;
  gap: var(--fluent-space-md);
}

.template-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--fluent-depth-8);
  border-color: var(--fluent-blue);
}

.template-card.selected {
  border-color: var(--fluent-blue);
  background: rgba(0, 120, 212, 0.1);
  box-shadow: var(--fluent-depth-8);
}

.template-card.recommended {
  border-color: rgba(255, 193, 7, 0.5);
  background: rgba(255, 193, 7, 0.05);
}

.template-card.recommended:hover {
  border-color: #ffc107;
}

/* 模板图标预览 */
.template-preview {
  flex-shrink: 0;
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.template-icon {
  width: 60px;
  height: 60px;
  border-radius: var(--fluent-radius-medium);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 24px;
}

/* 模板信息 */
.template-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--fluent-space-xs);
}

.template-name {
  font-size: var(--fluent-font-size-lg);
  font-weight: 600;
  color: var(--fluent-neutral-primary);
  margin: 0;
}

.template-file {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: var(--fluent-font-size-xs);
  color: var(--fluent-neutral-tertiary);
  background: rgba(0, 0, 0, 0.05);
  padding: 2px 6px;
  border-radius: var(--fluent-radius-small);
  display: inline-block;
  width: fit-content;
}

.template-description {
  font-size: var(--fluent-font-size-sm);
  color: var(--fluent-neutral-secondary);
  line-height: 1.5;
  margin: 0;
}

.template-usage {
  font-size: var(--fluent-font-size-xs);
  color: var(--fluent-neutral-tertiary);
  line-height: 1.4;
}

.template-usage strong {
  color: var(--fluent-neutral-secondary);
}

/* 模板特性标签 */
.template-features {
  display: flex;
  flex-wrap: wrap;
  gap: var(--fluent-space-xs);
  margin-top: var(--fluent-space-xs);
}

.feature {
  background: rgba(0, 120, 212, 0.1);
  color: var(--fluent-blue);
  font-size: 10px;
  padding: 2px 6px;
  border-radius: var(--fluent-radius-small);
  font-weight: 500;
}

.template-card.recommended .feature {
  background: rgba(255, 193, 7, 0.2);
  color: #b8860b;
}

/* 选中指示器 */
.selection-indicator {
  position: absolute;
  top: var(--fluent-space-sm);
  right: var(--fluent-space-sm);
  width: 24px;
  height: 24px;
  background: var(--fluent-blue);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  box-shadow: var(--fluent-depth-4);
}

.template-card.recommended .selection-indicator {
  background: #ffc107;
  color: #212529;
}

.action-buttons {
  display: flex;
  justify-content: space-between;
  padding-top: var(--fluent-space-lg);
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

/* 响应式调整 */
@media (max-width: 768px) {
  .templates-grid {
    grid-template-columns: 1fr;
  }
  
  .template-card {
    flex-direction: column;
    text-align: center;
  }
  
  .template-preview {
    align-self: center;
  }
}
</style>