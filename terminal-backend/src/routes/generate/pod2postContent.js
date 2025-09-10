import express from 'express'
import fs from 'fs/promises'
import path from 'path'
import userService from '../../services/userService.js'
import { verifyToken, optionalAuth } from '../../middleware/auth.js'
const router = express.Router()

/**
 * GET /api/generate/pod2post/content/:folderName
 * 获取Pod2Post生成的内容
 * 支持用户隔离和token认证
 */
router.get('/:folderName', optionalAuth, async (req, res) => {
  try {
    const { folderName } = req.params
    const token = req.query.token || req.user?.token

    console.log(`[Pod2PostContent] 获取内容请求: ${folderName}`)
    console.log(`[Pod2PostContent] Token: ${token ? `${token.substring(0, 15)}...` : 'none'}`)

    // 验证文件夹名称
    if (!folderName || !folderName.startsWith('pod2post_')) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '无效的Pod2Post文件夹名称'
      })
    }

    // 获取用户信息
    const user = token ? await userService.findUserByToken(token) : null
    const username = user?.username || 'default'  // 无token时使用default用户

    console.log(`[Pod2PostContent] 用户: ${username}`)

    // 构建文件路径
    const userWorkspace = userService.getUserWorkspacePath(username)
    const folderPath = path.join(userWorkspace.cardPath, folderName)

    console.log(`[Pod2PostContent] 文件夹路径: ${folderPath}`)

    // 检查文件夹是否存在
    try {
      await fs.access(folderPath)
    } catch (error) {
      console.log(`[Pod2PostContent] 文件夹不存在: ${folderPath}`)
      return res.status(404).json({
        code: 404,
        success: false,
        message: `文件夹不存在: ${folderName}`
      })
    }

    // 读取文件夹内容
    const files = await fs.readdir(folderPath)
    console.log(`[Pod2PostContent] 找到文件: ${files.length}个`)

    const result = {
      folderName,
      folderPath,
      allFiles: [],
      htmlFiles: [],
      jsonFiles: [],
      otherFiles: [],
      pod2postFiles: {
        original: null,
        withBase64: null,
        metadata: null
      }
    }

    // 不再实时上传OSS，只收集文件信息
    
    for (const fileName of files) {
      const filePath = path.join(folderPath, fileName)
      const stats = await fs.stat(filePath)

      // 跳过目录
      if (stats.isDirectory()) {
        continue
      }

      const fileInfo = {
        fileName,
        size: stats.size,
        mtime: stats.mtime.toISOString(),
        ossUrl: null  // 将从meta中获取OSS链接
      }

      result.allFiles.push(fileInfo)

      // 分类文件
      const ext = path.extname(fileName).toLowerCase()
      
      if (ext === '.html') {
        result.htmlFiles.push(fileInfo)
        
        // 特殊识别Pod2Post文件
        if (fileName === 'index.html') {
          result.pod2postFiles.original = fileName
        } else if (fileName.includes('base64')) {
          result.pod2postFiles.withBase64 = fileName
        }
        
      } else if (ext === '.json') {
        result.jsonFiles.push(fileInfo)
        
        // 识别元数据文件
        if (fileName.includes('meta')) {
          result.pod2postFiles.metadata = fileName
        }
        
      } else {
        result.otherFiles.push(fileInfo)
      }
    }

    // 从固定的meta文件读取所有信息
    const metaFilePath = path.join(folderPath, `${folderName}_meta.json`)
    let contentData = {}
    
    try {
      // 读取meta文件
      const metaFileContent = await fs.readFile(metaFilePath, 'utf8')
      const metadataContent = JSON.parse(metaFileContent)
      console.log(`[Pod2PostContent] Meta文件加载成功: ${folderName}_meta.json`)
      
      // 构建内容数据
      contentData = {
        // 完整的元数据
        metadata: metadataContent,
        
        // OSS链接和文件信息
        ...(metadataContent.custom?.ossUpload ? {
          originalHtmlOssUrl: metadataContent.custom.ossUpload.urls?.originalHtml,
          base64HtmlOssUrl: metadataContent.custom.ossUpload.urls?.withBase64,
          metadataOssUrl: metadataContent.custom.ossUpload.urls?.metadata,
          contentJsonOssUrl: metadataContent.custom.ossUpload.urls?.contentJson,  // 新增
          otherFilesOssUrls: metadataContent.custom.ossUpload.urls?.otherFiles || [],  // 新增
          originalHtmlSize: metadataContent.custom.ossUpload.fileSizes?.originalHtml,
          base64HtmlSize: metadataContent.custom.ossUpload.fileSizes?.withBase64,
          metadataSize: metadataContent.custom.ossUpload.fileSizes?.metadata,
          contentJsonSize: metadataContent.custom.ossUpload.fileSizes?.contentJson,  // 新增
          otherFilesSizes: metadataContent.custom.ossUpload.fileSizes?.otherFiles || [],  // 新增
          ossUploadSuccess: metadataContent.custom.ossUpload.success,
          ossUploadedAt: metadataContent.custom.ossUpload.uploadedAt
        } : {}),
        
        // 任务状态和阶段
        status: metadataContent.execution?.finalStatus,
        phases: metadataContent.custom?.phases,
        
        // 生成的文件信息
        generatedFiles: metadataContent.custom?.generatedFiles
      }
      
      if (contentData.originalHtmlOssUrl || contentData.base64HtmlOssUrl) {
        console.log(`[Pod2PostContent] OSS链接已从meta获取`)
        console.log(`[Pod2PostContent] - 原始HTML: ${contentData.originalHtmlOssUrl ? '✓' : '✗'}`)
        console.log(`[Pod2PostContent] - Base64 HTML: ${contentData.base64HtmlOssUrl ? '✓' : '✗'}`)
        console.log(`[Pod2PostContent] - 元数据: ${contentData.metadataOssUrl ? '✓' : '✗'}`)
      }
      
    } catch (error) {
      console.error(`[Pod2PostContent] 读取meta文件失败: ${error.message}`)
      contentData.error = 'Meta文件不存在或损坏'
    }

    console.log(`[Pod2PostContent] 内容获取成功`)
    console.log(`[Pod2PostContent] - HTML文件: ${result.htmlFiles.length}个`)
    console.log(`[Pod2PostContent] - JSON文件: ${result.jsonFiles.length}个`)
    console.log(`[Pod2PostContent] - 其他文件: ${result.otherFiles.length}个`)

    res.json({
      code: 200,
      success: true,
      data: {
        ...result,
        content: contentData
      },
      message: 'Pod2Post内容获取成功'
    })

  } catch (error) {
    console.error('[Pod2PostContent] 错误:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '获取Pod2Post内容失败',
      error: process.env.NODE_ENV === 'development' ? error.message : '服务器内部错误'
    })
  }
})

export default router