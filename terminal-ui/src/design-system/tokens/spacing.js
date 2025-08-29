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
    // 移动端紧凑间距
    tabbar: '60px',           // 底部Tab导航栏高度
    padding: '12px',          // 基础内边距
    gap: '8px',               // 元素间隙
    margin: '8px',            // 基础外边距
    sidebar: '0px',           // 移动端无侧栏
    safeArea: 'env(safe-area-inset-bottom)', // 安全区域适配
    touchTarget: '44px',      // 最小触摸目标尺寸
    // 移动端专用布局间距
    layout: {
      headerHeight: '44px',   // 移动端标题栏高度
      viewHeight: 'calc(100vh - 60px)', // 视图高度（减去Tab栏）
      fullHeight: '100vh'     // 全屏高度
    }
  },
  tablet: {
    // 平板端适中间距  
    sidebar: '200px',         // 平板端侧栏宽度
    padding: '16px',          // 适中内边距
    gap: '12px',              // 适中间隙
    margin: '12px',           // 适中外边距
    // 平板端布局间距
    layout: {
      drawerWidth: '280px',   // 抽屉宽度
      headerHeight: '48px',   // 标题栏高度
      minContentWidth: '320px' // 最小内容宽度
    }
  },
  desktop: {
    // 桌面端保持现有
    sidebar: '240px',         // 桌面端侧栏宽度（左边栏）
    rightSidebar: '320px',    // 右边栏宽度（AI创作区域）
    padding: '20px',          // 舒适内边距
    gap: '16px',              // 舒适间隙
    margin: '16px',           // 舒适外边距
    // 桌面端布局保持现有
    layout: {
      minWidth: '1024px',     // 最小桌面宽度
      maxWidth: '1920px',     // 最大内容宽度
      contentPadding: '24px'  // 内容区域内边距
    }
  },
  wide: {
    // 大屏幕优化
    sidebar: '280px',         // 更宽的侧栏
    rightSidebar: '360px',    // 更宽的右边栏
    padding: '32px',          // 更大内边距
    gap: '24px',              // 更大间隙
    margin: '24px',           // 更大外边距
    layout: {
      maxContentWidth: '1600px', // 最大内容宽度限制
      sectionSpacing: '48px'     // 大屏幕区域间距
    }
  }
}

// 响应式CSS变量生成
export function generateResponsiveSpacingVariables() {
  const cssVars = {}
  
  // 为每个设备类型生成CSS变量
  Object.entries(responsiveSpacing).forEach(([device, spacing]) => {
    Object.entries(spacing).forEach(([key, value]) => {
      if (key === 'layout' && typeof value === 'object') {
        // 处理嵌套的layout对象
        Object.entries(value).forEach(([layoutKey, layoutValue]) => {
          cssVars[`--spacing-${device}-layout-${layoutKey.replace(/([A-Z])/g, '-$1').toLowerCase()}`] = layoutValue
        })
      } else {
        cssVars[`--spacing-${device}-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`] = value
      }
    })
  })
  
  return cssVars
}

// 获取响应式间距值的工具函数
export function getResponsiveSpacing(device, key, subKey = null) {
  const deviceSpacing = responsiveSpacing[device]
  if (!deviceSpacing) return null
  
  if (subKey && deviceSpacing[key] && typeof deviceSpacing[key] === 'object') {
    return deviceSpacing[key][subKey]
  }
  
  return deviceSpacing[key]
}

// 创建设备特定的间距样式
export function createDeviceSpacing(device, type = 'padding') {
  const spacing = getResponsiveSpacing(device, type)
  return spacing || '16px' // 默认值
}

export default spacing