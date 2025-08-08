<template>
  <div class="export-settings">
    <div class="settings-form">
      <!-- 输出格式 -->
      <div class="setting-group">
        <div class="setting-label">默认格式</div>
        <el-select v-model="defaultFormat" size="small" style="width: 100%">
          <el-option label="PNG" value="png" />
          <el-option label="JPG" value="jpg" />
          <el-option label="PDF" value="pdf" />
          <el-option label="SVG" value="svg" />
        </el-select>
      </div>

      <!-- 图片质量 -->
      <div class="setting-group">
        <div class="setting-label">图片质量</div>
        <el-slider 
          v-model="imageQuality" 
          :min="60" 
          :max="100" 
          size="small"
          :format-tooltip="(val) => `${val}%`"
        />
      </div>

      <!-- 输出尺寸 -->
      <div class="setting-group">
        <div class="setting-label">默认尺寸</div>
        <el-select v-model="defaultSize" size="small" style="width: 100%">
          <el-option label="Instagram (1080x1080)" value="instagram" />
          <el-option label="Twitter (1200x675)" value="twitter" />
          <el-option label="微博 (900x500)" value="weibo" />
          <el-option label="自定义" value="custom" />
        </el-select>
      </div>

      <!-- 文件命名 -->
      <div class="setting-group">
        <div class="setting-label">文件命名</div>
        <el-input 
          v-model="filenameTemplate" 
          size="small" 
          placeholder="knowledge-card-{date}"
        />
        <div class="setting-help">
          可用变量: {title}, {date}, {time}
        </div>
      </div>

      <!-- 水印设置 -->
      <div class="setting-group">
        <div class="setting-label">水印</div>
        <el-switch v-model="enableWatermark" size="small" />
        <div class="watermark-options" v-if="enableWatermark">
          <el-input 
            v-model="watermarkText" 
            size="small" 
            placeholder="水印文字"
            style="margin-top: 8px;"
          />
        </div>
      </div>

      <!-- 自动保存 -->
      <div class="setting-group">
        <div class="setting-label">自动保存到本地</div>
        <el-switch v-model="autoSave" size="small" />
      </div>
    </div>

    <div class="settings-actions">
      <el-button size="small" @click="resetSettings">恢复默认</el-button>
      <el-button type="primary" size="small" @click="saveSettings">保存设置</el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'

const defaultFormat = ref('png')
const imageQuality = ref(90)
const defaultSize = ref('instagram')
const filenameTemplate = ref('knowledge-card-{title}-{date}')
const enableWatermark = ref(false)
const watermarkText = ref('Created with AI')
const autoSave = ref(true)

// 从本地存储加载设置
const loadSettings = () => {
  const saved = localStorage.getItem('exportSettings')
  if (saved) {
    const settings = JSON.parse(saved)
    defaultFormat.value = settings.defaultFormat || 'png'
    imageQuality.value = settings.imageQuality || 90
    defaultSize.value = settings.defaultSize || 'instagram'
    filenameTemplate.value = settings.filenameTemplate || 'knowledge-card-{title}-{date}'
    enableWatermark.value = settings.enableWatermark || false
    watermarkText.value = settings.watermarkText || 'Created with AI'
    autoSave.value = settings.autoSave !== undefined ? settings.autoSave : true
  }
}

// 保存设置
const saveSettings = () => {
  const settings = {
    defaultFormat: defaultFormat.value,
    imageQuality: imageQuality.value,
    defaultSize: defaultSize.value,
    filenameTemplate: filenameTemplate.value,
    enableWatermark: enableWatermark.value,
    watermarkText: watermarkText.value,
    autoSave: autoSave.value
  }
  
  localStorage.setItem('exportSettings', JSON.stringify(settings))
  ElMessage.success('设置已保存')
}

// 重置设置
const resetSettings = () => {
  defaultFormat.value = 'png'
  imageQuality.value = 90
  defaultSize.value = 'instagram'
  filenameTemplate.value = 'knowledge-card-{title}-{date}'
  enableWatermark.value = false
  watermarkText.value = 'Created with AI'
  autoSave.value = true
  
  ElMessage.info('已恢复默认设置')
}

// 自动保存设置
watch([
  defaultFormat, imageQuality, defaultSize, 
  filenameTemplate, enableWatermark, watermarkText, autoSave
], () => {
  // 延迟保存，避免频繁操作
  setTimeout(saveSettings, 500)
}, { deep: true })

// 初始化
loadSettings()
</script>

<style scoped>
.export-settings {
  display: flex;
  flex-direction: column;
  gap: var(--fluent-space-md);
}

.settings-form {
  display: flex;
  flex-direction: column;
  gap: var(--fluent-space-md);
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: var(--fluent-space-xs);
}

.setting-label {
  font-size: var(--fluent-font-size-sm);
  font-weight: 600;
  color: var(--fluent-neutral-primary);
}

.setting-help {
  font-size: 10px;
  color: var(--fluent-neutral-tertiary);
  margin-top: 2px;
}

.watermark-options {
  margin-top: var(--fluent-space-xs);
}

.settings-actions {
  display: flex;
  gap: var(--fluent-space-xs);
  justify-content: space-between;
}

/* Element Plus 组件样式覆盖 */
:deep(.el-select) {
  width: 100%;
}

:deep(.el-slider) {
  margin: var(--fluent-space-xs) 0;
}

:deep(.el-switch) {
  margin-left: auto;
}

:deep(.el-input__inner) {
  font-size: var(--fluent-font-size-sm);
}

:deep(.el-button) {
  font-size: var(--fluent-font-size-xs);
}
</style>