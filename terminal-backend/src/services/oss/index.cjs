const OSSClient = require('./oss-client.cjs');
const MultipartUploadManager = require('./multipart-upload.cjs');
const STSManager = require('./sts-manager.cjs');
const config = require('./config.cjs');

/**
 * OSS服务主入口
 * 提供完整的OSS功能封装
 */
class OSSService {
  constructor(projectName = 'default', customConfig = {}) {
    // 获取项目配置
    const projectConfig = config.getProjectConfig(projectName);
    this.config = { ...projectConfig, ...customConfig };
    
    // 初始化客户端
    this.client = new OSSClient(this.config);
    
    // 初始化分片上传管理器
    this.multipartUpload = new MultipartUploadManager(this.client);
    
    // 初始化STS管理器（如果配置了）
    if (this.config.stsConfig) {
      this.stsManager = new STSManager(this.config.stsConfig);
    }
  }

  /**
   * 上传文件（自动选择普通或分片上传）
   */
  async upload(filePath, options = {}) {
    const stats = await require('fs').promises.stat(filePath);
    const fileSize = stats.size;
    
    // 根据文件大小选择上传方式
    const threshold = this.config.multipartThreshold || (10 * 1024 * 1024);
    
    if (fileSize > threshold) {
      // 使用分片上传
      const remotePath = options.remotePath || this.client.generatePath(require('path').basename(filePath), options);
      return await this.multipartUpload.uploadFileMultipart(filePath, remotePath, options);
    } else {
      // 使用普通上传
      const remotePath = options.remotePath || this.client.generatePath(require('path').basename(filePath), options);
      return await this.client.uploadFile(filePath, remotePath, options);
    }
  }

  /**
   * 上传HTML内容
   */
  async uploadHTML(htmlContent, filename, options = {}) {
    return await this.client.uploadHTML(htmlContent, filename, options);
  }

  /**
   * 上传Buffer
   */
  async uploadBuffer(buffer, filename, options = {}) {
    const remotePath = options.remotePath || this.client.generatePath(filename, options);
    return await this.client.uploadBuffer(buffer, remotePath, options);
  }

  /**
   * 下载文件
   */
  async download(remotePath, localPath) {
    return await this.client.getFile(remotePath, localPath);
  }

  /**
   * 获取文件Buffer
   */
  async getBuffer(remotePath) {
    return await this.client.getBuffer(remotePath);
  }

  /**
   * 删除文件
   */
  async delete(remotePath) {
    return await this.client.deleteFile(remotePath);
  }

  /**
   * 批量删除
   */
  async deleteMultiple(remotePaths) {
    return await this.client.deleteMultiple(remotePaths);
  }

  /**
   * 列出文件
   */
  async list(prefix = '', options = {}) {
    return await this.client.listFiles(prefix, options);
  }

  /**
   * 检查文件是否存在
   */
  async exists(remotePath) {
    return await this.client.exists(remotePath);
  }

  /**
   * 获取文件元信息
   */
  async getMetadata(remotePath) {
    return await this.client.getMetadata(remotePath);
  }

  /**
   * 生成签名URL
   */
  async generateSignedUrl(remotePath, expires = 3600, options = {}) {
    return await this.client.generateSignedUrl(remotePath, expires, options);
  }

  /**
   * 获取STS凭证
   */
  async getSTSCredentials(options = {}) {
    if (!this.stsManager) {
      throw new Error('STS管理器未初始化');
    }
    return await this.stsManager.getCredentials(options);
  }

  /**
   * 获取上传凭证（用于前端直传）
   */
  async getUploadCredentials(options = {}) {
    if (!this.stsManager) {
      throw new Error('STS管理器未初始化');
    }
    return await this.stsManager.getUploadCredentials({
      bucket: this.config.bucket,
      ...options
    });
  }

  /**
   * 清理过期的分片上传
   */
  async cleanupMultipartUploads(expirationHours = 24) {
    return await this.multipartUpload.cleanupExpiredUploads(expirationHours);
  }
}

// 导出服务类和工具函数
module.exports = {
  OSSService,
  OSSClient,
  MultipartUploadManager,
  STSManager,
  config,
  
  // 工具函数
  isAllowedFileType: config.isAllowedFileType,
  isAllowedFileSize: config.isAllowedFileSize,
  
  // 快速创建实例
  createOSSService: (projectName, customConfig) => new OSSService(projectName, customConfig)
};