/**
 * 资源转Base64转换器
 * 纯粹负责将本地图片文件转换为Base64 Data URL
 */

import fs from 'fs/promises'
import path from 'path'

class ResourceToBase64Converter {
  constructor() {
    // 支持的图片格式
    this.supportedFormats = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico']
    
    // 缓存已转换的文件，避免重复读取
    this.cache = new Map()
  }

  /**
   * 批量转换本地图片为Base64
   * @param {Array} localPaths - 本地图片路径数组
   * @returns {Promise<Map>} Map<localPath, base64DataUrl>
   */
  async convertBatch(localPaths) {
    const resultMap = new Map()
    const stats = {
      total: localPaths.length,
      converted: 0,
      cached: 0,
      failed: 0,
      totalSize: 0,
      errors: []
    }

    console.log(`[ResourceToBase64Converter] Starting batch conversion of ${localPaths.length} files`)

    for (const localPath of localPaths) {
      try {
        const base64Url = await this.convertSingle(localPath, stats)
        if (base64Url) {
          resultMap.set(localPath, base64Url)
          stats.converted++
        } else {
          stats.failed++
        }
      } catch (error) {
        console.error(`[ResourceToBase64Converter] Failed to convert ${localPath}:`, error.message)
        stats.failed++
        stats.errors.push({ path: localPath, error: error.message })
      }
    }

    // 打印统计信息
    this.logStats(stats)
    
    return { map: resultMap, stats }
  }

  /**
   * 转换单个文件为Base64
   * @param {string} filePath - 文件路径
   * @param {Object} stats - 统计对象
   * @returns {Promise<string|null>} Base64 Data URL
   */
  async convertSingle(filePath, stats = {}) {
    // 检查缓存
    if (this.cache.has(filePath)) {
      console.log(`[ResourceToBase64Converter] Using cached result for: ${filePath}`)
      if (stats.cached !== undefined) stats.cached++
      return this.cache.get(filePath)
    }

    // 检查文件是否存在
    if (!await this.fileExists(filePath)) {
      console.warn(`[ResourceToBase64Converter] File not found: ${filePath}`)
      return null
    }

    // 检查文件格式
    if (!this.isImageFile(filePath)) {
      console.warn(`[ResourceToBase64Converter] Unsupported format: ${filePath}`)
      return null
    }

    try {
      // 读取文件
      const buffer = await fs.readFile(filePath)
      
      // 更新统计
      if (stats.totalSize !== undefined) {
        stats.totalSize += buffer.length
      }

      // 获取MIME类型
      const mimeType = this.getMimeType(filePath)
      
      // 转换为Base64
      const base64Data = buffer.toString('base64')
      const dataUrl = `data:${mimeType};base64,${base64Data}`
      
      // 缓存结果
      this.cache.set(filePath, dataUrl)
      
      console.log(`[ResourceToBase64Converter] Converted: ${filePath} (${this.formatFileSize(buffer.length)})`)
      
      return dataUrl
    } catch (error) {
      console.error(`[ResourceToBase64Converter] Error converting ${filePath}:`, error)
      throw error
    }
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
   * 检查是否是支持的图片格式
   */
  isImageFile(filePath) {
    const ext = path.extname(filePath).toLowerCase().slice(1)
    return this.supportedFormats.includes(ext)
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
    console.log('[ResourceToBase64Converter] Cache cleared')
  }

  /**
   * 记录统计信息
   */
  logStats(stats) {
    console.log('[ResourceToBase64Converter] Conversion completed:')
    console.log(`  - Total files: ${stats.total}`)
    console.log(`  - Converted: ${stats.converted}`)
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
}

export default ResourceToBase64Converter