/**
 * HTML路径替换器 - 兼容层
 * 使用新的统一架构，保持向后兼容
 */

import HtmlResourceParser from './HtmlResourceParser.js'
import HtmlResourceReplacer from './HtmlResourceReplacer.js'
import path from 'path'
import fs from 'fs/promises'

class HtmlPathReplacer {
  constructor() {
    this.parser = new HtmlResourceParser()
    this.replacer = new HtmlResourceReplacer()
  }

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
      // 解析HTML
      const parseResult = await this.parser.parseHtmlFile(htmlFilePath)
      
      if (!parseResult.success) {
        throw new Error(`Failed to parse HTML: ${parseResult.error}`)
      }

      // 转换映射格式
      const replacementMap = new Map()
      for (const [localPath, ossUrl] of Object.entries(resourceMapping)) {
        if (ossUrl) {
          replacementMap.set(localPath, ossUrl)
          // 也添加基于文件名的映射
          replacementMap.set(path.basename(localPath), ossUrl)
        }
      }

      // 使用新的替换器
      const ext = path.extname(outputPath)
      const outputType = outputPath.includes('_oss') ? 'ossurl' : 'custom'
      
      // 临时修改输出文件名生成逻辑
      const originalGenerateFileName = this.replacer.generateOutputFileName
      this.replacer.generateOutputFileName = () => outputPath
      
      const result = await this.replacer.replaceAndSave(
        parseResult,
        replacementMap,
        outputType,
        htmlFilePath
      )
      
      // 恢复原始函数
      this.replacer.generateOutputFileName = originalGenerateFileName
      
      return {
        success: result.success,
        inputFile: htmlFilePath,
        outputFile: outputPath,
        replacements: result.replacedCount || 0,
        message: result.success ? `成功替换${result.replacedCount}个路径` : result.error
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
   * 替换HTML内容中的资源路径（字符串操作）
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
   * 替换HTML中的路径为OSS URLs（兼容customOssAsync.js）
   * @param {string} htmlContent - HTML内容
   * @param {Array} resourceMappings - 资源映射数组
   * @param {string} templatePath - 模板路径（未使用）
   * @returns {Promise<string>} 替换后的HTML内容
   */
  async replaceWithOSSUrls(htmlContent, resourceMappings, templatePath) {
    // 转换数组格式为对象格式
    const resourceMapping = {}
    for (const mapping of resourceMappings) {
      if (mapping.localPath && mapping.ossUrl) {
        resourceMapping[mapping.localPath] = mapping.ossUrl
      }
    }
    
    const result = this.replacePaths(htmlContent, resourceMapping)
    return result.content
  }
  
  /**
   * 批量处理HTML文件
   * @param {string} htmlDir - HTML文件目录
   * @param {Object} resourceMapping - 资源映射表
   * @param {Object} options - 选项
   * @returns {Promise<Array>} 处理结果列表
   */
  async batchReplaceInDirectory(htmlDir, resourceMapping, options = {}) {
    const { suffix = '_oss', excludePatterns = ['-response', '_meta'] } = options
    
    console.log(`[HtmlPathReplacer] Starting batch replacement in ${htmlDir}`)
    
    try {
      const files = await fs.readdir(htmlDir)
      const htmlFiles = files.filter(f => {
        if (!f.endsWith('.html')) return false
        
        for (const pattern of excludePatterns) {
          if (f.includes(pattern)) return false
        }
        
        if (f.includes(suffix)) return false
        
        return true
      })
      
      console.log(`[HtmlPathReplacer] Found ${htmlFiles.length} HTML files to process`)
      
      if (htmlFiles.length === 0) {
        return []
      }
      
      const results = []
      
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
   */
  generateOutputFileName(originalFileName, suffix) {
    const ext = path.extname(originalFileName)
    const baseName = path.basename(originalFileName, ext)
    return `${baseName}${suffix}${ext}`
  }
  
  /**
   * 转义正则表达式特殊字符
   */
  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
  
  /**
   * 从JSONL文件读取资源映射
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
        errors: errors.slice(0, 10)
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