/**
 * Pod2Post 文件上传并返回OSS URL接口
 *
 * 功能:
 * 1. 接收文件上传
 * 2. 上传到OSS
 * 3. 返回可访问的OSS URL
 *
 * @author AI Terminal Team
 * @version 1.0.0
 * @created 2025-01-13
 */

import express from 'express'
import path from 'path'
import fs from 'fs/promises'
import multer from 'multer'
import { authenticateUserOrDefault } from '../../middleware/userAuth.js'
import userService from '../../services/userService.js'
import { OSSService } from '../../services/oss/index.cjs'

const router = express.Router()

// 配置multer用于文件上传
const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  },
  fileFilter: (req, file, cb) => {
    // 允许的文件类型
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      'text/plain', 'text/markdown', 'application/json',
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error(`不支持的文件类型: ${file.mimetype}`), false)
    }
  }
})

/**
 * 上传单个文件并返回OSS URL
 * POST /api/generate/pod2post/upload-and-return-url
 *
 * Body参数 (multipart/form-data):
 * - file: 文件 (必填)
 * - task_id: 任务ID (必填)
 * - folder: 文件夹路径 (可选，默认: '')
 * - token: 用户token (可选)
 */
router.post('/',
  upload.single('file'),
  authenticateUserOrDefault,
  async (req, res) => {
    const { task_id, folder = '', token } = req.body
    const uploadedFile = req.file

    console.log('[Pod2PostUploadAndReturnUrl] ==================== UPLOAD REQUEST ====================')
    console.log('[Pod2PostUploadAndReturnUrl] Task ID:', task_id)
    console.log('[Pod2PostUploadAndReturnUrl] Folder:', folder)
    console.log('[Pod2PostUploadAndReturnUrl] File:', uploadedFile?.originalname)
    console.log('[Pod2PostUploadAndReturnUrl] File size:', uploadedFile?.size)
    console.log('[Pod2PostUploadAndReturnUrl] Token:', token ? `${token.substring(0, 15)}...` : 'none')

    try {
      // 1. 参数验证
      if (!task_id || !task_id.startsWith('pod2post_')) {
        return res.status(400).json({
          code: 400,
          success: false,
          message: '参数错误: task_id 格式不正确，应为 pod2post_{timestamp}_{random}'
        })
      }

      if (!uploadedFile) {
        return res.status(400).json({
          code: 400,
          success: false,
          message: '参数错误: 未找到上传的文件'
        })
      }

      // 2. 处理用户认证
      let targetUser = req.user

      if (token) {
        const tokenUser = await userService.findUserByToken(token)
        if (tokenUser) {
          targetUser = tokenUser
          console.log(`[Pod2PostUploadAndReturnUrl] Using token-specified user: ${tokenUser.username}`)
        }
      }

      // 3. 初始化OSS服务
      let ossService
      try {
        ossService = new OSSService('default')
        console.log('[Pod2PostUploadAndReturnUrl] OSS service initialized')
      } catch (error) {
        console.error('[Pod2PostUploadAndReturnUrl] OSS initialization failed:', error)
        return res.status(500).json({
          code: 500,
          success: false,
          message: 'OSS服务初始化失败',
          error: error.message
        })
      }

      // 4. 构建OSS路径
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const fileName = `${timestamp}_${uploadedFile.originalname}`
      const ossPathParts = ['pod2post', targetUser.username, task_id]

      if (folder) {
        // 清理并添加文件夹路径
        const cleanFolder = folder.replace(/^\/+|\/+$/g, '').replace(/\\/g, '/')
        ossPathParts.push(...cleanFolder.split('/'))
      }

      ossPathParts.push(fileName)
      const ossPath = ossPathParts.join('/')

      console.log('[Pod2PostUploadAndReturnUrl] OSS path:', ossPath)

      // 5. 上传到OSS
      let uploadResult
      try {
        // 使用Buffer上传
        uploadResult = await ossService.uploadBuffer(uploadedFile.buffer, ossPath, {
          headers: {
            'Content-Type': uploadedFile.mimetype,
            'Cache-Control': 'public, max-age=31536000',
            'Content-Disposition': `inline; filename="${encodeURIComponent(uploadedFile.originalname)}"`
          }
        })

        console.log('[Pod2PostUploadAndReturnUrl] OSS upload success:', uploadResult.url)
      } catch (error) {
        console.error('[Pod2PostUploadAndReturnUrl] OSS upload failed:', error)
        return res.status(500).json({
          code: 500,
          success: false,
          message: '文件上传到OSS失败',
          error: error.message
        })
      }

      // 6. 生成带签名的访问URL（长期有效）
      let publicUrl
      try {
        // 生成一个长期有效的签名URL（例如：10年）
        const signedResult = await ossService.generateSignedUrl(ossPath, 10 * 365 * 24 * 3600) // 10年
        publicUrl = signedResult.url || signedResult
        console.log('[Pod2PostUploadAndReturnUrl] Signed URL generated:', publicUrl.substring(0, 100) + '...')
      } catch (urlError) {
        console.warn('[Pod2PostUploadAndReturnUrl] Failed to generate signed URL:', urlError.message)
        // 如果生成签名URL失败，使用OSS返回的基础URL
        publicUrl = uploadResult.url
      }

      // 7. 保存文件记录到本地（可选）
      try {
        const taskPath = userService.getUserCardPath(targetUser.username, task_id)
        const recordPath = path.join(taskPath, 'upload_records.json')

        let records = []
        try {
          const existingData = await fs.readFile(recordPath, 'utf-8')
          records = JSON.parse(existingData)
        } catch {
          // 文件不存在，使用空数组
        }

        // 添加新记录
        records.push({
          originalName: uploadedFile.originalname,
          ossPath: ossPath,
          ossUrl: uploadResult.url,
          size: uploadedFile.size,
          mimetype: uploadedFile.mimetype,
          uploadedAt: new Date().toISOString(),
          folder: folder
        })

        // 保存记录
        await fs.writeFile(recordPath, JSON.stringify(records, null, 2))
        console.log('[Pod2PostUploadAndReturnUrl] Upload record saved')
      } catch (recordError) {
        console.warn('[Pod2PostUploadAndReturnUrl] Failed to save upload record:', recordError.message)
      }

      // 8. 返回成功响应
      res.json({
        code: 200,
        success: true,
        message: '文件上传成功',
        data: {
          originalName: uploadedFile.originalname,
          ossPath: ossPath,
          ossUrl: uploadResult.url,  // OSS返回的基础URL
          publicUrl: publicUrl,      // 带签名的可访问URL（长期有效）
          size: uploadedFile.size,
          mimetype: uploadedFile.mimetype,
          uploadedAt: new Date().toISOString(),
          taskId: task_id,
          folder: folder,
          username: targetUser.username,
          etag: uploadResult.etag
        }
      })

    } catch (error) {
      console.error('[Pod2PostUploadAndReturnUrl] Upload failed:', error)
      return res.status(500).json({
        code: 500,
        success: false,
        message: '文件上传失败',
        error: process.env.NODE_ENV === 'development' ? error.message : '服务器内部错误'
      })
    }
  }
)

/**
 * 批量上传文件并返回OSS URL列表
 * POST /api/generate/pod2post/batch-upload-and-return-url
 *
 * Body参数 (multipart/form-data):
 * - files: 多个文件 (必填)
 * - task_id: 任务ID (必填)
 * - folder: 文件夹路径 (可选)
 * - token: 用户token (可选)
 */
router.post('/batch-upload-and-return-url',
  upload.array('files', 20), // 最多20个文件
  authenticateUserOrDefault,
  async (req, res) => {
    const { task_id, folder = '', token } = req.body
    const uploadedFiles = req.files || []

    console.log('[Pod2PostBatchUpload] ==================== BATCH UPLOAD REQUEST ====================')
    console.log('[Pod2PostBatchUpload] Task ID:', task_id)
    console.log('[Pod2PostBatchUpload] Folder:', folder)
    console.log('[Pod2PostBatchUpload] Files count:', uploadedFiles.length)
    console.log('[Pod2PostBatchUpload] Token:', token ? `${token.substring(0, 15)}...` : 'none')

    try {
      // 参数验证
      if (!task_id || !task_id.startsWith('pod2post_')) {
        return res.status(400).json({
          code: 400,
          success: false,
          message: '参数错误: task_id 格式不正确'
        })
      }

      if (uploadedFiles.length === 0) {
        return res.status(400).json({
          code: 400,
          success: false,
          message: '参数错误: 未找到上传的文件'
        })
      }

      // 处理用户认证
      let targetUser = req.user
      if (token) {
        const tokenUser = await userService.findUserByToken(token)
        if (tokenUser) {
          targetUser = tokenUser
        }
      }

      // 初始化OSS服务
      let ossService
      try {
        ossService = new OSSService('default')
      } catch (error) {
        return res.status(500).json({
          code: 500,
          success: false,
          message: 'OSS服务初始化失败'
        })
      }

      // 批量上传
      const results = []
      const errors = []

      for (const [index, file] of uploadedFiles.entries()) {
        try {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
          const fileName = `${timestamp}_${file.originalname}`
          const ossPathParts = ['pod2post', targetUser.username, task_id]

          if (folder) {
            const cleanFolder = folder.replace(/^\/+|\/+$/g, '').replace(/\\/g, '/')
            ossPathParts.push(...cleanFolder.split('/'))
          }

          ossPathParts.push(fileName)
          const ossPath = ossPathParts.join('/')

          // 上传到OSS
          const uploadResult = await ossService.uploadBuffer(file.buffer, ossPath, {
            headers: {
              'Content-Type': file.mimetype,
              'Cache-Control': 'public, max-age=31536000'
            }
          })

          // 生成带签名的访问URL（长期有效）
          let publicUrl
          try {
            const signedResult = await ossService.generateSignedUrl(ossPath, 10 * 365 * 24 * 3600) // 10年
            publicUrl = signedResult.url || signedResult
          } catch (urlError) {
            publicUrl = uploadResult.url
          }

          results.push({
            originalName: file.originalname,
            ossPath: ossPath,
            ossUrl: uploadResult.url,  // OSS返回的基础URL
            publicUrl: publicUrl,      // 带签名的可访问URL
            size: file.size,
            mimetype: file.mimetype,
            uploadedAt: new Date().toISOString()
          })

          console.log(`[Pod2PostBatchUpload] Uploaded ${index + 1}/${uploadedFiles.length}: ${file.originalname}`)
        } catch (error) {
          console.error(`[Pod2PostBatchUpload] Failed to upload ${file.originalname}:`, error.message)
          errors.push({
            originalName: file.originalname,
            error: error.message
          })
        }
      }

      // 返回结果
      res.json({
        code: 200,
        success: true,
        message: `批量上传完成: ${results.length} 成功, ${errors.length} 失败`,
        data: {
          taskId: task_id,
          folder: folder,
          username: targetUser.username,
          uploaded: results,
          failed: errors
        }
      })

    } catch (error) {
      console.error('[Pod2PostBatchUpload] Batch upload failed:', error)
      return res.status(500).json({
        code: 500,
        success: false,
        message: '批量上传失败',
        error: error.message
      })
    }
  }
)

export default router