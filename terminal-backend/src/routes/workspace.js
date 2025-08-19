/**
 * Workspace API Routes
 * 管理用户workspace的API接口
 */

import express from 'express'
import fs from 'fs/promises'
import path from 'path'
import userService from '../services/userService.js'
import logger from '../utils/logger.js'

const router = express.Router()

/**
 * 获取用户workspace结构
 */
router.get('/:username', async (req, res) => {
  const { username } = req.params
  
  try {
    const { workspacePath } = userService.getUserWorkspacePath(username)
    
    // 检查workspace是否存在
    const workspaceExists = await fs.access(workspacePath).then(() => true).catch(() => false)
    
    if (!workspaceExists) {
      // 尝试迁移旧数据
      await userService.migrateToWorkspace(username)
    }
    
    // 递归扫描workspace目录
    const workspaceContent = await scanDirectory(workspacePath, workspacePath)
    
    res.json({
      username,
      workspace: workspaceContent,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    logger.error(`Failed to get workspace for ${username}:`, error)
    res.status(500).json({ error: '获取工作空间失败', message: error.message })
  }
})

/**
 * 获取特定类型的文件
 */
router.get('/:username/files', async (req, res) => {
  const { username } = req.params
  const { type, folder } = req.query
  
  try {
    const { workspacePath } = userService.getUserWorkspacePath(username)
    
    let targetPath = workspacePath
    if (folder) {
      targetPath = path.join(workspacePath, folder)
    }
    
    const files = await getFilesByType(targetPath, type)
    
    res.json({
      username,
      type: type || 'all',
      folder: folder || 'workspace',
      files,
      count: files.length,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    logger.error(`Failed to get files for ${username}:`, error)
    res.status(500).json({ error: '获取文件列表失败', message: error.message })
  }
})

/**
 * 创建文件或文件夹
 */
router.post('/:username/create', async (req, res) => {
  const { username } = req.params
  const { path: relativePath, type, content, name } = req.body
  
  try {
    const { workspacePath } = userService.getUserWorkspacePath(username)
    const fullPath = path.join(workspacePath, relativePath || '', name)
    
    if (type === 'file') {
      // 创建文件
      await fs.writeFile(fullPath, content || '', 'utf-8')
    } else if (type === 'folder') {
      // 创建文件夹
      await fs.mkdir(fullPath, { recursive: true })
    } else {
      throw new Error('Invalid type, must be "file" or "folder"')
    }
    
    res.json({
      success: true,
      path: relativePath ? path.join(relativePath, name) : name,
      type,
      message: `${type === 'file' ? '文件' : '文件夹'}创建成功`
    })
    
  } catch (error) {
    logger.error(`Failed to create ${req.body.type} for ${username}:`, error)
    res.status(500).json({ error: '创建失败', message: error.message })
  }
})

/**
 * 读取文件内容
 */
router.get(/\/([^/]+)\/file\/(.*)/, async (req, res) => {
  const username = req.params[0]
  const filePath = req.params[1]
  
  try {
    const { workspacePath } = userService.getUserWorkspacePath(username)
    const fullPath = path.join(workspacePath, filePath)
    
    // 检查文件是否存在
    const stat = await fs.stat(fullPath)
    if (!stat.isFile()) {
      return res.status(404).json({ error: '文件不存在' })
    }
    
    const content = await fs.readFile(fullPath, 'utf-8')
    const ext = path.extname(fullPath).toLowerCase()
    
    res.json({
      path: filePath,
      content,
      size: stat.size,
      modified: stat.mtime,
      type: getFileType(ext),
      encoding: 'utf-8'
    })
    
  } catch (error) {
    logger.error(`Failed to read file for ${username}:`, error)
    res.status(500).json({ error: '读取文件失败', message: error.message })
  }
})

/**
 * 更新文件内容
 */
router.put(/\/([^/]+)\/file\/(.*)/, async (req, res) => {
  const username = req.params[0]
  const filePath = req.params[1]
  const { content } = req.body
  
  try {
    const { workspacePath } = userService.getUserWorkspacePath(username)
    const fullPath = path.join(workspacePath, filePath)
    
    await fs.writeFile(fullPath, content, 'utf-8')
    
    res.json({
      success: true,
      path: filePath,
      message: '文件保存成功',
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    logger.error(`Failed to update file for ${username}:`, error)
    res.status(500).json({ error: '保存文件失败', message: error.message })
  }
})

/**
 * 删除文件或文件夹
 */
router.delete(/\/([^/]+)\/file\/(.*)/, async (req, res) => {
  const username = req.params[0]
  const filePath = req.params[1]
  
  try {
    const { workspacePath } = userService.getUserWorkspacePath(username)
    const fullPath = path.join(workspacePath, filePath)
    
    const stat = await fs.stat(fullPath)
    
    if (stat.isDirectory()) {
      await fs.rmdir(fullPath, { recursive: true })
    } else {
      await fs.unlink(fullPath)
    }
    
    res.json({
      success: true,
      path: filePath,
      type: stat.isDirectory() ? 'folder' : 'file',
      message: '删除成功'
    })
    
  } catch (error) {
    logger.error(`Failed to delete file for ${username}:`, error)
    res.status(500).json({ error: '删除失败', message: error.message })
  }
})

/**
 * 迁移用户数据
 */
router.post('/:username/migrate', async (req, res) => {
  const { username } = req.params
  
  try {
    const migrationResult = await userService.migrateToWorkspace(username)
    
    res.json({
      success: true,
      username,
      migrationResult,
      message: '数据迁移完成'
    })
    
  } catch (error) {
    logger.error(`Failed to migrate data for ${username}:`, error)
    res.status(500).json({ error: '数据迁移失败', message: error.message })
  }
})

/**
 * 递归扫描目录
 */
async function scanDirectory(dirPath, basePath) {
  const items = []
  
  try {
    const entries = await fs.readdir(dirPath)
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry)
      const relativePath = path.relative(basePath, fullPath)
      const stat = await fs.stat(fullPath)
      
      if (stat.isDirectory()) {
        const subItems = await scanDirectory(fullPath, basePath)
        items.push({
          name: entry,
          path: relativePath,
          type: 'folder',
          size: subItems.length,
          modified: stat.mtime,
          children: subItems
        })
      } else {
        const ext = path.extname(entry).toLowerCase()
        items.push({
          name: entry,
          path: relativePath,
          type: 'file',
          fileType: getFileType(ext),
          size: stat.size,
          modified: stat.mtime
        })
      }
    }
  } catch (error) {
    logger.error(`Failed to scan directory ${dirPath}:`, error)
  }
  
  return items
}

/**
 * 按类型获取文件
 */
async function getFilesByType(dirPath, type) {
  const files = []
  
  async function scanForFiles(currentPath, relativeTo) {
    try {
      const entries = await fs.readdir(currentPath)
      
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry)
        const relativePath = path.relative(relativeTo, fullPath)
        const stat = await fs.stat(fullPath)
        
        if (stat.isDirectory()) {
          await scanForFiles(fullPath, relativeTo)
        } else {
          const ext = path.extname(entry).toLowerCase()
          const fileType = getFileType(ext)
          
          if (!type || type === 'all' || fileType === type) {
            files.push({
              name: entry,
              path: relativePath,
              type: 'file',
              fileType,
              size: stat.size,
              modified: stat.mtime
            })
          }
        }
      }
    } catch (error) {
      logger.error(`Failed to scan for files in ${currentPath}:`, error)
    }
  }
  
  await scanForFiles(dirPath, dirPath)
  return files
}

/**
 * 根据扩展名确定文件类型
 */
function getFileType(ext) {
  const typeMap = {
    '.md': 'markdown',
    '.txt': 'text',
    '.html': 'html',
    '.htm': 'html',
    '.json': 'json',
    '.js': 'javascript',
    '.css': 'css',
    '.png': 'image',
    '.jpg': 'image',
    '.jpeg': 'image',
    '.gif': 'image',
    '.svg': 'image',
    '.mp4': 'video',
    '.avi': 'video',
    '.mov': 'video',
    '.pdf': 'document',
    '.doc': 'document',
    '.docx': 'document'
  }
  
  return typeMap[ext] || 'other'
}

export default router