/**
 * 功能开关配置
 * 用于控制新旧功能的切换
 */

// 从环境变量或localStorage读取配置
const getFeatureFlag = (key, defaultValue = false) => {
  // 优先从环境变量读取
  const envValue = import.meta.env[`VITE_${key}`]
  if (envValue !== undefined) {
    return envValue === 'true'
  }
  
  // 其次从localStorage读取
  const storageValue = localStorage.getItem(`feature_${key}`)
  if (storageValue !== null) {
    return storageValue === 'true'
  }
  
  return defaultValue
}

// 设置功能开关
const setFeatureFlag = (key, value) => {
  localStorage.setItem(`feature_${key}`, value.toString())
  // 触发自定义事件通知组件更新
  window.dispatchEvent(new CustomEvent('feature-flag-changed', {
    detail: { key, value }
  }))
}

// 功能开关配置
export const features = {
  // 使用新的Chokidar文件系统（V2 API）
  USE_ASSETS_V2: getFeatureFlag('USE_ASSETS_V2', false),
  
  // 启用SSE实时更新
  ENABLE_SSE: getFeatureFlag('ENABLE_SSE', false),
  
  // 使用新的文件管理器UI
  USE_NEW_FILE_MANAGER: getFeatureFlag('USE_NEW_FILE_MANAGER', false),
  
  // 启用文件拖拽上传
  ENABLE_DRAG_DROP: getFeatureFlag('ENABLE_DRAG_DROP', true),
  
  // 启用文件预览
  ENABLE_FILE_PREVIEW: getFeatureFlag('ENABLE_FILE_PREVIEW', true)
}

// 导出设置函数
export const setFeature = setFeatureFlag

// 导出获取函数
export const getFeature = getFeatureFlag

// 在window对象上暴露，方便调试
if (typeof window !== 'undefined') {
  window.features = features
  window.setFeature = setFeatureFlag
  window.getFeature = getFeatureFlag
  
  // 同时设置全局标志（兼容旧代码）
  window.USE_ASSETS_V2 = features.USE_ASSETS_V2
  window.ENABLE_SSE = features.ENABLE_SSE
}

// 打印当前功能开关状态
console.log('🚀 Feature Flags:', features)

export default features