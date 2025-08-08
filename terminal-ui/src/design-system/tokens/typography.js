/**
 * 字体系统
 * 定义字体、字号、行高等排版规范
 */

export const typography = {
  // 字体族
  fontFamily: {
    default: "'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    mono: "'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace",
    display: "'Segoe UI Display', system-ui, -apple-system, sans-serif",
    chinese: "'Microsoft YaHei', '微软雅黑', 'PingFang SC', 'Helvetica Neue', sans-serif"
  },
  
  // 字号系统
  fontSize: {
    xxs: '10px',
    xs: '11px',
    sm: '12px',
    md: '13px',
    lg: '14px',
    xl: '16px',
    xxl: '20px',
    xxxl: '24px',
    display: '32px'
  },
  
  // 行高系统
  lineHeight: {
    compact: 1.2,
    default: 1.5,
    relaxed: 1.6,
    loose: 1.8,
    body: 1.6,
    heading: 1.3
  },
  
  // 字重系统
  fontWeight: {
    thin: 200,
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    black: 800
  },
  
  // 字间距
  letterSpacing: {
    tight: '-0.02em',
    normal: '0',
    wide: '0.02em',
    wider: '0.04em',
    widest: '0.08em'
  },
  
  // 预设文本样式
  styles: {
    // 标题样式
    h1: {
      fontSize: '32px',
      fontWeight: 600,
      lineHeight: 1.3,
      letterSpacing: '-0.02em'
    },
    h2: {
      fontSize: '24px',
      fontWeight: 600,
      lineHeight: 1.3,
      letterSpacing: '-0.01em'
    },
    h3: {
      fontSize: '20px',
      fontWeight: 600,
      lineHeight: 1.4
    },
    h4: {
      fontSize: '16px',
      fontWeight: 600,
      lineHeight: 1.4
    },
    h5: {
      fontSize: '14px',
      fontWeight: 600,
      lineHeight: 1.5
    },
    h6: {
      fontSize: '13px',
      fontWeight: 600,
      lineHeight: 1.5
    },
    
    // 正文样式
    body: {
      fontSize: '13px',
      fontWeight: 400,
      lineHeight: 1.6
    },
    bodyLarge: {
      fontSize: '14px',
      fontWeight: 400,
      lineHeight: 1.6
    },
    bodySmall: {
      fontSize: '12px',
      fontWeight: 400,
      lineHeight: 1.5
    },
    
    // 特殊样式
    caption: {
      fontSize: '11px',
      fontWeight: 400,
      lineHeight: 1.4,
      letterSpacing: '0.02em'
    },
    overline: {
      fontSize: '10px',
      fontWeight: 600,
      lineHeight: 1.5,
      letterSpacing: '0.08em',
      textTransform: 'uppercase'
    },
    code: {
      fontFamily: "'SF Mono', Monaco, Consolas, monospace",
      fontSize: '12px',
      fontWeight: 400,
      lineHeight: 1.5
    },
    button: {
      fontSize: '13px',
      fontWeight: 500,
      lineHeight: 1.2,
      letterSpacing: '0.02em'
    },
    label: {
      fontSize: '12px',
      fontWeight: 500,
      lineHeight: 1.3,
      letterSpacing: '0.04em'
    }
  }
}

// 工具函数：应用文本样式
export function applyTextStyle(styleName) {
  const style = typography.styles[styleName]
  if (!style) return {}
  
  return {
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
    textTransform: style.textTransform,
    fontFamily: style.fontFamily
  }
}

// CSS 变量生成
export function generateTypographyVariables(prefix = '--font') {
  const cssVars = {}
  
  // 字体族
  Object.entries(typography.fontFamily).forEach(([key, value]) => {
    cssVars[`${prefix}-family-${key}`] = value
  })
  
  // 字号
  Object.entries(typography.fontSize).forEach(([key, value]) => {
    cssVars[`${prefix}-size-${key}`] = value
  })
  
  // 字重
  Object.entries(typography.fontWeight).forEach(([key, value]) => {
    cssVars[`${prefix}-weight-${key}`] = value
  })
  
  // 行高
  Object.entries(typography.lineHeight).forEach(([key, value]) => {
    cssVars[`${prefix}-line-height-${key}`] = value
  })
  
  // 字间距
  Object.entries(typography.letterSpacing).forEach(([key, value]) => {
    cssVars[`${prefix}-letter-spacing-${key}`] = value
  })
  
  return cssVars
}

// 响应式字体大小
export const responsiveTypography = {
  mobile: {
    base: '14px',
    scale: 1
  },
  tablet: {
    base: '15px',
    scale: 1.05
  },
  desktop: {
    base: '16px',
    scale: 1.1
  },
  wide: {
    base: '16px',
    scale: 1.15
  }
}

// 文本截断工具
export const textTruncate = {
  single: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  multi: (lines = 2) => ({
    display: '-webkit-box',
    WebkitLineClamp: lines,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  })
}

export default typography