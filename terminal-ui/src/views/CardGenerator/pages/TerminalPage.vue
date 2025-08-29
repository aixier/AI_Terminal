<template>
  <div class="terminal-page">
    <!-- PC端布局 -->
    <div v-if="!isMobile" class="desktop-terminal-layout">
      <div class="terminal-info">
        <h3>终端功能</h3>
        <p>Terminal功能已独立为单独页面，提供更好的使用体验。</p>
        <div class="terminal-actions">
          <button @click="$emit('open-terminal-page')" class="terminal-btn primary">
            🚀 在新页面打开终端
          </button>
          <button @click="$emit('refresh-terminal')" class="terminal-btn">
            🔄 刷新终端连接
          </button>
        </div>
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
  align-items: center;
  justify-content: center;
  background: #f8f9fa;
}

.terminal-info {
  text-align: center;
  padding: 40px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  max-width: 500px;
}

.terminal-info h3 {
  margin: 0 0 16px 0;
  font-size: 24px;
  color: #333;
}

.terminal-info p {
  margin: 0 0 24px 0;
  color: #666;
  line-height: 1.6;
}

.terminal-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.terminal-btn {
  padding: 12px 24px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  background: #fff;
  color: #333;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
}

.terminal-btn:hover {
  border-color: #667eea;
  background: #f8f9ff;
  transform: translateY(-1px);
}

.terminal-btn.primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-color: #667eea;
  color: white;
}

.terminal-btn.primary:hover {
  background: linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%);
  border-color: #5a67d8;
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