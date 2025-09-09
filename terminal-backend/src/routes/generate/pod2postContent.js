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

    // 处理每个文件
    for (const fileName of files) {
      const filePath = path.join(folderPath, fileName)
      const stats = await fs.stat(filePath)

      const fileInfo = {
        fileName,
        size: stats.size,
        mtime: stats.mtime.toISOString(),
        isDirectory: stats.isDirectory()
      }

      // 跳过目录
      if (stats.isDirectory()) {
        continue
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

    // 读取主要文件内容
    const contentData = {}

    // 读取原始HTML
    if (result.pod2postFiles.original) {
      try {
        const htmlPath = path.join(folderPath, result.pod2postFiles.original)
        const htmlStats = await fs.stat(htmlPath)
        
        // 如果文件小于5MB，直接读取
        if (htmlStats.size < 5 * 1024 * 1024) {
          contentData.originalHtml = await fs.readFile(htmlPath, 'utf8')
          console.log(`[Pod2PostContent] 直接读取原始HTML: ${result.pod2postFiles.original} (${htmlStats.size} bytes)`)
        } else {
          // 大文件上传到OSS
          console.log(`[Pod2PostContent] 原始HTML较大，上传到OSS: ${result.pod2postFiles.original} (${htmlStats.size} bytes)`)
          
          const ossKey = `pod2post/${username}/${folderName}/${result.pod2postFiles.original}`
          const uploadResult = await ossService.client.uploadFile(htmlPath, ossKey, {
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'public, max-age=31536000',
              'Content-Disposition': `attachment; filename="${result.pod2postFiles.original}"`
            }
          })
          
          if (uploadResult.success) {
            const signedUrlResult = await ossService.client.generateSignedUrl(ossKey, 3600 * 24 * 365)
            
            contentData.originalHtmlOssUrl = signedUrlResult.url
            contentData.originalHtmlSize = htmlStats.size
            console.log(`[Pod2PostContent] 原始HTML OSS上传成功: ${signedUrlResult.url}`)
          } else {
            throw new Error(`OSS上传失败: ${uploadResult.error}`)
          }
        }
      } catch (error) {
        console.warn(`[Pod2PostContent] 处理原始HTML失败: ${error.message}`)
        contentData.originalHtmlError = error.message
      }
    }

    // 读取Base64版本HTML
    if (result.pod2postFiles.withBase64) {
      try {
        const base64Path = path.join(folderPath, result.pod2postFiles.withBase64)
        const base64Stats = await fs.stat(base64Path)
        
        // 如果文件小于5MB，直接读取并返回内容
        if (base64Stats.size < 5 * 1024 * 1024) {
          contentData.base64Html = await fs.readFile(base64Path, 'utf8')
          console.log(`[Pod2PostContent] 直接读取Base64 HTML: ${result.pod2postFiles.withBase64} (${base64Stats.size} bytes)`)
        } else {
          // 大文件上传到OSS
          console.log(`[Pod2PostContent] 文件较大，上传到OSS: ${result.pod2postFiles.withBase64} (${base64Stats.size} bytes)`)
          
          // 生成OSS路径
          const ossKey = `pod2post/${username}/${folderName}/${result.pod2postFiles.withBase64}`
          
          // 上传到OSS
          const uploadResult = await ossService.client.uploadFile(base64Path, ossKey, {
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'public, max-age=31536000', // 缓存一年
              'Content-Disposition': `attachment; filename="${result.pod2postFiles.withBase64}"`
            }
          })
          
          if (uploadResult.success) {
            // 获取永久访问URL
            const signedUrlResult = await ossService.client.generateSignedUrl(ossKey, 3600 * 24 * 365)
            
            contentData.base64HtmlOssUrl = signedUrlResult.url
            contentData.base64HtmlSize = base64Stats.size
            console.log(`[Pod2PostContent] OSS上传成功，下载地址: ${signedUrlResult.url}`)
            
            // 提供预览（前50KB）
            const buffer = Buffer.alloc(50000)
            const fd = await fs.open(base64Path, 'r')
            const { bytesRead } = await fd.read(buffer, 0, 50000, 0)
            await fd.close()
            contentData.base64HtmlPreview = buffer.slice(0, bytesRead).toString('utf8')
          } else {
            throw new Error(`OSS上传失败: ${uploadResult.error}`)
          }
        }
      } catch (error) {
        console.warn(`[Pod2PostContent] 处理Base64 HTML失败: ${error.message}`)
        contentData.base64HtmlError = error.message
      }
    }

    // 读取元数据
    if (result.pod2postFiles.metadata) {
      try {
        const metaPath = path.join(folderPath, result.pod2postFiles.metadata)
        const metaContent = await fs.readFile(metaPath, 'utf8')
        contentData.metadata = JSON.parse(metaContent)
        console.log(`[Pod2PostContent] 读取元数据: ${result.pod2postFiles.metadata}`)
      } catch (error) {
        console.warn(`[Pod2PostContent] 读取元数据失败: ${error.message}`)
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