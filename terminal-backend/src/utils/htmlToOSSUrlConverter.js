import fs from 'fs/promises'
import path from 'path'
import { JSDOM } from 'jsdom'
import { createRequire } from 'module'
import crypto from 'crypto'

const require = createRequire(import.meta.url)
let OSSService
try {
  const ossModule = require('../services/oss/index.cjs')
  OSSService = ossModule.OSSService
} catch (error) {
  console.warn('[HtmlToOSSUrl] OSS service not available:', error.message)
  OSSService = null
}

/**
 * HTML 图片转 OSS URL 转换器
 * 将 HTML 文件中的所有本地图片上传到 OSS 并替换为永久访问链接
 * 相比 Base64 转换器，这种方式可以大幅减小 HTML 文件体积
 */
class HtmlToOSSUrlConverter {
  constructor() {
    // 支持的图片格式
    this.supportedFormats = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico']
    
    // OSS服务实例
    try {
      this.ossService = OSSService ? new OSSService('ai-terminal') : null
    } catch (error) {
      console.warn('[HtmlToOSSUrl] Failed to initialize OSS service:', error.message)
      this.ossService = null
    }
    
    // 缓存已上传的图片，避免重复上传
    this.uploadedCache = new Map() // key: 本地路径, value: OSS URL
  }

  /**
   * 转换 HTML 文件中的所有图片为 OSS URL
   * @param {string} htmlFilePath - HTML 文件的绝对路径
   * @param {string} templateBasePath - 模板文件的基础路径（用于解析相对路径）
   * @param {string} username - 用户名（用于 OSS 路径组织）
   * @param {string} taskId - 任务ID（用于 OSS 路径组织）
   * @returns {Promise<{success: boolean, outputFile?: string, stats?: object, error?: string}>}
   */
  async convertHtmlToOSSUrl(htmlFilePath, templateBasePath = null, username = 'default', taskId = null) {
    const startTime = Date.now()
    const stats = {
      totalImages: 0,
      uploadedImages: 0,
      skippedImages: 0,
      cachedImages: 0,
      totalCssUrls: 0,
      uploadedCssUrls: 0,
      skippedCssUrls: 0,
      skippedReasons: {
        noSrc: 0,
        alreadyOSS: 0,
        httpUrls: 0,
        uploadFailed: 0
      },
      failedImages: [],
      uploadedFiles: [], // 记录所有上传的文件信息
      totalUploadSize: 0, // 总上传大小
      processingTime: 0
    }

    try {
      console.log(`[HtmlToOSSUrl] Starting conversion: ${htmlFilePath}`)
      console.log(`[HtmlToOSSUrl] Template base path: ${templateBasePath}`)
      console.log(`[HtmlToOSSUrl] Username: ${username}, TaskId: ${taskId}`)

      // 1. 检查输入文件是否存在
      const htmlExists = await this.fileExists(htmlFilePath)
      if (!htmlExists) {
        throw new Error(`HTML file does not exist: ${htmlFilePath}`)
      }

      // 2. 读取 HTML 文件
      const htmlContent = await fs.readFile(htmlFilePath, 'utf-8')
      console.log(`[HtmlToOSSUrl] HTML file read successfully (${htmlContent.length} chars)`)

      // 3. 解析 HTML
      const dom = new JSDOM(htmlContent)
      const document = dom.window.document
      const imgTags = document.querySelectorAll('img')
      
      stats.totalImages = imgTags.length
      console.log(`[HtmlToOSSUrl] Found ${stats.totalImages} img tags`)

      if (stats.totalImages === 0) {
        console.log(`[HtmlToOSSUrl] No images found, saving original HTML with _ossurl suffix`)
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
        
        // 跳过无效或已处理的图片
        if (!src) {
          console.log(`[HtmlToOSSUrl] Skipping img ${i + 1}: no src attribute`)
          stats.skippedImages++
          stats.skippedReasons.noSrc++
          continue
        }
        
        // 跳过已经是OSS链接的图片
        if (src.includes('.aliyuncs.com') || src.includes('oss-')) {
          console.log(`[HtmlToOSSUrl] Skipping img ${i + 1}: already OSS URL`)
          stats.skippedImages++
          stats.skippedReasons.alreadyOSS++
          continue
        }
        
        // 跳过外部HTTP/HTTPS链接（非OSS）
        if ((src.startsWith('http://') || src.startsWith('https://')) && 
            !src.includes('.aliyuncs.com')) {
          console.log(`[HtmlToOSSUrl] Skipping img ${i + 1}: external HTTP/HTTPS URL`)
          stats.skippedImages++
          stats.skippedReasons.httpUrls++
          continue
        }

        // 跳过base64图片（可选：也可以将base64转为文件上传）
        if (src.startsWith('data:')) {
          console.log(`[HtmlToOSSUrl] Skipping img ${i + 1}: base64 data URL`)
          stats.skippedImages++
          stats.skippedReasons.httpUrls++
          continue
        }

        try {
          // 解析图片路径
          const imagePath = await this.resolveImagePath(src, htmlFileDir, templateBasePath)
          console.log(`[HtmlToOSSUrl] Processing img ${i + 1}: ${src} -> ${imagePath}`)

          // 上传到 OSS 并获取 URL
          const ossUrl = await this.uploadImageToOSS(imagePath, username, taskId, stats)
          if (ossUrl) {
            img.setAttribute('src', ossUrl)
            stats.uploadedImages++
            console.log(`[HtmlToOSSUrl] Successfully uploaded img ${i + 1}: ${ossUrl.substring(0, 80)}...`)
          } else {
            stats.skippedImages++
            stats.skippedReasons.uploadFailed++
            stats.failedImages.push({ src, reason: 'Upload failed' })
            console.warn(`[HtmlToOSSUrl] Failed to upload img ${i + 1}: ${src}`)
          }
        } catch (error) {
          stats.skippedImages++
          stats.skippedReasons.uploadFailed++
          stats.failedImages.push({ src, reason: error.message })
          console.error(`[HtmlToOSSUrl] Error processing img ${i + 1}:`, error.message)
        }
      }

      // 5. 处理CSS中的url()引用
      await this.processCssUrls(document, htmlFileDir, templateBasePath, username, taskId, stats)

      // 6. 生成输出文件
      const modifiedHtml = dom.serialize()
      const outputFile = this.generateOutputFileName(htmlFilePath)
      
      await fs.writeFile(outputFile, modifiedHtml)
      console.log(`[HtmlToOSSUrl] Output file saved: ${outputFile}`)

      // 7. 统计结果
      stats.processingTime = Date.now() - startTime
      
      console.log(`[HtmlToOSSUrl] Conversion completed:`)
      console.log(`[HtmlToOSSUrl]   - Total images: ${stats.totalImages}`)
      console.log(`[HtmlToOSSUrl]   - Uploaded images: ${stats.uploadedImages}`)
      console.log(`[HtmlToOSSUrl]   - Cached images: ${stats.cachedImages}`)
      console.log(`[HtmlToOSSUrl]   - Skipped images: ${stats.skippedImages}`)
      console.log(`[HtmlToOSSUrl]   - Total CSS urls: ${stats.totalCssUrls}`)
      console.log(`[HtmlToOSSUrl]   - Uploaded CSS urls: ${stats.uploadedCssUrls}`)
      console.log(`[HtmlToOSSUrl]   - Total upload size: ${this.formatFileSize(stats.totalUploadSize)}`)
      console.log(`[HtmlToOSSUrl]   - Processing time: ${stats.processingTime}ms`)

      // 清理缓存
      this.uploadedCache.clear()

      return {
        success: true,
        outputFile,
        stats
      }

    } catch (error) {
      console.error(`[HtmlToOSSUrl] Conversion failed:`, error)
      stats.processingTime = Date.now() - startTime
      
      // 清理缓存
      this.uploadedCache.clear()
      
      return {
        success: false,
        error: error.message,
        stats
      }
    }
  }

  /**
   * 上传图片到 OSS 并返回永久访问 URL
   * @param {string} imagePath - 本地图片路径
   * @param {string} username - 用户名
   * @param {string} taskId - 任务ID
   * @param {object} stats - 统计信息对象
   * @returns {Promise<string|null>} OSS URL 或 null
   */
  async uploadImageToOSS(imagePath, username, taskId, stats) {
    try {
      // 如果OSS服务不可用，返回null（用于测试）
      if (!this.ossService) {
        console.warn(`[HtmlToOSSUrl] OSS service not available, skipping upload for: ${imagePath}`)
        return null
      }
      
      // 检查缓存
      if (this.uploadedCache.has(imagePath)) {
        console.log(`[HtmlToOSSUrl] Using cached OSS URL for: ${path.basename(imagePath)}`)
        stats.cachedImages++
        return this.uploadedCache.get(imagePath)
      }

      // 检查文件是否存在
      const exists = await this.fileExists(imagePath)
      if (!exists) {
        console.warn(`[HtmlToOSSUrl] Image file not found: ${imagePath}`)
        return null
      }

      // 读取文件
      const imageBuffer = await fs.readFile(imagePath)
      const fileSize = imageBuffer.length
      const fileName = path.basename(imagePath)
      const ext = path.extname(fileName).toLowerCase().substring(1)

      // 检查文件格式
      if (!this.supportedFormats.includes(ext)) {
        console.warn(`[HtmlToOSSUrl] Unsupported image format: ${ext}`)
        return null
      }

      // 生成 OSS 键名（使用 MD5 避免文件名冲突）
      const fileHash = crypto.createHash('md5').update(imageBuffer).digest('hex')
      const ossFileName = `${fileHash}_${fileName}`
      const ossKey = taskId 
        ? `pod2post/${username}/${taskId}/assets/${ossFileName}`
        : `pod2post/${username}/assets/${ossFileName}`

      console.log(`[HtmlToOSSUrl] Uploading ${fileName} (${this.formatFileSize(fileSize)}) to OSS...`)

      // 上传到 OSS
      const mimeType = this.getMimeType(ext)
      const uploadResult = await this.ossService.client.uploadBuffer(imageBuffer, ossKey, {
        headers: {
          'Content-Type': mimeType,
          'Cache-Control': 'public, max-age=31536000', // 1年缓存
          'Content-Disposition': `inline; filename="${encodeURIComponent(fileName)}"`
        }
      })

      if (uploadResult.success) {
        // 生成签名URL，有效期设置为10年（永久访问）
        const signedUrlResult = await this.ossService.client.generateSignedUrl(
          ossKey,
          315360000, // 10年的秒数
          {
            'response-content-type': mimeType
          }
        )
        
        if (!signedUrlResult.success) {
          console.error(`[HtmlToOSSUrl] Failed to generate signed URL for ${ossKey}`)
          return null
        }
        
        const ossUrl = signedUrlResult.url
        
        // 缓存结果
        this.uploadedCache.set(imagePath, ossUrl)
        
        // 更新统计
        stats.totalUploadSize += fileSize
        stats.uploadedFiles.push({
          localPath: imagePath,
          fileName: fileName,
          fileSize: fileSize,
          ossKey: ossKey,
          ossUrl: ossUrl
        })
        
        console.log(`[HtmlToOSSUrl] Upload successful with signed URL: ${ossUrl.substring(0, 80)}...`)
        return ossUrl
      } else {
        console.error(`[HtmlToOSSUrl] Upload failed:`, uploadResult.error)
        return null
      }

    } catch (error) {
      console.error(`[HtmlToOSSUrl] Error uploading image ${imagePath}:`, error.message)
      return null
    }
  }

  /**
   * 处理CSS中的url()引用
   * @param {Document} document - DOM document对象
   * @param {string} htmlFileDir - HTML文件目录
   * @param {string} templateBasePath - 模板基础路径
   * @param {string} username - 用户名
   * @param {string} taskId - 任务ID
   * @param {object} stats - 统计信息对象
   */
  async processCssUrls(document, htmlFileDir, templateBasePath, username, taskId, stats) {
    // 1. 处理<style>标签中的CSS
    const styleTags = document.querySelectorAll('style')
    for (const styleTag of styleTags) {
      if (styleTag.textContent) {
        const updatedCss = await this.processUrlsInCss(
          styleTag.textContent, 
          htmlFileDir, 
          templateBasePath, 
          username, 
          taskId, 
          stats
        )
        styleTag.textContent = updatedCss
      }
    }

    // 2. 处理内联style属性中的CSS
    const elementsWithStyle = document.querySelectorAll('[style]')
    for (const element of elementsWithStyle) {
      const styleValue = element.getAttribute('style')
      if (styleValue) {
        const updatedStyle = await this.processUrlsInCss(
          styleValue, 
          htmlFileDir, 
          templateBasePath, 
          username, 
          taskId, 
          stats
        )
        element.setAttribute('style', updatedStyle)
      }
    }

    console.log(`[HtmlToOSSUrl] Processed CSS URLs: ${stats.totalCssUrls} found, ${stats.uploadedCssUrls} uploaded`)
  }

  /**
   * 处理CSS字符串中的url()引用
   * @param {string} cssText - CSS文本
   * @param {string} htmlFileDir - HTML文件目录
   * @param {string} templateBasePath - 模板基础路径
   * @param {string} username - 用户名
   * @param {string} taskId - 任务ID
   * @param {object} stats - 统计信息对象
   * @returns {Promise<string>} 处理后的CSS文本
   */
  async processUrlsInCss(cssText, htmlFileDir, templateBasePath, username, taskId, stats) {
    const urlRegex = /url\(\s*(['"]?)([^'")\s]+)\1\s*\)/gi
    const matches = [...cssText.matchAll(urlRegex)]
    
    let updatedCss = cssText
    
    for (const match of matches) {
      const fullMatch = match[0]
      const quote = match[1] || ''
      const url = match[2]
      
      stats.totalCssUrls++
      
      // 跳过已经是OSS URL
      if (url.includes('.aliyuncs.com')) {
        stats.skippedCssUrls++
        continue
      }
      
      // 跳过外部HTTP/HTTPS URL
      if ((url.startsWith('http://') || url.startsWith('https://')) && 
          !url.includes('.aliyuncs.com')) {
        stats.skippedCssUrls++
        continue
      }
      
      // 跳过base64 URL
      if (url.startsWith('data:')) {
        stats.skippedCssUrls++
        continue
      }
      
      try {
        // 解析图片路径
        const imagePath = await this.resolveImagePath(url, htmlFileDir, templateBasePath)
        
        // 上传到 OSS
        const ossUrl = await this.uploadImageToOSS(imagePath, username, taskId, stats)
        if (ossUrl) {
          const newUrl = `url(${quote}${ossUrl}${quote})`
          updatedCss = updatedCss.replace(fullMatch, newUrl)
          stats.uploadedCssUrls++
          console.log(`[HtmlToOSSUrl] Successfully uploaded CSS url: ${url}`)
        } else {
          stats.skippedCssUrls++
        }
      } catch (error) {
        stats.skippedCssUrls++
        console.error(`[HtmlToOSSUrl] Error processing CSS url ${url}:`, error.message)
      }
    }
    
    return updatedCss
  }

  /**
   * 解析图片路径（处理绝对路径和相对路径）
   * 增强版：处理各种路径格式
   */
  async resolveImagePath(src, htmlFileDir, templateBasePath) {
    console.log(`[HtmlToOSSUrl] Resolving image path: ${src}`)
    console.log(`[HtmlToOSSUrl] HTML dir: ${htmlFileDir}`)
    console.log(`[HtmlToOSSUrl] Template base: ${templateBasePath}`)
    
    // 处理绝对路径
    if (path.isAbsolute(src)) {
      // 1. 先尝试直接访问
      const exists = await this.fileExists(src)
      if (exists) {
        console.log(`[HtmlToOSSUrl] Found at absolute path: ${src}`)
        return src
      }
      
      // 2. 对于 /app/data/users/... 这种路径，转换为实际的本地路径
      // 这种路径通常是在Docker容器内的路径，需要映射到本地
      if (src.startsWith('/app/data/users/')) {
        // 将 /app/data/users/ 替换为实际的本地路径
        // 例如：/app/data/users/default/workspace/... -> /mnt/d/work/AI_Terminal/terminal-backend/data/users/default/workspace/...
        const localPath = src.replace('/app/data/users/', '/mnt/d/work/AI_Terminal/terminal-backend/data/users/')
        console.log(`[HtmlToOSSUrl] Trying mapped local path: ${localPath}`)
        if (await this.fileExists(localPath)) {
          console.log(`[HtmlToOSSUrl] Found at mapped path: ${localPath}`)
          return localPath
        }
        
        // 也可能在terminal-backend目录外
        const alternativePath = src.replace('/app/data/users/', '/mnt/d/work/AI_Terminal/data/users/')
        console.log(`[HtmlToOSSUrl] Trying alternative path: ${alternativePath}`)
        if (await this.fileExists(alternativePath)) {
          console.log(`[HtmlToOSSUrl] Found at alternative path: ${alternativePath}`)
          return alternativePath
        }
      }
      
      // 3. 如果文件不存在，可能需要修复中文文件名
      const fixedPath = await this.fixChineseFilename(src)
      if (await this.fileExists(fixedPath)) {
        console.log(`[HtmlToOSSUrl] Found after fixing Chinese: ${fixedPath}`)
        return fixedPath
      }
      
      // 4. 尝试相对于模板路径解析
      if (templateBasePath && src.includes('/templates/pod2post/')) {
        const relativePart = src.split('/templates/pod2post/')[1]
        if (relativePart) {
          const resolvedPath = path.join(templateBasePath, relativePart)
          console.log(`[HtmlToOSSUrl] Trying template relative: ${resolvedPath}`)
          if (await this.fileExists(resolvedPath)) {
            console.log(`[HtmlToOSSUrl] Found at template path: ${resolvedPath}`)
            return resolvedPath
          }
        }
      }
      
      // 5. 尝试从workspace路径解析
      if (src.includes('/workspace/')) {
        const workspacePart = src.split('/workspace/')[1]
        if (workspacePart) {
          // 尝试多个可能的基础路径
          const possibleBases = [
            '/mnt/d/work/AI_Terminal/terminal-backend/data/users/default',
            '/mnt/d/work/AI_Terminal/data/users/default',
            path.dirname(htmlFileDir),
            path.dirname(path.dirname(htmlFileDir))
          ]
          
          for (const base of possibleBases) {
            const workspacePath = path.join(base, 'workspace', workspacePart)
            console.log(`[HtmlToOSSUrl] Trying workspace path: ${workspacePath}`)
            if (await this.fileExists(workspacePath)) {
              console.log(`[HtmlToOSSUrl] Found via workspace: ${workspacePath}`)
              return workspacePath
            }
          }
        }
      }
      
      console.warn(`[HtmlToOSSUrl] Could not resolve absolute path: ${src}`)
      return src
    }
    
    // 处理相对路径
    if (src.startsWith('../')) {
      const resolved = path.resolve(htmlFileDir, src)
      console.log(`[HtmlToOSSUrl] Resolved ../ path to: ${resolved}`)
      return resolved
    } else if (src.startsWith('./')) {
      const resolved = path.resolve(htmlFileDir, src.substring(2))
      console.log(`[HtmlToOSSUrl] Resolved ./ path to: ${resolved}`)
      return resolved
    } else if (!src.includes('/')) {
      // 单个文件名，相对于HTML文件目录
      const resolved = path.resolve(htmlFileDir, src)
      console.log(`[HtmlToOSSUrl] Resolved filename to: ${resolved}`)
      return resolved
    } else {
      // 其他情况，尝试相对于模板路径解析
      if (templateBasePath) {
        const templateResolved = path.resolve(templateBasePath, src)
        if (await this.fileExists(templateResolved)) {
          console.log(`[HtmlToOSSUrl] Found at template path: ${templateResolved}`)
          return templateResolved
        }
      }
      
      // 默认相对于HTML文件目录
      const resolved = path.resolve(htmlFileDir, src)
      console.log(`[HtmlToOSSUrl] Default resolved to: ${resolved}`)
      return resolved
    }
  }

  /**
   * 修复中文文件名编码问题
   * 继承自 htmlToBase64Converter
   */
  async fixChineseFilename(filePath) {
    try {
      const dir = path.dirname(filePath)
      const basename = path.basename(filePath)
      
      if (!/[\u4e00-\u9fff]/.test(basename)) {
        return filePath
      }
      
      const candidates = [
        filePath,
        path.join(dir, Buffer.from(basename, 'utf8').toString('latin1')),
        path.join(dir, encodeURIComponent(basename)),
        path.join(dir, decodeURIComponent(basename))
      ]
      
      for (const candidate of candidates) {
        if (await this.fileExists(candidate)) {
          return candidate
        }
      }
      
      return filePath
      
    } catch (error) {
      console.warn(`[HtmlToOSSUrl] Error fixing Chinese filename: ${error.message}`)
      return filePath
    }
  }

  /**
   * 根据文件扩展名获取 MIME 类型
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
    
    return mimeTypes[ext] || 'application/octet-stream'
  }

  /**
   * 生成输出文件名
   */
  generateOutputFileName(htmlFilePath) {
    const dir = path.dirname(htmlFilePath)
    const basename = path.basename(htmlFilePath, '.html')
    return path.join(dir, `${basename}_ossurl.html`)
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
   * 格式化文件大小
   */
  formatFileSize(bytes) {
    if (bytes < 1024) return bytes + 'B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB'
    return (bytes / 1024 / 1024).toFixed(1) + 'MB'
  }

  /**
   * 批量转换多个 HTML 文件
   */
  async convertMultipleFiles(htmlFilePaths, templateBasePath = null, username = 'default', taskId = null) {
    console.log(`[HtmlToOSSUrl] Starting batch conversion of ${htmlFilePaths.length} files`)
    
    const results = []
    
    for (let i = 0; i < htmlFilePaths.length; i++) {
      const htmlFilePath = htmlFilePaths[i]
      console.log(`[HtmlToOSSUrl] Processing file ${i + 1}/${htmlFilePaths.length}: ${htmlFilePath}`)
      
      const result = await this.convertHtmlToOSSUrl(htmlFilePath, templateBasePath, username, taskId)
      results.push({
        inputFile: htmlFilePath,
        ...result
      })
    }
    
    console.log(`[HtmlToOSSUrl] Batch conversion completed`)
    
    return results
  }
}

export default new HtmlToOSSUrlConverter()
export { HtmlToOSSUrlConverter }