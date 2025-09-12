/**
 * 统一的HTML处理器
 * 协调整个HTML资源处理流程：
 * 1. 解析HTML提取资源
 * 2. 转换资源（Base64或OSS）
 * 3. 替换HTML中的路径
 * 4. 保存处理后的文件
 */

import HtmlResourceParser from './HtmlResourceParser.js'
import HtmlResourceReplacer from './HtmlResourceReplacer.js'
import ResourceToBase64Converter from './ResourceToBase64Converter.js'
import ResourceToOSSUrlConverter from './ResourceToOSSUrlConverter.js'

class UnifiedHtmlProcessor {
  constructor() {
    this.parser = new HtmlResourceParser()
    this.replacer = new HtmlResourceReplacer()
    this.base64Converter = new ResourceToBase64Converter()
    this.ossUrlConverter = new ResourceToOSSUrlConverter()
  }

  /**
   * 处理HTML文件 - 主入口
   * @param {string} htmlFilePath - HTML文件路径
   * @param {Object} options - 配置选项
   * @returns {Promise<Object>} 处理结果
   */
  async processHtml(htmlFilePath, options = {}) {
    const {
      templateBasePath = '',
      outputTypes = ['base64', 'ossurl'], // 默认生成两种版本
      username = 'default',
      taskId = '',
      uploadHtml = false // 是否上传HTML到OSS
    } = options

    const startTime = Date.now()
    const results = {
      success: false,
      htmlFilePath,
      outputs: [],
      stats: {},
      errors: []
    }

    try {
      console.log(`[UnifiedHtmlProcessor] Starting processing: ${htmlFilePath}`)
      console.log(`[UnifiedHtmlProcessor] Output types: ${outputTypes.join(', ')}`)

      // 步骤1：解析HTML，提取所有资源
      console.log('[UnifiedHtmlProcessor] Step 1: Parsing HTML...')
      const parseResult = await this.parser.parseHtmlFile(htmlFilePath, templateBasePath)
      
      if (!parseResult.success) {
        throw new Error(`Failed to parse HTML: ${parseResult.error}`)
      }

      results.stats.parsing = parseResult.stats
      console.log(`[UnifiedHtmlProcessor] Found ${parseResult.resources.length} resources`)

      // 如果没有资源需要处理，直接返回
      if (parseResult.resources.length === 0) {
        console.log('[UnifiedHtmlProcessor] No resources to process')
        results.success = true
        results.stats.processingTime = Date.now() - startTime
        return results
      }

      // 提取所有本地路径
      const localPaths = parseResult.resources.map(r => r.localPath)
      const uniquePaths = [...new Set(localPaths)]
      console.log(`[UnifiedHtmlProcessor] ${uniquePaths.length} unique paths to process`)

      // 步骤2：根据输出类型处理资源
      const replacements = []

      // 处理Base64转换
      if (outputTypes.includes('base64')) {
        console.log('[UnifiedHtmlProcessor] Step 2a: Converting to Base64...')
        const base64Result = await this.base64Converter.convertBatch(uniquePaths)
        
        replacements.push({
          type: 'base64',
          map: base64Result.map,
          stats: base64Result.stats
        })
        
        results.stats.base64 = base64Result.stats
        console.log(`[UnifiedHtmlProcessor] Base64 conversion: ${base64Result.stats.converted}/${base64Result.stats.total} succeeded`)
      }

      // 处理OSS上传
      if (outputTypes.includes('ossurl')) {
        console.log('[UnifiedHtmlProcessor] Step 2b: Uploading to OSS...')
        const ossResult = await this.ossUrlConverter.convertBatch(uniquePaths, {
          username,
          taskId
        })
        
        replacements.push({
          type: 'ossurl',
          map: ossResult.map,
          stats: ossResult.stats
        })
        
        results.stats.oss = ossResult.stats
        console.log(`[UnifiedHtmlProcessor] OSS upload: ${ossResult.stats.uploaded}/${ossResult.stats.total} succeeded`)
      }

      // 步骤3：替换HTML中的路径并保存
      console.log('[UnifiedHtmlProcessor] Step 3: Replacing paths and saving...')
      
      for (const replacement of replacements) {
        // 验证替换映射的完整性
        const validation = this.replacer.validateReplacementMap(
          parseResult.resources,
          replacement.map
        )
        
        console.log(`[UnifiedHtmlProcessor] Replacement coverage for ${replacement.type}: ${validation.coverage}`)
        
        if (validation.missingPaths.length > 0) {
          console.warn(`[UnifiedHtmlProcessor] Missing paths for ${replacement.type}:`)
          validation.missingPaths.slice(0, 5).forEach(p => console.warn(`  - ${p}`))
        }

        // 执行替换并保存
        const replaceResult = await this.replacer.replaceAndSave(
          parseResult,
          replacement.map,
          replacement.type,
          htmlFilePath
        )
        
        if (replaceResult.success) {
          const output = {
            type: replacement.type,
            file: replaceResult.outputFile,
            replacedCount: replaceResult.replacedCount,
            skippedCount: replaceResult.skippedCount
          }

          // 如果是OSS类型且需要上传HTML
          if (replacement.type === 'ossurl' && uploadHtml) {
            const uploadResult = await this.ossUrlConverter.uploadHtmlFile(
              replaceResult.outputFile,
              username,
              taskId
            )
            
            if (uploadResult.success) {
              output.ossUrl = uploadResult.ossUrl
              output.ossKey = uploadResult.ossKey
              console.log(`[UnifiedHtmlProcessor] HTML uploaded to OSS: ${uploadResult.ossKey}`)
            } else {
              console.error(`[UnifiedHtmlProcessor] Failed to upload HTML: ${uploadResult.error}`)
            }
          }

          results.outputs.push(output)
        } else {
          results.errors.push({
            type: replacement.type,
            error: replaceResult.error
          })
        }
      }

      // 清理缓存
      this.base64Converter.clearCache()
      this.ossUrlConverter.clearCache()

      results.success = true
      results.stats.processingTime = Date.now() - startTime

      // 打印总结
      this.logSummary(results)

    } catch (error) {
      console.error('[UnifiedHtmlProcessor] Processing failed:', error)
      results.success = false
      results.error = error.message
      results.stats.processingTime = Date.now() - startTime
    }

    return results
  }

  /**
   * 处理HTML文件 - 只生成Base64版本
   */
  async processHtmlToBase64(htmlFilePath, templateBasePath = '') {
    return this.processHtml(htmlFilePath, {
      templateBasePath,
      outputTypes: ['base64']
    })
  }

  /**
   * 处理HTML文件 - 只生成OSS URL版本
   */
  async processHtmlToOSSUrl(htmlFilePath, options = {}) {
    return this.processHtml(htmlFilePath, {
      ...options,
      outputTypes: ['ossurl']
    })
  }

  /**
   * 兼容旧接口 - convertHtmlToBase64
   */
  async convertHtmlToBase64(htmlFilePath, templateBasePath = '') {
    const result = await this.processHtmlToBase64(htmlFilePath, templateBasePath)
    
    // 转换为旧格式的返回值
    if (result.success && result.outputs.length > 0) {
      const output = result.outputs[0]
      return {
        success: true,
        outputFile: output.file,
        stats: {
          ...result.stats.parsing,
          ...result.stats.base64,
          processingTime: result.stats.processingTime
        }
      }
    } else {
      return {
        success: false,
        error: result.error || 'Processing failed',
        stats: result.stats
      }
    }
  }

  /**
   * 兼容旧接口 - convertHtmlToOSSUrl
   */
  async convertHtmlToOSSUrl(htmlFilePath, templateBasePath = '', username = 'default', taskId = '') {
    const result = await this.processHtmlToOSSUrl(htmlFilePath, {
      templateBasePath,
      username,
      taskId,
      uploadHtml: true
    })
    
    // 转换为旧格式的返回值
    if (result.success && result.outputs.length > 0) {
      const output = result.outputs[0]
      return {
        success: true,
        outputFile: output.file,
        ossUrl: output.ossUrl,
        ossKey: output.ossKey,
        stats: {
          ...result.stats.parsing,
          ...result.stats.oss,
          processingTime: result.stats.processingTime
        }
      }
    } else {
      return {
        success: false,
        error: result.error || 'Processing failed',
        stats: result.stats
      }
    }
  }

  /**
   * 打印处理总结
   */
  logSummary(results) {
    console.log('[UnifiedHtmlProcessor] Processing completed:')
    console.log(`  - Success: ${results.success}`)
    console.log(`  - Processing time: ${results.stats.processingTime}ms`)
    
    if (results.outputs.length > 0) {
      console.log('  - Outputs:')
      results.outputs.forEach(output => {
        console.log(`    - ${output.type}: ${output.file}`)
        console.log(`      Replaced: ${output.replacedCount}, Skipped: ${output.skippedCount}`)
      })
    }
    
    if (results.errors.length > 0) {
      console.log('  - Errors:')
      results.errors.forEach(err => {
        console.log(`    - ${err.type}: ${err.error}`)
      })
    }
  }
}

// 导出单例
const processor = new UnifiedHtmlProcessor()

export default processor
export { UnifiedHtmlProcessor }