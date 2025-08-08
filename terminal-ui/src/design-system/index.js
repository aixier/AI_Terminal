/**
 * 设计系统主入口
 * 导出所有设计令牌和工具函数
 */

// 导入所有设计令牌
import colors, { generateCSSVariables as generateColorVars } from './tokens/colors.js'
import spacing, { generateSpacingVariables } from './tokens/spacing.js'
import typography, { generateTypographyVariables } from './tokens/typography.js'
import animations from './tokens/animations.js'
import shadows, { generateShadowVariables } from './tokens/shadows.js'

// 设计系统对象
export const designSystem = {
  colors,
  spacing,
  typography,
  animations,
  shadows
}

// 生成所有CSS变量
export function generateAllCSSVariables() {
  return {
    ...generateColorVars(),
    ...generateSpacingVariables(),
    ...generateTypographyVariables(),
    ...generateShadowVariables()
  }
}

// 注入CSS变量到根元素
export function injectCSSVariables(variables = generateAllCSSVariables()) {
  const root = document.documentElement
  Object.entries(variables).forEach(([key, value]) => {
    root.style.setProperty(key, value)
  })
}

// 创建主题
export function createTheme(overrides = {}) {
  return {
    ...designSystem,
    ...overrides
  }
}

// Vue 插件
export const DesignSystemPlugin = {
  install(app, options = {}) {
    // 注入CSS变量
    injectCSSVariables(options.cssVariables)
    
    // 提供设计系统对象
    app.provide('designSystem', designSystem)
    
    // 全局属性
    app.config.globalProperties.$ds = designSystem
    
    // 全局组件注册（如果有）
    if (options.components) {
      Object.entries(options.components).forEach(([name, component]) => {
        app.component(name, component)
      })
    }
  }
}

// 导出所有令牌
export { colors, spacing, typography, animations, shadows }

// 导出工具函数
export * from './tokens/colors.js'
export * from './tokens/spacing.js'
export * from './tokens/typography.js'
export * from './tokens/animations.js'
export * from './tokens/shadows.js'

export default designSystem