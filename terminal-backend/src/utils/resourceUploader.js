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
          try {
            // 构建OSS路径
            const ossPath = `custom-template/${taskId}/${file.relativePath}`
            
            // 上传文件
            const result = await this.oss.upload(file.fullPath, {
              remotePath: ossPath,
              headers: {
                'Cache-Control': 'public, max-age=31536000',
                'Content-Disposition': 'inline'
              }
            })
            
            console.log(`[ResourceUploader] Uploaded: ${file.relativePath} -> ${result.url || ossPath}`)
            
            return {
              localPath: file.relativePath,
              fullPath: file.fullPath,
              ossUrl: result.url || `https://oss.aliyuncs.com/${ossPath}`,
              ossPath: ossPath
            }
          } catch (error) {
            console.error(`[ResourceUploader] Failed to upload ${file.relativePath}:`, error.message)
            // 上传失败的文件返回null，后续过滤掉
            return null
          }
        })
      )
      
      // 过滤掉失败的上传
      mapping.push(...results.filter(r => r !== null))
    }
    
    console.log(`[ResourceUploader] Successfully uploaded ${mapping.length}/${mediaFiles.length} files`)
    return mapping
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