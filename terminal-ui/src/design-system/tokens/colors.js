/**
 * 色彩系统 - GitHub Dark Theme
 * 基于 GitHub 的 Primer 设计系统
 */

export const colors = {
  // 品牌色
  brand: {
    primary: '#0969da',
    primaryHover: '#0860ca',
    primaryActive: '#0550ae',
    secondary: '#58a6ff',
    secondaryHover: '#79b8ff',
    accent: '#539bf5',
    accentHover: '#4c8eda'
  },
  
  // 语义色
  semantic: {
    success: '#3fb950',
    successBg: 'rgba(63, 185, 80, 0.1)',
    successBorder: 'rgba(63, 185, 80, 0.3)',
    
    warning: '#d29922',
    warningBg: 'rgba(210, 153, 34, 0.1)',
    warningBorder: 'rgba(210, 153, 34, 0.3)',
    
    error: '#f85149',
    errorBg: 'rgba(248, 81, 73, 0.1)',
    errorBorder: 'rgba(248, 81, 73, 0.3)',
    
    info: '#58a6ff',
    infoBg: 'rgba(88, 166, 255, 0.1)',
    infoBorder: 'rgba(88, 166, 255, 0.3)'
  },
  
  // 中性色 - 背景
  neutral: {
    bg: {
      canvas: '#0d1117',      // 主画布背景
      default: '#161b22',     // 默认背景
      overlay: '#1c2128',     // 覆盖层背景
      inset: '#010409',       // 内嵌背景
      subtle: '#262c36',      // 细微背景
      emphasis: '#6e7681'     // 强调背景
    },
    
    // 边框
    border: {
      default: '#30363d',
      muted: '#21262d',
      subtle: 'rgba(240, 246, 252, 0.1)',
      emphasis: '#6e7681'
    },
    
    // 文字
    text: {
      primary: '#f0f6fc',
      secondary: '#8b949e',
      tertiary: '#6e7681',
      placeholder: '#484f58',
      disabled: '#484f58',
      inverse: '#0d1117',
      link: '#58a6ff',
      linkHover: '#79b8ff'
    }
  },
  
  // 特殊用途色
  special: {
    // 代码高亮
    syntax: {
      comment: '#8b949e',
      keyword: '#ff7b72',
      string: '#a5d6ff',
      function: '#d2a8ff',
      variable: '#ffa657',
      constant: '#79c0ff',
      operator: '#ff7b72',
      tag: '#7ee83f'
    },
    
    // 状态指示
    status: {
      online: '#3fb950',
      offline: '#8b949e',
      busy: '#d29922',
      error: '#f85149'
    },
    
    // diff 颜色
    diff: {
      addition: 'rgba(63, 185, 80, 0.15)',
      additionText: '#3fb950',
      deletion: 'rgba(248, 81, 73, 0.15)',
      deletionText: '#f85149',
      change: 'rgba(210, 153, 34, 0.15)',
      changeText: '#d29922'
    }
  },
  
  // 透明度变体
  alpha: {
    black10: 'rgba(0, 0, 0, 0.1)',
    black20: 'rgba(0, 0, 0, 0.2)',
    black30: 'rgba(0, 0, 0, 0.3)',
    black50: 'rgba(0, 0, 0, 0.5)',
    white10: 'rgba(255, 255, 255, 0.1)',
    white20: 'rgba(255, 255, 255, 0.2)',
    white30: 'rgba(255, 255, 255, 0.3)',
    white50: 'rgba(255, 255, 255, 0.5)'
  }
}

// CSS 变量生成函数
export function generateCSSVariables(prefix = '--color') {
  const cssVars = {}
  
  function traverse(obj, path = []) {
    Object.entries(obj).forEach(([key, value]) => {
      const currentPath = [...path, key]
      if (typeof value === 'object' && !Array.isArray(value)) {
        traverse(value, currentPath)
      } else {
        const varName = `${prefix}-${currentPath.join('-')}`.toLowerCase()
        cssVars[varName] = value
      }
    })
  }
  
  traverse(colors)
  return cssVars
}

// 工具函数：获取颜色
export function getColor(path) {
  return path.split('.').reduce((obj, key) => obj?.[key], colors)
}

// 工具函数：颜色混合
export function mixColors(color1, color2, ratio = 0.5) {
  // 简单的颜色混合实现
  const hex2rgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null
  }
  
  const rgb2hex = (r, g, b) => {
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
  }
  
  const c1 = hex2rgb(color1)
  const c2 = hex2rgb(color2)
  
  if (!c1 || !c2) return color1
  
  const r = Math.round(c1.r * (1 - ratio) + c2.r * ratio)
  const g = Math.round(c1.g * (1 - ratio) + c2.g * ratio)
  const b = Math.round(c1.b * (1 - ratio) + c2.b * ratio)
  
  return rgb2hex(r, g, b)
}

export default colors