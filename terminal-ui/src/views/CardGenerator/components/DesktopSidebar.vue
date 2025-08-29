<template>
  <div class="desktop-sidebar">
    <!-- User Header -->
    <UserHeader
      :username="username"
      :is-mobile="false"
      @logout="$emit('logout')"
    />
    
    <!-- Navigation -->
    <div class="desktop-nav">
      <button 
        v-for="tab in tabs" 
        :key="tab.key"
        :class="['nav-btn', { active: activeTab === tab.key }]"
        @click="$emit('update:activeTab', tab.key)"
      >
        <span class="nav-icon">{{ tab.icon }}</span>
        <span class="nav-label">{{ tab.label }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue'
import UserHeader from './UserHeader.vue'

const props = defineProps({
  username: {
    type: String,
    required: true
  },
  tabs: {
    type: Array,
    required: true
  },
  activeTab: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['logout', 'update:activeTab'])
</script>

<style scoped>
.desktop-sidebar {
  width: 280px;
  background: #fff;
  border-right: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.05);
}

.desktop-nav {
  flex: 1;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nav-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border: none;
  background: transparent;
  border-radius: 12px;
  color: #666;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
  width: 100%;
}

.nav-btn:hover {
  background: #f8f9ff;
  color: #667eea;
  transform: translateX(4px);
}

.nav-btn.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  box-shadow: 0 4px 20px rgba(102, 126, 234, 0.3);
}

.nav-icon {
  font-size: 20px;
  min-width: 20px;
  display: flex;
  justify-content: center;
}

.nav-label {
  font-weight: 500;
}
</style>