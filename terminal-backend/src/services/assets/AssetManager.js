/**
 * AssetManager 主服务
 * 整合所有资产管理子服务，提供统一的接口
 */

import ChokidarWatcher from './ChokidarWatcher.js'
import FileSystemManager from './FileSystemManager.js'
import EventProcessor from './EventProcessor.js'
import MediaProcessor from './MediaProcessor.js'
import IndexService from './IndexService.js'
import logger from '../../utils/logger.js'

class AssetManager {
  constructor() {
    this.initialized = false
    this.activeUsers = new Set()
    
    // 绑定事件处理器
    this.setupEventHandlers()
  }

  /**
   * 初始化资产管理器
   */
  async initialize() {
    if (this.initialized) return

    try {
      logger.info('[AssetManager] Initializing asset management system...')
      
      // 设置事件处理器
      this.setupChokidarHandlers()
      this.setupEventProcessorHandlers()
      
      this.initialized = true
      logger.info('[AssetManager] Asset management system initialized')
    } catch (error) {
      logger.error('[AssetManager] Failed to initialize:', error)
      throw error
    }
  }

  /**
   * 设置事件处理器
   */
  setupEventHandlers() {
    // 文件添加事件
    EventProcessor.on('file:added', async (event) => {
      try {
        const { userId, path, fullPath } = event
        
        // 获取文件信息
        const fileInfo = await FileSystemManager.getFileInfo(userId, path)
        
        // 添加到索引
        await IndexService.addFile(userId, {
          ...fileInfo,
          id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        })
        
        // 如果是图片，生成缩略图
        if (fileInfo.type === 'image') {
          MediaProcessor.generateThumbnail(fullPath, userId, fileInfo.id)
            .catch(error => logger.error('[AssetManager] Thumbnail generation failed:', error))
        }
      } catch (error) {
        logger.error('[AssetManager] Error handling file:added event:', error)
      }
    })

    // 文件删除事件
    EventProcessor.on('file:deleted', async (event) => {
      try {
        const { userId, path } = event
        // 从索引中移除
        const index = IndexService.index.get(userId)
        if (index && index.files instanceof Map) {
          for (const [id, file] of index.files) {
            if (file.path === path) {
              await IndexService.removeFile(userId, id)
              break
            }
          }
        }
      } catch (error) {
        logger.error('[AssetManager] Error handling file:deleted event:', error)
      }
    })

    // 文件夹创建事件
    EventProcessor.on('folder:created', async (event) => {
      try {
        const { userId, path } = event
        await IndexService.addFolder(userId, {
          path,
          name: path.split('/').pop() || path,
          createdAt: new Date().toISOString()
        })
      } catch (error) {
        logger.error('[AssetManager] Error handling folder:created event:', error)
      }
    })
  }

  /**
   * 设置Chokidar事件处理器
   */
  setupChokidarHandlers() {
    ChokidarWatcher.on('batch', async ({ userId, events }) => {
      // 批量处理文件系统事件
      await EventProcessor.processEvents(events)
    })

    ChokidarWatcher.on('error', ({ userId, error }) => {
      logger.error(`[AssetManager] Watcher error for user ${userId}:`, error)
    })
  }

  /**
   * 设置EventProcessor事件处理器
   */
  setupEventProcessorHandlers() {
    // 注册文件处理器
    EventProcessor.registerHandler('file:added', async (event) => {
      logger.info(`[AssetManager] File added: ${event.path}`)
    })

    EventProcessor.registerHandler('file:deleted', async (event) => {
      logger.info(`[AssetManager] File deleted: ${event.path}`)
    })
  }

  /**
   * 为用户启动资产管理
   */
  async startForUser(userId) {
    try {
      if (this.activeUsers.has(userId)) {
        logger.info(`[AssetManager] Already active for user ${userId}`)
        return
      }

      logger.info(`[AssetManager] Starting asset management for user ${userId}`)
      
      // 初始化用户目录
      await FileSystemManager.initializeUserDirectories(userId)
      
      // 初始化索引
      await IndexService.initializeIndex(userId)
      
      // 启动文件监控
      ChokidarWatcher.watchUserDirectory(userId)
      
      this.activeUsers.add(userId)
      logger.info(`[AssetManager] Started for user ${userId}`)
    } catch (error) {
      logger.error(`[AssetManager] Failed to start for user ${userId}:`, error)
      throw error
    }
  }

  /**
   * 为用户停止资产管理
   */
  async stopForUser(userId) {
    try {
      if (!this.activeUsers.has(userId)) {
        return
      }

      logger.info(`[AssetManager] Stopping asset management for user ${userId}`)
      
      // 停止文件监控
      await ChokidarWatcher.unwatchUserDirectory(userId)
      
      // 保存索引
      await IndexService.saveIndex(userId)
      
      this.activeUsers.delete(userId)
      logger.info(`[AssetManager] Stopped for user ${userId}`)
    } catch (error) {
      logger.error(`[AssetManager] Failed to stop for user ${userId}:`, error)
      throw error
    }
  }

  /**
   * 上传文件
   */
  async uploadFile(userId, file, targetFolder = '') {
    try {
      // 确保用户已初始化
      if (!this.activeUsers.has(userId)) {
        await this.startForUser(userId)
      }

      // 上传文件
      const fileInfo = await FileSystemManager.uploadFile(userId, file, targetFolder)
      
      // 添加到索引
      await IndexService.addFile(userId, fileInfo)
      
      // 处理媒体文件
      if (fileInfo.type === 'image') {
        // 验证图片
        const validation = await MediaProcessor.validateImage(fileInfo.fullPath)
        if (!validation.valid) {
          // 删除无效文件
          await FileSystemManager.delete(userId, fileInfo.path)
          await IndexService.removeFile(userId, fileInfo.id)
          throw new Error(validation.error)
        }
        
        // 生成缩略图
        await MediaProcessor.generateThumbnail(fileInfo.fullPath, userId, fileInfo.id)
        
        // 提取元数据
        fileInfo.metadata = await MediaProcessor.extractImageMetadata(fileInfo.fullPath)
      }
      
      return fileInfo
    } catch (error) {
      logger.error('[AssetManager] Failed to upload file:', error)
      throw error
    }
  }

  /**
   * 批量上传文件
   */
  async uploadFiles(userId, files, targetFolder = '') {
    const results = []
    const errors = []

    for (const file of files) {
      try {
        const result = await this.uploadFile(userId, file, targetFolder)
        results.push(result)
      } catch (error) {
        errors.push({
          file: file.originalname || file.name,
          error: error.message
        })
      }
    }

    return {
      success: results,
      failed: errors,
      total: files.length
    }
  }

  /**
   * 创建文件夹
   */
  async createFolder(userId, folderPath) {
    try {
      const result = await FileSystemManager.createFolder(userId, folderPath)
      
      // 添加到索引
      await IndexService.addFolder(userId, {
        path: folderPath,
        name: folderPath.split('/').pop() || folderPath,
        createdAt: new Date().toISOString()
      })
      
      return result
    } catch (error) {
      logger.error('[AssetManager] Failed to create folder:', error)
      throw error
    }
  }

  /**
   * 删除文件或文件夹
   */
  async deleteItem(userId, itemPath) {
    try {
      const result = await FileSystemManager.delete(userId, itemPath)
      
      // 从索引中移除
      const index = IndexService.index.get(userId)
      if (index && index.files instanceof Map) {
        for (const [id, file] of index.files) {
          if (file.path === itemPath || file.path.startsWith(itemPath + '/')) {
            await IndexService.removeFile(userId, id)
          }
        }
      }
      
      return result
    } catch (error) {
      logger.error('[AssetManager] Failed to delete item:', error)
      throw error
    }
  }

  /**
   * 移动文件或文件夹
   */
  async moveItem(userId, sourcePath, targetPath) {
    try {
      const result = await FileSystemManager.move(userId, sourcePath, targetPath)
      
      // 更新索引
      await this.updateIndexAfterMove(userId, sourcePath, targetPath)
      
      return result
    } catch (error) {
      logger.error('[AssetManager] Failed to move item:', error)
      throw error
    }
  }

  /**
   * 重命名文件或文件夹
   */
  async renameItem(userId, oldPath, newName) {
    try {
      const result = await FileSystemManager.rename(userId, oldPath, newName)
      
      // 更新索引
      await this.updateIndexAfterMove(userId, oldPath, result.newPath)
      
      return result
    } catch (error) {
      logger.error('[AssetManager] Failed to rename item:', error)
      throw error
    }
  }

  /**
   * 搜索文件
   */
  async searchFiles(userId, query, options = {}) {
    try {
      // 确保用户索引已加载
      if (!IndexService.index.has(userId)) {
        await IndexService.initializeIndex(userId)
      }
      
      return await IndexService.searchFiles(userId, query, options)
    } catch (error) {
      logger.error('[AssetManager] Failed to search files:', error)
      throw error
    }
  }

  /**
   * 获取目录内容
   */
  async getDirectoryContents(userId, dirPath = '') {
    try {
      return await FileSystemManager.getDirectoryContents(userId, dirPath)
    } catch (error) {
      logger.error('[AssetManager] Failed to get directory contents:', error)
      throw error
    }
  }

  /**
   * 获取目录树
   */
  async getDirectoryTree(userId, dirPath = '', maxDepth = 3) {
    try {
      return await FileSystemManager.getDirectoryTree(userId, dirPath, maxDepth)
    } catch (error) {
      logger.error('[AssetManager] Failed to get directory tree:', error)
      throw error
    }
  }

  /**
   * 获取文件信息
   */
  async getFileInfo(userId, filePath) {
    try {
      return await FileSystemManager.getFileInfo(userId, filePath)
    } catch (error) {
      logger.error('[AssetManager] Failed to get file info:', error)
      throw error
    }
  }

  /**
   * 获取存储统计
   */
  async getStorageStats(userId) {
    try {
      const stats = IndexService.getStats(userId)
      if (!stats) {
        // 如果没有统计信息，重建索引
        await IndexService.rebuildIndex(userId, FileSystemManager)
        return IndexService.getStats(userId)
      }
      return stats
    } catch (error) {
      logger.error('[AssetManager] Failed to get storage stats:', error)
      throw error
    }
  }

  /**
   * 注册SSE客户端
   */
  registerSSEClient(userId, res) {
    EventProcessor.registerSSEClient(userId, res)
  }

  /**
   * 优化图片
   */
  async optimizeImage(userId, filePath, options) {
    try {
      const fullPath = FileSystemManager.getUserPath(userId, filePath)
      const outputPath = fullPath.replace(/(\.[^.]+)$/, '_optimized$1')
      
      return await MediaProcessor.optimizeImage(fullPath, outputPath, options)
    } catch (error) {
      logger.error('[AssetManager] Failed to optimize image:', error)
      throw error
    }
  }

  /**
   * 重建用户索引
   */
  async rebuildIndex(userId) {
    try {
      return await IndexService.rebuildIndex(userId, FileSystemManager)
    } catch (error) {
      logger.error('[AssetManager] Failed to rebuild index:', error)
      throw error
    }
  }

  /**
   * 清理用户缓存
   */
  async clearCache(userId, type = 'all') {
    try {
      await MediaProcessor.clearCache(userId, type)
      IndexService.clearSearchCache(userId)
    } catch (error) {
      logger.error('[AssetManager] Failed to clear cache:', error)
      throw error
    }
  }

  /**
   * 更新移动后的索引
   */
  async updateIndexAfterMove(userId, oldPath, newPath) {
    const index = IndexService.index.get(userId)
    if (!index || !(index.files instanceof Map)) return

    for (const [id, file] of index.files) {
      if (file.path === oldPath) {
        file.path = newPath
        file.name = newPath.split('/').pop() || newPath
      } else if (file.path.startsWith(oldPath + '/')) {
        file.path = file.path.replace(oldPath, newPath)
      }
    }

    await IndexService.saveIndex(userId)
  }

  /**
   * 获取系统状态
   */
  getSystemStatus() {
    return {
      initialized: this.initialized,
      activeUsers: Array.from(this.activeUsers),
      watcherStatus: ChokidarWatcher.getStatus(),
      queueStatus: EventProcessor.getQueueStatus(),
      mediaQueueStatus: MediaProcessor.getQueueStatus(),
      sseClients: EventProcessor.getSSEStats()
    }
  }

  /**
   * 关闭资产管理器
   */
  async shutdown() {
    try {
      logger.info('[AssetManager] Shutting down asset management system...')
      
      // 停止所有用户的服务
      for (const userId of this.activeUsers) {
        await this.stopForUser(userId)
      }
      
      // 停止所有监控器
      await ChokidarWatcher.stopAll()
      
      // 清理事件处理器
      EventProcessor.clear()
      
      this.initialized = false
      logger.info('[AssetManager] Asset management system shut down')
    } catch (error) {
      logger.error('[AssetManager] Failed to shutdown:', error)
      throw error
    }
  }
}

// 导出单例
export default new AssetManager()