/**
 * 阴影系统
 * 提供不同层级的阴影效果
 */

export const shadows = {
  // 基础阴影
  none: 'none',
  
  // 层级阴影 (Material Design inspired)
  elevation: {
    0: 'none',
    1: '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)',
    2: '0 3px 6px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.12)',
    3: '0 10px 20px rgba(0, 0, 0, 0.15), 0 3px 6px rgba(0, 0, 0, 0.10)',
    4: '0 14px 28px rgba(0, 0, 0, 0.25), 0 10px 10px rgba(0, 0, 0, 0.22)',
    5: '0 19px 38px rgba(0, 0, 0, 0.30), 0 15px 12px rgba(0, 0, 0, 0.22)'
  },
  
  // GitHub 风格阴影
  github: {
    sm: '0 1px 0 rgba(27, 31, 35, 0.04)',
    md: '0 3px 6px rgba(140, 149, 159, 0.15)',
    lg: '0 8px 24px rgba(140, 149, 159, 0.2)',
    xl: '0 12px 48px rgba(140, 149, 159, 0.3)'
  },
  
  // 内阴影
  inset: {
    sm: 'inset 0 1px 0 rgba(0, 0, 0, 0.1)',
    md: 'inset 0 2px 4px rgba(0, 0, 0, 0.1)',
    lg: 'inset 0 4px 8px rgba(0, 0, 0, 0.15)'
  },
  
  // 彩色阴影
  colored: {
    blue: '0 4px 14px 0 rgba(9, 105, 218, 0.25)',
    green: '0 4px 14px 0 rgba(63, 185, 80, 0.25)',
    red: '0 4px 14px 0 rgba(248, 81, 73, 0.25)',
    yellow: '0 4px 14px 0 rgba(210, 153, 34, 0.25)',
    purple: '0 4px 14px 0 rgba(210, 168, 255, 0.25)'
  },
  
  // 发光效果
  glow: {
    sm: '0 0 4px rgba(88, 166, 255, 0.4)',
    md: '0 0 8px rgba(88, 166, 255, 0.5)',
    lg: '0 0 16px rgba(88, 166, 255, 0.6)',
    
    // 状态发光
    success: '0 0 8px rgba(63, 185, 80, 0.5)',
    warning: '0 0 8px rgba(210, 153, 34, 0.5)',
    error: '0 0 8px rgba(248, 81, 73, 0.5)',
    info: '0 0 8px rgba(88, 166, 255, 0.5)'
  },
  
  // 文字阴影
  text: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.25)',
    md: '0 2px 4px rgba(0, 0, 0, 0.3)',
    lg: '0 3px 6px rgba(0, 0, 0, 0.35)',
    
    // 发光文字
    glow: '0 0 8px rgba(88, 166, 255, 0.8)',
    neon: '0 0 10px #58a6ff, 0 0 20px #58a6ff, 0 0 30px #58a6ff'
  },
  
  // 特殊效果
  special: {
    // 浮动效果
    float: '0 10px 40px rgba(0, 0, 0, 0.15), 0 2px 10px rgba(0, 0, 0, 0.1)',
    
    // 按下效果
    pressed: 'inset 0 2px 4px rgba(0, 0, 0, 0.2)',
    
    // 边框阴影
    border: '0 0 0 1px rgba(27, 31, 35, 0.15)',
    
    // 焦点环
    focus: '0 0 0 3px rgba(9, 105, 218, 0.3)',
    
    // 模态背景
    modal: '0 16px 64px rgba(0, 0, 0, 0.4)',
    
    // 弹出层
    popover: '0 6px 30px rgba(0, 0, 0, 0.15)',
    
    // 工具提示
    tooltip: '0 2px 8px rgba(0, 0, 0, 0.2)'
  }
}

// 工具函数：组合多个阴影
export function combineShadows(...shadowList) {
  return shadowList
    .filter(Boolean)
    .join(', ')
}

// 工具函数：创建自定义阴影
export function createShadow({
  x = 0,
  y = 4,
  blur = 8,
  spread = 0,
  color = 'rgba(0, 0, 0, 0.1)',
  inset = false
} = {}) {
  const insetStr = inset ? 'inset ' : ''
  return `${insetStr}${x}px ${y}px ${blur}px ${spread}px ${color}`
}

// 工具函数：调整阴影透明度
export function adjustShadowOpacity(shadow, opacity) {
  return shadow.replace(/rgba?\([^)]+\)/g, (match) => {
    const values = match.match(/\d+/g)
    if (values && values.length >= 3) {
      return `rgba(${values[0]}, ${values[1]}, ${values[2]}, ${opacity})`
    }
    return match
  })
}

// CSS 变量生成
export function generateShadowVariables(prefix = '--shadow') {
  const cssVars = {}
  
  // 扁平化阴影对象
  function flatten(obj, parentKey = '') {
    Object.entries(obj).forEach(([key, value]) => {
      const currentKey = parentKey ? `${parentKey}-${key}` : key
      
      if (typeof value === 'object' && !Array.isArray(value)) {
        flatten(value, currentKey)
      } else {
        cssVars[`${prefix}-${currentKey}`] = value
      }
    })
  }
  
  flatten(shadows)
  return cssVars
}

// 响应式阴影
export const responsiveShadows = {
  mobile: {
    card: shadows.elevation[1],
    button: shadows.elevation[1],
    modal: shadows.elevation[3]
  },
  tablet: {
    card: shadows.elevation[2],
    button: shadows.elevation[1],
    modal: shadows.elevation[4]
  },
  desktop: {
    card: shadows.elevation[2],
    button: shadows.elevation[2],
    modal: shadows.elevation[4]
  }
}

// 交互状态阴影
export const interactiveShadows = {
  idle: shadows.elevation[1],
  hover: shadows.elevation[3],
  active: shadows.special.pressed,
  focus: combineShadows(shadows.elevation[2], shadows.special.focus),
  disabled: shadows.none
}

export default shadows