/**
 * FileSystemManager 服务
 * 负责所有文件系统操作的核心服务
 */

import fs from 'fs/promises'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import logger from '../../utils/logger.js'

class FileSystemManager {
  constructor() {
    this.dataPath = process.env.DATA_PATH || path.join(process.cwd(), 'data')
  }

  /**
   * 获取用户根路径
   */
  getUserPath(userId, subPath = '') {
    const basePath = path.join(this.dataPath, 'users', userId, 'assets')
    return subPath ? path.join(basePath, subPath) : basePath
  }

  /**
   * 获取缓存路径
   */
  getCachePath(userId, type = '') {
    const cachePath = path.join(this.dataPath, 'users', userId, '.cache')
    return type ? path.join(cachePath, type) : cachePath
  }

  /**
   * 获取系统路径
   */
  getSystemPath(userId, filename = '') {
    const systemPath = path.join(this.dataPath, 'users', userId, '.system')
    return filename ? path.join(systemPath, filename) : systemPath
  }

  /**
   * 初始化用户目录结构
   */
  async initializeUserDirectories(userId) {
    try {
      // 首先确保基础assets目录存在
      const baseAssetsPath = this.getUserPath(userId)
      await fs.mkdir(baseAssetsPath, { recursive: true })
      
      const directories = [
        this.getUserPath(userId, 'images/photos'),
        this.getUserPath(userId, 'images/designs'),
        this.getUserPath(userId, 'images/screenshots'),
        this.getUserPath(userId, 'videos'),
        this.getUserPath(userId, 'documents/pdf'),
        this.getUserPath(userId, 'documents/word'),
        this.getUserPath(userId, 'documents/markdown'),
        this.getUserPath(userId, 'audio'),
        this.getUserPath(userId, 'projects/web'),
        this.getUserPath(userId, 'projects/mobile'),
        this.getCachePath(userId, 'thumbnails'),
        this.getCachePath(userId, 'previews'),
        this.getCachePath(userId, 'metadata'),
        this.getSystemPath(userId)
      ]

      for (const dir of directories) {
        await fs.mkdir(dir, { recursive: true })
      }

      logger.info(`[FileSystemManager] Initialized directories for user: ${userId}`)
      return true
    } catch (error) {
      logger.error(`[FileSystemManager] Failed to initialize directories for user ${userId}:`, error)
      throw error
    }
  }

  /**
   * 创建文件夹
   */
  async createFolder(userId, folderPath) {
    try {
      const fullPath = this.getUserPath(userId, folderPath)
      await fs.mkdir(fullPath, { recursive: true })
      
      logger.info(`[FileSystemManager] Created folder: ${fullPath}`)
      return {
        path: folderPath,
        fullPath,
        created: true
      }
    } catch (error) {
      logger.error(`[FileSystemManager] Failed to create folder:`, error)
      throw error
    }
  }

  /**
   * 上传文件
   */
  async uploadFile(userId, file, targetFolder = '') {
    try {
      // 确保文件名使用正确的UTF-8编码
      let originalName = file.originalname
      
      // 尝试修复可能的编码问题
      // 如果文件名看起来像是被错误编码的（包含常见的乱码字符）
      if (/[àáâãäåæçèéêëìíîï]/.test(originalName)) {
        try {
          // 尝试将Latin-1编码转换为UTF-8
          const buffer = Buffer.from(originalName, 'latin1')
          const decoded = buffer.toString('utf8')
          // 验证解码后的字符串是否包含有效的中文字符
          if (/[\u4e00-\u9fa5]/.test(decoded)) {
            originalName = decoded
            logger.info(`[FileSystemManager] Fixed encoding for filename: ${originalName}`)
          }
        } catch (e) {
          logger.warn(`[FileSystemManager] Could not fix encoding for filename: ${originalName}`)
        }
      }
      
      // 使用原始文件名，不添加前缀
      const fileName = originalName
      const targetPath = path.join(this.getUserPath(userId, targetFolder), fileName)
      
      // 检查文件是否已存在
      try {
        await fs.access(targetPath)
        // 文件已存在，抛出冲突错误
        const error = new Error(`文件 "${fileName}" 已存在，请重命名后再上传`)
        error.code = 'FILE_EXISTS'
        throw error
      } catch (e) {
        if (e.code !== 'ENOENT') {
          // 如果不是文件不存在的错误，重新抛出
          throw e
        }
        // 文件不存在，可以继续上传
      }
      
      // 确保目标目录存在
      await fs.mkdir(path.dirname(targetPath), { recursive: true })
      
      // 移动文件
      if (file.path) {
        // 如果是从临时文件移动
        await fs.rename(file.path, targetPath)
      } else if (file.buffer) {
        // 如果是从内存buffer写入
        await fs.writeFile(targetPath, file.buffer)
      }
      
      // 获取文件信息
      const stats = await fs.stat(targetPath)
      const ext = path.extname(originalName)
      const fileId = `${fileName}_${Date.now()}`  // 生成简单的文件ID用于索引
      
      const fileInfo = {
        id: fileId,
        name: originalName,  // 使用修复后的原始文件名
        originalName: originalName,  // 添加原始文件名字段
        fileName: fileName,
        path: path.join(targetFolder, fileName),
        fullPath: targetPath,
        size: stats.size,
        type: file.mimetype || this.getMimeType(ext),
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime
      }
      
      logger.info(`[FileSystemManager] Uploaded file: ${fileName} to ${targetFolder}`)
      return fileInfo
    } catch (error) {
      logger.error(`[FileSystemManager] Failed to upload file:`, error)
      throw error
    }
  }

  /**
   * 移动文件或文件夹
   */
  async move(userId, sourcePath, targetPath) {
    try {
      const source = this.getUserPath(userId, sourcePath)
      const target = this.getUserPath(userId, targetPath)
      
      // 确保目标目录存在
      await fs.mkdir(path.dirname(target), { recursive: true })
      
      // 移动文件
      await fs.rename(source, target)
      
      logger.info(`[FileSystemManager] Moved from ${sourcePath} to ${targetPath}`)
      return {
        from: sourcePath,
        to: targetPath,
        success: true
      }
    } catch (error) {
      logger.error(`[FileSystemManager] Failed to move file:`, error)
      throw error
    }
  }

  /**
   * 复制文件或文件夹
   */
  async copy(userId, sourcePath, targetPath) {
    try {
      const source = this.getUserPath(userId, sourcePath)
      const target = this.getUserPath(userId, targetPath)
      
      // 确保目标目录存在
      await fs.mkdir(path.dirname(target), { recursive: true })
      
      // 复制文件
      await fs.copyFile(source, target)
      
      logger.info(`[FileSystemManager] Copied from ${sourcePath} to ${targetPath}`)
      return {
        from: sourcePath,
        to: targetPath,
        success: true
      }
    } catch (error) {
      logger.error(`[FileSystemManager] Failed to copy file:`, error)
      throw error
    }
  }

  /**
   * 删除文件或文件夹
   */
  async delete(userId, itemPath) {
    try {
      const fullPath = this.getUserPath(userId, itemPath)
      const stats = await fs.stat(fullPath)
      
      if (stats.isDirectory()) {
        await fs.rm(fullPath, { recursive: true, force: true })
      } else {
        await fs.unlink(fullPath)
      }
      
      // 删除相关缓存
      await this.deleteCacheFiles(userId, itemPath)
      
      logger.info(`[FileSystemManager] Deleted: ${itemPath}`)
      return {
        path: itemPath,
        deleted: true
      }
    } catch (error) {
      logger.error(`[FileSystemManager] Failed to delete:`, error)
      throw error
    }
  }

  /**
   * 重命名文件或文件夹
   */
  async rename(userId, oldPath, newName) {
    try {
      const dir = path.dirname(oldPath)
      const newPath = path.join(dir, newName)
      
      const source = this.getUserPath(userId, oldPath)
      const target = this.getUserPath(userId, newPath)
      
      await fs.rename(source, target)
      
      logger.info(`[FileSystemManager] Renamed from ${oldPath} to ${newPath}`)
      return {
        oldPath,
        newPath,
        success: true
      }
    } catch (error) {
      logger.error(`[FileSystemManager] Failed to rename:`, error)
      throw error
    }
  }

  /**
   * 获取目录内容
   */
  async getDirectoryContents(userId, dirPath = '') {
    try {
      const fullPath = this.getUserPath(userId, dirPath)
      
      // 确保目录存在
      try {
        await fs.access(fullPath)
      } catch (error) {
        // 如果目录不存在，创建它
        await fs.mkdir(fullPath, { recursive: true })
        logger.info(`[FileSystemManager] Created missing directory: ${fullPath}`)
        // 返回空数组，因为新创建的目录是空的
        return []
      }
      
      const items = await fs.readdir(fullPath, { withFileTypes: true })
      
      const contents = await Promise.all(
        items.map(async (item) => {
          // 修复文件名编码问题
          let fixedName = item.name
          
          // 如果文件名看起来像是被错误编码的（包含常见的乱码字符）
          if (/[àáâãäåæçèéêëìíîï]/.test(fixedName)) {
            try {
              // 尝试将Latin-1编码转换为UTF-8
              const buffer = Buffer.from(fixedName, 'latin1')
              const decoded = buffer.toString('utf8')
              // 验证解码后的字符串是否包含有效的中文字符
              if (/[\u4e00-\u9fa5]/.test(decoded)) {
                fixedName = decoded
              }
            } catch (e) {
              // 忽略错误，使用原始文件名
            }
          }
          
          const itemPath = path.join(dirPath, fixedName)
          const fullItemPath = path.join(fullPath, item.name)  // 使用原始名称访问文件系统
          const stats = await fs.stat(fullItemPath)
          
          return {
            name: fixedName,  // 使用修复后的名称
            originalName: fixedName,  // 添加原始文件名字段
            path: itemPath,
            isDirectory: item.isDirectory(),
            size: stats.size,
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime,
            type: item.isDirectory() ? 'folder' : this.getFileType(fixedName)
          }
        })
      )
      
      return contents.sort((a, b) => {
        // 文件夹优先
        if (a.isDirectory && !b.isDirectory) return -1
        if (!a.isDirectory && b.isDirectory) return 1
        // 按名称排序
        return a.name.localeCompare(b.name)
      })
    } catch (error) {
      logger.error(`[FileSystemManager] Failed to get directory contents:`, error)
      throw error
    }
  }

  /**
   * 获取目录树
   */
  async getDirectoryTree(userId, dirPath = '', maxDepth = 3, currentDepth = 0) {
    if (currentDepth >= maxDepth) {
      return null
    }

    try {
      const fullPath = this.getUserPath(userId, dirPath)
      
      // 确保目录存在
      try {
        await fs.access(fullPath)
      } catch (error) {
        // 如果目录不存在，创建它
        await fs.mkdir(fullPath, { recursive: true })
        logger.info(`[FileSystemManager] Created missing directory: ${fullPath}`)
      }
      
      const items = await fs.readdir(fullPath, { withFileTypes: true })
      
      const tree = {
        name: dirPath || 'assets',
        path: dirPath,
        isDirectory: true,
        children: []
      }
      
      for (const item of items) {
        if (item.name.startsWith('.')) continue // 跳过隐藏文件
        
        const itemPath = path.join(dirPath, item.name)
        
        if (item.isDirectory()) {
          const subTree = await this.getDirectoryTree(userId, itemPath, maxDepth, currentDepth + 1)
          if (subTree) {
            tree.children.push(subTree)
          }
        } else {
          tree.children.push({
            name: item.name,
            path: itemPath,
            isDirectory: false,
            type: this.getFileType(item.name)
          })
        }
      }
      
      return tree
    } catch (error) {
      logger.error(`[FileSystemManager] Failed to get directory tree:`, error)
      return null
    }
  }

  /**
   * 搜索文件
   */
  async searchFiles(userId, query, options = {}) {
    const {
      path: searchPath = '',
      type = null,
      limit = 100
    } = options

    const results = []
    const searchDir = this.getUserPath(userId, searchPath)
    
    async function search(dir) {
      if (results.length >= limit) return
      
      try {
        const items = await fs.readdir(dir, { withFileTypes: true })
        
        for (const item of items) {
          if (results.length >= limit) break
          
          const fullPath = path.join(dir, item.name)
          
          if (item.isDirectory() && !item.name.startsWith('.')) {
            await search(fullPath)
          } else if (item.name.toLowerCase().includes(query.toLowerCase())) {
            if (!type || this.getFileType(item.name) === type) {
              const stats = await fs.stat(fullPath)
              results.push({
                name: item.name,
                path: path.relative(searchDir, fullPath),
                size: stats.size,
                type: this.getFileType(item.name),
                modifiedAt: stats.mtime
              })
            }
          }
        }
      } catch (error) {
        // 忽略权限错误等
      }
    }
    
    await search.call(this, searchDir)
    return results
  }

  /**
   * 获取文件信息
   */
  async getFileInfo(userId, filePath) {
    try {
      const fullPath = this.getUserPath(userId, filePath)
      const stats = await fs.stat(fullPath)
      const name = path.basename(filePath)
      
      return {
        name,
        path: filePath,
        fullPath,
        size: stats.size,
        isDirectory: stats.isDirectory(),
        type: stats.isDirectory() ? 'folder' : this.getFileType(name),
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        accessedAt: stats.atime
      }
    } catch (error) {
      logger.error(`[FileSystemManager] Failed to get file info:`, error)
      throw error
    }
  }

  /**
   * 删除缓存文件
   */
  async deleteCacheFiles(userId, filePath) {
    try {
      const fileName = path.basename(filePath)
      const fileId = fileName.split('_')[0] // 提取文件ID
      
      // 删除缩略图
      const thumbnailPath = path.join(this.getCachePath(userId, 'thumbnails'), `${fileId}_*.jpg`)
      const previews = await fs.readdir(path.dirname(thumbnailPath))
      for (const preview of previews) {
        if (preview.startsWith(fileId)) {
          await fs.unlink(path.join(path.dirname(thumbnailPath), preview)).catch(() => {})
        }
      }
    } catch (error) {
      // 忽略缓存删除错误
    }
  }

  /**
   * 获取文件类型
   */
  getFileType(filename) {
    const ext = path.extname(filename).toLowerCase()
    const typeMap = {
      // 图片
      '.jpg': 'image', '.jpeg': 'image', '.png': 'image', '.gif': 'image',
      '.webp': 'image', '.svg': 'image', '.bmp': 'image', '.ico': 'image',
      // 视频
      '.mp4': 'video', '.avi': 'video', '.mov': 'video', '.wmv': 'video',
      '.flv': 'video', '.mkv': 'video', '.webm': 'video',
      // 音频
      '.mp3': 'audio', '.wav': 'audio', '.flac': 'audio', '.aac': 'audio',
      '.ogg': 'audio', '.wma': 'audio',
      // 文档
      '.pdf': 'pdf', '.doc': 'word', '.docx': 'word',
      '.xls': 'excel', '.xlsx': 'excel', '.ppt': 'powerpoint', '.pptx': 'powerpoint',
      '.txt': 'text', '.md': 'markdown',
      // 代码
      '.js': 'code', '.ts': 'code', '.jsx': 'code', '.tsx': 'code',
      '.css': 'code', '.html': 'code', '.json': 'code', '.xml': 'code',
      '.py': 'code', '.java': 'code', '.cpp': 'code', '.c': 'code',
      // 压缩包
      '.zip': 'archive', '.rar': 'archive', '.7z': 'archive', '.tar': 'archive',
      '.gz': 'archive'
    }
    return typeMap[ext] || 'file'
  }

  /**
   * 获取MIME类型
   */
  getMimeType(ext) {
    const mimeTypes = {
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
      '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
      '.mp4': 'video/mp4', '.avi': 'video/x-msvideo', '.mov': 'video/quicktime',
      '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.pdf': 'application/pdf',
      '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain',
      '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript'
    }
    return mimeTypes[ext.toLowerCase()] || 'application/octet-stream'
  }
}

// 导出单例
export default new FileSystemManager()