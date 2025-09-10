import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs/promises'
import { authenticateUserOrDefault } from '../../middleware/userAuth.js'

const router = express.Router()

// 获取用户资源目录路径
async function getUserResourcesPath(username, taskId = null) {
  const userService = await import('../../services/userService.js')
  const basePath = userService.default.getUserTemplatePath(username, 'pod2post')
  
  // 如果有taskId，使用任务特定目录
  if (taskId && taskId.startsWith('pod2post_')) {
    return path.join(basePath, 'tasks', taskId, 'resources')
  }
  
  // 默认路径
  return path.join(basePath, 'resources')
}

// 配置multer存储
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      // 从req对象获取用户信息
      if (!req.user) {
        return cb(new Error('用户未认证'))
      }
      
      // 从query参数获取taskId
      const taskId = req.query.taskId
      const resourcesPath = await getUserResourcesPath(req.user.username, taskId)
      await fs.mkdir(resourcesPath, { recursive: true })
      cb(null, resourcesPath)
    } catch (error) {
      cb(error)
    }
  },
  filename: (req, file, cb) => {
    // 保持原始文件名，确保中文文件名正确解码
    const filename = Buffer.from(file.originalname, 'latin1').toString('utf8')
    cb(null, filename)
  }
})

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB限制（参考文档可能较大）
  },
  fileFilter: (req, file, cb) => {
    // 允许文档类型文件
    const allowedTypes = /txt|md|pdf|doc|docx|rtf|odt|tex|csv|json|xml|yaml|yml/
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
    
    // 检查MIME类型
    const allowedMimeTypes = [
      'text/plain',                    // txt
      'text/markdown',                 // md
      'application/pdf',               // pdf
      'application/msword',            // doc
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
      'application/rtf',               // rtf
      'application/vnd.oasis.opendocument.text', // odt
      'application/x-tex',             // tex
      'text/csv',                      // csv
      'application/json',              // json
      'application/xml',               // xml
      'text/xml',                      // xml
      'application/x-yaml',            // yaml
      'text/yaml',                     // yaml
      'text/x-yaml'                    // yaml
    ]
    
    const mimetypeValid = allowedMimeTypes.includes(file.mimetype)
    
    if (extname || mimetypeValid) {
      return cb(null, true)
    } else {
      cb(new Error('只允许上传文档类型文件 (txt, md, pdf, doc, docx, rtf, odt, tex, csv, json, xml, yaml)'))
    }
  }
})

/**
 * 上传参考文档到资源目录
 * POST /api/generate/pod2post/resources
 * 
 * 支持单个或多个文件上传
 * Content-Type: multipart/form-data
 * 
 * Query参数:
 * - taskId: 任务ID（可选，格式: pod2post_{timestamp}_{random}）
 * 
 * Body参数:
 * - token: 用户token（用于权限验证）
 * - clearBase64: 是否清理Base64 HTML文件（默认false）
 */
router.post('/', 
  authenticateUserOrDefault,
  upload.array('files', 50), // 最多50个文件
  async (req, res) => {
    
  console.log(`[Pod2PostResources] ==================== RESOURCES UPLOAD REQUEST ====================`)
  console.log(`[Pod2PostResources] User: ${req.user.username}`)
  console.log(`[Pod2PostResources] TaskId: ${req.query.taskId || 'none (using default)'}`)
  console.log(`[Pod2PostResources] Files uploaded: ${req.files?.length || 0}`)
  console.log(`[Pod2PostResources] Clear Base64: ${req.body.clearBase64 === 'true'}`)
  
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '未选择要上传的文档文件'
      })
    }
    
    const uploadedFiles = req.files.map(file => ({
      originalName: file.originalname,
      filename: file.filename,
      size: file.size,
      type: path.extname(file.originalname).toLowerCase(),
      mimetype: file.mimetype,
      path: file.path,
      url: `/data/public_template/pod2post/resources/${file.filename}`
    }))
    
    console.log(`[Pod2PostResources] Successfully uploaded files:`, uploadedFiles.map(f => f.filename))
    
    // 如果请求清理Base64文件
    if (req.body.clearBase64 === 'true') {
      try {
        const clearedCount = await clearBase64HtmlFiles(req.user.username)
        console.log(`[Pod2PostResources] Base64 HTML files cleared for user: ${req.user.username}, count: ${clearedCount}`)
      } catch (error) {
        console.warn(`[Pod2PostResources] Failed to clear Base64 files:`, error.message)
      }
    }
    
    // 从query参数获取taskId
    const taskId = req.query.taskId
    
    res.json({
      code: 200,
      success: true,
      message: `成功上传 ${uploadedFiles.length} 个参考文档到资源目录`,
      data: {
        uploadedFiles,
        total: uploadedFiles.length,
        resourcesPath: await getUserResourcesPath(req.user.username, taskId)
      }
    })
    
  } catch (error) {
    console.error(`[Pod2PostResources] Upload failed:`, error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: error.message || '文档上传失败'
    })
  }
})

/**
 * 获取资源目录中的文件列表
 * GET /api/generate/pod2post/resources
 */
router.get('/', 
  authenticateUserOrDefault,
  async (req, res) => {
    
  try {
    const taskId = req.query.taskId
    const resourcesPath = await getUserResourcesPath(req.user.username, taskId)
    
    // 确保目录存在
    try {
      await fs.access(resourcesPath)
    } catch {
      await fs.mkdir(resourcesPath, { recursive: true })
    }
    
    const files = await fs.readdir(resourcesPath)
    const documentFiles = []
    
    const allowedExtensions = ['.txt', '.md', '.pdf', '.doc', '.docx', '.rtf', '.odt', '.tex', '.csv', '.json', '.xml', '.yaml', '.yml']
    
    for (const file of files) {
      const filePath = path.join(resourcesPath, file)
      const stats = await fs.stat(filePath)
      const ext = path.extname(file).toLowerCase()
      
      if (stats.isFile() && allowedExtensions.includes(ext)) {
        documentFiles.push({
          filename: file,
          size: stats.size,
          type: ext,
          created: stats.birthtime,
          modified: stats.mtime,
          url: `/data/public_template/pod2post/resources/${file}`
        })
      }
    }
    
    // 按修改时间排序，最新的在前
    documentFiles.sort((a, b) => new Date(b.modified) - new Date(a.modified))
    
    res.json({
      code: 200,
      success: true,
      data: {
        files: documentFiles,
        total: documentFiles.length,
        resourcesPath
      }
    })
    
  } catch (error) {
    console.error(`[Pod2PostResources] List files failed:`, error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: error.message || '获取文件列表失败'
    })
  }
})

/**
 * 删除资源目录中的指定文件
 * DELETE /api/generate/pod2post/resources/:filename
 */
router.delete('/:filename', 
  authenticateUserOrDefault,
  async (req, res) => {
    
  const { filename } = req.params
  
  try {
    const taskId = req.query.taskId
    const resourcesPath = await getUserResourcesPath(req.user.username, taskId)
    const filePath = path.join(resourcesPath, filename)
    
    // 检查文件是否存在
    try {
      await fs.access(filePath)
    } catch {
      return res.status(404).json({
        code: 404,
        success: false,
        message: '文件不存在'
      })
    }
    
    // 删除文件
    await fs.unlink(filePath)
    
    console.log(`[Pod2PostResources] File deleted: ${filename}`)
    
    res.json({
      code: 200,
      success: true,
      message: '文件删除成功',
      data: { filename }
    })
    
  } catch (error) {
    console.error(`[Pod2PostResources] Delete file failed:`, error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: error.message || '文件删除失败'
    })
  }
})

/**
 * 获取指定文件的内容（仅支持文本类型文件）
 * GET /api/generate/pod2post/resources/content/:filename
 */
router.get('/content/:filename', 
  authenticateUserOrDefault,
  async (req, res) => {
    
  const { filename } = req.params
  
  try {
    const taskId = req.query.taskId
    const resourcesPath = await getUserResourcesPath(req.user.username, taskId)
    const filePath = path.join(resourcesPath, filename)
    
    // 检查文件是否存在
    try {
      await fs.access(filePath)
    } catch {
      return res.status(404).json({
        code: 404,
        success: false,
        message: '文件不存在'
      })
    }
    
    // 检查文件类型是否支持内容读取
    const ext = path.extname(filename).toLowerCase()
    const textTypes = ['.txt', '.md', '.csv', '.json', '.xml', '.yaml', '.yml', '.tex']
    
    if (!textTypes.includes(ext)) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '该文件类型不支持内容预览'
      })
    }
    
    // 读取文件内容
    const content = await fs.readFile(filePath, 'utf-8')
    const stats = await fs.stat(filePath)
    
    res.json({
      code: 200,
      success: true,
      data: {
        filename,
        content,
        size: stats.size,
        type: ext,
        encoding: 'utf-8'
      }
    })
    
  } catch (error) {
    console.error(`[Pod2PostResources] Read file content failed:`, error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: error.message || '读取文件内容失败'
    })
  }
})

/**
 * 批量删除资源文件
 * POST /api/generate/pod2post/resources/batch-delete
 */
router.post('/batch-delete', 
  authenticateUserOrDefault,
  async (req, res) => {
    
  const { filenames } = req.body
  
  if (!filenames || !Array.isArray(filenames) || filenames.length === 0) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: '请提供要删除的文件名列表'
    })
  }
  
  try {
    const resourcesPath = getResourcesPath()
    const results = []
    
    for (const filename of filenames) {
      try {
        const filePath = path.join(resourcesPath, filename)
        await fs.access(filePath)
        await fs.unlink(filePath)
        results.push({ filename, success: true })
        console.log(`[Pod2PostResources] Batch deleted: ${filename}`)
      } catch (error) {
        results.push({ filename, success: false, error: error.message })
        console.warn(`[Pod2PostResources] Failed to delete ${filename}:`, error.message)
      }
    }
    
    const successCount = results.filter(r => r.success).length
    
    res.json({
      code: 200,
      success: true,
      message: `批量删除完成：成功 ${successCount} 个，失败 ${filenames.length - successCount} 个`,
      data: {
        results,
        total: filenames.length,
        success: successCount,
        failed: filenames.length - successCount
      }
    })
    
  } catch (error) {
    console.error(`[Pod2PostResources] Batch delete failed:`, error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: error.message || '批量删除失败'
    })
  }
})

/**
 * 清理用户的Base64 HTML文件
 * @param {string} username - 用户名
 */
async function clearBase64HtmlFiles(username) {
  const userService = await import('../../services/userService.js')
  const { cardPath } = userService.default.getUserWorkspacePath(username)
  
  try {
    const folders = await fs.readdir(cardPath)
    const pod2postFolders = folders.filter(folder => folder.startsWith('pod2post_'))
    
    let clearedCount = 0
    
    for (const folderName of pod2postFolders) {
      const folderPath = path.join(cardPath, folderName)
      
      try {
        const files = await fs.readdir(folderPath)
        const base64HtmlFiles = files.filter(file => file.endsWith('_with_base64.html'))
        
        for (const htmlFile of base64HtmlFiles) {
          const htmlPath = path.join(folderPath, htmlFile)
          await fs.unlink(htmlPath)
          clearedCount++
          console.log(`[Pod2PostResources] Cleared Base64 HTML: ${htmlPath}`)
        }
      } catch (error) {
        console.warn(`[Pod2PostResources] Failed to process folder ${folderName}:`, error.message)
      }
    }
    
    return clearedCount
    
  } catch (error) {
    console.error(`[Pod2PostResources] Failed to clear Base64 files:`, error)
    throw error
  }
}

export default router