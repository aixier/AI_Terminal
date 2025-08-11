const STS = require('ali-oss').STS;

/**
 * STS临时凭证管理器
 * 提供安全的临时访问凭证
 */
class STSManager {
  constructor(config = {}) {
    this.config = {
      accessKeyId: config.accessKeyId || process.env.STS_ACCESS_KEY_ID,
      accessKeySecret: config.accessKeySecret || process.env.STS_ACCESS_KEY_SECRET,
      roleArn: config.roleArn || process.env.STS_ROLE_ARN,
      // 默认会话名称
      sessionName: config.sessionName || 'oss-client-session',
      // 默认过期时间（秒）
      durationSeconds: config.durationSeconds || 3600,
      // 策略配置
      policy: config.policy || null
    };

    if (!this.config.accessKeyId || !this.config.accessKeySecret) {
      throw new Error('STS需要配置accessKeyId和accessKeySecret');
    }

    this.stsClient = new STS({
      accessKeyId: this.config.accessKeyId,
      accessKeySecret: this.config.accessKeySecret
    });

    // 缓存凭证
    this.credentialCache = new Map();
  }

  /**
   * 生成策略文档
   */
  generatePolicy(options = {}) {
    const {
      bucket,
      region = 'oss-cn-beijing',
      allowPaths = ['*'],
      permissions = ['oss:GetObject', 'oss:PutObject'],
      expiration = new Date(Date.now() + 3600 * 1000).toISOString()
    } = options;

    const policy = {
      Version: '1',
      Statement: [
        {
          Effect: 'Allow',
          Action: permissions,
          Resource: allowPaths.map(path => `acs:oss:${region}:*:${bucket}/${path}`)
        }
      ]
    };

    return JSON.stringify(policy);
  }

  /**
   * 获取STS凭证
   */
  async getCredentials(options = {}) {
    const {
      roleArn = this.config.roleArn,
      sessionName = this.config.sessionName,
      durationSeconds = this.config.durationSeconds,
      policy = this.config.policy,
      useCache = true
    } = options;

    if (!roleArn) {
      throw new Error('必须提供roleArn');
    }

    // 检查缓存
    const cacheKey = `${roleArn}:${sessionName}`;
    if (useCache && this.credentialCache.has(cacheKey)) {
      const cached = this.credentialCache.get(cacheKey);
      // 检查是否过期（预留5分钟缓冲）
      if (new Date(cached.expiration) > new Date(Date.now() + 5 * 60 * 1000)) {
        return cached;
      }
    }

    try {
      // 调用STS服务
      const result = await this.stsClient.assumeRole(
        roleArn,
        policy,
        durationSeconds,
        sessionName
      );

      const credentials = {
        accessKeyId: result.credentials.AccessKeyId,
        accessKeySecret: result.credentials.AccessKeySecret,
        stsToken: result.credentials.SecurityToken,
        expiration: result.credentials.Expiration,
        requestId: result.RequestId
      };

      // 缓存凭证
      if (useCache) {
        this.credentialCache.set(cacheKey, credentials);
      }

      return credentials;
    } catch (error) {
      console.error('获取STS凭证失败:', error);
      throw error;
    }
  }

  /**
   * 为特定操作获取受限凭证
   */
  async getRestrictedCredentials(operation, options = {}) {
    const {
      bucket,
      paths = ['*'],
      durationSeconds = 3600
    } = options;

    // 根据操作类型设置权限
    const permissionMap = {
      upload: ['oss:PutObject', 'oss:PutObjectAcl'],
      download: ['oss:GetObject'],
      delete: ['oss:DeleteObject'],
      list: ['oss:ListObjects'],
      manage: ['oss:*']
    };

    const permissions = permissionMap[operation] || ['oss:GetObject'];

    // 生成策略
    const policy = this.generatePolicy({
      bucket,
      allowPaths: paths,
      permissions
    });

    // 获取凭证
    return await this.getCredentials({
      policy,
      durationSeconds,
      sessionName: `${operation}-${Date.now()}`
    });
  }

  /**
   * 为前端生成临时上传凭证
   */
  async getUploadCredentials(options = {}) {
    const {
      bucket,
      directory = 'uploads',
      maxSize = 10 * 1024 * 1024, // 10MB
      allowedTypes = ['image/*', 'application/pdf'],
      durationSeconds = 3600
    } = options;

    // 生成上传策略
    const policy = {
      Version: '1',
      Statement: [
        {
          Effect: 'Allow',
          Action: [
            'oss:PutObject'
          ],
          Resource: [`acs:oss:*:*:${bucket}/${directory}/*`],
          Condition: {
            StringLike: {
              'oss:content-type': allowedTypes
            },
            NumericLessThanEquals: {
              'oss:content-length': maxSize
            }
          }
        }
      ]
    };

    const credentials = await this.getCredentials({
      policy: JSON.stringify(policy),
      durationSeconds,
      sessionName: `upload-${Date.now()}`
    });

    // 返回前端需要的信息
    return {
      ...credentials,
      bucket,
      region: this.config.region || 'oss-cn-beijing',
      directory,
      maxSize,
      allowedTypes
    };
  }

  /**
   * 刷新凭证
   */
  async refreshCredentials(oldCredentials) {
    // 清除旧缓存
    this.credentialCache.clear();
    
    // 获取新凭证
    return await this.getCredentials({
      useCache: true
    });
  }

  /**
   * 清理过期凭证缓存
   */
  cleanupCache() {
    const now = new Date();
    for (const [key, value] of this.credentialCache.entries()) {
      if (new Date(value.expiration) <= now) {
        this.credentialCache.delete(key);
      }
    }
  }

  /**
   * 创建带STS的OSS客户端
   */
  async createSTSOSSClient(OSSClient, options = {}) {
    const credentials = await this.getCredentials(options);
    
    return new OSSClient({
      ...options,
      accessKeyId: credentials.accessKeyId,
      accessKeySecret: credentials.accessKeySecret,
      stsToken: credentials.stsToken,
      useSTS: true
    });
  }
}

module.exports = STSManager;