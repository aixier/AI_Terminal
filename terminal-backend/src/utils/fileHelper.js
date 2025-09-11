/**
 * 文件辅助函数
 * 提供文件操作相关的工具函数
 */

import path from 'path'
import fs from 'fs/promises'
import crypto from 'crypto'
import mime from 'mime-types'

/**
 * 获取文件扩展名
 */
export function getFileExtension(filename) {
  const ext = path.extname(filename).toLowerCase()
  return ext || ''
}

/**
 * 获取文件名（不含扩展名）
 */
export function getFileNameWithoutExt(filename) {
  const ext = getFileExtension(filename)
  return ext ? filename.slice(0, -ext.length) : filename
}

/**
 * 获取文件类型
 */
export function getFileType(filename, mimeType) {
  const ext = getFileExtension(filename).slice(1) // 移除点号
  
  // 根据MIME类型判断
  if (mimeType) {
    if (mimeType.startsWith('image/')) return 'image'
    if (mimeType.startsWith('video/')) return 'video'
    if (mimeType.startsWith('audio/')) return 'audio'
    if (mimeType === 'application/pdf') return 'pdf'
    if (mimeType.includes('word')) return 'word'
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'excel'
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'powerpoint'
  }
  
  // 根据扩展名判断
  const typeMap = {
    // 图片
    jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', 
    webp: 'image', svg: 'image', ico: 'image', bmp: 'image',
    
    // 视频
    mp4: 'video', avi: 'video', mov: 'video', wmv: 'video',
    flv: 'video', mkv: 'video', webm: 'video', m4v: 'video',
    
    // 音频
    mp3: 'audio', wav: 'audio', flac: 'audio', aac: 'audio',
    ogg: 'audio', wma: 'audio', m4a: 'audio',
    
    // 文档
    pdf: 'pdf',
    doc: 'word', docx: 'word',
    xls: 'excel', xlsx: 'excel',
    ppt: 'powerpoint', pptx: 'powerpoint',
    txt: 'text', md: 'markdown',
    
    // 代码
    js: 'code', ts: 'code', jsx: 'code', tsx: 'code',
    py: 'code', java: 'code', c: 'code', cpp: 'code',
    html: 'code', css: 'code', scss: 'code', less: 'code',
    json: 'code', xml: 'code', yaml: 'code', yml: 'code',
    sh: 'code', bash: 'code', go: 'code', rs: 'code',
    
    // 压缩包
    zip: 'archive', rar: 'archive', '7z': 'archive',
    tar: 'archive', gz: 'archive', bz2: 'archive'
  }
  
  return typeMap[ext] || 'file'
}

/**
 * 生成文件哈希
 */
export async function generateFileHash(filePath, algorithm = 'sha256') {
  const fileBuffer = await fs.readFile(filePath)
  const hash = crypto.createHash(algorithm)
  hash.update(fileBuffer)
  return hash.digest('hex')
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

/**
 * 验证文件名
 */
export function validateFileName(filename) {
  // 检查是否为空
  if (!filename || filename.trim() === '') {
    return { valid: false, error: 'Filename cannot be empty' }
  }
  
  // 检查长度
  if (filename.length > 255) {
    return { valid: false, error: 'Filename too long (max 255 characters)' }
  }
  
  // 检查非法字符（Windows和Linux都不允许的字符）
  const invalidChars = /[<>:"|?*\x00-\x1f]/
  if (invalidChars.test(filename)) {
    return { valid: false, error: 'Filename contains invalid characters' }
  }
  
  // 检查保留名称（Windows）
  const reservedNames = [
    'CON', 'PRN', 'AUX', 'NUL',
    'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
    'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
  ]
  
  const nameWithoutExt = getFileNameWithoutExt(filename).toUpperCase()
  if (reservedNames.includes(nameWithoutExt)) {
    return { valid: false, error: 'Filename is a reserved system name' }
  }
  
  // 检查是否以点或空格结尾（Windows不允许）
  if (filename.endsWith('.') || filename.endsWith(' ')) {
    return { valid: false, error: 'Filename cannot end with a dot or space' }
  }
  
  return { valid: true }
}

/**
 * 生成安全的文件名
 */
export function sanitizeFileName(filename) {
  // 移除或替换非法字符
  let safe = filename.replace(/[<>:"|?*\x00-\x1f]/g, '_')
  
  // 移除开头和结尾的空格和点
  safe = safe.trim().replace(/^\.+/, '').replace(/\.+$/, '')
  
  // 如果文件名为空或只有扩展名，生成默认名称
  if (!safe || safe.startsWith('.')) {
    const timestamp = Date.now()
    safe = `file_${timestamp}${safe}`
  }
  
  // 限制长度
  if (safe.length > 255) {
    const ext = getFileExtension(safe)
    const nameWithoutExt = getFileNameWithoutExt(safe)
    const maxNameLength = 255 - ext.length
    safe = nameWithoutExt.substring(0, maxNameLength) + ext
  }
  
  return safe
}

/**
 * 生成唯一文件名
 */
export function generateUniqueFileName(originalName) {
  const ext = getFileExtension(originalName)
  const nameWithoutExt = getFileNameWithoutExt(originalName)
  const timestamp = Date.now()
  const random = Math.random().toString(36).substr(2, 9)
  
  return `${nameWithoutExt}_${timestamp}_${random}${ext}`
}

/**
 * 获取MIME类型
 */
export function getMimeType(filename) {
  return mime.lookup(filename) || 'application/octet-stream'
}

/**
 * 检查是否是图片文件
 */
export function isImageFile(filename, mimeType) {
  if (mimeType && mimeType.startsWith('image/')) {
    return true
  }
  
  const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico', '.bmp']
  const ext = getFileExtension(filename).toLowerCase()
  
  return imageExts.includes(ext)
}

/**
 * 检查是否是视频文件
 */
export function isVideoFile(filename, mimeType) {
  if (mimeType && mimeType.startsWith('video/')) {
    return true
  }
  
  const videoExts = ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv', '.webm', '.m4v']
  const ext = getFileExtension(filename).toLowerCase()
  
  return videoExts.includes(ext)
}

/**
 * 检查是否是音频文件
 */
export function isAudioFile(filename, mimeType) {
  if (mimeType && mimeType.startsWith('audio/')) {
    return true
  }
  
  const audioExts = ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma', '.m4a']
  const ext = getFileExtension(filename).toLowerCase()
  
  return audioExts.includes(ext)
}

/**
 * 检查文件是否存在
 */
export async function fileExists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * 确保目录存在
 */
export async function ensureDirectory(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true })
    return true
  } catch (error) {
    console.error('Failed to create directory:', error)
    return false
  }
}

/**
 * 复制文件
 */
export async function copyFile(source, destination) {
  try {
    await fs.copyFile(source, destination)
    return true
  } catch (error) {
    console.error('Failed to copy file:', error)
    return false
  }
}

/**
 * 移动文件
 */
export async function moveFile(source, destination) {
  try {
    await fs.rename(source, destination)
    return true
  } catch (error) {
    // 如果跨设备移动失败，尝试复制后删除
    if (error.code === 'EXDEV') {
      const copied = await copyFile(source, destination)
      if (copied) {
        await fs.unlink(source)
        return true
      }
    }
    console.error('Failed to move file:', error)
    return false
  }
}

/**
 * 删除文件或目录
 */
export async function deleteFileOrDirectory(targetPath) {
  try {
    const stats = await fs.stat(targetPath)
    
    if (stats.isDirectory()) {
      await fs.rm(targetPath, { recursive: true, force: true })
    } else {
      await fs.unlink(targetPath)
    }
    
    return true
  } catch (error) {
    console.error('Failed to delete:', error)
    return false
  }
}

/**
 * 获取文件统计信息
 */
export async function getFileStats(filePath) {
  try {
    const stats = await fs.stat(filePath)
    
    return {
      size: stats.size,
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
      createdAt: stats.birthtime,
      modifiedAt: stats.mtime,
      accessedAt: stats.atime
    }
  } catch (error) {
    console.error('Failed to get file stats:', error)
    return null
  }
}

/**
 * 读取目录内容
 */
export async function readDirectory(dirPath, options = {}) {
  const { withStats = false, recursive = false } = options
  
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    const results = []
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)
      const item = {
        name: entry.name,
        path: fullPath,
        isDirectory: entry.isDirectory(),
        isFile: entry.isFile()
      }
      
      if (withStats) {
        const stats = await getFileStats(fullPath)
        Object.assign(item, stats)
      }
      
      results.push(item)
      
      if (recursive && entry.isDirectory()) {
        const subItems = await readDirectory(fullPath, options)
        results.push(...subItems)
      }
    }
    
    return results
  } catch (error) {
    console.error('Failed to read directory:', error)
    return []
  }
}

/**
 * 创建文件流
 */
export function createReadStream(filePath, options) {
  const fs = require('fs')
  return fs.createReadStream(filePath, options)
}

/**
 * 创建写入流
 */
export function createWriteStream(filePath, options) {
  const fs = require('fs')
  return fs.createWriteStream(filePath, options)
}

/**
 * 计算目录大小
 */
export async function getDirectorySize(dirPath) {
  let totalSize = 0
  
  const items = await readDirectory(dirPath, { withStats: true, recursive: true })
  
  for (const item of items) {
    if (item.isFile) {
      totalSize += item.size || 0
    }
  }
  
  return totalSize
}

/**
 * 获取文件的相对路径
 */
export function getRelativePath(from, to) {
  return path.relative(from, to)
}

/**
 * 规范化路径
 */
export function normalizePath(filePath) {
  return path.normalize(filePath).replace(/\\/g, '/')
}

/**
 * 验证路径安全性（防止目录遍历）
 */
export function isPathSafe(userPath, requestedPath) {
  const resolvedPath = path.resolve(userPath, requestedPath)
  const resolvedUserPath = path.resolve(userPath)
  
  return resolvedPath.startsWith(resolvedUserPath)
}