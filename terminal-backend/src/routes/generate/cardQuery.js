import express from 'express'
import path from 'path'
import fs from 'fs/promises'
import { authenticateUserOrDefault } from '../../middleware/userAuth.js'
import userService from '../../services/userService.js'

const router = express.Router()

/**
 * 查询文件夹下的HTML和JSON内容
 * GET /api/generate/card/query/:folderName
 * 
 * 路径参数:
 * - folderName: 文件夹名称（sanitized topic name）
 * 
 * 查询参数:
 * - username: 用户名（可选，默认使用认证用户）
 * 
 * 响应格式（如果文件存在）:
 * {
 *   "code": 200,
 *   "success": true,
 *   "data": {
 *     "topic": "原始主题",
 *     "sanitizedTopic": "清理后的主题",
 *     "templateName": "cardplanet-Sandra-json",
 *     "fileName": "主文件名",
 *     "filePath": "主文件路径",
 *     "content": "HTML内容或JSON对象",
 *     "fileType": "html",
 *     "allFiles": [
 *       {
 *         "fileName": "xxx.html",
 *         "path": "/path/to/file",
 *         "content": "HTML内容",
 *         "fileType": "html"
 *       },
 *       {
 *         "fileName": "xxx.json", 
 *         "path": "/path/to/file",
 *         "content": {...},
 *         "fileType": "json"
 *       }
 *     ],
 *     "pageinfo": {...} // JSON内容（用于cardplanet-Sandra-json模板）
 *   }
 * }
 * 
 * 响应格式（如果文件不存在）:
 * {
 *   "code": 404,
 *   "success": false,
 *   "message": "文件尚未生成或不存在",
 *   "data": {
 *     "folderName": "folder_name",
 *     "folderPath": "/path/to/folder",
 *     "status": "not_found"
 *   }
 * }
 */
router.get('/:folderName', authenticateUserOrDefault, async (req, res) => {
  try {
    let { folderName } = req.params
    const queryUsername = req.query.username || req.user.username
    
    // 参数验证
    if (!folderName || typeof folderName !== 'string' || folderName.trim().length === 0) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: 'folderName参数不能为空'
      })
    }
    
    // 尝试解码（如果已经被编码过）
    // Express通常会自动解码，但为了兼容性，我们再次尝试解码
    try {
      // 如果folderName包含%，说明可能被编码过
      if (folderName.includes('%')) {
        const decoded = decodeURIComponent(folderName)
        console.log(`[Query Card API] URL decoded: ${folderName} -> ${decoded}`)
        folderName = decoded
      }
    } catch (e) {
      // 解码失败，使用原始值
      console.log(`[Query Card API] URL decode failed, using original: ${folderName}`)
    }
    
    // folderName本身就是sanitized的topic名称，直接使用
    const sanitizedTopic = folderName
    
    console.log(`[Query Card API] ==================== QUERY REQUEST ====================`)
    console.log(`[Query Card API] Folder Name (sanitized): ${folderName}`)
    console.log(`[Query Card API] Query Username: ${queryUsername}`)
    console.log(`[Query Card API] Auth Username: ${req.user.username}`)
    console.log(`[Query Card API] ================================================================`)
    
    // 构建用户卡片路径 - 传入的folderName已经是sanitized的
    const userCardPath = userService.getUserCardPath(queryUsername, sanitizedTopic)
    
    console.log(`[Query Card API] User Card Path: ${userCardPath}`)
    
    try {
      // 检查文件夹是否存在
      const folderStats = await fs.stat(userCardPath)
      if (!folderStats.isDirectory()) {
        throw new Error('Not a directory')
      }
      
      // 读取文件夹内容
      const files = await fs.readdir(userCardPath)
      console.log(`[Query Card API] Found files in folder:`, files)
      
      // 过滤出所有生成的文件（排除响应文件和元数据）
      const generatedFiles = files.filter(f => 
        !f.includes('-response') &&
        !f.startsWith('.') &&  // 排除隐藏文件
        !f.includes('_meta') &&    // 排除元数据文件
        !f.includes('_backup')      // 排除备份文件
      )
      
      // 分类文件
      const htmlFiles = generatedFiles.filter(f => f.endsWith('.html'))
      const jsonFiles = generatedFiles.filter(f => f.endsWith('.json'))
      const otherFiles = generatedFiles.filter(f => !f.endsWith('.html') && !f.endsWith('.json'))
      
      console.log(`[Query Card API] HTML files:`, htmlFiles)
      console.log(`[Query Card API] JSON files:`, jsonFiles)
      console.log(`[Query Card API] Other files:`, otherFiles)
      console.log(`[Query Card API] Total generated files:`, generatedFiles.length)
      
      // 检查是否有生成的文件
      if (generatedFiles.length === 0) {
        return res.status(404).json({
          code: 404,
          success: false,
          message: '文件尚未生成或不存在',
          data: {
            folderName: folderName,
            folderPath: userCardPath,
            status: 'no_files_generated',
            availableFiles: files
          }
        })
      }
      
      // 构建文件信息数组
      const allFiles = []
      
      // 读取HTML文件
      for (const htmlFileName of htmlFiles) {
        const htmlFilePath = path.join(userCardPath, htmlFileName)
        try {
          const htmlContent = await fs.readFile(htmlFilePath, 'utf-8')
          allFiles.push({
            fileName: htmlFileName,
            path: htmlFilePath,
            content: htmlContent,
            fileType: 'html'
          })
          console.log(`[Query Card API] Successfully read HTML file: ${htmlFileName}`)
        } catch (error) {
          console.error(`[Query Card API] Error reading HTML file ${htmlFileName}:`, error)
        }
      }
      
      // 读取JSON文件
      for (const jsonFileName of jsonFiles) {
        const jsonFilePath = path.join(userCardPath, jsonFileName)
        try {
          const jsonContent = await fs.readFile(jsonFilePath, 'utf-8')
          try {
            const parsedJson = JSON.parse(jsonContent)
            allFiles.push({
              fileName: jsonFileName,
              path: jsonFilePath,
              content: parsedJson,
              fileType: 'json'
            })
            console.log(`[Query Card API] Successfully read and parsed JSON file: ${jsonFileName}`)
          } catch (parseError) {
            // JSON解析失败，返回原始内容
            allFiles.push({
              fileName: jsonFileName,
              path: jsonFilePath,
              content: jsonContent,
              fileType: 'json',
              parseError: true
            })
            console.log(`[Query Card API] JSON file read but parse failed: ${jsonFileName}`)
          }
        } catch (error) {
          console.error(`[Query Card API] Error reading JSON file ${jsonFileName}:`, error)
        }
      }
      
      // 读取其他类型文件（自定义模式生成的文件）
      for (const fileName of otherFiles) {
        const filePath = path.join(userCardPath, fileName)
        const ext = path.extname(fileName).toLowerCase().substring(1)
        
        try {
          // 根据文件扩展名决定如何处理
          const stats = await fs.stat(filePath)
          
          // 对于文本类文件，读取内容
          if (['md', 'txt', 'csv', 'xml', 'yaml', 'yml', 'log', 'sh', 'py', 'js', 'ts', 'jsx', 'tsx', 'css', 'scss'].includes(ext)) {
            const content = await fs.readFile(filePath, 'utf-8')
            allFiles.push({
              fileName: fileName,
              path: filePath,
              content: content,
              fileType: ext || 'text',
              size: stats.size
            })
            console.log(`[Query Card API] Successfully read ${ext} file: ${fileName}`)
          } else {
            // 对于二进制文件，只记录元信息
            allFiles.push({
              fileName: fileName,
              path: filePath,
              content: null,  // 不读取二进制内容
              fileType: ext || 'binary',
              size: stats.size,
              isBinary: true
            })
            console.log(`[Query Card API] Recorded binary file: ${fileName}`)
          }
        } catch (error) {
          console.error(`[Query Card API] Error reading file ${fileName}:`, error)
        }
      }
      
      if (allFiles.length === 0) {
        return res.status(404).json({
          code: 404,
          success: false,
          message: '无法读取生成的文件',
          data: {
            folderName: folderName,
            folderPath: userCardPath,
            status: 'files_unreadable'
          }
        })
      }
      
      // 确定主文件（优先HTML，其次JSON，最后是其他文本文件）
      const primaryFile = allFiles.find(f => f.fileType === 'html') || 
                         allFiles.find(f => f.fileType === 'json') || 
                         allFiles.find(f => !f.isBinary) ||  // 选择任何文本文件
                         allFiles[0]  // 最后选择第一个文件
      
      // 构建响应数据（与 /api/generate/card 保持一致）
      const responseData = {
        topic: sanitizedTopic, // 使用sanitized的topic，因为原始topic未知
        sanitizedTopic: sanitizedTopic,
        templateName: 'cardplanet-Sandra-json', // 默认模板，实际应该存储
        fileName: primaryFile.fileName,
        filePath: primaryFile.path,
        content: primaryFile.content,
        fileType: primaryFile.fileType,
        allFiles: allFiles
      }
      
      // 对于 cardplanet-Sandra-json 模板，添加 pageinfo 字段
      const jsonFile = allFiles.find(f => f.fileType === 'json')
      if (jsonFile && jsonFile.content && !jsonFile.parseError) {
        responseData.pageinfo = jsonFile.content
        console.log(`[Query Card API] Added pageinfo for cardplanet-Sandra-json template`)
      }
      
      console.log(`[Query Card API] ==================== SUCCESS ====================`)
      console.log(`[Query Card API] Found ${allFiles.length} files`)
      console.log(`[Query Card API] Primary file: ${primaryFile.fileName}`)
      console.log(`[Query Card API] Response data keys:`, Object.keys(responseData))
      console.log(`[Query Card API] =====================================================`)
      
      res.json({
        code: 200,
        success: true,
        data: responseData,
        message: '查询成功'
      })
      
    } catch (error) {
      // 文件夹不存在或其他错误
      console.log(`[Query Card API] Folder not found or error:`, error.message)
      
      return res.status(404).json({
        code: 404,
        success: false,
        message: '文件尚未生成或不存在',
        data: {
          folderName: folderName,
          folderPath: userCardPath,
          status: 'folder_not_found',
          error: error.message
        }
      })
    }
    
  } catch (error) {
    console.error('[Query Card API] Unexpected error:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '服务器内部错误',
      error: error.message
    })
  }
})

export default router