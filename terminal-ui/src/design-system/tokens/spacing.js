/**
 * 间距系统 - 8px 网格
 * 提供一致的间距规范
 */

export const spacing = {
  // 基础间距值
  base: 8,
  
  // 间距尺寸
  sizes: {
    none: '0',
    xxs: '4px',   // 0.5x
    xs: '8px',    // 1x
    sm: '12px',   // 1.5x
    md: '16px',   // 2x
    lg: '24px',   // 3x
    xl: '32px',   // 4x
    xxl: '48px',  // 6x
    xxxl: '64px', // 8x
    huge: '96px'  // 12x
  },
  
  // 内边距预设
  padding: {
    button: {
      sm: '4px 8px',
      md: '6px 12px',
      lg: '8px 16px'
    },
    card: {
      sm: '12px',
      md: '16px',
      lg: '24px'
    },
    section: {
      sm: '16px',
      md: '24px',
      lg: '32px'
    }
  },
  
  // 外边距预设
  margin: {
    element: {
      sm: '4px',
      md: '8px',
      lg: '16px'
    },
    section: {
      sm: '16px',
      md: '24px',
      lg: '32px'
    },
    page: {
      sm: '24px',
      md: '32px',
      lg: '48px'
    }
  },
  
  // 间隙预设（用于 flex/grid gap）
  gap: {
    xxs: '2px',
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    xxl: '32px'
  },
  
  // 布局间距
  layout: {
    sidebarWidth: '260px',
    sidebarCollapsed: '60px',
    panelHeight: '300px',
    panelMinHeight: '100px',
    headerHeight: '48px',
    footerHeight: '24px',
    tabHeight: '35px'
  }
}

// 工具函数：获取间距值
export function getSpacing(size) {
  if (typeof size === 'number') {
    return `${size * spacing.base}px`
  }
  return spacing.sizes[size] || size
}

// 工具函数：创建间距样式
export function createSpacing(top, right, bottom, left) {
  const values = [top, right, bottom, left]
    .filter(v => v !== undefined)
    .map(v => getSpacing(v))
  
  return values.join(' ')
}

// CSS 变量生成
export function generateSpacingVariables(prefix = '--spacing') {
  const cssVars = {}
  
  // 基础间距
  Object.entries(spacing.sizes).forEach(([key, value]) => {
    cssVars[`${prefix}-${key}`] = value
  })
  
  // 布局间距
  Object.entries(spacing.layout).forEach(([key, value]) => {
    cssVars[`${prefix}-layout-${key}`.replace(/([A-Z])/g, '-$1').toLowerCase()] = value
  })
  
  return cssVars
}

// 响应式间距
export const responsiveSpacing = {
  mobile: {
    padding: '12px',
    margin: '8px',
    gap: '8px'
  },
  tablet: {
    padding: '16px',
    margin: '12px',
    gap: '12px'
  },
  desktop: {
    padding: '24px',
    margin: '16px',
    gap: '16px'
  },
  wide: {
    padding: '32px',
    margin: '24px',
    gap: '24px'
  }
}

export default spacing