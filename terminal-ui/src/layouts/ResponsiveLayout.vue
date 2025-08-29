<template>
  <div 
    class="responsive-layout" 
    :class="layoutClasses"
    :style="deviceCSSProperties"
  >
    <!-- 桌面端布局: 保持现有四窗口结构 -->
    <template v-if="isDesktop">
      <slot name="desktop-layout">
        <div class="desktop-layout">
          <!-- 这里会被CardGenerator的现有结构填充 -->
          <slot />
        </div>
      </slot>
    </template>
    
    <!-- 移动端布局: 全屏单窗口 + 底部Tab导航 -->
    <template v-else-if="isMobile">
      <div class="mobile-layout">
        <!-- 全局任务状态栏 -->
        <slot name="global-task-status" />
        <!-- debug banner removed -->
        
        <!-- 移动端视图容器 -->
        <div class="mobile-view-container">
          <slot 
            name="mobile-layout"
            :activeTab="activeMobileTab.value" 
            :active-tab="activeMobileTab.value" 
            :tab="activeMobileTab.value"
          >
            <!-- 默认移动端内容 -->
            <div class="mobile-placeholder">
              <h3>移动端视图</h3>
              <p>当前Tab: {{ currentMobileTabInfo.label }}</p>
            </div>
          </slot>
        </div>
        
        <!-- 移动端底部导航栏 -->
        <div class="mobile-navigation-wrapper">
          <slot name="mobile-navigation">
            <div class="mobile-tab-navigation-placeholder">
              <!-- Tab导航占位符，将由TabNavigation组件替换 -->
              <div class="tab-placeholder">移动端导航栏 - TabNavigation未加载</div>
            </div>
          </slot>
        </div>
      </div>
    </template>
    
    <!-- 平板端布局: 可折叠抽屉式侧栏 -->
    <template v-else-if="isTablet">
      <div class="tablet-layout">
        <!-- 左侧抽屉遮罩 -->
        <div 
          v-show="leftDrawerOpen"
          class="drawer-overlay"
          @click="toggleDrawer('left')"
        ></div>
        
        <!-- 右侧抽屉遮罩 -->
        <div 
          v-show="rightDrawerOpen"
          class="drawer-overlay"
          @click="toggleDrawer('right')"
        ></div>
        
        <!-- 左侧抽屉 -->
        <transition name="slide-left">
          <div 
            v-show="leftDrawerOpen"
            class="left-drawer tablet-drawer"
          >
            <slot name="tablet-left-drawer">
              <div class="drawer-content">
                <div class="drawer-header">
                  <h3>📁 文件管理</h3>
                  <button class="drawer-close" @click="toggleDrawer('left')">×</button>
                </div>
                <div class="drawer-body">
                  <!-- 左抽屉内容: 文件列表 -->
                  <slot name="files-content" />
                </div>
              </div>
            </slot>
          </div>
        </transition>
        
        <!-- 主内容区域 -->
        <div class="tablet-main-content">
          <slot name="tablet-layout">
            <!-- 平板端主内容 -->
            <div class="tablet-content">
              <slot />
            </div>
          </slot>
        </div>
        
        <!-- 右侧抽屉 -->
        <transition name="slide-right">
          <div 
            v-show="rightDrawerOpen"
            class="right-drawer tablet-drawer"
          >
            <slot name="tablet-right-drawer">
              <div class="drawer-content">
                <div class="drawer-header">
                  <h3>📝 创建卡片</h3>
                  <button class="drawer-close" @click="toggleDrawer('right')">×</button>
                </div>
                <div class="drawer-body">
                  <!-- 右抽屉内容: 创建和模板 -->
                  <slot name="create-content" />
                </div>
              </div>
            </slot>
          </div>
        </transition>
        
        <!-- 平板端控制按钮 -->
        <div class="tablet-controls">
          <button 
            class="drawer-toggle left-toggle"
            @click="toggleDrawer('left')"
            :class="{ active: leftDrawerOpen }"
          >
            📁
          </button>
          <button 
            class="drawer-toggle right-toggle"
            @click="toggleDrawer('right')"
            :class="{ active: rightDrawerOpen }"
          >
            📝
          </button>
        </div>
      </div>
    </template>
    
    <!-- 全屏模式覆盖层 -->
    <transition name="fade">
      <div v-if="isFullScreen" class="fullscreen-overlay">
        <div class="fullscreen-content">
          <!-- 移动端不显示头部标题，桌面端显示 -->
          <div v-if="!isMobile" class="fullscreen-header">
            <h3>{{ fullScreenComponent || '全屏视图' }}</h3>
            <button class="fullscreen-close" @click="exitFullScreen">×</button>
          </div>
          <!-- 移动端只显示关闭按钮 -->
          <div v-else class="fullscreen-header mobile-header">
            <button class="fullscreen-close mobile-close" @click="exitFullScreen">×</button>
          </div>
          <div class="fullscreen-body">
            <slot name="fullscreen-content">
              <div class="fullscreen-placeholder">全屏内容区域</div>
            </slot>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useDevice } from '../composables/useDevice.js'
import { useLayoutStore } from '../store/layout.js'
import { responsiveMixin } from '../mixins/responsive.js'
import { storeToRefs } from 'pinia'

// 响应式功能混入
const {
  deviceType,
  isMobile,
  isTablet,
  isDesktop,
  layoutClasses,
  deviceCSSProperties,
  layout
} = responsiveMixin.setup()

// 调试日志
console.log('[ResponsiveLayout] 初始化:', {
  deviceType: deviceType.value,
  isMobile: isMobile.value,
  isTablet: isTablet.value,
  isDesktop: isDesktop.value
})

// 直接使用布局store
const layoutStore = useLayoutStore()
const {
  activeMobileTab,
  currentMobileTabInfo,
  leftDrawerOpen,
  rightDrawerOpen,
  isFullScreen,
  fullScreenComponent
} = storeToRefs(layoutStore)
const { toggleSidebar, toggleFullScreen } = layoutStore

console.log('[ResponsiveLayout] 布局store状态:', {
  activeMobileTab: activeMobileTab.value,
  currentMobileTabInfo: currentMobileTabInfo.value
})

// 抽屉控制方法
const toggleDrawer = (side) => {
  toggleSidebar(side)
}

// 退出全屏
const exitFullScreen = () => {
  toggleFullScreen()
}

// 布局动画事件处理
const onLayoutTransition = (el, done) => {
  el.addEventListener('transitionend', done, { once: true })
}
</script>

<style scoped>
/* ===========================
   响应式布局基础样式
   =========================== */

.responsive-layout {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  position: relative;
  
  /* CSS变量支持 */
  --transition-duration: 300ms;
  --transition-easing: cubic-bezier(0.4, 0, 0.2, 1);
}

/* ===========================
   桌面端布局样式
   =========================== */

.desktop-layout {
  width: 100%;
  height: 100%;
  /* 桌面端保持原有布局，不做修改 */
}

/* ===========================
   移动端布局样式
   =========================== */

.mobile-layout {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
}

.mobile-view-container {
  flex: 1;
  height: calc(100dvh - var(--spacing-mobile-tabbar, 60px));
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  padding-top: var(--global-task-status-height, 0);
  padding-bottom: calc(var(--spacing-mobile-tabbar, 60px) + var(--spacing-mobile-safe-area, env(safe-area-inset-bottom)));
  -webkit-overflow-scrolling: touch;
}

.mobile-tab-navigation-placeholder {
  height: var(--spacing-mobile-tabbar, 60px);
  background-color: var(--color-bg-default, #161b22);
  border-top: 1px solid var(--color-border-default, #30363d);
  display: flex;
  align-items: center;
  justify-content: center;
  padding-bottom: var(--spacing-mobile-safe-area, env(safe-area-inset-bottom));
}

.tab-placeholder {
  color: var(--color-text-secondary, #8b949e);
  font-size: var(--font-size-sm, 12px);
}

.debug-mobile-info { display: none; }
.mobile-navigation-wrapper { background: transparent; border: none; padding: 0; color: inherit; font-size: inherit; }
/* 固定底部导航容器，避免内容挤压 */
.mobile-navigation-wrapper {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: var(--z-fixed, 1200);
}
.mobile-navigation-wrapper :deep(.mobile-tab-navigation) { position: fixed; left:0; right:0; bottom:0; }
.mobile-tab-navigation-placeholder { display: none; }

.mobile-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  color: var(--color-text-secondary, #8b949e);
}

/* ===========================
   平板端布局样式
   =========================== */

.tablet-layout {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.tablet-main-content {
  width: 100%;
  height: 100%;
  transition: margin var(--transition-duration) var(--transition-easing);
}

.tablet-content {
  width: 100%;
  height: 100%;
}

/* 抽屉样式 */
.tablet-drawer {
  position: fixed;
  top: 0;
  height: 100vh;
  background-color: var(--color-bg-default, #161b22);
  border: 1px solid var(--color-border-default, #30363d);
  z-index: var(--z-modal, 500);
  box-shadow: var(--shadow-lg, 0 10px 20px rgba(0, 0, 0, 0.15));
}

.left-drawer {
  left: 0;
  width: var(--spacing-tablet-sidebar, 200px);
}

.right-drawer {
  right: 0;
  width: var(--spacing-tablet-drawer-width, 280px);
}

.drawer-content {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md, 16px);
  border-bottom: 1px solid var(--color-border-default, #30363d);
  background-color: var(--color-bg-subtle, #262c36);
}

.drawer-header h3 {
  margin: 0;
  font-size: var(--font-size-lg, 14px);
  color: var(--color-text-primary, #f0f6fc);
}

.drawer-close {
  background: none;
  border: none;
  color: var(--color-text-secondary, #8b949e);
  font-size: 24px;
  cursor: pointer;
  padding: 4px;
  line-height: 1;
  transition: color var(--duration-fast, 200ms);
}

.drawer-close:hover {
  color: var(--color-text-primary, #f0f6fc);
}

.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-md, 16px);
}

/* 抽屉遮罩 */
.drawer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: var(--z-modal-backdrop, 400);
  backdrop-filter: blur(2px);
}

/* 平板端控制按钮 */
.tablet-controls {
  position: fixed;
  top: 50%;
  transform: translateY(-50%);
  z-index: var(--z-fixed, 300);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm, 12px);
}

.drawer-toggle {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-lg, 8px);
  background-color: var(--color-bg-overlay, #1c2128);
  border: 1px solid var(--color-border-default, #30363d);
  color: var(--color-text-primary, #f0f6fc);
  font-size: 20px;
  cursor: pointer;
  transition: all var(--duration-fast, 200ms);
  display: flex;
  align-items: center;
  justify-content: center;
}

.drawer-toggle:hover {
  background-color: var(--color-bg-subtle, #262c36);
  transform: scale(1.05);
}

.drawer-toggle.active {
  background-color: var(--color-brand-primary, #0969da);
  border-color: var(--color-brand-primary, #0969da);
}

.left-toggle {
  left: 8px;
}

.right-toggle {
  right: 8px;
}

/* ===========================
   全屏模式样式
   =========================== */

.fullscreen-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--color-bg-canvas, #0d1117);
  z-index: 2000; /* 高于底部导航 */
  display: flex;
  flex-direction: column;
}

.fullscreen-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.fullscreen-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md, 16px);
  border-bottom: 1px solid var(--color-border-default, #30363d);
  background-color: var(--color-bg-default, #161b22);
}

.fullscreen-header.mobile-header {
  padding: 8px 16px; /* 减少移动端头部高度 */
  justify-content: flex-end; /* 关闭按钮右对齐 */
  min-height: 44px; /* 确保触摸友好 */
}

.fullscreen-header h3 {
  margin: 0;
  color: var(--color-text-primary, #f0f6fc);
}

.fullscreen-close {
  background: none;
  border: none;
  color: var(--color-text-secondary, #8b949e);
  font-size: 24px;
  cursor: pointer;
  padding: 4px;
  line-height: 1;
  transition: color var(--duration-fast, 200ms);
}

.fullscreen-close:hover {
  color: var(--color-text-primary, #f0f6fc);
}

.fullscreen-close.mobile-close {
  padding: 8px;
  min-width: 44px; /* 确保触摸友好 */
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  transition: background var(--duration-fast, 200ms);
}

.fullscreen-close.mobile-close:hover {
  background: rgba(255, 255, 255, 0.2);
}

.fullscreen-body {
  flex: 1;
  position: relative;
  overflow: hidden; /* 让子内容绝对定位填充 */
}

.fullscreen-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-secondary, #8b949e);
}

/* ===========================
   动画过渡效果
   =========================== */

/* 淡入淡出 */
.fade-enter-active, .fade-leave-active {
  transition: opacity var(--transition-duration) var(--transition-easing);
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

/* 左滑入 */
.slide-left-enter-active, .slide-left-leave-active {
  transition: transform var(--transition-duration) var(--transition-easing);
}

.slide-left-enter-from, .slide-left-leave-to {
  transform: translateX(-100%);
}

/* 右滑入 */
.slide-right-enter-active, .slide-right-leave-active {
  transition: transform var(--transition-duration) var(--transition-easing);
}

.slide-right-enter-from, .slide-right-leave-to {
  transform: translateX(100%);
}

/* ===========================
   响应式设备类样式
   =========================== */

.device-mobile {
  /* 移动端特定样式 */
}

.device-tablet {
  /* 平板端特定样式 */
}

.device-desktop {
  /* 桌面端特定样式 */
}

.layout-fullscreen {
  overflow: hidden;
}

/* ===========================
   媒体查询优化
   =========================== */

/* 移动端优化 */
@media (max-width: 767px) {
  .tablet-controls {
    display: none;
  }
  
  .tablet-drawer {
    width: 100vw !important;
  }
}

/* 平板端优化 */
@media (min-width: 768px) and (max-width: 1023px) {
  .mobile-tab-navigation-placeholder {
    display: none;
  }
}

/* 桌面端优化 */
@media (min-width: 1024px) {
  .tablet-controls,
  .mobile-tab-navigation-placeholder {
    display: none;
  }
  
  .tablet-drawer {
    display: none !important;
  }
}

/* 触摸设备优化 */
@media (hover: none) and (pointer: coarse) {
  .drawer-toggle {
    min-height: 44px;
    min-width: 44px;
  }
}
</style>