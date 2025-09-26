/**
 * HTML资源解析器
 * 负责从HTML中提取所有本地图片资源路径
 * 包括img标签、CSS中的url()等
 */

import path from 'path'
import fs from 'fs/promises'
import { JSDOM } from 'jsdom'

class HtmlResourceParser {
  constructor() {
    // 支持的图片格式
    this.supportedFormats = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico']
  }

  /**
   * 解析HTML文件，提取所有本地图片资源
   * @param {string} htmlFilePath - HTML文件路径
   * @param {string} templateBasePath - 模板基础路径
   * @returns {Promise<Object>} 解析结果
   */
  async parseHtmlFile(htmlFilePath, templateBasePath = '') {
    try {
      console.log(`[HtmlResourceParser] Parsing: ${htmlFilePath}`)
      
      // 读取HTML文件
      const htmlContent = await fs.readFile(htmlFilePath, 'utf-8')
      const htmlFileDir = path.dirname(htmlFilePath)
      
      // 解析DOM
      const dom = new JSDOM(htmlContent)
      const document = dom.window.document
      
      // 收集所有资源引用
      const resources = []
      
      // 1. 解析img标签
      const imgResources = await this.parseImgTags(document, htmlFileDir, templateBasePath)
      resources.push(...imgResources)
      
      // 2. 解析CSS中的url()
      const cssResources = await this.parseCssUrls(document, htmlFileDir, templateBasePath)
      resources.push(...cssResources)
      
      // 不再去重，保留所有资源引用，确保每个元素都能被替换
      // 即使多个元素引用同一个文件，也需要分别替换
      console.log(`[HtmlResourceParser] Found ${resources.length} resource references`)
      console.log(`[HtmlResourceParser] Unique paths: ${new Set(resources.map(r => r.localPath)).size}`)

      return {
        success: true,
        htmlContent,
        dom,
        document,
        resources: resources,  // 使用所有资源，不去重
        stats: {
          totalImgTags: imgResources.length,
          totalCssUrls: cssResources.length,
          totalResources: resources.length,
          uniquePaths: new Set(resources.map(r => r.localPath)).size
        }
      }
    } catch (error) {
      console.error(`[HtmlResourceParser] Parse failed:`, error)
      return {
        success: false,
        error: error.message,
        resources: []
      }
    }
  }

  /**
   * 解析img标签
   */
  async parseImgTags(document, htmlFileDir, templateBasePath) {
    const resources = []
    const images = document.querySelectorAll('img')
    
    console.log(`[HtmlResourceParser] Found ${images.length} img tags`)
    
    for (let i = 0; i < images.length; i++) {
      const img = images[i]
      const src = img.getAttribute('src')
      
      if (!src || this.shouldSkipResource(src)) {
        continue
      }
      
      const resolvedPath = await this.resolveResourcePath(src, htmlFileDir, templateBasePath)
      
      resources.push({
        type: 'img',
        element: img,
        attribute: 'src',
        originalPath: src,
        localPath: resolvedPath,
        index: i
      })
    }
    
    return resources
  }

  /**
   * 解析CSS中的url()
   */
  async parseCssUrls(document, htmlFileDir, templateBasePath) {
    const resources = []
    
    // 处理<style>标签
    const styleTags = document.querySelectorAll('style')
    for (const styleTag of styleTags) {
      if (styleTag.textContent) {
        const urls = await this.extractUrlsFromCss(
          styleTag.textContent,
          htmlFileDir,
          templateBasePath
        )
        
        urls.forEach(url => {
          resources.push({
            type: 'style',
            element: styleTag,
            attribute: 'textContent',
            originalPath: url.originalPath,
            localPath: url.localPath,
            fullMatch: url.fullMatch
          })
        })
      }
    }
    
    // 处理内联style属性
    const elementsWithStyle = document.querySelectorAll('[style]')
    for (const element of elementsWithStyle) {
      const styleValue = element.getAttribute('style')
      if (styleValue && styleValue.includes('url(')) {
        const urls = await this.extractUrlsFromCss(
          styleValue,
          htmlFileDir,
          templateBasePath
        )
        
        urls.forEach(url => {
          resources.push({
            type: 'inline-style',
            element: element,
            attribute: 'style',
            originalPath: url.originalPath,
            localPath: url.localPath,
            fullMatch: url.fullMatch
          })
        })
      }
    }
    
    return resources
  }

  /**
   * 从CSS文本中提取url()
   */
  async extractUrlsFromCss(cssText, htmlFileDir, templateBasePath) {
    const urls = []
    const urlRegex = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi
    const matches = [...cssText.matchAll(urlRegex)]
    
    for (const match of matches) {
      const fullMatch = match[0]
      const url = match[2]
      
      if (!this.shouldSkipResource(url)) {
        const resolvedPath = await this.resolveResourcePath(url, htmlFileDir, templateBasePath)
        urls.push({
          fullMatch,
          originalPath: url,
          localPath: resolvedPath
        })
      }
    }
    
    return urls
  }

  /**
   * 统一的资源路径解析
   */
  async resolveResourcePath(src, htmlFileDir, templateBasePath) {
    console.log(`[HtmlResourceParser] Resolving: ${src}`)
    
    // 路径解析策略列表
    const strategies = [
      // 1. 绝对路径
      async () => {
        if (path.isAbsolute(src) && await this.fileExists(src)) {
          return src
        }
        return null
      },
      
      // 2. Docker路径映射
      async () => {
        if (src.startsWith('/app/data/users/')) {
          const mappings = [
            src.replace('/app/data/users/', path.join(process.cwd(), 'data/users/')),
            src.replace('/app/data/users/', '/mnt/d/work/AI_Terminal/terminal-backend/data/users/'),
            src.replace('/app/data/users/', '/mnt/d/work/AI_Terminal/data/users/')
          ]
          
          for (const mapped of mappings) {
            if (await this.fileExists(mapped)) {
              return mapped
            }
          }
        }
        return null
      },
      
      // 3. 相对于HTML文件
      async () => {
        if (!path.isAbsolute(src)) {
          const resolved = path.resolve(htmlFileDir, src)
          if (await this.fileExists(resolved)) {
            return resolved
          }
        }
        return null
      },
      
      // 4. 模板路径
      async () => {
        if (templateBasePath) {
          // 处理templates/pod2post路径
          if (src.includes('/templates/pod2post/')) {
            const relativePart = src.split('/templates/pod2post/')[1]
            if (relativePart) {
              const resolved = path.join(templateBasePath, relativePart)
              if (await this.fileExists(resolved)) {
                return resolved
              }
            }
          }

          // 相对于模板路径
          const resolved = path.resolve(templateBasePath, src)
          if (await this.fileExists(resolved)) {
            return resolved
          }
        }
        return null
      },

      // 4.5 CDN特殊处理：公共模板CDN回退
      async () => {
        // 如果路径包含CDN，尝试公共模板CDN
        if (src.includes('CDN/') || src.startsWith('CDN/')) {
          const cdnFileName = src.includes('CDN/') ? src.split('CDN/')[1] : src.replace('CDN/', '')
          if (cdnFileName) {
            // Docker环境的公共CDN路径
            const publicCdnPath = path.join('/app/data/public_template/pod2post/CDN', cdnFileName)
            console.log(`[HtmlResourceParser] Trying public CDN fallback: ${publicCdnPath}`)
            if (await this.fileExists(publicCdnPath)) {
              console.log(`[HtmlResourceParser] Found in public CDN: ${publicCdnPath}`)
              return publicCdnPath
            }
          }
        }
        return null
      },
      
      // 5. 文件名搜索
      async () => {
        const filename = path.basename(src)
        const inHtmlDir = path.join(htmlFileDir, filename)
        if (await this.fileExists(inHtmlDir)) {
          return inHtmlDir
        }
        return null
      }
    ]
    
    // 按顺序尝试每个策略
    for (const strategy of strategies) {
      const result = await strategy()
      if (result) {
        console.log(`[HtmlResourceParser] Resolved to: ${result}`)
        return result
      }
    }
    
    // 找不到则返回原始路径
    console.warn(`[HtmlResourceParser] Could not resolve: ${src}`)
    return src
  }

  /**
   * 判断是否应该跳过资源
   */
  shouldSkipResource(src) {
    if (!src) return true
    if (src.startsWith('data:')) return true  // Base64
    if (src.startsWith('http://') || src.startsWith('https://')) return true  // 外部URL
    if (src.startsWith('//')) return true  // 协议相对URL
    if (src.startsWith('#')) return true  // 锚点
    if (src.startsWith('javascript:')) return true  // JavaScript
    if (src.includes('.aliyuncs.com')) return true  // OSS URL
    
    return false
  }

  /**
   * 检查文件是否存在
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * 去重资源列表
   */
  deduplicateResources(resources) {
    const seen = new Map()
    const unique = []
    
    for (const resource of resources) {
      const key = resource.localPath
      if (!seen.has(key)) {
        seen.set(key, true)
        unique.push(resource)
      }
    }
    
    return unique
  }

  /**
   * 验证图片文件格式
   */
  isImageFile(filePath) {
    const ext = path.extname(filePath).toLowerCase().slice(1)
    return this.supportedFormats.includes(ext)
  }
}

export default HtmlResourceParser