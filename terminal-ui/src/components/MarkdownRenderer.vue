<template>
  <div class="markdown-renderer" :class="{ dark: isDark }">
    <div v-html="renderedContent" class="markdown-content"></div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { marked } from 'marked'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'

const props = defineProps({
  content: {
    type: [String, Object],
    default: ''
  },
  language: {
    type: String,
    default: 'json'
  },
  isDark: {
    type: Boolean,
    default: true
  }
})

// Configure marked with syntax highlighting
const configureMarked = () => {
  marked.setOptions({
    highlight: function(code, lang) {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return hljs.highlight(code, { language: lang }).value
        } catch (err) {
          console.warn('Highlight.js error:', err)
        }
      }
      
      // Auto-detect language if not specified
      try {
        return hljs.highlightAuto(code).value
      } catch (err) {
        console.warn('Highlight.js auto-detect error:', err)
        return code
      }
    },
    langPrefix: 'hljs language-',
    breaks: true,
    gfm: true
  })
}

// Format content for markdown display
const formatContent = (content, language) => {
  if (!content) return ''
  
  let formatted = ''
  
  if (typeof content === 'object') {
    // Object: format as JSON
    try {
      formatted = JSON.stringify(content, null, 2)
    } catch (error) {
      console.error('JSON stringify error:', error)
      formatted = String(content)
    }
  } else if (typeof content === 'string') {
    // String: check if it's JSON
    if (language === 'json' || content.trim().startsWith('{') || content.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(content)
        formatted = JSON.stringify(parsed, null, 2)
      } catch {
        // Not valid JSON, use as-is
        formatted = content
      }
    } else {
      formatted = content
    }
  } else {
    formatted = String(content)
  }
  
  // Wrap in markdown code block with language
  return `\`\`\`${language}\n${formatted}\n\`\`\``
}

// Computed rendered content
const renderedContent = computed(() => {
  const markdownText = formatContent(props.content, props.language)
  try {
    return marked.parse(markdownText)
  } catch (error) {
    console.error('Markdown parsing error:', error)
    return `<pre><code>${markdownText}</code></pre>`
  }
})

// Initialize marked configuration
onMounted(() => {
  configureMarked()
})

// Watch for content changes and reconfigure if needed
watch([() => props.content, () => props.language], () => {
  configureMarked()
}, { deep: true })
</script>

<style scoped>
.markdown-renderer {
  height: 100%;
  max-height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.markdown-renderer.dark {
  background: #1a1a1a;
  color: #e0e0e0;
}

.markdown-content {
  padding: 20px;
  line-height: 1.6;
}

/* 深色主题样式 */
.markdown-renderer.dark .markdown-content :deep(pre) {
  background: #2d3748 !important;
  border-radius: 6px;
  padding: 16px;
  overflow-x: auto;
  margin: 16px 0;
}

.markdown-renderer.dark .markdown-content :deep(code) {
  background: #2d3748;
  color: #e2e8f0;
  padding: 2px 4px;
  border-radius: 3px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
}

.markdown-renderer.dark .markdown-content :deep(pre code) {
  background: transparent;
  padding: 0;
}

/* 语法高亮样式优化 */
.markdown-content :deep(.hljs) {
  display: block;
  overflow-x: auto;
  padding: 16px;
  background: #2d3748;
  color: #e2e8f0;
  border-radius: 6px;
}

/* JSON特定的语法高亮 */
.markdown-content :deep(.hljs-attr) {
  color: #63b3ed;
}

.markdown-content :deep(.hljs-string) {
  color: #68d391;
}

.markdown-content :deep(.hljs-number) {
  color: #fbb6ce;
}

.markdown-content :deep(.hljs-literal) {
  color: #fc8181;
}

.markdown-content :deep(.hljs-punctuation) {
  color: #cbd5e0;
}

/* 滚动条样式 */
.markdown-renderer::-webkit-scrollbar {
  width: 8px;
}

.markdown-renderer::-webkit-scrollbar-track {
  background: #2d3748;
  border-radius: 4px;
}

.markdown-renderer::-webkit-scrollbar-thumb {
  background: #4a5568;
  border-radius: 4px;
  transition: background 0.2s;
}

.markdown-renderer::-webkit-scrollbar-thumb:hover {
  background: #718096;
}

/* Firefox 滚动条样式 */
.markdown-renderer {
  scrollbar-width: thin;
  scrollbar-color: #4a5568 #2d3748;
}
</style>