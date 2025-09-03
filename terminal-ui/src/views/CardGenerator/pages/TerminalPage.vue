<template>
  <div class="terminal-page">
    <!-- PC端布局 -->
    <div v-if="!isMobile" class="desktop-terminal-layout">
      <!-- PC端嵌入式终端 -->
      <div class="desktop-embedded-terminal">
        <TerminalBest v-if="shouldShowTerminal" :key="terminalKey" />
      </div>
    </div>
    
    <!-- 移动端布局 -->
    <div v-else class="mobile-terminal-layout">
      <!-- 移动端终端工具栏 -->
      <div class="mobile-terminal-toolbar">
        <button @click="$emit('open-terminal-page')" class="mobile-terminal-btn" title="在新页面打开终端">
          🚀 新页面
        </button>
        <button @click="$emit('refresh-terminal')" class="mobile-terminal-btn" title="刷新终端">
          🔄 刷新
        </button>
      </div>
      
      <!-- 移动端聊天式终端 -->
      <div class="mobile-embedded-terminal">
        <TerminalChat :key="terminalKey" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue'
import TerminalChat from '../../../components/mobile/TerminalChat.vue'
import TerminalBest from '../../../components/TerminalBest.vue'

const props = defineProps({
  isMobile: {
    type: Boolean,
    default: false
  },
  terminalKey: {
    type: Number,
    default: 0
  },
  shouldShowTerminal: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits([
  'open-terminal-page',
  'refresh-terminal'
])
</script>

<style scoped>
.terminal-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* PC端布局 */
.desktop-terminal-layout {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #1e1e1e;
}

.desktop-embedded-terminal {
  flex: 1;
  overflow: hidden;
  background: #1e1e1e;
  display: flex;
  flex-direction: column;
}

.desktop-embedded-terminal :deep(.terminal-wrapper) {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.desktop-embedded-terminal :deep(.terminal-container) {
  flex: 1;
  overflow: hidden;
}

/* 移动端布局 */
.mobile-terminal-layout {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #1e1e1e;
}

.mobile-terminal-toolbar {
  display: flex;
  gap: 8px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.mobile-terminal-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  color: #fff;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.mobile-terminal-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-1px);
}

.mobile-embedded-terminal {
  flex: 1;
  overflow: hidden;
  background: #1e1e1e;
}
</style>