/**
 * 动画系统
 * 定义动画时长、缓动函数和预设动画
 */

export const animations = {
  // 动画时长
  duration: {
    instant: '100ms',
    fast: '200ms',
    normal: '300ms',
    slow: '500ms',
    slower: '700ms',
    slowest: '1000ms'
  },
  
  // 缓动函数
  easing: {
    linear: 'linear',
    ease: 'ease',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    
    // Material Design 缓动
    standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
    decelerate: 'cubic-bezier(0, 0, 0.2, 1)',
    accelerate: 'cubic-bezier(0.4, 0, 1, 1)',
    
    // 特殊效果
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    elastic: 'cubic-bezier(0.68, -0.55, 0.265, 1.25)',
    smooth: 'cubic-bezier(0.25, 0.1, 0.25, 1)'
  },
  
  // 预设动画
  presets: {
    // 淡入淡出
    fadeIn: {
      from: { opacity: 0 },
      to: { opacity: 1 }
    },
    fadeOut: {
      from: { opacity: 1 },
      to: { opacity: 0 }
    },
    
    // 滑动
    slideInLeft: {
      from: { transform: 'translateX(-100%)', opacity: 0 },
      to: { transform: 'translateX(0)', opacity: 1 }
    },
    slideInRight: {
      from: { transform: 'translateX(100%)', opacity: 0 },
      to: { transform: 'translateX(0)', opacity: 1 }
    },
    slideInUp: {
      from: { transform: 'translateY(100%)', opacity: 0 },
      to: { transform: 'translateY(0)', opacity: 1 }
    },
    slideInDown: {
      from: { transform: 'translateY(-100%)', opacity: 0 },
      to: { transform: 'translateY(0)', opacity: 1 }
    },
    
    // 缩放
    scaleIn: {
      from: { transform: 'scale(0.9)', opacity: 0 },
      to: { transform: 'scale(1)', opacity: 1 }
    },
    scaleOut: {
      from: { transform: 'scale(1)', opacity: 1 },
      to: { transform: 'scale(0.9)', opacity: 0 }
    },
    
    // 旋转
    rotate: {
      from: { transform: 'rotate(0deg)' },
      to: { transform: 'rotate(360deg)' }
    },
    
    // 脉冲
    pulse: {
      '0%, 100%': { transform: 'scale(1)', opacity: 1 },
      '50%': { transform: 'scale(1.05)', opacity: 0.8 }
    },
    
    // 摇晃
    shake: {
      '0%, 100%': { transform: 'translateX(0)' },
      '25%': { transform: 'translateX(-10px)' },
      '75%': { transform: 'translateX(10px)' }
    },
    
    // 加载动画
    spin: {
      from: { transform: 'rotate(0deg)' },
      to: { transform: 'rotate(360deg)' }
    },
    
    // 呼吸灯
    breathe: {
      '0%, 100%': { opacity: 1 },
      '50%': { opacity: 0.5 }
    }
  },
  
  // 过渡属性组
  transitions: {
    all: 'all',
    colors: 'background-color, border-color, color, fill, stroke',
    opacity: 'opacity',
    shadow: 'box-shadow',
    transform: 'transform',
    
    // 组合过渡
    fade: 'opacity',
    movement: 'transform',
    appearance: 'opacity, transform',
    interaction: 'background-color, border-color, box-shadow, transform'
  }
}

// 工具函数：创建过渡
export function createTransition(
  property = 'all',
  duration = animations.duration.normal,
  easing = animations.easing.standard,
  delay = '0ms'
) {
  return `${property} ${duration} ${easing} ${delay}`
}

// 工具函数：组合多个过渡
export function combineTransitions(...transitions) {
  return transitions.map(t => {
    if (typeof t === 'string') return t
    return createTransition(t.property, t.duration, t.easing, t.delay)
  }).join(', ')
}

// CSS 动画生成
export function generateKeyframes(name, preset) {
  const frames = animations.presets[preset]
  if (!frames) return ''
  
  let css = `@keyframes ${name} {\n`
  
  Object.entries(frames).forEach(([key, value]) => {
    const properties = Object.entries(value)
      .map(([prop, val]) => `  ${prop}: ${val};`)
      .join('\n  ')
    css += `  ${key} {\n  ${properties}\n  }\n`
  })
  
  css += '}'
  return css
}

// Vue 过渡类名
export const vueTransitions = {
  fade: {
    enterActiveClass: 'transition-opacity duration-200 ease-out',
    enterFromClass: 'opacity-0',
    enterToClass: 'opacity-100',
    leaveActiveClass: 'transition-opacity duration-200 ease-in',
    leaveFromClass: 'opacity-100',
    leaveToClass: 'opacity-0'
  },
  slide: {
    enterActiveClass: 'transition-all duration-300 ease-out',
    enterFromClass: 'transform translate-x-full opacity-0',
    enterToClass: 'transform translate-x-0 opacity-100',
    leaveActiveClass: 'transition-all duration-300 ease-in',
    leaveFromClass: 'transform translate-x-0 opacity-100',
    leaveToClass: 'transform translate-x-full opacity-0'
  },
  scale: {
    enterActiveClass: 'transition-all duration-200 ease-out',
    enterFromClass: 'transform scale-95 opacity-0',
    enterToClass: 'transform scale-100 opacity-100',
    leaveActiveClass: 'transition-all duration-200 ease-in',
    leaveFromClass: 'transform scale-100 opacity-100',
    leaveToClass: 'transform scale-95 opacity-0'
  }
}

// 滚动行为
export const scrollBehavior = {
  smooth: {
    behavior: 'smooth'
  },
  instant: {
    behavior: 'instant'
  },
  auto: {
    behavior: 'auto'
  }
}

export default animations