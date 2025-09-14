/**
 * Assets API V2 路由
 * 基于实际文件夹和Chokidar监控的新版资产管理API
 */

import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs/promises'
import AssetManager from '../../services/assets/AssetManager.js'
import EventProcessor from '../../services/assets/EventProcessor.js'
import logger from '../../utils/logger.js'
import { authenticateUser } from '../../middleware/userAuth.js'

const router = express.Router()

// Multer配置
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const tempDir = path.join(process.cwd(), 'temp')
    // 确保temp目录存在
    try {
      await fs.mkdir(tempDir, { recursive: true })
    } catch (error) {
      logger.error('[Assets V2] Failed to create temp directory:', error)
    }
    cb(null, tempDir)
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${file.originalname}`
    cb(null, uniqueName)
  }
})

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB
  }
})

// 中间件：确保AssetManager已初始化
router.use(async (req, res, next) => {
  try {
    if (!AssetManager.initialized) {
      await AssetManager.initialize()
    }
    next()
  } catch (error) {
    logger.error('[Assets V2] Failed to initialize AssetManager:', error)
    res.status(500).json({
      success: false,
      error: 'System initialization failed'
    })
  }
})

// 中间件：获取用户ID
router.use((req, res, next) => {
  req.userId = req.user?.id || req.user?.username || 'default'
  next()
})

/**
 * GET /api/v2/assets
 * 获取资产列表
 */
router.get('/', async (req, res) => {
  try {
    const { path: dirPath = '', type, search, limit = 100 } = req.query
    const userId = req.userId

    let results

    if (search) {
      // 搜索模式
      results = await AssetManager.searchFiles(userId, search, {
        type,
        folder: dirPath,
        limit: parseInt(limit)
      })
    } else {
      // 浏览模式
      results = await AssetManager.getDirectoryContents(userId, dirPath)
    }

    res.json({
      success: true,
      data: results
    })
  } catch (error) {
    logger.error('[Assets V2] Failed to get assets:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /api/v2/assets/tree
 * 获取目录树结构
 */
router.get('/tree', async (req, res) => {
  try {
    const { path: dirPath = '', depth = 3 } = req.query
    const userId = req.userId

    const tree = await AssetManager.getDirectoryTree(userId, dirPath, parseInt(depth))

    res.json({
      success: true,
      data: tree
    })
  } catch (error) {
    logger.error('[Assets V2] Failed to get directory tree:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /api/v2/assets/stats
 * 获取存储统计信息
 */
router.get('/stats', async (req, res) => {
  try {
    const userId = req.userId
    const stats = await AssetManager.getStorageStats(userId)

    res.json({
      success: true,
      data: stats
    })
  } catch (error) {
    logger.error('[Assets V2] Failed to get stats:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /api/v2/assets/search
 * 搜索文件
 */
router.get('/search', async (req, res) => {
  try {
    const { q, type, folder, limit = 50, sortBy = 'relevance' } = req.query
    const userId = req.userId

    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      })
    }

    const results = await AssetManager.searchFiles(userId, q, {
      type,
      folder,
      limit: parseInt(limit),
      sortBy
    })

    res.json({
      success: true,
      data: results
    })
  } catch (error) {
    logger.error('[Assets V2] Search failed:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /api/v2/assets/file
 * 获取文件详情
 */
router.get('/file', async (req, res) => {
  try {
    const filePath = req.query.path
    const userId = req.userId

    const fileInfo = await AssetManager.getFileInfo(userId, filePath)

    res.json({
      success: true,
      data: fileInfo
    })
  } catch (error) {
    logger.error('[Assets V2] Failed to get file info:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * POST /api/v2/assets/upload
 * 上传文件
 */
router.post('/upload', upload.array('files', 10), async (req, res) => {
  try {
    const { path: targetPath = '' } = req.body
    const userId = req.userId
    const files = req.files

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files provided'
      })
    }

    // 启动用户服务（如果未启动）
    await AssetManager.startForUser(userId)

    // 批量上传
    const results = await AssetManager.uploadFiles(userId, files, targetPath)

    // 清理临时文件
    for (const file of files) {
      try {
        await fs.unlink(file.path)
      } catch (err) {
        logger.warn('[Assets V2] Failed to clean temp file:', err)
      }
    }

    res.json({
      success: true,
      data: results
    })
  } catch (error) {
    logger.error('[Assets V2] Upload failed:', error)
    
    // 清理临时文件
    if (req.files) {
      for (const file of req.files) {
        try {
          await fs.unlink(file.path)
        } catch (e) {
          // 忽略错误
        }
      }
    }

    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * POST /api/v2/assets/folder
 * 创建文件夹
 */
router.post('/folder', async (req, res) => {
  try {
    const { path: folderPath, name } = req.body
    const userId = req.userId

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Folder name is required'
      })
    }

    const fullPath = folderPath ? `${folderPath}/${name}` : name
    const result = await AssetManager.createFolder(userId, fullPath)

    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    logger.error('[Assets V2] Failed to create folder:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * PUT /api/v2/assets/move
 * 移动文件或文件夹
 */
router.put('/move', async (req, res) => {
  try {
    const { source, target } = req.body
    const userId = req.userId

    if (!source || !target) {
      return res.status(400).json({
        success: false,
        error: 'Source and target paths are required'
      })
    }

    const result = await AssetManager.moveItem(userId, source, target)

    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    logger.error('[Assets V2] Failed to move item:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * PUT /api/v2/assets/rename
 * 重命名文件或文件夹
 */
router.put('/rename', async (req, res) => {
  try {
    const { path: itemPath, newName } = req.body
    const userId = req.userId

    if (!itemPath || !newName) {
      return res.status(400).json({
        success: false,
        error: 'Path and new name are required'
      })
    }

    const result = await AssetManager.renameItem(userId, itemPath, newName)

    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    logger.error('[Assets V2] Failed to rename item:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * DELETE /api/v2/assets
 * 删除文件或文件夹
 */
router.delete('/', async (req, res) => {
  try {
    const itemPath = req.query.path || req.body.path
    const userId = req.userId

    if (!itemPath) {
      return res.status(400).json({
        success: false,
        error: 'Path is required'
      })
    }

    const result = await AssetManager.deleteItem(userId, itemPath)

    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    logger.error('[Assets V2] Failed to delete item:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * POST /api/v2/assets/batch
 * 批量操作
 */
router.post('/batch', async (req, res) => {
  try {
    const { operation, items } = req.body
    const userId = req.userId

    if (!operation || !items || !Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid batch operation'
      })
    }

    const results = []
    const errors = []

    for (const item of items) {
      try {
        let result
        switch (operation) {
          case 'delete':
            result = await AssetManager.deleteItem(userId, item.path)
            break
          case 'move':
            result = await AssetManager.moveItem(userId, item.source, item.target)
            break
          default:
            throw new Error(`Unknown operation: ${operation}`)
        }
        results.push(result)
      } catch (error) {
        errors.push({
          item,
          error: error.message
        })
      }
    }

    res.json({
      success: true,
      data: {
        success: results,
        failed: errors
      }
    })
  } catch (error) {
    logger.error('[Assets V2] Batch operation failed:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * POST /api/v2/assets/optimize
 * 优化图片
 */
router.post('/optimize', async (req, res) => {
  try {
    const { path: filePath, width, height, quality, format } = req.body
    const userId = req.userId

    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: 'File path is required'
      })
    }

    const result = await AssetManager.optimizeImage(userId, filePath, {
      width,
      height,
      quality,
      format
    })

    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    logger.error('[Assets V2] Failed to optimize image:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * POST /api/v2/assets/rebuild-index
 * 重建索引
 */
router.post('/rebuild-index', async (req, res) => {
  try {
    const userId = req.userId

    const stats = await AssetManager.rebuildIndex(userId)

    res.json({
      success: true,
      data: stats
    })
  } catch (error) {
    logger.error('[Assets V2] Failed to rebuild index:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * POST /api/v2/assets/clear-cache
 * 清理缓存
 */
router.post('/clear-cache', async (req, res) => {
  try {
    const { type = 'all' } = req.body
    const userId = req.userId

    await AssetManager.clearCache(userId, type)

    res.json({
      success: true,
      message: 'Cache cleared successfully'
    })
  } catch (error) {
    logger.error('[Assets V2] Failed to clear cache:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /api/v2/assets/sse
 * Server-Sent Events for real-time updates
 */
router.get('/sse', (req, res) => {
  const userId = req.userId

  // 设置SSE响应头
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  })

  // 发送初始连接消息
  res.write(`event: connected\ndata: {"message": "Connected to asset updates"}\n\n`)

  // 注册SSE客户端
  AssetManager.registerSSEClient(userId, res)

  // 启动用户服务
  AssetManager.startForUser(userId).catch(error => {
    logger.error(`[Assets V2] Failed to start service for user ${userId}:`, error)
  })

  // 心跳保持连接
  const heartbeat = setInterval(() => {
    res.write(`event: heartbeat\ndata: {"timestamp": ${Date.now()}}\n\n`)
  }, 30000)

  // 清理
  req.on('close', () => {
    clearInterval(heartbeat)
    logger.info(`[Assets V2] SSE connection closed for user ${userId}`)
  })
})

/**
 * GET /api/v2/assets/metadata
 * 获取资产元数据（包含作品集）
 */
router.get('/metadata', async (req, res) => {
  try {
    const userId = req.userId
    logger.info(`[asset_metadata_debug] ===== Start Getting Metadata =====`)
    logger.info(`[asset_metadata_debug] User: ${userId}`)

    // 确保用户已初始化
    if (!AssetManager.activeUsers || !AssetManager.activeUsers.has(userId)) {
      logger.info(`[asset_metadata_debug] Initializing AssetManager for user ${userId}`)
      await AssetManager.startForUser(userId)
    }

    // 构建元数据结构 - 兼容前端期望的格式
    const metadata = {
      version: '3.0',  // 使用前端期望的版本号
      userId: userId,
      lastUpdated: new Date().toISOString(),
      assets: {},
      labels: {},
      tree: [],  // 添加前端期望的tree字段
      workspace: {}  // 作品集部分
    }

    // 直接扫描文件系统获取最新数据
    const fs = await import('fs/promises')
    const path = await import('path')
    const dataPath = process.env.DATA_PATH || path.join(process.cwd(), 'data')
    logger.info(`[asset_metadata_debug] Data path: ${dataPath}`)

    // 扫描作品集目录
    const workspacePath = path.join(dataPath, 'users', userId, 'workspace', 'card')
    logger.info(`[asset_metadata_debug] Scanning workspace path: ${workspacePath}`)

    try {
      await fs.access(workspacePath)
      logger.info(`[asset_metadata_debug] Workspace directory exists`)

      const workspaceDirs = await fs.readdir(workspacePath, { withFileTypes: true })
      logger.info(`[asset_metadata_debug] Found ${workspaceDirs.length} items in workspace`)

      for (const dir of workspaceDirs) {
        logger.info(`[asset_metadata_debug] Processing item: ${dir.name}, isDirectory: ${dir.isDirectory()}`)

        if (dir.isDirectory()) {
          const dirPath = path.join(workspacePath, dir.name)
          const files = await fs.readdir(dirPath, { withFileTypes: true })
          logger.info(`[asset_metadata_debug] Found ${files.length} items in ${dir.name}`)

          const categoryKey = `作品集_${dir.name.replace(/\//g, '_')}`
          const fileList = []

          for (const file of files) {
            if (!file.isDirectory()) {
              const filePath = path.join(dirPath, file.name)
              const stats = await fs.stat(filePath)

              const fileInfo = {
                name: file.name,
                fileName: file.name,
                path: `作品集/${dir.name}/${file.name}`,
                fullPath: filePath,
                type: getFileType(file.name),
                size: stats.size
              }

              fileList.push(fileInfo)
              logger.info(`[asset_metadata_debug] Added file: ${file.name}, type: ${fileInfo.type}`)
            }
          }

          if (fileList.length > 0) {
            metadata.assets[categoryKey] = fileList
            metadata.workspace[categoryKey] = fileList
            metadata.labels[categoryKey] = `${dir.name} (作品集)`
            logger.info(`[asset_metadata_debug] Added category: ${categoryKey} with ${fileList.length} files`)
          }
        }
      }
    } catch (error) {
      logger.info(`[asset_metadata_debug] Error accessing workspace: ${error.message}`)
    }

    // 扫描素材目录
    const assetsPath = path.join(dataPath, 'users', userId, 'assets')
    logger.info(`[asset_metadata_debug] Scanning assets path: ${assetsPath}`)

    try {
      await fs.access(assetsPath)
      logger.info(`[asset_metadata_debug] Assets directory exists`)

      const scanAssetsDir = async (dirPath, prefix = '') => {
        const items = await fs.readdir(dirPath, { withFileTypes: true })
        logger.info(`[asset_metadata_debug] Scanning ${dirPath}, found ${items.length} items`)

        for (const item of items) {
          if (item.isDirectory()) {
            const subDirPath = path.join(dirPath, item.name)
            const subPrefix = prefix ? `${prefix}_${item.name}` : item.name
            const files = await fs.readdir(subDirPath, { withFileTypes: true })
            logger.info(`[asset_metadata_debug] Scanning subdirectory ${item.name}, found ${files.length} items`)

            const fileList = []
            for (const file of files) {
              if (!file.isDirectory()) {
                const filePath = path.join(subDirPath, file.name)
                const stats = await fs.stat(filePath)
                const relativePath = prefix ? `${prefix}/${item.name}/${file.name}` : `${item.name}/${file.name}`

                fileList.push({
                  name: file.name,
                  fileName: file.name,
                  path: relativePath,
                  fullPath: filePath,
                  type: getFileType(file.name),
                  size: stats.size
                })
                logger.info(`[asset_metadata_debug] Added asset file: ${file.name}`)
              }
            }

            const categoryKey = subPrefix.replace(/\//g, '_')
            if (fileList.length > 0) {
              metadata.assets[categoryKey] = fileList
              metadata.labels[categoryKey] = item.name
              logger.info(`[asset_metadata_debug] Added asset category: ${categoryKey} with ${fileList.length} files`)
            }

            // 递归扫描子目录
            await scanAssetsDir(subDirPath, subPrefix)
          }
        }
      }

      await scanAssetsDir(assetsPath)
    } catch (error) {
      logger.info(`[asset_metadata_debug] Error accessing assets directory: ${error.message}`)
    }

    // 生成树结构（如果需要）
    metadata.tree = Object.keys(metadata.labels).map(key => ({
      key,
      label: metadata.labels[key],
      count: metadata.assets[key]?.length || 0
    }))
    logger.info(`[asset_metadata_debug] Generated tree with ${metadata.tree.length} categories`)

    // 辅助函数：获取文件类型
    function getFileType(filename) {
      const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase()
      const typeMap = {
        '.jpg': 'image', '.jpeg': 'image', '.png': 'image', '.gif': 'image',
        '.mp4': 'video', '.avi': 'video', '.mov': 'video',
        '.mp3': 'audio', '.wav': 'audio',
        '.pdf': 'pdf', '.doc': 'word', '.docx': 'word',
        '.html': 'html', '.htm': 'html', '.txt': 'text', '.json': 'json'
      }
      return typeMap[ext] || 'file'
    }

    logger.info(`[asset_metadata_debug] ===== Metadata Summary =====`)
    logger.info(`[asset_metadata_debug] Total categories: ${Object.keys(metadata.assets).length}`)
    logger.info(`[asset_metadata_debug] Categories: ${Object.keys(metadata.assets).join(', ')}`)
    logger.info(`[asset_metadata_debug] Workspace categories: ${Object.keys(metadata.workspace).length}`)
    logger.info(`[asset_metadata_debug] ===== End Metadata Generation =====`)

    res.json({
      success: true,
      data: metadata
    })
  } catch (error) {
    logger.error('[Assets V2] Failed to get metadata:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /api/v2/assets/status
 * 获取系统状态
 */
router.get('/status', (req, res) => {
  const status = AssetManager.getSystemStatus()
  
  res.json({
    success: true,
    data: status
  })
})

export default router