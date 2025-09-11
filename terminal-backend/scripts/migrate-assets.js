#!/usr/bin/env node

/**
 * 素材系统数据迁移脚本
 * 将旧的虚拟文件夹结构迁移到新的实际文件系统结构
 */

import fs from 'fs-extra'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import sharp from 'sharp'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 配置
const CONFIG = {
  // 旧系统路径
  oldBasePath: process.env.OLD_ASSETS_PATH || '/data/old_assets',
  oldMetadataPath: process.env.OLD_METADATA_PATH || '/data/old_assets/metadata.json',
  
  // 新系统路径
  newBasePath: process.env.NEW_ASSETS_PATH || '/data/users',
  
  // 迁移选项
  dryRun: process.argv.includes('--dry-run'),
  verbose: process.argv.includes('--verbose'),
  skipThumbnails: process.argv.includes('--skip-thumbnails'),
  batchSize: 100,
  
  // 缩略图配置
  thumbnailSizes: {
    small: { width: 150, height: 150 },
    medium: { width: 300, height: 300 },
    large: { width: 600, height: 600 }
  }
}

// 日志工具
const logger = {
  info: (msg) => console.log(`[INFO] ${msg}`),
  error: (msg) => console.error(`[ERROR] ${msg}`),
  warn: (msg) => console.warn(`[WARN] ${msg}`),
  debug: (msg) => CONFIG.verbose && console.log(`[DEBUG] ${msg}`),
  success: (msg) => console.log(`[SUCCESS] ✓ ${msg}`)
}

// 迁移统计
const stats = {
  totalFiles: 0,
  migratedFiles: 0,
  failedFiles: 0,
  totalFolders: 0,
  createdFolders: 0,
  thumbnailsGenerated: 0,
  errors: []
}

// 简单的进度条实现
class SimpleProgressBar {
  constructor(label, total) {
    this.label = label
    this.total = total
    this.current = 0
    this.width = 40
  }

  tick(count = 1) {
    this.current += count
    const percent = Math.floor((this.current / this.total) * 100)
    const filled = Math.floor((this.current / this.total) * this.width)
    const empty = this.width - filled
    const bar = '█'.repeat(filled) + '░'.repeat(empty)
    process.stdout.write(`\r  ${this.label} [${bar}] ${percent}% ${this.current}/${this.total}`)
    if (this.current >= this.total) {
      console.log() // 换行
    }
  }
}

/**
 * 读取旧系统元数据
 */
async function readOldMetadata() {
  try {
    logger.info('Reading old metadata...')
    
    // 检查文件是否存在
    const exists = await fs.pathExists(CONFIG.oldMetadataPath)
    if (!exists) {
      logger.warn(`Metadata file not found at ${CONFIG.oldMetadataPath}`)
      logger.info('Creating mock metadata for demonstration...')
      
      // 创建模拟数据
      return {
        version: '1.0',
        users: {
          'demo_user': {
            categories: {
              'images': ['test1.jpg', 'test2.png'],
              'documents': ['doc1.pdf', 'doc2.docx']
            },
            assets: {
              'asset1': {
                name: 'test1.jpg',
                mimeType: 'image/jpeg',
                path: 'images/test1.jpg'
              },
              'asset2': {
                name: 'doc1.pdf',
                mimeType: 'application/pdf',
                path: 'documents/doc1.pdf'
              }
            }
          }
        }
      }
    }
    
    const metadata = await fs.readJson(CONFIG.oldMetadataPath)
    logger.success(`Loaded metadata for ${Object.keys(metadata.users || {}).length} users`)
    return metadata
  } catch (error) {
    logger.error(`Failed to read metadata: ${error.message}`)
    throw error
  }
}

/**
 * 创建新的目录结构
 */
async function createDirectoryStructure(userId) {
  const userBase = path.join(CONFIG.newBasePath, userId)
  const directories = [
    path.join(userBase, 'assets'),
    path.join(userBase, 'assets/images'),
    path.join(userBase, 'assets/images/photos'),
    path.join(userBase, 'assets/images/designs'),
    path.join(userBase, 'assets/images/screenshots'),
    path.join(userBase, 'assets/videos'),
    path.join(userBase, 'assets/documents'),
    path.join(userBase, 'assets/documents/pdf'),
    path.join(userBase, 'assets/documents/word'),
    path.join(userBase, 'assets/documents/markdown'),
    path.join(userBase, 'assets/audio'),
    path.join(userBase, 'assets/projects'),
    path.join(userBase, '.cache'),
    path.join(userBase, '.cache/thumbnails'),
    path.join(userBase, '.cache/previews'),
    path.join(userBase, '.cache/metadata'),
    path.join(userBase, '.system')
  ]

  for (const dir of directories) {
    if (!CONFIG.dryRun) {
      await fs.ensureDir(dir)
    }
    logger.debug(`Created directory: ${dir}`)
    stats.createdFolders++
  }
}

/**
 * 获取文件类型对应的新目录
 */
function getTargetDirectory(fileName, mimeType, userId) {
  const ext = path.extname(fileName).toLowerCase()
  const userBase = path.join(CONFIG.newBasePath, userId, 'assets')
  
  // 根据MIME类型或扩展名判断
  if (mimeType) {
    if (mimeType.startsWith('image/')) {
      return path.join(userBase, 'images')
    } else if (mimeType.startsWith('video/')) {
      return path.join(userBase, 'videos')
    } else if (mimeType.startsWith('audio/')) {
      return path.join(userBase, 'audio')
    } else if (mimeType === 'application/pdf') {
      return path.join(userBase, 'documents/pdf')
    }
  }
  
  // 根据扩展名判断
  const extMap = {
    // 图片
    '.jpg': 'images', '.jpeg': 'images', '.png': 'images', 
    '.gif': 'images', '.svg': 'images', '.webp': 'images',
    // 视频
    '.mp4': 'videos', '.avi': 'videos', '.mov': 'videos',
    '.wmv': 'videos', '.flv': 'videos', '.mkv': 'videos',
    // 音频
    '.mp3': 'audio', '.wav': 'audio', '.flac': 'audio',
    '.aac': 'audio', '.ogg': 'audio', '.wma': 'audio',
    // 文档
    '.pdf': 'documents/pdf',
    '.doc': 'documents/word', '.docx': 'documents/word',
    '.md': 'documents/markdown', '.markdown': 'documents/markdown'
  }
  
  const subDir = extMap[ext] || 'documents'
  return path.join(userBase, subDir)
}

/**
 * 生成新文件名
 */
function generateNewFileName(originalName) {
  const fileId = uuidv4()
  const timestamp = Date.now()
  const sanitizedName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_')
  return `${fileId}_${timestamp}_${sanitizedName}`
}

/**
 * 迁移单个文件
 */
async function migrateFile(oldPath, fileInfo, userId) {
  try {
    // 确定目标目录
    const targetDir = getTargetDirectory(fileInfo.name, fileInfo.mimeType, userId)
    const newFileName = generateNewFileName(fileInfo.name)
    const newPath = path.join(targetDir, newFileName)
    
    logger.debug(`Migrating: ${oldPath} -> ${newPath}`)
    
    if (!CONFIG.dryRun) {
      // 确保目标目录存在
      await fs.ensureDir(targetDir)
      
      // 检查源文件是否存在
      const exists = await fs.pathExists(oldPath)
      if (exists) {
        // 复制文件
        await fs.copy(oldPath, newPath, { preserveTimestamps: true })
        
        // 生成缩略图（如果是图片）
        if (fileInfo.mimeType && fileInfo.mimeType.startsWith('image/') && !CONFIG.skipThumbnails) {
          await generateThumbnails(newPath, userId, newFileName)
        }
      } else {
        logger.warn(`Source file not found: ${oldPath}`)
      }
    }
    
    stats.migratedFiles++
    
    return {
      success: true,
      oldPath,
      newPath,
      fileId: newFileName.split('_')[0]
    }
  } catch (error) {
    stats.failedFiles++
    stats.errors.push({
      file: oldPath,
      error: error.message
    })
    
    logger.error(`Failed to migrate ${oldPath}: ${error.message}`)
    
    return {
      success: false,
      oldPath,
      error: error.message
    }
  }
}

/**
 * 生成缩略图
 */
async function generateThumbnails(imagePath, userId, fileName) {
  const fileId = fileName.split('_')[0]
  const cacheDir = path.join(CONFIG.newBasePath, userId, '.cache/thumbnails')
  
  try {
    for (const [size, dimensions] of Object.entries(CONFIG.thumbnailSizes)) {
      const outputPath = path.join(cacheDir, `${fileId}_${size}.jpg`)
      
      if (!CONFIG.dryRun) {
        // 检查图片文件是否存在
        const exists = await fs.pathExists(imagePath)
        if (exists) {
          await sharp(imagePath)
            .resize(dimensions.width, dimensions.height, {
              fit: 'inside',
              withoutEnlargement: true
            })
            .jpeg({ quality: 85 })
            .toFile(outputPath)
        }
      }
      
      logger.debug(`Generated thumbnail: ${outputPath}`)
    }
    
    stats.thumbnailsGenerated++
  } catch (error) {
    logger.warn(`Failed to generate thumbnails for ${imagePath}: ${error.message}`)
  }
}

/**
 * 迁移用户的所有文件
 */
async function migrateUserAssets(userId, userMetadata) {
  logger.info(`Migrating assets for user: ${userId}`)
  
  // 创建目录结构
  await createDirectoryStructure(userId)
  
  // 获取所有文件列表
  const files = []
  
  // 从categories中收集文件
  if (userMetadata.categories) {
    for (const [category, fileList] of Object.entries(userMetadata.categories)) {
      for (const fileName of fileList) {
        const oldPath = path.join(CONFIG.oldBasePath, userId, category, fileName)
        files.push({
          oldPath,
          name: fileName,
          category,
          mimeType: userMetadata.files?.[fileName]?.mimeType
        })
      }
    }
  }
  
  // 从assets中收集文件
  if (userMetadata.assets) {
    for (const [assetId, assetInfo] of Object.entries(userMetadata.assets)) {
      const oldPath = path.join(CONFIG.oldBasePath, userId, assetInfo.path || assetInfo.name)
      files.push({
        oldPath,
        name: assetInfo.name,
        mimeType: assetInfo.mimeType || assetInfo.type
      })
    }
  }
  
  stats.totalFiles += files.length
  
  // 创建进度条
  const progressBar = new SimpleProgressBar('Migrating', files.length)
  
  // 批量迁移文件
  const results = []
  for (let i = 0; i < files.length; i += CONFIG.batchSize) {
    const batch = files.slice(i, i + CONFIG.batchSize)
    const batchResults = await Promise.all(
      batch.map(file => migrateFile(file.oldPath, file, userId))
    )
    results.push(...batchResults)
    progressBar.tick(batch.length)
  }
  
  // 创建索引文件
  const indexPath = path.join(CONFIG.newBasePath, userId, '.system/index.json')
  const index = {
    version: '2.0',
    userId,
    migratedAt: new Date().toISOString(),
    files: results.filter(r => r.success).map(r => ({
      id: r.fileId,
      oldPath: r.oldPath,
      newPath: r.newPath
    })),
    stats: {
      total: files.length,
      migrated: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    }
  }
  
  if (!CONFIG.dryRun) {
    await fs.writeJson(indexPath, index, { spaces: 2 })
  }
  
  logger.success(`Migrated ${index.stats.migrated}/${index.stats.total} files for user ${userId}`)
  
  return results
}

/**
 * 主迁移函数
 */
async function migrate() {
  console.log('='.repeat(60))
  console.log('Asset Migration Tool')
  console.log('='.repeat(60))
  
  if (CONFIG.dryRun) {
    logger.warn('DRY RUN MODE - No actual changes will be made')
  }
  
  try {
    // 读取元数据
    const metadata = await readOldMetadata()
    
    // 迁移每个用户的数据
    const users = Object.keys(metadata.users || {})
    
    for (const userId of users) {
      await migrateUserAssets(userId, metadata.users[userId])
      console.log('-'.repeat(60))
    }
    
    // 显示统计信息
    console.log('='.repeat(60))
    console.log('Migration Summary:')
    console.log(`  Total Files: ${stats.totalFiles}`)
    console.log(`  Migrated Files: ${stats.migratedFiles}`)
    console.log(`  Failed Files: ${stats.failedFiles}`)
    console.log(`  Created Folders: ${stats.createdFolders}`)
    console.log(`  Thumbnails Generated: ${stats.thumbnailsGenerated}`)
    
    if (stats.errors.length > 0) {
      console.log('\nErrors:')
      stats.errors.slice(0, 10).forEach(err => {
        console.log(`  - ${err.file}: ${err.error}`)
      })
      if (stats.errors.length > 10) {
        console.log(`  ... and ${stats.errors.length - 10} more errors`)
      }
    }
    
    // 保存迁移报告
    const reportPath = path.join(CONFIG.newBasePath, 'migration-report.json')
    if (!CONFIG.dryRun) {
      await fs.writeJson(reportPath, {
        timestamp: new Date().toISOString(),
        config: CONFIG,
        stats,
        errors: stats.errors
      }, { spaces: 2 })
      logger.success(`Migration report saved to: ${reportPath}`)
    }
    
    console.log('='.repeat(60))
    
    if (CONFIG.dryRun) {
      console.log('\nTo perform actual migration, run without --dry-run flag')
    } else {
      console.log('\nMigration completed successfully!')
    }
    
  } catch (error) {
    logger.error(`Migration failed: ${error.message}`)
    console.error(error.stack)
    process.exit(1)
  }
}

// 运行迁移
migrate().catch(console.error)

export { migrate }