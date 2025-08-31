<template>
  <el-dialog
    v-model="visible"
    :title="title"
    width="400px"
    :modal="true"
    :close-on-click-modal="false"
    :append-to-body="true"
    class="social-share-dialog"
    :class="{ mobile: isMobile }"
    @close="handleClose"
  >
    <!-- 社交平台列表 -->
    <div class="social-platforms">
      <div
        v-for="platform in platforms"
        :key="platform.id"
        class="platform-item"
        :class="{ disabled: !platform.enabled, active: platform.enabled }"
        @click="handlePlatformClick(platform)"
      >
        <div class="platform-icon" :style="{ background: platform.color }">
          {{ platform.icon }}
        </div>
        <div class="platform-name">{{ platform.name }}</div>
        <div v-if="!platform.enabled" class="platform-status">即将开放</div>
      </div>
    </div>
    
    <!-- 底部说明 -->
    <div class="share-tips">
      <p>🔥 小红书分享已开放</p>
      <p class="sub-tips">更多平台即将支持</p>
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
const platforms = computed(() => [
  {
    id: 'xiaohongshu',
    name: '小红书',
    icon: '📕',
    color: '#ff2442',
    enabled: true
  },
  {
    id: 'wechat',
    name: '朋友圈',
    icon: '💬',
    color: '#07c160',
    enabled: false
  },
  {
    id: 'douyin',
    name: '抖音',
    icon: '🎵',
    color: '#000000',
    enabled: false
  },
  {
    id: 'channels',
    name: '视频号',
    icon: '📹',
    color: '#fa5151',
    enabled: false
  },
  {
    id: 'weibo',
    name: '微博',
    icon: '🔥',
    color: '#ff8200',
    enabled: false
  }
])

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
.social-share-dialog {
  --dialog-padding: 20px;
  --platform-size: 80px;
  --platform-gap: 15px;
}

.social-share-dialog.mobile {
  --dialog-padding: 16px;
  --platform-size: 70px;
  --platform-gap: 12px;
}

/* 平台列表 */
.social-platforms {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--platform-size), 1fr));
  gap: var(--platform-gap);
  padding: var(--dialog-padding) 0;
}

/* 平台项 */
.platform-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 12px 8px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
}

.platform-item:hover:not(.disabled) {
  background: #f5f5f5;
  transform: translateY(-2px);
}

.platform-item.active {
  cursor: pointer;
}

.platform-item.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 平台图标 */
.platform-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  margin-bottom: 8px;
  color: white;
  transition: transform 0.3s ease;
}

.platform-item:hover:not(.disabled) .platform-icon {
  transform: scale(1.1);
}

/* 平台名称 */
.platform-name {
  font-size: 14px;
  font-weight: 500;
  color: #333;
  text-align: center;
}

/* 平台状态 */
.platform-status {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 10px;
  white-space: nowrap;
}

/* 底部提示 */
.share-tips {
  text-align: center;
  padding: 16px 0 8px;
  border-top: 1px solid #f0f0f0;
  color: #666;
  font-size: 14px;
}

.share-tips p {
  margin: 4px 0;
}

.share-tips .sub-tips {
  font-size: 12px;
  color: #999;
}

/* 移动端适配 */
.social-share-dialog.mobile :deep(.el-dialog) {
  width: 90% !important;
  max-width: 400px;
}

.social-share-dialog.mobile .platform-icon {
  width: 40px;
  height: 40px;
  font-size: 20px;
}

.social-share-dialog.mobile .platform-name {
  font-size: 12px;
}

.social-share-dialog.mobile .platform-status {
  font-size: 9px;
  padding: 1px 4px;
}
</style>