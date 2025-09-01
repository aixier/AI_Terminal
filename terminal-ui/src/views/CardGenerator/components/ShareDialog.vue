<template>
  <el-dialog
    :model-value="visible"
    title="分享到小红书"
    width="600px"
    :fullscreen="isMobile"
    :append-to-body="true"
    :lock-scroll="true"
    :modal="true"
    :close-on-click-modal="false"
    class="xhs-share-dialog"
    @update:model-value="$emit('close')"
    @close="$emit('close')"
  >
    <div v-if="shareResult" class="share-content">
      <!-- Success Banner -->
      <div class="success-banner">
        <el-icon class="success-icon"><CircleCheckFilled /></el-icon>
        <div class="success-text">
          <h3>内容已成功生成！</h3>
          <p>已生成 {{ shareResult.data?.cardCount || 0 }} 张精美卡片，可直接分享到小红书</p>
        </div>
      </div>
      
      <!-- Main Content -->
      <div class="share-main-content">
        <!-- Edit Section -->
        <div class="edit-section">
          <h4>编辑发布内容</h4>
          
          <div class="form-item">
            <label>标题</label>
            <el-input 
              v-model="postTitle" 
              placeholder="输入小红书标题..."
              maxlength="20"
              show-word-limit
            />
          </div>
          
          <div class="form-item">
            <label>内容</label>
            <el-input 
              v-model="postContent" 
              type="textarea"
              :rows="4"
              placeholder="分享你的精彩内容..."
              maxlength="1000"
              show-word-limit
            />
          </div>
          
          <div class="form-item">
            <label>话题标签</label>
            <div class="tags-area">
              <el-tag 
                v-for="(tag, index) in postHashtags" 
                :key="index"
                closable
                @close="removeHashtag(index)"
                class="tag-item"
              >
                #{{ tag }}
              </el-tag>
              <el-input
                v-if="showTagInput"
                v-model="newTag"
                size="small"
                style="width: 100px"
                @keyup.enter="addTag"
                @blur="addTag"
                placeholder="新标签"
              />
              <el-button 
                v-else
                size="small" 
                @click="showTagInput = true"
                :icon="Plus"
              >
                添加标签
              </el-button>
            </div>
            
            <div class="suggested-tags">
              <span class="suggest-label">推荐:</span>
              <span 
                v-for="tag in suggestedTags" 
                :key="tag"
                @click="addSuggestedTag(tag)"
                class="tag-suggestion"
              >
                #{{ tag }}
              </span>
            </div>
          </div>
        </div>
        
        <!-- Actions -->
        <div class="actions-section">
          <el-button type="primary" @click="copyShareContent" :icon="CopyDocument">
            复制发布内容
          </el-button>
          <el-button @click="openShareLink" :icon="Position">
            查看分享页面
          </el-button>
        </div>
        
        <!-- Share Links -->
        <div class="links-section">
          <div class="link-item">
            <label>分享链接</label>
            <div class="link-display">
              <span class="link-text">{{ shareResult.data?.shareLink || '链接生成中...' }}</span>
              <el-button 
                size="small" 
                @click="copyLink"
                :icon="CopyDocument"
              >
                复制链接
              </el-button>
            </div>
          </div>
          
          <div class="link-item">
            <label>短链接</label>
            <div class="link-display">
              <span class="link-text">{{ shareResult.data?.shortLink || '链接生成中...' }}</span>
              <el-button 
                size="small" 
                @click="copyShortLink"
                :icon="CopyDocument"
              >
                复制短链
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div v-else class="loading-content">
      <div class="loading-spinner">
        <el-icon class="is-loading"><Loading /></el-icon>
        <div class="loading-text">
          <p class="loading-title">{{ loadingProgress || '正在生成分享内容...' }}</p>
          <p class="loading-hint">AI正在处理您的内容，请稍候片刻</p>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { CircleCheckFilled, Plus, CopyDocument, Position, Loading } from '@element-plus/icons-vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  shareResult: {
    type: Object,
    default: null
  },
  isMobile: {
    type: Boolean,
    default: false
  },
  loadingProgress: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['close', 'copy-content', 'copy-link', 'copy-short-link', 'open-link'])

// Form data
const postTitle = ref('')
const postContent = ref('')
const postHashtags = ref([])
const newTag = ref('')
const showTagInput = ref(false)

// Suggested tags
const suggestedTags = ref(['创作分享', '学习笔记', '知识分享', '个人成长', '工作技巧', '生活记录'])

// Watch for share result changes to populate form
watch(() => props.shareResult, (newResult, oldResult) => {
  if (newResult?.data) {
    postTitle.value = newResult.data.title || ''
    postContent.value = newResult.data.content || ''
    postHashtags.value = newResult.data.hashtags || []
    
    // 当新的分享结果生成时（且有分享链接），自动打开分享页面
    if (!oldResult && newResult.data.shareLink) {
      setTimeout(() => {
        window.open(newResult.data.shareLink, '_blank')
        ElMessage.success('分享页面已在新窗口打开')
      }, 500) // 稍微延迟，让用户看到成功提示
    }
  }
}, { immediate: true })

// Methods
const removeHashtag = (index) => {
  postHashtags.value.splice(index, 1)
}

const addTag = () => {
  if (newTag.value.trim() && !postHashtags.value.includes(newTag.value.trim())) {
    postHashtags.value.push(newTag.value.trim())
    newTag.value = ''
  }
  showTagInput.value = false
}

const addSuggestedTag = (tag) => {
  if (!postHashtags.value.includes(tag)) {
    postHashtags.value.push(tag)
  }
}

const copyShareContent = () => {
  const content = `${postTitle.value}\n\n${postContent.value}\n\n${postHashtags.value.map(tag => '#' + tag).join(' ')}`
  emit('copy-content', content)
}

const copyLink = () => {
  const link = props.shareResult?.data?.shareLink
  if (link) {
    emit('copy-link', link)
  }
}

const copyShortLink = () => {
  const shortLink = props.shareResult?.data?.shortLink
  if (shortLink) {
    emit('copy-short-link', shortLink)
  }
}

// 打开分享链接
const openShareLink = () => {
  const link = props.shareResult?.data?.shareLink
  if (link) {
    // 直接在新窗口打开分享页面
    window.open(link, '_blank')
  } else {
    ElMessage.warning('分享链接尚未生成')
  }
}
</script>

<style scoped>
/* 确保对话框在移动端正确显示在最顶层 */
.xhs-share-dialog {
  z-index: 9999 !important;
}

.xhs-share-dialog :deep(.el-dialog) {
  z-index: 9999 !important;
}

.xhs-share-dialog :deep(.el-overlay) {
  z-index: 9998 !important;
}

.xhs-share-dialog :deep(.el-dialog__body) {
  padding: 0;
}

.share-content {
  background: #f8f9fa;
}

.success-banner {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.success-icon {
  font-size: 40px;
  color: #4ade80;
}

.success-text h3 {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
}

.success-text p {
  margin: 0;
  opacity: 0.9;
  font-size: 14px;
}

.share-main-content {
  padding: 24px;
}

.edit-section {
  margin-bottom: 24px;
}

.edit-section h4 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.form-item {
  margin-bottom: 20px;
}

.form-item label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.tags-area {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.tag-item {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
}

.suggested-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.suggest-label {
  font-size: 12px;
  color: #999;
  margin-right: 4px;
}

.tag-suggestion {
  font-size: 12px;
  color: #667eea;
  cursor: pointer;
  padding: 2px 8px;
  border-radius: 12px;
  background: rgba(102, 126, 234, 0.1);
  transition: all 0.2s;
}

.tag-suggestion:hover {
  background: rgba(102, 126, 234, 0.2);
  color: #5a67d8;
}

.actions-section {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e0e0e0;
}

.links-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.link-item label {
  font-size: 14px;
  font-weight: 500;
  color: #333;
  margin-bottom: 8px;
}

.link-display {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: #f5f5f5;
  border-radius: 6px;
}

.link-text {
  flex: 1;
  font-size: 13px;
  color: #666;
  word-break: break-all;
}

.loading-content {
  padding: 80px 40px;
  text-align: center;
  background: linear-gradient(135deg, #f5f7ff 0%, #e8f2ff 100%);
}

.loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.loading-spinner .el-icon {
  font-size: 48px;
  color: #667eea;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.05); }
}

.loading-text {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.loading-title {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin: 0;
}

.loading-hint {
  font-size: 14px;
  color: #666;
  margin: 0;
  opacity: 0.8;
}
</style>