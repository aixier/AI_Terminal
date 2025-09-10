/**
 * OSS自动上传工具
 * 用于Pod2Post生成完成后自动上传HTML文件到OSS并生成签名URL
 */

import { createRequire } from 'module'
import fs from 'fs/promises'
import path from 'path'

const require = createRequire(import.meta.url)
const { OSSService } = require('../../../services/oss/index.cjs')

/**
 * OSS上传器类
 */
export class OSSUploader {
  constructor() {
    this.ossService = new OSSService('ai-terminal')
  }

  /**
   * 上传Pod2Post文件到OSS并生成签名URL
   * @param {string} username - 用户名
   * @param {string} folderName - 文件夹名称（taskId）
   * @param {string} folderPath - 本地文件夹路径
   * @returns {Promise<Object>} 上传结果和OSS URL
   */
  async uploadPod2PostFiles(username, folderName, folderPath) {
    console.log(`[OSSUploader] 开始上传Pod2Post文件到OSS`)
    console.log(`[OSSUploader] 用户: ${username}, 文件夹: ${folderName}`)
    console.log(`[OSSUploader] 本地路径: ${folderPath}`)

    const uploadResults = {
      originalHtml: null,
      withBase64: null,
      metadata: null,
      contentJson: null,  // 新增：支持content.json或其他JSON文件
      otherFiles: [],     // 新增：其他文件列表
      success: false,
      error: null,
      uploadedFiles: []
    }

    try {
      const files = await fs.readdir(folderPath)
      console.log(`[OSSUploader] 发现文件: ${files.length}个`)

      for (const fileName of files) {
        const filePath = path.join(folderPath, fileName)
        const stats = await fs.stat(filePath)

        // 跳过目录
        if (stats.isDirectory()) continue

        // 对中文文件名进行URL编码，避免OSS header错误
        const encodedFileName = encodeURIComponent(fileName)
        // OSS键名使用编码后的文件名
        const ossKey = `pod2post/${username}/${folderName}/${encodedFileName}`
        const mimeType = this.getMimeType(fileName)

        console.log(`[OSSUploader] 正在上传: ${fileName} (${(stats.size / 1024 / 1024).toFixed(2)}MB)`)

        try {
          // 上传到OSS - 修复中文文件名问题
          // Content-Disposition使用RFC 5987编码格式处理中文
          const uploadResult = await this.ossService.client.uploadFile(filePath, ossKey, {
            headers: {
              'Content-Type': mimeType,
              'Cache-Control': 'public, max-age=31536000',
              // 使用filename*参数支持中文，同时提供ASCII fallback
              'Content-Disposition': `attachment; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`
            }
          })

          if (uploadResult.success) {
            // 生成1年有效期的签名URL
            const signedUrlResult = await this.ossService.client.generateSignedUrl(ossKey, 3600 * 24 * 365)
            
            const fileResult = {
              fileName,
              fileSize: stats.size,
              ossKey,
              ossUrl: signedUrlResult.url,
              uploadedAt: new Date().toISOString()
            }

            uploadResults.uploadedFiles.push(fileResult)

            // 分类保存结果 - 扩展支持所有文件类型
            // 原始HTML：不包含base64且是HTML文件
            if (fileName.endsWith('.html') && !fileName.includes('base64') && !fileName.includes('response')) {
              uploadResults.originalHtml = fileResult
            } else if (fileName.includes('base64') && fileName.endsWith('.html')) {
              uploadResults.withBase64 = fileResult
            } else if (fileName.includes('meta') && fileName.endsWith('.json')) {
              uploadResults.metadata = fileResult
            } else if (fileName.endsWith('.json') && !fileName.includes('meta')) {
              // 支持content.json、社媒文案.json等其他JSON文件
              uploadResults.contentJson = fileResult
              uploadResults.otherFiles.push(fileResult)
            } else {
              // 其他所有文件也都上传
              uploadResults.otherFiles.push(fileResult)
            }

            console.log(`[OSSUploader] ✅ ${fileName} 上传成功，OSS URL: ${signedUrlResult.url.substring(0, 80)}...`)
          } else {
            console.warn(`[OSSUploader] ❌ ${fileName} 上传失败:`, uploadResult.error)
          }
        } catch (error) {
          console.error(`[OSSUploader] ${fileName} 上传异常:`, error.message)
          uploadResults.error = error.message
        }
      }

      uploadResults.success = uploadResults.uploadedFiles.length > 0
      console.log(`[OSSUploader] 上传完成: ${uploadResults.uploadedFiles.length}/${files.length} 个文件成功`)

      return uploadResults

    } catch (error) {
      console.error(`[OSSUploader] OSS上传过程失败:`, error)
      uploadResults.error = error.message
      return uploadResults
    }
  }

  /**
   * 获取文件MIME类型
   * @param {string} fileName - 文件名
   * @returns {string} MIME类型
   */
  getMimeType(fileName) {
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

  /**
   * 检查文件是否应该上传到OSS（大文件优先）
   * @param {string} filePath - 文件路径
   * @param {number} threshold - 阈值（字节），默认5MB
   * @returns {Promise<boolean>} 是否应该上传
   */
  async shouldUploadToOSS(filePath, threshold = 5 * 1024 * 1024) {
    try {
      const stats = await fs.stat(filePath)
      return stats.size >= threshold
    } catch {
      return false
    }
  }
}

export default OSSUploader