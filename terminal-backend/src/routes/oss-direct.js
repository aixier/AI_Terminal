import express from 'express'
import crypto from 'crypto'
import logger from '../utils/logger.js'

const router = express.Router()

/**
 * POST /api/oss-direct/signature
 * 获取OSS直传签名
 * 使用PostObject方式，前端可以直接通过表单上传到OSS
 */
router.post('/signature', async (req, res) => {
  try {
    const { fileName, fileType = 'audio' } = req.body
    
    // OSS配置
    const accessKeyId = process.env.OSS_ACCESS_KEY_ID
    const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET
    const bucket = process.env.OSS_BUCKET
    const region = process.env.OSS_REGION
    const host = `https://${bucket}.${region}.aliyuncs.com`
    
    // 生成文件路径
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 8)
    const ext = fileName ? fileName.split('.').pop() : 'bin'
    const directory = fileType === 'video' ? 'transcription/video' : 'transcription/audio'
    const ossKey = `${directory}/${timestamp}-${randomStr}.${ext}`
    
    // 设置Policy过期时间（1小时）
    const expiration = new Date()
    expiration.setHours(expiration.getHours() + 1)
    
    // 构建Policy
    const policyObj = {
      expiration: expiration.toISOString(),
      conditions: [
        ['content-length-range', 0, 1048576000], // 最大1GB
        ['starts-with', '$key', directory],
        { bucket: bucket }
      ]
    }
    
    const policyBase64 = Buffer.from(JSON.stringify(policyObj)).toString('base64')
    
    // 计算签名
    const signature = crypto
      .createHmac('sha1', accessKeySecret)
      .update(policyBase64)
      .digest('base64')
    
    logger.info(`生成OSS直传签名，文件将上传到: ${ossKey}`)
    
    res.json({
      success: true,
      upload: {
        host: host,
        key: ossKey,
        policy: policyBase64,
        OSSAccessKeyId: accessKeyId,
        signature: signature,
        expire: expiration.getTime()
      },
      ossUrl: `${host}/${ossKey}`
    })
    
  } catch (error) {
    logger.error('OSS签名生成错误:', error)
    res.status(500).json({
      success: false,
      error: error.message || '签名生成失败'
    })
  }
})

/**
 * GET /api/oss-direct/upload-url
 * 获取PUT上传的签名URL
 * 更简单的方式，使用PUT直接上传
 */
router.post('/upload-url', async (req, res) => {
  logger.info('========================================')
  logger.info('OSS直传URL请求开始')
  logger.info('========================================')
  
  try {
    const { fileName, fileType = 'audio', contentType } = req.body
    
    logger.info(`请求参数:`)
    logger.info(`  - 文件名: ${fileName}`)
    logger.info(`  - 文件类型: ${fileType}`)
    logger.info(`  - Content-Type: ${contentType || 'application/octet-stream'}`)
    
    // 动态加载OSS模块
    const { createRequire } = await import('module')
    const require = createRequire(import.meta.url)
    const { OSSService } = require('../services/oss/index.cjs')
    
    // 初始化OSS服务
    const ossService = new OSSService('transcription', {
      baseDir: 'transcription',
      structure: {
        audio: 'audio',
        video: 'video'
      }
    })
    
    // 生成文件路径
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 8)
    const ext = fileName ? fileName.split('.').pop() : 'bin'
    const directory = fileType === 'video' ? 'video' : 'audio'
    const ossKey = `transcription/${directory}/${timestamp}-${randomStr}.${ext}`
    
    logger.info(`生成OSS路径: ${ossKey}`)
    logger.info(`OSS Bucket: ${process.env.OSS_BUCKET}`)
    logger.info(`OSS Region: ${process.env.OSS_REGION}`)
    
    // 生成PUT上传的签名URL（1小时有效）
    logger.info('生成PUT上传签名URL...')
    const putSignedUrlResult = await ossService.generateSignedUrl(ossKey, 3600, {
      method: 'PUT',
      'Content-Type': contentType || 'application/octet-stream',
      'x-oss-object-acl': 'public-read'  // 设置为公共读，让阿里云API能访问
    })
    logger.info(`PUT URL生成成功: ${(putSignedUrlResult.url || putSignedUrlResult).substring(0, 100)}...`)
    
    // 生成GET访问的签名URL（2小时有效，给阿里云API足够时间下载）
    logger.info('生成GET访问签名URL...')
    const getSignedUrlResult = await ossService.generateSignedUrl(ossKey, 7200, {
      method: 'GET'
    })
    logger.info(`GET URL生成成功: ${(getSignedUrlResult.url || getSignedUrlResult).substring(0, 100)}...`)
    
    logger.info(`OSS文件将上传到: ${ossKey}`)
    
    const response = {
      success: true,
      uploadUrl: putSignedUrlResult.url || putSignedUrlResult,  // PUT上传URL
      ossKey: ossKey,
      ossUrl: getSignedUrlResult.url || getSignedUrlResult,  // GET访问URL（带签名）
      publicUrl: `https://${process.env.OSS_BUCKET}.${process.env.OSS_REGION}.aliyuncs.com/${ossKey}`, // 公共URL（不带签名）
      expire: Date.now() + 3600000
    }
    
    logger.info('返回响应:')
    logger.info(`  - 上传URL类型: ${typeof response.uploadUrl}`)
    logger.info(`  - OSS Key: ${response.ossKey}`)
    logger.info(`  - 过期时间: ${new Date(response.expire).toISOString()}`)
    logger.info('========================================')
    logger.info('OSS直传URL请求完成')
    logger.info('========================================')
    
    res.json(response)
    
  } catch (error) {
    logger.error('========================================')
    logger.error('OSS上传URL生成错误')
    logger.error(`错误信息: ${error.message}`)
    logger.error(`错误堆栈: ${error.stack}`)
    logger.error('========================================')
    
    res.status(500).json({
      success: false,
      error: error.message || 'URL生成失败'
    })
  }
})

export default router