/**
 * IndexService 服务
 * 负责文件索引和搜索功能
 */

import fs from 'fs/promises'
import path from 'path'
import logger from '../../utils/logger.js'

class IndexService {
  constructor() {
    this.index = new Map() // userId -> fileIndex
    this.searchCache = new Map() // 搜索结果缓存
    this.cacheTimeout = 5 * 60 * 1000 // 5分钟缓存
  }

  /**
   * 获取索引文件路径
   */
  getIndexPath(userId) {
    const dataPath = process.env.DATA_PATH || path.join(process.cwd(), 'data')
    return path.join(dataPath, 'users', userId, '.system', 'index.json')
  }

  /**
   * 初始化用户索引
   */
  async initializeIndex(userId) {
    try {
      const indexPath = this.getIndexPath(userId)
      
      // 尝试加载现有索引
      try {
        const data = await fs.readFile(indexPath, 'utf-8')
        const index = JSON.parse(data)
        this.index.set(userId, index)
        logger.info(`[IndexService] Loaded index for user ${userId}`)
        return index
      } catch (error) {
        // 索引不存在，创建新索引
        if (error.code === 'ENOENT') {
          const newIndex = {
            version: '1.0',
            userId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            files: new Map(),
            folders: new Map(),
            stats: {
              totalFiles: 0,
              totalFolders: 0,
              totalSize: 0,
              lastScan: null
            }
          }
          
          this.index.set(userId, newIndex)
          await this.saveIndex(userId)
          logger.info(`[IndexService] Created new index for user ${userId}`)
          return newIndex
        }
        throw error
      }
    } catch (error) {
      logger.error(`[IndexService] Failed to initialize index for user ${userId}:`, error)
      throw error
    }
  }

  /**
   * 保存索引到文件
   */
  async saveIndex(userId) {
    try {
      const index = this.index.get(userId)
      if (!index) return

      const indexPath = this.getIndexPath(userId)
      const dir = path.dirname(indexPath)
      
      // 确保目录存在
      await fs.mkdir(dir, { recursive: true })
      
      // 转换Map为普通对象用于序列化
      const serializable = {
        ...index,
        files: Array.from(index.files.entries()),
        folders: Array.from(index.folders.entries()),
        updatedAt: new Date().toISOString()
      }
      
      await fs.writeFile(indexPath, JSON.stringify(serializable, null, 2))
      logger.debug(`[IndexService] Saved index for user ${userId}`)
    } catch (error) {
      logger.error(`[IndexService] Failed to save index:`, error)
    }
  }

  /**
   * 添加文件到索引
   */
  async addFile(userId, fileInfo) {
    try {
      let index = this.index.get(userId)
      if (!index) {
        index = await this.initializeIndex(userId)
      }

      // 确保files是Map类型
      if (!(index.files instanceof Map)) {
        index.files = new Map(index.files)
      }

      const fileEntry = {
        id: fileInfo.id,
        name: fileInfo.name,
        path: fileInfo.path,
        size: fileInfo.size,
        type: fileInfo.type,
        createdAt: fileInfo.createdAt,
        modifiedAt: fileInfo.modifiedAt,
        metadata: fileInfo.metadata || {}
      }

      index.files.set(fileInfo.id, fileEntry)
      index.stats.totalFiles++
      index.stats.totalSize += fileInfo.size || 0

      // 清理相关缓存
      this.clearSearchCache(userId)
      
      // 异步保存索引
      this.saveIndex(userId).catch(error => {
        logger.error('[IndexService] Failed to save index after adding file:', error)
      })

      logger.debug(`[IndexService] Added file ${fileInfo.name} to index`)
      return fileEntry
    } catch (error) {
      logger.error(`[IndexService] Failed to add file to index:`, error)
      throw error
    }
  }

  /**
   * 从索引中删除文件
   */
  async removeFile(userId, fileId) {
    try {
      const index = this.index.get(userId)
      if (!index) return

      // 确保files是Map类型
      if (!(index.files instanceof Map)) {
        index.files = new Map(index.files)
      }

      const file = index.files.get(fileId)
      if (file) {
        index.files.delete(fileId)
        index.stats.totalFiles--
        index.stats.totalSize -= file.size || 0
        
        // 清理缓存
        this.clearSearchCache(userId)
        
        // 异步保存
        this.saveIndex(userId).catch(error => {
          logger.error('[IndexService] Failed to save index after removing file:', error)
        })
        
        logger.debug(`[IndexService] Removed file ${fileId} from index`)
      }
    } catch (error) {
      logger.error(`[IndexService] Failed to remove file from index:`, error)
    }
  }

  /**
   * 添加文件夹到索引
   */
  async addFolder(userId, folderInfo) {
    try {
      let index = this.index.get(userId)
      if (!index) {
        index = await this.initializeIndex(userId)
      }

      // 确保folders是Map类型
      if (!(index.folders instanceof Map)) {
        index.folders = new Map(index.folders)
      }

      const folderEntry = {
        path: folderInfo.path,
        name: folderInfo.name,
        createdAt: folderInfo.createdAt,
        fileCount: 0,
        totalSize: 0
      }

      index.folders.set(folderInfo.path, folderEntry)
      index.stats.totalFolders++

      // 异步保存
      this.saveIndex(userId).catch(error => {
        logger.error('[IndexService] Failed to save index after adding folder:', error)
      })

      logger.debug(`[IndexService] Added folder ${folderInfo.path} to index`)
      return folderEntry
    } catch (error) {
      logger.error(`[IndexService] Failed to add folder to index:`, error)
      throw error
    }
  }

  /**
   * 搜索文件
   */
  async searchFiles(userId, query, options = {}) {
    const {
      type = null,
      folder = null,
      limit = 50,
      sortBy = 'relevance'
    } = options

    // 检查缓存
    const cacheKey = `${userId}:${query}:${JSON.stringify(options)}`
    const cached = this.searchCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.results
    }

    try {
      const index = this.index.get(userId)
      if (!index) {
        return []
      }

      // 确保files是Map类型
      if (!(index.files instanceof Map)) {
        index.files = new Map(index.files)
      }

      const queryLower = query.toLowerCase()
      const results = []

      // 搜索文件
      for (const [id, file] of index.files) {
        // 类型过滤
        if (type && file.type !== type) continue
        
        // 文件夹过滤
        if (folder && !file.path.startsWith(folder)) continue
        
        // 名称匹配
        const nameMatch = file.name.toLowerCase().includes(queryLower)
        const pathMatch = file.path.toLowerCase().includes(queryLower)
        
        if (nameMatch || pathMatch) {
          results.push({
            ...file,
            relevance: nameMatch ? 2 : 1 // 名称匹配优先级更高
          })
        }
        
        if (results.length >= limit * 2) break // 获取更多结果用于排序
      }

      // 排序
      this.sortResults(results, sortBy)

      // 限制结果数量
      const finalResults = results.slice(0, limit)

      // 缓存结果
      this.searchCache.set(cacheKey, {
        results: finalResults,
        timestamp: Date.now()
      })

      return finalResults
    } catch (error) {
      logger.error(`[IndexService] Search failed:`, error)
      return []
    }
  }

  /**
   * 排序搜索结果
   */
  sortResults(results, sortBy) {
    switch (sortBy) {
      case 'relevance':
        results.sort((a, b) => b.relevance - a.relevance)
        break
      case 'name':
        results.sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'date':
        results.sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt))
        break
      case 'size':
        results.sort((a, b) => b.size - a.size)
        break
      case 'type':
        results.sort((a, b) => a.type.localeCompare(b.type))
        break
    }
  }

  /**
   * 重建索引
   */
  async rebuildIndex(userId, fileSystemManager) {
    try {
      logger.info(`[IndexService] Starting index rebuild for user ${userId}`)
      
      // 创建新索引
      const newIndex = {
        version: '1.0',
        userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        files: new Map(),
        folders: new Map(),
        stats: {
          totalFiles: 0,
          totalFolders: 0,
          totalSize: 0,
          lastScan: new Date().toISOString()
        }
      }

      // 扫描文件系统
      const scanDir = async (dirPath) => {
        try {
          const contents = await fileSystemManager.getDirectoryContents(userId, dirPath)
          
          for (const item of contents) {
            if (item.isDirectory) {
              // 添加文件夹到索引
              newIndex.folders.set(item.path, {
                path: item.path,
                name: item.name,
                createdAt: item.createdAt,
                fileCount: 0,
                totalSize: 0
              })
              newIndex.stats.totalFolders++
              
              // 递归扫描子目录
              await scanDir(item.path)
            } else {
              // 添加文件到索引
              const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
              newIndex.files.set(fileId, {
                id: fileId,
                name: item.name,
                path: item.path,
                size: item.size,
                type: item.type,
                createdAt: item.createdAt,
                modifiedAt: item.modifiedAt
              })
              newIndex.stats.totalFiles++
              newIndex.stats.totalSize += item.size
              
              // 更新文件夹统计
              const folderPath = path.dirname(item.path)
              if (newIndex.folders.has(folderPath)) {
                const folder = newIndex.folders.get(folderPath)
                folder.fileCount++
                folder.totalSize += item.size
              }
            }
          }
        } catch (error) {
          logger.error(`[IndexService] Error scanning directory ${dirPath}:`, error)
        }
      }

      // 开始扫描
      await scanDir('')
      
      // 保存新索引
      this.index.set(userId, newIndex)
      await this.saveIndex(userId)
      
      // 清理缓存
      this.clearSearchCache(userId)
      
      logger.info(`[IndexService] Index rebuild completed for user ${userId}. Files: ${newIndex.stats.totalFiles}, Folders: ${newIndex.stats.totalFolders}`)
      return newIndex.stats
    } catch (error) {
      logger.error(`[IndexService] Failed to rebuild index:`, error)
      throw error
    }
  }

  /**
   * 清理搜索缓存
   */
  clearSearchCache(userId = null) {
    if (userId) {
      // 清理特定用户的缓存
      for (const key of this.searchCache.keys()) {
        if (key.startsWith(`${userId}:`)) {
          this.searchCache.delete(key)
        }
      }
    } else {
      // 清理所有缓存
      this.searchCache.clear()
    }
  }

  /**
   * 获取索引统计信息
   */
  getStats(userId) {
    const index = this.index.get(userId)
    if (!index) {
      return null
    }
    return index.stats
  }

  /**
   * 获取文件信息
   */
  getFileInfo(userId, fileId) {
    const index = this.index.get(userId)
    if (!index) return null
    
    // 确保files是Map类型
    if (!(index.files instanceof Map)) {
      index.files = new Map(index.files)
    }
    
    return index.files.get(fileId)
  }

  /**
   * 获取文件夹信息
   */
  getFolderInfo(userId, folderPath) {
    const index = this.index.get(userId)
    if (!index) return null
    
    // 确保folders是Map类型
    if (!(index.folders instanceof Map)) {
      index.folders = new Map(index.folders)
    }
    
    return index.folders.get(folderPath)
  }
}

// 导出单例
export default new IndexService()