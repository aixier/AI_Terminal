/**
 * OSS服务ES模块包装器
 * 用于解决ES模块与CommonJS模块的兼容性问题
 * 
 * 这个文件作为ES模块和CommonJS模块之间的桥梁，
 * 允许ES模块项目使用CommonJS格式的OSS服务
 */

import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 创建require函数来加载CommonJS模块
const require = createRequire(import.meta.url)

// 动态导入CommonJS模块
let ossModule = null
let OSSService = null

try {
  // 尝试加载OSS服务模块
  ossModule = require('./index.cjs')
  OSSService = ossModule.OSSService || ossModule.default
} catch (error) {
  console.error('[OSS Wrapper] 无法加载OSS服务模块:', error.message)
}

/**
 * 创建OSS服务实例
 * @param {string} project - 项目名称（默认为 'default'）
 * @param {Object} customConfig - 自定义配置
 * @returns {Object} OSS服务实例
 */
export function createOSSService(project = 'default', customConfig = {}) {
  if (!OSSService) {
    throw new Error('OSS服务模块未正确加载，请检查 /services/oss/index.cjs 文件')
  }
  
  try {
    return new OSSService(project, customConfig)
  } catch (error) {
    console.error('[OSS Wrapper] 创建OSS服务实例失败:', error)
    throw error
  }
}

/**
 * 检查文件类型是否允许
 * @param {string} filename - 文件名
 * @returns {boolean} 是否允许
 */
export function isAllowedFileType(filename) {
  if (ossModule && ossModule.isAllowedFileType) {
    return ossModule.isAllowedFileType(filename)
  }
  
  // 默认允许的文件类型
  const allowedExtensions = [
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp',
    '.pdf', '.doc', '.docx', '.txt', '.md', '.rtf',
    '.mp4', '.avi', '.mov', '.mp3', '.wav',
    '.zip', '.rar', '.7z'
  ]
  
  const ext = path.extname(filename).toLowerCase()
  return allowedExtensions.includes(ext)
}

/**
 * 检查文件大小是否允许
 * @param {number} size - 文件大小（字节）
 * @param {number} maxSize - 最大允许大小（字节），默认100MB
 * @returns {boolean} 是否允许
 */
export function isAllowedFileSize(size, maxSize = 100 * 1024 * 1024) {
  if (ossModule && ossModule.isAllowedFileSize) {
    return ossModule.isAllowedFileSize(size, maxSize)
  }
  
  return size <= maxSize
}

/**
 * 获取OSS配置
 * @param {string} project - 项目名称
 * @returns {Object} OSS配置
 */
export function getOSSConfig(project = 'default') {
  if (ossModule && ossModule.getOSSConfig) {
    return ossModule.getOSSConfig(project)
  }
  
  // 返回默认配置
  return {
    accessKeyId: process.env.OSS_ACCESS_KEY_ID,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
    bucket: process.env.OSS_BUCKET || 'ai-terminal-assets',
    region: process.env.OSS_REGION || 'oss-cn-hangzhou',
    endpoint: process.env.OSS_ENDPOINT || 'https://oss-cn-hangzhou.aliyuncs.com'
  }
}

/**
 * 简化的OSS服务类（当无法加载完整模块时的备用方案）
 */
export class SimpleOSSService {
  constructor(project = 'default', customConfig = {}) {
    this.project = project
    this.config = { ...getOSSConfig(project), ...customConfig }
    this.baseDir = customConfig.baseDir || 'assets'
    
    console.warn('[OSS Wrapper] 使用简化的OSS服务，部分功能可能不可用')
  }
  
  /**
   * 生成OSS对象键
   * @param {string} filename - 文件名
   * @param {Object} options - 选项
   * @returns {string} OSS对象键
   */
  generateOSSKey(filename, options = {}) {
    const { customDir, useTimestamp = true } = options
    const timestamp = useTimestamp ? `_${Date.now()}` : ''
    const ext = path.extname(filename)
    const name = path.basename(filename, ext)
    
    const parts = [this.baseDir]
    if (customDir) parts.push(customDir)
    parts.push(`${name}${timestamp}${ext}`)
    
    return parts.join('/')
  }
  
  /**
   * 获取OSS URL
   * @param {string} ossKey - OSS对象键
   * @returns {string} OSS URL
   */
  getOSSUrl(ossKey) {
    return `${this.config.endpoint}/${this.config.bucket}/${ossKey}`
  }
  
  /**
   * 模拟上传（实际不执行OSS操作）
   * @param {string} localPath - 本地文件路径
   * @param {Object} options - 上传选项
   * @returns {Object} 上传结果
   */
  async upload(localPath, options = {}) {
    const filename = path.basename(localPath)
    const ossKey = this.generateOSSKey(filename, options)
    const url = this.getOSSUrl(ossKey)
    
    return {
      success: true,
      name: ossKey,
      url: url,
      message: 'OSS服务暂时不可用，文件仅保存在本地'
    }
  }
  
  /**
   * 模拟删除（实际不执行OSS操作）
   * @param {string} ossKey - OSS对象键
   * @returns {Object} 删除结果
   */
  async delete(ossKey) {
    return {
      success: true,
      message: 'OSS服务暂时不可用，仅删除本地记录'
    }
  }
}

// 导出默认的OSS服务创建函数
export default function(project = 'default', customConfig = {}) {
  try {
    return createOSSService(project, customConfig)
  } catch (error) {
    // 如果无法创建完整的OSS服务，返回简化版本
    return new SimpleOSSService(project, customConfig)
  }
}