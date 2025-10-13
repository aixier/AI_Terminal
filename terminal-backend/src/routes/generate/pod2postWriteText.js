/**
 * Pod2Post 文本文件写入接口
 *
 * 功能: 在 card/{task_id}/ 目录下写入文本文件
 * 用途: 支持修改或添加 async 生成任务的文本文件
 *
 * @author AI Terminal Team
 * @version 1.0.1
 * @created 2025-10-11
 * @updated 2025-10-11 - 修改为写入 card 目录，与 async 生成接口一致
 */

import express from 'express'
import path from 'path'
import fs from 'fs/promises'
import { authenticateUserOrDefault } from '../../middleware/userAuth.js'
import userService from '../../services/userService.js'

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
 * 文本文件写入接口
 * POST /api/generate/pod2post/write-text
 *
 * Body参数:
 * - task_id: 任务ID（必填，格式: pod2post_{timestamp}_{random}）
 * - filename: 文件名（必填，带后缀）
 * - content: 文本内容（必填）
 * - token: 用户token（可选，不传使用default用户）
 */
router.post('/',
  authenticateUserOrDefault,
  async (req, res) => {

  const { task_id, filename, content, token } = req.body

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

    // 9. 返回成功响应
    res.json({
      code: 200,
      success: true,
      message: isNew ? '文件写入成功' : '文件覆盖成功',
      data: {
        filename,
        path: filePath,
        size: stats.size,
        isNew,
        taskId: task_id,
        username: targetUser.username,
        createdAt: stats.birthtime.toISOString(),
        modifiedAt: stats.mtime.toISOString()
      }
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
