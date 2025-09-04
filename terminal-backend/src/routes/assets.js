/**
 * 素材管理路由 - 简化版
 * 基于 assets-metadata-final-solution.md 方案实现
 * 
 * 核心理念：
 * 1. 使用分类标识符（如 projects.designs）而不是文件夹ID
 * 2. 元数据最小化，只存储必要信息
 * 3. 文件名即是真实名称，无需ID映射
 */

import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs/promises'
import { v4 as uuidv4 } from 'uuid'
import logger from '../utils/logger.js'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

// ========== 配置 ==========
const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']

// ========== 辅助函数 ==========

/**
 * 获取用户存储根目录
 */
const getUserStoragePath = (username = 'default') => {
  const isDocker = process.env.NODE_ENV === 'production' || process.env.DATA_PATH
  const baseDir = isDocker 
    ? '/app/data/users'
    : path.join(process.cwd(), 'data', 'users')
  return path.join(baseDir, username, 'storage')
}

/**
 * 获取用户元数据文件路径
 */
const getUserMetadataPath = (username = 'default') => {
  const isDocker = process.env.NODE_ENV === 'production' || process.env.DATA_PATH
  const baseDir = isDocker 
    ? '/app/data/users'
    : path.join(process.cwd(), 'data', 'users')
  return path.join(baseDir, username, 'assets_metadata.json')
}

/**
 * 读取元数据
 */
const readMetadata = async (username = 'default') => {
  try {
    const metadataPath = getUserMetadataPath(username)
    const data = await fs.readFile(metadataPath, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    if (error.code === 'ENOENT') {
      // 文件不存在，返回默认结构
      return {
        version: '3.0',
        userId: username,
        lastUpdated: new Date().toISOString(),
        assets: {
          '': [] // 根目录
        },
        labels: {}
      }
    }
    throw error
  }
}

/**
 * 保存元数据
 */
const saveMetadata = async (metadata, username = 'default') => {
  const metadataPath = getUserMetadataPath(username)
  
  // 确保目录存在
  await fs.mkdir(path.dirname(metadataPath), { recursive: true })
  
  // 更新时间戳
  metadata.lastUpdated = new Date().toISOString()
  
  // 保存文件
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2))
}

/**
 * 获取存储路径
 * 所有文件都存储在同一个目录下，不创建子目录
 * 分类信息仅在元数据中维护
 */
const categoryToPath = (category, username = 'default') => {
  // 所有文件都存储在用户的 storage 根目录下
  // 不根据 category 创建子目录
  return getUserStoragePath(username)
}

/**
 * 确保文件名唯一
 */
const ensureUniqueFilename = (files, filename) => {
  if (!files.includes(filename)) {
    return filename
  }
  
  const ext = path.extname(filename)
  const base = path.basename(filename, ext)
  let counter = 1
  let newFilename
  
  do {
    newFilename = `${base}(${counter})${ext}`
    counter++
  } while (files.includes(newFilename))
  
  return newFilename
}

/**
 * 获取文件类型
 */
const getFileType = (mimeType, filename) => {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (mimeType.includes('pdf')) return 'pdf'
  if (mimeType.includes('word') || filename.endsWith('.doc') || filename.endsWith('.docx')) return 'word'
  if (mimeType.includes('excel') || filename.endsWith('.xls') || filename.endsWith('.xlsx')) return 'excel'
  if (mimeType.includes('powerpoint') || filename.endsWith('.ppt') || filename.endsWith('.pptx')) return 'ppt'
  if (filename.endsWith('.md')) return 'markdown'
  if (filename.endsWith('.fig')) return 'figma'
  if (filename.endsWith('.sketch')) return 'sketch'
  if (filename.endsWith('.psd')) return 'photoshop'
  return 'file'
}

/**
 * 生成缩略图
 */
const generateThumbnail = async (filePath, thumbnailPath) => {
  try {
    await sharp(filePath)
      .resize(200, 200, { 
        fit: 'inside',
        withoutEnlargement: true 
      })
      .toFile(thumbnailPath)
    return true
  } catch (error) {
    logger.warn('[Assets] 生成缩略图失败:', error)
    return false
  }
}

// ========== Multer 配置 ==========
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const username = req.user?.username || 'default'
    const category = req.body.category || ''
    
    const uploadDir = categoryToPath(category, username)
    
    try {
      await fs.mkdir(uploadDir, { recursive: true })
      cb(null, uploadDir)
    } catch (error) {
      cb(error)
    }
  },
  filename: (req, file, cb) => {
    // 暂时使用临时文件名，后面会重命名
    const tempName = `temp_${Date.now()}_${uuidv4()}${path.extname(file.originalname)}`
    cb(null, tempName)
  }
})

const upload = multer({
  storage: storage,
  limits: {
    fileSize: MAX_FILE_SIZE
  },
  fileFilter: (req, file, cb) => {
    // 这里可以添加文件类型过滤
    cb(null, true)
  }
})

// ========== API 路由 ==========

/**
 * GET /api/assets/categories
 * 获取所有分类及其文件
 */
router.get('/categories', async (req, res) => {
  try {
    const username = req.user?.username || 'default'
    const metadata = await readMetadata(username)
    
    // 构建分类树形结构
    const buildCategoryTree = () => {
      const tree = []
      const categoryMap = {}
      
      // 首先创建所有分类节点
      for (const [category, files] of Object.entries(metadata.assets)) {
        if (category === '') {
          // 根目录文件单独处理
          continue
        }
        
        const parts = category.split('.')
        const parentKey = parts.slice(0, -1).join('.')
        
        categoryMap[category] = {
          key: category,
          label: metadata.labels[category] || parts[parts.length - 1],
          parent: parentKey || null,
          files: files,
          children: []
        }
      }
      
      // 构建树形结构
      for (const node of Object.values(categoryMap)) {
        if (node.parent && categoryMap[node.parent]) {
          categoryMap[node.parent].children.push(node)
        } else if (!node.parent) {
          tree.push(node)
        }
      }
      
      return {
        tree,
        rootFiles: metadata.assets[''] || [],
        categoryMap
      }
    }
    
    const { tree, rootFiles, categoryMap } = buildCategoryTree()
    
    res.json({
      success: true,
      data: {
        categories: metadata.assets,
        labels: metadata.labels,
        tree: tree,
        rootFiles: rootFiles,
        lastUpdated: metadata.lastUpdated
      }
    })
  } catch (error) {
    logger.error('[Assets] 获取分类失败:', error)
    res.status(500).json({
      success: false,
      message: '获取分类失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

/**
 * POST /api/assets/categories
 * 创建新分类
 */
router.post('/categories', async (req, res) => {
  console.log('[Assets] ========== POST /categories 开始 ==========')
  console.log('[Assets] 请求体:', JSON.stringify(req.body))
  console.log('[Assets] 用户信息:', req.user)
  
  try {
    const username = req.user?.username || 'default'
    const { label, parent, key } = req.body
    console.log('[Assets] 解析参数 - label:', label, ', parent:', parent, ', key:', key)
    
    if (!label) {
      return res.status(400).json({
        success: false,
        message: '分类名称不能为空'
      })
    }
    
    // 先读取元数据
    console.log('[Assets] 读取元数据 - 用户:', username)
    const metadata = await readMetadata(username)
    console.log('[Assets] 元数据读取成功，现有分类:', Object.keys(metadata.assets))
    
    // 生成分类key（如果没有提供）
    // 如果是中文，使用拼音或简单转换
    let categoryKey = key
    if (!categoryKey) {
      // 先尝试转换为英文字符
      categoryKey = label.toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '_')  // 保留中文字符
        .replace(/_{2,}/g, '_')
        .replace(/^_|_$/g, '')
      
      // 如果结果为空（纯中文情况），使用 category_ + 时间戳
      if (!categoryKey || categoryKey.match(/^[\u4e00-\u9fa5_]+$/)) {
        categoryKey = 'category_' + Date.now()
      }
    }
    
    console.log('[Assets] 生成分类key:', categoryKey)
    
    // 构建完整的分类路径
    const fullCategory = parent ? `${parent}.${categoryKey}` : categoryKey
    
    console.log('[Assets] 完整分类路径:', fullCategory)
    
    // 检查分类是否已存在
    if (metadata.assets.hasOwnProperty(fullCategory)) {
      console.log('[Assets] 分类已存在:', fullCategory)
      return res.status(400).json({
        success: false,
        message: '该分类已存在',
        existingCategory: fullCategory
      })
    }
    
    // 创建分类
    console.log('[Assets] 创建新分类...')
    metadata.assets[fullCategory] = []
    metadata.labels[fullCategory] = label
    console.log('[Assets] 分类添加到元数据')
    
    // 创建物理目录
    const categoryPath = categoryToPath(fullCategory, username)
    console.log('[Assets] 创建物理目录:', categoryPath)
    await fs.mkdir(categoryPath, { recursive: true })
    console.log('[Assets] 物理目录创建成功')
    
    console.log('[Assets] 保存元数据...')
    await saveMetadata(metadata, username)
    console.log('[Assets] 元数据保存成功')
    
    logger.info('[Assets] 创建分类成功', { username, category: fullCategory })
    
    res.json({
      success: true,
      data: {
        category: fullCategory,
        label: metadata.labels[fullCategory],
        parent: parent || null,
        files: [],
        createdAt: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('[Assets] 创建分类失败 - 详细错误:', error)
    logger.error('[Assets] 创建分类失败:', error)
    res.status(500).json({
      success: false,
      message: '创建分类失败',
      error: error.message || '未知错误'
    })
  }
})

/**
 * PUT /api/assets/categories/:category
 * 重命名分类（修改显示名称）
 */
router.put('/categories/:category', async (req, res) => {
  try {
    const username = req.user?.username || 'default'
    const category = decodeURIComponent(req.params.category)
    const { label } = req.body
    
    if (!category || !label) {
      return res.status(400).json({
        success: false,
        message: '参数不完整'
      })
    }
    
    const metadata = await readMetadata(username)
    
    if (!metadata.assets[category]) {
      return res.status(404).json({
        success: false,
        message: '分类不存在'
      })
    }
    
    metadata.labels[category] = label
    await saveMetadata(metadata, username)
    
    logger.info('[Assets] 重命名分类成功', { username, category, label })
    
    res.json({
      success: true,
      data: {
        category: category,
        label: label,
        updatedAt: new Date().toISOString()
      }
    })
  } catch (error) {
    logger.error('[Assets] 重命名分类失败:', error)
    res.status(500).json({
      success: false,
      message: '重命名分类失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

/**
 * DELETE /api/assets/categories/:category
 * 删除分类及其所有内容
 */
router.delete('/categories/:category', async (req, res) => {
  try {
    const username = req.user?.username || 'default'
    const category = decodeURIComponent(req.params.category)
    // DELETE 请求的参数通常在 query 中
    const moveToParent = req.query.moveToParent === 'true' || req.body?.moveToParent === true
    
    logger.info('[Assets] 删除分类请求', { 
      username, 
      category, 
      moveToParent,
      query: req.query,
      body: req.body 
    })
    
    if (!category) {
      return res.status(400).json({
        success: false,
        message: '分类不能为空'
      })
    }
    
    const metadata = await readMetadata(username)
    
    logger.info('[Assets] 当前元数据分类', { 
      availableCategories: Object.keys(metadata.assets || {}),
      requestedCategory: category,
      categoryExists: !!metadata.assets[category]
    })
    
    if (!metadata.assets[category]) {
      return res.status(404).json({
        success: false,
        message: '分类不存在'
      })
    }
    
    // 获取所有子分类
    const subCategories = Object.keys(metadata.assets).filter(key => 
      key.startsWith(category + '.')
    )
    
    if (moveToParent) {
      // 将文件移动到父分类
      const parentCategory = category.includes('.') 
        ? category.substring(0, category.lastIndexOf('.'))
        : ''
      
      if (!metadata.assets[parentCategory]) {
        metadata.assets[parentCategory] = []
      }
      
      // 移动文件
      metadata.assets[parentCategory] = [
        ...metadata.assets[parentCategory],
        ...metadata.assets[category]
      ]
      
      // TODO: 移动物理文件
    } else {
      // 删除分类中的所有文件（文件都在同一个目录下）
      const storagePath = getUserStoragePath(username)
      const thumbDir = path.join(storagePath, '.thumbnails')
      
      // 删除该分类下的所有文件
      for (const filename of metadata.assets[category] || []) {
        const filePath = path.join(storagePath, filename)
        const thumbnailPath = path.join(thumbDir, `thumb_${filename}`)
        
        try {
          await fs.unlink(filePath)
        } catch (error) {
          logger.warn(`[Assets] 删除文件失败 ${filename}:`, error)
        }
        
        try {
          await fs.unlink(thumbnailPath)
        } catch (error) {
          // 缩略图可能不存在，忽略错误
        }
      }
      
      // 删除所有子分类的文件
      for (const subCat of subCategories) {
        for (const filename of metadata.assets[subCat] || []) {
          const filePath = path.join(storagePath, filename)
          const thumbnailPath = path.join(thumbDir, `thumb_${filename}`)
          
          try {
            await fs.unlink(filePath)
          } catch (error) {
            logger.warn(`[Assets] 删除子分类文件失败 ${filename}:`, error)
          }
          
          try {
            await fs.unlink(thumbnailPath)
          } catch (error) {
            // 缩略图可能不存在，忽略错误
          }
        }
      }
    }
    
    // 删除元数据
    delete metadata.assets[category]
    delete metadata.labels[category]
    
    // 删除所有子分类
    for (const subCat of subCategories) {
      delete metadata.assets[subCat]
      delete metadata.labels[subCat]
    }
    
    await saveMetadata(metadata, username)
    
    logger.info('[Assets] 删除分类成功', { username, category })
    
    res.json({
      success: true,
      message: '分类删除成功',
      data: {
        deleted: [category, ...subCategories]
      }
    })
  } catch (error) {
    logger.error('[Assets] 删除分类失败:', error)
    res.status(500).json({
      success: false,
      message: '删除分类失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

/**
 * POST /api/assets/upload
 * 上传文件
 */
router.post('/upload', upload.array('files', 10), async (req, res) => {
  const uploadedFiles = []
  
  try {
    const username = req.user?.username || 'default'
    const category = req.body.category || ''
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: '未选择文件'
      })
    }
    
    const metadata = await readMetadata(username)
    
    // 确保分类存在
    if (!metadata.assets.hasOwnProperty(category)) {
      metadata.assets[category] = []
    }
    
    // 处理每个文件
    for (const file of req.files) {
      const originalName = file.originalname
      const tempPath = file.path
      
      // 确保文件名唯一
      const uniqueName = ensureUniqueFilename(metadata.assets[category], originalName)
      const finalPath = path.join(path.dirname(tempPath), uniqueName)
      
      // 重命名文件
      await fs.rename(tempPath, finalPath)
      
      // 生成缩略图（如果是图片）
      let thumbnailName = null
      if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
        const thumbDir = path.join(getUserStoragePath(username), '.thumbnails')
        await fs.mkdir(thumbDir, { recursive: true })
        
        thumbnailName = `thumb_${uniqueName}`
        const thumbnailPath = path.join(thumbDir, thumbnailName)
        
        await generateThumbnail(finalPath, thumbnailPath)
      }
      
      // 添加到元数据
      metadata.assets[category].push(uniqueName)
      
      uploadedFiles.push({
        filename: uniqueName,
        originalName: originalName,
        category: category,
        size: file.size,
        type: getFileType(file.mimetype, uniqueName),
        mimeType: file.mimetype,
        thumbnail: thumbnailName,
        uploadedAt: new Date().toISOString()
      })
      
      logger.info('[Assets] 文件上传成功', {
        username,
        category,
        filename: uniqueName,
        size: file.size
      })
    }
    
    await saveMetadata(metadata, username)
    
    res.json({
      success: true,
      message: `成功上传 ${uploadedFiles.length} 个文件`,
      data: {
        files: uploadedFiles
      }
    })
  } catch (error) {
    logger.error('[Assets] 文件上传失败:', error)
    
    // 清理已上传的文件
    for (const file of req.files) {
      try {
        await fs.unlink(file.path)
      } catch (err) {
        logger.warn('[Assets] 清理临时文件失败:', err)
      }
    }
    
    res.status(500).json({
      success: false,
      message: '文件上传失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
    const { fileIds, targetFolderId } = req.body
    
    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请选择要移动的文件'
      })
    }
    
    const metadata = await readMetadata(username)
    const targetCategory = targetFolderId || ''
    const movedItems = []
    
    // 确保目标分类存在
    if (!metadata.assets.hasOwnProperty(targetCategory)) {
      metadata.assets[targetCategory] = []
    }
    
    for (const id of fileIds) {
      let sourceCategory = ''
      let filename = id
      
      // 解析ID
      if (id.includes('/')) {
        const lastSlashIndex = id.lastIndexOf('/')
        sourceCategory = id.substring(0, lastSlashIndex)
        filename = id.substring(lastSlashIndex + 1)
      }
      
      // 检查源文件是否存在
      if (!metadata.assets[sourceCategory] || !metadata.assets[sourceCategory].includes(filename)) {
        continue // 跳过不存在的文件
      }
      
      // 如果源和目标相同，跳过
      if (sourceCategory === targetCategory) {
        continue
      }
      
      // 确保目标文件名唯一
      const uniqueName = ensureUniqueFilename(metadata.assets[targetCategory], filename)
      
      // 移动物理文件
      const sourcePath = path.join(categoryToPath(sourceCategory, username), filename)
      const targetPath = path.join(categoryToPath(targetCategory, username), uniqueName)
      
      // 确保目标目录存在
      await fs.mkdir(path.dirname(targetPath), { recursive: true })
      await fs.rename(sourcePath, targetPath)
      
      // 移动缩略图
      const thumbDir = path.join(getUserStoragePath(username), '.thumbnails')
      const sourceThumbPath = path.join(thumbDir, `thumb_${filename}`)
      const targetThumbPath = path.join(thumbDir, `thumb_${uniqueName}`)
      
      try {
        await fs.mkdir(thumbDir, { recursive: true })
        await fs.rename(sourceThumbPath, targetThumbPath)
      } catch (error) {
        // 缩略图可能不存在，忽略错误
      }
      
      // 更新元数据
      metadata.assets[sourceCategory] = metadata.assets[sourceCategory].filter(f => f !== filename)
      metadata.assets[targetCategory].push(uniqueName)
      
      movedItems.push({
        oldId: id,
        newId: targetCategory ? `${targetCategory}/${uniqueName}` : uniqueName,
        filename: uniqueName
      })
    }
    
    await saveMetadata(metadata, username)
    
    logger.info('[Assets] 批量移动文件成功', {
      username,
      targetCategory,
      count: movedItems.length
    })
    
    res.json({
      success: true,
      message: `成功移动 ${movedItems.length} 个文件`,
      data: {
        movedItems,
        targetFolderId: targetCategory
      }
    })
  } catch (error) {
    logger.error('[Assets] 移动文件失败:', error)
    res.status(500).json({
      success: false,
      message: '移动文件失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

/**
 * DELETE /api/assets/file
 * 删除文件（保留用于向后兼容）
 */
router.delete('/file', async (req, res) => {
  try {
    const username = req.user?.username || 'default'
    const { category, filename } = req.body
    
    if (!filename) {
      return res.status(400).json({
        success: false,
        message: '文件名不能为空'
      })
    }
    
    const metadata = await readMetadata(username)
    const targetCategory = category || ''
    
    if (!metadata.assets[targetCategory] || !metadata.assets[targetCategory].includes(filename)) {
      return res.status(404).json({
        success: false,
        message: '文件不存在'
      })
    }
    
    // 删除物理文件
    const filePath = path.join(categoryToPath(targetCategory, username), filename)
    try {
      await fs.unlink(filePath)
    } catch (error) {
      logger.warn('[Assets] 删除物理文件失败:', error)
    }
    
    // 删除缩略图
    const thumbDir = path.join(getUserStoragePath(username), '.thumbnails', targetCategory.replace(/\./g, '/'))
    const thumbnailPath = path.join(thumbDir, `thumb_${filename}`)
    try {
      await fs.unlink(thumbnailPath)
    } catch (error) {
      // 缩略图可能不存在，忽略错误
    }
    
    // 从元数据中移除
    metadata.assets[targetCategory] = metadata.assets[targetCategory].filter(f => f !== filename)
    
    await saveMetadata(metadata, username)
    
    logger.info('[Assets] 删除文件成功', { username, category: targetCategory, filename })
    
    res.json({
      success: true,
      message: '文件删除成功'
    })
  } catch (error) {
    logger.error('[Assets] 删除文件失败:', error)
    res.status(500).json({
      success: false,
      message: '删除文件失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

/**
 * PUT /api/assets/file/rename
 * 重命名文件
 */
router.put('/file/rename', async (req, res) => {
  try {
    const username = req.user?.username || 'default'
    const { category, oldName, newName } = req.body
    
    if (!oldName || !newName) {
      return res.status(400).json({
        success: false,
        message: '参数不完整'
      })
    }
    
    const metadata = await readMetadata(username)
    const targetCategory = category || ''
    
    if (!metadata.assets[targetCategory] || !metadata.assets[targetCategory].includes(oldName)) {
      return res.status(404).json({
        success: false,
        message: '文件不存在'
      })
    }
    
    // 确保新文件名唯一
    const uniqueName = ensureUniqueFilename(
      metadata.assets[targetCategory].filter(f => f !== oldName),
      newName
    )
    
    // 重命名物理文件
    const categoryPath = categoryToPath(targetCategory, username)
    const oldPath = path.join(categoryPath, oldName)
    const newPath = path.join(categoryPath, uniqueName)
    
    await fs.rename(oldPath, newPath)
    
    // 重命名缩略图
    const thumbDir = path.join(getUserStoragePath(username), '.thumbnails', targetCategory.replace(/\./g, '/'))
    const oldThumbPath = path.join(thumbDir, `thumb_${oldName}`)
    const newThumbPath = path.join(thumbDir, `thumb_${uniqueName}`)
    try {
      await fs.rename(oldThumbPath, newThumbPath)
    } catch (error) {
      // 缩略图可能不存在，忽略错误
    }
    
    // 更新元数据
    const index = metadata.assets[targetCategory].indexOf(oldName)
    metadata.assets[targetCategory][index] = uniqueName
    
    await saveMetadata(metadata, username)
    
    logger.info('[Assets] 重命名文件成功', {
      username,
      category: targetCategory,
      oldName,
      newName: uniqueName
    })
    
    res.json({
      success: true,
      data: {
        oldName,
        newName: uniqueName
      }
    })
  } catch (error) {
    logger.error('[Assets] 重命名文件失败:', error)
    res.status(500).json({
      success: false,
      message: '重命名文件失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

/**
 * PUT /api/assets/file/move
 * 移动文件到其他分类
 */
router.put('/file/move', async (req, res) => {
  try {
    const username = req.user?.username || 'default'
    const { fromCategory, toCategory, filename } = req.body
    
    if (!filename) {
      return res.status(400).json({
        success: false,
        message: '文件名不能为空'
      })
    }
    
    const metadata = await readMetadata(username)
    const sourceCategory = fromCategory || ''
    const targetCategory = toCategory || ''
    
    if (!metadata.assets[sourceCategory] || !metadata.assets[sourceCategory].includes(filename)) {
      return res.status(404).json({
        success: false,
        message: '文件不存在'
      })
    }
    
    // 确保目标分类存在
    if (!metadata.assets.hasOwnProperty(targetCategory)) {
      metadata.assets[targetCategory] = []
    }
    
    // 确保目标文件名唯一
    const uniqueName = ensureUniqueFilename(metadata.assets[targetCategory], filename)
    
    // 移动物理文件
    const sourcePath = path.join(categoryToPath(sourceCategory, username), filename)
    const targetPath = path.join(categoryToPath(targetCategory, username), uniqueName)
    
    // 确保目标目录存在
    await fs.mkdir(path.dirname(targetPath), { recursive: true })
    await fs.rename(sourcePath, targetPath)
    
    // 移动缩略图
    const thumbDir = path.join(getUserStoragePath(username), '.thumbnails')
    const sourceThumbPath = path.join(thumbDir, `thumb_${filename}`)
    const targetThumbPath = path.join(thumbDir, `thumb_${uniqueName}`)
    
    try {
      await fs.mkdir(thumbDir, { recursive: true })
      await fs.rename(sourceThumbPath, targetThumbPath)
    } catch (error) {
      // 缩略图可能不存在，忽略错误
    }
    
    // 更新元数据
    metadata.assets[sourceCategory] = metadata.assets[sourceCategory].filter(f => f !== filename)
    metadata.assets[targetCategory].push(uniqueName)
    
    await saveMetadata(metadata, username)
    
    logger.info('[Assets] 移动文件成功', {
      username,
      fromCategory: sourceCategory,
      toCategory: targetCategory,
      filename: uniqueName
    })
    
    res.json({
      success: true,
      data: {
        filename: uniqueName,
        fromCategory: sourceCategory,
        toCategory: targetCategory
      }
    })
  } catch (error) {
    logger.error('[Assets] 移动文件失败:', error)
    res.status(500).json({
      success: false,
      message: '移动文件失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

/**
 * GET /api/assets/file/:category/:filename
 * 获取文件内容
 */
router.get('/file/:category/:filename', async (req, res) => {
  try {
    const username = req.user?.username || 'default'
    const { category, filename } = req.params
    
    const actualCategory = category === '_root' ? '' : category.replace(/-/g, '.')
    const filePath = path.join(categoryToPath(actualCategory, username), filename)
    
    // 检查文件是否存在
    try {
      await fs.access(filePath)
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: '文件不存在'
      })
    }
    
    // 发送文件
    res.sendFile(filePath)
  } catch (error) {
    logger.error('[Assets] 获取文件失败:', error)
    res.status(500).json({
      success: false,
      message: '获取文件失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

/**
 * GET /api/assets/thumbnail/:category/:filename
 * 获取缩略图
 */
router.get('/thumbnail/:category/:filename', async (req, res) => {
  try {
    const username = req.user?.username || 'default'
    const { category, filename } = req.params
    
    const actualCategory = category === '_root' ? '' : category.replace(/-/g, '.')
    // 所有缩略图都存储在 .thumbnails 目录下，不创建子目录
    const thumbDir = path.join(getUserStoragePath(username), '.thumbnails')
    const thumbnailPath = path.join(thumbDir, `thumb_${filename}`)
    
    // 检查缩略图是否存在
    try {
      await fs.access(thumbnailPath)
      res.sendFile(thumbnailPath)
    } catch (error) {
      // 缩略图不存在，返回原文件或默认图片
      const filePath = path.join(categoryToPath(actualCategory, username), filename)
      try {
        await fs.access(filePath)
        res.sendFile(filePath)
      } catch (err) {
        res.status(404).json({
          success: false,
          message: '缩略图不存在'
        })
      }
    }
  } catch (error) {
    logger.error('[Assets] 获取缩略图失败:', error)
    res.status(500).json({
      success: false,
      message: '获取缩略图失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

/**
 * GET /api/assets/search
 * 搜索文件和分类（用于@引用）
 */
router.get('/search', async (req, res) => {
  try {
    const username = req.user?.username || 'default'
    const { query } = req.query
    
    if (!query) {
      return res.json({
        success: true,
        data: {
          categories: [],
          files: []
        }
      })
    }
    
    const metadata = await readMetadata(username)
    const results = {
      categories: [],
      files: []
    }
    
    const searchTerm = query.toLowerCase()
    
    // 搜索分类
    for (const [key, label] of Object.entries(metadata.labels)) {
      if (key.toLowerCase().includes(searchTerm) || 
          label.toLowerCase().includes(searchTerm)) {
        results.categories.push({
          key,
          label,
          path: key.split('.').join(' > ')
        })
      }
    }
    
    // 搜索文件
    for (const [category, files] of Object.entries(metadata.assets)) {
      for (const file of files) {
        if (file.toLowerCase().includes(searchTerm)) {
          const categoryLabel = category ? 
            (metadata.labels[category] || category) : 
            '根目录'
          
          results.files.push({
            name: file,
            category,
            categoryLabel,
            path: category ? `${categoryLabel} > ${file}` : file
          })
        }
      }
    }
    
    res.json({
      success: true,
      data: results
    })
  } catch (error) {
    logger.error('[Assets] 搜索失败:', error)
    res.status(500).json({
      success: false,
      message: '搜索失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

/**
 * GET /api/assets
 * 获取所有文件（兼容旧API）
 */
router.get('/', async (req, res) => {
  try {
    const username = req.user?.username || 'default'
    const { folderId } = req.query
    const metadata = await readMetadata(username)
    
    // 如果指定了文件夹ID（分类），只返回该分类的文件
    if (folderId) {
      const files = metadata.assets[folderId] || []
      res.json({
        success: true,
        data: files.map(filename => ({
          id: `${folderId}/${filename}`,
          name: filename,
          type: getFileType('', filename),
          category: folderId,
          path: `/${folderId.split('.').join('/')}/${filename}`,
          uploadedAt: metadata.lastUpdated
        }))
      })
    } else {
      // 返回所有文件
      const allFiles = []
      for (const [category, files] of Object.entries(metadata.assets)) {
        for (const filename of files) {
          allFiles.push({
            id: category ? `${category}/${filename}` : filename,
            name: filename,
            type: getFileType('', filename),
            category: category,
            path: category ? `/${category.split('.').join('/')}/${filename}` : `/${filename}`,
            uploadedAt: metadata.lastUpdated
          })
        }
      }
      res.json({
        success: true,
        data: allFiles
      })
    }
  } catch (error) {
    logger.error('[Assets] 获取文件列表失败:', error)
    res.status(500).json({
      success: false,
      message: '获取文件列表失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

/**
 * DELETE /api/assets/:id
 * 删除文件（兼容旧API）
 * id格式: category/filename 或 filename（根目录）
 */
router.delete('/:id', async (req, res) => {
  try {
    const username = req.user?.username || 'default'
    const { id } = req.params
    
    let category = ''
    let filename = id
    
    // 解析ID
    if (id.includes('/')) {
      const lastSlashIndex = id.lastIndexOf('/')
      category = id.substring(0, lastSlashIndex)
      filename = id.substring(lastSlashIndex + 1)
    }
    
    const metadata = await readMetadata(username)
    
    if (!metadata.assets[category] || !metadata.assets[category].includes(filename)) {
      return res.status(404).json({
        success: false,
        message: '文件不存在'
      })
    }
    
    // 删除物理文件
    const filePath = path.join(categoryToPath(category, username), filename)
    try {
      await fs.unlink(filePath)
    } catch (error) {
      logger.warn('[Assets] 删除物理文件失败:', error)
    }
    
    // 删除缩略图
    const thumbDir = path.join(getUserStoragePath(username), '.thumbnails')
    const thumbnailPath = path.join(thumbDir, `thumb_${filename}`)
    try {
      await fs.unlink(thumbnailPath)
    } catch (error) {
      // 缩略图可能不存在，忽略错误
    }
    
    // 从元数据中移除
    metadata.assets[category] = metadata.assets[category].filter(f => f !== filename)
    
    await saveMetadata(metadata, username)
    
    logger.info('[Assets] 删除文件成功', { username, category, filename })
    
    res.json({
      success: true,
      message: '文件删除成功'
    })
  } catch (error) {
    logger.error('[Assets] 删除文件失败:', error)
    res.status(500).json({
      success: false,
      message: '删除文件失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

/**
 * PUT /api/assets/:id
 * 重命名文件（兼容旧API）
 */
router.put('/:id', async (req, res) => {
  try {
    const username = req.user?.username || 'default'
    const { id } = req.params
    const { name } = req.body
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: '新文件名不能为空'
      })
    }
    
    let category = ''
    let oldName = id
    
    // 解析ID
    if (id.includes('/')) {
      const lastSlashIndex = id.lastIndexOf('/')
      category = id.substring(0, lastSlashIndex)
      oldName = id.substring(lastSlashIndex + 1)
    }
    
    const metadata = await readMetadata(username)
    
    if (!metadata.assets[category] || !metadata.assets[category].includes(oldName)) {
      return res.status(404).json({
        success: false,
        message: '文件不存在'
      })
    }
    
    // 确保新文件名唯一
    const uniqueName = ensureUniqueFilename(
      metadata.assets[category].filter(f => f !== oldName),
      name
    )
    
    // 重命名物理文件
    const categoryPath = categoryToPath(category, username)
    const oldPath = path.join(categoryPath, oldName)
    const newPath = path.join(categoryPath, uniqueName)
    
    await fs.rename(oldPath, newPath)
    
    // 重命名缩略图
    const thumbDir = path.join(getUserStoragePath(username), '.thumbnails')
    const oldThumbPath = path.join(thumbDir, `thumb_${oldName}`)
    const newThumbPath = path.join(thumbDir, `thumb_${uniqueName}`)
    try {
      await fs.rename(oldThumbPath, newThumbPath)
    } catch (error) {
      // 缩略图可能不存在，忽略错误
    }
    
    // 更新元数据
    const index = metadata.assets[category].indexOf(oldName)
    metadata.assets[category][index] = uniqueName
    
    await saveMetadata(metadata, username)
    
    logger.info('[Assets] 重命名文件成功', {
      username,
      category,
      oldName,
      newName: uniqueName
    })
    
    res.json({
      success: true,
      data: {
        id: category ? `${category}/${uniqueName}` : uniqueName,
        name: uniqueName,
        updatedAt: new Date().toISOString()
      }
    })
  } catch (error) {
    logger.error('[Assets] 重命名文件失败:', error)
    res.status(500).json({
      success: false,
      message: '重命名文件失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

export default router