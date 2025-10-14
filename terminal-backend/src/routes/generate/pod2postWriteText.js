/**
 * Pod2Post 文本文件写入接口
 *
 * 功能: 在 card/{task_id}/ 目录下写入文本文件，并可选择上传到OSS
 * 用途: 支持修改或添加 async 生成任务的文本文件，返回可下载的OSS链接
 *
 * @author AI Terminal Team
 * @version 1.1.0
 * @created 2025-10-11
 * @updated 2025-10-11 - 修改为写入 card 目录，与 async 生成接口一致
 * @updated 2025-01-13 - 增加OSS上传功能，返回下载链接
 */

import express from 'express'
import path from 'path'
import fs from 'fs/promises'
import { authenticateUserOrDefault } from '../../middleware/userAuth.js'
import userService from '../../services/userService.js'
import { OSSService } from '../../services/oss/index.cjs'

const router = express.Router()

/**
 * 获取任务目录路径
 * @param {string} username - 用户名
 * @param {string} taskId - 任务ID
 * @returns {string} 任务目录的绝对路径（card 目录下的任务文件夹）
 */
async function getTaskPath(username, taskId) {
  // 直接使用 card 路径，与 async 生成接口保持一致
  return userService.getUserCardPath(username, taskId)
}

/**
 * 验证文件名安全性
 * @param {string} filename - 文件名
 * @returns {boolean} 是否安全
 */
function isFilenameSafe(filename) {
  // 禁止路径遍历和特殊字符
  const dangerous = [
    '..',           // 路径遍历
    '~',            // Home 目录
    '\\',           // 反斜杠
    '\0',           // Null 字符
    '<', '>', '|',  // 系统命令
    ':', '*', '?',  // 通配符（Windows）
    '"'             // 引号
  ]

  // 检查是否包含危险字符
  if (dangerous.some(char => filename.includes(char))) {
    return false
  }

  // 不允许绝对路径
  if (filename.startsWith('/') || /^[a-zA-Z]:/.test(filename)) {
    return false
  }

  return true
}

/**
 * 根据文件扩展名获取Content-Type
 * @param {string} filename - 文件名
 * @returns {string} Content-Type
 */
function getContentType(filename) {
  const ext = path.extname(filename).toLowerCase()
  const mimeTypes = {
    '.txt': 'text/plain; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.htm': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
    '.csv': 'text/csv; charset=utf-8',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp'
  }

  return mimeTypes[ext] || 'application/octet-stream'
}

/**
 * 文本文件写入接口
 * POST /api/generate/pod2post/write-text
 *
 * Body参数:
 * - task_id: 任务ID（必填，格式: pod2post_{timestamp}_{random}）
 * - filename: 文件名（必填，带后缀）
 * - content: 文本内容（必填）
 * - token: 用户token（可选，不传使用default用户）
 * - upload_to_oss: 是否上传到OSS（可选，默认true）
 * - return_oss_url: 是否返回OSS URL（可选，默认true）
 */
router.post('/',
  authenticateUserOrDefault,
  async (req, res) => {

  const {
    task_id,
    filename,
    content,
    token,
    upload_to_oss = true,  // 默认上传到OSS
    return_oss_url = true  // 默认返回OSS URL
  } = req.body

  console.log('[Pod2PostWriteText] ==================== WRITE REQUEST ====================')
  console.log('[Pod2PostWriteText] Task ID:', task_id)
  console.log('[Pod2PostWriteText] Filename:', filename)
  console.log('[Pod2PostWriteText] Content length:', content?.length)
  console.log('[Pod2PostWriteText] Token:', token ? `${token.substring(0, 15)}...` : 'none')

  try {
    // 1. 参数验证
    if (!task_id || !task_id.startsWith('pod2post_')) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '参数错误: task_id 格式不正确，应为 pod2post_{timestamp}_{random}'
      })
    }

    if (!filename || typeof filename !== 'string' || filename.trim().length === 0) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '参数错误: filename 不能为空'
      })
    }

    if (!isFilenameSafe(filename)) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '参数错误: filename 包含不安全字符'
      })
    }

    if (content === undefined || content === null) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '参数错误: content 不能为空'
      })
    }

    // 2. 内容大小限制（10MB）
    const MAX_CONTENT_SIZE = 10 * 1024 * 1024
    if (content.length > MAX_CONTENT_SIZE) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: `参数错误: 内容过大，最大支持 ${MAX_CONTENT_SIZE / 1024 / 1024}MB`
      })
    }

    // 3. 处理用户认证（支持 body.token 覆盖认证中间件）
    let targetUser = req.user  // 默认使用中间件认证的用户

    if (token) {
      console.log(`[Pod2PostWriteText] Body token provided: ${token}`)
      const tokenUser = await userService.findUserByToken(token)
      if (tokenUser) {
        targetUser = tokenUser
        console.log(`[Pod2PostWriteText] Using token-specified user: ${tokenUser.username}`)
      } else {
        console.log(`[Pod2PostWriteText] Invalid token, using middleware user: ${req.user.username}`)
      }
    }

    // 4. 计算目标路径
    const taskPath = await getTaskPath(targetUser.username, task_id)
    const filePath = path.join(taskPath, filename)

    console.log('[Pod2PostWriteText] Target path:', taskPath)
    console.log('[Pod2PostWriteText] File path:', filePath)

    // 5. 确保目录存在（支持子目录）
    const fileDir = path.dirname(filePath)
    await fs.mkdir(fileDir, { recursive: true })

    // 6. 检查文件是否已存在
    let isNew = true
    try {
      await fs.access(filePath)
      isNew = false
      console.log(`[Pod2PostWriteText] File exists, will overwrite: ${filename}`)
    } catch {
      console.log(`[Pod2PostWriteText] Creating new file: ${filename}`)
    }

    // 7. 写入文件（覆盖模式）
    await fs.writeFile(filePath, content, 'utf-8')

    // 8. 获取文件信息
    const stats = await fs.stat(filePath)

    console.log(`[Pod2PostWriteText] File written successfully: ${filePath}`)
    console.log(`[Pod2PostWriteText] File size: ${stats.size} bytes`)

    // 9. 如果需要上传到OSS
    let ossInfo = null
    if (upload_to_oss) {
      try {
        console.log('[Pod2PostWriteText] Starting OSS upload...')

        // 初始化OSS服务
        const ossService = new OSSService('default')

        // 构建OSS路径
        const ossPath = `pod2post/${targetUser.username}/${task_id}/${filename}`

        // 上传文件到OSS
        const uploadResult = await ossService.upload(filePath, {
          remotePath: ossPath,  // 指定远程路径，避免自动生成时间戳
          headers: {
            'Content-Type': getContentType(filename),
            'Cache-Control': 'public, max-age=31536000',
            'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`
          }
        })

        // 生成下载URL（长期有效）
        let downloadUrl = null
        if (return_oss_url) {
          try {
            const signedResult = await ossService.generateSignedUrl(ossPath, 10 * 365 * 24 * 3600) // 10年
            downloadUrl = signedResult.url || signedResult
            console.log('[Pod2PostWriteText] Download URL generated successfully')
          } catch (urlError) {
            console.warn('[Pod2PostWriteText] Failed to generate download URL:', urlError.message)
          }
        }

        ossInfo = {
          ossPath: ossPath,
          ossUrl: uploadResult.url,
          downloadUrl: downloadUrl,
          uploadedAt: new Date().toISOString()
        }

        console.log(`[Pod2PostWriteText] OSS upload success: ${ossPath}`)

      } catch (ossError) {
        console.error('[Pod2PostWriteText] OSS upload failed:', ossError.message)
        // OSS上传失败不影响主流程，继续返回本地写入成功
      }
    }

    // 10. 返回成功响应
    const responseData = {
      filename,
      path: filePath,
      size: stats.size,
      isNew,
      taskId: task_id,
      username: targetUser.username,
      createdAt: stats.birthtime.toISOString(),
      modifiedAt: stats.mtime.toISOString()
    }

    // 如果有OSS信息，添加到响应中
    if (ossInfo) {
      responseData.oss = ossInfo
      // 为了向后兼容，也将OSS信息放在顶层
      if (ossInfo.downloadUrl) {
        responseData.downloadUrl = ossInfo.downloadUrl
      }
      responseData.ossPath = ossInfo.ossPath
      responseData.ossUrl = ossInfo.ossUrl
    }

    // 构建成功消息
    let successMessage = isNew ? '文件写入成功' : '文件覆盖成功'
    if (ossInfo) {
      successMessage += ossInfo.downloadUrl ? '并已生成下载链接' : '并已上传到OSS'
    }

    res.json({
      code: 200,
      success: true,
      message: successMessage,
      data: responseData
    })

  } catch (error) {
    console.error('[Pod2PostWriteText] Write failed:', error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: error.message || '文件写入失败'
    })
  }
})

export default router
