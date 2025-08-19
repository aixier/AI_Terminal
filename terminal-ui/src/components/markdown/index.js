/**
 * Markdown模块入口文件
 * 导出所有组件、工具函数和配置
 */

// 主要组件
import MarkdownViewer from './MarkdownViewer.vue'

// 核心配置
import { createMarkdownViewer, createMarkdownEditor, EDITOR_PRESETS } from './core/editor.js'
import { 
  CODE_LANGUAGES, 
  MERMAID_THEMES, 
  MATH_CONFIG, 
  CUSTOM_CONTAINERS,
  EMOJI_CONFIG,
  TABLE_CONFIG,
  MEDIA_CONFIG 
} from './core/plugins.js'

// 工具函数
import {
  analyzeMarkdownContent,
  extractLinks,
  extractImages,
  extractCodeBlocks,
  extractHeaders,
  generateHeaderId,
  generateTOC,
  getContentStats,
  validateMarkdownSyntax
} from './utils/parser.js'

// 主题样式
import './themes/fluent.css'

/**
 * 快速创建Markdown查看器的便捷函数
 */
export function createQuickViewer(container, content, options = {}) {
  const defaultOptions = {
    content,
    theme: 'fluent',
    container,
    ...EDITOR_PRESETS.full,
    ...options
  }
  
  return createMarkdownViewer(defaultOptions)
}

/**
 * 检测文件类型并返回推荐的预设配置
 */
export function detectContentType(content) {
  const analysis = analyzeMarkdownContent(content)
  
  if (analysis.hasAdvancedFeatures) {
    return 'technical'
  } else if (analysis.features.some(f => f.type === 'mermaid' || f.type === 'math')) {
    return 'document'
  } else if (analysis.complexity === 'simple') {
    return 'basic'
  } else {
    return 'full'
  }
}

/**
 * 预设配置的中文描述
 */
export const PRESET_DESCRIPTIONS = {
  basic: {
    name: '基础查看器',
    description: '支持基本Markdown语法，适合简单文档',
    features: ['代码高亮', 'Emoji', '基础格式']
  },
  full: {
    name: '完整功能',
    description: '支持所有Markdown扩展功能',
    features: ['Mermaid图表', '数学公式', '代码高亮', 'Emoji', '自定义容器']
  },
  document: {
    name: '文档查看器',
    description: '适合技术文档和说明文件',
    features: ['Mermaid图表', '数学公式', '代码高亮', '目录生成']
  },
  technical: {
    name: '技术文档',
    description: '专为技术文档优化',
    features: ['Mermaid图表', '数学公式', '代码高亮', '语法验证']
  }
}

/**
 * 主题配置
 */
export const THEME_CONFIG = {
  fluent: {
    name: 'Fluent Design',
    description: '微软Fluent设计风格',
    isDark: false
  },
  'fluent-dark': {
    name: 'Fluent Dark',
    description: '深色Fluent设计风格',
    isDark: true
  }
}

/**
 * 获取支持的文件扩展名
 */
export const SUPPORTED_EXTENSIONS = [
  '.md',
  '.markdown',
  '.mdown',
  '.mkd',
  '.mkdn',
  '.mdwn',
  '.mdtxt',
  '.mdtext',
  '.text',
  '.txt'
]

/**
 * 检查文件是否为Markdown格式
 */
export function isMarkdownFile(filename) {
  if (!filename) return false
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'))
  return SUPPORTED_EXTENSIONS.includes(ext)
}

/**
 * 获取文件的推荐预设
 */
export function getRecommendedPreset(filename, content) {
  // 基于文件名的推荐
  const lowerName = filename.toLowerCase()
  
  if (lowerName.includes('readme')) {
    return 'document'
  } else if (lowerName.includes('api') || lowerName.includes('tech') || lowerName.includes('spec')) {
    return 'technical'
  } else if (content) {
    return detectContentType(content)
  } else {
    return 'full'
  }
}

/**
 * Markdown渲染器工厂函数
 */
export class MarkdownRendererFactory {
  static create(type = 'viewer', options = {}) {
    switch (type) {
      case 'viewer':
        return createMarkdownViewer(options)
      case 'editor':
        return createMarkdownEditor(options)
      default:
        throw new Error(`Unknown renderer type: ${type}`)
    }
  }
  
  static createFromPreset(preset, options = {}) {
    const presetConfig = EDITOR_PRESETS[preset]
    if (!presetConfig) {
      throw new Error(`Unknown preset: ${preset}`)
    }
    
    return this.create('viewer', { ...presetConfig, ...options })
  }
}

/**
 * 导出所有组件和工具
 */
export {
  // 组件
  MarkdownViewer,
  
  // 核心功能
  createMarkdownViewer,
  createMarkdownEditor,
  EDITOR_PRESETS,
  
  // 插件配置
  CODE_LANGUAGES,
  MERMAID_THEMES,
  MATH_CONFIG,
  CUSTOM_CONTAINERS,
  EMOJI_CONFIG,
  TABLE_CONFIG,
  MEDIA_CONFIG,
  
  // 工具函数
  analyzeMarkdownContent,
  extractLinks,
  extractImages,
  extractCodeBlocks,
  extractHeaders,
  generateHeaderId,
  generateTOC,
  getContentStats,
  validateMarkdownSyntax
}

/**
 * 默认导出主组件
 */
export default MarkdownViewer