import fs from 'fs/promises'
import path from 'path'
import { OSSService } from '../services/oss/index.cjs'

/**
 * 资源上传器
 * 负责扫描和上传媒体资源到OSS
 */
class ResourceUploader {
  constructor() {
    // 初始化OSS服务，使用custom-template配置
    try {
      this.oss = new OSSService('default')
      console.log('[ResourceUploader] OSS service initialized')
    } catch (error) {
      console.error('[ResourceUploader] Failed to initialize OSS:', error)
      this.oss = null
    }
  }
  
  /**
   * 批量上传资源
   * @param {string} templateDir - 模板目录
   * @param {string} taskId - 任务ID，用于OSS路径
   * @returns {Promise<Array>} 资源映射表
   */
  async uploadResources(templateDir, taskId) {
    console.log(`[ResourceUploader] Starting resource upload for ${templateDir}`)
    
    if (!this.oss) {
      console.warn('[ResourceUploader] OSS not initialized, skipping upload')
      return []
    }
    
    // 扫描媒体文件
    const mediaFiles = await this.scanMediaFiles(templateDir)
    console.log(`[ResourceUploader] Found ${mediaFiles.length} media files`)
    
    if (mediaFiles.length === 0) {
      return []
    }
    
    const mapping = []
    const batchSize = 5 // 并发上传数量
    
    // 批量上传，控制并发
    for (let i = 0; i < mediaFiles.length; i += batchSize) {
      const batch = mediaFiles.slice(i, i + batchSize)
      console.log(`[ResourceUploader] Uploading batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(mediaFiles.length/batchSize)}`)
      
      const results = await Promise.all(
        batch.map(async (file) => {
          // 重试上传
          return await this.uploadWithRetry(file, taskId, 3)
        })
      )
      
      // 过滤掉失败的上传
      mapping.push(...results.filter(r => r !== null))
    }
    
    console.log(`[ResourceUploader] Successfully uploaded ${mapping.length}/${mediaFiles.length} files`)
    return mapping
  }
  
  /**
   * 带重试的上传方法
   * @param {Object} file - 文件信息
   * @param {string} taskId - 任务ID
   * @param {number} maxRetries - 最大重试次数
   * @returns {Promise<Object|null>} 上传结果
   */
  async uploadWithRetry(file, taskId, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // 构建OSS路径
        const ossPath = `custom-template/${taskId}/${file.relativePath}`
        
        console.log(`[ResourceUploader] 上传尝试 ${attempt}/${maxRetries}: ${file.relativePath}`)
        
        // 上传文件
        const result = await this.oss.upload(file.fullPath, {
          remotePath: ossPath,
          headers: {
            'Cache-Control': 'public, max-age=31536000',
            'Content-Disposition': 'inline'
          }
        })
        
        console.log(`[ResourceUploader] 上传成功: ${file.relativePath} -> ${result.url || ossPath}`)
        
        return {
          localPath: file.relativePath,
          fullPath: file.fullPath,
          ossUrl: result.url || `https://oss.aliyuncs.com/${ossPath}`,
          ossPath: ossPath
        }
      } catch (error) {
        console.error(`[ResourceUploader] 上传失败 (尝试 ${attempt}/${maxRetries}): ${error.message}`)
        
        // 如果是最后一次重试，返回null
        if (attempt === maxRetries) {
          console.error(`[ResourceUploader] ${file.relativePath} 最终上传失败，已达最大重试次数`)
          return null
        }
        
        // 等待一段时间后重试
        const delay = attempt * 2000 // 递增延迟：2s, 4s, 6s
        console.log(`[ResourceUploader] ${delay}ms 后重试...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    
    return null
  }
  
  /**
   * 高级重试上传方法（用于batchUploadToOSS）
   * @param {Object} file - 文件信息
   * @param {string} prefix - OSS路径前缀
   * @param {number} maxRetries - 最大重试次数
   * @returns {Promise<Object>} 上传结果（包含详细信息）
   */
  async uploadWithRetryAdvanced(file, prefix, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // 构建OSS路径
        const ossPath = `${prefix}${file.relativePath}`
        
        console.log(`[ResourceUploader] OSS上传尝试 ${attempt}/${maxRetries}: ${file.relativePath}`)
        
        // 获取文件统计信息
        const stats = await fs.stat(file.fullPath)
        
        // 上传文件
        const uploadResult = await this.oss.upload(file.fullPath, {
          remotePath: ossPath,
          headers: {
            'Cache-Control': 'public, max-age=31536000',
            'Content-Disposition': 'inline'
          }
        })
        
        console.log(`[ResourceUploader] OSS上传成功: ${file.relativePath}`)
        
        return {
          localPath: file.relativePath,
          absolutePath: file.fullPath,
          ossUrl: uploadResult.url || `https://oss.aliyuncs.com/${ossPath}`,
          ossPath: ossPath,
          size: stats.size,
          type: this.getMimeType(file.extension),
          md5: uploadResult.etag || null,
          uploadTime: new Date().toISOString(),
          fileName: file.fileName,
          extension: file.extension
        }
      } catch (error) {
        console.error(`[ResourceUploader] OSS上传失败 (尝试 ${attempt}/${maxRetries}): ${error.message}`)
        
        // 如果是最后一次重试，返回失败记录
        if (attempt === maxRetries) {
          console.error(`[ResourceUploader] ${file.relativePath} 最终OSS上传失败，已达最大重试次数`)
          return {
            localPath: file.relativePath,
            absolutePath: file.fullPath,
            ossUrl: null,
            error: error.message,
            uploadTime: new Date().toISOString(),
            fileName: file.fileName,
            extension: file.extension,
            failed: true
          }
        }
        
        // 等待一段时间后重试
        const delay = attempt * 3000 // 递增延迟：3s, 6s, 9s (比基础版本更长)
        console.log(`[ResourceUploader] ${delay}ms 后重试OSS上传...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    
    // 理论上不会执行到这里
    return {
      localPath: file.relativePath,
      absolutePath: file.fullPath,
      ossUrl: null,
      error: 'Unknown error',
      uploadTime: new Date().toISOString(),
      fileName: file.fileName,
      extension: file.extension,
      failed: true
    }
  }
  
  /**
   * 扫描媒体文件
   * @param {string} dir - 扫描目录
   * @returns {Promise<Array>} 媒体文件列表
   */
  async scanMediaFiles(dir) {
    const mediaExtensions = [
      // 图片
      '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico', '.bmp',
      // 视频
      '.mp4', '.avi', '.mov', '.webm', '.mkv', '.flv',
      // 音频
      '.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac',
      // 文档（作为资源）
      '.pdf'
    ]
    
    const files = []
    
    async function scan(currentPath, basePath) {
      try {
        const items = await fs.readdir(currentPath, { withFileTypes: true })
        
        for (const item of items) {
          const fullPath = path.join(currentPath, item.name)
          
          // 跳过隐藏文件和目录
          if (item.name.startsWith('.')) continue
          
          if (item.isDirectory()) {
            // 递归扫描子目录
            await scan(fullPath, basePath)
          } else {
            // 检查是否是媒体文件
            const ext = path.extname(item.name).toLowerCase()
            if (mediaExtensions.includes(ext)) {
              const relativePath = path.relative(basePath, fullPath)
                .replace(/\\/g, '/') // 统一使用正斜杠
              
              files.push({
                fullPath,
                relativePath,
                fileName: item.name,
                extension: ext
              })
            }
          }
        }
      } catch (error) {
        console.warn(`[ResourceUploader] Error scanning ${currentPath}:`, error.message)
      }
    }
    
    await scan(dir, dir)
    return files
  }
  
  /**
   * 上传单个文件
   * @param {string} filePath - 文件路径
   * @param {string} ossPath - OSS路径
   * @returns {Promise<Object>} 上传结果
   */
  async uploadFile(filePath, ossPath) {
    if (!this.oss) {
      throw new Error('OSS service not initialized')
    }
    
    try {
      const result = await this.oss.upload(filePath, {
        remotePath: ossPath,
        headers: {
          'Cache-Control': 'public, max-age=31536000'
        }
      })
      
      return {
        success: true,
        url: result.url,
        path: ossPath
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }
  
  /**
   * 批量上传到OSS - 新的OSS异步接口专用
   * @param {string} templateDir - 模板目录
   * @param {Object} options - 上传选项
   * @param {string} options.prefix - OSS路径前缀
   * @param {number} options.concurrency - 并发数，默认5
   * @returns {Promise<Array>} 详细的上传结果
   */
  async batchUploadToOSS(templateDir, options = {}) {
    console.log(`[ResourceUploader] Starting OSS batch upload for ${templateDir}`)
    
    const { prefix = `custom/${Date.now()}/`, concurrency = 5 } = options
    
    if (!this.oss) {
      console.warn('[ResourceUploader] OSS not initialized, skipping upload')
      return []
    }
    
    // 扫描媒体文件
    const mediaFiles = await this.scanMediaFiles(templateDir)
    console.log(`[ResourceUploader] Found ${mediaFiles.length} media files for OSS upload`)
    
    if (mediaFiles.length === 0) {
      return []
    }
    
    const uploadResults = []
    
    // 批量上传，控制并发
    for (let i = 0; i < mediaFiles.length; i += concurrency) {
      const batch = mediaFiles.slice(i, i + concurrency)
      const batchNum = Math.floor(i / concurrency) + 1
      const totalBatches = Math.ceil(mediaFiles.length / concurrency)
      
      console.log(`[ResourceUploader] Processing OSS batch ${batchNum}/${totalBatches}`)
      
      const results = await Promise.all(
        batch.map(async (file) => {
          return await this.uploadWithRetryAdvanced(file, prefix, 3)
        })
      )
      
      uploadResults.push(...results)
    }
    
    const successCount = uploadResults.filter(r => !r.failed).length
    const failCount = uploadResults.filter(r => r.failed).length
    
    console.log(`[ResourceUploader] OSS upload completed: ${successCount} success, ${failCount} failed`)
    
    // 只返回成功的上传结果
    return uploadResults.filter(r => !r.failed)
  }

  /**
   * 获取MIME类型
   * @param {string} extension - 文件扩展名
   * @returns {string} MIME类型
   */
  getMimeType(extension) {
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp',
      '.ico': 'image/x-icon',
      '.bmp': 'image/bmp',
      '.mp4': 'video/mp4',
      '.avi': 'video/x-msvideo',
      '.mov': 'video/quicktime',
      '.webm': 'video/webm',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.pdf': 'application/pdf'
    }
    
    return mimeTypes[extension.toLowerCase()] || 'application/octet-stream'
  }

  /**
   * 生成资源映射
   * @param {Array} uploadResults - 上传结果
   * @returns {Object} 映射表
   */
  createMapping(uploadResults) {
    const mapping = {}
    
    for (const result of uploadResults) {
      if (result && result.localPath) {
        // 多种匹配模式
        mapping[result.localPath] = result.ossUrl
        mapping[path.basename(result.localPath)] = result.ossUrl
        mapping[result.localPath.replace(/\\/g, '/')] = result.ossUrl
      }
    }
    
    return mapping
  }
}

export default new ResourceUploader()
export { ResourceUploader }