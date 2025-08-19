/**
 * Markdown解析工具函数
 */

/**
 * 检测Markdown内容的复杂度和功能需求
 */
export function analyzeMarkdownContent(content) {
  if (!content || typeof content !== 'string') {
    return {
      complexity: 'simple',
      features: [],
      estimatedRenderTime: 0
    }
  }

  const features = []
  let complexity = 'simple'
  let estimatedRenderTime = 100 // 基础渲染时间(ms)

  // 检测各种功能特性
  const checks = [
    {
      pattern: /```mermaid[\s\S]*?```/g,
      feature: 'mermaid',
      complexity: 'complex',
      renderTime: 500
    },
    {
      pattern: /\$\$[\s\S]*?\$\$|\$[^$\n]*?\$/g,
      feature: 'math',
      complexity: 'medium',
      renderTime: 200
    },
    {
      pattern: /```[\s\S]*?```/g,
      feature: 'codeBlock',
      complexity: 'medium',
      renderTime: 100
    },
    {
      pattern: /!\[.*?\]\(.*?\)/g,
      feature: 'images',
      complexity: 'medium',
      renderTime: 150
    },
    {
      pattern: /<video[\s\S]*?<\/video>|<audio[\s\S]*?<\/audio>/g,
      feature: 'media',
      complexity: 'complex',
      renderTime: 300
    },
    {
      pattern: /\|.*\|.*\|/g,
      feature: 'tables',
      complexity: 'medium',
      renderTime: 100
    },
    {
      pattern: /:::[^:]*[\s\S]*?:::/g,
      feature: 'customContainers',
      complexity: 'medium',
      renderTime: 150
    },
    {
      pattern: /- \[[ x]\]/g,
      feature: 'taskLists',
      complexity: 'simple',
      renderTime: 50
    },
    {
      pattern: />\s/g,
      feature: 'blockquotes',
      complexity: 'simple',
      renderTime: 50
    },
    {
      pattern: /#{1,6}\s/g,
      feature: 'headers',
      complexity: 'simple',
      renderTime: 25
    }
  ]

  // 执行检测
  checks.forEach(check => {
    const matches = content.match(check.pattern)
    if (matches) {
      features.push({
        type: check.feature,
        count: matches.length,
        complexity: check.complexity
      })
      
      // 累计渲染时间
      estimatedRenderTime += check.renderTime * matches.length
      
      // 更新整体复杂度
      if (check.complexity === 'complex') {
        complexity = 'complex'
      } else if (check.complexity === 'medium' && complexity === 'simple') {
        complexity = 'medium'
      }
    }
  })

  // 内容长度影响
  const contentLength = content.length
  if (contentLength > 50000) {
    complexity = 'complex'
    estimatedRenderTime += 200
  } else if (contentLength > 10000) {
    estimatedRenderTime += 100
  }

  return {
    complexity,
    features,
    estimatedRenderTime,
    contentLength,
    hasAdvancedFeatures: features.some(f => f.complexity === 'complex')
  }
}

/**
 * 提取Markdown中的所有链接
 */
export function extractLinks(content) {
  const links = []
  
  // Markdown链接格式: [text](url)
  const markdownLinks = content.match(/\[([^\]]*)\]\(([^)]+)\)/g)
  if (markdownLinks) {
    markdownLinks.forEach(link => {
      const match = link.match(/\[([^\]]*)\]\(([^)]+)\)/)
      if (match) {
        links.push({
          type: 'markdown',
          text: match[1],
          url: match[2],
          raw: link
        })
      }
    })
  }
  
  // HTML链接格式: <a href="url">text</a>
  const htmlLinks = content.match(/<a[^>]+href=["|']([^"|']+)["|'][^>]*>([^<]*)<\/a>/g)
  if (htmlLinks) {
    htmlLinks.forEach(link => {
      const match = link.match(/<a[^>]+href=["|']([^"|']+)["|'][^>]*>([^<]*)<\/a>/)
      if (match) {
        links.push({
          type: 'html',
          text: match[2],
          url: match[1],
          raw: link
        })
      }
    })
  }
  
  // 纯URL
  const urlPattern = /(https?:\/\/[^\s<>"]+)/g
  const urls = content.match(urlPattern)
  if (urls) {
    urls.forEach(url => {
      // 避免重复添加已经在markdown或html链接中的URL
      const alreadyExists = links.some(link => link.url === url)
      if (!alreadyExists) {
        links.push({
          type: 'plain',
          text: url,
          url: url,
          raw: url
        })
      }
    })
  }
  
  return links
}

/**
 * 提取Markdown中的所有图片
 */
export function extractImages(content) {
  const images = []
  
  // Markdown图片格式: ![alt](src)
  const markdownImages = content.match(/!\[([^\]]*)\]\(([^)]+)\)/g)
  if (markdownImages) {
    markdownImages.forEach(img => {
      const match = img.match(/!\[([^\]]*)\]\(([^)]+)\)/)
      if (match) {
        images.push({
          type: 'markdown',
          alt: match[1],
          src: match[2],
          raw: img
        })
      }
    })
  }
  
  // HTML图片格式: <img src="..." alt="...">
  const htmlImages = content.match(/<img[^>]+src=["|']([^"|']+)["|'][^>]*>/g)
  if (htmlImages) {
    htmlImages.forEach(img => {
      const srcMatch = img.match(/src=["|']([^"|']+)["|']/)
      const altMatch = img.match(/alt=["|']([^"|']*)["|']/)
      if (srcMatch) {
        images.push({
          type: 'html',
          alt: altMatch ? altMatch[1] : '',
          src: srcMatch[1],
          raw: img
        })
      }
    })
  }
  
  return images
}

/**
 * 提取代码块信息
 */
export function extractCodeBlocks(content) {
  const codeBlocks = []
  
  // 匹配代码块: ```language\ncode\n```
  const pattern = /```(\w*)\n?([\s\S]*?)```/g
  let match
  
  while ((match = pattern.exec(content)) !== null) {
    codeBlocks.push({
      language: match[1] || 'text',
      code: match[2].trim(),
      raw: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length
    })
  }
  
  return codeBlocks
}

/**
 * 提取标题结构
 */
export function extractHeaders(content) {
  const headers = []
  const lines = content.split('\n')
  
  lines.forEach((line, index) => {
    const match = line.match(/^(#{1,6})\s+(.*)$/)
    if (match) {
      const level = match[1].length
      const text = match[2].trim()
      const id = generateHeaderId(text)
      
      headers.push({
        level,
        text,
        id,
        line: index + 1,
        raw: line
      })
    }
  })
  
  return headers
}

/**
 * 生成标题ID（用于目录导航）
 */
export function generateHeaderId(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5\s-]/g, '') // 保留中文、英文、数字、空格、连字符
    .replace(/\s+/g, '-') // 空格替换为连字符
    .replace(/-+/g, '-') // 多个连字符合并为一个
    .trim()
}

/**
 * 生成Markdown目录
 */
export function generateTOC(headers, maxLevel = 3) {
  if (!headers || headers.length === 0) return ''
  
  const filteredHeaders = headers.filter(h => h.level <= maxLevel)
  let toc = ''
  
  filteredHeaders.forEach(header => {
    const indent = '  '.repeat(header.level - 1)
    const link = `[${header.text}](#${header.id})`
    toc += `${indent}- ${link}\n`
  })
  
  return toc.trim()
}

/**
 * 统计Markdown内容信息
 */
export function getContentStats(content) {
  if (!content) {
    return {
      characters: 0,
      words: 0,
      lines: 0,
      paragraphs: 0,
      headers: 0,
      links: 0,
      images: 0,
      codeBlocks: 0,
      readingTime: 0
    }
  }
  
  const lines = content.split('\n')
  const paragraphs = content.split('\n\n').filter(p => p.trim()).length
  
  // 移除markdown语法后统计单词
  const plainText = content
    .replace(/[#*_`~\[\]()]/g, '') // 移除markdown符号
    .replace(/!\[.*?\]\(.*?\)/g, '') // 移除图片
    .replace(/\[.*?\]\(.*?\)/g, '') // 移除链接
    .replace(/```[\s\S]*?```/g, '') // 移除代码块
    .replace(/`[^`]*`/g, '') // 移除行内代码
    .trim()
  
  const words = plainText.split(/\s+/).filter(w => w).length
  const readingTime = Math.ceil(words / 200) // 假设每分钟读200字
  
  const headers = extractHeaders(content)
  const links = extractLinks(content)
  const images = extractImages(content)
  const codeBlocks = extractCodeBlocks(content)
  
  return {
    characters: content.length,
    words,
    lines: lines.length,
    paragraphs,
    headers: headers.length,
    links: links.length,
    images: images.length,
    codeBlocks: codeBlocks.length,
    readingTime
  }
}

/**
 * 验证Markdown语法
 */
export function validateMarkdownSyntax(content) {
  const issues = []
  
  // 检查未闭合的代码块
  const codeBlockMatches = content.match(/```/g)
  if (codeBlockMatches && codeBlockMatches.length % 2 !== 0) {
    issues.push({
      type: 'syntax',
      level: 'error',
      message: '存在未闭合的代码块',
      line: null
    })
  }
  
  // 检查损坏的链接格式
  const brokenLinks = content.match(/\[[^\]]*\]\([^)]*$/gm)
  if (brokenLinks) {
    issues.push({
      type: 'syntax',
      level: 'error',
      message: '存在格式错误的链接',
      count: brokenLinks.length
    })
  }
  
  // 检查损坏的图片格式
  const brokenImages = content.match(/!\[[^\]]*\]\([^)]*$/gm)
  if (brokenImages) {
    issues.push({
      type: 'syntax',
      level: 'error',
      message: '存在格式错误的图片',
      count: brokenImages.length
    })
  }
  
  // 检查不规范的标题（没有空格）
  const badHeaders = content.match(/^#{1,6}[^#\s]/gm)
  if (badHeaders) {
    issues.push({
      type: 'style',
      level: 'warning',
      message: '标题后缺少空格',
      count: badHeaders.length
    })
  }
  
  return {
    isValid: issues.filter(i => i.level === 'error').length === 0,
    issues
  }
}