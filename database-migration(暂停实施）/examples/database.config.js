/**
 * 数据库配置文件
 * 支持JSON模拟模式和MySQL模式切换
 */

const path = require('path');

module.exports = {
  // 数据库模式: 'json' | 'mysql' | 'dual'
  mode: process.env.DB_MODE || 'json',
  
  // JSON模拟数据库配置
  json: {
    // 数据库文件根目录
    basePath: process.env.JSON_DB_PATH || path.join(process.cwd(), 'terminal-backend', 'data', 'db'),
    
    // 备份目录
    backupPath: process.env.JSON_BACKUP_PATH || path.join(process.cwd(), 'terminal-backend', 'data', 'backup'),
    
    // 文件锁配置
    lockfile: {
      retries: 3,
      stale: 10000,
      updateTime: 1000
    },
    
    // 缓存配置
    cache: {
      enabled: true,
      ttl: 60000, // 60秒
      maxSize: 100 // 最多缓存100个查询结果
    }
  },
  
  // MySQL配置（未来使用）
  mysql: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ai_terminal',
    
    // 连接池配置
    pool: {
      min: 2,
      max: 10,
      acquireTimeoutMillis: 30000,
      idleTimeoutMillis: 30000
    }
  },
  
  // 存储配置
  storage: {
    // 存储模式: 'local' | 'oss' | 'dual'
    mode: process.env.STORAGE_MODE || 'local',
    
    // 本地存储配置
    local: {
      basePath: process.env.STORAGE_PATH || path.join(process.cwd(), 'terminal-backend', 'data', 'storage'),
      
      // 文件组织结构
      structure: {
        templates: 'templates',
        generated: 'generated',
        users: 'users',
        temp: 'temp',
        public: 'public'
      },
      
      // 文件限制
      limits: {
        maxFileSize: 10 * 1024 * 1024, // 10MB
        maxTotalSize: 1024 * 1024 * 1024, // 1GB
        allowedExtensions: ['.json', '.html', '.md', '.txt', '.svg', '.png', '.jpg']
      }
    },
    
    // OSS配置（未来使用）
    oss: {
      accessKeyId: process.env.OSS_ACCESS_KEY_ID,
      accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
      bucket: process.env.OSS_BUCKET || 'ai-terminal',
      region: process.env.OSS_REGION || 'oss-cn-hangzhou',
      endpoint: process.env.OSS_ENDPOINT,
      
      // URL配置
      urlExpiry: 3600, // 签名URL有效期（秒）
      customDomain: process.env.OSS_CUSTOM_DOMAIN // 自定义域名
    }
  },
  
  // 元数据配置
  metadata: {
    enabled: true,
    autoCollect: true,        // 自动收集元数据
    includePrompts: false,     // 是否保存完整提示词（隐私考虑）
    retention: 90,             // 元数据保留天数
    
    // 归档配置
    archive: {
      enabled: true,
      after: 30,              // 30天后归档
      compress: true,         // 压缩归档文件
      destination: 'archive'  // 归档目录
    }
  },
  
  // 性能配置
  performance: {
    // 批量操作
    batchSize: 100,
    
    // 查询限制
    maxQueryLimit: 1000,
    defaultQueryLimit: 20,
    
    // 索引配置
    autoIndex: true,
    indexFields: ['user_id', 'task_id', 'template_name', 'created_at']
  },
  
  // 备份配置
  backup: {
    enabled: true,
    schedule: '0 2 * * *',    // 每天凌晨2点（cron格式）
    retention: 30,             // 保留30天
    
    destinations: [
      {
        type: 'local',
        path: path.join(process.cwd(), 'backups', 'db')
      }
      // 未来可添加远程备份
    ]
  },
  
  // 日志配置
  logging: {
    enabled: true,
    level: process.env.LOG_LEVEL || 'info', // error, warn, info, debug
    
    // 日志文件
    file: {
      enabled: true,
      path: path.join(process.cwd(), 'logs'),
      maxSize: '10m',
      maxFiles: 30
    },
    
    // 控制台输出
    console: {
      enabled: true,
      colorize: true
    },
    
    // 数据库操作日志
    database: {
      logQueries: process.env.NODE_ENV === 'development',
      slowQueryThreshold: 1000 // 慢查询阈值（毫秒）
    }
  },
  
  // 安全配置
  security: {
    // 加密配置
    encryption: {
      algorithm: 'aes-256-gcm',
      keyDerivation: 'pbkdf2',
      iterations: 100000
    },
    
    // 访问控制
    access: {
      requireAuth: true,
      rateLimit: {
        windowMs: 15 * 60 * 1000, // 15分钟
        max: 100 // 限制100次请求
      }
    },
    
    // 数据脱敏
    sanitization: {
      enabled: true,
      fields: ['password', 'token', 'secret', 'key']
    }
  },
  
  // 迁移配置
  migration: {
    // 迁移脚本目录
    directory: path.join(process.cwd(), 'database-migration', 'migrations'),
    
    // 迁移表（记录已执行的迁移）
    tableName: 'migrations',
    
    // 迁移选项
    options: {
      validateChecksums: true,
      noLock: false
    }
  },
  
  // 测试配置
  test: {
    // 使用独立的测试数据库
    useTestDatabase: true,
    testDatabaseSuffix: '_test',
    
    // 测试数据
    seed: {
      enabled: true,
      directory: path.join(process.cwd(), 'database-migration', 'seeds')
    },
    
    // 清理策略
    cleanup: 'afterEach' // 'afterEach' | 'afterAll' | 'none'
  },
  
  // 监控配置
  monitoring: {
    enabled: true,
    
    // 性能指标
    metrics: {
      collectInterval: 60000, // 60秒收集一次
      retention: 7 * 24 * 60 // 保留7天的指标数据
    },
    
    // 告警配置
    alerts: {
      enabled: false, // 需要配置告警服务
      channels: ['console', 'log'], // 未来可添加 'email', 'webhook'
      
      rules: [
        {
          metric: 'error_rate',
          threshold: 0.01, // 1%错误率
          action: 'alert'
        },
        {
          metric: 'response_time',
          threshold: 1000, // 1秒
          action: 'warn'
        }
      ]
    }
  }
};

// 辅助函数：获取配置值
function getConfig(path) {
  const keys = path.split('.');
  let value = module.exports;
  
  for (const key of keys) {
    value = value[key];
    if (value === undefined) return null;
  }
  
  return value;
}

// 辅助函数：验证配置
function validateConfig() {
  const required = [
    'mode',
    'json.basePath',
    'storage.mode',
    'storage.local.basePath'
  ];
  
  const missing = [];
  for (const path of required) {
    if (!getConfig(path)) {
      missing.push(path);
    }
  }
  
  if (missing.length > 0) {
    throw new Error(`Missing required configuration: ${missing.join(', ')}`);
  }
  
  return true;
}

// 导出辅助函数
module.exports.getConfig = getConfig;
module.exports.validateConfig = validateConfig;