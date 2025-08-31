<template>
  <el-dialog
    :model-value="visible"
    title=""
    width="420px"
    :modal="true"
    :close-on-click-modal="false"
    :append-to-body="true"
    :show-close="false"
    class="social-share-dialog"
    :class="{ mobile: isMobile }"
    @update:model-value="handleClose"
    @close="handleClose"
  >
    <!-- 自定义头部 -->
    <template #header>
      <div class="dialog-header">
        <h3 class="dialog-title">
          <span class="title-icon">📤</span>
          分享到社交平台
        </h3>
        <button class="dialog-close" @click="handleClose">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M13 1L1 13M1 1L13 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </template>
    
    <!-- 社交平台网格 -->
    <div class="platforms-container">
      <!-- 可用平台区域 -->
      <div class="platforms-section">
        <div class="section-label">可用平台</div>
        <div class="platforms-grid">
          <div
            v-for="platform in availablePlatforms"
            :key="platform.id"
            class="platform-card available"
            @click="handlePlatformClick(platform)"
          >
            <div class="platform-icon-wrapper" :style="{ background: platform.gradient }">
              <span class="platform-emoji">{{ platform.icon }}</span>
            </div>
            <span class="platform-name">{{ platform.name }}</span>
            <div class="platform-badge hot" v-if="platform.hot">HOT</div>
          </div>
        </div>
      </div>
      
      <!-- 即将开放区域 -->
      <div class="platforms-section coming-soon">
        <div class="section-label">即将开放</div>
        <div class="platforms-grid">
          <div
            v-for="platform in comingSoonPlatforms"
            :key="platform.id"
            class="platform-card disabled"
          >
            <div class="platform-icon-wrapper">
              <span class="platform-emoji">{{ platform.icon }}</span>
              <div class="lock-overlay">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M3 5V3.5C3 1.5 4.5 0 6 0S9 1.5 9 3.5V5M2 5H10V12H2V5Z" fill="currentColor" opacity="0.5"/>
                </svg>
              </div>
            </div>
            <span class="platform-name">{{ platform.name }}</span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 底部提示 -->
    <div class="dialog-footer">
      <div class="footer-tips">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="6.5" stroke="currentColor"/>
          <path d="M7 4V8M7 10V10.5" stroke="currentColor" stroke-linecap="round"/>
        </svg>
        <span>点击平台图标即可分享，更多平台持续开放中</span>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { defineProps, defineEmits, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useXiaohongshuShare } from '../../../composables/useXiaohongshuShare'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: '分享到社交平台'
  },
  isMobile: {
    type: Boolean,
    default: false
  },
  // 分享的数据
  shareData: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['close', 'share-success'])

// 使用小红书分享功能
const {
  shareToXiaohongshu,
  shareDialogVisible,
  shareResult,
  loadingProgress,
  closeShareDialog,
  copyShareContent,
  copyLink,
  copyShortLink,
  openShareLink
} = useXiaohongshuShare()

// 社交平台配置
const allPlatforms = [
  {
    id: 'xiaohongshu',
    name: '小红书',
    icon: '📕',
    gradient: 'linear-gradient(135deg, #ff2442 0%, #ff6b6b 100%)',
    enabled: true,
    hot: true
  },
  {
    id: 'wechat',
    name: '朋友圈',
    icon: '💬',
    gradient: 'linear-gradient(135deg, #07c160 0%, #5fd88a 100%)',
    enabled: false
  },
  {
    id: 'douyin',
    name: '抖音',
    icon: '🎵',
    gradient: 'linear-gradient(135deg, #000000 0%, #434343 100%)',
    enabled: false
  },
  {
    id: 'channels',
    name: '视频号',
    icon: '📹',
    gradient: 'linear-gradient(135deg, #fa5151 0%, #ff7a7a 100%)',
    enabled: false
  },
  {
    id: 'weibo',
    name: '微博',
    icon: '🔥',
    gradient: 'linear-gradient(135deg, #ff8200 0%, #ffab4a 100%)',
    enabled: false
  }
]

// 可用平台
const availablePlatforms = computed(() => 
  allPlatforms.filter(p => p.enabled)
)

// 即将开放平台
const comingSoonPlatforms = computed(() => 
  allPlatforms.filter(p => !p.enabled)
)

// 处理平台点击
const handlePlatformClick = async (platform) => {
  if (!platform.enabled) {
    ElMessage.info(`${platform.name}分享功能即将开放`)
    return
  }
  
  // 目前只处理小红书
  if (platform.id === 'xiaohongshu') {
    await handleXiaohongshuShare()
  }
}

// 处理小红书分享
const handleXiaohongshuShare = async () => {
  if (!props.shareData) {
    ElMessage.warning('缺少分享数据')
    return
  }
  
  // 关闭社媒选择对话框
  handleClose()
  
  // 调用小红书分享
  const success = await shareToXiaohongshu(props.shareData.file, props.shareData.folder)
  
  if (success) {
    emit('share-success', 'xiaohongshu')
  }
}

// 关闭对话框
const handleClose = () => {
  emit('close')
}
</script>

<style scoped>
/* 对话框整体样式 */
.social-share-dialog :deep(.el-dialog) {
  border-radius: 16px;
  overflow: hidden;
}

.social-share-dialog :deep(.el-dialog__header) {
  padding: 0;
  margin: 0;
}

.social-share-dialog :deep(.el-dialog__body) {
  padding: 0;
}

/* 自定义头部 */
.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #f0f2f5;
  background: linear-gradient(180deg, #ffffff 0%, #fafbfc 100%);
}

.dialog-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
  display: flex;
  align-items: center;
  gap: 8px;
}

.title-icon {
  font-size: 20px;
}

.dialog-close {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #8c8c8c;
  transition: all 0.2s;
}

.dialog-close:hover {
  background: #f5f5f5;
  color: #262626;
}

/* 平台容器 */
.platforms-container {
  padding: 24px;
  min-height: 280px;
}

.platforms-section {
  margin-bottom: 24px;
}

.platforms-section:last-child {
  margin-bottom: 0;
}

.section-label {
  font-size: 12px;
  font-weight: 500;
  color: #8c8c8c;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 12px;
}

/* 平台网格 */
.platforms-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
  gap: 16px;
}

/* 平台卡片 */
.platform-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px 8px;
  border-radius: 12px;
  position: relative;
  transition: all 0.2s ease;
  cursor: pointer;
}

.platform-card.available {
  background: #fafbfc;
  border: 1px solid transparent;
}

.platform-card.available:hover {
  background: #fff;
  border-color: #e6e8eb;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.platform-card.available:active {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
}

.platform-card.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: #f5f6f7;
}

/* 图标容器 */
.platform-icon-wrapper {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.platform-emoji {
  font-size: 24px;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
}

.lock-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #8c8c8c;
}

/* 平台名称 */
.platform-name {
  font-size: 12px;
  font-weight: 500;
  color: #262626;
  text-align: center;
  line-height: 1.2;
}

.platform-card.disabled .platform-name {
  color: #8c8c8c;
}

/* HOT标签 */
.platform-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: linear-gradient(135deg, #ff6b6b 0%, #ff2442 100%);
  color: white;
  font-size: 9px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 6px;
  letter-spacing: 0.5px;
  box-shadow: 0 2px 4px rgba(255, 36, 66, 0.3);
}

/* 底部提示 */
.dialog-footer {
  padding: 16px 24px;
  background: #fafbfc;
  border-top: 1px solid #f0f2f5;
}

.footer-tips {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #8c8c8c;
  font-size: 13px;
}

.footer-tips svg {
  flex-shrink: 0;
  color: #bfbfbf;
}

/* 即将开放区域特殊样式 */
.platforms-section.coming-soon {
  opacity: 0.8;
}

/* 移动端适配 */
.social-share-dialog.mobile :deep(.el-dialog) {
  width: 90% !important;
  max-width: 420px;
  margin: 0 !important;
  position: fixed !important;
  left: 50% !important;
  top: 50% !important;
  transform: translate(-50%, -50%) !important;
}

.social-share-dialog.mobile .dialog-header {
  padding: 16px 20px;
}

.social-share-dialog.mobile .dialog-title {
  font-size: 16px;
}

.social-share-dialog.mobile .platforms-container {
  padding: 20px;
}

.social-share-dialog.mobile .platforms-grid {
  grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
  gap: 12px;
}

.social-share-dialog.mobile .platform-icon-wrapper {
  width: 44px;
  height: 44px;
}

.social-share-dialog.mobile .platform-emoji {
  font-size: 22px;
}

.social-share-dialog.mobile .dialog-footer {
  padding: 14px 20px;
}

.social-share-dialog.mobile .footer-tips {
  font-size: 12px;
}

/* 动画效果 */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.platform-card {
  animation: fadeIn 0.3s ease-out backwards;
}

.platform-card:nth-child(1) { animation-delay: 0.05s; }
.platform-card:nth-child(2) { animation-delay: 0.1s; }
.platform-card:nth-child(3) { animation-delay: 0.15s; }
.platform-card:nth-child(4) { animation-delay: 0.2s; }
.platform-card:nth-child(5) { animation-delay: 0.25s; }
</style>