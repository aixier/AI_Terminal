/**
 * 四文件生成协调器
 * 专门处理daily-knowledge-card-template.md模板的四文件连续生成流程
 * JSON -> Response -> HTML -> Meta
 */

import path from 'path'
import fs from 'fs/promises'
import axios from 'axios'
import { SessionMetadata } from './sessionMetadata.js'
import { downloadAndSaveHtml } from './htmlProcessor.js'
import { repairJsonContent } from '../../../utils/jsonRepair.js'
import { jsonrepair } from 'jsonrepair'

/**
 * JSON字符串清理函数 - 修复常见的JSON格式问题
 * 修复策略：先处理特殊字符，再处理JSON结构
 */
function sanitizeJsonString(jsonString) {
  console.log('[FileGenerator] Starting JSON sanitization')
  let result = jsonString
  let stats = {
    leftQuotes: 0,
    rightQuotes: 0,
    leftSingleQuotes: 0,
    rightSingleQuotes: 0
  }

  // 1. 首先处理所有中文引号 - 在JSON解析前先转义
  // 这样可以避免正则表达式匹配错误
  result = result.replace(/"/g, (match) => {
    stats.leftQuotes++
    return '\\"'  // 转义左双引号
  })

  result = result.replace(/"/g, (match) => {
    stats.rightQuotes++
    return '\\"'  // 转义右双引号
  })

  result = result.replace(/'/g, (match) => {
    stats.leftSingleQuotes++
    return "\\'"  // 转义左单引号
  })

  result = result.replace(/'/g, (match) => {
    stats.rightSingleQuotes++
    return "\\'"  // 转义右单引号
  })

  console.log('[FileGenerator] Quote replacement stats:', stats)

  // 2. 处理其他常见的JSON问题
  // 修复尾随逗号（在对象和数组中）
  result = result.replace(/,\s*}/g, '}')  // 对象中的尾随逗号
  result = result.replace(/,\s*]/g, ']')  // 数组中的尾随逗号

  // 修复缺少逗号的情况（简单启发式）
  result = result.replace(/"\s*\n\s*"/g, '",\n"')  // 两个字符串值之间缺少逗号

  // 3. 移除控制字符
  result = result.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')

  // 4. 修复未转义的换行符（在字符串中）
  result = result.replace(/(?<!\\)\n/g, '\\n')  // 将未转义的换行符转义
  result = result.replace(/(?<!\\)\r/g, '\\r')  // 将未转义的回车符转义
  result = result.replace(/(?<!\\)\t/g, '\\t')  // 将未转义的制表符转义

  console.log('[FileGenerator] JSON sanitization completed')
  return result
}

/**
 * 检测JSON是否包含中文引号
 * @param {string} jsonString - JSON字符串
 * @returns {boolean} 是否包含中文引号
 */
function hasChineseQuotes(jsonString) {
  return /[""'']/.test(jsonString)
}

/**
 * 修复Pod2Post模板JSON中的中文引号
 * 只替换字符串值中的引号，保护JSON结构
 * @param {string} jsonString - JSON字符串
 * @returns {string} 修复后的JSON
 */
function fixPod2PostChineseQuotes(jsonString) {
  let result = jsonString
  let stats = { replaced: 0 }

  // 1. 修复对象中的字符串值: "key": "value"
  result = result.replace(/:\s*"([^"]*)"/g, (match, content) => {
    let fixedContent = content
      .replace(/"/g, '\\"')
      .replace(/"/g, '\\"')
      .replace(/'/g, "\\'")
      .replace(/'/g, "\\'")

    if (fixedContent !== content) {
      stats.replaced++
    }

    return `: "${fixedContent}"`
  })

  // 2. 修复数组中的字符串值
  result = result.replace(/"([^"]*)"(?=\s*[,|\]])/g, (match, content) => {
    let fixedContent = content
      .replace(/"/g, '\\"')
      .replace(/"/g, '\\"')
      .replace(/'/g, "\\'")
      .replace(/'/g, "\\'")

    if (fixedContent !== content) {
      stats.replaced++
    }

    return `"${fixedContent}"`
  })

  console.log(`[Pod2Post] Fixed ${stats.replaced} Chinese quote occurrences`)
  return result
}

/**
 * 智能JSON修复策略（使用jsonrepair库）
 * 结合jsonrepair库和自定义逻辑
 * @param {string} jsonString - 原始JSON字符串
 * @param {string} templateName - 模板名称
 * @returns {Object} 修复结果
 */
function smartJsonRepair(jsonString, templateName) {
  console.log('[FileGenerator] Starting smart JSON repair')

  // 检测是否包含中文引号
  const containsChineseQuotes = hasChineseQuotes(jsonString)
  console.log('[FileGenerator] Contains Chinese quotes:', containsChineseQuotes)

  // 1. 首先尝试使用 jsonrepair 库（能处理大部分问题）
  try {
    console.log('[FileGenerator] Trying jsonrepair library first')
    const repaired = jsonrepair(jsonString)
    const parsed = JSON.parse(repaired)
    console.log('[FileGenerator] ✅ jsonrepair success')
    return {
      success: true,
      data: parsed,
      cleanedContent: repaired,
      method: 'jsonrepair-library'
    }
  } catch (error) {
    console.log('[FileGenerator] jsonrepair failed:', error.message)

    // 2. 如果包含中文引号且jsonrepair失败，使用自定义修复
    if (containsChineseQuotes) {
      // Pod2Post模板使用专门的修复函数
      if (templateName === 'pod2post-template.md' || templateName === 'pod2post') {
        console.log('[FileGenerator] Using Pod2Post specific quote fixer')
        const sanitized = fixPod2PostChineseQuotes(jsonString)

        try {
          const parsed = JSON.parse(sanitized)
          console.log('[FileGenerator] Pod2Post JSON successfully parsed')
          return {
            success: true,
            data: parsed,
            cleanedContent: sanitized,
            method: 'pod2post-quote-fixer'
          }
        } catch (pod2postError) {
          console.log('[FileGenerator] Pod2Post quote fixer failed:', pod2postError.message)
        }
      }

      // 通用sanitize函数
      console.log('[FileGenerator] Using general sanitizer for Chinese quotes')
      const sanitized = sanitizeJsonString(jsonString)

      try {
        const parsed = JSON.parse(sanitized)
        console.log('[FileGenerator] JSON successfully parsed with general sanitizer')
        return {
          success: true,
          data: parsed,
          cleanedContent: sanitized,
          method: 'general-sanitizer'
        }
      } catch (sanitizeError) {
        console.log('[FileGenerator] General sanitizer failed:', sanitizeError.message)
      }
    }

    // 3. 所有方法都失败，需要Claude API
    console.log('[FileGenerator] All methods failed, will use Claude API')
    return {
      success: false,
      error: error.message,
      needsClaude: true,
      method: 'all-methods-failed'
    }
  }
}

/**
 * 外部API配置
 */
const EXTERNAL_API_CONFIG = {
  baseURL: 'https://engagia-s-cdmxfcdbwa.cn-hangzhou.fcapp.run',
  generateEndpoint: '/generate-and-process',
  timeout: 120000, // 2分钟超时
  retryAttempts: 2,
  retryDelay: 3000 // 3秒延迟
}

/**
 * 转换JSON为API格式
 * @param {Object} jsonContent - JSON内容
 * @returns {Object} 转换后的API格式
 */
function transformJsonToApiFormat(jsonContent) {
  console.log('[FileGenerator] Transforming JSON to API format')
  
  const apiPayload = {
    format: 'html',
    config: jsonContent
  }

  // 验证并补充必要字段
  if (!apiPayload.config.theme) {
    apiPayload.config.theme = {
      name: 'knowledge-card',
      pageTitle: jsonContent.title || '知识卡片',
      sectionTitle: jsonContent.title || '知识卡片',
      sectionSubtitle: jsonContent.subtitle || '',
      gradientColor1: '#06B6D4',
      gradientColor2: '#10B981',
      gradientColor1RGB: '6, 182, 212',
      accentColor: '#10B981',
      accentColorRGB: '16, 185, 129'
    }
  }

  if (!apiPayload.config.copy) {
    apiPayload.config.copy = {
      title: jsonContent.title || '知识卡片',
      content: jsonContent.content || '',
      hashtags: '',
      tips: ''
    }
  }

  if (!apiPayload.config.cards || apiPayload.config.cards.length === 0) {
    console.warn('[FileGenerator] No cards in payload, adding default card')
    apiPayload.config.cards = [{
      type: 'main',
      icon: '📋',
      header: jsonContent.title || '知识卡片',
      subtitle: jsonContent.subtitle || '',
      content: {
        highlight: {
          number: '内容',
          description: '暂无描述'
        },
        points: [{ icon: '→', text: '暂无内容' }],
        tags: []
      }
    }]
  }

  return apiPayload
}

/**
 * 调用外部API生成HTML
 * @param {Object} jsonContent - JSON内容
 * @param {SessionMetadata} metadata - 会话元数据
 * @returns {Promise<Object>} API响应结果
 */
async function callExternalHtmlApi(jsonContent, metadata) {
  metadata.logStep('html_api_call', 'started')
  
  try {
    console.log('[FileGenerator] Calling external HTML generation API')
    
    // 转换JSON格式
    const apiPayload = transformJsonToApiFormat(jsonContent)
    console.log('[FileGenerator] API payload prepared:', JSON.stringify(apiPayload, null, 2))
    
    let lastError = null
    
    // 重试逻辑
    for (let attempt = 1; attempt <= EXTERNAL_API_CONFIG.retryAttempts; attempt++) {
      try {
        console.log(`[FileGenerator] API call attempt ${attempt}/${EXTERNAL_API_CONFIG.retryAttempts}`)
        
        const response = await axios.post(
          `${EXTERNAL_API_CONFIG.baseURL}${EXTERNAL_API_CONFIG.generateEndpoint}`,
          apiPayload,
          {
            timeout: EXTERNAL_API_CONFIG.timeout,
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'AI-Terminal/1.0.0'
            }
          }
        )
        
        console.log('[FileGenerator] API response received:', response.data)
        
        if (response.data.success) {
          // 使用API返回的fileId（即使包含undefined前缀）
          const fileId = response.data.fileId || response.data.shortCode
            
          // 构建完整的URL信息
          const urls = {
            fileId: fileId,
            fileName: response.data.originalFileName,
            fileSize: response.data.fileSize,
            shortCode: response.data.shortCode,
            shareLink: response.data.shareLink,
            shortUrl: response.data.data?.shortUrl,
            originalUrl: response.data.data?.originalUrl,
            qrCodeUrl: response.data.data?.qrCodeUrl,
            directViewUrl: response.data.data?.originalUrl || 
                          `${EXTERNAL_API_CONFIG.baseURL}/view/${fileId}`,
            directDownloadUrl: `${EXTERNAL_API_CONFIG.baseURL}/download/${fileId}`
          }
          
          const result = {
            success: true,
            data: urls,
            originalResponse: response.data,
            attempt: attempt
          }
          
          metadata.logStep('html_api_call', 'completed', result)
          metadata.setExternalUrls(urls)
          
          return result
        } else {
          throw new Error(response.data.message || '生成失败')
        }
        
      } catch (error) {
        lastError = error
        console.warn(`[FileGenerator] API attempt ${attempt} failed:`, error.message)
        
        if (attempt < EXTERNAL_API_CONFIG.retryAttempts) {
          console.log(`[FileGenerator] Waiting ${EXTERNAL_API_CONFIG.retryDelay}ms before retry...`)
          await new Promise(resolve => setTimeout(resolve, EXTERNAL_API_CONFIG.retryDelay))
        }
      }
    }
    
    // 所有尝试都失败
    throw lastError
    
  } catch (error) {
    console.error('[FileGenerator] External HTML API call failed:', error)
    metadata.logStep('html_api_call', 'failed', null, error)
    throw error
  }
}

/**
 * 保存Response JSON文件
 * @param {Object} apiResponse - API响应
 * @param {string} outputDir - 输出目录
 * @param {string} baseName - 基础文件名
 * @param {SessionMetadata} metadata - 会话元数据
 * @returns {Promise<Object>} 保存结果
 */
async function saveResponseJson(apiResponse, outputDir, baseName, metadata) {
  metadata.logStep('response_save', 'started')
  
  try {
    console.log('[FileGenerator] Saving response JSON file')
    
    // 构建响应数据
    const responseToSave = {
      originalResponse: apiResponse.originalResponse,
      shareLink: apiResponse.data.shareLink.replace(
        'engagia-s-cdmxfcdbwa.cn-hangzhou.fcapp.run',
        'engagia-s3.paitongai.net'
      ),
      generatedAt: new Date().toISOString(),
      sourceFile: `${baseName}.json`,
      metadata: {
        originalShareLink: apiResponse.data.shareLink,
        processedShareLink: apiResponse.data.shareLink.replace(
          'engagia-s-cdmxfcdbwa.cn-hangzhou.fcapp.run',
          'engagia-s3.paitongai.net'
        )
      }
    }
    
    // 生成文件名和路径
    const fileName = `${baseName}-response.json`
    const filePath = path.join(outputDir, fileName)
    
    // 保存文件
    await fs.writeFile(filePath, JSON.stringify(responseToSave, null, 2), 'utf-8')
    
    const result = {
      fileName,
      filePath,
      content: responseToSave
    }
    
    metadata.logStep('response_save', 'completed', result)
    await metadata.addFile(fileName, filePath, 'response')
    
    console.log(`[FileGenerator] Response JSON saved to: ${filePath}`)
    return result
    
  } catch (error) {
    console.error('[FileGenerator] Failed to save response JSON:', error)
    metadata.logStep('response_save', 'failed', null, error)
    throw error
  }
}

/**
 * 下载并保存HTML文件
 * @param {string} downloadUrl - 下载URL
 * @param {string} outputDir - 输出目录
 * @param {string} baseName - 基础文件名
 * @param {SessionMetadata} metadata - 会话元数据
 * @returns {Promise<Object>} 下载结果
 */
async function downloadHtmlFile(downloadUrl, outputDir, baseName, metadata) {
  metadata.logStep('html_download', 'started')
  
  try {
    console.log('[FileGenerator] Downloading HTML file')
    
    // 进度回调
    const progressCallback = (progress) => {
      console.log(`[FileGenerator] Download progress: ${progress}%`)
    }
    
    // 下载HTML文件
    const result = await downloadAndSaveHtml(downloadUrl, outputDir, baseName, progressCallback)
    
    if (result.success) {
      metadata.logStep('html_download', 'completed', result)
      await metadata.addFile(result.fileName, result.filePath, 'html')
      
      console.log(`[FileGenerator] HTML file downloaded successfully: ${result.filePath}`)
      return result
    } else {
      throw new Error(result.error || 'HTML download failed')
    }
    
  } catch (error) {
    console.error('[FileGenerator] HTML download failed:', error)
    metadata.logStep('html_download', 'failed', null, error)
    throw error
  }
}

/**
 * 执行四文件生成流程
 * @param {Object} params - 生成参数
 * @returns {Promise<Object>} 生成结果
 */
export async function generateFourFiles(params) {
  const {
    userId,
    topic,
    templateName,
    outputDir,
    jsonFilePath,
    baseName,
    requestId,
    apiEndpoint = '/api/generate/card'
  } = params
  
  console.log('[FileGenerator] Starting four-file generation process')
  console.log('[FileGenerator] Parameters:', params)
  
  // 初始化会话元数据
  const metadata = new SessionMetadata(userId, topic, templateName, apiEndpoint, requestId)
  metadata.setPaths(null, outputDir)
  
  let result = {
    success: false,
    files: [],
    errors: [],
    metadata: metadata
  }
  
  try {
    // 1. 验证JSON文件已存在
    console.log('[FileGenerator] Step 1: Validating JSON file')
    
    let jsonContent
    try {
      const jsonData = await fs.readFile(jsonFilePath, 'utf-8')
      console.log('[FileGenerator] Original JSON length:', jsonData.length)

      // 使用智能修复策略
      const smartRepairResult = smartJsonRepair(jsonData, templateName)

      if (smartRepairResult.success) {
        // 智能修复成功
        jsonContent = smartRepairResult.data
        console.log('[FileGenerator] JSON successfully repaired with method:', smartRepairResult.method)

        // 如果进行了修复，保存回文件
        if (smartRepairResult.method !== 'original-sanitizer' && smartRepairResult.cleanedContent) {
          await fs.writeFile(jsonFilePath, smartRepairResult.cleanedContent, 'utf-8')
          console.log('[FileGenerator] Repaired JSON saved back to file')
        }
      } else {
        // 智能修复失败，需要使用Claude API
        console.log('[FileGenerator] Smart repair failed, using Claude API repair')

        // 强制触发Claude修复，特别是对于包含中文引号的情况
        const repairResult = await repairJsonContent(jsonData, {
          templateName: templateName,  // 使用传入的模板名
          description: `${templateName} generated JSON`,
          requiredFields: getRequiredFieldsForTemplate(templateName),  // 根据模板类型设置必需字段
          timeout: 90000,  // 增加超时时间
          retries: 2,      // 增加重试次数
          forceRepair: true,  // 强制修复
          includeContext: true  // 包含上下文信息
        })

        if (repairResult.success) {
          console.log('[FileGenerator] Claude API repair successful')
          jsonContent = repairResult.data

          // 保存修复后的JSON到文件
          const repairedJsonString = JSON.stringify(jsonContent, null, 2)
          await fs.writeFile(jsonFilePath, repairedJsonString, 'utf-8')
          console.log('[FileGenerator] Claude-repaired JSON saved back to file')

          // 记录修复统计
          console.log('[FileGenerator] Claude repair stats:', {
            originalLength: jsonData.length,
            fixedLength: repairedJsonString.length,
            attempts: repairResult.attempts,
            executionTime: repairResult.executionTime
          })
        } else {
          // Claude修复也失败了
          console.error('[FileGenerator] Claude API repair failed:', repairResult.error)

          // 尝试最后的修复策略：基础清理
          console.log('[FileGenerator] Attempting basic cleanup as last resort')
          const basicCleaned = jsonData
            .replace(/[""]/g, '"')  // 替换中文引号为英文引号
            .replace(/[\u0000-\u001F]/g, '')  // 移除控制字符

          try {
            jsonContent = JSON.parse(basicCleaned)
            console.log('[FileGenerator] Basic cleanup successful')
            await fs.writeFile(jsonFilePath, JSON.stringify(jsonContent, null, 2), 'utf-8')
          } catch (basicError) {
            throw new Error(`All repair methods failed. Original error: ${parseError.message}. Claude error: ${repairResult.error}. Basic cleanup error: ${basicError.message}`)
          }
        }
      }
      
      // 记录JSON文件
      await metadata.addFile(path.basename(jsonFilePath), jsonFilePath, 'json')
      result.files.push({
        type: 'json',
        path: jsonFilePath,
        name: path.basename(jsonFilePath)
      })
      
      console.log('[FileGenerator] JSON file validated successfully')
      
    } catch (error) {
      throw new Error(`Failed to read/repair JSON file: ${error.message}`)
    }
    
    // 2. 调用外部API生成HTML
    console.log('[FileGenerator] Step 2: Calling external HTML API')
    const apiResponse = await callExternalHtmlApi(jsonContent, metadata)
    
    // 3. 保存Response JSON
    console.log('[FileGenerator] Step 3: Saving response JSON')
    const responseResult = await saveResponseJson(apiResponse, outputDir, baseName, metadata)
    result.files.push({
      type: 'response',
      path: responseResult.filePath,
      name: responseResult.fileName
    })
    
    // 4. 下载HTML文件
    console.log('[FileGenerator] Step 4: Downloading HTML file')
    // 从originalResponse.data中获取originalUrl并将HTTPS改为HTTP
    const originalUrl = apiResponse.originalResponse?.data?.originalUrl
    const downloadUrl = originalUrl ? originalUrl.replace('https:', 'http:') : apiResponse.data.directDownloadUrl
    console.log('[FileGenerator] Original URL from API:', originalUrl)
    console.log('[FileGenerator] Using download URL:', downloadUrl)
    const htmlResult = await downloadHtmlFile(downloadUrl, outputDir, baseName, metadata)
    result.files.push({
      type: 'html',
      path: htmlResult.filePath,
      name: htmlResult.fileName
    })
    
    // 5. 完成会话并保存元数据
    console.log('[FileGenerator] Step 5: Saving metadata')
    metadata.complete('success')
    const metaFilePath = await metadata.save(outputDir)
    result.files.push({
      type: 'meta',
      path: metaFilePath,
      name: path.basename(metaFilePath)
    })
    
    result.success = true
    console.log('[FileGenerator] Four-file generation completed successfully')
    
  } catch (error) {
    console.error('[FileGenerator] Four-file generation failed:', error)
    
    result.errors.push(error.message)
    
    // 记录失败并尝试保存元数据
    try {
      metadata.complete('failed')
      const metaFilePath = await metadata.save(outputDir)
      result.files.push({
        type: 'meta',
        path: metaFilePath,
        name: path.basename(metaFilePath)
      })
    } catch (metaError) {
      console.error('[FileGenerator] Failed to save metadata:', metaError)
      result.errors.push(`Metadata save error: ${metaError.message}`)
    }
  }
  
  return result
}

/**
 * 检查是否为daily模板
 * @param {string} templateName - 模板名称
 * @returns {boolean} 是否为daily模板
 */
export function isDailyKnowledgeTemplate(templateName) {
  return templateName === 'daily-knowledge-card-template.md'
}

/**
 * 获取模板的必需字段
 * @param {string} templateName - 模板名称
 * @returns {Array} 必需字段列表
 */
export function getRequiredFieldsForTemplate(templateName) {
  // Pod2Post模板的必需字段
  if (templateName === 'pod2post-template.md' || templateName === 'pod2post') {
    return [
      'social_content.post_title',
      'social_content.post_content',
      'social_content.highlights',
      'social_content.hashtags'
    ]
  }

  // Daily知识卡片模板的必需字段
  if (isDailyKnowledgeTemplate(templateName)) {
    return ['theme', 'copy', 'cards']
  }

  // 其他模板不强制要求特定字段
  return []
}

/**
 * 获取预期的文件列表
 * @param {string} templateName - 模板名称
 * @param {string} baseName - 基础文件名
 * @param {string} userId - 用户ID
 * @returns {Array} 预期文件列表
 */
export function getExpectedFiles(templateName, baseName, userId) {
  const timestamp = new Date()
  const timestampStr = `${timestamp.getFullYear()}${String(timestamp.getMonth() + 1).padStart(2, '0')}${String(timestamp.getDate()).padStart(2, '0')}_${String(timestamp.getHours()).padStart(2, '0')}${String(timestamp.getMinutes()).padStart(2, '0')}${String(timestamp.getSeconds()).padStart(2, '0')}`
  
  if (isDailyKnowledgeTemplate(templateName)) {
    return [
      `${baseName}.json`,
      `${baseName}-response.json`, 
      `${baseName}.html`,
      `${timestampStr}_${userId}_meta.json`
    ]
  } else {
    // 其他模板只期望meta文件（生成文件由模板决定）
    return [
      `${timestampStr}_${userId}_meta.json`
    ]
  }
}

export default {
  generateFourFiles,
  isDailyKnowledgeTemplate,
  getExpectedFiles,
  EXTERNAL_API_CONFIG
}