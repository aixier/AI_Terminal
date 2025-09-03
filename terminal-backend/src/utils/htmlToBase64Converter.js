import fs from 'fs/promises'
import path from 'path'
import { JSDOM } from 'jsdom'

/**
 * HTML 图片转 Base64 转换器
 * 将 HTML 文件中的所有 img 标签的图片转换为 base64 嵌入格式
 */
class HtmlToBase64Converter {
  constructor() {
    // 支持的图片格式
    this.supportedFormats = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico']
  }

  /**
   * 转换 HTML 文件中的所有图片为 base64 嵌入格式
   * @param {string} htmlFilePath - HTML 文件的绝对路径
   * @param {string} templateBasePath - 模板文件的基础路径（用于解析相对路径）
   * @returns {Promise<{success: boolean, outputFile?: string, stats?: object, error?: string}>}
   */
  async convertHtmlToBase64(htmlFilePath, templateBasePath = null) {
    const startTime = Date.now()
    const stats = {
      totalImages: 0,
      convertedImages: 0,
      skippedImages: 0,
      totalCssUrls: 0,
      convertedCssUrls: 0,
      skippedCssUrls: 0,
      skippedReasons: {
        noSrc: 0,
        alreadyBase64: 0,
        httpUrls: 0,
        conversionFailed: 0
      },
      failedImages: [],
      processingTime: 0
    }

    try {
      console.log(`[HtmlToBase64] Starting conversion: ${htmlFilePath}`)
      console.log(`[HtmlToBase64] Template base path: ${templateBasePath}`)

      // 1. 检查输入文件是否存在
      const htmlExists = await this.fileExists(htmlFilePath)
      if (!htmlExists) {
        throw new Error(`HTML file does not exist: ${htmlFilePath}`)
      }

      // 2. 读取 HTML 文件
      const htmlContent = await fs.readFile(htmlFilePath, 'utf-8')
      console.log(`[HtmlToBase64] HTML file read successfully (${htmlContent.length} chars)`)

      // 3. 解析 HTML
      const dom = new JSDOM(htmlContent)
      const document = dom.window.document
      const imgTags = document.querySelectorAll('img')
      
      stats.totalImages = imgTags.length
      console.log(`[HtmlToBase64] Found ${stats.totalImages} img tags`)

      if (stats.totalImages === 0) {
        console.log(`[HtmlToBase64] No images found, saving original HTML with _base64 suffix`)
        const outputFile = this.generateOutputFileName(htmlFilePath)
        await fs.writeFile(outputFile, htmlContent)
        
        stats.processingTime = Date.now() - startTime
        return {
          success: true,
          outputFile,
          stats
        }
      }

      // 4. 处理每个图片标签
      const htmlFileDir = path.dirname(htmlFilePath)
      
      for (let i = 0; i < imgTags.length; i++) {
        const img = imgTags[i]
        const src = img.getAttribute('src')
        
        // 跳过已经是base64、没有src、或者是HTTP/HTTPS链接的图片
        if (!src) {
          console.log(`[HtmlToBase64] Skipping img ${i + 1}: no src attribute`)
          stats.skippedImages++
          stats.skippedReasons.noSrc++
          continue
        }
        
        if (src.startsWith('data:')) {
          console.log(`[HtmlToBase64] Skipping img ${i + 1}: already base64 (${src.substring(0, 50)}...)`)
          stats.skippedImages++
          stats.skippedReasons.alreadyBase64++
          continue
        }
        
        if (src.startsWith('http://') || src.startsWith('https://')) {
          console.log(`[HtmlToBase64] Skipping img ${i + 1}: HTTP/HTTPS URL (${src})`)
          stats.skippedImages++
          stats.skippedReasons.httpUrls++
          continue
        }

        try {
          // 解析图片路径
          const imagePath = this.resolveImagePath(src, htmlFileDir, templateBasePath)
          console.log(`[HtmlToBase64] Processing img ${i + 1}: ${src} -> ${imagePath}`)

          // 转换为 base64
          const base64Data = await this.imageToBase64(imagePath)
          if (base64Data) {
            img.setAttribute('src', base64Data)
            stats.convertedImages++
            console.log(`[HtmlToBase64] Successfully converted img ${i + 1}`)
          } else {
            stats.skippedImages++
            stats.skippedReasons.conversionFailed++
            stats.failedImages.push({ src, reason: 'Conversion failed' })
            console.warn(`[HtmlToBase64] Failed to convert img ${i + 1}: ${src}`)
          }
        } catch (error) {
          stats.skippedImages++
          stats.skippedReasons.conversionFailed++
          stats.failedImages.push({ src, reason: error.message })
          console.error(`[HtmlToBase64] Error processing img ${i + 1}:`, error.message)
        }
      }

      // 5. 处理CSS中的url()引用
      await this.processCssUrls(document, htmlFileDir, templateBasePath, stats)

      // 5. 生成输出文件
      const modifiedHtml = dom.serialize()
      const outputFile = this.generateOutputFileName(htmlFilePath)
      
      await fs.writeFile(outputFile, modifiedHtml)
      console.log(`[HtmlToBase64] Output file saved: ${outputFile}`)

      // 6. 统计结果
      stats.processingTime = Date.now() - startTime
      
      console.log(`[HtmlToBase64] Conversion completed:`)
      console.log(`[HtmlToBase64]   - Total images: ${stats.totalImages}`)
      console.log(`[HtmlToBase64]   - Converted images: ${stats.convertedImages}`)
      console.log(`[HtmlToBase64]   - Skipped images: ${stats.skippedImages}`)
      console.log(`[HtmlToBase64]   - Total CSS urls: ${stats.totalCssUrls}`)
      console.log(`[HtmlToBase64]   - Converted CSS urls: ${stats.convertedCssUrls}`)
      console.log(`[HtmlToBase64]   - Skipped CSS urls: ${stats.skippedCssUrls}`)
      console.log(`[HtmlToBase64]     • No src: ${stats.skippedReasons.noSrc}`)
      console.log(`[HtmlToBase64]     • Already base64: ${stats.skippedReasons.alreadyBase64}`)
      console.log(`[HtmlToBase64]     • HTTP/HTTPS URLs: ${stats.skippedReasons.httpUrls}`)
      console.log(`[HtmlToBase64]     • Conversion failed: ${stats.skippedReasons.conversionFailed}`)
      console.log(`[HtmlToBase64]   - Processing time: ${stats.processingTime}ms`)

      return {
        success: true,
        outputFile,
        stats
      }

    } catch (error) {
      console.error(`[HtmlToBase64] Conversion failed:`, error)
      stats.processingTime = Date.now() - startTime
      
      return {
        success: false,
        error: error.message,
        stats
      }
    }
  }

  /**
   * 解析图片路径（处理相对路径）
   * @param {string} src - img 标签的 src 属性值
   * @param {string} htmlFileDir - HTML 文件所在目录
   * @param {string} templateBasePath - 模板基础路径
   * @returns {string} 解析后的绝对路径
   */
  resolveImagePath(src, htmlFileDir, templateBasePath) {
    // 如果是绝对路径，直接返回
    if (path.isAbsolute(src)) {
      return src
    }

    // 处理相对路径
    if (src.startsWith('../')) {
      // 相对于 HTML 文件的路径
      return path.resolve(htmlFileDir, src)
    } else if (src.startsWith('./') || !src.includes('/')) {
      // 相对于 HTML 文件目录的路径
      return path.resolve(htmlFileDir, src)
    } else {
      // 尝试相对于模板路径解析
      if (templateBasePath) {
        const templateResolve = path.resolve(templateBasePath, src)
        return templateResolve
      } else {
        // 默认相对于 HTML 文件目录
        return path.resolve(htmlFileDir, src)
      }
    }
  }

  /**
   * 将图片文件转换为 base64 格式
   * @param {string} imagePath - 图片文件路径
   * @returns {Promise<string|null>} base64 数据 URL 或 null
   */
  async imageToBase64(imagePath) {
    try {
      // 检查文件是否存在
      const exists = await this.fileExists(imagePath)
      if (!exists) {
        console.warn(`[HtmlToBase64] Image file not found: ${imagePath}`)
        return null
      }

      // 检查文件格式
      const ext = path.extname(imagePath).toLowerCase().substring(1)
      if (!this.supportedFormats.includes(ext)) {
        console.warn(`[HtmlToBase64] Unsupported image format: ${ext}`)
        return null
      }

      // 读取文件
      const imageBuffer = await fs.readFile(imagePath)
      
      // SVG 文件特殊处理
      if (ext === 'svg') {
        const svgContent = imageBuffer.toString('utf-8')
        const base64 = Buffer.from(svgContent).toString('base64')
        return `data:image/svg+xml;base64,${base64}`
      }

      // 其他格式
      const mimeType = this.getMimeType(ext)
      const base64 = imageBuffer.toString('base64')
      
      console.log(`[HtmlToBase64] Converted ${path.basename(imagePath)} (${this.formatFileSize(imageBuffer.length)})`)
      
      return `data:${mimeType};base64,${base64}`
      
    } catch (error) {
      console.error(`[HtmlToBase64] Error converting image ${imagePath}:`, error.message)
      return null
    }
  }

  /**
   * 根据文件扩展名获取 MIME 类型
   * @param {string} ext - 文件扩展名（不含点）
   * @returns {string} MIME 类型
   */
  getMimeType(ext) {
    const mimeTypes = {
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'webp': 'image/webp',
      'bmp': 'image/bmp',
      'ico': 'image/x-icon'
    }
    
    return mimeTypes[ext] || 'image/png'
  }

  /**
   * 生成输出文件名
   * @param {string} htmlFilePath - 原始 HTML 文件路径
   * @returns {string} 输出文件路径
   */
  generateOutputFileName(htmlFilePath) {
    const dir = path.dirname(htmlFilePath)
    const basename = path.basename(htmlFilePath, '.html')
    return path.join(dir, `${basename}_with_base64.html`)
  }

  /**
   * 检查文件是否存在
   * @param {string} filePath - 文件路径
   * @returns {Promise<boolean>}
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
   * 格式化文件大小
   * @param {number} bytes - 字节数
   * @returns {string} 格式化的大小
   */
  formatFileSize(bytes) {
    if (bytes < 1024) return bytes + 'B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB'
    return (bytes / 1024 / 1024).toFixed(1) + 'MB'
  }

  /**
   * 处理CSS中的url()引用
   * @param {Document} document - DOM document对象
   * @param {string} htmlFileDir - HTML文件目录
   * @param {string} templateBasePath - 模板基础路径
   * @param {object} stats - 统计信息对象
   */
  async processCssUrls(document, htmlFileDir, templateBasePath, stats) {
    // 1. 处理<style>标签中的CSS
    const styleTags = document.querySelectorAll('style')
    for (const styleTag of styleTags) {
      if (styleTag.textContent) {
        const updatedCss = await this.processUrlsInCss(styleTag.textContent, htmlFileDir, templateBasePath, stats)
        styleTag.textContent = updatedCss
      }
    }

    // 2. 处理内联style属性中的CSS
    const elementsWithStyle = document.querySelectorAll('[style]')
    for (const element of elementsWithStyle) {
      const styleValue = element.getAttribute('style')
      if (styleValue) {
        const updatedStyle = await this.processUrlsInCss(styleValue, htmlFileDir, templateBasePath, stats)
        element.setAttribute('style', updatedStyle)
      }
    }

    console.log(`[HtmlToBase64] Processed CSS URLs: ${stats.totalCssUrls} found, ${stats.convertedCssUrls} converted, ${stats.skippedCssUrls} skipped`)
  }

  /**
   * 处理CSS字符串中的url()引用
   * @param {string} cssText - CSS文本
   * @param {string} htmlFileDir - HTML文件目录
   * @param {string} templateBasePath - 模板基础路径
   * @param {object} stats - 统计信息对象
   * @returns {Promise<string>} 处理后的CSS文本
   */
  async processUrlsInCss(cssText, htmlFileDir, templateBasePath, stats) {
    // 匹配CSS中的url()引用，支持单引号、双引号和无引号的情况
    const urlRegex = /url\(\s*(['"]?)([^'")\s]+)\1\s*\)/gi
    const matches = [...cssText.matchAll(urlRegex)]
    
    let updatedCss = cssText
    
    for (const match of matches) {
      const fullMatch = match[0]  // 完整的url()字符串
      const quote = match[1] || '' // 引号类型
      const url = match[2]        // URL路径
      
      stats.totalCssUrls++
      
      // 跳过HTTP/HTTPS URL
      if (url.startsWith('http://') || url.startsWith('https://')) {
        console.log(`[HtmlToBase64] Skipping CSS url: HTTP/HTTPS URL (${url})`)
        stats.skippedCssUrls++
        stats.skippedReasons.httpUrls++
        continue
      }
      
      // 跳过已经是base64的URL
      if (url.startsWith('data:')) {
        console.log(`[HtmlToBase64] Skipping CSS url: already base64 (${url.substring(0, 50)}...)`)
        stats.skippedCssUrls++
        stats.skippedReasons.alreadyBase64++
        continue
      }
      
      try {
        // 解析图片路径
        const imagePath = this.resolveImagePath(url, htmlFileDir, templateBasePath)
        console.log(`[HtmlToBase64] Processing CSS url: ${url} -> ${imagePath}`)
        
        // 转换为 base64
        const base64Data = await this.imageToBase64(imagePath)
        if (base64Data) {
          // 替换原始URL为base64数据
          const newUrl = `url(${quote}${base64Data}${quote})`
          updatedCss = updatedCss.replace(fullMatch, newUrl)
          stats.convertedCssUrls++
          console.log(`[HtmlToBase64] Successfully converted CSS url: ${url}`)
        } else {
          stats.skippedCssUrls++
          stats.skippedReasons.conversionFailed++
          stats.failedImages.push({ src: url, reason: 'Conversion failed' })
          console.warn(`[HtmlToBase64] Failed to convert CSS url: ${url}`)
        }
      } catch (error) {
        stats.skippedCssUrls++
        stats.skippedReasons.conversionFailed++
        stats.failedImages.push({ src: url, reason: error.message })
        console.error(`[HtmlToBase64] Error processing CSS url ${url}:`, error.message)
      }
    }
    
    return updatedCss
  }

  /**
   * 批量转换多个 HTML 文件
   * @param {string[]} htmlFilePaths - HTML 文件路径数组
   * @param {string} templateBasePath - 模板基础路径
   * @returns {Promise<object[]>} 转换结果数组
   */
  async convertMultipleFiles(htmlFilePaths, templateBasePath = null) {
    console.log(`[HtmlToBase64] Starting batch conversion of ${htmlFilePaths.length} files`)
    
    const results = []
    
    for (let i = 0; i < htmlFilePaths.length; i++) {
      const htmlFilePath = htmlFilePaths[i]
      console.log(`[HtmlToBase64] Processing file ${i + 1}/${htmlFilePaths.length}: ${htmlFilePath}`)
      
      const result = await this.convertHtmlToBase64(htmlFilePath, templateBasePath)
      results.push({
        inputFile: htmlFilePath,
        ...result
      })
    }
    
    console.log(`[HtmlToBase64] Batch conversion completed`)
    
    return results
  }
}

export default new HtmlToBase64Converter()
export { HtmlToBase64Converter }