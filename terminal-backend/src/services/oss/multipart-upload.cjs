const fs = require('fs').promises;
const crypto = require('crypto');

/**
 * 分片上传管理器
 */
class MultipartUploadManager {
  constructor(ossClient) {
    this.client = ossClient.client;
    this.config = ossClient.config;
    this.uploads = new Map(); // 存储上传任务
  }

  /**
   * 计算文件MD5
   */
  async calculateFileMD5(filePath) {
    const hash = crypto.createHash('md5');
    const stream = require('fs').createReadStream(filePath);
    
    return new Promise((resolve, reject) => {
      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * 初始化分片上传
   */
  async initMultipartUpload(remotePath, options = {}) {
    try {
      const result = await this.client.initMultipartUpload(remotePath, options);
      
      const uploadId = result.uploadId;
      const uploadInfo = {
        uploadId,
        remotePath,
        parts: [],
        startTime: Date.now(),
        options
      };
      
      this.uploads.set(uploadId, uploadInfo);
      
      return {
        success: true,
        uploadId,
        remotePath
      };
    } catch (error) {
      console.error('初始化分片上传失败:', error);
      throw error;
    }
  }

  /**
   * 上传单个分片
   */
  async uploadPart(uploadId, partNumber, data, options = {}) {
    const uploadInfo = this.uploads.get(uploadId);
    if (!uploadInfo) {
      throw new Error('上传任务不存在');
    }

    try {
      const result = await this.client.uploadPart(
        uploadInfo.remotePath,
        uploadId,
        partNumber,
        data,
        options
      );
      
      // 记录分片信息
      uploadInfo.parts.push({
        number: partNumber,
        etag: result.etag,
        size: data.length
      });
      
      return {
        success: true,
        partNumber,
        etag: result.etag
      };
    } catch (error) {
      console.error(`上传分片 ${partNumber} 失败:`, error);
      throw error;
    }
  }

  /**
   * 完成分片上传
   */
  async completeMultipartUpload(uploadId) {
    const uploadInfo = this.uploads.get(uploadId);
    if (!uploadInfo) {
      throw new Error('上传任务不存在');
    }

    try {
      // 按分片号排序
      const parts = uploadInfo.parts
        .sort((a, b) => a.number - b.number)
        .map(part => ({
          number: part.number,
          etag: part.etag
        }));

      const result = await this.client.completeMultipartUpload(
        uploadInfo.remotePath,
        uploadId,
        parts,
        uploadInfo.options
      );
      
      // 清理上传任务
      this.uploads.delete(uploadId);
      
      return {
        success: true,
        url: result.url,
        name: result.name,
        etag: result.etag,
        duration: Date.now() - uploadInfo.startTime
      };
    } catch (error) {
      console.error('完成分片上传失败:', error);
      throw error;
    }
  }

  /**
   * 取消分片上传
   */
  async abortMultipartUpload(uploadId) {
    const uploadInfo = this.uploads.get(uploadId);
    if (!uploadInfo) {
      return { success: true, message: '上传任务不存在' };
    }

    try {
      await this.client.abortMultipartUpload(uploadInfo.remotePath, uploadId);
      this.uploads.delete(uploadId);
      
      return {
        success: true,
        message: '分片上传已取消'
      };
    } catch (error) {
      console.error('取消分片上传失败:', error);
      throw error;
    }
  }

  /**
   * 自动分片上传文件
   */
  async uploadFileMultipart(filePath, remotePath, options = {}) {
    const stats = await fs.stat(filePath);
    const fileSize = stats.size;
    
    // 配置
    const partSize = options.partSize || this.config.partSize || (1 * 1024 * 1024);
    const parallel = options.parallel || this.config.parallel || 3;
    
    // 计算分片数
    const partCount = Math.ceil(fileSize / partSize);
    
    console.log(`开始分片上传: 文件大小=${fileSize}, 分片大小=${partSize}, 分片数=${partCount}`);
    
    // 初始化上传
    const { uploadId } = await this.initMultipartUpload(remotePath, options);
    
    try {
      // 创建上传任务队列
      const uploadQueue = [];
      
      for (let i = 0; i < partCount; i++) {
        const start = i * partSize;
        const end = Math.min(start + partSize, fileSize);
        const partNumber = i + 1;
        
        uploadQueue.push({
          partNumber,
          start,
          end,
          size: end - start
        });
      }
      
      // 并行上传分片
      const uploadPart = async (partInfo) => {
        const { partNumber, start, end } = partInfo;
        
        // 读取分片数据
        const fileHandle = await fs.open(filePath, 'r');
        const buffer = Buffer.alloc(end - start);
        await fileHandle.read(buffer, 0, buffer.length, start);
        await fileHandle.close();
        
        // 上传分片
        return await this.uploadPart(uploadId, partNumber, buffer);
      };
      
      // 控制并发
      const results = [];
      for (let i = 0; i < uploadQueue.length; i += parallel) {
        const batch = uploadQueue.slice(i, i + parallel);
        const batchResults = await Promise.all(batch.map(uploadPart));
        results.push(...batchResults);
        
        // 进度回调
        if (options.onProgress) {
          const progress = Math.round((results.length / partCount) * 100);
          options.onProgress({
            progress,
            uploaded: results.length,
            total: partCount
          });
        }
      }
      
      // 完成上传
      const completeResult = await this.completeMultipartUpload(uploadId);
      
      return {
        ...completeResult,
        parts: partCount,
        fileSize
      };
      
    } catch (error) {
      // 失败时取消上传
      await this.abortMultipartUpload(uploadId);
      throw error;
    }
  }

  /**
   * 列出所有分片上传任务
   */
  async listMultipartUploads(options = {}) {
    try {
      const result = await this.client.listUploads({
        'max-uploads': options.maxUploads || 100,
        'key-marker': options.keyMarker,
        'upload-id-marker': options.uploadIdMarker
      });
      
      return {
        success: true,
        uploads: result.uploads || [],
        isTruncated: result.isTruncated,
        nextKeyMarker: result.nextKeyMarker,
        nextUploadIdMarker: result.nextUploadIdMarker
      };
    } catch (error) {
      console.error('列出分片上传任务失败:', error);
      throw error;
    }
  }

  /**
   * 清理过期的分片上传任务
   */
  async cleanupExpiredUploads(expirationHours = 24) {
    try {
      const { uploads } = await this.listMultipartUploads();
      const now = Date.now();
      const expirationMs = expirationHours * 60 * 60 * 1000;
      
      const cleanupTasks = uploads
        .filter(upload => {
          const uploadTime = new Date(upload.initiated).getTime();
          return (now - uploadTime) > expirationMs;
        })
        .map(upload => this.client.abortMultipartUpload(upload.name, upload.uploadId));
      
      const results = await Promise.allSettled(cleanupTasks);
      
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      return {
        success: true,
        cleaned: succeeded,
        failed,
        total: results.length
      };
    } catch (error) {
      console.error('清理过期上传任务失败:', error);
      throw error;
    }
  }
}

module.exports = MultipartUploadManager;