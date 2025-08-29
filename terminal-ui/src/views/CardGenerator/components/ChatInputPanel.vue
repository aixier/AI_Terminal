<template>
  <div class="chat-input-panel" :class="{ mobile: isMobile }">
    <!-- 高级选项按钮（右上角） -->
    <div class="advanced-toggle-container">
      <button 
        class="advanced-toggle-btn" 
        @click="showAdvancedOptions = !showAdvancedOptions"
        :title="showAdvancedOptions ? '隐藏高级选项' : '显示高级选项'"
      >
        高级选项
      </button>
    </div>
    
    <!-- 模板快选按钮 -->
    <div v-if="showTemplates" class="template-shortcuts">
      <!-- 模板加载错误提示 -->
      <div v-if="!isTemplateAvailable" class="template-error">
        <span class="error-icon">⚠️</span>
        <span class="error-text">{{ templateLoadError || '模板加载失败' }}</span>
        <button class="retry-btn" @click="loadTemplates" title="重试加载">
          🔄
        </button>
      </div>
      
      <!-- 模板按钮列表 -->
      <template v-else>
        <button 
          v-for="template in displayTemplates" 
          :key="template.id"
          class="template-btn"
          :class="{ active: selectedTemplate && selectedTemplate.id === template.id }"
          @click="selectTemplate(template)"
          :title="template.name"
        >
          <span class="template-name">{{ getTemplateDisplayName(template.name) }}</span>
        </button>
      </template>
    </div>
    
    <!-- 输入区域 -->
    <div class="input-section">
      <div class="input-row">
        <textarea
          v-model="inputText"
          class="input-textarea"
          :placeholder="placeholder"
          :rows="isMobile ? 2 : 3"
          @keydown.ctrl.enter="sendMessage"
          @keydown.meta.enter="sendMessage"
          @input="$emit('update:input-text', $event.target.value)"
        ></textarea>
        <button 
          class="send-button"
          :class="{ disabled: !canSend }"
          :disabled="!canSend"
          @click="sendMessage"
        >
          <span class="send-text">{{ isGenerating ? '生成中...' : '发送' }}</span>
        </button>
      </div>
      
      <!-- 操作按钮 -->
      <div class="action-buttons" :class="{ mobile: isMobile }">
        <button v-if="!isMobile" class="action-btn" @click="$emit('clear-history')" title="清空对话">
          🗑️ 清空
        </button>
        <button 
          v-if="!isMobile"
          class="action-btn template-toggle" 
          @click="toggleTemplates"
          :title="showTemplates ? '隐藏模板' : '显示模板'"
        >
          {{ showTemplates ? '🔼' : '🔽' }} 模板
        </button>
      </div>
    </div>
    
    <!-- 高级选项面板 -->
    <div v-if="showAdvancedOptions" class="advanced-options">
      <div class="options-header">
        <span class="options-title">高级选项</span>
      </div>
      
      <div class="option-group">
        <!-- 风格选项 -->
        <div class="option-item">
          <label class="option-checkbox">
            <input type="checkbox" v-model="enableStyle">
            <span class="checkmark"></span>
            <span class="option-label">自定义风格</span>
          </label>
          <input 
            v-if="enableStyle" 
            v-model="styleValue" 
            class="option-input" 
            placeholder="描述风格要求，如：简洁现代、专业商务..."
          />
        </div>
        
        <!-- 语言选项 -->
        <div class="option-item">
          <label class="option-checkbox">
            <input type="checkbox" v-model="enableLanguage">
            <span class="checkmark"></span>
            <span class="option-label">指定语言</span>
          </label>
          <select v-if="enableLanguage" v-model="languageValue" class="option-select">
            <option value="中文">中文</option>
            <option value="英文">英文</option>
            <option value="中英双语">中英双语</option>
          </select>
        </div>
        
        <!-- 参考内容选项 -->
        <div class="option-item">
          <label class="option-checkbox">
            <input type="checkbox" v-model="enableReference">
            <span class="checkmark"></span>
            <span class="option-label">参考内容</span>
          </label>
          <textarea 
            v-if="enableReference" 
            v-model="referenceValue" 
            class="option-textarea" 
            placeholder="提供额外的参考信息或素材..."
            rows="2"
          ></textarea>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits, ref, computed, onMounted } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'

const props = defineProps({
  inputText: {
    type: String,
    default: ''
  },
  selectedTemplate: {
    type: Object,
    default: null
  },
  isGenerating: {
    type: Boolean,
    default: false
  },
  placeholder: {
    type: String,
    default: '输入创作需求...'
  },
  isMobile: {
    type: Boolean,
    default: false
  },
  maxTemplates: {
    type: Number,
    default: 4
  }
})

const emit = defineEmits([
  'send-message',
  'select-template',
  'clear-history',
  'update:input-text'
])

const showTemplates = ref(true)
const inputText = ref(props.inputText)

// 模板相关状态
const templates = ref([])
const templateLoadError = ref(null)
const selectedTemplate = ref(null) // ChatInputPanel内部的模板选中状态
const isTemplateAvailable = computed(() => templates.value.length > 0 && !templateLoadError.value)

// 可选参数状态
const showAdvancedOptions = ref(false)
const enableStyle = ref(false)
const enableLanguage = ref(false)
const enableReference = ref(false)
const styleValue = ref('')
const languageValue = ref('中文')
const referenceValue = ref('')

// 计算是否可以发送
const canSend = computed(() => {
  return !props.isGenerating && props.inputText.trim().length > 0
})

// 显示的模板列表
const displayTemplates = computed(() => {
  return templates.value.slice(0, props.maxTemplates)
})

// 获取模板显示名称（提取第一个连续字母串）
const getTemplateDisplayName = (name) => {
  if (!name) return '模板'
  
  // 匹配第一个连续的字母串（英文字母）
  const match = name.match(/[a-zA-Z]+/)
  if (match) {
    const word = match[0]
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  }
  
  // 如果没有英文字母，返回前4个字符
  return name.slice(0, 4) + (name.length > 4 ? '...' : '')
}

// 选择模板
const selectTemplate = (template) => {
  selectedTemplate.value = template
  console.log('[ChatInputPanel] Template selected:', template)
  // 通知父组件模板选择变化，但现在已经不需要了，因为发送消息时会直接使用内部状态
}

// 发送消息
const sendMessage = () => {
  if (canSend.value) {
    // 构建完整的消息参数对象
    const messageData = {
      message: props.inputText.trim(),
      template: selectedTemplate.value,
      // 可选参数
      style: enableStyle.value ? styleValue.value : undefined,
      language: enableLanguage.value ? languageValue.value : undefined,
      reference: enableReference.value ? referenceValue.value : undefined
    }
    
    console.log('[ChatInputPanel] Sending message with params:', messageData)
    emit('send-message', messageData)
  }
}

// 切换模板显示
const toggleTemplates = () => {
  showTemplates.value = !showTemplates.value
}

// 根据模板文件名和类型获取图标
const getTemplateIcon = (fileName, type) => {
  if (type === 'folder') {
    // 文件夹类型模板图标
    if (fileName.includes('card')) return '🎴'
    if (fileName.includes('blog') || fileName.includes('article')) return '📝'
    if (fileName.includes('report')) return '📊'
    if (fileName.includes('story') || fileName.includes('novel')) return '📚'
    if (fileName.includes('email') || fileName.includes('mail')) return '📧'
    if (fileName.includes('diary') || fileName.includes('journal')) return '📔'
    return '📁'
  } else {
    // 文件类型模板图标
    const name = fileName.toLowerCase()
    if (name.includes('card')) return '🎴'
    if (name.includes('blog') || name.includes('article')) return '📝'
    if (name.includes('report')) return '📊'
    if (name.includes('story') || name.includes('novel')) return '📚'
    if (name.includes('email') || name.includes('mail')) return '📧'
    if (name.includes('diary') || name.includes('journal')) return '📔'
    if (name.includes('news')) return '📰'
    if (name.includes('letter')) return '💌'
    if (name.includes('resume') || name.includes('cv')) return '📄'
    return '📝'
  }
}

// 加载模板
const loadTemplates = async () => {
  try {
    console.log('[ChatInputPanel] Loading templates from /api/generate/templates...')
    const response = await axios.get('/api/generate/templates')
    console.log('[ChatInputPanel] Templates API response:', response)
    
    if (response.data && response.data.success && response.data.templates) {
      const templateFiles = response.data.templates || []
      if (templateFiles.length > 0) {
        templates.value = templateFiles.map((template, index) => {
          const icon = getTemplateIcon(template.fileName, template.type)
          console.log(`[ChatInputPanel] Template ${template.fileName} (${template.type}) -> icon: ${icon}`)
          return {
            id: index,
            name: template.displayName || template.fileName.replace('.md', ''),
            fileName: template.fileName,
            type: template.type,
            icon: icon
          }
        })
        templateLoadError.value = null
        
        // 默认选中第一个模板
        if (templates.value.length > 0) {
          selectedTemplate.value = templates.value[0]
          console.log('[ChatInputPanel] Default selected template:', selectedTemplate.value)
        }
        
        console.log('[ChatInputPanel] Successfully loaded templates:', templates.value)
      } else {
        console.error('[ChatInputPanel] No templates found in API response')
        templates.value = []
        templateLoadError.value = '未找到模板文件，请联系管理员配置模板'
        ElMessage.error('模板加载失败：未找到模板文件')
      }
    } else {
      console.error('[ChatInputPanel] API returned error or no success flag')
      templates.value = []
      templateLoadError.value = 'API返回错误，模板加载失败'
      ElMessage.error('模板加载失败：服务器返回错误')
    }
  } catch (error) {
    console.error('[ChatInputPanel] Failed to load templates:', error)
    templates.value = []
    templateLoadError.value = `模板加载失败：${error.message}`
    ElMessage.error(`模板加载失败：${error.message}`)
  }
}

// 组件挂载时加载模板
onMounted(() => {
  loadTemplates()
})
</script>

<style scoped>
.chat-input-panel {
  background: white;
  border-top: 1px solid #e0e0e0;
  padding: 16px;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
  position: relative;
}

/* 高级选项按钮容器（右上角） */
.advanced-toggle-container {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 10;
}

.advanced-toggle-btn {
  background: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 12px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.advanced-toggle-btn:hover {
  background: #e8e8e8;
  border-color: #bbb;
  color: #333;
}

.chat-input-panel.mobile {
  position: fixed;
  bottom: 60px; /* 底部导航栏高度 */
  left: 0;
  right: 0;
  z-index: 1000;
  padding: 12px;
  background: white;
  border-top: 1px solid #e0e0e0;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
}

/* 模板快选 */
.template-shortcuts {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
  padding-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;
}

.template-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 20px;
  color: #495057;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.template-btn:hover {
  background: #e9ecef;
  border-color: #667eea;
  color: #667eea;
}

.template-btn.active {
  background: #667eea;
  border-color: #667eea;
  color: white;
}

.template-icon {
  font-size: 14px;
}

.template-name {
  font-weight: 500;
}

/* 移动端模板样式 */
.chat-input-panel.mobile .template-btn {
  padding: 6px 10px;
  font-size: 11px;
  min-width: 60px;
  justify-content: center;
  flex-direction: column;
  gap: 2px;
}

.chat-input-panel.mobile .template-icon {
  font-size: 16px;
}

/* 模板错误提示 */
.template-error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #fff5f5;
  border: 1px solid #fed7d7;
  border-radius: 8px;
  color: #e53e3e;
  font-size: 12px;
  width: 100%;
}

.error-icon {
  font-size: 14px;
}

.error-text {
  flex: 1;
  font-weight: 500;
}

.retry-btn {
  background: #e53e3e;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.retry-btn:hover {
  background: #c53030;
  transform: scale(1.05);
}

/* 输入区域 */
.input-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-row {
  display: flex;
  gap: 12px;
  align-items: flex-end;
}

.input-textarea {
  flex: 1;
  resize: none;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  padding: 12px 16px;
  font-size: 14px;
  line-height: 1.5;
  outline: none;
  transition: border-color 0.2s;
  font-family: inherit;
}

.input-textarea:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.input-textarea::placeholder {
  color: #999;
}

.send-button {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 12px;
  color: white;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  min-width: 80px;
}

.send-button:hover:not(.disabled) {
  background: linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%);
  transform: translateY(-1px);
}

.send-button.disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}


/* 移动端发送按钮 */
.chat-input-panel.mobile .send-button {
  padding: 12px 16px;
  min-width: 70px;
  justify-content: center;
}

/* 操作按钮 */
.action-buttons {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.action-buttons.mobile {
  justify-content: center;
  margin-top: 8px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: transparent;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  color: #666;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover {
  border-color: #667eea;
  color: #667eea;
  background: #f8f9ff;
}

.template-toggle,
.advanced-toggle {
  font-weight: 500;
}

/* 高级选项面板 */
.advanced-options {
  margin-top: 12px;
  padding: 16px;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
}

.options-header {
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid #dee2e6;
}

.options-title {
  font-size: 14px;
  font-weight: 600;
  color: #495057;
}

.option-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.option-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.option-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 13px;
  color: #495057;
}

.option-checkbox input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: #667eea;
}

.option-label {
  font-weight: 500;
}

.option-input,
.option-select,
.option-textarea {
  padding: 8px 12px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 13px;
  font-family: inherit;
  transition: border-color 0.2s;
}

.option-input:focus,
.option-select:focus,
.option-textarea:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1);
}

.option-textarea {
  resize: vertical;
  min-height: 60px;
}

/* 响应式适配 */
@media (max-width: 480px) {
  .template-shortcuts {
    gap: 6px;
  }
  
  .template-btn {
    padding: 5px 8px;
    font-size: 11px;
  }
  
  .input-row {
    gap: 8px;
  }
  
  .input-textarea {
    font-size: 16px; /* 避免iOS缩放 */
  }
}
</style>