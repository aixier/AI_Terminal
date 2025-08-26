/**
 * Workspace 元数据管理工具
 * 在 workspace/card 目录下维护一个集中的元数据文件
 */

import fs from 'fs/promises'
import path from 'path'

const METADATA_VERSION = '1.0'
const METADATA_FILENAME = '.card_workspace_meta.json'

/**
 * 获取元数据文件路径
 * @param {string} userCardBasePath - 用户 card 基础路径（如 /app/data/users/default/workspace/card）
 * @returns {string} 元数据文件完整路径
 */
function getMetadataPath(userCardBasePath) {
  return path.join(userCardBasePath, METADATA_FILENAME)
}

/**
 * 读取或初始化 workspace 元数据
 * @param {string} userCardBasePath - 用户 card 基础路径
 * @returns {Object} 元数据对象
 */
async function readOrInitMetadata(userCardBasePath) {
  const metaPath = getMetadataPath(userCardBasePath)
  
  try {
    const content = await fs.readFile(metaPath, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    if (error.code === 'ENOENT') {
      // 文件不存在，创建初始结构
      const initialMeta = {
        version: METADATA_VERSION,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        folders: {},
        statistics: {
          totalFolders: 0,
          completed: 0,
          generating: 0,
          failed: 0,
          initialized: 0
        }
      }
      
      // 确保目录存在
      await fs.mkdir(userCardBasePath, { recursive: true })
      await fs.writeFile(metaPath, JSON.stringify(initialMeta, null, 2))
      return initialMeta
    }
    throw error
  }
}

/**
 * 保存元数据到文件
 * @param {string} userCardBasePath - 用户 card 基础路径
 * @param {Object} metadata - 元数据对象
 */
async function saveMetadata(userCardBasePath, metadata) {
  const metaPath = getMetadataPath(userCardBasePath)
  metadata.lastUpdated = new Date().toISOString()
  await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2))
}

/**
 * 注册新文件夹到元数据
 * @param {string} userCardPath - 具体卡片文件夹路径
 * @param {string} topic - 原始主题
 * @param {string} sanitizedTopic - 清理后的主题
 * @param {Object} additionalInfo - 额外信息
 * @returns {Object} 更新后的文件夹信息
 */
export async function registerFolder(userCardPath, topic, sanitizedTopic, additionalInfo = {}) {
  // 从路径中提取基础路径和相对路径
  // userCardPath: /app/data/users/default/workspace/card/马斯克
  // userCardBasePath: /app/data/users/default/workspace/card
  // relativePath: 马斯克
  const pathParts = userCardPath.split(path.sep)
  const cardIndex = pathParts.indexOf('card')
  const userCardBasePath = pathParts.slice(0, cardIndex + 1).join(path.sep)
  const relativePath = pathParts.slice(cardIndex + 1).join(path.sep)
  
  const metadata = await readOrInitMetadata(userCardBasePath)
  
  // 初始化文件夹信息
  const folderInfo = {
    topic,
    sanitizedTopic,
    status: 'initialized',
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    files: [],
    ...additionalInfo
  }
  
  // 更新文件夹记录
  const isNew = !metadata.folders[relativePath]
  metadata.folders[relativePath] = folderInfo
  
  // 更新统计
  if (isNew) {
    metadata.statistics.totalFolders++
    metadata.statistics.initialized++
  }
  
  await saveMetadata(userCardBasePath, metadata)
  
  console.log(`[WorkspaceMetadata] Registered folder: ${relativePath}`)
  return folderInfo
}

/**
 * 更新文件夹状态
 * @param {string} userCardPath - 具体卡片文件夹路径
 * @param {string} status - 新状态
 * @param {Object} additionalData - 额外数据
 */
export async function updateFolderStatus(userCardPath, status, additionalData = {}) {
  const pathParts = userCardPath.split(path.sep)
  const cardIndex = pathParts.indexOf('card')
  const userCardBasePath = pathParts.slice(0, cardIndex + 1).join(path.sep)
  const relativePath = pathParts.slice(cardIndex + 1).join(path.sep)
  
  const metadata = await readOrInitMetadata(userCardBasePath)
  
  if (!metadata.folders[relativePath]) {
    console.warn(`[WorkspaceMetadata] Folder not found in metadata: ${relativePath}`)
    return
  }
  
  const oldStatus = metadata.folders[relativePath].status
  
  // 更新文件夹信息
  metadata.folders[relativePath] = {
    ...metadata.folders[relativePath],
    ...additionalData,
    status,
    lastModified: new Date().toISOString(),
    [`${status}At`]: new Date().toISOString()
  }
  
  // 更新统计
  if (oldStatus !== status) {
    // 减少旧状态计数
    if (metadata.statistics[oldStatus] !== undefined && metadata.statistics[oldStatus] > 0) {
      metadata.statistics[oldStatus]--
    }
    // 增加新状态计数
    if (metadata.statistics[status] === undefined) {
      metadata.statistics[status] = 0
    }
    metadata.statistics[status]++
  }
  
  await saveMetadata(userCardBasePath, metadata)
  
  console.log(`[WorkspaceMetadata] Updated folder status: ${relativePath} -> ${status}`)
}

/**
 * 获取文件夹元数据
 * @param {string} userCardPath - 具体卡片文件夹路径
 * @returns {Object|null} 文件夹信息或 null
 */
export async function getFolderMetadata(userCardPath) {
  try {
    const pathParts = userCardPath.split(path.sep)
    const cardIndex = pathParts.indexOf('card')
    const userCardBasePath = pathParts.slice(0, cardIndex + 1).join(path.sep)
    const relativePath = pathParts.slice(cardIndex + 1).join(path.sep)
    
    const metadata = await readOrInitMetadata(userCardBasePath)
    return metadata.folders[relativePath] || null
  } catch (error) {
    console.error(`[WorkspaceMetadata] Error getting folder metadata: ${error.message}`)
    return null
  }
}

/**
 * 获取所有文件夹的元数据
 * @param {string} userCardBasePath - 用户 card 基础路径
 * @returns {Object} 所有文件夹的元数据
 */
export async function getAllFoldersMetadata(userCardBasePath) {
  try {
    const metadata = await readOrInitMetadata(userCardBasePath)
    return metadata.folders
  } catch (error) {
    console.error(`[WorkspaceMetadata] Error getting all folders metadata: ${error.message}`)
    return {}
  }
}

/**
 * 获取 workspace 统计信息
 * @param {string} userCardBasePath - 用户 card 基础路径
 * @returns {Object} 统计信息
 */
export async function getWorkspaceStatistics(userCardBasePath) {
  try {
    const metadata = await readOrInitMetadata(userCardBasePath)
    return metadata.statistics
  } catch (error) {
    console.error(`[WorkspaceMetadata] Error getting statistics: ${error.message}`)
    return {
      totalFolders: 0,
      completed: 0,
      generating: 0,
      failed: 0,
      initialized: 0
    }
  }
}

/**
 * 检查文件夹是否正在处理中
 * @param {string} userCardPath - 具体卡片文件夹路径
 * @returns {boolean} 是否正在处理
 */
export async function isFolderProcessing(userCardPath) {
  const metadata = await getFolderMetadata(userCardPath)
  if (!metadata) return false
  
  const processingStatuses = ['initialized', 'generating', 'processing']
  return processingStatuses.includes(metadata.status)
}

/**
 * 记录生成的文件
 * @param {string} userCardPath - 具体卡片文件夹路径
 * @param {Array<string>} files - 文件名列表
 */
export async function recordGeneratedFiles(userCardPath, files) {
  const pathParts = userCardPath.split(path.sep)
  const cardIndex = pathParts.indexOf('card')
  const userCardBasePath = pathParts.slice(0, cardIndex + 1).join(path.sep)
  const relativePath = pathParts.slice(cardIndex + 1).join(path.sep)
  
  const metadata = await readOrInitMetadata(userCardBasePath)
  
  if (metadata.folders[relativePath]) {
    metadata.folders[relativePath].files = files
    metadata.folders[relativePath].lastModified = new Date().toISOString()
    await saveMetadata(userCardBasePath, metadata)
    console.log(`[WorkspaceMetadata] Recorded ${files.length} files for: ${relativePath}`)
  }
}

export default {
  registerFolder,
  updateFolderStatus,
  getFolderMetadata,
  getAllFoldersMetadata,
  getWorkspaceStatistics,
  isFolderProcessing,
  recordGeneratedFiles
}