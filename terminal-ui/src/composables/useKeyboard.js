import { onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'

/**
 * 键盘快捷键组合工具
 * 为PC端用户提供完整的键盘操作体验
 */
export function useKeyboard() {
  const shortcuts = new Map()
  
  // 快捷键配置
  const keyConfig = {
    'ctrl+n': 'create-new-card',
    'ctrl+s': 'save-current',
    'ctrl+d': 'download-card',
    'ctrl+shift+p': 'toggle-panel',
    'escape': 'close-modal',
    'ctrl+z': 'undo',
    'ctrl+y': 'redo',
    'f11': 'fullscreen',
    'ctrl+shift+s': 'export-settings',
    'ctrl+h': 'show-history',
    'ctrl+t': 'new-template',
    'ctrl+p': 'preview-card',
    'alt+1': 'step-topic',
    'alt+2': 'step-template',
    'alt+3': 'step-generate',
    'alt+4': 'step-preview', 
    'alt+5': 'step-download',
    'ctrl+shift+h': 'show-shortcuts'
  }

  // 按键组合解析
  const parseKeyCombo = (event) => {
    const keys = []
    
    if (event.ctrlKey) keys.push('ctrl')
    if (event.shiftKey) keys.push('shift') 
    if (event.altKey) keys.push('alt')
    if (event.metaKey) keys.push('meta')
    
    // 特殊键处理
    let key = event.key.toLowerCase()
    if (key === ' ') key = 'space'
    if (key === 'arrowup') key = 'up'
    if (key === 'arrowdown') key = 'down'
    if (key === 'arrowleft') key = 'left'
    if (key === 'arrowright') key = 'right'
    
    keys.push(key)
    return keys.join('+')
  }

  // 注册快捷键
  const registerShortcut = (combo, callback, description = '') => {
    shortcuts.set(combo, { callback, description })
  }

  // 注销快捷键
  const unregisterShortcut = (combo) => {
    shortcuts.delete(combo)
  }

  // 键盘事件处理
  const handleKeydown = (event) => {
    // 忽略输入框中的按键
    const activeElement = document.activeElement
    const isInputElement = activeElement && (
      activeElement.tagName === 'INPUT' ||
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.contentEditable === 'true'
    )

    const combo = parseKeyCombo(event)
    const shortcut = shortcuts.get(combo)

    if (shortcut && (!isInputElement || combo === 'escape')) {
      event.preventDefault()
      event.stopPropagation()
      shortcut.callback(event)
    }
  }

  // 显示快捷键帮助
  const showShortcutsHelp = () => {
    const helpContent = Object.entries(keyConfig).map(([key, action]) => {
      const shortcut = shortcuts.get(key)
      return `${key.toUpperCase()}: ${shortcut?.description || action}`
    }).join('\n')
    
    ElMessage({
      type: 'info',
      duration: 0,
      showClose: true,
      message: `键盘快捷键:\n${helpContent}`,
      customClass: 'shortcuts-help-message'
    })
  }

  // 初始化默认快捷键
  const initDefaultShortcuts = () => {
    registerShortcut('ctrl+shift+h', showShortcutsHelp, '显示快捷键帮助')
    registerShortcut('escape', () => {
      // 关闭模态框或取消操作
      const modals = document.querySelectorAll('.el-dialog, .el-drawer')
      if (modals.length > 0) {
        const topModal = modals[modals.length - 1]
        const closeBtn = topModal.querySelector('.el-dialog__headerbtn, .el-drawer__close-btn')
        if (closeBtn) closeBtn.click()
      }
    }, '关闭弹窗')
    
    registerShortcut('f11', () => {
      if (document.fullscreenElement) {
        document.exitFullscreen()
      } else {
        document.documentElement.requestFullscreen()
      }
    }, '切换全屏')
  }

  // 生命周期
  onMounted(() => {
    document.addEventListener('keydown', handleKeydown, true)
    initDefaultShortcuts()
  })

  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown, true)
    shortcuts.clear()
  })

  return {
    registerShortcut,
    unregisterShortcut,
    showShortcutsHelp,
    keyConfig
  }
}

/**
 * 焦点管理工具
 * 改善PC端键盘导航体验
 */
export function useFocusManagement() {
  const focusableSelectors = [
    'button:not([disabled])',
    'input:not([disabled])',
    'textarea:not([disabled])',
    'select:not([disabled])',
    'a[href]',
    '[tabindex]:not([tabindex="-1"])',
    '.el-button:not(.is-disabled)',
    '.el-input:not(.is-disabled) input',
    '.el-select:not(.is-disabled)',
    '.fluent-button:not([disabled])'
  ].join(',')

  // 获取可聚焦元素
  const getFocusableElements = (container = document) => {
    return Array.from(container.querySelectorAll(focusableSelectors))
      .filter(el => {
        const style = window.getComputedStyle(el)
        return style.display !== 'none' && style.visibility !== 'hidden'
      })
  }

  // 循环聚焦
  const cycleFocus = (direction = 'next') => {
    const focusable = getFocusableElements()
    const current = document.activeElement
    const currentIndex = focusable.indexOf(current)
    
    let nextIndex
    if (direction === 'next') {
      nextIndex = currentIndex < focusable.length - 1 ? currentIndex + 1 : 0
    } else {
      nextIndex = currentIndex > 0 ? currentIndex - 1 : focusable.length - 1
    }
    
    if (focusable[nextIndex]) {
      focusable[nextIndex].focus()
    }
  }

  // 聚焦到特定区域的第一个元素
  const focusFirstInRegion = (regionSelector) => {
    const region = document.querySelector(regionSelector)
    if (region) {
      const focusable = getFocusableElements(region)
      if (focusable.length > 0) {
        focusable[0].focus()
        return true
      }
    }
    return false
  }

  // 添加焦点样式
  const addFocusStyles = () => {
    const style = document.createElement('style')
    style.textContent = `
      .keyboard-focus-visible {
        outline: 2px solid var(--fluent-blue) !important;
        outline-offset: 2px !important;
      }
      
      .fluent-button:focus-visible,
      .el-button:focus-visible {
        box-shadow: 0 0 0 2px var(--fluent-blue) !important;
      }
      
      .topic-input:focus,
      .el-input__inner:focus {
        box-shadow: 0 0 0 2px rgba(0, 120, 212, 0.3) !important;
      }
    `
    document.head.appendChild(style)
  }

  onMounted(() => {
    addFocusStyles()
    
    // 添加键盘导航支持
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Tab' && !e.shiftKey) {
        // Tab: 下一个元素
      } else if (e.key === 'Tab' && e.shiftKey) {
        // Shift+Tab: 上一个元素
      }
    })
  })

  return {
    getFocusableElements,
    cycleFocus,
    focusFirstInRegion
  }
}