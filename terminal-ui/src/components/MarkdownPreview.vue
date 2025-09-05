<template>
  <div class="markdown-preview-container">
    <!-- 预览头部 -->
    <div class="preview-header">
      <h3 class="file-name">{{ fileName }}</h3>
      <button @click="$emit('close')" class="close-btn">✕</button>
    </div>
    
    <!-- Markdown内容区域 -->
    <div class="markdown-content" ref="contentRef" v-html="renderedContent"></div>
    
    <!-- 底部操作栏 -->
    <div class="preview-footer">
      <button @click="copyContent" class="action-btn">
        <span>📋</span> 复制
      </button>
      <button @click="downloadFile" class="action-btn primary">
        <span>⬇️</span> 下载
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { marked } from 'marked'
import hljs from 'highlight.js'
import 'highlight.js/styles/github.css'

const props = defineProps({
  fileName: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  fileType: {
    type: String,
    default: 'markdown'
  }
})

const emit = defineEmits(['close', 'download'])

const contentRef = ref(null)

// 配置marked选项
marked.setOptions({
  renderer: new marked.Renderer(),
  highlight: function(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang }).value
      } catch (err) {
        console.error('Highlight error:', err)
      }
    }
    return hljs.highlightAuto(code).value
  },
  pedantic: false,
  gfm: true,
  breaks: true,
  sanitize: false,
  smartLists: true,
  smartypants: false,
  xhtml: false
})

// 渲染内容
const renderedContent = computed(() => {
  if (!props.content) return ''
  
  try {
    // 根据文件类型处理内容
    switch (props.fileType.toLowerCase()) {
      case 'markdown':
      case 'md':
        return marked(props.content)
      
      case 'json':
        // JSON格式化显示
        try {
          const jsonObj = typeof props.content === 'string' 
            ? JSON.parse(props.content) 
            : props.content
          return `<pre class="json-preview"><code class="language-json">${hljs.highlight(JSON.stringify(jsonObj, null, 2), { language: 'json' }).value}</code></pre>`
        } catch (e) {
          return `<pre><code>${escapeHtml(props.content)}</code></pre>`
        }
      
      case 'html':
        // HTML预览（安全渲染）
        return `<div class="html-preview">${props.content}</div>`
      
      case 'text':
      case 'txt':
        // 纯文本显示
        return `<pre class="text-preview">${escapeHtml(props.content)}</pre>`
      
      case 'code':
      case 'javascript':
      case 'js':
      case 'typescript':
      case 'ts':
      case 'python':
      case 'py':
      case 'css':
      case 'scss':
      case 'less':
        // 代码高亮
        const language = getLanguageFromType(props.fileType)
        return `<pre><code class="language-${language}">${hljs.highlight(props.content, { language }).value}</code></pre>`
      
      default:
        // 默认按纯文本处理
        return `<pre>${escapeHtml(props.content)}</pre>`
    }
  } catch (error) {
    console.error('Render error:', error)
    return `<pre>${escapeHtml(props.content)}</pre>`
  }
})

// 获取语言类型
function getLanguageFromType(type) {
  const languageMap = {
    'js': 'javascript',
    'ts': 'typescript',
    'py': 'python',
    'scss': 'scss',
    'less': 'less'
  }
  return languageMap[type.toLowerCase()] || type.toLowerCase()
}

// HTML转义
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

// 复制内容
const copyContent = async () => {
  try {
    await navigator.clipboard.writeText(props.content)
    ElMessage.success('内容已复制到剪贴板')
  } catch (error) {
    console.error('Copy failed:', error)
    // 降级方案
    const textarea = document.createElement('textarea')
    textarea.value = props.content
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    ElMessage.success('内容已复制到剪贴板')
  }
}

// 下载文件
const downloadFile = () => {
  emit('download')
}

// 挂载后处理
onMounted(() => {
  // 为所有代码块添加复制按钮
  if (contentRef.value) {
    const codeBlocks = contentRef.value.querySelectorAll('pre code')
    codeBlocks.forEach((block) => {
      const wrapper = document.createElement('div')
      wrapper.className = 'code-block-wrapper'
      block.parentNode.insertBefore(wrapper, block)
      wrapper.appendChild(block)
      
      const copyBtn = document.createElement('button')
      copyBtn.className = 'code-copy-btn'
      copyBtn.innerHTML = '📋'
      copyBtn.title = '复制代码'
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(block.textContent)
        ElMessage.success('代码已复制')
      }
      wrapper.appendChild(copyBtn)
    })
  }
})
</script>

<style scoped>
.markdown-preview-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

/* 头部样式 */
.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.file-name {
  margin: 0;
  font-size: 18px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.close-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  font-size: 20px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.1);
}

/* 内容区域 */
.markdown-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  background: #fafafa;
}

/* Markdown样式 */
.markdown-content :deep(h1) {
  font-size: 28px;
  margin: 24px 0 16px;
  padding-bottom: 8px;
  border-bottom: 2px solid #e0e0e0;
}

.markdown-content :deep(h2) {
  font-size: 24px;
  margin: 20px 0 12px;
  padding-bottom: 6px;
  border-bottom: 1px solid #e0e0e0;
}

.markdown-content :deep(h3) {
  font-size: 20px;
  margin: 16px 0 8px;
}

.markdown-content :deep(h4) {
  font-size: 18px;
  margin: 12px 0 6px;
}

.markdown-content :deep(p) {
  margin: 12px 0;
  line-height: 1.8;
  color: #333;
}

.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  margin: 12px 0;
  padding-left: 24px;
}

.markdown-content :deep(li) {
  margin: 6px 0;
  line-height: 1.6;
}

.markdown-content :deep(blockquote) {
  margin: 16px 0;
  padding: 12px 20px;
  background: #f0f0f0;
  border-left: 4px solid #667eea;
  color: #666;
}

.markdown-content :deep(code) {
  padding: 2px 6px;
  background: #f5f5f5;
  border-radius: 3px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 14px;
  color: #d14;
}

.markdown-content :deep(pre) {
  margin: 16px 0;
  padding: 16px;
  background: #f8f8f8;
  border-radius: 8px;
  overflow-x: auto;
}

.markdown-content :deep(pre code) {
  padding: 0;
  background: transparent;
  color: inherit;
}

.markdown-content :deep(table) {
  width: 100%;
  margin: 16px 0;
  border-collapse: collapse;
}

.markdown-content :deep(th),
.markdown-content :deep(td) {
  padding: 8px 12px;
  border: 1px solid #ddd;
  text-align: left;
}

.markdown-content :deep(th) {
  background: #f5f5f5;
  font-weight: 600;
}

.markdown-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
}

.markdown-content :deep(a) {
  color: #667eea;
  text-decoration: none;
}

.markdown-content :deep(a:hover) {
  text-decoration: underline;
}

/* 代码块包装器 */
.markdown-content :deep(.code-block-wrapper) {
  position: relative;
  margin: 16px 0;
}

.markdown-content :deep(.code-copy-btn) {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(102, 126, 234, 0.1);
  border: 1px solid rgba(102, 126, 234, 0.3);
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s;
}

.markdown-content :deep(.code-copy-btn:hover) {
  background: rgba(102, 126, 234, 0.2);
  transform: scale(1.05);
}

/* 特殊预览样式 */
.markdown-content :deep(.json-preview) {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 16px;
  border-radius: 8px;
}

.markdown-content :deep(.html-preview) {
  padding: 16px;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
}

.markdown-content :deep(.text-preview) {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  line-height: 1.5;
}

/* 底部操作栏 */
.preview-footer {
  display: flex;
  justify-content: center;
  gap: 12px;
  padding: 16px;
  background: white;
  border-top: 1px solid #e0e0e0;
}

.action-btn {
  padding: 8px 20px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  align-items: center;
  gap: 6px;
}

.action-btn:hover {
  background: #f5f5f5;
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.action-btn.primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
}

.action-btn.primary:hover {
  background: linear-gradient(135deg, #5a67d8 0%, #6b3d8f 100%);
}

/* 移动端适配 */
@media (max-width: 768px) {
  .preview-header {
    padding: 12px 16px;
  }
  
  .file-name {
    font-size: 16px;
  }
  
  .markdown-content {
    padding: 16px;
  }
  
  .preview-footer {
    padding: 12px;
  }
  
  .action-btn {
    flex: 1;
    justify-content: center;
  }
}
</style>