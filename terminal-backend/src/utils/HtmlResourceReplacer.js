/**
 * HTML资源替换器
 * 负责将HTML中的本地路径替换为处理后的路径（Base64或OSS URL）
 * 并根据替换类型保存为不同的文件
 */

import fs from 'fs/promises'
import path from 'path'

class HtmlResourceReplacer {
  constructor() {
    this.replacementTypes = {
      BASE64: 'base64',
      OSS_URL: 'ossurl'
    }
  }

  /**
   * 替换HTML中的资源路径并保存
   * @param {Object} parseResult - HtmlResourceParser的解析结果
   * @param {Map} replacementMap - 替换映射 Map<localPath, newPath>
   * @param {string} outputType - 输出类型 'base64' 或 'ossurl'
   * @param {string} htmlFilePath - 原始HTML文件路径
   * @returns {Promise<Object>} 替换结果
   */
  async replaceAndSave(parseResult, replacementMap, outputType, htmlFilePath) {
    try {
      if (!parseResult.success || !parseResult.dom) {
        throw new Error('Invalid parse result')
      }

      const { dom, document, resources } = parseResult
      let replacedCount = 0
      let skippedCount = 0

      console.log(`[HtmlResourceReplacer] Starting replacement for ${outputType}`)
      console.log(`[HtmlResourceReplacer] Processing ${resources.length} resources`)

      // 按类型处理资源
      for (const resource of resources) {
        const newPath = replacementMap.get(resource.localPath)
        
        if (!newPath) {
          console.warn(`[HtmlResourceReplacer] No replacement for: ${resource.localPath}`)
          skippedCount++
          continue
        }

        // 根据资源类型进行替换
        switch (resource.type) {
          case 'img':
            this.replaceImgSrc(resource, newPath)
            replacedCount++
            break
            
          case 'style':
            this.replaceInStyleTag(resource, newPath)
            replacedCount++
            break
            
          case 'inline-style':
            this.replaceInInlineStyle(resource, newPath)
            replacedCount++
            break
            
          default:
            console.warn(`[HtmlResourceReplacer] Unknown resource type: ${resource.type}`)
            skippedCount++
        }
      }

      // 序列化修改后的DOM
      const modifiedHtml = dom.serialize()
      
      // 生成输出文件名
      const outputFile = this.generateOutputFileName(htmlFilePath, outputType)
      
      // 保存文件
      await fs.writeFile(outputFile, modifiedHtml, 'utf-8')
      
      console.log(`[HtmlResourceReplacer] Replacement completed:`)
      console.log(`  - Replaced: ${replacedCount} resources`)
      console.log(`  - Skipped: ${skippedCount} resources`)
      console.log(`  - Output: ${outputFile}`)

      return {
        success: true,
        outputFile,
        replacedCount,
        skippedCount,
        totalResources: resources.length
      }
    } catch (error) {
      console.error(`[HtmlResourceReplacer] Replace failed:`, error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 替换img标签的src属性
   */
  replaceImgSrc(resource, newPath) {
    if (resource.element && resource.attribute === 'src') {
      resource.element.setAttribute('src', newPath)
      console.log(`[HtmlResourceReplacer] Replaced img src: ${resource.originalPath} -> ${newPath.substring(0, 100)}...`)
    }
  }

  /**
   * 替换style标签中的URL
   */
  replaceInStyleTag(resource, newPath) {
    if (resource.element && resource.fullMatch) {
      const currentContent = resource.element.textContent
      const newUrl = `url("${newPath}")`
      const newContent = currentContent.replace(resource.fullMatch, newUrl)
      resource.element.textContent = newContent
      console.log(`[HtmlResourceReplacer] Replaced in style tag: ${resource.originalPath}`)
    }
  }

  /**
   * 替换内联style中的URL
   */
  replaceInInlineStyle(resource, newPath) {
    if (resource.element && resource.fullMatch) {
      const currentStyle = resource.element.getAttribute('style')
      const newUrl = `url("${newPath}")`
      const newStyle = currentStyle.replace(resource.fullMatch, newUrl)
      resource.element.setAttribute('style', newStyle)
      console.log(`[HtmlResourceReplacer] Replaced in inline style: ${resource.originalPath}`)
    }
  }

  /**
   * 生成输出文件名
   * @param {string} htmlFilePath - 原始HTML文件路径
   * @param {string} outputType - 输出类型
   * @returns {string} 输出文件路径
   */
  generateOutputFileName(htmlFilePath, outputType) {
    const ext = path.extname(htmlFilePath)
    const baseName = path.basename(htmlFilePath, ext)
    const dir = path.dirname(htmlFilePath)
    
    // 根据类型生成不同的文件名
    const suffix = outputType === this.replacementTypes.BASE64 ? '_base64' : '_ossurl'
    
    return path.join(dir, `${baseName}${suffix}${ext}`)
  }

  /**
   * 批量替换 - 支持多种输出类型
   * @param {Object} parseResult - 解析结果
   * @param {Array} replacements - 替换配置数组 [{type: 'base64', map: Map}, ...]
   * @param {string} htmlFilePath - HTML文件路径
   * @returns {Promise<Array>} 所有替换结果
   */
  async replaceMultiple(parseResult, replacements, htmlFilePath) {
    const results = []
    
    for (const replacement of replacements) {
      const result = await this.replaceAndSave(
        parseResult,
        replacement.map,
        replacement.type,
        htmlFilePath
      )
      
      results.push({
        type: replacement.type,
        ...result
      })
    }
    
    return results
  }

  /**
   * 验证替换映射的完整性
   * @param {Array} resources - 资源列表
   * @param {Map} replacementMap - 替换映射
   * @returns {Object} 验证结果
   */
  validateReplacementMap(resources, replacementMap) {
    const missing = []
    const found = []
    
    for (const resource of resources) {
      if (replacementMap.has(resource.localPath)) {
        found.push(resource.localPath)
      } else {
        missing.push(resource.localPath)
      }
    }
    
    return {
      isComplete: missing.length === 0,
      found: found.length,
      missing: missing.length,
      missingPaths: missing,
      coverage: (found.length / resources.length * 100).toFixed(2) + '%'
    }
  }
}

export default HtmlResourceReplacer