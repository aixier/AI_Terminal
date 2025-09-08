import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs/promises'
import { authenticateUserOrDefault } from '../../middleware/userAuth.js'

const router = express.Router()

// 获取照片目录路径
function getPicPath() {
  const isDocker = process.env.NODE_ENV === 'production' || process.env.DATA_PATH
  return isDocker 
    ? '/app/data/public_template/pod2post/照片'
    : path.join(process.cwd(), 'data', 'public_template', 'pod2post', '照片')
}

// 配置multer存储
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const picPath = getPicPath()
    try {
      await fs.mkdir(picPath, { recursive: true })
      cb(null, picPath)
    } catch (error) {
      cb(error)
    }
  },
  filename: (req, file, cb) => {
    // 保持原始文件名，如果重复则添加时间戳
    const ext = path.extname(file.originalname)
    const name = path.basename(file.originalname, ext)
    const timestamp = Date.now()
    cb(null, `${name}_${timestamp}${ext}`)
  }
})

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB限制
  },
  fileFilter: (req, file, cb) => {
    // 只允许图片文件
    const allowedTypes = /jpeg|jpg|png|gif|webp|svg|bmp/
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
    const mimetype = allowedTypes.test(file.mimetype)
    
    if (mimetype && extname) {
      return cb(null, true)
    } else {
      cb(new Error('只允许上传图片文件'))
    }
  }
})

/**
 * 上传图片到照片目录
 * POST /api/generate/pod2post/pic
 * 
 * 支持单个或多个文件上传
 * Content-Type: multipart/form-data
 * 
 * 可选参数:
 * - token: 用户token（用于权限验证）
 * - clearBase64: 是否清理Base64 HTML文件（默认false）
 */
router.post('/', 
  authenticateUserOrDefault,
  upload.array('images', 20), // 最多20个文件
  async (req, res) => {
    
  console.log(`[Pod2PostPic] ==================== PIC UPLOAD REQUEST ====================`)
  console.log(`[Pod2PostPic] User: ${req.user.username}`)
  console.log(`[Pod2PostPic] Files uploaded: ${req.files?.length || 0}`)
  console.log(`[Pod2PostPic] Clear Base64: ${req.body.clearBase64 === 'true'}`)
  
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '未选择要上传的图片文件'
      })
    }
    
    const uploadedFiles = req.files.map(file => ({
      originalName: file.originalname,
      filename: file.filename,
      size: file.size,
      path: file.path,
      url: `/data/public_template/pod2post/照片/${file.filename}`
    }))
    
    console.log(`[Pod2PostPic] Successfully uploaded files:`, uploadedFiles.map(f => f.filename))
    
    // 如果请求清理Base64文件
    if (req.body.clearBase64 === 'true') {
      try {
        await clearBase64HtmlFiles(req.user.username)
        console.log(`[Pod2PostPic] Base64 HTML files cleared for user: ${req.user.username}`)
      } catch (error) {
        console.warn(`[Pod2PostPic] Failed to clear Base64 files:`, error.message)
      }
    }
    
    res.json({
      code: 200,
      success: true,
      message: `成功上传 ${uploadedFiles.length} 个文件到照片目录`,
      data: {
        uploadedFiles,
        total: uploadedFiles.length,
        picPath: getPicPath()
      }
    })
    
  } catch (error) {
    console.error(`[Pod2PostPic] Upload failed:`, error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: error.message || '文件上传失败'
    })
  }
})

/**
 * 获取照片目录中的文件列表
 * GET /api/generate/pod2post/pic
 */
router.get('/', 
  authenticateUserOrDefault,
  async (req, res) => {
    
  try {
    const picPath = getPicPath()
    
    // 确保目录存在
    try {
      await fs.access(picPath)
    } catch {
      await fs.mkdir(picPath, { recursive: true })
    }
    
    const files = await fs.readdir(picPath)
    const imageFiles = []
    
    for (const file of files) {
      const filePath = path.join(picPath, file)
      const stats = await fs.stat(filePath)
      
      if (stats.isFile() && /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(file)) {
        imageFiles.push({
          filename: file,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          url: `/data/public_template/pod2post/照片/${file}`
        })
      }
    }
    
    // 按修改时间排序，最新的在前
    imageFiles.sort((a, b) => new Date(b.modified) - new Date(a.modified))
    
    res.json({
      code: 200,
      success: true,
      data: {
        files: imageFiles,
        total: imageFiles.length,
        picPath
      }
    })
    
  } catch (error) {
    console.error(`[Pod2PostPic] List files failed:`, error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: error.message || '获取文件列表失败'
    })
  }
})

/**
 * 删除照片目录中的指定文件
 * DELETE /api/generate/pod2post/pic/:filename
 */
router.delete('/:filename', 
  authenticateUserOrDefault,
  async (req, res) => {
    
  const { filename } = req.params
  
  try {
    const picPath = getPicPath()
    const filePath = path.join(picPath, filename)
    
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
    
    console.log(`[Pod2PostPic] File deleted: ${filename}`)
    
    res.json({
      code: 200,
      success: true,
      message: '文件删除成功',
      data: { filename }
    })
    
  } catch (error) {
    console.error(`[Pod2PostPic] Delete file failed:`, error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: error.message || '文件删除失败'
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
          console.log(`[Pod2PostPic] Cleared Base64 HTML: ${htmlPath}`)
        }
      } catch (error) {
        console.warn(`[Pod2PostPic] Failed to process folder ${folderName}:`, error.message)
      }
    }
    
    return clearedCount
    
  } catch (error) {
    console.error(`[Pod2PostPic] Failed to clear Base64 files:`, error)
    throw error
  }
}

export default router