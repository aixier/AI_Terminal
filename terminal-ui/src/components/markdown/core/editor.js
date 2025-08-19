/**
 * Milkdown编辑器核心配置
 */
import { Editor, rootCtx, defaultValueCtx, editorViewOptionsCtx } from '@milkdown/core'
import { nord } from '@milkdown/theme-nord'
import { gfm } from '@milkdown/preset-gfm'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import { prism } from '@milkdown/plugin-prism'
import { math } from '@milkdown/plugin-math'
import { mermaid } from '@milkdown/plugin-mermaid'
import { emoji } from '@milkdown/plugin-emoji'
import { tooltip } from '@milkdown/plugin-tooltip'

/**
 * 创建只读模式的Markdown查看器
 */
export function createMarkdownViewer(options = {}) {
  const {
    content = '',
    theme = 'fluent',
    enableMermaid = true,
    enableMath = true,
    enableCodeHighlight = true,
    enableEmoji = true,
    container = null,
    onLoad = () => {},
    onError = (error) => console.error('Markdown viewer error:', error)
  } = options

  return Editor.make()
    .config((ctx) => {
      // 设置初始内容
      ctx.set(defaultValueCtx, content)
      
      // 设置为只读模式
      ctx.set(editorViewOptionsCtx, { 
        editable: false,
        attributes: {
          class: 'markdown-viewer',
          'data-theme': theme
        }
      })

      // 设置根容器
      if (container) {
        ctx.set(rootCtx, container)
      }

      // 监听器配置
      ctx.set(listenerCtx, {
        mounted: onLoad,
        updated: (ctx, doc, prevDoc) => {
          // 可以在这里添加内容更新回调
        }
      })
    })
    .config(nord) // 默认主题，后续会被自定义主题覆盖
    .use(gfm) // GitHub风格Markdown
    .use(listener) // 事件监听
    .use(conditionalPlugin(enableCodeHighlight, prism)) // 代码高亮
    .use(conditionalPlugin(enableMath, math)) // 数学公式
    .use(conditionalPlugin(enableMermaid, mermaid)) // Mermaid图表
    .use(conditionalPlugin(enableEmoji, emoji)) // Emoji支持
    .use(tooltip) // 工具提示
}

/**
 * 创建可编辑的Markdown编辑器
 */
export function createMarkdownEditor(options = {}) {
  const {
    content = '',
    theme = 'fluent',
    enableMermaid = true,
    enableMath = true,
    enableCodeHighlight = true,
    enableEmoji = true,
    container = null,
    onChange = () => {},
    onLoad = () => {},
    onError = (error) => console.error('Markdown editor error:', error)
  } = options

  return Editor.make()
    .config((ctx) => {
      ctx.set(defaultValueCtx, content)
      
      ctx.set(editorViewOptionsCtx, { 
        editable: true,
        attributes: {
          class: 'markdown-editor',
          'data-theme': theme
        }
      })

      if (container) {
        ctx.set(rootCtx, container)
      }

      ctx.set(listenerCtx, {
        mounted: onLoad,
        updated: (ctx, doc, prevDoc) => {
          const markdown = ctx.get(editorViewCtx).state.doc.toString()
          onChange(markdown)
        }
      })
    })
    .config(nord)
    .use(gfm)
    .use(listener)
    .use(conditionalPlugin(enableCodeHighlight, prism))
    .use(conditionalPlugin(enableMath, math))
    .use(conditionalPlugin(enableMermaid, mermaid))
    .use(conditionalPlugin(enableEmoji, emoji))
    .use(tooltip)
}

/**
 * 条件性使用插件的工具函数
 */
function conditionalPlugin(condition, plugin) {
  return condition ? plugin : []
}

/**
 * 预定义的编辑器配置预设
 */
export const EDITOR_PRESETS = {
  // 基础查看器
  basic: {
    enableMermaid: false,
    enableMath: false,
    enableCodeHighlight: true,
    enableEmoji: true
  },
  
  // 完整功能查看器
  full: {
    enableMermaid: true,
    enableMath: true,
    enableCodeHighlight: true,
    enableEmoji: true
  },
  
  // 文档查看器
  document: {
    enableMermaid: true,
    enableMath: true,
    enableCodeHighlight: true,
    enableEmoji: false
  },
  
  // 技术文档查看器
  technical: {
    enableMermaid: true,
    enableMath: true,
    enableCodeHighlight: true,
    enableEmoji: false
  }
}