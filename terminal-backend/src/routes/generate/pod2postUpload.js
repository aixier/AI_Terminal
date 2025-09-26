import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs/promises'
import { authenticateUserOrDefault } from '../../middleware/userAuth.js'

const router = express.Router()

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
          console.log(`[Pod2PostUpload] Cleared Base64 HTML: ${htmlPath}`)
        }
      } catch (error) {
        console.warn(`[Pod2PostUpload] Failed to process folder ${folderName}:`, error.message)
      }
    }

    return clearedCount

  } catch (error) {
    console.error(`[Pod2PostUpload] Failed to clear Base64 files:`, error)
    throw error
  }
}

/**
 * 获取用户上传目录路径
 * @param {string} username - 用户名
 * @param {string} uploadPath - 上传路径
 * @param {string} taskId - 任务ID（可选）
 */
async function getUserUploadPath(username, uploadPath, taskId = null) {
  const userService = await import('../../services/userService.js')
  const basePath = userService.default.getUserTemplatePath(username, 'pod2post')

  // 安全处理路径，防止路径遍历
  const sanitizedPath = uploadPath
    .split('/')
    .filter(segment => segment && segment !== '..' && segment !== '.' && !segment.startsWith('~'))
    .join('/')

  // 如果有taskId，使用任务特定目录
  if (taskId && taskId.startsWith('pod2post_')) {
    return path.join(basePath, 'tasks', taskId, sanitizedPath)
  }

  // 默认路径
  return path.join(basePath, sanitizedPath)
}

/**
 * 根据路径获取消息文本
 * @param {string} uploadPath - 上传路径
 */
function getPathDisplayName(uploadPath) {
  // 提取第一级目录名称用于显示
  const firstSegment = uploadPath.split('/')[0].toLowerCase()
  const displayNames = {
    'cdn': 'CDN',
    'photos': '照片',
    'resources': '资源'
  }
  return displayNames[firstSegment] || uploadPath
}

/**
 * 根据路径获取返回的路径字段名
 * @param {string} uploadPath - 上传路径
 */
function getPathFieldName(uploadPath) {
  // 提取第一级目录名称
  const firstSegment = uploadPath.split('/')[0].toLowerCase()
  const fieldNames = {
    'cdn': 'cdnPath',
    'photos': 'picPath',
    'resources': 'resourcesPath'
  }
  return fieldNames[firstSegment] || 'uploadPath'
}

// 配置multer内存存储
const storage = multer.memoryStorage()

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB限制（兼容resources的大文件）
  }
})

/**
 * 通用文件上传接口
 * POST /api/generate/pod2post/upload
 *
 * Query参数:
 * - path: 目标目录路径（必填，如 "CDN", "photos", "resources", "CDN/2024/images"）
 * - taskId: 任务ID（可选，格式: pod2post_{timestamp}_{random}）
 *
 * Body参数:
 * - file: 上传的文件（单个）
 * - filename: 自定义文件名（可选）
 * - clearBase64: 是否清理Base64 HTML文件（可选，默认true）
 * - token: 用户token（用于权限验证）
 */
router.post('/',
  authenticateUserOrDefault,
  upload.single('file'),
  async (req, res) => {

  const { path: uploadPath, taskId } = req.query
  const { filename: customFilename } = req.body

  console.log(`[Pod2PostUpload] ==================== UPLOAD REQUEST ====================`)
  console.log(`[Pod2PostUpload] User: ${req.user.username}`)
  console.log(`[Pod2PostUpload] Path: ${uploadPath}`)
  console.log(`[Pod2PostUpload] TaskId: ${taskId || 'none'}`)
  console.log(`[Pod2PostUpload] Custom filename: ${customFilename || 'none'}`)

  try {
    // 验证必填参数
    if (!uploadPath) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '请提供上传路径参数 path'
      })
    }

    if (!req.file) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '未选择要上传的文件'
      })
    }

    // 获取目标路径
    const targetPath = await getUserUploadPath(req.user.username, uploadPath, taskId)

    // 确保目录存在
    await fs.mkdir(targetPath, { recursive: true })

    // 使用自定义文件名或原始文件名
    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8')
    const finalFilename = customFilename || originalName
    const filePath = path.join(targetPath, finalFilename)

    // 保存文件
    await fs.writeFile(filePath, req.file.buffer)

    console.log(`[Pod2PostUpload] File saved: ${filePath}`)

    // clearBase64 默认为 true
    const clearBase64 = req.body.clearBase64 !== 'false'

    if (clearBase64) {
      try {
        const clearedCount = await clearBase64HtmlFiles(req.user.username)
        console.log(`[Pod2PostUpload] Auto cleared ${clearedCount} Base64 files`)
      } catch (error) {
        console.warn(`[Pod2PostUpload] Failed to clear Base64 files:`, error.message)
      }
    }

    // 构建URL路径
    let url
    const sanitizedPath = uploadPath
      .split('/')
      .filter(segment => segment && segment !== '..' && segment !== '.' && !segment.startsWith('~'))
      .join('/')

    if (taskId && taskId.startsWith('pod2post_')) {
      url = `/data/users/${req.user.username}/workspace/templates/pod2post/tasks/${taskId}/${sanitizedPath}/${finalFilename}`
    } else {
      url = `/data/users/${req.user.username}/workspace/templates/pod2post/${sanitizedPath}/${finalFilename}`
    }

    // 构建响应数据（兼容原接口格式）
    const uploadedFile = {
      originalName: originalName,
      filename: finalFilename,
      size: req.file.size,
      path: filePath,
      url: url
    }

    // 如果是resources路径，添加额外字段以保持兼容性
    const pathLower = uploadPath.toLowerCase()
    if (pathLower === 'resources' || pathLower.startsWith('resources/')) {
      uploadedFile.type = path.extname(finalFilename).toLowerCase()
      uploadedFile.mimetype = req.file.mimetype
    }

    // 构建响应（保持与原接口兼容）
    const pathFieldName = getPathFieldName(uploadPath)
    const pathDisplayName = getPathDisplayName(uploadPath)

    res.json({
      code: 200,
      success: true,
      message: `成功上传 1 个文件到${pathDisplayName}目录`,
      data: {
        uploadedFiles: [uploadedFile],
        total: 1,
        [pathFieldName]: targetPath
      }
    })

  } catch (error) {
    console.error(`[Pod2PostUpload] Upload failed:`, error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: error.message || '文件上传失败'
    })
  }
})

/**
 * 获取指定目录中的文件列表
 * GET /api/generate/pod2post/upload
 *
 * Query参数:
 * - path: 目标目录路径（必填）
 * - taskId: 任务ID（可选）
 */
router.get('/',
  authenticateUserOrDefault,
  async (req, res) => {

  const { path: uploadPath, taskId } = req.query

  try {
    // 验证必填参数
    if (!uploadPath) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '请提供路径参数 path'
      })
    }

    // 获取目标路径
    const targetPath = await getUserUploadPath(req.user.username, uploadPath, taskId)

    // 确保目录存在
    try {
      await fs.access(targetPath)
    } catch {
      await fs.mkdir(targetPath, { recursive: true })
    }

    const files = await fs.readdir(targetPath)
    const fileList = []

    // 根据路径类型决定文件过滤规则
    const pathLower = uploadPath.toLowerCase()
    const isResourcePath = pathLower === 'resources' || pathLower.startsWith('resources/')
    const isCdnOrPhotoPath = pathLower === 'cdn' || pathLower.startsWith('cdn/') ||
                             pathLower === 'photos' || pathLower.startsWith('photos/')

    for (const file of files) {
      const filePath = path.join(targetPath, file)
      const stats = await fs.stat(filePath)

      if (stats.isFile()) {
        const ext = path.extname(file).toLowerCase()

        // 根据路径类型过滤文件
        let includeFile = true
        if (isCdnOrPhotoPath) {
          // CDN和photos只接受图片文件
          includeFile = /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(file)
        } else if (isResourcePath) {
          // resources接受文档类型
          const allowedExtensions = ['.txt', '.md', '.pdf', '.doc', '.docx', '.rtf', '.odt', '.tex', '.csv', '.json', '.xml', '.yaml', '.yml']
          includeFile = allowedExtensions.includes(ext)
        }

        if (includeFile) {
          // 构建URL
          const sanitizedPath = uploadPath
            .split('/')
            .filter(segment => segment && segment !== '..' && segment !== '.' && !segment.startsWith('~'))
            .join('/')

          let url
          if (taskId && taskId.startsWith('pod2post_')) {
            url = `/data/users/${req.user.username}/workspace/templates/pod2post/tasks/${taskId}/${sanitizedPath}/${file}`
          } else {
            url = `/data/users/${req.user.username}/workspace/templates/pod2post/${sanitizedPath}/${file}`
          }

          const fileInfo = {
            filename: file,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime,
            url: url
          }

          // resources路径添加type字段
          if (isResourcePath) {
            fileInfo.type = ext
          }

          fileList.push(fileInfo)
        }
      }
    }

    // 按修改时间排序，最新的在前
    fileList.sort((a, b) => new Date(b.modified) - new Date(a.modified))

    // 构建响应（保持与原接口兼容）
    const pathFieldName = getPathFieldName(uploadPath)

    res.json({
      code: 200,
      success: true,
      data: {
        files: fileList,
        total: fileList.length,
        [pathFieldName]: targetPath
      }
    })

  } catch (error) {
    console.error(`[Pod2PostUpload] List files failed:`, error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: error.message || '获取文件列表失败'
    })
  }
})

/**
 * 删除指定文件
 * DELETE /api/generate/pod2post/upload/:filename
 *
 * URL参数:
 * - filename: 要删除的文件名
 *
 * Query参数:
 * - path: 目标目录路径（必填）
 * - taskId: 任务ID（可选）
 */
router.delete('/:filename',
  authenticateUserOrDefault,
  async (req, res) => {

  const { filename } = req.params
  const { path: uploadPath, taskId } = req.query

  try {
    // 验证必填参数
    if (!uploadPath) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '请提供路径参数 path'
      })
    }

    // 获取目标路径
    const targetPath = await getUserUploadPath(req.user.username, uploadPath, taskId)
    const filePath = path.join(targetPath, filename)

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

    console.log(`[Pod2PostUpload] File deleted: ${filename} from ${uploadPath}`)

    res.json({
      code: 200,
      success: true,
      message: '文件删除成功',
      data: { filename }
    })

  } catch (error) {
    console.error(`[Pod2PostUpload] Delete file failed:`, error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: error.message || '文件删除失败'
    })
  }
})

/**
 * 获取指定文件的内容（仅支持文本类型文件，兼容resources接口）
 * GET /api/generate/pod2post/upload/content/:filename
 *
 * URL参数:
 * - filename: 文件名
 *
 * Query参数:
 * - path: 目标目录路径（必填）
 * - taskId: 任务ID（可选）
 */
router.get('/content/:filename',
  authenticateUserOrDefault,
  async (req, res) => {

  const { filename } = req.params
  const { path: uploadPath, taskId } = req.query

  try {
    // 验证必填参数
    if (!uploadPath) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '请提供路径参数 path'
      })
    }

    // 获取目标路径
    const targetPath = await getUserUploadPath(req.user.username, uploadPath, taskId)
    const filePath = path.join(targetPath, filename)

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
    console.error(`[Pod2PostUpload] Read file content failed:`, error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: error.message || '读取文件内容失败'
    })
  }
})

/**
 * 批量删除文件（兼容resources接口）
 * POST /api/generate/pod2post/upload/batch-delete
 *
 * Query参数:
 * - path: 目标目录路径（必填）
 * - taskId: 任务ID（可选）
 *
 * Body参数:
 * - filenames: 要删除的文件名数组
 */
router.post('/batch-delete',
  authenticateUserOrDefault,
  async (req, res) => {

  const { path: uploadPath, taskId } = req.query
  const { filenames } = req.body

  // 验证必填参数
  if (!uploadPath) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: '请提供路径参数 path'
    })
  }

  if (!filenames || !Array.isArray(filenames) || filenames.length === 0) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: '请提供要删除的文件名列表'
    })
  }

  try {
    // 获取目标路径
    const targetPath = await getUserUploadPath(req.user.username, uploadPath, taskId)
    const results = []

    for (const filename of filenames) {
      try {
        const filePath = path.join(targetPath, filename)
        await fs.access(filePath)
        await fs.unlink(filePath)
        results.push({ filename, success: true })
        console.log(`[Pod2PostUpload] Batch deleted: ${filename}`)
      } catch (error) {
        results.push({ filename, success: false, error: error.message })
        console.warn(`[Pod2PostUpload] Failed to delete ${filename}:`, error.message)
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
    console.error(`[Pod2PostUpload] Batch delete failed:`, error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: error.message || '批量删除失败'
    })
  }
})

export default router