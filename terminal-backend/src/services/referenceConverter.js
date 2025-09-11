/**
 * 素材引用转换服务
 * 将前端的引用标记转换为实际的文件系统路径
 */

import fs from 'fs/promises'
import path from 'path'

/**
 * 获取用户存储路径
 */
const getUserStoragePath = (username = 'default') => {
  const isDocker = process.env.NODE_ENV === 'production' || process.env.DATA_PATH
  const dataPath = process.env.DATA_PATH || path.join(process.cwd(), 'data')
  
  if (isDocker) {
    return `/app/data/users/${username}/assets`
  } else {
    return path.join(dataPath, 'users', username, 'assets')
  }
}

/**
 * 获取用户元数据路径
 */
const getUserMetadataPath = (username = 'default') => {
  const isDocker = process.env.NODE_ENV === 'production' || process.env.DATA_PATH
  const dataPath = process.env.DATA_PATH || path.join(process.cwd(), 'data')
  
  if (isDocker) {
    return `/app/data/users/${username}/assets_metadata.json`
  } else {
    return path.join(dataPath, 'users', username, 'assets_metadata.json')
  }
}

/**
 * 读取用户的素材元数据
 */
const readMetadata = async (username) => {
  const metadataPath = getUserMetadataPath(username)
  
  try {
    const content = await fs.readFile(metadataPath, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    console.error(`[ReferenceConverter] Failed to read metadata for user ${username}:`, error)
    // 返回默认空结构
    return {
      version: '3.0',
      userId: username,
      assets: {},
      labels: {}
    }
  }
}

/**
 * 转换引用数组为文件路径数组
 * @param {Array} references - 引用数组
 * @param {string} username - 用户名
 * @returns {Array} 文件路径数组
 */
export const convertReferencesToPaths = async (references, username = 'default') => {
  if (!references || !Array.isArray(references)) {
    return []
  }
  
  const basePath = getUserStoragePath(username)
  const metadata = await readMetadata(username)
  const filePaths = []
  
  console.log(`[ReferenceConverter] Converting ${references.length} references for user ${username}`)
  console.log(`[ReferenceConverter] Base path: ${basePath}`)
  console.log(`[ReferenceConverter] References:`, JSON.stringify(references, null, 2))
  
  for (const ref of references) {
    if (ref.type === 'category') {
      // 处理分类引用
      // 首先尝试用key查找
      let categoryKey = ref.key
      let files = metadata.assets[categoryKey] || []
      
      // 如果没找到，尝试用label查找对应的key
      if (files.length === 0 && ref.label) {
        // 在labels中查找匹配的key
        for (const [key, label] of Object.entries(metadata.labels || {})) {
          if (label === ref.label || key === ref.label) {
            categoryKey = key
            files = metadata.assets[key] || []
            break
          }
        }
      }
      
      console.log(`[ReferenceConverter] Category ${categoryKey} (${ref.label}) has ${files.length} files`)
      
      files.forEach(fileName => {
        filePaths.push({
          type: 'category_file',
          category: categoryKey,
          categoryLabel: ref.label || metadata.labels[categoryKey] || categoryKey,
          fileName: fileName,
          fullPath: path.join(basePath, fileName),
          fileType: getFileType(fileName),
          action: ref.action || 'include'
        })
      })
    } else if (ref.type === 'file') {
      // 处理单个文件引用
      let fileName = ref.name || ref.fileName
      console.log(`[ReferenceConverter] Original file reference: ${fileName}`)
      
      // 尝试多种解码方式，处理可能的编码问题
      let decodedFileName = fileName
      
      // 1. 尝试URL解码
      try {
        const urlDecoded = decodeURIComponent(fileName)
        if (urlDecoded !== fileName) {
          decodedFileName = urlDecoded
          console.log(`[ReferenceConverter] URL decoded to: ${decodedFileName}`)
        }
      } catch (e) {
        console.log(`[ReferenceConverter] URL decode failed for ${fileName}`)
      }
      
      // 2. 如果看起来像Latin-1编码的中文（包含Ã等字符），尝试修复
      if (decodedFileName.includes('Ã') || decodedFileName.includes('å') || decodedFileName.includes('æ')) {
        try {
          // 将字符串视为Latin-1编码，转换回UTF-8
          const latin1Buffer = Buffer.from(decodedFileName, 'latin1')
          const utf8String = latin1Buffer.toString('utf8')
          if (!utf8String.includes('�')) {
            decodedFileName = utf8String
            console.log(`[ReferenceConverter] Latin-1 decoded to: ${decodedFileName}`)
          }
        } catch (e) {
          console.log(`[ReferenceConverter] Latin-1 decode failed`)
        }
      }
      
      fileName = decodedFileName
      console.log(`[ReferenceConverter] Final file reference: ${fileName}`)
      
      // 验证文件是否存在于元数据中
      let fileExists = false
      let fileCategory = ref.category || ''
      let fileCategoryLabel = ref.categoryLabel || ''
      
      // 在所有分类中查找文件
      if (metadata.assets) {
        for (const [category, files] of Object.entries(metadata.assets)) {
          // 直接匹配
          if (files.includes(fileName)) {
            fileExists = true
            if (!fileCategory) {
              fileCategory = category
              fileCategoryLabel = metadata.labels[category] || category
            }
            break
          }
          
          // 如果直接匹配失败，尝试匹配元数据中的乱码文件名
          // 这处理了元数据中存储的是乱码文件名的情况
          for (const metaFileName of files) {
            // 尝试解码元数据中的文件名并与目标文件名比较
            try {
              // Latin-1 解码
              const latin1Buffer = Buffer.from(metaFileName, 'latin1')
              const decodedMetaName = latin1Buffer.toString('utf8')
              
              if (decodedMetaName === fileName || metaFileName === fileName) {
                fileExists = true
                fileName = metaFileName  // 使用元数据中的实际文件名
                if (!fileCategory) {
                  fileCategory = category
                  fileCategoryLabel = metadata.labels[category] || category
                }
                console.log(`[ReferenceConverter] Matched via encoding: ${fileName} -> ${metaFileName}`)
                break
              }
            } catch (e) {
              // 忽略解码错误
            }
          }
          
          if (fileExists) break
        }
      }
      
      // 检查根目录文件
      if (!fileExists && metadata.rootFiles && metadata.rootFiles.includes(fileName)) {
        fileExists = true
        fileCategory = ''
        fileCategoryLabel = '根目录'
      }
      
      if (!fileExists) {
        console.warn(`[ReferenceConverter] Warning: File ${fileName} not found in metadata`)
      }
      
      filePaths.push({
        type: 'single_file',
        category: fileCategory,
        categoryLabel: fileCategoryLabel,
        fileName: fileName,
        fullPath: path.join(basePath, fileName),
        fileType: getFileType(fileName),
        action: ref.action || 'include',
        exists: fileExists
      })
    }
  }
  
  console.log(`[ReferenceConverter] Converted to ${filePaths.length} file paths`)
  return filePaths
}

/**
 * 获取文件类型图标
 */
const getFileTypeIcon = (fileType) => {
  const iconMap = {
    'image': '🖼️',
    'pdf': '📑',
    'text': '📝',
    'markdown': '📝',
    'javascript': '📜',
    'typescript': '📜',
    'python': '🐍',
    'java': '☕',
    'html': '🌐',
    'css': '🎨',
    'json': '📋',
    'excel': '📊',
    'csv': '📊',
    'video': '🎬',
    'audio': '🎵',
    'document': '📄'
  }
  return iconMap[fileType] || '📄'
}

/**
 * 获取文件类型
 */
const getFileType = (fileName) => {
  if (!fileName) return 'unknown'
  
  const ext = path.extname(fileName).toLowerCase().substring(1)
  
  const typeMap = {
    // 图片
    jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', 
    svg: 'image', webp: 'image', bmp: 'image',
    
    // 文档
    pdf: 'pdf', 
    doc: 'document', docx: 'document',
    txt: 'text', md: 'markdown',
    
    // 代码
    js: 'javascript', ts: 'typescript', py: 'python',
    java: 'java', cpp: 'cpp', c: 'c', cs: 'csharp',
    html: 'html', css: 'css', json: 'json', xml: 'xml',
    
    // 数据
    xlsx: 'excel', xls: 'excel', csv: 'csv',
    
    // 视频
    mp4: 'video', avi: 'video', mov: 'video', wmv: 'video',
    
    // 音频
    mp3: 'audio', wav: 'audio', flac: 'audio'
  }
  
  return typeMap[ext] || ext || 'unknown'
}

/**
 * 构建引用提示词 - 返回文件路径映射
 * @param {Array} filePaths - 文件路径数组
 * @param {string} username - 用户名
 * @returns {object} 包含路径映射的对象
 */
export const buildReferencePrompt = async (filePaths, username = 'default') => {
  if (!filePaths || filePaths.length === 0) {
    console.log('[ReferenceConverter] No file paths to build prompt from')
    return { pathMap: {}, prompt: '' }
  }
  
  console.log(`[ReferenceConverter] Building path map for ${filePaths.length} files`)
  
  // 创建文件名到路径的映射
  const pathMap = {}
  
  filePaths.forEach(file => {
    // 使用文件名作为键，绝对路径作为值
    pathMap[file.fileName] = file.fullPath
    console.log(`[ReferenceConverter] Mapped: ${file.fileName} -> ${file.fullPath}`)
  })
  
  return { pathMap, prompt: '' }  // 不再返回额外的提示词
}

/**
 * 检查文件是否存在
 */
export const checkFileExists = async (filePath) => {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * 验证引用的文件是否都存在
 */
export const validateReferences = async (filePaths) => {
  const results = []
  
  for (const file of filePaths) {
    const exists = await checkFileExists(file.fullPath)
    results.push({
      ...file,
      exists
    })
  }
  
  return results
}

export default {
  convertReferencesToPaths,
  buildReferencePrompt,
  checkFileExists,
  validateReferences,
  getUserStoragePath,
  getUserMetadataPath
}