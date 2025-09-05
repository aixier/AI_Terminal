<template>
  <div class="chat-input-panel" :class="{ mobile: isMobile }">
    <!-- 模板快选按钮和高级选项在同一行 -->
    <div v-if="showTemplates || isMobile" class="template-shortcuts">
      <!-- 高级选项按钮（移动端放在最左边） -->
      <div v-if="false && isMobile" class="advanced-toggle-container">
        <button 
          class="advanced-toggle-btn" 
          @click="showAdvancedOptions = !showAdvancedOptions"
          :title="showAdvancedOptions ? '隐藏高级选项' : '显示高级选项'"
        >
          ⚙️
        </button>
      </div>
      
      <!-- 模板加载错误提示 -->
      <div v-if="showTemplates && !isTemplateAvailable" class="template-error">
        <span class="error-icon">⚠️</span>
        <span class="error-text">{{ templateLoadError || '模板加载失败' }}</span>
        <button class="retry-btn" @click="loadTemplates" title="重试加载">
          🔄
        </button>
      </div>
      
      <!-- 模板按钮列表 -->
      <template v-else-if="showTemplates">
        <button 
          v-for="template in displayTemplates" 
          :key="template.id"
          class="template-btn"
          :class="{ active: selectedTemplate && selectedTemplate.id === template.id }"
          @click="selectTemplate(template)"
          :title="template.description || template.name"
        >
          {{ template.name }}
        </button>
        
        <!-- 自定义模式切换按钮 - 和模板按钮在一行 -->
        <CustomModeToggle 
          v-model="customModeEnabled"
          @change="handleCustomModeChange"
          class="custom-mode-in-line"
        />
      </template>
    </div>
    
    <!-- 桌面端高级选项按钮（右上角） -->
    <div v-if="!isMobile" class="advanced-toggle-container desktop">
      <button 
        class="advanced-toggle-btn" 
        @click="showAdvancedOptions = !showAdvancedOptions"
        :title="showAdvancedOptions ? '隐藏高级选项' : '显示高级选项'"
      >
        高级选项
      </button>
    </div>
    
    <!-- 输入区域 -->
    <div class="input-section">
      <div class="input-row">
        <textarea
          ref="textareaRef"
          v-model="inputText"
          class="input-textarea"
          :placeholder="dynamicPlaceholder"
          :rows="isMobile ? 2 : 3"
          @keydown.ctrl.enter="sendMessage"
          @keydown.meta.enter="sendMessage"
          @input="handleInput"
          @keydown="handleKeyDown"
        ></textarea>
        <button 
          class="send-button"
          :class="{ disabled: !canSend && !isGenerating, generating: isGenerating }"
          :disabled="!canSend && !isGenerating"
          @click="handleButtonClick"
        >
          <span class="send-text">{{ isGenerating ? '⏹ 终止' : '发送' }}</span>
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
    
    <!-- 素材引用选择器 -->
    <AssetReferencePicker
      :visible="showAssetPicker"
      :position="assetPickerPosition"
      @select="insertAssetReference"
      @close="showAssetPicker = false"
    />
  </div>
</template>

<script setup>
import { defineProps, defineEmits, ref, computed, onMounted, nextTick, watch } from 'vue'
import axios from 'axios'
import AssetReferencePicker from '../../../components/assets/AssetReferencePicker.vue'
import { ElMessage } from 'element-plus'
import CustomModeToggle from './CustomModeToggle.vue'
import { useAssetCache } from '@/composables/useAssetCache'
import { 
  parseReferences, 
  hasAtTrigger, 
  getAtSymbolPosition,
  formatReference,
  convertReferencesToParams 
} from '@/utils/referenceParser'

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
  'update:input-text',
  'stop-generation'
])

const showTemplates = ref(true)
const inputText = ref(props.inputText)

// 监听内部 inputText 变化，同步到父组件
watch(inputText, (newValue) => {
  emit('update:inputText', newValue)
})

// 模板相关状态
const templates = ref([])
const templateLoadError = ref(null)
const selectedTemplate = ref(null) // ChatInputPanel内部的模板选中状态
const isTemplateAvailable = computed(() => templates.value.length > 0 && !templateLoadError.value)
const textareaRef = ref(null)

// 自定义模式相关
const customModeEnabled = ref(false)
const assetReferences = ref([])
const assetMetadata = ref(null)
const assetIndex = ref(null)
const assetCache = useAssetCache()

// 素材引用相关
const showAssetPicker = ref(false)
const assetPickerPosition = ref({ x: 0, y: 0 })
const cursorPosition = ref(0)
const atPosition = ref(-1)

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
  return !props.isGenerating && inputText.value.trim().length > 0
})

// 动态计算占位符文字
const dynamicPlaceholder = computed(() => {
  if (customModeEnabled.value) {
    return '例如：分析 @产品规格 和 @用户反馈 文件夹的内容，生成 @模板.md 格式的报告'
  }
  return props.placeholder
})

// 显示的模板列表 - 只显示快速和精细两个模板
const displayTemplates = computed(() => {
  // 筛选出快速（daily-knowledge-card）和精细（cardplanet-Sandra-json）模板
  const quickAndDetailTemplates = templates.value.filter(t => 
    t.fileName === 'daily-knowledge-card-template.md' || 
    t.fileName === 'cardplanet-Sandra-json'
  )
  
  // 直接使用后端数据，不做任何覆盖
  // 按照特定顺序排序：快速在前，精细在后
  return quickAndDetailTemplates.sort((a, b) => {
    // daily-knowledge-card-template.md (快速) 在前
    if (a.fileName === 'daily-knowledge-card-template.md') return -1
    if (b.fileName === 'daily-knowledge-card-template.md') return 1
    return 0
  })
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
  customModeEnabled.value = false  // 选择模板时，自动关闭自定义模式
  console.log('[ChatInputPanel] Template selected:', template, 'Custom mode disabled')
  // 通知父组件模板选择变化，但现在已经不需要了，因为发送消息时会直接使用内部状态
}

// 处理按钮点击 - 发送或终止
const handleButtonClick = () => {
  if (props.isGenerating) {
    // 生成中，执行终止操作
    stopGeneration()
  } else {
    // 未生成，执行发送操作
    sendMessage()
  }
}

// 终止生成
const stopGeneration = () => {
  console.log('[ChatInputPanel] Stopping generation...')
  
  // 触发终止生成事件，让父组件处理
  emit('stop-generation')
  
  // 清空输入框（可选）
  // inputText.value = ''
}

// 发送消息
const sendMessage = () => {
  if (canSend.value) {
    const messageText = inputText.value.trim()
    
    // 构建基础消息参数对象
    const messageData = {
      message: messageText,
      // 自定义模式和模板模式互斥
      template: customModeEnabled.value ? null : selectedTemplate.value,  // 自定义模式下不发送模板
      templateName: customModeEnabled.value ? null : selectedTemplate.value?.fileName,  // 自定义模式下不发送模板文件名
      // 模式标记
      mode: customModeEnabled.value ? 'custom' : 'normal',
      // 可选参数
      style: enableStyle.value ? styleValue.value : undefined,
      language: enableLanguage.value ? languageValue.value : undefined,
      reference: enableReference.value ? referenceValue.value : undefined
    }
    
    // 自定义模式下，解析并添加引用
    if (customModeEnabled.value) {
      const references = parseReferences(messageText)
      if (references.length > 0) {
        // 转换为后端需要的格式
        messageData.references = convertReferencesToParams(references, assetMetadata.value)
        console.log('[ChatInputPanel] Parsed references:', messageData.references)
      }
    }
    
    console.log('[ChatInputPanel] Sending message with params:', messageData)
    emit('send-message', messageData)
  }
}

// 切换模板显示
const toggleTemplates = () => {
  showTemplates.value = !showTemplates.value
}

// 函数已移除，不再需要图标

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
          console.log(`[ChatInputPanel] Template mapping:`, {
            fileName: template.fileName,
            displayName: template.displayName,
            description: template.description,
            type: template.type,
            outputCount: template.outputCount
          })
          return {
            id: template.fileName,  // 使用fileName作为唯一ID
            name: template.displayName || template.fileName.replace('.md', ''),
            fileName: template.fileName,
            type: template.type,
            description: template.description || '',
            outputType: template.outputType || 'json',
            outputCount: template.outputCount || 1
            // 不再添加icon字段
          }
        })
        templateLoadError.value = null
        
        // 默认选中快速模板（daily-knowledge-card-template.md）
        if (templates.value.length > 0) {
          const quickTemplate = templates.value.find(t => t.fileName === 'daily-knowledge-card-template.md')
          selectedTemplate.value = quickTemplate || templates.value[0]
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

// 处理自定义模式切换
const handleCustomModeChange = async (enabled) => {
  console.log('[ChatInputPanel] Custom mode changed:', enabled)
  customModeEnabled.value = enabled  // 确保状态更新
  
  // 如果启用自定义模式，清除模板选择
  if (enabled) {
    selectedTemplate.value = null
    console.log('[ChatInputPanel] Template selection cleared due to custom mode')
  }
  
  // 自定义模式只影响发送参数，不需要加载元数据
  // 元数据仅在实际输入 @ 符号时才加载
}

// 加载素材元数据 - 从 localStorage 读取
const loadAssetMetadata = async () => {
  try {
    console.log('[ChatInputPanel] Loading asset metadata from localStorage')
    // 从缓存读取，不发起 API 请求
    assetMetadata.value = await assetCache.getMetadata()
    
    if (assetMetadata.value) {
      // 构建索引
      buildAssetIndex()
      console.log('[ChatInputPanel] Asset metadata loaded:', assetMetadata.value)
    } else {
      console.log('[ChatInputPanel] No asset metadata in localStorage')
    }
  } catch (error) {
    console.error('[ChatInputPanel] Failed to load asset metadata:', error)
    // 不显示错误消息，因为这是预期的（用户可能还没上传素材）
  }
}

// 构建资源索引
const buildAssetIndex = () => {
  if (!assetMetadata.value) return
  
  assetIndex.value = {
    categories: {},
    files: [],
    searchMap: {}
  }
  
  // 新格式：使用 assets 和 labels
  if (assetMetadata.value.assets) {
    // 处理所有分类和文件
    Object.entries(assetMetadata.value.assets).forEach(([categoryKey, files]) => {
      const categoryLabel = categoryKey === '' 
        ? '根目录' 
        : (assetMetadata.value.labels?.[categoryKey] || categoryKey)
      
      // 添加分类
      if (categoryKey !== '') {
        assetIndex.value.categories[categoryKey] = {
          key: categoryKey,
          label: categoryLabel,
          files: files
        }
      }
      
      // 添加文件
      if (files && files.length > 0) {
        files.forEach(file => {
          assetIndex.value.files.push({
            name: file,
            fileName: file,
            category: categoryKey,
            categoryLabel: categoryLabel
          })
        })
      }
    })
  }
  
  // 如果有树形结构，也处理它（用于分层显示）
  if (assetMetadata.value.tree) {
    assetMetadata.value.tree.forEach(cat => {
      processCategory(cat)
    })
  }
}

// 递归处理分类
const processCategory = (category, parentLabel = '') => {
  const fullLabel = parentLabel 
    ? `${parentLabel}/${category.label}` 
    : category.label
  
  assetIndex.value.categories[category.key] = {
    ...category,
    fullLabel
  }
  
  // 索引文件
  if (category.files) {
    category.files.forEach(file => {
      assetIndex.value.files.push({
        name: file,
        category: category.key,
        categoryLabel: fullLabel
      })
    })
  }
  
  // 递归处理子分类
  if (category.children) {
    category.children.forEach(child => 
      processCategory(child, fullLabel)
    )
  }
}

// 处理输入事件，检测@符号
const handleInput = (event) => {
  const value = event.target.value
  const cursorPos = event.target.selectionStart
  
  console.log('[ChatInputPanel] handleInput - value:', value, 'cursorPos:', cursorPos)
  console.log('[ChatInputPanel] customModeEnabled:', customModeEnabled.value)
  
  // 仅在自定义模式下检测@符号
  if (customModeEnabled.value && hasAtTrigger(value, cursorPos)) {
    console.log('[ChatInputPanel] @ trigger detected!')
    const atPos = getAtSymbolPosition(value, cursorPos)
    console.log('[ChatInputPanel] @ position:', atPos)
    
    if (atPos !== null) {
      // 获取输入框位置和样式
      const textarea = event.target
      const rect = textarea.getBoundingClientRect()
      const styles = window.getComputedStyle(textarea)
      const padding = parseInt(styles.paddingLeft) || 10
      const lineHeight = parseInt(styles.lineHeight) || 24
      const fontSize = parseInt(styles.fontSize) || 14
      const charWidth = fontSize * 0.6 // 更准确的字符宽度估算
      
      // 计算光标位置（@ 符号后面）
      const textBeforeCursor = value.substring(0, cursorPos)
      const lines = textBeforeCursor.split('\n')
      const currentLine = lines[lines.length - 1]
      const charsAfterAt = currentLine.length // @ 后面的字符数
      
      // 计算 picker 的位置（在光标位置显示）
      assetPickerPosition.value = {
        x: rect.left + padding + charsAfterAt * charWidth,
        y: rect.top + padding + (lines.length - 1) * lineHeight
      }
      
      console.log('[ChatInputPanel] picker position:', assetPickerPosition.value)
      
      atPosition.value = atPos
      cursorPosition.value = cursorPos
      
      // 确保元数据已加载
      console.log('[ChatInputPanel] assetMetadata loaded?', !!assetMetadata.value)
      if (assetMetadata.value) {
        console.log('[ChatInputPanel] Showing asset picker')
        showAssetPicker.value = true
        console.log('[ChatInputPanel] showAssetPicker after setting:', showAssetPicker.value)
      } else {
        console.log('[ChatInputPanel] Loading asset metadata from localStorage...')
        // 尝试加载元数据
        loadAssetMetadata().then(() => {
          console.log('[ChatInputPanel] Metadata loaded, assetMetadata:', !!assetMetadata.value)
          if (assetMetadata.value) {
            console.log('[ChatInputPanel] Showing asset picker after loading')
            showAssetPicker.value = true
          } else {
            console.log('[ChatInputPanel] No metadata available, cannot show picker')
          }
        })
      }
    }
  } else {
    console.log('[ChatInputPanel] No @ trigger detected or custom mode disabled')
  }
}

// 处理键盘事件
const handleKeyDown = (event) => {
  // 如果素材选择器打开，让它处理键盘事件
  if (showAssetPicker.value) {
    // ESC键关闭选择器
    if (event.key === 'Escape') {
      showAssetPicker.value = false
      atPosition.value = -1
    }
  }
}

// 插入素材引用
const insertAssetReference = (asset) => {
  console.log('[ChatInputPanel] Inserting asset reference:', asset)
  console.log('[ChatInputPanel] At position:', atPosition.value)
  
  if (atPosition.value < 0) return
  
  const textarea = textareaRef.value
  const value = inputText.value  // 使用本地状态而不是 props
  
  // 使用简化的引用格式：直接使用文件名或分类名
  let reference
  if (asset.type === 'category') {
    // 分类引用：直接使用分类名
    reference = asset.label || asset.key
  } else {
    // 文件引用：直接使用文件名
    reference = asset.name || asset.fileName
  }
  
  console.log('[ChatInputPanel] Reference to insert:', reference)
  
  // 检查@前是否有空格（如果@在开头则不需要）
  const needSpaceBefore = atPosition.value > 0 && value[atPosition.value - 1] !== ' '
  
  // 构建新值：替换@符号为引用，并在后面加空格避免粘连
  const before = value.substring(0, atPosition.value) + (needSpaceBefore ? ' ' : '')
  const after = value.substring(atPosition.value + 1)
  // 在引用后添加空格，避免与后续内容粘连
  const newValue = before + '@' + reference + ' ' + after
  
  console.log('[ChatInputPanel] New value:', newValue)
  
  // 更新本地状态
  inputText.value = newValue
  // 更新父组件
  emit('update:inputText', newValue)
  
  // 计算新的光标位置（在引用后的空格后）
  const newPosition = before.length + 1 + reference.length + 1
  
  // 重置状态
  showAssetPicker.value = false
  atPosition.value = -1
  
  // 聚焦输入框并设置光标位置
  nextTick(() => {
    if (textarea) {
      textarea.focus()
      textarea.setSelectionRange(newPosition, newPosition)
    }
  })
}
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
  display: inline-flex; /* 改为inline-flex，与模板按钮在同一行 */
}

/* 桌面端高级选项按钮位置 */
.advanced-toggle-container.desktop {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 10;
}

.advanced-toggle-btn {
  background: transparent;
  border: 1px solid #ddd;
  border-radius: 16px;
  padding: 5px 10px; /* 减少padding */
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

/* 移动端高级选项按钮样式 */
.chat-input-panel.mobile .advanced-toggle-btn {
  width: 32px;
  height: 32px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.chat-input-panel.mobile {
  position: fixed;
  bottom: 60px; /* 底部导航栏高度 */
  left: 0;
  right: 0;
  z-index: 1000;
  padding: 6px 10px; /* 进一步减少上下内边距 */
  background: white;
  border-top: 1px solid #e0e0e0;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
}

/* 模板快选 */
.template-shortcuts {
  display: flex;
  gap: 6px;
  margin-bottom: 6px; /* 进一步减少底部间距 */
  flex-wrap: nowrap; /* 不换行，保持在一行 */
  align-items: center;
}

.template-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px; /* 减少按钮内边距 */
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 16px;
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

/* 模板名称和徽章样式已移除 */

/* 移动端模板样式 */
.chat-input-panel.mobile .template-btn {
  padding: 5px 8px; /* 进一步减少移动端按钮padding */
  font-size: 12px;
  min-width: auto;
  justify-content: center;
  flex-direction: row; /* 改为横向排列 */
  gap: 3px;
  white-space: nowrap;
}

.chat-input-panel.mobile .template-icon {
  font-size: 14px; /* 减小图标尺寸 */
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
  gap: 8px; /* 减少间距 */
  align-items: center; /* 垂直居中对齐 */
}

.input-textarea {
  flex: 1;
  resize: none;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 8px 10px; /* 减少内边距 */
  font-size: 14px;
  line-height: 1.4; /* 减少行高 */
  outline: none;
  transition: border-color 0.2s;
  font-family: inherit;
  min-height: 36px; /* 设置最小高度 */
  max-height: 100px; /* 限制最大高度 */
}

.input-textarea:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.input-textarea::placeholder {
  color: #999;
  opacity: 0.6;
  font-size: 13px;
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
  padding: 8px 12px; /* 减少发送按钮padding */
  min-width: 60px;
  justify-content: center;
  height: 36px; /* 固定高度与输入框匹配 */
}

/* 生成中状态的按钮样式 */
.send-button.generating {
  background: #f56c6c;
  border-color: #f56c6c;
}

.send-button.generating:hover:not(:disabled) {
  background: #f78989;
  border-color: #f78989;
}

/* 操作按钮 */
.action-buttons {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.action-buttons.mobile {
  justify-content: center;
  margin-top: 4px; /* 进一步减少顶部间距 */
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