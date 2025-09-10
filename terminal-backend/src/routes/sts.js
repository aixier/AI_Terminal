import express from 'express'
import logger from '../utils/logger.js'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const Core = require('@alicloud/pop-core')

const router = express.Router()

// STS客户端配置
const stsClient = new Core({
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  endpoint: 'https://sts.aliyuncs.com',
  apiVersion: '2015-04-01'
})

/**
 * POST /api/sts/token
 * 获取临时上传凭证
 */
router.post('/token', async (req, res) => {
  try {
    const { fileType = 'audio', fileName } = req.body
    
    // 生成唯一的session名称
    const sessionName = `upload-session-${Date.now()}`
    
    // 根据文件类型确定目录
    const directory = fileType === 'video' ? 'transcription/video' : 'transcription/audio'
    
    // 定义策略 - 只允许上传到特定目录
    const policy = {
      Version: '1',
      Statement: [
        {
          Effect: 'Allow',
          Action: [
            'oss:PutObject',
            'oss:PutObjectAcl'
          ],
          Resource: [
            `acs:oss:*:*:${process.env.OSS_BUCKET}/${directory}/*`
          ]
        }
      ]
    }
    
    const params = {
      RoleArn: process.env.STS_ROLE_ARN || `acs:ram::${process.env.ALIYUN_ACCOUNT_ID}:role/aliyunosstoken`,
      RoleSessionName: sessionName,
      Policy: JSON.stringify(policy),
      DurationSeconds: 3600 // 1小时有效期
    }
    
    logger.info(`Requesting STS token for ${fileType} upload`)
    
    // 请求STS临时凭证
    const result = await stsClient.request('AssumeRole', params, {
      method: 'POST'
    })
    
    // 生成文件路径
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 8)
    const ext = fileName ? fileName.split('.').pop() : 'bin'
    const ossKey = `${directory}/${timestamp}-${randomStr}.${ext}`
    
    res.json({
      success: true,
      credentials: {
        accessKeyId: result.Credentials.AccessKeyId,
        accessKeySecret: result.Credentials.AccessKeySecret,
        stsToken: result.Credentials.SecurityToken,
        expiration: result.Credentials.Expiration
      },
      upload: {
        region: process.env.OSS_REGION,
        bucket: process.env.OSS_BUCKET,
        key: ossKey,
        endpoint: `https://${process.env.OSS_BUCKET}.${process.env.OSS_REGION}.aliyuncs.com`
      }
    })
    
  } catch (error) {
    logger.error('STS token generation error:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate STS token'
    })
  }
})

/**
 * POST /api/sts/callback
 * OSS上传回调接口
 */
router.post('/callback', async (req, res) => {
  try {
    const { bucket, object, size, mimeType, etag } = req.body
    
    logger.info(`OSS upload callback: ${object} (${size} bytes)`)
    
    // 可以在这里记录上传信息到数据库
    
    res.json({
      success: true,
      message: 'Upload callback received'
    })
  } catch (error) {
    logger.error('OSS callback error:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

export default router