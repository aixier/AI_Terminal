<template>
  <div class="simple-markdown-viewer">
    <div v-html="renderedContent" class="markdown-content"></div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { marked } from 'marked'

const props = defineProps({
  content: {
    type: String,
    default: ''
  }
})

// Configure marked options
marked.setOptions({
  breaks: true,
  gfm: true,
  headerIds: true,
  highlight: function(code, lang) {
    // Basic syntax highlighting with class names
    return `<pre class="language-${lang}"><code>${escapeHtml(code)}</code></pre>`
  }
})

// Escape HTML for code blocks
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }
  return text.replace(/[&<>"']/g, m => map[m])
}

// Render markdown to HTML
const renderedContent = computed(() => {
  if (!props.content) return ''
  try {
    return marked(props.content)
  } catch (error) {
    console.error('Markdown rendering error:', error)
    return `<pre>${escapeHtml(props.content)}</pre>`
  }
})
</script>

<style scoped>
.simple-markdown-viewer {
  width: 100%;
  height: 100%;
  overflow: auto;
  background: #1e1e1e;
  color: #d4d4d4;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.markdown-content {
  padding: 20px;
  max-width: 900px;
  margin: 0 auto;
}

/* Markdown styles */
.markdown-content :deep(h1),
.markdown-content :deep(h2),
.markdown-content :deep(h3),
.markdown-content :deep(h4),
.markdown-content :deep(h5),
.markdown-content :deep(h6) {
  color: #e0e0e0;
  margin-top: 24px;
  margin-bottom: 16px;
  font-weight: 600;
  line-height: 1.25;
}

.markdown-content :deep(h1) {
  font-size: 2em;
  border-bottom: 1px solid #3a3a3a;
  padding-bottom: 0.3em;
}

.markdown-content :deep(h2) {
  font-size: 1.5em;
  border-bottom: 1px solid #3a3a3a;
  padding-bottom: 0.3em;
}

.markdown-content :deep(h3) {
  font-size: 1.25em;
}

.markdown-content :deep(p) {
  margin-bottom: 16px;
  line-height: 1.6;
}

.markdown-content :deep(a) {
  color: #58a6ff;
  text-decoration: none;
}

.markdown-content :deep(a:hover) {
  text-decoration: underline;
}

.markdown-content :deep(code) {
  background: #2d2d2d;
  padding: 2px 4px;
  border-radius: 3px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 0.9em;
  color: #ff7b72;
}

.markdown-content :deep(pre) {
  background: #161b22;
  padding: 16px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 16px 0;
}

.markdown-content :deep(pre code) {
  background: transparent;
  padding: 0;
  color: #d4d4d4;
}

.markdown-content :deep(blockquote) {
  border-left: 4px solid #3a3a3a;
  padding-left: 16px;
  margin: 16px 0;
  color: #8b949e;
}

.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  padding-left: 2em;
  margin-bottom: 16px;
}

.markdown-content :deep(li) {
  margin-bottom: 4px;
}

.markdown-content :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 16px 0;
}

.markdown-content :deep(th),
.markdown-content :deep(td) {
  border: 1px solid #3a3a3a;
  padding: 8px 12px;
}

.markdown-content :deep(th) {
  background: #161b22;
  font-weight: 600;
}

.markdown-content :deep(tr:nth-child(even)) {
  background: #0d1117;
}

.markdown-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 6px;
}

.markdown-content :deep(hr) {
  border: none;
  border-top: 1px solid #3a3a3a;
  margin: 24px 0;
}

.markdown-content :deep(strong) {
  font-weight: 600;
  color: #ffffff;
}

.markdown-content :deep(em) {
  font-style: italic;
  color: #d4d4d4;
}
</style>