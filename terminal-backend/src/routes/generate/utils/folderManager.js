/**
 * 文件夹管理工具
 * 处理文件夹创建和管理的通用逻辑
 * 使用 workspace 级别的元数据，避免在主题文件夹内创建元数据文件
 */

import fs from 'fs/promises'
import path from 'path'
import * as workspaceMetadata from './workspaceMetadata.js'

/**
 * 创建或获取用户卡片文件夹
 * @param {string} userCardPath - 用户卡片路径
 * @param {string} topic - 主题
 * @param {string} sanitizedTopic - 清理后的主题名称
 * @returns {Object} 文件夹信息
 */
export async function ensureCardFolder(userCardPath, topic, sanitizedTopic) {
  const folderInfo = {
    path: userCardPath,
    folderName: sanitizedTopic,
    originalTopic: topic,
    existed: false,
    created: false,
    error: null,
    createdAt: null
  }
  
  try {
    // 检查文件夹是否已存在
    try {
      const stats = await fs.stat(userCardPath)
      if (stats.isDirectory()) {
        folderInfo.existed = true
        folderInfo.createdAt = stats.birthtime
        console.log(`[FolderManager] Folder already exists: ${userCardPath}`)
      }
    } catch (error) {
      // 文件夹不存在，需要创建
      if (error.code === 'ENOENT') {
        await fs.mkdir(userCardPath, { recursive: true })
        folderInfo.created = true
        folderInfo.createdAt = new Date()
        console.log(`[FolderManager] Created new folder: ${userCardPath}`)
      } else {
        throw error
      }
    }
    
    // 注册到 workspace 元数据（而不是在文件夹内创建元数据文件）
    await workspaceMetadata.registerFolder(userCardPath, topic, sanitizedTopic, {
      createdAt: folderInfo.createdAt ? folderInfo.createdAt.toISOString() : new Date().toISOString(),
      status: 'initialized'
    })
    
    return folderInfo
    
  } catch (error) {
    console.error(`[FolderManager] Error ensuring folder: ${error.message}`)
    folderInfo.error = error.message
    throw error
  }
}

/**
 * 更新文件夹状态
 * @param {string} userCardPath - 用户卡片路径
 * @param {string} status - 状态
 * @param {Object} additionalData - 额外数据
 */
export async function updateFolderStatus(userCardPath, status, additionalData = {}) {
  try {
    // 使用 workspace 元数据更新状态
    await workspaceMetadata.updateFolderStatus(userCardPath, status, additionalData)
    console.log(`[FolderManager] Updated folder status to: ${status}`)
  } catch (error) {
    console.error(`[FolderManager] Error updating folder status: ${error.message}`)
    // 不抛出错误，因为这是辅助功能
  }
}

/**
 * 获取文件夹元数据
 * @param {string} userCardPath - 用户卡片路径
 * @returns {Object|null} 元数据对象或null
 */
export async function getFolderMetadata(userCardPath) {
  try {
    return await workspaceMetadata.getFolderMetadata(userCardPath)
  } catch (error) {
    console.log(`[FolderManager] No metadata found for folder: ${userCardPath}`)
    return null
  }
}

/**
 * 检查文件夹是否正在处理中
 * @param {string} userCardPath - 用户卡片路径
 * @returns {boolean} 是否正在处理
 */
export async function isFolderProcessing(userCardPath) {
  try {
    return await workspaceMetadata.isFolderProcessing(userCardPath)
  } catch {
    return false
  }
}

/**
 * 记录生成的文件
 * @param {string} userCardPath - 用户卡片路径
 * @param {Array<string>} files - 文件名列表
 */
export async function recordGeneratedFiles(userCardPath, files) {
  try {
    await workspaceMetadata.recordGeneratedFiles(userCardPath, files)
  } catch (error) {
    console.error(`[FolderManager] Error recording generated files: ${error.message}`)
  }
}

export default {
  ensureCardFolder,
  updateFolderStatus,
  getFolderMetadata,
  isFolderProcessing,
  recordGeneratedFiles
}