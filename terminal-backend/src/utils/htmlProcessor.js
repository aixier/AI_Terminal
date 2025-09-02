import path from 'path'
import fs from 'fs/promises'
import resourceUploader from './resourceUploader.js'

/**
 * HTML处理器
 * 负责替换HTML中的资源路径为OSS URL
 */
class HtmlProcessor {
  /**
   * 替换HTML中的资源路径
   * @param {string} html - 原始HTML内容
   * @param {Array} resourceMapping - 资源映射表
   * @param {string} templateDir - 模板目录
   * @param {string} taskId - 任务ID
   * @returns {Promise<string>} 处理后的HTML
   */
  async replaceResourcePaths(html, resourceMapping, templateDir, taskId) {
    console.log('[HtmlProcessor] Starting path replacement')
    console.log(`[HtmlProcessor] Resource mapping has ${resourceMapping.length} entries`)
    
    let processed = html
    let replacementCount = 0
    
    // 第一阶段：基于映射表替换
    for (const mapping of resourceMapping) {
      if (!mapping || !mapping.ossUrl) continue
      
      // 生成多种可能的匹配模式
      const patterns = this.generatePatterns(mapping)
      
      for (const pattern of patterns) {
        const regex = new RegExp(this.escapeRegex(pattern), 'g')
        const matches = processed.match(regex)
        
        if (matches) {
          processed = processed.replace(regex, mapping.ossUrl)
          replacementCount += matches.length
          console.log(`[HtmlProcessor] Replaced ${matches.length} instances of "${pattern}" with OSS URL`)
        }
      }
    }
    
    console.log(`[HtmlProcessor] First phase: replaced ${replacementCount} paths`)
    
    // 第二阶段：扫描剩余的本地路径
    const remainingPaths = this.scanLocalPaths(processed)
    console.log(`[HtmlProcessor] Found ${remainingPaths.length} remaining local paths`)
    
    if (remainingPaths.length > 0 && templateDir && taskId) {
      // 上传未映射的资源
      const additionalMappings = await this.uploadRemainingResources(
        remainingPaths,
        templateDir,
        taskId
      )
      
      // 替换新上传的资源
      for (const mapping of additionalMappings) {
        const regex = new RegExp(this.escapeRegex(mapping.localPath), 'g')
        const matches = processed.match(regex)
        
        if (matches) {
          processed = processed.replace(regex, mapping.ossUrl)
          replacementCount += matches.length
          console.log(`[HtmlProcessor] Replaced additional ${matches.length} instances`)
        }
      }
    }
    
    console.log(`[HtmlProcessor] Total replacements: ${replacementCount}`)
    return processed
  }
  
  /**
   * 生成多种可能的路径模式
   * @param {Object} mapping - 资源映射
   * @returns {Array<string>} 路径模式数组
   */
  generatePatterns(mapping) {
    const patterns = []
    
    // 相对路径
    if (mapping.localPath) {
      patterns.push(mapping.localPath)
      patterns.push(mapping.localPath.replace(/\\/g, '/'))
      patterns.push('./' + mapping.localPath.replace(/\\/g, '/'))
      patterns.push('../' + mapping.localPath.replace(/\\/g, '/'))
    }
    
    // 文件名
    const fileName = path.basename(mapping.localPath || '')
    if (fileName) {
      patterns.push(fileName)
    }
    
    // 完整路径
    if (mapping.fullPath) {
      patterns.push(mapping.fullPath)
      patterns.push(mapping.fullPath.replace(/\\/g, '/'))
    }
    
    // 去重
    return [...new Set(patterns)]
  }
  
  /**
   * 扫描HTML中的本地路径
   * @param {string} html - HTML内容
   * @returns {Array<string>} 本地路径列表
   */
  scanLocalPaths(html) {
    const patterns = [
      /src="([^"]+)"/g,
      /href="([^"]+)"/g,
      /url\(['"]?([^'")]+)['"]?\)/g,
      /background-image:\s*url\(['"]?([^'")]+)['"]?\)/g,
      /background:\s*url\(['"]?([^'")]+)['"]?\)/g,
      /content:\s*url\(['"]?([^'")]+)['"]?\)/g
    ]
    
    const paths = new Set()
    
    for (const pattern of patterns) {
      let match
      pattern.lastIndex = 0 // 重置正则表达式
      
      while ((match = pattern.exec(html)) !== null) {
        const pathStr = match[1]
        
        // 过滤掉已经是URL的路径和data URI
        if (!pathStr.startsWith('http://') && 
            !pathStr.startsWith('https://') && 
            !pathStr.startsWith('data:') &&
            !pathStr.startsWith('//') &&
            !pathStr.startsWith('#') &&
            !pathStr.startsWith('javascript:')) {
          paths.add(pathStr)
        }
      }
    }
    
    return Array.from(paths)
  }
  
  /**
   * 上传剩余的资源
   * @param {Array<string>} paths - 路径列表
   * @param {string} templateDir - 模板目录
   * @param {string} taskId - 任务ID
   * @returns {Promise<Array>} 上传结果
   */
  async uploadRemainingResources(paths, templateDir, taskId) {
    const mappings = []
    
    for (const pathStr of paths) {
      try {
        // 尝试定位文件
        const fullPath = await this.locateFile(pathStr, templateDir)
        
        if (fullPath) {
          // 上传文件
          const ossPath = `custom-template/${taskId}/additional/${path.basename(fullPath)}`
          const result = await resourceUploader.uploadFile(fullPath, ossPath)
          
          if (result.success) {
            mappings.push({
              localPath: pathStr,
              ossUrl: result.url
            })
            console.log(`[HtmlProcessor] Uploaded additional resource: ${pathStr}`)
          }
        }
      } catch (error) {
        console.warn(`[HtmlProcessor] Failed to process path ${pathStr}:`, error.message)
      }
    }
    
    return mappings
  }
  
  /**
   * 定位文件
   * @param {string} pathStr - 路径字符串
   * @param {string} templateDir - 模板目录
   * @returns {Promise<string|null>} 文件完整路径
   */
  async locateFile(pathStr, templateDir) {
    // 清理路径
    const cleanPath = pathStr.replace(/^\.\//, '').replace(/^\//, '')
    
    // 可能的路径组合
    const possiblePaths = [
      path.join(templateDir, cleanPath),
      path.join(templateDir, path.basename(cleanPath)),
      cleanPath
    ]
    
    for (const possiblePath of possiblePaths) {
      try {
        await fs.access(possiblePath)
        return possiblePath
      } catch {
        // 继续尝试下一个路径
      }
    }
    
    return null
  }
  
  /**
   * 转义正则表达式特殊字符
   * @param {string} str - 字符串
   * @returns {string} 转义后的字符串
   */
  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
  
  /**
   * 提取HTML中的所有资源引用
   * @param {string} html - HTML内容
   * @returns {Object} 资源引用统计
   */
  analyzeResources(html) {
    const resources = {
      images: new Set(),
      styles: new Set(),
      scripts: new Set(),
      others: new Set()
    }
    
    // 图片
    const imgPattern = /src="([^"]+\.(jpg|jpeg|png|gif|svg|webp|ico))"/gi
    let match
    while ((match = imgPattern.exec(html)) !== null) {
      resources.images.add(match[1])
    }
    
    // 样式
    const cssPattern = /href="([^"]+\.css)"/gi
    while ((match = cssPattern.exec(html)) !== null) {
      resources.styles.add(match[1])
    }
    
    // 脚本
    const jsPattern = /src="([^"]+\.js)"/gi
    while ((match = jsPattern.exec(html)) !== null) {
      resources.scripts.add(match[1])
    }
    
    return {
      images: Array.from(resources.images),
      styles: Array.from(resources.styles),
      scripts: Array.from(resources.scripts),
      total: resources.images.size + resources.styles.size + resources.scripts.size
    }
  }
}

export default new HtmlProcessor()
export { HtmlProcessor }