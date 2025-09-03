import fs from 'fs/promises'
import path from 'path'

/**
 * HTML路径替换器
 * 负责将HTML中的本地资源路径替换为OSS URLs
 */
class HtmlPathReplacer {
  /**
   * 替换HTML文件中的资源路径
   * @param {string} htmlFilePath - HTML文件路径
   * @param {Object} resourceMapping - 资源映射表 {localPath: ossUrl}
   * @param {string} outputPath - 输出文件路径
   * @returns {Promise<Object>} 替换结果
   */
  async replacePathsInFile(htmlFilePath, resourceMapping, outputPath) {
    console.log(`[HtmlPathReplacer] Processing ${htmlFilePath}`)
    
    try {
      // 读取HTML内容
      const htmlContent = await fs.readFile(htmlFilePath, 'utf-8')
      
      // 执行路径替换
      const { content: replacedContent, replacements } = this.replacePaths(htmlContent, resourceMapping)
      
      // 写入输出文件
      await fs.writeFile(outputPath, replacedContent, 'utf-8')
      
      console.log(`[HtmlPathReplacer] Replaced ${replacements} paths in ${path.basename(htmlFilePath)}`)
      
      return {
        success: true,
        inputFile: htmlFilePath,
        outputFile: outputPath,
        replacements: replacements,
        message: `成功替换${replacements}个路径`
      }
    } catch (error) {
      console.error(`[HtmlPathReplacer] Error processing ${htmlFilePath}:`, error.message)
      return {
        success: false,
        inputFile: htmlFilePath,
        outputFile: outputPath,
        error: error.message,
        replacements: 0
      }
    }
  }
  
  /**
   * 替换HTML内容中的资源路径
   * @param {string} htmlContent - HTML内容
   * @param {Object} resourceMapping - 资源映射表
   * @returns {Object} {content: 替换后内容, replacements: 替换次数}
   */
  replacePaths(htmlContent, resourceMapping) {
    let content = htmlContent
    let replacements = 0
    
    // 遍历映射表进行替换
    for (const [localPath, ossUrl] of Object.entries(resourceMapping)) {
      if (!ossUrl) continue
      
      // 多种路径匹配模式
      const patterns = [
        // 完整路径匹配
        new RegExp(`(src|href)=["']([^"']*${this.escapeRegExp(localPath)})["']`, 'gi'),
        // 文件名匹配
        new RegExp(`(src|href)=["']([^"']*${this.escapeRegExp(path.basename(localPath))})["']`, 'gi'),
        // 相对路径匹配
        new RegExp(`(src|href)=["']([^"']*${this.escapeRegExp(localPath.replace(/\\/g, '/'))})["']`, 'gi')
      ]
      
      for (const pattern of patterns) {
        const matches = content.match(pattern)
        if (matches) {
          content = content.replace(pattern, `$1="${ossUrl}"`)
          replacements += matches.length
        }
      }
    }
    
    return { content, replacements }
  }
  
  /**
   * 批量处理HTML文件
   * @param {string} htmlDir - HTML文件目录
   * @param {Object} resourceMapping - 资源映射表
   * @param {Object} options - 选项
   * @param {string} options.suffix - 输出文件后缀，默认'_oss'
   * @param {Array} options.excludePatterns - 排除的文件名模式
   * @returns {Promise<Array>} 处理结果列表
   */
  async batchReplaceInDirectory(htmlDir, resourceMapping, options = {}) {
    const { suffix = '_oss', excludePatterns = ['-response', '_meta'] } = options
    
    console.log(`[HtmlPathReplacer] Starting batch replacement in ${htmlDir}`)
    
    try {
      const files = await fs.readdir(htmlDir)
      const htmlFiles = files.filter(f => {
        // 只处理HTML文件
        if (!f.endsWith('.html')) return false
        
        // 排除指定模式
        for (const pattern of excludePatterns) {
          if (f.includes(pattern)) return false
        }
        
        // 排除已经处理过的文件（包含suffix）
        if (f.includes(suffix)) return false
        
        return true
      })
      
      console.log(`[HtmlPathReplacer] Found ${htmlFiles.length} HTML files to process`)
      
      if (htmlFiles.length === 0) {
        return []
      }
      
      const results = []
      
      // 逐个处理HTML文件
      for (const htmlFile of htmlFiles) {
        const inputPath = path.join(htmlDir, htmlFile)
        const outputFileName = this.generateOutputFileName(htmlFile, suffix)
        const outputPath = path.join(htmlDir, outputFileName)
        
        const result = await this.replacePathsInFile(inputPath, resourceMapping, outputPath)
        results.push(result)
      }
      
      const successCount = results.filter(r => r.success).length
      const totalReplacements = results.reduce((sum, r) => sum + r.replacements, 0)
      
      console.log(`[HtmlPathReplacer] Batch completed: ${successCount}/${htmlFiles.length} files, ${totalReplacements} total replacements`)
      
      return results
    } catch (error) {
      console.error(`[HtmlPathReplacer] Error in batch processing:`, error.message)
      throw error
    }
  }
  
  /**
   * 生成输出文件名
   * @param {string} originalFileName - 原始文件名
   * @param {string} suffix - 后缀
   * @returns {string} 输出文件名
   */
  generateOutputFileName(originalFileName, suffix) {
    const ext = path.extname(originalFileName)
    const baseName = path.basename(originalFileName, ext)
    return `${baseName}${suffix}${ext}`
  }
  
  /**
   * 转义正则表达式特殊字符
   * @param {string} string - 要转义的字符串
   * @returns {string} 转义后的字符串
   */
  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
  
  /**
   * 从JSONL文件读取资源映射
   * @param {string} mappingFilePath - 映射文件路径
   * @returns {Promise<Object>} 资源映射对象
   */
  async loadResourceMapping(mappingFilePath) {
    try {
      const content = await fs.readFile(mappingFilePath, 'utf-8')
      const lines = content.split('\n').filter(line => line.trim())
      
      const mapping = {}
      for (const line of lines) {
        try {
          const resource = JSON.parse(line)
          if (resource.localPath && resource.ossUrl) {
            // 支持多种路径格式
            mapping[resource.localPath] = resource.ossUrl
            mapping[path.basename(resource.localPath)] = resource.ossUrl
            mapping[resource.localPath.replace(/\\/g, '/')] = resource.ossUrl
          }
        } catch (parseError) {
          console.warn(`[HtmlPathReplacer] Invalid JSON line in mapping file: ${line}`)
        }
      }
      
      console.log(`[HtmlPathReplacer] Loaded ${Object.keys(mapping).length} resource mappings`)
      return mapping
    } catch (error) {
      console.error(`[HtmlPathReplacer] Error loading mapping file:`, error.message)
      return {}
    }
  }
  
  /**
   * 验证映射文件格式
   * @param {string} mappingFilePath - 映射文件路径
   * @returns {Promise<Object>} 验证结果
   */
  async validateMappingFile(mappingFilePath) {
    try {
      const content = await fs.readFile(mappingFilePath, 'utf-8')
      const lines = content.split('\n').filter(line => line.trim())
      
      let validCount = 0
      let invalidCount = 0
      const errors = []
      
      for (let i = 0; i < lines.length; i++) {
        try {
          const resource = JSON.parse(lines[i])
          if (resource.localPath && resource.ossUrl) {
            validCount++
          } else {
            invalidCount++
            errors.push(`Line ${i + 1}: Missing localPath or ossUrl`)
          }
        } catch (parseError) {
          invalidCount++
          errors.push(`Line ${i + 1}: Invalid JSON - ${parseError.message}`)
        }
      }
      
      return {
        valid: invalidCount === 0,
        totalLines: lines.length,
        validCount,
        invalidCount,
        errors: errors.slice(0, 10) // 最多返回10个错误
      }
    } catch (error) {
      return {
        valid: false,
        error: `Cannot read mapping file: ${error.message}`
      }
    }
  }
}

export default new HtmlPathReplacer()
export { HtmlPathReplacer }