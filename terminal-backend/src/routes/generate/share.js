/**
 * 分享相关路由
 * 代理小红书分享API调用以解决CORS问题
 */

import express from 'express'
import fetch from 'node-fetch'
import logger from '../../utils/logger.js'

const router = express.Router()

/**
 * POST /api/generate/share/xiaohongshu
 * 代理调用Engagia小红书分享API
 */
router.post('/xiaohongshu', async (req, res) => {
  try {
    const { html, pageinfo, name } = req.body
    
    if (!html) {
      return res.status(400).json({
        success: false,
        message: 'HTML内容是必需的'
      })
    }
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: '文件名(name)是必需的'
      })
    }
    
    // 准备请求体
    const requestBody = { 
      html,
      name  // 添加name参数
    }
    if (pageinfo) {
      requestBody.pageinfo = pageinfo
    }
    
    logger.info('[ShareXHS] 代理请求到Engagia API', {
      hasHtml: !!requestBody.html,
      hasPageinfo: !!requestBody.pageinfo,
      fileName: requestBody.name
    })
    
    // 调用外部API
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
      throw new Error(`Engagia API错误: ${response.status} ${response.statusText}`)
    }
    
    const result = await response.json()
    
    logger.info('[ShareXHS] Engagia API响应成功', {
      success: result.success,
      hasData: !!result.data,
      shareLink: result.shareLink
    })
    
    // 标准化响应格式，确保前端能正确处理
    const standardizedResponse = {
      success: result.success,
      message: result.message || '处理完成',
      data: {
        // 核心分享数据
        title: result.extractedData?.title || result.data?.title || '',
        content: result.extractedData?.content || result.data?.content || '',
        hashtags: result.extractedData?.hashtags || result.data?.hashtags || [],
        
        // 图片资源
        images: result.extractedData?.images?.map(img => img.src) || [],
        cardCount: result.data?.cardCount || 0,
        
        // 分享链接 - 使用短链接
        shareLink: result.shareLink || result.data?.shortUrl || '',
        shortLink: result.data?.shortUrl || result.shareLink || '',
        
        // 其他信息
        fileId: result.fileId,
        qrCodeUrl: result.data?.qrCodeUrl || ''
      }
    }
    
    // 返回标准化结果
    res.json(standardizedResponse)
    
  } catch (error) {
    logger.error('[ShareXHS] 分享失败:', error)
    
    res.status(500).json({
      success: false,
      message: '分享失败: ' + error.message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
})

export default router