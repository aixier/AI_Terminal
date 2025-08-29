<template>
  <div class="mobile-view-content">
    <!-- 移动端顶部用户信息栏 -->
    <div class="mobile-user-header">
      <div class="mobile-user-info">
        <span class="mobile-avatar-icon">👤</span>
        <span class="mobile-username">{{ username }}</span>
        <span v-if="isConnected" class="mobile-connection-status connected" title="已连接">🟢</span>
        <span v-else class="mobile-connection-status disconnected" title="未连接">🔴</span>
      </div>
      <button class="mobile-logout-btn" @click="$emit('logout')" title="退出登录">
        <span class="logout-icon">🚪</span>
        <span class="logout-text">退出</span>
      </button>
    </div>
    
    <!-- Tab内容区域 -->
    <div class="mobile-tab-area">
      <slot :activeTab="activeTab"></slot>
    </div>
    
    <!-- 底部导航 -->
    <TabNavigation 
      :customTabs="tabs"
      v-model:activeTab="activeTab"
    />
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import TabNavigation from '../../../components/mobile/TabNavigation.vue'

const props = defineProps({
  username: {
    type: String,
    default: 'Guest'
  },
  isConnected: {
    type: Boolean,
    default: false
  },
  tabs: {
    type: Array,
    required: true
  },
  initialTab: {
    type: String,
    default: 'ai-creation'
  }
})

const emit = defineEmits(['logout', 'tab-change'])

const activeTab = ref(props.initialTab)

watch(activeTab, (newTab) => {
  emit('tab-change', newTab)
})

defineExpose({
  activeTab
})
</script>

<style scoped>
.mobile-view-content {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.mobile-user-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.mobile-user-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.mobile-avatar-icon {
  font-size: 20px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 50%;
}

.mobile-username {
  font-size: 14px;
  font-weight: 500;
  color: #fff;
}

.mobile-connection-status {
  font-size: 10px;
}

.mobile-logout-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  color: #fff;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.3s;
}

.mobile-logout-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.mobile-tab-area {
  flex: 1;
  overflow: hidden;
}
</style>