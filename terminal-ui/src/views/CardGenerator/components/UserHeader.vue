<template>
  <div class="user-header" :class="{ mobile: isMobile }">
    <div class="user-info">
      <span class="avatar-icon">👤</span>
      <span class="username">{{ username }}</span>
      <span 
        v-if="isMobile && typeof isConnected === 'boolean'" 
        :class="['connection-status', { connected: isConnected, disconnected: !isConnected }]" 
        :title="isConnected ? '已连接' : '未连接'"
      >
        {{ isConnected ? '🟢' : '🔴' }}
      </span>
    </div>
    <button class="logout-btn" @click="$emit('logout')" title="退出登录">
      <span class="logout-icon">🚪</span>
      <span class="logout-text">退出</span>
    </button>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue'

const props = defineProps({
  username: {
    type: String,
    required: true
  },
  isConnected: {
    type: Boolean,
    default: null
  },
  isMobile: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['logout'])
</script>

<style scoped>
.user-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #fff;
  border-bottom: 1px solid #e0e0e0;
}

.user-header.mobile {
  padding: 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.avatar-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: rgba(102, 126, 234, 0.1);
  border-radius: 50%;
  font-size: 16px;
}

.user-header.mobile .avatar-icon {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.username {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.user-header.mobile .username {
  color: white;
}

.connection-status {
  font-size: 12px;
  margin-left: 4px;
}

.logout-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: transparent;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  color: #666;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.logout-btn:hover {
  background: #f5f5f5;
  border-color: #ff4757;
  color: #ff4757;
}

.user-header.mobile .logout-btn {
  border-color: rgba(255, 255, 255, 0.3);
  color: white;
}

.user-header.mobile .logout-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.5);
}

.logout-icon {
  font-size: 14px;
}

.logout-text {
  font-size: 12px;
}
</style>