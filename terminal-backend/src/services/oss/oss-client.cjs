const OSS = require('ali-oss');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

/**
 * 通用的阿里云OSS客户端
 * 支持多项目使用，提供灵活的配置选项
 */
class OSSClient {
  constructor(config = {}) {
    this.config = this.validateConfig(config);
    this.client = null;
    this.stsClient = null;
    this.initClient();
  }

  /**
   * 验证配置
   */
  validateConfig(config) {
    const defaultConfig = {
      region: process.env.OSS_REGION || 'oss-cn-beijing',
      accessKeyId: process.env.OSS_ACCESS_KEY_ID,
      accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
      bucket: process.env.OSS_BUCKET,
      secure: true,
      timeout: 60000,
      // 项目特定配置
      projectName: config.projectName || 'default',
      baseDir: config.baseDir || '',
      // STS配置
      useSTS: config.useSTS || false,
      stsToken: config.stsToken,
      // 重试配置
      retryCount: config.retryCount || 3,
      retryDelay: config.retryDelay || 1000
    };

    return { ...defaultConfig, ...config };
  }

  /**
   * 初始化OSS客户端
   */
  initClient() {
    const clientConfig = {
      region: this.config.region,
      accessKeyId: this.config.accessKeyId,
      accessKeySecret: this.config.accessKeySecret,
      bucket: this.config.bucket,
      secure: this.config.secure,
      timeout: this.config.timeout
    };

    // 如果使用STS临时凭证
    if (this.config.useSTS && this.config.stsToken) {
      clientConfig.stsToken = this.config.stsToken;
    }

    this.client = new OSS(clientConfig);
  }

  /**
   * 刷新STS凭证
   */
  async refreshSTSToken(stsToken) {
    this.config.stsToken = stsToken;
    this.initClient();
  }

  /**
   * 生成存储路径
   */
  generatePath(filename, options = {}) {
    const { 
      useTimestamp = true, 
      useUUID = false,
      customDir = '',
      preserveExt = true
    } = options;

    let dir = this.config.baseDir;
    if (this.config.projectName) {
      dir = path.join(dir, this.config.projectName);
    }
    if (customDir) {
      dir = path.join(dir, customDir);
    }

    let name = filename;
    if (useUUID) {
      const ext = preserveExt ? path.extname(filename) : '';
      name = `${crypto.randomUUID()}${ext}`;
    } else if (useTimestamp) {
      const ext = path.extname(filename);
      const base = path.basename(filename, ext);
      name = `${base}_${Date.now()}${ext}`;
    }

    return path.join(dir, name).replace(/\\/g, '/');
  }

  /**
   * 上传文件（支持重试）
   */
  async uploadFile(localPath, remotePath, options = {}) {
    const { retryCount = this.config.retryCount } = options;
    
    for (let i = 0; i < retryCount; i++) {
      try {
        const result = await this.client.put(remotePath, localPath, options);
        return {
          success: true,
          url: result.url,
          name: result.name,
          size: result.res.size,
          etag: result.res.headers.etag
        };
      } catch (error) {
        console.error(`上传失败 (尝试 ${i + 1}/${retryCount}):`, error.message);
        
        if (i === retryCount - 1) {
          throw error;
        }
        
        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * (i + 1)));
      }
    }
  }

  /**
   * 上传Buffer或Stream
   */
  async uploadBuffer(buffer, remotePath, options = {}) {
    const { retryCount = this.config.retryCount } = options;
    
    for (let i = 0; i < retryCount; i++) {
      try {
        const result = await this.client.put(remotePath, buffer, options);
        return {
          success: true,
          url: result.url,
          name: result.name,
          etag: result.res.headers.etag
        };
      } catch (error) {
        console.error(`上传失败 (尝试 ${i + 1}/${retryCount}):`, error.message);
        
        if (i === retryCount - 1) {
          throw error;
        }
        
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * (i + 1)));
      }
    }
  }

  /**
   * 上传HTML内容
   */
  async uploadHTML(htmlContent, filename, options = {}) {
    const remotePath = this.generatePath(filename, {
      ...options,
      customDir: options.customDir || 'html'
    });

    const buffer = Buffer.from(htmlContent, 'utf-8');
    
    const result = await this.uploadBuffer(buffer, remotePath, {
      ...options,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        ...options.headers
      }
    });

    return result;
  }

  /**
   * 获取文件
   */
  async getFile(remotePath, localPath) {
    try {
      const result = await this.client.get(remotePath, localPath);
      return {
        success: true,
        content: result.content,
        res: result.res
      };
    } catch (error) {
      console.error('获取文件失败:', error);
      throw error;
    }
  }

  /**
   * 获取文件Buffer
   */
  async getBuffer(remotePath) {
    try {
      const result = await this.client.get(remotePath);
      return {
        success: true,
        buffer: result.content,
        res: result.res
      };
    } catch (error) {
      console.error('获取文件失败:', error);
      throw error;
    }
  }

  /**
   * 删除文件
   */
  async deleteFile(remotePath) {
    try {
      const result = await this.client.delete(remotePath);
      return {
        success: true,
        res: result.res
      };
    } catch (error) {
      console.error('删除文件失败:', error);
      throw error;
    }
  }

  /**
   * 批量删除文件
   */
  async deleteMultiple(remotePaths) {
    try {
      const result = await this.client.deleteMulti(remotePaths);
      return {
        success: true,
        deleted: result.deleted,
        res: result.res
      };
    } catch (error) {
      console.error('批量删除失败:', error);
      throw error;
    }
  }

  /**
   * 列出文件
   */
  async listFiles(prefix = '', options = {}) {
    try {
      const result = await this.client.list({
        prefix: path.join(this.config.baseDir, this.config.projectName, prefix).replace(/\\/g, '/'),
        ...options
      });
      
      return {
        success: true,
        objects: result.objects || [],
        prefixes: result.prefixes || [],
        isTruncated: result.isTruncated,
        nextMarker: result.nextMarker
      };
    } catch (error) {
      console.error('列出文件失败:', error);
      throw error;
    }
  }

  /**
   * 检查文件是否存在
   */
  async exists(remotePath) {
    try {
      await this.client.head(remotePath);
      return true;
    } catch (error) {
      if (error.code === 'NoSuchKey') {
        return false;
      }
      throw error;
    }
  }

  /**
   * 获取文件元信息
   */
  async getMetadata(remotePath) {
    try {
      const result = await this.client.head(remotePath);
      return {
        success: true,
        headers: result.res.headers,
        size: parseInt(result.res.headers['content-length']),
        lastModified: new Date(result.res.headers['last-modified']),
        etag: result.res.headers.etag
      };
    } catch (error) {
      console.error('获取元信息失败:', error);
      throw error;
    }
  }

  /**
   * 设置文件ACL
   */
  async setACL(remotePath, acl = 'private') {
    try {
      const result = await this.client.putACL(remotePath, acl);
      return {
        success: true,
        res: result.res
      };
    } catch (error) {
      console.error('设置ACL失败:', error);
      throw error;
    }
  }

  /**
   * 生成签名URL
   */
  async generateSignedUrl(remotePath, expires = 3600, options = {}) {
    try {
      const url = this.client.signatureUrl(remotePath, {
        expires,
        ...options
      });
      return {
        success: true,
        url,
        expires: new Date(Date.now() + expires * 1000)
      };
    } catch (error) {
      console.error('生成签名URL失败:', error);
      throw error;
    }
  }

  /**
   * 复制文件
   */
  async copyFile(sourcePath, targetPath, options = {}) {
    try {
      const result = await this.client.copy(targetPath, sourcePath, options);
      return {
        success: true,
        name: result.name,
        url: result.url,
        res: result.res
      };
    } catch (error) {
      console.error('复制文件失败:', error);
      throw error;
    }
  }
}

module.exports = OSSClient;