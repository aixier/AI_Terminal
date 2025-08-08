/**
 * Preview API Routes
 * 提供多种网页预览方式的后端支持
 */

import express from 'express'
// import puppeteer from 'puppeteer' // 已移除，不再需要截图功能
import * as cheerio from 'cheerio'
import fetch from 'node-fetch'
import logger from '../utils/logger.js'

const router = express.Router()

// Puppeteer相关代码已移除
// 不再支持截图和内容抓取功能

/**
 * 获取网页元数据
 */
router.post('/metadata', async (req, res) => {
  const { url } = req.body
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' })
  }
  
  try {
    // 获取网页HTML
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })
    
    const html = await response.text()
    const $ = cheerio.load(html)
    
    // 提取元数据
    const metadata = {
      title: $('meta[property="og:title"]').attr('content') || 
             $('title').text() || 
             'Untitled',
      
      description: $('meta[property="og:description"]').attr('content') || 
                   $('meta[name="description"]').attr('content') || 
                   '',
      
      images: [],
      
      siteName: $('meta[property="og:site_name"]').attr('content') || 
                new URL(url).hostname,
      
      favicon: $('link[rel="icon"]').attr('href') || 
               $('link[rel="shortcut icon"]').attr('href'),
      
      author: $('meta[name="author"]').attr('content') || 
              $('meta[property="article:author"]').attr('content'),
      
      publishDate: $('meta[property="article:published_time"]').attr('content') || 
                   $('time').attr('datetime'),
      
      keywords: $('meta[name="keywords"]').attr('content')
    }
    
    // 收集图片
    const ogImage = $('meta[property="og:image"]').attr('content')
    if (ogImage) metadata.images.push(ogImage)
    
    // 小红书特殊处理
    if (url.includes('xiaohongshu.com')) {
      $('.note-image img, .feed-image img').each((i, el) => {
        const src = $(el).attr('src')
        if (src && metadata.images.length < 9) {
          metadata.images.push(src)
        }
      })
    }
    
    // 处理相对路径
    const baseUrl = new URL(url).origin
    if (metadata.favicon && !metadata.favicon.startsWith('http')) {
      metadata.favicon = new URL(metadata.favicon, baseUrl).href
    }
    metadata.images = metadata.images.map(img => {
      if (!img.startsWith('http')) {
        return new URL(img, baseUrl).href
      }
      return img
    })
    
    res.json(metadata)
    
  } catch (error) {
    logger.error('Failed to fetch metadata:', error)
    res.status(500).json({ error: 'Failed to fetch metadata' })
  }
})

/**
 * 获取网页内容（已禁用）
 */
router.post('/content', async (req, res) => {
  res.status(501).json({ 
    error: 'Content extraction feature has been disabled',
    message: '内容提取功能已禁用'
  })
})

/**
 * 生成网页截图（已禁用）
 */
router.post('/screenshot', async (req, res) => {
  res.status(501).json({ 
    error: 'Screenshot feature has been disabled',
    message: '截图功能已禁用'
  })
})

/**
 * 代理请求（用于解决CORS问题）
 */
router.post('/proxy', async (req, res) => {
  const { url } = req.body
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' })
  }
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })
    
    const contentType = response.headers.get('content-type')
    const content = await response.text()
    
    // 注入基础标签以修复相对路径
    const baseUrl = new URL(url).origin
    const injectedContent = content.replace(
      '<head>',
      `<head><base href="${baseUrl}">`
    )
    
    res.set('Content-Type', contentType)
    res.send(injectedContent)
    
  } catch (error) {
    logger.error('Proxy request failed:', error)
    res.status(500).json({ error: 'Proxy request failed' })
  }
})

// 清理资源相关代码已移除（不再使用Puppeteer）

export default router