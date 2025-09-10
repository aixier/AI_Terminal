import express from 'express'
import fs from 'fs/promises'
import path from 'path'
import userService from '../../services/userService.js'
import { verifyToken, optionalAuth } from '../../middleware/auth.js'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { OSSService } = require('../../services/oss/index.cjs')

const router = express.Router()

// 初始化OSS服务
const ossService = new OSSService('ai-terminal')

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
    const username = user?.username || 'public'

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

    // 处理每个文件并上传到OSS
    const fileOssUrls = {} // 存储所有文件的OSS URL
    
    for (const fileName of files) {
      const filePath = path.join(folderPath, fileName)
      const stats = await fs.stat(filePath)

      // 跳过目录
      if (stats.isDirectory()) {
        continue
      }

      // 上传到OSS
      try {
        const ossKey = `pod2post/${username}/${folderName}/${fileName}`
        const mimeType = getMimeType(fileName)
        
        const uploadResult = await ossService.client.uploadFile(filePath, ossKey, {
          headers: {
            'Content-Type': mimeType,
            'Cache-Control': 'public, max-age=31536000',
            'Content-Disposition': `attachment; filename="${fileName}"`
          }
        })
        
        if (uploadResult.success) {
          const signedUrlResult = await ossService.client.generateSignedUrl(ossKey, 3600 * 24 * 365)
          fileOssUrls[fileName] = signedUrlResult.url
          console.log(`[Pod2PostContent] 文件上传OSS成功: ${fileName}`)
        }
      } catch (error) {
        console.warn(`[Pod2PostContent] 文件上传OSS失败: ${fileName}, ${error.message}`)
      }

      const fileInfo = {
        fileName,
        size: stats.size,
        mtime: stats.mtime.toISOString(),
        ossUrl: fileOssUrls[fileName] || null
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
    
    // 辅助函数：获取MIME类型
    function getMimeType(fileName) {
      const ext = path.extname(fileName).toLowerCase()
      const mimeTypes = {
        '.html': 'text/html; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.txt': 'text/plain; charset=utf-8',
        '.md': 'text/markdown; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml'
      }
      return mimeTypes[ext] || 'application/octet-stream'
    }

    // 读取主要文件内容
    const contentData = {}

    // 设置原始HTML的OSS链接
    if (result.pod2postFiles.original && fileOssUrls[result.pod2postFiles.original]) {
      contentData.originalHtmlOssUrl = fileOssUrls[result.pod2postFiles.original]
      const fileInfo = result.allFiles.find(f => f.fileName === result.pod2postFiles.original)
      if (fileInfo) {
        contentData.originalHtmlSize = fileInfo.size
      }
      console.log(`[Pod2PostContent] 原始HTML OSS链接: ${contentData.originalHtmlOssUrl}`)
    }

    // 设置Base64版本HTML的OSS链接
    if (result.pod2postFiles.withBase64) {
      if (fileOssUrls[result.pod2postFiles.withBase64]) {
        contentData.base64HtmlOssUrl = fileOssUrls[result.pod2postFiles.withBase64]
        const fileInfo = result.allFiles.find(f => f.fileName === result.pod2postFiles.withBase64)
        if (fileInfo) {
          contentData.base64HtmlSize = fileInfo.size
        }
        console.log(`[Pod2PostContent] Base64 HTML OSS链接: ${contentData.base64HtmlOssUrl}`)
        
        // 提供预览（前50KB）
        try {
          const base64Path = path.join(folderPath, result.pod2postFiles.withBase64)
          const buffer = Buffer.alloc(50000)
          const fd = await fs.open(base64Path, 'r')
          const { bytesRead } = await fd.read(buffer, 0, 50000, 0)
          await fd.close()
          contentData.base64HtmlPreview = buffer.slice(0, bytesRead).toString('utf8')
        } catch (error) {
          console.warn(`[Pod2PostContent] 读取预览失败: ${error.message}`)
        }
      }
    }

    // 设置元数据的OSS链接
    if (result.pod2postFiles.metadata) {
      if (fileOssUrls[result.pod2postFiles.metadata]) {
        contentData.metadataOssUrl = fileOssUrls[result.pod2postFiles.metadata]
        const fileInfo = result.allFiles.find(f => f.fileName === result.pod2postFiles.metadata)
        if (fileInfo) {
          contentData.metadataSize = fileInfo.size
        }
        console.log(`[Pod2PostContent] 元数据OSS链接: ${contentData.metadataOssUrl}`)
        
        // 仍然读取内容供直接使用
        try {
          const metaPath = path.join(folderPath, result.pod2postFiles.metadata)
          const metaContent = await fs.readFile(metaPath, 'utf8')
          contentData.metadata = JSON.parse(metaContent)
        } catch (error) {
          console.warn(`[Pod2PostContent] 读取元数据失败: ${error.message}`)
        }
      }
    }

    // 分析Base64嵌入情况
    if (contentData.base64Html || contentData.base64HtmlPreview) {
      const htmlContent = contentData.base64Html || contentData.base64HtmlPreview || ''
      
      const base64Images = htmlContent.match(/data:image[^"']+/g) || []
      const unconvertedPaths = htmlContent.match(/src="\/app\/data\/users[^"]+"/g) || []
      
      contentData.base64Analysis = {
        base64ImageCount: base64Images.length,
        unconvertedPathCount: unconvertedPaths.length,
        conversionSuccess: unconvertedPaths.length === 0,
        sampleUnconvertedPaths: unconvertedPaths.slice(0, 3)
      }
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