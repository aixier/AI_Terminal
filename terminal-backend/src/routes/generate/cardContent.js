import express from 'express'
import path from 'path'
import fs from 'fs/promises'
import { authenticateUserOrDefault, ensureUserFolder } from '../../middleware/userAuth.js'
import userService from '../../services/userService.js'

const router = express.Router()

/**
 * 获取指定文件夹的HTML和JSON文件内容（特殊过滤和格式）
 * GET /api/generate/card/content/:folderName
 * 
 * 此接口专门用于获取生成的卡片内容，具有以下特点：
 * 1. 特殊过滤规则：排除 *response.json 等文件
 * 2. 响应格式与 v3.62.2 版本的 POST /api/generate/card 完全一致
 * 3. 支持 pageinfo 字段用于 cardplanet-Sandra-json 模板
 * 
 * 参数:
 * - folderName: 文件夹名称（sanitized topic名称）
 * 
 * 响应格式与 POST /api/generate/card 完全一致:
 * {
 *   "code": 200,
 *   "success": true,
 *   "data": {
 *     "topic": "文件夹名称（即主题）",
 *     "sanitizedTopic": "文件夹名称",
 *     "templateName": "推测的模板名称",
 *     "fileName": "主文件名（HTML优先）",
 *     "filePath": "主文件路径",
 *     "generationTime": null,  // 查询接口无法获取
 *     "content": "主文件内容",
 *     "apiId": null,  // 查询接口没有此信息
 *     "allFiles": [...], // [可选] 如果有多文件
 *     "pageinfo": {...}  // [可选] 如果是cardplanet-Sandra-json模板
 *   },
 *   "message": "卡片生成成功"
 * }
 */
router.get('/:folderName', authenticateUserOrDefault, ensureUserFolder, async (req, res) => {
  try {
    const { folderName } = req.params
    
    // 参数验证
    if (!folderName || typeof folderName !== 'string' || folderName.trim().length === 0) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '文件夹名称不能为空'
      })
    }
    
    const sanitizedFolderName = folderName.trim()
    
    // 使用文件夹名称作为topic（文件夹名称就是主题）
    const originalTopic = sanitizedFolderName
    
    // 使用用户特定的路径构建文件夹路径
    const userCardPath = userService.getUserCardPath(req.user.username, originalTopic)
    
    console.log(`[CardContent API] ==================== CONTENT REQUEST ====================`)
    console.log(`[CardContent API] Folder Name: ${sanitizedFolderName}`)
    console.log(`[CardContent API] Original Topic (approximated): ${originalTopic}`)
    console.log(`[CardContent API] User: ${req.user.username}`)
    console.log(`[CardContent API] User Card Path: ${userCardPath}`)
    console.log(`[CardContent API] =================================================================`)
    
    // 检查文件夹是否存在
    try {
      const stats = await fs.stat(userCardPath)
      if (!stats.isDirectory()) {
        return res.status(404).json({
          code: 404,
          success: false,
          message: `指定路径不是文件夹: ${sanitizedFolderName}`
        })
      }
    } catch (statError) {
      return res.status(404).json({
        code: 404,
        success: false,
        message: `文件夹不存在: ${sanitizedFolderName}`
      })
    }
    
    // 读取文件夹内容
    const files = await fs.readdir(userCardPath)
    console.log(`[CardContent API] Found files:`, files)
    
    // 特殊过滤规则：排除 response 文件、隐藏文件、元数据文件
    const htmlFiles = files.filter(f => 
      f.endsWith('.html') && 
      !f.includes('response') &&
      !f.startsWith('.') &&
      !f.includes('_meta')
    )
    const jsonFiles = files.filter(f => 
      f.endsWith('.json') && 
      !f.includes('response') &&
      !f.startsWith('.') &&
      !f.includes('_meta')
    )
    
    console.log(`[CardContent API] Filtered HTML files:`, htmlFiles)
    console.log(`[CardContent API] Filtered JSON files:`, jsonFiles)
    
    // 如果没有找到任何生成的文件
    if (htmlFiles.length === 0 && jsonFiles.length === 0) {
      return res.status(404).json({
        code: 404,
        success: false,
        message: `文件夹中未找到HTML或JSON文件: ${sanitizedFolderName}`
      })
    }
    
    const result = {
      success: true,
      files: []
    }
    
    // 读取HTML文件（如果存在）
    let htmlFileData = null
    if (htmlFiles.length > 0) {
      const htmlFileName = htmlFiles[0]
      const htmlFilePath = path.join(userCardPath, htmlFileName)
      try {
        const htmlContent = await fs.readFile(htmlFilePath, 'utf-8')
        htmlFileData = {
          fileName: htmlFileName,
          path: htmlFilePath,
          content: htmlContent,
          fileType: 'html'
        }
        result.files.push(htmlFileData)
        console.log(`[CardContent API] HTML file read successfully: ${htmlFileName}`)
      } catch (error) {
        console.error(`[CardContent API] Error reading HTML file:`, error)
      }
    }
    
    // 读取JSON文件（如果存在）
    let jsonFileData = null
    if (jsonFiles.length > 0) {
      const jsonFileName = jsonFiles[0]
      const jsonFilePath = path.join(userCardPath, jsonFileName)
      try {
        const jsonContent = await fs.readFile(jsonFilePath, 'utf-8')
        try {
          const parsedJson = JSON.parse(jsonContent)
          jsonFileData = {
            fileName: jsonFileName,
            path: jsonFilePath,
            content: parsedJson,
            fileType: 'json'
          }
          result.files.push(jsonFileData)
          console.log(`[CardContent API] JSON file read and parsed successfully: ${jsonFileName}`)
        } catch (parseError) {
          // JSON解析失败，返回原始内容
          jsonFileData = {
            fileName: jsonFileName,
            path: jsonFilePath,
            content: jsonContent,
            fileType: 'json',
            parseError: true
          }
          result.files.push(jsonFileData)
          console.log(`[CardContent API] JSON file read (parse failed): ${jsonFileName}`)
        }
      } catch (error) {
        console.error(`[CardContent API] Error reading JSON file:`, error)
      }
    }
    
    // 如果两个文件都没有成功读取
    if (result.files.length === 0) {
      return res.status(500).json({
        code: 500,
        success: false,
        message: `读取文件失败: ${sanitizedFolderName}`
      })
    }
    
    // 推测模板类型
    let templateName = 'unknown'
    if (htmlFileData && jsonFileData) {
      templateName = 'cardplanet-Sandra-json'
    } else if (jsonFileData) {
      templateName = 'daily-knowledge-card-template.md'
    } else if (htmlFileData) {
      templateName = 'cardplanet-Sandra-cover'
    }
    
    // 确定主文件（HTML优先，然后JSON）
    const primaryFile = htmlFileData || jsonFileData
    
    // 构建响应数据，严格按照标准格式
    const responseData = {
      topic: originalTopic,                    // 主题（文件夹名称）
      sanitizedTopic: sanitizedFolderName,    // 清理后的主题（与topic相同）
      templateName: templateName,             // 推测的模板名称
      fileName: primaryFile.fileName,         // 文件名
      filePath: primaryFile.path,             // 文件路径
      generationTime: null,                   // 生成时间（查询接口无法获取）
      content: primaryFile.content,           // 内容
      apiId: null                             // API会话ID（查询接口没有此信息）
    }
    
    // 如果有多文件，添加 allFiles 字段（按照 v3.62.2 格式）
    if (result.files.length > 1) {
      responseData.allFiles = result.files
    }
    
    // 对于 cardplanet-Sandra-json 模板，添加 pageinfo 字段返回 JSON 内容
    if (templateName === 'cardplanet-Sandra-json' && jsonFileData) {
      responseData.pageinfo = jsonFileData.content
      console.log(`[CardContent API] Added pageinfo for cardplanet-Sandra-json template`)
    }
    
    console.log(`[CardContent API] ==================== SUCCESS ====================`)
    console.log(`[CardContent API] Template: ${templateName}`)
    console.log(`[CardContent API] Found ${result.files.length} files`)
    console.log(`[CardContent API] Primary file: ${primaryFile.fileName}`)
    console.log(`[CardContent API] Has pageinfo: ${!!responseData.pageinfo}`)
    console.log(`[CardContent API] ============================================================`)
    
    // 返回成功响应（完全按照 v3.62.2 格式）
    res.json({
      code: 200,
      success: true,
      data: responseData,
      message: '卡片生成成功' // 使用与 v3.62.2 一致的消息
    })
    
  } catch (error) {
    console.error('[CardContent API] Unexpected error:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '服务器内部错误',
      error: error.message
    })
  }
})

export default router