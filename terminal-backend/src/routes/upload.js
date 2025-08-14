import express from 'express'
import path from 'path'
import fs from 'fs/promises'
import { fileURLToPath } from 'url'
import multer from 'multer'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

// 配置multer存储
const getUploadPath = () => {
  const isDocker = process.env.NODE_ENV === 'production' || process.env.DATA_PATH
  return isDocker 
    ? '/app/data/public_template'
    : path.join(process.cwd(), 'data', 'public_template')
}

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const uploadPath = getUploadPath()
      // 确保基础目录存在
      await fs.mkdir(uploadPath, { recursive: true })
      cb(null, uploadPath)
    } catch (error) {
      cb(error)
    }
  },
  filename: (req, file, cb) => {
    // 清理文件名，移除危险字符
    const cleanFilename = file.originalname.replace(/[<>:"/\\|?*]/g, '_')
    cb(null, cleanFilename)
  }
})

// 配置文件过滤器
const fileFilter = (req, file, cb) => {
  // 允许常见的文本文件类型
  const allowedMimes = [
    'text/plain',
    'text/html',
    'text/css',
    'text/javascript',
    'application/json',
    'application/xml',
    'text/xml',
    'application/x-yaml',
    'text/yaml'
  ]
  
  // 允许常见的文件扩展名
  const allowedExts = [
    '.txt', '.md', '.html', '.css', '.js', '.json', '.xml', '.yaml', '.yml',
    '.vue', '.jsx', '.tsx', '.ts', '.py', '.java', '.cpp', '.c', '.h', '.php',
    '.rb', '.go', '.rs', '.sh', '.bat', '.sql', '.csv', '.log', '.conf', '.ini'
  ]
  
  const ext = path.extname(file.originalname).toLowerCase()
  const mimeAllowed = allowedMimes.includes(file.mimetype)
  const extAllowed = allowedExts.includes(ext)
  
  if (mimeAllowed || extAllowed) {
    cb(null, true)
  } else {
    cb(new Error(`不支持的文件类型: ${file.originalname} (${file.mimetype})`))
  }
}

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB限制
    files: 100 // 最多100个文件
  }
})

/**
 * 上传文件（multipart/form-data）
 * POST /api/upload/files
 */
router.post('/files', upload.array('files'), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: '未选择文件'
      })
    }

    const uploadPath = getUploadPath()
    const folderPath = req.body.folderPath || ''
    const uploadedFiles = []

    // 处理每个上传的文件
    for (const file of req.files) {
      let finalPath = file.path
      
      // 如果指定了文件夹路径，移动文件到对应文件夹
      if (folderPath) {
        const targetDir = path.join(uploadPath, folderPath)
        await fs.mkdir(targetDir, { recursive: true })
        
        const targetPath = path.join(targetDir, file.filename)
        await fs.rename(file.path, targetPath)
        finalPath = targetPath
      }

      uploadedFiles.push({
        filename: file.filename,
        originalName: file.originalname,
        size: file.size,
        path: finalPath,
        folderPath: folderPath
      })
    }

    console.log(`[Upload] Uploaded ${uploadedFiles.length} files to folder: ${folderPath || 'root'}`)

    res.json({
      success: true,
      data: {
        files: uploadedFiles,
        count: uploadedFiles.length
      },
      message: `成功上传 ${uploadedFiles.length} 个文件`
    })

  } catch (error) {
    console.error('[Upload] File upload error:', error)
    res.status(500).json({
      success: false,
      message: error.message || '文件上传失败'
    })
  }
})

/**
 * 基于文本内容创建文件（保留原有功能）
 * POST /api/upload/file
 */
router.post('/file', async (req, res) => {
  try {
    const { filename, content, folderPath = '' } = req.body

    if (!filename || !content) {
      return res.status(400).json({
        success: false,
        message: '文件名和内容不能为空'
      })
    }

    // 清理文件名
    const cleanFilename = filename.trim().replace(/[<>:"/\\|?*]/g, '_')
    
    // 确定目标路径
    const isDocker = process.env.NODE_ENV === 'production' || process.env.DATA_PATH
    const baseDir = isDocker 
      ? '/app/data/public_template'
      : path.join(process.cwd(), 'data', 'public_template')
    
    const targetDir = folderPath ? path.join(baseDir, folderPath) : baseDir
    const filePath = path.join(targetDir, cleanFilename)

    // 确保目录存在
    await fs.mkdir(targetDir, { recursive: true })

    // 写入文件
    await fs.writeFile(filePath, content, 'utf8')

    console.log(`[Upload] File created: ${cleanFilename}`)

    res.json({
      success: true,
      data: {
        filename: cleanFilename,
        size: Buffer.byteLength(content, 'utf8'),
        path: filePath,
        folderPath: folderPath
      },
      message: '文件创建成功'
    })

  } catch (error) {
    console.error('[Upload] File creation error:', error)
    res.status(500).json({
      success: false,
      message: error.message || '文件创建失败'
    })
  }
})

/**
 * 创建新文件夹
 * POST /api/upload/folder
 */
router.post('/folder', async (req, res) => {
  try {
    const { folderName } = req.body

    if (!folderName || typeof folderName !== 'string') {
      return res.status(400).json({
        success: false,
        message: '文件夹名称不能为空'
      })
    }

    // 清理文件夹名称
    const cleanFolderName = folderName.trim().replace(/[<>:"/\\|?*]/g, '_')
    
    // 确定目标路径
    const isDocker = process.env.NODE_ENV === 'production' || process.env.DATA_PATH
    const baseDir = isDocker 
      ? '/app/data/public_template'
      : path.join(process.cwd(), 'data', 'public_template')
    
    const folderPath = path.join(baseDir, cleanFolderName)

    // 检查文件夹是否已存在
    try {
      await fs.access(folderPath)
      return res.status(409).json({
        success: false,
        message: '文件夹已存在'
      })
    } catch {
      // 文件夹不存在，可以创建
    }

    // 创建文件夹
    await fs.mkdir(folderPath, { recursive: true })

    console.log(`[Upload] Folder created: ${cleanFolderName}`)

    res.json({
      success: true,
      data: {
        folderName: cleanFolderName,
        path: folderPath
      },
      message: '文件夹创建成功'
    })

  } catch (error) {
    console.error('[Upload] Folder creation error:', error)
    res.status(500).json({
      success: false,
      message: error.message || '文件夹创建失败'
    })
  }
})

/**
 * 获取public_template目录结构
 * GET /api/upload/structure
 */
router.get('/structure', async (req, res) => {
  try {
    const isDocker = process.env.NODE_ENV === 'production' || process.env.DATA_PATH
    const baseDir = isDocker 
      ? '/app/data/public_template'
      : path.join(process.cwd(), 'data', 'public_template')

    const structure = await getDirectoryStructure(baseDir)

    res.json({
      success: true,
      data: structure,
      message: '目录结构获取成功'
    })

  } catch (error) {
    console.error('[Upload] Get structure error:', error)
    res.status(500).json({
      success: false,
      message: error.message || '获取目录结构失败'
    })
  }
})

/**
 * 递归获取目录结构
 */
async function getDirectoryStructure(dirPath) {
  const items = []
  
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)
      
      if (entry.isDirectory()) {
        items.push({
          type: 'folder',
          name: entry.name,
          children: await getDirectoryStructure(fullPath)
        })
      } else {
        const stats = await fs.stat(fullPath)
        items.push({
          type: 'file',
          name: entry.name,
          size: stats.size,
          modified: stats.mtime
        })
      }
    }
  } catch (error) {
    console.error('Error reading directory:', dirPath, error)
  }
  
  return items
}

/**
 * 删除文件或文件夹
 * DELETE /api/upload/:type/:name
 */
router.delete('/:type/:name', async (req, res) => {
  try {
    const { type, name } = req.params

    if (!['file', 'folder'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: '无效的删除类型'
      })
    }

    const isDocker = process.env.NODE_ENV === 'production' || process.env.DATA_PATH
    const baseDir = isDocker 
      ? '/app/data/public_template'
      : path.join(process.cwd(), 'data', 'public_template')

    const targetPath = path.join(baseDir, decodeURIComponent(name))

    // 安全检查：确保路径在允许的目录内
    const resolvedTarget = path.resolve(targetPath)
    const resolvedBase = path.resolve(baseDir)
    
    if (!resolvedTarget.startsWith(resolvedBase)) {
      return res.status(403).json({
        success: false,
        message: '路径访问被拒绝'
      })
    }

    // 执行删除
    if (type === 'folder') {
      await fs.rmdir(targetPath, { recursive: true })
    } else {
      await fs.unlink(targetPath)
    }

    console.log(`[Upload] ${type} deleted: ${name}`)

    res.json({
      success: true,
      message: `${type === 'folder' ? '文件夹' : '文件'}删除成功`
    })

  } catch (error) {
    console.error('[Upload] Delete error:', error)
    res.status(500).json({
      success: false,
      message: error.message || '删除失败'
    })
  }
})

export default router