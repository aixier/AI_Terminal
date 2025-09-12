/**
 * 资源转OSS URL转换器
 * 纯粹负责将本地图片上传到OSS并返回签名URL
 */

import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

// 动态导入OSSService
let OSSService
try {
  const ossModule = require('../services/oss/index.cjs')
  OSSService = ossModule.default || ossModule.OSSService || ossModule
} catch (error) {
  console.error('[ResourceToOSSUrlConverter] Failed to load OSSService:', error)
}

class ResourceToOSSUrlConverter {
  constructor() {
    // 初始化OSS服务
    if (OSSService) {
      this.ossService = new OSSService()
      console.log('[ResourceToOSSUrlConverter] OSS service initialized')
    } else {
      console.error('[ResourceToOSSUrlConverter] OSS service not available')
      this.ossService = null
    }
    
    // OSS路径前缀
    this.ossPathPrefix = 'pod2post/images/'
    
    // 缓存已上传的文件
    this.cache = new Map()
  }

  /**
   * 批量上传本地图片到OSS
   * @param {Array} localPaths - 本地图片路径数组
   * @param {Object} options - 配置选项
   * @returns {Promise<Object>} 包含Map和统计信息
   */
  async convertBatch(localPaths, options = {}) {
    const { username = 'default', taskId = '' } = options
    const resultMap = new Map()
    const stats = {
      total: localPaths.length,
      uploaded: 0,
      cached: 0,
      failed: 0,
      totalSize: 0,
      errors: []
    }

    if (!this.ossService) {
      console.error('[ResourceToOSSUrlConverter] OSS service not available')
      return { map: resultMap, stats }
    }

    console.log(`[ResourceToOSSUrlConverter] Starting batch upload of ${localPaths.length} files`)

    for (const localPath of localPaths) {
      try {
        const ossUrl = await this.uploadSingle(localPath, username, taskId, stats)
        if (ossUrl) {
          resultMap.set(localPath, ossUrl)
          stats.uploaded++
        } else {
          stats.failed++
        }
      } catch (error) {
        console.error(`[ResourceToOSSUrlConverter] Failed to upload ${localPath}:`, error.message)
        stats.failed++
        stats.errors.push({ path: localPath, error: error.message })
      }
    }

    // 打印统计信息
    this.logStats(stats)
    
    return { map: resultMap, stats }
  }

  /**
   * 上传单个文件到OSS
   * @param {string} filePath - 文件路径
   * @param {string} username - 用户名
   * @param {string} taskId - 任务ID
   * @param {Object} stats - 统计对象
   * @returns {Promise<string|null>} OSS签名URL
   */
  async uploadSingle(filePath, username = 'default', taskId = '', stats = {}) {
    // 检查缓存
    const cacheKey = `${filePath}_${username}_${taskId}`
    if (this.cache.has(cacheKey)) {
      console.log(`[ResourceToOSSUrlConverter] Using cached URL for: ${filePath}`)
      if (stats.cached !== undefined) stats.cached++
      return this.cache.get(cacheKey)
    }

    // 检查文件是否存在
    if (!await this.fileExists(filePath)) {
      console.warn(`[ResourceToOSSUrlConverter] File not found: ${filePath}`)
      return null
    }

    try {
      // 读取文件
      const buffer = await fs.readFile(filePath)
      
      // 更新统计
      if (stats.totalSize !== undefined) {
        stats.totalSize += buffer.length
      }

      // 生成OSS key
      const ossKey = this.generateOSSKey(filePath, username, taskId)
      
      // 获取MIME类型
      const mimeType = this.getMimeType(filePath)
      
      // 上传到OSS
      const uploadResult = await this.ossService.client.uploadBuffer(
        buffer,
        ossKey,
        {
          headers: {
            'Content-Type': mimeType,
            'Cache-Control': 'public, max-age=31536000'
          }
        }
      )
      
      if (!uploadResult || !uploadResult.success) {
        console.error('[ResourceToOSSUrlConverter] Upload failed')
        return null
      }
      
      // 生成签名URL（10年有效期）
      const signedUrlResult = await this.ossService.client.generateSignedUrl(
        ossKey,
        315360000, // 10年（秒）
        {
          'response-content-type': mimeType
        }
      )
      
      if (!signedUrlResult || !signedUrlResult.url) {
        console.error('[ResourceToOSSUrlConverter] Failed to generate signed URL')
        return null
      }
      
      const signedUrl = signedUrlResult.url
      
      // 缓存结果
      this.cache.set(cacheKey, signedUrl)
      
      console.log(`[ResourceToOSSUrlConverter] Uploaded: ${filePath} -> ${ossKey}`)
      
      return signedUrl
    } catch (error) {
      console.error(`[ResourceToOSSUrlConverter] Error uploading ${filePath}:`, error)
      throw error
    }
  }

  /**
   * 生成OSS key
   */
  generateOSSKey(filePath, username, taskId) {
    const fileName = path.basename(filePath)
    const timestamp = Date.now()
    const hash = crypto.createHash('md5').update(filePath).digest('hex').substring(0, 8)
    
    // 构建OSS路径
    const parts = [this.ossPathPrefix]
    
    if (username && username !== 'default') {
      parts.push(username)
    }
    
    if (taskId) {
      parts.push(taskId)
    }
    
    // 添加时间戳和哈希避免冲突
    const nameWithoutExt = path.basename(fileName, path.extname(fileName))
    const ext = path.extname(fileName)
    parts.push(`${nameWithoutExt}_${timestamp}_${hash}${ext}`)
    
    return parts.join('/')
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
   * 获取MIME类型
   */
  getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase().slice(1)
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
   * 格式化文件大小
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.cache.clear()
    console.log('[ResourceToOSSUrlConverter] Cache cleared')
  }

  /**
   * 记录统计信息
   */
  logStats(stats) {
    console.log('[ResourceToOSSUrlConverter] Upload completed:')
    console.log(`  - Total files: ${stats.total}`)
    console.log(`  - Uploaded: ${stats.uploaded}`)
    console.log(`  - Cached: ${stats.cached}`)
    console.log(`  - Failed: ${stats.failed}`)
    if (stats.totalSize > 0) {
      console.log(`  - Total size: ${this.formatFileSize(stats.totalSize)}`)
    }
    if (stats.errors && stats.errors.length > 0) {
      console.log('  - Errors:')
      stats.errors.slice(0, 5).forEach(err => {
        console.log(`    - ${err.path}: ${err.error}`)
      })
    }
  }

  /**
   * 上传HTML文件到OSS
   * @param {string} htmlFilePath - HTML文件路径
   * @param {string} username - 用户名
   * @param {string} taskId - 任务ID
   * @returns {Promise<Object>} 上传结果
   */
  async uploadHtmlFile(htmlFilePath, username = 'default', taskId = '') {
    if (!this.ossService) {
      return { success: false, error: 'OSS service not available' }
    }

    try {
      const htmlContent = await fs.readFile(htmlFilePath, 'utf-8')
      const htmlBuffer = Buffer.from(htmlContent, 'utf-8')
      
      const htmlFileName = path.basename(htmlFilePath)
      const htmlOssKey = `pod2post/html/${username}/${taskId}/${htmlFileName}`
      
      // 上传HTML
      const uploadResult = await this.ossService.client.uploadBuffer(
        htmlBuffer,
        htmlOssKey,
        {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=31536000'
          }
        }
      )
      
      if (!uploadResult || !uploadResult.success) {
        return { success: false, error: 'Upload failed' }
      }
      
      // 生成签名URL
      const signedUrlResult = await this.ossService.client.generateSignedUrl(
        htmlOssKey,
        315360000, // 10年
        {
          'response-content-type': 'text/html; charset=utf-8'
        }
      )
      
      if (!signedUrlResult || !signedUrlResult.url) {
        return { success: false, error: 'Failed to generate signed URL' }
      }
      
      console.log(`[ResourceToOSSUrlConverter] HTML uploaded: ${htmlOssKey}`)
      
      return {
        success: true,
        ossUrl: signedUrlResult.url,
        ossKey: htmlOssKey
      }
    } catch (error) {
      console.error('[ResourceToOSSUrlConverter] Failed to upload HTML:', error)
      return { success: false, error: error.message }
    }
  }
}

export default ResourceToOSSUrlConverter