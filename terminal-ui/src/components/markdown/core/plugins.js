/**
 * Milkdown插件配置管理
 */

// 代码高亮语言配置
export const CODE_LANGUAGES = [
  'javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'csharp',
  'php', 'ruby', 'go', 'rust', 'swift', 'kotlin', 'scala',
  'html', 'css', 'scss', 'less', 'sql', 'bash', 'shell',
  'json', 'yaml', 'xml', 'markdown', 'dockerfile', 'nginx',
  'vue', 'react', 'angular', 'jsx', 'tsx'
]

// Mermaid图表类型配置
export const MERMAID_THEMES = {
  default: 'default',
  neutral: 'neutral',
  dark: 'dark',
  forest: 'forest',
  base: 'base'
}

// 数学公式配置
export const MATH_CONFIG = {
  katex: {
    delimiters: [
      { left: '$$', right: '$$', display: true },
      { left: '$', right: '$', display: false },
      { left: '\\[', right: '\\]', display: true },
      { left: '\\(', right: '\\)', display: false }
    ],
    throwOnError: false,
    errorColor: '#cc0000',
    strict: 'warn',
    output: 'htmlAndMathml',
    trust: false,
    macros: {
      '\\f': '#1f(#2)',
      '\\R': '\\mathbb{R}',
      '\\C': '\\mathbb{C}',
      '\\N': '\\mathbb{N}',
      '\\Z': '\\mathbb{Z}',
      '\\Q': '\\mathbb{Q}'
    }
  }
}

// 自定义容器配置
export const CUSTOM_CONTAINERS = {
  // 信息提示框
  info: {
    marker: ':::',
    validate: (params) => params.trim().match(/^info\s*(.*)$/),
    render: (tokens, idx, options, env, slf) => {
      const m = tokens[idx].info.trim().match(/^info\s*(.*)$/)
      if (tokens[idx].nesting === 1) {
        const title = m && m.length > 1 ? m[1] : 'Info'
        return `<div class="custom-container info">
          <div class="custom-container-title">${title}</div>
          <div class="custom-container-content">\n`
      } else {
        return '</div></div>\n'
      }
    }
  },
  
  // 警告提示框
  warning: {
    marker: ':::',
    validate: (params) => params.trim().match(/^warning\s*(.*)$/),
    render: (tokens, idx, options, env, slf) => {
      const m = tokens[idx].info.trim().match(/^warning\s*(.*)$/)
      if (tokens[idx].nesting === 1) {
        const title = m && m.length > 1 ? m[1] : 'Warning'
        return `<div class="custom-container warning">
          <div class="custom-container-title">${title}</div>
          <div class="custom-container-content">\n`
      } else {
        return '</div></div>\n'
      }
    }
  },
  
  // 错误提示框
  danger: {
    marker: ':::',
    validate: (params) => params.trim().match(/^danger\s*(.*)$/),
    render: (tokens, idx, options, env, slf) => {
      const m = tokens[idx].info.trim().match(/^danger\s*(.*)$/)
      if (tokens[idx].nesting === 1) {
        const title = m && m.length > 1 ? m[1] : 'Danger'
        return `<div class="custom-container danger">
          <div class="custom-container-title">${title}</div>
          <div class="custom-container-content">\n`
      } else {
        return '</div></div>\n'
      }
    }
  },
  
  // 成功提示框
  tip: {
    marker: ':::',
    validate: (params) => params.trim().match(/^tip\s*(.*)$/),
    render: (tokens, idx, options, env, slf) => {
      const m = tokens[idx].info.trim().match(/^tip\s*(.*)$/)
      if (tokens[idx].nesting === 1) {
        const title = m && m.length > 1 ? m[1] : 'Tip'
        return `<div class="custom-container tip">
          <div class="custom-container-title">${title}</div>
          <div class="custom-container-content">\n`
      } else {
        return '</div></div>\n'
      }
    }
  },
  
  // 详细信息折叠框
  details: {
    marker: ':::',
    validate: (params) => params.trim().match(/^details\s*(.*)$/),
    render: (tokens, idx, options, env, slf) => {
      const m = tokens[idx].info.trim().match(/^details\s*(.*)$/)
      if (tokens[idx].nesting === 1) {
        const summary = m && m.length > 1 ? m[1] : 'Details'
        return `<details class="custom-container details">
          <summary class="custom-container-title">${summary}</summary>
          <div class="custom-container-content">\n`
      } else {
        return '</div></details>\n'
      }
    }
  }
}

// Emoji配置
export const EMOJI_CONFIG = {
  shortcuts: {
    ':)': '😊',
    ':(': '😢',
    ':D': '😃',
    ':P': '😛',
    ':|': '😐',
    ':o': '😮',
    ':heart:': '❤️',
    ':thumbsup:': '👍',
    ':thumbsdown:': '👎',
    ':check:': '✅',
    ':cross:': '❌',
    ':warning:': '⚠️',
    ':info:': 'ℹ️',
    ':fire:': '🔥',
    ':rocket:': '🚀',
    ':star:': '⭐',
    ':bulb:': '💡'
  }
}

// 表格增强配置
export const TABLE_CONFIG = {
  allowColumnSorting: true,
  allowColumnResizing: true,
  allowRowSelection: false,
  maxColumns: 20,
  maxRows: 1000
}

// 媒体嵌入配置
export const MEDIA_CONFIG = {
  // 支持的图片格式
  imageFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
  
  // 支持的视频格式
  videoFormats: ['mp4', 'webm', 'ogg'],
  
  // 支持的音频格式
  audioFormats: ['mp3', 'wav', 'ogg', 'aac'],
  
  // 最大文件大小 (MB)
  maxFileSize: 50,
  
  // 懒加载配置
  lazyLoading: true,
  
  // 图片优化
  imageOptimization: {
    quality: 85,
    format: 'webp',
    fallback: true
  }
}