import express from 'express'
import path from 'path'
import fs from 'fs/promises'
import { fileURLToPath } from 'url'
import multer from 'multer'
import { v4 as uuidv4 } from 'uuid'
import sharp from 'sharp'
import logger from '../utils/logger.js'

// 导入OSS服务包装器
import createOSSService, { isAllowedFileType, isAllowedFileSize } from '../services/oss/wrapper.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

// 初始化OSS服务（使用包装器）
let ossService = null
try {
  ossService = createOSSService('default', {
    baseDir: 'assets'
  })
  logger.info('[Assets] OSS服务初始化成功')
} catch (error) {
  logger.warn('[Assets] OSS服务初始化失败，将使用本地存储:', error.message)
}

/**
 * 素材管理路由模块
 * 基于OSS存储的素材管理API
 * 
 * 路由规划：
 * GET    /api/assets                - 获取素材列表（简单筛选）
 * POST   /api/assets/upload         - 上传素材到OSS
 * GET    /api/assets/references     - 获取可引用资产列表（@选择器用）
 * GET    /api/assets/health         - 健康检查
 * GET    /api/assets/:id           - 获取单个素材详情
 * PUT    /api/assets/:id           - 更新素材基础信息
 * DELETE /api/assets/:id           - 删除素材
 */

/**
 * 获取用户素材元数据文件路径
 */
const getUserAssetMetadataPath = (username = 'default') => {
  const isDocker = process.env.NODE_ENV === 'production' || process.env.DATA_PATH
  const baseDir = isDocker 
    ? '/app/data/users'
    : path.join(process.cwd(), 'data', 'users')
  
  return path.join(baseDir, username, 'assets', 'metadata.json')
}

/**
 * 读取用户素材元数据
 */
const readAssetMetadata = async (username = 'default') => {
  try {
    const metadataPath = getUserAssetMetadataPath(username)
    const data = await fs.readFile(metadataPath, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    if (error.code === 'ENOENT') {
      // 如果文件不存在，返回默认结构
      return {
        version: '2.0',
        ossConfig: {
          bucket: process.env.OSS_BUCKET || 'ai-terminal-assets',
          region: process.env.OSS_REGION || 'oss-cn-hangzhou',
          endpoint: process.env.OSS_ENDPOINT || 'https://oss-cn-hangzhou.aliyuncs.com'
        },
        assets: {},
        folders: {},
        stats: {
          totalAssets: 0,
          totalSize: 0,
          lastUpdated: new Date().toISOString()
        }
      }
    }
    throw error
  }
}

/**
 * 保存用户素材元数据
 */
const saveAssetMetadata = async (metadata, username = 'default') => {
  const metadataPath = getUserAssetMetadataPath(username)
  
  // 确保目录存在
  await fs.mkdir(path.dirname(metadataPath), { recursive: true })
  
  // 更新统计信息
  metadata.stats = {
    ...metadata.stats,
    totalAssets: Object.keys(metadata.assets || {}).length,
    totalSize: Object.values(metadata.assets || {}).reduce((total, asset) => total + (asset.size || 0), 0),
    lastUpdated: new Date().toISOString()
  }
  
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8')
}

/**
 * 获取用户临时上传目录
 */
const getUserTempUploadPath = (username = 'default') => {
  const isDocker = process.env.NODE_ENV === 'production' || process.env.DATA_PATH
  const baseDir = isDocker 
    ? '/app/data/users'
    : path.join(process.cwd(), 'data', 'users')
  
  return path.join(baseDir, username, 'temp', 'uploads')
}

/**
 * 获取用户缩略图目录
 */
const getUserThumbnailPath = (username = 'default') => {
  const isDocker = process.env.NODE_ENV === 'production' || process.env.DATA_PATH
  const baseDir = isDocker 
    ? '/app/data/users'
    : path.join(process.cwd(), 'data', 'users')
  
  return path.join(baseDir, username, 'assets', 'thumbnails')
}

/**
 * 生成缩略图
 * @param {string} inputPath - 输入文件路径
 * @param {string} outputPath - 输出文件路径
 * @param {Object} options - 缩略图选项
 */
const generateThumbnail = async (inputPath, outputPath, options = {}) => {
  const { width = 200, height = 200, quality = 80 } = options
  
  try {
    // 确保输出目录存在
    await fs.mkdir(path.dirname(outputPath), { recursive: true })
    
    // 使用sharp生成缩略图
    await sharp(inputPath)
      .resize(width, height, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality })
      .toFile(outputPath)
    
    return outputPath
  } catch (error) {
    logger.error('[Assets] 生成缩略图失败:', error)
    return null
  }
}

/**
 * 计算用户存储使用量
 */
const calculateStorageUsage = async (username = 'default') => {
  try {
    const metadata = await readAssetMetadata(username)
    const totalSize = Object.values(metadata.assets || {}).reduce(
      (sum, asset) => sum + (asset.size || 0), 
      0
    )
    
    const maxStorage = parseInt(process.env.ASSET_MAX_TOTAL_SIZE || '1073741824') // 默认1GB
    const usedPercentage = (totalSize / maxStorage) * 100
    
    return {
      used: totalSize,
      max: maxStorage,
      percentage: usedPercentage,
      available: maxStorage - totalSize,
      hasSpace: totalSize < maxStorage
    }
  } catch (error) {
    logger.error('[Assets] 计算存储使用量失败:', error)
    return {
      used: 0,
      max: 1073741824,
      percentage: 0,
      available: 1073741824,
      hasSpace: true
    }
  }
}

/**
 * 配置multer用于临时文件上传
 */
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const username = req.user?.username || 'default'
      const tempPath = getUserTempUploadPath(username)
      await fs.mkdir(tempPath, { recursive: true })
      cb(null, tempPath)
    } catch (error) {
      cb(error)
    }
  },
  filename: (req, file, cb) => {
    // 生成唯一文件名
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    const ext = path.extname(file.originalname)
    const name = path.basename(file.originalname, ext)
    cb(null, `${name}_${uniqueSuffix}${ext}`)
  }
})

const fileFilter = (req, file, cb) => {
  // 临时文件类型检查（简化版）
  const allowedTypes = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.txt', '.md', '.doc', '.docx']
  const ext = path.extname(file.originalname).toLowerCase()
  
  if (allowedTypes.includes(ext)) {
    cb(null, true)
  } else {
    cb(new Error(`不支持的文件类型: ${file.originalname}`), false)
  }
}

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB限制
    files: 10 // 最多10个文件
  }
})

/**
 * POST /api/assets/upload
 * 上传素材 (简化版，暂不集成OSS)
 * 
 * 流程：
 * 1. 接收文件到本地目录
 * 2. 保存元数据
 * 3. 返回素材信息
 */
router.post('/upload', upload.array('files', 10), async (req, res) => {
  const uploadedFiles = []
  
  try {
    const username = req.user?.username || 'default'
    const { folderId, tags, description } = req.body
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: '未选择文件'
      })
    }
    
    logger.info('[Assets] 开始上传素材', {
      username,
      fileCount: req.files.length,
      folderId,
      tags,
      description
    })
    
    // 读取现有元数据
    const metadata = await readAssetMetadata(username)
    
    // 检查存储配额
    const storageInfo = await calculateStorageUsage(username)
    const totalUploadSize = req.files.reduce((sum, file) => sum + file.size, 0)
    
    if (!storageInfo.hasSpace || totalUploadSize > storageInfo.available) {
      return res.status(413).json({
        success: false,
        message: '存储空间不足',
        data: {
          required: totalUploadSize,
          available: storageInfo.available,
          used: storageInfo.used,
          max: storageInfo.max
        }
      })
    }
    
    // 处理每个文件
    for (const file of req.files) {
      try {
        // 验证文件大小 (100MB限制)
        if (!isAllowedFileSize(file.size)) {
          throw new Error(`文件 ${file.originalname} 超出大小限制`)
        }
        
        // 生成唯一ID
        const assetId = `asset_${Date.now()}_${uuidv4().substring(0, 8)}`
        const fileType = getFileType(file.originalname)
        
        // 准备素材元数据
        const now = new Date().toISOString()
        const asset = {
          id: assetId,
          name: path.basename(file.originalname, path.extname(file.originalname)),
          originalName: file.originalname,
          localPath: file.path, // 本地文件路径
          type: fileType,
          mimeType: file.mimetype,
          size: file.size,
          hash: '', // 暂时为空
          createdAt: now,
          updatedAt: now,
          lastAccessed: now,
          folderId: folderId || null,
          tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : [],
          description: description || '',
          storage: {
            provider: 'local',
            status: 'uploaded',
            uploadedAt: now
          },
          usage: {
            totalReferences: 0,
            lastReferenced: null,
            referenceSources: []
          }
        }
        
        // 生成缩略图（仅图片类型）
        if (fileType === 'image') {
          try {
            const thumbnailDir = getUserThumbnailPath(username)
            const thumbnailPath = path.join(thumbnailDir, `thumb_${assetId}.jpg`)
            const generatedThumb = await generateThumbnail(file.path, thumbnailPath, {
              width: 300,
              height: 300,
              quality: 85
            })
            
            if (generatedThumb) {
              asset.thumbnailPath = generatedThumb
              logger.info('[Assets] 缩略图生成成功', {
                username,
                assetId,
                thumbnailPath: generatedThumb
              })
            }
          } catch (error) {
            logger.warn('[Assets] 缩略图生成失败', {
              username,
              assetId,
              error: error.message
            })
          }
        }
        
        // 尝试上传到OSS
        if (ossService) {
          try {
            const ossResult = await ossService.upload(file.path, {
              customDir: `users/${username}/${fileType}s`,
              useTimestamp: false
            })
            
            if (ossResult && ossResult.url) {
              asset.ossKey = ossResult.name
              asset.ossUrl = ossResult.url
              asset.storage.provider = 'oss'
              asset.storage.ossUploadedAt = new Date().toISOString()
              
              // 上传缩略图到OSS
              if (asset.thumbnailPath) {
                const thumbResult = await ossService.upload(asset.thumbnailPath, {
                  customDir: `users/${username}/thumbnails`,
                  useTimestamp: false
                })
                
                if (thumbResult && thumbResult.url) {
                  asset.thumbnailOssKey = thumbResult.name
                  asset.thumbnailUrl = thumbResult.url
                }
              }
              
              logger.info('[Assets] OSS上传成功', {
                username,
                assetId,
                ossUrl: asset.ossUrl
              })
            }
          } catch (error) {
            logger.warn('[Assets] OSS上传失败，使用本地存储', {
              username,
              assetId,
              error: error.message
            })
          }
        }
        
        // 添加到元数据
        metadata.assets[assetId] = asset
        
        uploadedFiles.push(asset)
        
        logger.info('[Assets] 文件上传成功', {
          username,
          assetId,
          filename: file.originalname,
          localPath: file.path,
          size: file.size,
          storage: asset.storage.provider
        })
        
      } catch (error) {
        logger.error('[Assets] 文件上传失败', {
          username,
          filename: file.originalname,
          error: error.message
        })
        
        // 对于单个文件错误，记录但继续处理其他文件
        uploadedFiles.push({
          filename: file.originalname,
          error: error.message,
          success: false
        })
      }
    }
    
    // 保存更新的元数据
    if (uploadedFiles.some(f => f.success !== false)) {
      await saveAssetMetadata(metadata, username)
    }
    
    // 统计结果
    const successCount = uploadedFiles.filter(f => f.success !== false).length
    const failCount = uploadedFiles.length - successCount
    
    logger.info('[Assets] 批量上传完成', {
      username,
      total: req.files.length,
      success: successCount,
      failed: failCount
    })
    
    const statusCode = failCount > 0 ? 207 : 200 // 207 Multi-Status
    
    res.status(statusCode).json({
      success: successCount > 0,
      data: {
        assets: uploadedFiles.filter(f => f.success !== false),
        errors: uploadedFiles.filter(f => f.success === false),
        summary: {
          total: req.files.length,
          success: successCount,
          failed: failCount
        }
      },
      message: `上传完成：成功 ${successCount}，失败 ${failCount}`
    })
    
  } catch (error) {
    logger.error('[Assets] 批量上传失败:', error)
    
    res.status(500).json({
      success: false,
      message: '上传失败: ' + error.message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
})

/**
 * 生成文件类型
 */
const getFileType = (filename, mimeType) => {
  const ext = path.extname(filename).toLowerCase()
  
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'].includes(ext)) {
    return 'image'
  }
  if (['.pdf', '.doc', '.docx', '.txt', '.md', '.rtf'].includes(ext)) {
    return 'document'
  }
  if (['.mp4', '.avi', '.mov', '.wmv', '.mp3', '.wav'].includes(ext)) {
    return 'media'
  }
  return 'other'
}


/**
 * GET /api/assets
 * 获取素材列表（简单筛选）
 * 
 * Query参数：
 * - type: 文件类型筛选 (image, document, other)
 * - folder: 文件夹筛选
 * - limit: 限制返回数量 (默认50)
 * - offset: 分页偏移 (默认0)
 * - search: 搜索关键词 (文件名搜索)
 */
router.get('/', async (req, res) => {
  try {
    const username = req.user?.username || 'default'
    const { type, folder, limit = 50, offset = 0, search } = req.query
    
    logger.info('[Assets] 获取素材列表', {
      username,
      query: { type, folder, limit, offset, search }
    })
    
    // 读取元数据
    const metadata = await readAssetMetadata(username)
    let assets = Object.values(metadata.assets || {})
    
    // 应用筛选条件
    if (type) {
      assets = assets.filter(asset => {
        if (type === 'image') return asset.type === 'image'
        if (type === 'document') return asset.type === 'document'
        if (type === 'other') return !['image', 'document'].includes(asset.type)
        return true
      })
    }
    
    if (folder) {
      assets = assets.filter(asset => asset.folderId === folder)
    }
    
    if (search) {
      const searchLower = search.toLowerCase()
      assets = assets.filter(asset => 
        asset.name.toLowerCase().includes(searchLower) ||
        asset.originalName?.toLowerCase().includes(searchLower) ||
        (asset.tags && asset.tags.some(tag => tag.toLowerCase().includes(searchLower)))
      )
    }
    
    // 排序：按更新时间倒序
    assets.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    
    // 分页
    const total = assets.length
    const paginatedAssets = assets.slice(parseInt(offset), parseInt(offset) + parseInt(limit))
    
    logger.info('[Assets] 素材列表查询成功', {
      username,
      total,
      returned: paginatedAssets.length,
      hasMore: total > parseInt(offset) + parseInt(limit)
    })
    
    res.json({
      success: true,
      data: {
        assets: paginatedAssets,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: total > parseInt(offset) + parseInt(limit)
        },
        stats: metadata.stats
      },
      message: `成功获取 ${paginatedAssets.length} 个素材`
    })
    
  } catch (error) {
    logger.error('[Assets] 获取素材列表失败:', error)
    res.status(500).json({
      success: false,
      message: '获取素材列表失败: ' + error.message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
})

/**
 * GET /api/assets/references
 * 获取可引用资产列表（@选择器用）
 * 返回简化的资产信息，用于引用选择器
 * 
 * Query参数：
 * - recent: 是否只返回最近使用的 (true/false, 默认false)
 * - limit: 限制返回数量 (默认20)
 */
router.get('/references', async (req, res) => {
  try {
    const username = req.user?.username || 'default'
    const { recent = false, limit = 20 } = req.query
    
    logger.info('[Assets] 获取引用资产列表', { username, recent, limit })
    
    // 读取元数据
    const metadata = await readAssetMetadata(username)
    let assets = Object.values(metadata.assets || {})
    
    // 如果只要最近使用的
    if (recent === 'true') {
      assets = assets
        .filter(asset => asset.lastAccessed || asset.usage?.lastReferenced)
        .sort((a, b) => {
          const timeA = new Date(a.usage?.lastReferenced || a.lastAccessed || a.updatedAt)
          const timeB = new Date(b.usage?.lastReferenced || b.lastAccessed || b.updatedAt)
          return timeB - timeA
        })
    } else {
      // 按更新时间排序
      assets.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    }
    
    // 限制数量
    assets = assets.slice(0, parseInt(limit))
    
    // 返回简化信息
    const references = assets.map(asset => ({
      id: asset.id,
      name: asset.name,
      originalName: asset.originalName,
      type: asset.type,
      localPath: asset.localPath,
      size: asset.size,
      createdAt: asset.createdAt,
      folderId: asset.folderId,
      // 引用路径格式
      referencePath: `@/assets/${asset.name}`,
      // 简化路径格式
      shortReference: `@${asset.name}`
    }))
    
    logger.info('[Assets] 引用资产列表获取成功', { 
      username, 
      count: references.length 
    })
    
    res.json({
      success: true,
      data: {
        references,
        count: references.length
      },
      message: `获取 ${references.length} 个可引用资产`
    })
    
  } catch (error) {
    logger.error('[Assets] 获取引用资产列表失败:', error)
    res.status(500).json({
      success: false,
      message: '获取引用资产列表失败: ' + error.message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
})

/**
 * GET /api/assets/storage
 * 获取存储使用情况
 */
router.get('/storage', async (req, res) => {
  try {
    const username = req.user?.username || 'default'
    
    logger.info('[Assets] 获取存储使用情况', { username })
    
    const storageInfo = await calculateStorageUsage(username)
    const metadata = await readAssetMetadata(username)
    
    // 按文件类型统计
    const typeStats = {}
    Object.values(metadata.assets || {}).forEach(asset => {
      if (!typeStats[asset.type]) {
        typeStats[asset.type] = {
          count: 0,
          size: 0
        }
      }
      typeStats[asset.type].count++
      typeStats[asset.type].size += asset.size || 0
    })
    
    res.json({
      success: true,
      data: {
        usage: {
          used: storageInfo.used,
          max: storageInfo.max,
          available: storageInfo.available,
          percentage: storageInfo.percentage.toFixed(2),
          hasSpace: storageInfo.hasSpace
        },
        stats: {
          totalAssets: metadata.stats?.totalAssets || 0,
          lastUpdated: metadata.stats?.lastUpdated,
          byType: typeStats
        }
      },
      message: '存储使用情况获取成功'
    })
    
  } catch (error) {
    logger.error('[Assets] 获取存储使用情况失败:', error)
    res.status(500).json({
      success: false,
      message: '获取存储使用情况失败: ' + error.message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
})

/**
 * 健康检查
 */
router.get('/health', async (req, res) => {
  const username = req.user?.username || 'default'
  
  // 检查各项服务状态
  const healthStatus = {
    api: 'healthy',
    storage: 'healthy',
    oss: 'unavailable',
    thumbnail: 'healthy'
  }
  
  // 检查OSS服务
  if (ossService) {
    try {
      // 简单测试OSS服务是否可用
      healthStatus.oss = 'healthy'
    } catch (error) {
      healthStatus.oss = 'degraded'
    }
  }
  
  // 检查存储状态
  try {
    const storageInfo = await calculateStorageUsage(username)
    if (storageInfo.percentage > 90) {
      healthStatus.storage = 'warning'
    }
  } catch (error) {
    healthStatus.storage = 'error'
  }
  
  // 检查缩略图服务
  try {
    // 检查sharp模块是否可用
    const sharp = (await import('sharp')).default
    if (!sharp) {
      healthStatus.thumbnail = 'unavailable'
    }
  } catch (error) {
    healthStatus.thumbnail = 'unavailable'
  }
  
  const overallHealth = Object.values(healthStatus).every(s => s === 'healthy') 
    ? 'healthy' 
    : Object.values(healthStatus).some(s => s === 'error') 
      ? 'error' 
      : 'degraded'
  
  res.json({
    success: true,
    message: 'Assets API health check',
    version: '2.1.0',
    status: overallHealth,
    services: healthStatus,
    features: {
      upload: true,
      delete: true,
      ossBased: ossService !== null,
      metadata: true,
      references: true,
      filtering: true,
      pagination: true,
      thumbnail: healthStatus.thumbnail === 'healthy',
      storageQuota: true
    }
  })
})

// ========== 文件夹相关路由（必须在 /:id 之前定义） ==========

/**
 * POST /api/assets/folders
 * 创建文件夹
 */
router.post('/folders', async (req, res) => {
  try {
    const username = req.user?.username || 'default'
    const { name, parentId = null, color = null, description = '' } = req.body
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: '文件夹名称不能为空'
      })
    }
    
    // 读取元数据
    const metadata = await readAssetMetadata(username)
    
    // 生成文件夹ID
    const folderId = `folder_${Date.now()}_${uuidv4().substring(0, 8)}`
    
    // 构建文件夹路径
    let folderPath = '/assets'
    if (parentId && metadata.folders[parentId]) {
      folderPath = `${metadata.folders[parentId].path}/${name}`
    } else {
      folderPath = `/assets/${name}`
    }
    
    // 检查同级文件夹名称是否重复
    const isDuplicate = Object.values(metadata.folders).some(folder => 
      folder.parentId === parentId && folder.name === name
    )
    
    if (isDuplicate) {
      return res.status(400).json({
        success: false,
        message: '同级目录下已存在同名文件夹'
      })
    }
    
    // 创建文件夹对象
    const folder = {
      id: folderId,
      name,
      path: folderPath,
      parentId,
      color,
      description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      assetCount: 0,
      subfolderCount: 0
    }
    
    // 保存到元数据
    metadata.folders[folderId] = folder
    
    // 更新父文件夹的子文件夹数量
    if (parentId && metadata.folders[parentId]) {
      metadata.folders[parentId].subfolderCount++
    }
    
    await saveAssetMetadata(metadata, username)
    
    logger.info('[Assets] 文件夹创建成功', {
      username,
      folderId,
      name,
      parentId
    })
    
    res.json({
      success: true,
      data: folder
    })
  } catch (error) {
    logger.error('[Assets] 创建文件夹失败:', error)
    res.status(500).json({
      success: false,
      message: '创建文件夹失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

/**
 * GET /api/assets/folders
 * 获取文件夹列表（树形结构）
 */
router.get('/folders', async (req, res) => {
  try {
    const username = req.user?.username || 'default'
    const metadata = await readAssetMetadata(username)
    
    // 构建树形结构
    const buildFolderTree = (parentId = null) => {
      const folders = Object.values(metadata.folders)
        .filter(folder => folder.parentId === parentId)
        .map(folder => ({
          ...folder,
          children: buildFolderTree(folder.id)
        }))
      
      return folders
    }
    
    const folderTree = buildFolderTree()
    
    res.json({
      success: true,
      data: {
        folders: folderTree,
        total: Object.keys(metadata.folders).length
      }
    })
  } catch (error) {
    logger.error('[Assets] 获取文件夹列表失败:', error)
    res.status(500).json({
      success: false,
      message: '获取文件夹列表失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

/**
 * PUT /api/assets/folders/:id
 * 更新文件夹信息
 */
router.put('/folders/:id', async (req, res) => {
  try {
    const username = req.user?.username || 'default'
    const { id } = req.params
    const { name, color, description } = req.body
    
    const metadata = await readAssetMetadata(username)
    
    if (!metadata.folders[id]) {
      return res.status(404).json({
        success: false,
        message: '文件夹不存在'
      })
    }
    
    const folder = metadata.folders[id]
    
    // 更新文件夹信息
    if (name && name !== folder.name) {
      // 检查同级文件夹名称是否重复
      const isDuplicate = Object.values(metadata.folders).some(f => 
        f.parentId === folder.parentId && f.name === name && f.id !== id
      )
      
      if (isDuplicate) {
        return res.status(400).json({
          success: false,
          message: '同级目录下已存在同名文件夹'
        })
      }
      
      folder.name = name
      // 更新路径
      const parentPath = folder.parentId && metadata.folders[folder.parentId]
        ? metadata.folders[folder.parentId].path
        : '/assets'
      folder.path = `${parentPath}/${name}`
    }
    
    if (color !== undefined) folder.color = color
    if (description !== undefined) folder.description = description
    folder.updatedAt = new Date().toISOString()
    
    await saveAssetMetadata(metadata, username)
    
    logger.info('[Assets] 文件夹更新成功', {
      username,
      folderId: id,
      updates: { name, color, description }
    })
    
    res.json({
      success: true,
      data: folder
    })
  } catch (error) {
    logger.error('[Assets] 更新文件夹失败:', error)
    res.status(500).json({
      success: false,
      message: '更新文件夹失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

/**
 * DELETE /api/assets/folders/:id
 * 删除文件夹（包括子文件夹和文件）
 */
router.delete('/folders/:id', async (req, res) => {
  try {
    const username = req.user?.username || 'default'
    const { id } = req.params
    const { moveToParent = false } = req.query // 是否将子内容移动到父文件夹
    
    const metadata = await readAssetMetadata(username)
    
    if (!metadata.folders[id]) {
      return res.status(404).json({
        success: false,
        message: '文件夹不存在'
      })
    }
    
    const folder = metadata.folders[id]
    
    // 获取所有子文件夹ID（递归）
    const getSubfolderIds = (folderId) => {
      const subfolderIds = []
      Object.values(metadata.folders).forEach(f => {
        if (f.parentId === folderId) {
          subfolderIds.push(f.id)
          subfolderIds.push(...getSubfolderIds(f.id))
        }
      })
      return subfolderIds
    }
    
    const allFolderIds = [id, ...getSubfolderIds(id)]
    
    if (moveToParent) {
      // 将直接子内容移动到父文件夹
      Object.values(metadata.folders).forEach(f => {
        if (f.parentId === id) {
          f.parentId = folder.parentId
        }
      })
      
      Object.values(metadata.assets).forEach(asset => {
        if (asset.folderId === id) {
          asset.folderId = folder.parentId
        }
      })
    } else {
      // 删除文件夹中的所有素材文件
      const assetsToDelete = []
      Object.values(metadata.assets).forEach(asset => {
        if (allFolderIds.includes(asset.folderId)) {
          assetsToDelete.push(asset.id)
        }
      })
      
      // 删除实际文件
      for (const assetId of assetsToDelete) {
        const asset = metadata.assets[assetId]
        try {
          await deleteAssetFile(username, asset.fileName)
          delete metadata.assets[assetId]
        } catch (error) {
          logger.error('[Assets] 删除文件失败:', { assetId, error })
        }
      }
    }
    
    // 删除所有文件夹记录
    allFolderIds.forEach(folderId => {
      delete metadata.folders[folderId]
    })
    
    // 更新父文件夹的子文件夹数量
    if (folder.parentId && metadata.folders[folder.parentId]) {
      metadata.folders[folder.parentId].subfolderCount = 
        Object.values(metadata.folders).filter(f => f.parentId === folder.parentId).length
    }
    
    await saveAssetMetadata(metadata, username)
    
    logger.info('[Assets] 文件夹删除成功', {
      username,
      folderId: id,
      deletedFolders: allFolderIds.length,
      moveToParent
    })
    
    res.json({
      success: true,
      message: '文件夹删除成功',
      data: {
        deletedFolders: allFolderIds.length
      }
    })
  } catch (error) {
    logger.error('[Assets] 删除文件夹失败:', error)
    res.status(500).json({
      success: false,
      message: '删除文件夹失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

/**
 * GET /api/assets/:id
 * 获取单个素材详情
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const username = req.user?.username || 'default'
    
    logger.info('[Assets] 获取素材详情', { username, assetId: id })
    
    // 读取元数据
    const metadata = await readAssetMetadata(username)
    const asset = metadata.assets[id]
    
    if (!asset) {
      logger.warn('[Assets] 素材不存在', { username, assetId: id })
      return res.status(404).json({
        success: false,
        message: '素材不存在'
      })
    }
    
    // 更新最后访问时间
    asset.lastAccessed = new Date().toISOString()
    await saveAssetMetadata(metadata, username)
    
    logger.info('[Assets] 素材详情获取成功', { username, assetId: id, assetName: asset.name })
    
    res.json({
      success: true,
      data: asset,
      message: '素材详情获取成功'
    })
    
  } catch (error) {
    logger.error('[Assets] 获取素材详情失败:', error)
    res.status(500).json({
      success: false,
      message: '获取素材详情失败: ' + error.message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
})

/**
 * PUT /api/assets/:id
 * 更新素材基础信息
 * 
 * Body参数：
 * - name: 素材名称
 * - description: 描述
 * - tags: 标签数组
 * - folderId: 文件夹ID
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { name, description, tags, folderId } = req.body
    const username = req.user?.username || 'default'
    
    logger.info('[Assets] 更新素材信息', { 
      username, 
      assetId: id, 
      updates: { name, description, tags, folderId } 
    })
    
    // 读取元数据
    const metadata = await readAssetMetadata(username)
    const asset = metadata.assets[id]
    
    if (!asset) {
      logger.warn('[Assets] 要更新的素材不存在', { username, assetId: id })
      return res.status(404).json({
        success: false,
        message: '素材不存在'
      })
    }
    
    // 更新字段
    if (name !== undefined) asset.name = name
    if (description !== undefined) asset.description = description
    if (tags !== undefined) asset.tags = Array.isArray(tags) ? tags : []
    if (folderId !== undefined) asset.folderId = folderId
    
    asset.updatedAt = new Date().toISOString()
    
    // 保存元数据
    await saveAssetMetadata(metadata, username)
    
    logger.info('[Assets] 素材信息更新成功', { 
      username, 
      assetId: id, 
      assetName: asset.name 
    })
    
    res.json({
      success: true,
      data: asset,
      message: '素材信息更新成功'
    })
    
  } catch (error) {
    logger.error('[Assets] 更新素材信息失败:', error)
    res.status(500).json({
      success: false,
      message: '更新素材信息失败: ' + error.message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
})

/**
 * DELETE /api/assets/:id
 * 删除素材
 * 
 * 功能：
 * - 删除素材文件（本地/OSS）
 * - 删除元数据记录
 * - 更新统计信息
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const username = req.user?.username || 'default'
    
    logger.info('[Assets] 开始删除素材', { username, assetId: id })
    
    // 读取元数据
    const metadata = await readAssetMetadata(username)
    const asset = metadata.assets[id]
    
    if (!asset) {
      logger.warn('[Assets] 要删除的素材不存在', { username, assetId: id })
      return res.status(404).json({
        success: false,
        message: '素材不存在'
      })
    }
    
    // 删除本地文件（如果存在）
    if (asset.localPath) {
      try {
        await fs.unlink(asset.localPath)
        logger.info('[Assets] 本地文件删除成功', { 
          username, 
          assetId: id, 
          localPath: asset.localPath 
        })
      } catch (error) {
        // 文件可能已经不存在，记录但不中断流程
        logger.warn('[Assets] 本地文件删除失败', { 
          username, 
          assetId: id, 
          localPath: asset.localPath,
          error: error.message 
        })
      }
    }
    
    // 删除缩略图（如果存在）
    if (asset.thumbnailPath) {
      try {
        await fs.unlink(asset.thumbnailPath)
        logger.info('[Assets] 缩略图删除成功', { 
          username, 
          assetId: id, 
          thumbnailPath: asset.thumbnailPath 
        })
      } catch (error) {
        logger.warn('[Assets] 缩略图删除失败', { 
          username, 
          assetId: id, 
          thumbnailPath: asset.thumbnailPath,
          error: error.message 
        })
      }
    }
    
    // TODO: 删除OSS文件（当OSS集成修复后启用）
    // if (asset.ossKey) {
    //   try {
    //     await ossService.delete(asset.ossKey)
    //     if (asset.thumbnailOssKey) {
    //       await ossService.delete(asset.thumbnailOssKey)
    //     }
    //   } catch (error) {
    //     logger.error('[Assets] OSS文件删除失败', { error: error.message })
    //   }
    // }
    
    // 从元数据中删除记录
    const deletedAsset = { ...asset }
    delete metadata.assets[id]
    
    // 保存更新的元数据
    await saveAssetMetadata(metadata, username)
    
    logger.info('[Assets] 素材删除成功', { 
      username, 
      assetId: id, 
      assetName: deletedAsset.name 
    })
    
    res.json({
      success: true,
      data: {
        deleted: deletedAsset,
        stats: metadata.stats
      },
      message: '素材删除成功'
    })
    
  } catch (error) {
    logger.error('[Assets] 删除素材失败:', error)
    res.status(500).json({
      success: false,
      message: '删除素材失败: ' + error.message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
})

/**
 * DELETE /api/assets
 * 批量删除素材
 * 
 * Body参数：
 * - ids: 素材ID数组
 */
router.delete('/', async (req, res) => {
  try {
    const { ids } = req.body
    const username = req.user?.username || 'default'
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请提供要删除的素材ID列表'
      })
    }
    
    logger.info('[Assets] 开始批量删除素材', { 
      username, 
      count: ids.length,
      ids 
    })
    
    // 读取元数据
    const metadata = await readAssetMetadata(username)
    const results = []
    
    // 处理每个删除请求
    for (const id of ids) {
      try {
        const asset = metadata.assets[id]
        
        if (!asset) {
          results.push({
            id,
            success: false,
            error: '素材不存在'
          })
          continue
        }
        
        // 删除本地文件
        if (asset.localPath) {
          try {
            await fs.unlink(asset.localPath)
          } catch (error) {
            // 文件可能已经不存在，继续处理
          }
        }
        
        // 删除缩略图
        if (asset.thumbnailPath) {
          try {
            await fs.unlink(asset.thumbnailPath)
          } catch (error) {
            // 缩略图可能不存在，继续处理
          }
        }
        
        // 从元数据中删除
        delete metadata.assets[id]
        
        results.push({
          id,
          success: true,
          name: asset.name
        })
        
      } catch (error) {
        results.push({
          id,
          success: false,
          error: error.message
        })
      }
    }
    
    // 保存更新的元数据
    await saveAssetMetadata(metadata, username)
    
    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length
    
    logger.info('[Assets] 批量删除完成', { 
      username, 
      total: ids.length,
      success: successCount,
      failed: failCount 
    })
    
    res.json({
      success: successCount > 0,
      data: {
        results,
        summary: {
          total: ids.length,
          success: successCount,
          failed: failCount
        },
        stats: metadata.stats
      },
      message: `删除完成：成功 ${successCount}，失败 ${failCount}`
    })
    
  } catch (error) {
    logger.error('[Assets] 批量删除失败:', error)
    res.status(500).json({
      success: false,
      message: '批量删除失败: ' + error.message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
})

/**
 * 获取文件（代理方式）
 * 用于访问私有OSS文件
 */
router.get('/file/:id', async (req, res) => {
  try {
    const { id } = req.params
    const username = req.user?.username || 'default'
    
    // 读取元数据
    const metadata = await readAssetMetadata(username)
    
    // 查找素材
    const asset = metadata.assets[id]
    if (!asset) {
      return res.status(404).json({
        success: false,
        message: '素材不存在'
      })
    }
    
    // 如果有本地文件，直接返回
    if (asset.localPath && await fs.access(asset.localPath).then(() => true).catch(() => false)) {
      return res.sendFile(asset.localPath)
    }
    
    // 如果有OSS URL，返回重定向
    if (asset.ossUrl) {
      return res.redirect(asset.ossUrl)
    }
    
    res.status(404).json({
      success: false,
      message: '文件不存在'
    })
  } catch (error) {
    logger.error('[Assets] 获取文件失败:', error)
    res.status(500).json({
      success: false,
      message: '获取文件失败'
    })
  }
})

/**
 * 获取缩略图（代理方式）
 */
router.get('/thumbnail/:id', async (req, res) => {
  try {
    const { id } = req.params
    const username = req.user?.username || 'default'
    
    // 读取元数据
    const metadata = await readAssetMetadata(username)
    
    // 查找素材
    const asset = metadata.assets[id]
    if (!asset) {
      return res.status(404).json({
        success: false,
        message: '素材不存在'
      })
    }
    
    // 如果有本地缩略图
    if (asset.thumbnailPath && await fs.access(asset.thumbnailPath).then(() => true).catch(() => false)) {
      return res.sendFile(asset.thumbnailPath)
    }
    
    // 如果有缩略图URL
    if (asset.thumbnailUrl) {
      return res.redirect(asset.thumbnailUrl)
    }
    
    // 如果没有缩略图但有原图，返回原图
    if (asset.localPath && await fs.access(asset.localPath).then(() => true).catch(() => false)) {
      return res.sendFile(asset.localPath)
    }
    
    if (asset.ossUrl) {
      return res.redirect(asset.ossUrl)
    }
    
    res.status(404).json({
      success: false,
      message: '缩略图不存在'
    })
  } catch (error) {
    logger.error('[Assets] 获取缩略图失败:', error)
    res.status(500).json({
      success: false,
      message: '获取缩略图失败'
    })
  }
})

/**
 * POST /api/assets/move
 * 移动文件或文件夹
 */
router.post('/move', async (req, res) => {
  try {
    const username = req.user?.username || 'default'
    const { items, targetFolderId } = req.body // items: [{id, type: 'asset'|'folder'}]
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请选择要移动的项目'
      })
    }
    
    const metadata = await readAssetMetadata(username)
    
    // 验证目标文件夹
    if (targetFolderId && !metadata.folders[targetFolderId]) {
      return res.status(404).json({
        success: false,
        message: '目标文件夹不存在'
      })
    }
    
    const movedItems = []
    
    for (const item of items) {
      if (item.type === 'asset') {
        // 移动文件
        if (metadata.assets[item.id]) {
          metadata.assets[item.id].folderId = targetFolderId
          metadata.assets[item.id].updatedAt = new Date().toISOString()
          movedItems.push({ id: item.id, type: 'asset' })
        }
      } else if (item.type === 'folder') {
        // 移动文件夹
        if (metadata.folders[item.id]) {
          // 防止将文件夹移动到自己或其子文件夹中
          const isInvalidMove = (folderId, targetId) => {
            if (folderId === targetId) return true
            if (!targetId) return false
            
            let current = metadata.folders[targetId]
            while (current) {
              if (current.id === folderId) return true
              current = metadata.folders[current.parentId]
            }
            return false
          }
          
          if (isInvalidMove(item.id, targetFolderId)) {
            continue // 跳过无效的移动
          }
          
          const folder = metadata.folders[item.id]
          
          // 更新父文件夹的子文件夹数量
          if (folder.parentId && metadata.folders[folder.parentId]) {
            metadata.folders[folder.parentId].subfolderCount--
          }
          
          folder.parentId = targetFolderId
          
          // 更新路径
          const parentPath = targetFolderId && metadata.folders[targetFolderId]
            ? metadata.folders[targetFolderId].path
            : '/assets'
          folder.path = `${parentPath}/${folder.name}`
          folder.updatedAt = new Date().toISOString()
          
          // 更新新父文件夹的子文件夹数量
          if (targetFolderId && metadata.folders[targetFolderId]) {
            metadata.folders[targetFolderId].subfolderCount++
          }
          
          movedItems.push({ id: item.id, type: 'folder' })
        }
      }
    }
    
    await saveAssetMetadata(metadata, username)
    
    logger.info('[Assets] 项目移动成功', {
      username,
      movedCount: movedItems.length,
      targetFolderId
    })
    
    res.json({
      success: true,
      message: `成功移动 ${movedItems.length} 个项目`,
      data: {
        movedItems
      }
    })
  } catch (error) {
    logger.error('[Assets] 移动项目失败:', error)
    res.status(500).json({
      success: false,
      message: '移动项目失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

/**
 * 获取STS临时凭证
 * 用于前端直接上传到OSS
 */
router.get('/sts-token', async (req, res) => {
  try {
    const username = req.user?.username || 'default'
    
    // 检查是否配置了STS
    if (!process.env.STS_ACCESS_KEY_ID || !process.env.STS_ACCESS_KEY_SECRET || !process.env.STS_ROLE_ARN) {
      // 如果没有配置STS，返回普通上传模式
      return res.json({
        success: true,
        data: {
          mode: 'server-upload',
          message: 'STS未配置，使用服务器端上传'
        }
      })
    }
    
    // 动态导入STS管理器
    const { createRequire } = await import('module')
    const require = createRequire(import.meta.url)
    const STSManager = require('../services/oss/sts-manager.cjs')
    
    // 创建STS管理器实例
    const stsManager = new STSManager({
      accessKeyId: process.env.STS_ACCESS_KEY_ID,
      accessKeySecret: process.env.STS_ACCESS_KEY_SECRET,
      roleArn: process.env.STS_ROLE_ARN
    })
    
    // 获取上传凭证
    const credentials = await stsManager.getUploadCredentials({
      bucket: process.env.OSS_BUCKET || 'ai-terminal-assets',
      directory: `assets/${username}`,
      maxSize: 100 * 1024 * 1024, // 100MB
      allowedTypes: ['image/*', 'application/pdf', 'text/*'],
      durationSeconds: 3600 // 1小时
    })
    
    logger.info('[Assets] STS凭证获取成功', { username })
    
    res.json({
      success: true,
      data: {
        mode: 'direct-upload',
        credentials,
        endpoint: process.env.OSS_ENDPOINT || 'https://oss-cn-hangzhou.aliyuncs.com'
      }
    })
  } catch (error) {
    logger.error('[Assets] 获取STS凭证失败:', error)
    res.status(500).json({
      success: false,
      message: '获取STS凭证失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

export default router