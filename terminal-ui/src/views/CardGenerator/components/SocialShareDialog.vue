<template>
  <el-dialog
    :model-value="visible"
    title=""
    width="320px"
    :modal="true"
    :close-on-click-modal="false"
    :append-to-body="true"
    :show-close="false"
    class="social-share-dialog"
    :class="{ mobile: isMobile }"
    @update:model-value="handleClose"
    @close="handleClose"
  >
    <!-- 紧凑型头部 -->
    <template #header>
      <div class="dialog-header-compact">
        <span class="title-text">分享到</span>
        <button class="close-btn-compact" @click="handleClose">
          ✕
        </button>
      </div>
    </template>
    
    <!-- 紧凑型平台网格 -->
    <div class="platforms-compact">
      <div class="platforms-grid-compact">
        <!-- 所有平台混合显示 -->
        <div
          v-for="platform in allPlatforms"
          :key="platform.id"
          class="platform-item"
          :class="{ 'enabled': platform.enabled, 'disabled': !platform.enabled }"
          @click="handlePlatformClick(platform)"
        >
          <div class="icon-wrapper" :style="platform.enabled ? { background: platform.gradient } : {}">
            <span class="icon">{{ platform.icon }}</span>
            <span v-if="platform.hot && platform.enabled" class="hot-badge">•</span>
            <span v-if="!platform.enabled" class="lock-icon">🔒</span>
          </div>
          <span class="name">{{ platform.name }}</span>
        </div>
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

// 使用小红书分享功能（简化版）
const {
  shareToXiaohongshu
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
/* 紧凑型对话框 */
.social-share-dialog :deep(.el-dialog) {
  border-radius: 12px;
  overflow: hidden;
}

.social-share-dialog :deep(.el-dialog__header) {
  padding: 0;
  margin: 0;
}

.social-share-dialog :deep(.el-dialog__body) {
  padding: 0;
}

/* 紧凑型头部 */
.dialog-header-compact {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
  background: #fff;
}

.title-text {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.close-btn-compact {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: #9ca3af;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-btn-compact:hover {
  background: #f3f4f6;
  color: #374151;
}

/* 紧凑型平台容器 */
.platforms-compact {
  padding: 16px;
}

/* 紧凑型网格布局 - 4列 */
.platforms-grid-compact {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

/* 平台项目 */
.platform-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  position: relative;
}

.platform-item.enabled {
  background: transparent;
}

.platform-item.enabled:hover {
  background: #f9fafb;
  transform: scale(1.05);
}

.platform-item.enabled:active {
  transform: scale(0.98);
}

.platform-item.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.platform-item.disabled:hover {
  background: transparent;
  transform: none;
}

/* 图标容器 */
.icon-wrapper {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  background: #f3f4f6;
}

.platform-item.enabled .icon-wrapper {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.icon {
  font-size: 20px;
  position: relative;
  z-index: 1;
}

/* HOT标记 - 小红点 */
.hot-badge {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 8px;
  height: 8px;
  background: #ef4444;
  border-radius: 50%;
  color: #ef4444;
  font-size: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 锁定图标 */
.lock-icon {
  position: absolute;
  bottom: -2px;
  right: -2px;
  font-size: 10px;
  background: white;
  border-radius: 50%;
  width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 名称 */
.name {
  font-size: 11px;
  color: #4b5563;
  text-align: center;
  line-height: 1.2;
  font-weight: 400;
}

.platform-item.disabled .name {
  color: #9ca3af;
}

/* 移动端适配 */
.social-share-dialog.mobile :deep(.el-dialog) {
  width: 90% !important;
  max-width: 320px;
  margin: 0 !important;
  position: fixed !important;
  left: 50% !important;
  top: 50% !important;
  transform: translate(-50%, -50%) !important;
}

.social-share-dialog.mobile .dialog-header-compact {
  padding: 10px 14px;
}

.social-share-dialog.mobile .title-text {
  font-size: 13px;
}

.social-share-dialog.mobile .platforms-compact {
  padding: 12px;
}

.social-share-dialog.mobile .platforms-grid-compact {
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.social-share-dialog.mobile .icon-wrapper {
  width: 36px;
  height: 36px;
}

.social-share-dialog.mobile .icon {
  font-size: 18px;
}

.social-share-dialog.mobile .name {
  font-size: 10px;
}

/* 简单进入动画 */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.platform-item {
  animation: fadeIn 0.2s ease-out backwards;
}

.platform-item:nth-child(1) { animation-delay: 0.02s; }
.platform-item:nth-child(2) { animation-delay: 0.04s; }
.platform-item:nth-child(3) { animation-delay: 0.06s; }
.platform-item:nth-child(4) { animation-delay: 0.08s; }
.platform-item:nth-child(5) { animation-delay: 0.10s; }
</style>