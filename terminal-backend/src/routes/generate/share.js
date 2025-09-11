/**
 * 分享相关路由
 * 优化版：后端直接读取文件，减少网络传输
 */

import express from 'express'
import fetch from 'node-fetch'
import fs from 'fs/promises'
import path from 'path'
import logger from '../../utils/logger.js'
import userService from '../../services/userService.js'

const router = express.Router()

/**
 * POST /api/generate/share/xiaohongshu
 * 优化版：后端直接读取文件，减少网络传输
 */
router.post('/xiaohongshu', async (req, res) => {
  try {
    // 支持两种模式：新模式（文件路径）和旧模式（HTML内容）
    const { folderName, fileName, username = 'default', html, pageinfo, name } = req.body
    
    let htmlContent = null
    let pageinfoContent = null
    let finalFileName = null
    
    // 新模式：通过文件路径读取
    if (folderName && fileName) {
      // 参数验证
      if (!fileName.toLowerCase().endsWith('.html') && !fileName.toLowerCase().endsWith('.htm')) {
        return res.status(400).json({
          success: false,
          message: '只能分享HTML文件'
        })
      }
      
      // 安全验证：防止路径穿越
      if (fileName.includes('..') || folderName.includes('..') || 
          fileName.includes('/') || fileName.includes('\\')) {
        return res.status(403).json({
          success: false,
          message: '非法文件路径'
        })
      }
      
      logger.info('[ShareXHS] 开始处理分享请求（文件模式）', {
        username,
        folderName,
        fileName
      })
      
      // 构建文件路径
      let userCardPath
      if (folderName === 'root-files' || folderName === 'root') {
        // root-files 表示文件在 card 根目录下或其子文件夹
        // 需要先查找文件所在的实际位置
        const { cardPath } = userService.getUserWorkspacePath(username)
        userCardPath = cardPath
        
        // 尝试在子文件夹中查找文件
        try {
          const dirs = await fs.readdir(cardPath)
          for (const dir of dirs) {
            const dirPath = path.join(cardPath, dir)
            const stat = await fs.stat(dirPath)
            if (stat.isDirectory()) {
              const filePath = path.join(dirPath, fileName)
              try {
                await fs.access(filePath)
                userCardPath = dirPath
                logger.info('[ShareXHS] 文件在子文件夹中找到', { folder: dir })
                break
              } catch {
                // 文件不在此文件夹，继续查找
              }
            }
          }
        } catch (error) {
          logger.warn('[ShareXHS] 扫描子文件夹失败', error)
        }
      } else {
        // 正常的文件夹名称
        userCardPath = userService.getUserCardPath(username, folderName)
      }
      
      const htmlFilePath = path.join(userCardPath, fileName)
      
      // 读取HTML文件
      try {
        htmlContent = await fs.readFile(htmlFilePath, 'utf8')
        finalFileName = fileName
        logger.info('[ShareXHS] HTML文件读取成功', {
          path: htmlFilePath,
          size: htmlContent.length
        })
      } catch (error) {
        logger.error('[ShareXHS] 文件读取失败:', error)
        return res.status(404).json({
          success: false,
          message: '文件不存在或无法读取'
        })
      }
      
      // 自动查找并读取pageinfo（如果存在包含content.json的文件）
      // 注意：由于Engagia API的bug，暂时完全跳过content.json
      const skipContentJson = true // 临时标志，待Engagia修复后可改为false
      
      if (!skipContentJson) {
        try {
          const files = await fs.readdir(userCardPath)
          
          // 查找包含content.json的文件（可以是xxx_content.json或content.json等）
          const contentJsonFile = files.find(f => f.includes('content.json'))
          
          if (contentJsonFile) {
          const jsonPath = path.join(userCardPath, contentJsonFile)
          const jsonContent = await fs.readFile(jsonPath, 'utf8')
          
          // 尝试转换字段格式以适配Engagia API
          try {
            const parsedJson = JSON.parse(jsonContent)
            
            // 将content.json转换为简单的schema（类似马斯克文件成功的格式）
            // 由于马斯克文件没有pageinfo也能成功，说明Engagia主要从HTML提取信息
            // 我们只需要提供最简单的结构即可
            
            // 检测是否是Pod2Post格式
            const isPod2PostFormat = parsedJson.title && 
                                    parsedJson.content && 
                                    typeof parsedJson.content === 'object' &&
                                    parsedJson.content.summary
            
            if (isPod2PostFormat) {
              // Pod2Post格式：转换为最简单的结构
              const simpleJson = {
                title: parsedJson.title,
                content: parsedJson.content.summary || '',
                hashtags: parsedJson.hashtag || parsedJson.hashtags || []
              }
              
              pageinfoContent = JSON.stringify(simpleJson)
              logger.info('[ShareXHS] Pod2Post content.json已转换为简单格式', { 
                file: contentJsonFile,
                title: simpleJson.title.substring(0, 20)
              })
            } else {
              // 其他格式：保持原样或简单映射
              const simpleJson = {
                title: parsedJson.title || parsedJson.post_title || '',
                content: parsedJson.content || parsedJson.post_content || '',
                hashtags: parsedJson.hashtag || parsedJson.hashtags || parsedJson.post_hashtags || []
              }
              
              pageinfoContent = JSON.stringify(simpleJson)
              logger.info('[ShareXHS] content.json已处理', { file: contentJsonFile })
            }
          } catch (parseError) {
            // 如果解析或转换失败，使用原始内容
            pageinfoContent = jsonContent
            logger.warn('[ShareXHS] JSON处理失败，使用原始内容', { error: parseError.message })
          }
        } else {
          logger.debug('[ShareXHS] 未找到content.json文件')
        }
        } catch (error) {
          // pageinfo是可选的，忽略错误
          logger.debug('[ShareXHS] 读取content.json失败', { error: error.message })
        }
      } else {
        logger.info('[ShareXHS] 跳过content.json读取（Engagia bug临时处理）')
      }
      
    } 
    // 旧模式：直接使用传入的HTML内容（向后兼容）
    else if (html) {
      if (!name) {
        return res.status(400).json({
          success: false,
          message: '文件名(name)是必需的'
        })
      }
      
      logger.info('[ShareXHS] 处理分享请求（传统模式）', {
        hasHtml: true,
        hasPageinfo: !!pageinfo,
        fileName: name
      })
      
      htmlContent = html
      pageinfoContent = pageinfo
      finalFileName = name
      
    } else {
      return res.status(400).json({
        success: false,
        message: '请提供文件路径或HTML内容'
      })
    }
    
    // 准备请求体
    const requestBody = {
      html: htmlContent,
      name: finalFileName  // Engagia需要文件名
    }
    if (pageinfoContent) {
      requestBody.pageinfo = pageinfoContent
    }
    
    logger.info('[ShareXHS] 准备转发到Engagia', {
      hasHtml: true,
      hasPageinfo: !!pageinfoContent,
      htmlSize: htmlContent.length,
      fileName: finalFileName
    })
    
    // 调用Engagia API
    const response = await fetch('http://engagia-s3.paitongai.net/api/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'AI-Terminal-Backend/1.0'
      },
      body: JSON.stringify(requestBody),
      timeout: 60000 // 60秒超时
    })
    
    if (!response.ok) {
      let errorMsg = `Engagia API错误: ${response.status}`
      try {
        const errorData = await response.json()
        if (errorData.message) {
          errorMsg = errorData.message
        }
      } catch (e) {
        // 无法解析错误响应
      }
      throw new Error(errorMsg)
    }
    
    const result = await response.json()
    
    logger.info('[ShareXHS] Engagia响应成功', {
      success: result.success,
      hasShareLink: !!result.shareLink
    })
    
    // 返回标准化响应
    res.json({
      success: true,
      message: '分享链接生成成功',
      data: {
        shareLink: result.shareLink || result.data?.shortUrl || '',
        // 以下字段前端当前未使用，但保留以备扩展
        title: result.extractedData?.title || '',
        content: result.extractedData?.content || '',
        hashtags: result.extractedData?.hashtags || [],
        images: result.extractedData?.images?.map(img => img.src) || []
      }
    })
    
  } catch (error) {
    logger.error('[ShareXHS] 分享处理失败:', error)
    
    res.status(500).json({
      success: false,
      message: error.message || '分享失败',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
})

export default router