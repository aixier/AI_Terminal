/**
 * HTML处理工具
 * 专用于daily-knowledge-card-template.md模板的HTML文件下载和保存
 */

import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import https from 'https'
import http from 'http'
import { URL } from 'url'

/**
 * 下载文件的配置选项
 */
const DOWNLOAD_CONFIG = {
  timeout: 30000,        // 30秒超时
  maxFileSize: 50 * 1024 * 1024, // 50MB最大文件大小
  retryAttempts: 3,      // 重试次数
  retryDelay: 2000       // 重试延迟(毫秒)
}

/**
 * 延迟函数
 * @param {number} ms - 延迟毫秒数
 * @returns {Promise}
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 获取合适的HTTP/HTTPS模块
 * @param {string} url - 下载URL
 * @returns {Object} HTTP或HTTPS模块
 */
function getHttpModule(url) {
  return url.startsWith('https:') ? https : http
}

/**
 * 下载HTML文件
 * @param {string} downloadUrl - 下载URL
 * @param {string} outputPath - 输出文件路径
 * @param {Function} progressCallback - 进度回调函数
 * @returns {Promise<Object>} 下载结果
 */
async function downloadHtmlFile(downloadUrl, outputPath, progressCallback = null) {
  let attempt = 0
  let lastError = null

  while (attempt < DOWNLOAD_CONFIG.retryAttempts) {
    attempt++
    
    try {
      console.log(`[HtmlProcessor] Download attempt ${attempt}/${DOWNLOAD_CONFIG.retryAttempts}: ${downloadUrl}`)
      
      const result = await performDownload(downloadUrl, outputPath, progressCallback)
      
      console.log(`[HtmlProcessor] Download successful on attempt ${attempt}`)
      return {
        success: true,
        filePath: outputPath,
        fileSize: result.fileSize,
        downloadTime: result.downloadTime,
        attempt: attempt
      }
      
    } catch (error) {
      lastError = error
      console.warn(`[HtmlProcessor] Download attempt ${attempt} failed:`, error.message)
      
      // 如果不是最后一次尝试，等待后重试
      if (attempt < DOWNLOAD_CONFIG.retryAttempts) {
        console.log(`[HtmlProcessor] Waiting ${DOWNLOAD_CONFIG.retryDelay}ms before retry...`)
        await delay(DOWNLOAD_CONFIG.retryDelay)
      }
    }
  }

  // 所有尝试都失败了
  throw new Error(`Download failed after ${DOWNLOAD_CONFIG.retryAttempts} attempts. Last error: ${lastError.message}`)
}

/**
 * 执行单次下载
 * @param {string} downloadUrl - 下载URL  
 * @param {string} outputPath - 输出文件路径
 * @param {Function} progressCallback - 进度回调函数
 * @returns {Promise<Object>} 下载结果
 */
function performDownload(downloadUrl, outputPath, progressCallback) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    let fileSize = 0
    
    try {
      const parsedUrl = new URL(downloadUrl)
      const httpModule = getHttpModule(downloadUrl)
      
      const request = httpModule.get(downloadUrl, { timeout: DOWNLOAD_CONFIG.timeout }, (response) => {
        // 处理重定向
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          console.log(`[HtmlProcessor] Redirecting to: ${response.headers.location}`)
          // 递归处理重定向
          performDownload(response.headers.location, outputPath, progressCallback)
            .then(resolve)
            .catch(reject)
          return
        }

        // 检查响应状态
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`))
          return
        }

        // 检查内容类型
        const contentType = response.headers['content-type'] || ''
        if (!contentType.includes('text/html') && !contentType.includes('application/octet-stream')) {
          console.warn(`[HtmlProcessor] Unexpected content type: ${contentType}`)
        }

        // 检查文件大小
        const contentLength = parseInt(response.headers['content-length'] || '0')
        if (contentLength > DOWNLOAD_CONFIG.maxFileSize) {
          reject(new Error(`File too large: ${contentLength} bytes (max: ${DOWNLOAD_CONFIG.maxFileSize})`))
          return
        }

        console.log(`[HtmlProcessor] Starting download, content-length: ${contentLength} bytes`)

        // 创建写入流
        const writeStream = fsSync.createWriteStream(outputPath)
        let downloadedBytes = 0

        // 处理数据流
        response.on('data', (chunk) => {
          downloadedBytes += chunk.length
          fileSize += chunk.length
          
          // 检查大小限制
          if (downloadedBytes > DOWNLOAD_CONFIG.maxFileSize) {
            writeStream.destroy()
            reject(new Error(`Download exceeded size limit: ${downloadedBytes} bytes`))
            return
          }

          writeStream.write(chunk)
          
          // 进度回调
          if (progressCallback && contentLength > 0) {
            const progress = (downloadedBytes / contentLength) * 100
            progressCallback(Math.round(progress))
          }
        })

        // 下载完成
        response.on('end', () => {
          writeStream.end()
          const downloadTime = Date.now() - startTime
          
          console.log(`[HtmlProcessor] Download completed: ${fileSize} bytes in ${downloadTime}ms`)
          resolve({
            fileSize,
            downloadTime
          })
        })

        // 处理错误
        response.on('error', (error) => {
          writeStream.destroy()
          reject(error)
        })

        writeStream.on('error', (error) => {
          reject(error)
        })
      })

      // 请求超时处理
      request.on('timeout', () => {
        request.destroy()
        reject(new Error(`Download timeout after ${DOWNLOAD_CONFIG.timeout}ms`))
      })

      // 请求错误处理
      request.on('error', (error) => {
        reject(error)
      })

    } catch (error) {
      reject(error)
    }
  })
}

/**
 * 验证HTML文件内容
 * @param {string} filePath - 文件路径
 * @returns {Promise<Object>} 验证结果
 */
async function validateHtmlFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    
    const validation = {
      isValid: false,
      fileSize: content.length,
      hasHtmlTag: false,
      hasHeadTag: false,
      hasBodyTag: false,
      title: null,
      encoding: 'utf-8',
      issues: []
    }

    // 基本HTML结构检查
    validation.hasHtmlTag = content.includes('<html')
    validation.hasHeadTag = content.includes('<head')
    validation.hasBodyTag = content.includes('<body')

    // 提取标题
    const titleMatch = content.match(/<title[^>]*>([^<]*)<\/title>/i)
    if (titleMatch) {
      validation.title = titleMatch[1].trim()
    }

    // 检查编码
    if (content.includes('charset=')) {
      const charsetMatch = content.match(/charset=([^"'\s>]+)/i)
      if (charsetMatch) {
        validation.encoding = charsetMatch[1].toLowerCase()
      }
    }

    // 验证基本结构
    if (!validation.hasHtmlTag) {
      validation.issues.push('Missing <html> tag')
    }
    if (!validation.hasHeadTag) {
      validation.issues.push('Missing <head> section')
    }
    if (!validation.hasBodyTag) {
      validation.issues.push('Missing <body> section')
    }

    // 检查最小内容
    if (content.length < 100) {
      validation.issues.push('File content too small')
    }

    // 检查是否为错误页面
    if (content.toLowerCase().includes('404') || content.toLowerCase().includes('not found')) {
      validation.issues.push('Appears to be a 404 error page')
    }

    validation.isValid = validation.issues.length === 0
    
    console.log(`[HtmlProcessor] HTML validation result:`, validation)
    return validation

  } catch (error) {
    console.error(`[HtmlProcessor] Failed to validate HTML file:`, error)
    return {
      isValid: false,
      error: error.message,
      issues: ['Failed to read or parse file']
    }
  }
}

/**
 * 生成HTML文件名
 * @param {string} baseName - 基础名称（通常是主题名）
 * @returns {string} HTML文件名
 */
function generateHtmlFileName(baseName) {
  // 清理文件名，移除特殊字符
  const cleanName = baseName
    .replace(/[<>:"/\\|?*]/g, '_')  // 替换不合法字符
    .replace(/\s+/g, '-')          // 空格替换为连字符
    .substring(0, 100)             // 限制长度

  return `${cleanName}.html`
}

/**
 * 确保目录存在
 * @param {string} dirPath - 目录路径
 */
async function ensureDirectory(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true })
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error
    }
  }
}

/**
 * 从directDownloadUrl下载并保存HTML文件
 * @param {string} downloadUrl - 下载URL
 * @param {string} outputDir - 输出目录
 * @param {string} baseName - 基础文件名
 * @param {Function} progressCallback - 进度回调
 * @returns {Promise<Object>} 处理结果
 */
export async function downloadAndSaveHtml(downloadUrl, outputDir, baseName, progressCallback = null) {
  try {
    console.log(`[HtmlProcessor] Starting HTML download from: ${downloadUrl}`)
    
    // 确保输出目录存在
    await ensureDirectory(outputDir)
    
    // 生成文件名和路径
    const fileName = generateHtmlFileName(baseName)
    const outputPath = path.join(outputDir, fileName)
    
    console.log(`[HtmlProcessor] Saving to: ${outputPath}`)
    
    // 下载文件
    const downloadResult = await downloadHtmlFile(downloadUrl, outputPath, progressCallback)
    
    // 验证下载的文件
    const validation = await validateHtmlFile(outputPath)
    
    if (!validation.isValid) {
      console.warn(`[HtmlProcessor] HTML validation issues:`, validation.issues)
    }
    
    const result = {
      success: true,
      fileName,
      filePath: outputPath,
      fileSize: downloadResult.fileSize,
      downloadTime: downloadResult.downloadTime,
      attempts: downloadResult.attempt,
      validation,
      downloadUrl
    }
    
    console.log(`[HtmlProcessor] HTML processing completed:`, result)
    return result
    
  } catch (error) {
    console.error(`[HtmlProcessor] HTML download failed:`, error)
    
    return {
      success: false,
      error: error.message,
      downloadUrl
    }
  }
}

/**
 * 清理临时文件
 * @param {string} filePath - 文件路径
 */
export async function cleanupFile(filePath) {
  try {
    await fs.unlink(filePath)
    console.log(`[HtmlProcessor] Cleaned up file: ${filePath}`)
  } catch (error) {
    console.warn(`[HtmlProcessor] Failed to cleanup file ${filePath}:`, error.message)
  }
}

export default {
  downloadAndSaveHtml,
  validateHtmlFile,
  generateHtmlFileName,
  cleanupFile,
  DOWNLOAD_CONFIG
}