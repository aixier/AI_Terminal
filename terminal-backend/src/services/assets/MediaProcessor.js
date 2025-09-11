/**
 * MediaProcessor 服务
 * 负责处理媒体文件，生成缩略图、提取元数据等
 */

import sharp from 'sharp'
import PQueue from 'p-queue'
import fs from 'fs/promises'
import path from 'path'
import logger from '../../utils/logger.js'

class MediaProcessor {
  constructor() {
    this.thumbnailQueue = new PQueue({ concurrency: 5 })
    this.metadataQueue = new PQueue({ concurrency: 10 })
    this.thumbnailSizes = {
      small: { width: 150, height: 150 },
      medium: { width: 300, height: 300 },
      large: { width: 600, height: 600 }
    }
  }

  /**
   * 生成缩略图
   */
  async generateThumbnail(filePath, userId, fileId) {
    return this.thumbnailQueue.add(async () => {
      try {
        const dataPath = process.env.DATA_PATH || path.join(process.cwd(), 'data')
        const cachePath = path.join(dataPath, 'users', userId, '.cache', 'thumbnails')
        
        // 确保缓存目录存在
        await fs.mkdir(cachePath, { recursive: true })
        
        // 生成不同尺寸的缩略图
        const results = {}
        
        for (const [size, dimensions] of Object.entries(this.thumbnailSizes)) {
          const outputPath = path.join(cachePath, `${fileId}_${size}.jpg`)
          
          try {
            await sharp(filePath)
              .resize(dimensions.width, dimensions.height, {
                fit: 'inside',
                withoutEnlargement: true
              })
              .jpeg({ 
                quality: 85,
                progressive: true
              })
              .toFile(outputPath)
            
            results[size] = outputPath
            logger.debug(`[MediaProcessor] Generated ${size} thumbnail for ${fileId}`)
          } catch (error) {
            logger.error(`[MediaProcessor] Failed to generate ${size} thumbnail:`, error)
          }
        }
        
        return results
      } catch (error) {
        logger.error(`[MediaProcessor] Failed to generate thumbnails for ${fileId}:`, error)
        throw error
      }
    })
  }

  /**
   * 批量生成缩略图
   */
  async generateThumbnails(files) {
    const promises = files.map(file => 
      this.generateThumbnail(file.path, file.userId, file.id)
    )
    return Promise.allSettled(promises)
  }

  /**
   * 提取图片元数据
   */
  async extractImageMetadata(filePath) {
    return this.metadataQueue.add(async () => {
      try {
        const metadata = await sharp(filePath).metadata()
        
        return {
          width: metadata.width,
          height: metadata.height,
          format: metadata.format,
          space: metadata.space,
          channels: metadata.channels,
          depth: metadata.depth,
          density: metadata.density,
          hasAlpha: metadata.hasAlpha,
          orientation: metadata.orientation,
          size: metadata.size
        }
      } catch (error) {
        logger.error(`[MediaProcessor] Failed to extract metadata:`, error)
        return null
      }
    })
  }

  /**
   * 优化图片
   */
  async optimizeImage(inputPath, outputPath, options = {}) {
    const {
      width = null,
      height = null,
      quality = 85,
      format = 'jpeg'
    } = options

    try {
      let pipeline = sharp(inputPath)
      
      // 调整大小
      if (width || height) {
        pipeline = pipeline.resize(width, height, {
          fit: 'inside',
          withoutEnlargement: true
        })
      }
      
      // 转换格式并优化
      switch (format) {
        case 'jpeg':
        case 'jpg':
          pipeline = pipeline.jpeg({ quality, progressive: true })
          break
        case 'png':
          pipeline = pipeline.png({ quality, compressionLevel: 9 })
          break
        case 'webp':
          pipeline = pipeline.webp({ quality })
          break
        default:
          pipeline = pipeline.jpeg({ quality })
      }
      
      await pipeline.toFile(outputPath)
      
      logger.info(`[MediaProcessor] Optimized image saved to ${outputPath}`)
      return outputPath
    } catch (error) {
      logger.error(`[MediaProcessor] Failed to optimize image:`, error)
      throw error
    }
  }

  /**
   * 创建图片预览
   */
  async createPreview(filePath, userId, fileId) {
    try {
      const dataPath = process.env.DATA_PATH || path.join(process.cwd(), 'data')
      const previewPath = path.join(dataPath, 'users', userId, '.cache', 'previews')
      
      await fs.mkdir(previewPath, { recursive: true })
      
      const outputPath = path.join(previewPath, `${fileId}_preview.jpg`)
      
      await sharp(filePath)
        .resize(1200, 1200, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ 
          quality: 90,
          progressive: true
        })
        .toFile(outputPath)
      
      logger.info(`[MediaProcessor] Created preview for ${fileId}`)
      return outputPath
    } catch (error) {
      logger.error(`[MediaProcessor] Failed to create preview:`, error)
      throw error
    }
  }

  /**
   * 验证图片文件
   */
  async validateImage(filePath) {
    try {
      const metadata = await sharp(filePath).metadata()
      
      // 检查图片是否有效
      if (!metadata.width || !metadata.height) {
        return {
          valid: false,
          error: 'Invalid image dimensions'
        }
      }
      
      // 检查文件大小限制（100MB）
      const stats = await fs.stat(filePath)
      if (stats.size > 100 * 1024 * 1024) {
        return {
          valid: false,
          error: 'File size exceeds 100MB limit'
        }
      }
      
      // 检查尺寸限制（最大10000x10000）
      if (metadata.width > 10000 || metadata.height > 10000) {
        return {
          valid: false,
          error: 'Image dimensions exceed 10000x10000 limit'
        }
      }
      
      return {
        valid: true,
        metadata
      }
    } catch (error) {
      return {
        valid: false,
        error: error.message
      }
    }
  }

  /**
   * 旋转图片
   */
  async rotateImage(filePath, degrees) {
    try {
      const outputPath = filePath.replace(/(\.[^.]+)$/, `_rotated$1`)
      
      await sharp(filePath)
        .rotate(degrees)
        .toFile(outputPath)
      
      logger.info(`[MediaProcessor] Rotated image by ${degrees} degrees`)
      return outputPath
    } catch (error) {
      logger.error(`[MediaProcessor] Failed to rotate image:`, error)
      throw error
    }
  }

  /**
   * 裁剪图片
   */
  async cropImage(filePath, options) {
    const { left, top, width, height } = options
    
    try {
      const outputPath = filePath.replace(/(\.[^.]+)$/, `_cropped$1`)
      
      await sharp(filePath)
        .extract({ left, top, width, height })
        .toFile(outputPath)
      
      logger.info(`[MediaProcessor] Cropped image`)
      return outputPath
    } catch (error) {
      logger.error(`[MediaProcessor] Failed to crop image:`, error)
      throw error
    }
  }

  /**
   * 添加水印
   */
  async addWatermark(filePath, watermarkPath, position = 'bottom-right') {
    try {
      const outputPath = filePath.replace(/(\.[^.]+)$/, `_watermarked$1`)
      
      // 获取原图和水印图的元数据
      const imageMetadata = await sharp(filePath).metadata()
      const watermarkMetadata = await sharp(watermarkPath).metadata()
      
      // 计算水印位置
      let left, top
      const padding = 20
      
      switch (position) {
        case 'top-left':
          left = padding
          top = padding
          break
        case 'top-right':
          left = imageMetadata.width - watermarkMetadata.width - padding
          top = padding
          break
        case 'bottom-left':
          left = padding
          top = imageMetadata.height - watermarkMetadata.height - padding
          break
        case 'bottom-right':
        default:
          left = imageMetadata.width - watermarkMetadata.width - padding
          top = imageMetadata.height - watermarkMetadata.height - padding
          break
      }
      
      await sharp(filePath)
        .composite([{
          input: watermarkPath,
          left: Math.max(0, left),
          top: Math.max(0, top)
        }])
        .toFile(outputPath)
      
      logger.info(`[MediaProcessor] Added watermark to image`)
      return outputPath
    } catch (error) {
      logger.error(`[MediaProcessor] Failed to add watermark:`, error)
      throw error
    }
  }

  /**
   * 获取队列状态
   */
  getQueueStatus() {
    return {
      thumbnail: {
        size: this.thumbnailQueue.size,
        pending: this.thumbnailQueue.pending,
        isPaused: this.thumbnailQueue.isPaused
      },
      metadata: {
        size: this.metadataQueue.size,
        pending: this.metadataQueue.pending,
        isPaused: this.metadataQueue.isPaused
      }
    }
  }

  /**
   * 清理缓存
   */
  async clearCache(userId, type = 'all') {
    try {
      const dataPath = process.env.DATA_PATH || path.join(process.cwd(), 'data')
      const cachePath = path.join(dataPath, 'users', userId, '.cache')
      
      if (type === 'all') {
        await fs.rm(cachePath, { recursive: true, force: true })
        await fs.mkdir(cachePath, { recursive: true })
      } else {
        const targetPath = path.join(cachePath, type)
        await fs.rm(targetPath, { recursive: true, force: true })
        await fs.mkdir(targetPath, { recursive: true })
      }
      
      logger.info(`[MediaProcessor] Cleared ${type} cache for user ${userId}`)
    } catch (error) {
      logger.error(`[MediaProcessor] Failed to clear cache:`, error)
      throw error
    }
  }
}

// 导出单例
export default new MediaProcessor()