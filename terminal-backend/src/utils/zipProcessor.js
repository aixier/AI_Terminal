import yauzl from 'yauzl'
import fs from 'fs/promises'
import { createWriteStream } from 'fs'
import path from 'path'
import iconv from 'iconv-lite'
import { promisify } from 'util'

/**
 * ZIP文件处理器
 * 负责解压和分析ZIP文件结构
 */
class ZipProcessor {
  /**
   * 解压ZIP文件到指定目录
   * @param {string} zipPath - ZIP文件路径
   * @param {string} targetDir - 目标目录
   * @returns {Promise<Object>} 文件结构信息
   */
  async extract(zipPath, targetDir) {
    console.log(`[ZipProcessor] Extracting ${zipPath} to ${targetDir}`)
    
    // 验证ZIP文件存在
    try {
      await fs.access(zipPath)
    } catch (error) {
      throw new Error(`ZIP文件不存在: ${zipPath}`)
    }
    
    // 创建目标目录
    await fs.mkdir(targetDir, { recursive: true })
    
    // 解压文件，处理中文编码
    try {
      const openZip = promisify(yauzl.open)
      const zipFile = await openZip(zipPath, { 
        lazyEntries: true,
        decodeStrings: false  // 不自动解码，我们手动处理
      })
      
      const entries = []
      
      await new Promise((resolve, reject) => {
        zipFile.on('error', reject)
        zipFile.on('end', () => resolve())
        
        zipFile.on('entry', async (entry) => {
          // 处理文件名编码
          let fileName = entry.fileName
          
          // 尝试从GBK转换为UTF-8
          try {
            const rawFileName = Buffer.from(fileName, 'binary')
            // 检测是否需要转换
            if (this.looksLikeGBK(rawFileName)) {
              fileName = iconv.decode(rawFileName, 'gbk')
              console.log(`[ZipProcessor] Converted GBK: ${fileName}`)
            } else {
              // 尝试直接使用UTF-8
              fileName = fileName.toString('utf8')
            }
          } catch (e) {
            console.log(`[ZipProcessor] Using original filename: ${fileName}`)
          }
          
          const fullPath = path.join(targetDir, fileName)
          
          // 如果是目录
          if (/\/$/.test(fileName)) {
            await fs.mkdir(fullPath, { recursive: true })
            entries.push(fileName)
            zipFile.readEntry()
          } else {
            // 确保父目录存在
            await fs.mkdir(path.dirname(fullPath), { recursive: true })
            
            // 读取文件内容
            zipFile.openReadStream(entry, (err, readStream) => {
              if (err) {
                console.error(`[ZipProcessor] Failed to read entry: ${fileName}`, err)
                zipFile.readEntry()
                return
              }
              
              readStream.on('end', () => {
                entries.push(fileName)
                zipFile.readEntry()
              })
              
              readStream.pipe(createWriteStream(fullPath))
            })
          }
        })
        
        // 开始读取第一个entry
        zipFile.readEntry()
      })
      
      console.log(`[ZipProcessor] Extraction completed with ${entries.length} entries`)
    } catch (error) {
      console.error(`[ZipProcessor] Extraction failed:`, error)
      throw new Error(`解压失败: ${error.message}`)
    }
    
    // 分析文件结构
    const structure = await this.analyzeStructure(targetDir)
    console.log(`[ZipProcessor] Found ${structure.totalFiles} files, total size: ${structure.totalSize} bytes`)
    
    // 打印前10个文件作为示例
    if (structure.files.length > 0) {
      console.log('[ZipProcessor] Sample files:')
      structure.files.slice(0, 10).forEach((file, index) => {
        console.log(`[ZipProcessor]   ${index + 1}. ${file}`)
      })
      if (structure.files.length > 10) {
        console.log(`[ZipProcessor]   ... and ${structure.files.length - 10} more files`)
      }
    }
    
    return structure
  }
  
  /**
   * 分析目录结构
   * @param {string} dir - 目录路径
   * @returns {Promise<Object>} 结构信息
   */
  async analyzeStructure(dir) {
    const structure = {
      files: [],
      directories: [],
      totalFiles: 0,
      totalSize: 0
    }
    
    async function scan(currentPath, basePath, relativePath = '') {
      const items = await fs.readdir(currentPath, { withFileTypes: true })
      
      for (const item of items) {
        const fullPath = path.join(currentPath, item.name)
        const relPath = path.join(relativePath, item.name)
        
        if (item.isDirectory()) {
          // 跳过隐藏目录和系统目录
          if (!item.name.startsWith('.') && item.name !== '__MACOSX') {
            structure.directories.push(relPath)
            await scan(fullPath, basePath, relPath)
          }
        } else {
          // 跳过隐藏文件和系统文件
          if (!item.name.startsWith('.') && !item.name.startsWith('._')) {
            const stats = await fs.stat(fullPath)
            structure.files.push({
              path: relPath,
              type: getFileType(item.name),
              size: stats.size
            })
            structure.totalFiles++
            structure.totalSize += stats.size
          }
        }
      }
    }
    
    await scan(dir, dir)
    return structure
  }
  
  /**
   * 验证ZIP文件安全性
   * @param {string} zipPath - ZIP文件路径
   * @returns {Promise<boolean>} 是否安全
   */
  async validateSecurity(zipPath) {
    // 检查文件大小
    const stats = await fs.stat(zipPath)
    const maxSize = 100 * 1024 * 1024 // 100MB
    
    if (stats.size > maxSize) {
      throw new Error(`文件过大: ${stats.size} bytes (最大: ${maxSize} bytes)`)
    }
    
    // 检查是否真的是ZIP文件
    const buffer = Buffer.alloc(4)
    const fd = await fs.open(zipPath, 'r')
    await fd.read(buffer, 0, 4, 0)
    await fd.close()
    
    // ZIP文件魔术字节: 50 4B 03 04 (PK..)
    if (buffer[0] !== 0x50 || buffer[1] !== 0x4B) {
      throw new Error('不是有效的ZIP文件')
    }
    
    return true
  }
  
  /**
   * 检测是否像GBK编码
   * @param {Buffer} buffer - 待检测的Buffer
   * @returns {boolean} 是否像GBK编码
   */
  looksLikeGBK(buffer) {
    // 简单检测：如果包含常见的GBK中文字符范围
    for (let i = 0; i < buffer.length - 1; i++) {
      const byte1 = buffer[i]
      const byte2 = buffer[i + 1]
      
      // GBK中文字符范围
      if (byte1 >= 0x81 && byte1 <= 0xFE &&
          ((byte2 >= 0x40 && byte2 <= 0x7E) || (byte2 >= 0x80 && byte2 <= 0xFE))) {
        return true
      }
    }
    return false
  }
  
  /**
   * 清理临时文件
   * @param {string} tempPath - 临时文件/目录路径
   */
  async cleanup(tempPath) {
    try {
      const stats = await fs.stat(tempPath)
      if (stats.isDirectory()) {
        await fs.rm(tempPath, { recursive: true, force: true })
      } else {
        await fs.unlink(tempPath)
      }
      console.log(`[ZipProcessor] Cleaned up: ${tempPath}`)
    } catch (error) {
      console.warn(`[ZipProcessor] Cleanup failed for ${tempPath}:`, error.message)
    }
  }
}

/**
 * 根据文件扩展名获取文件类型
 * @param {string} filename - 文件名
 * @returns {string} 文件类型
 */
function getFileType(filename) {
  const ext = path.extname(filename).toLowerCase()
  
  const typeMap = {
    // 文档
    '.md': 'document',
    '.txt': 'document',
    '.doc': 'document',
    '.docx': 'document',
    '.pdf': 'document',
    
    // 图片
    '.jpg': 'image',
    '.jpeg': 'image',
    '.png': 'image',
    '.gif': 'image',
    '.svg': 'image',
    '.webp': 'image',
    '.ico': 'image',
    
    // 视频
    '.mp4': 'video',
    '.avi': 'video',
    '.mov': 'video',
    '.webm': 'video',
    
    // 音频
    '.mp3': 'audio',
    '.wav': 'audio',
    '.ogg': 'audio',
    '.m4a': 'audio',
    
    // 代码
    '.html': 'code',
    '.css': 'code',
    '.js': 'code',
    '.json': 'code'
  }
  
  return typeMap[ext] || 'other'
}

export default new ZipProcessor()
export { ZipProcessor }