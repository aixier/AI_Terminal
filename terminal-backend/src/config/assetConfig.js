/**
 * 资产管理配置
 * 定义资产管理系统的各项配置参数
 */

import path from 'path'

// 基础配置
export const baseConfig = {
  // 数据存储路径
  dataPath: process.env.DATA_PATH || path.join(process.cwd(), 'data'),
  
  // 临时文件路径
  tempPath: process.env.TEMP_PATH || path.join(process.cwd(), 'temp'),
  
  // 缓存路径
  cachePath: process.env.CACHE_PATH || path.join(process.cwd(), 'cache'),
  
  // 默认用户ID
  defaultUserId: 'default',
  
  // 系统文件夹名称
  systemFolderName: '.system',
  
  // 缩略图文件夹名称
  thumbnailFolderName: '.thumbnails'
}

// Chokidar配置
export const chokidarConfig = {
  // 忽略的文件和文件夹
  ignored: [
    /(^|[\/\\])\../, // 忽略点文件
    /node_modules/,
    /\.git/,
    /.system/,
    /.thumbnails/,
    /~\$/,  // 临时文件
    /\.tmp$/,
    /\.temp$/,
    /\.cache$/,
    /Thumbs\.db$/,
    /\.DS_Store$/
  ],
  
  // 持续监听
  persistent: true,
  
  // 忽略初始添加事件
  ignoreInitial: true,
  
  // 等待写入完成
  awaitWriteFinish: {
    stabilityThreshold: 500,
    pollInterval: 100
  },
  
  // 使用polling（某些网络驱动器需要）
  usePolling: false,
  
  // Polling间隔
  interval: 100,
  
  // 二进制间隔
  binaryInterval: 300,
  
  // 递归深度
  depth: 99,
  
  // 跟随符号链接
  followSymlinks: false,
  
  // 忽略权限错误
  ignorePermissionErrors: true,
  
  // 原子写入
  atomic: true,
  
  // Always stat
  alwaysStat: true
}

// 文件上传配置
export const uploadConfig = {
  // 最大文件大小（字节）
  maxFileSize: 100 * 1024 * 1024, // 100MB
  
  // 单次最大上传文件数
  maxFiles: 10,
  
  // 允许的文件类型
  allowedTypes: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'video/mp4',
    'video/webm',
    'audio/mpeg',
    'audio/wav',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/markdown',
    'application/json',
    'application/zip',
    'application/x-rar-compressed'
  ],
  
  // 文件名生成策略
  filenameStrategy: 'uuid_timestamp', // uuid, timestamp, uuid_timestamp, original
  
  // 是否保留原始文件名
  preserveOriginalName: true
}

// 图片处理配置
export const imageConfig = {
  // 缩略图尺寸
  thumbnailSizes: {
    small: { width: 150, height: 150 },
    medium: { width: 300, height: 300 },
    large: { width: 600, height: 600 }
  },
  
  // 缩略图质量
  thumbnailQuality: 80,
  
  // 缩略图格式
  thumbnailFormat: 'webp', // jpeg, png, webp
  
  // 优化选项
  optimizeOptions: {
    quality: 85,
    progressive: true,
    mozjpeg: true
  },
  
  // 支持的图片格式
  supportedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'],
  
  // 最大处理尺寸
  maxWidth: 4096,
  maxHeight: 4096,
  
  // 是否自动旋转（基于EXIF）
  autoRotate: true
}

// 视频处理配置
export const videoConfig = {
  // 缩略图时间点（秒）
  thumbnailTime: 1,
  
  // 缩略图格式
  thumbnailFormat: 'jpg',
  
  // 支持的视频格式
  supportedFormats: ['mp4', 'webm', 'avi', 'mov', 'mkv', 'flv'],
  
  // 最大文件大小
  maxFileSize: 500 * 1024 * 1024 // 500MB
}

// 索引配置
export const indexConfig = {
  // 索引版本
  version: '1.0',
  
  // 索引文件名
  filename: 'index.json',
  
  // 搜索缓存时间（毫秒）
  searchCacheTimeout: 5 * 60 * 1000, // 5分钟
  
  // 批量索引大小
  batchSize: 100,
  
  // 自动保存间隔（毫秒）
  autoSaveInterval: 30 * 1000, // 30秒
  
  // 最大搜索结果数
  maxSearchResults: 100
}

// 事件处理配置
export const eventConfig = {
  // 批处理间隔（毫秒）
  batchInterval: 500,
  
  // 最大批处理大小
  maxBatchSize: 50,
  
  // 事件去重时间窗口（毫秒）
  deduplicationWindow: 1000,
  
  // 重试次数
  maxRetries: 3,
  
  // 重试延迟（毫秒）
  retryDelay: 1000
}

// 队列配置
export const queueConfig = {
  // 并发数
  concurrency: 5,
  
  // 队列间隔（毫秒）
  interval: 100,
  
  // 队列容量间隔
  intervalCap: 10,
  
  // 是否自动启动
  autoStart: true,
  
  // 队列暂停时长（毫秒）
  queuePauseTime: 1000
}

// SSE配置
export const sseConfig = {
  // 心跳间隔（毫秒）
  heartbeatInterval: 30000, // 30秒
  
  // 重连延迟（毫秒）
  reconnectDelay: 3000,
  
  // 最大重连次数
  maxReconnectAttempts: 10,
  
  // 消息缓冲区大小
  messageBufferSize: 100
}

// 权限配置
export const permissionConfig = {
  // 默认文件权限
  defaultFileMode: 0o644,
  
  // 默认文件夹权限
  defaultDirMode: 0o755,
  
  // 用户配额（字节）
  userQuota: 10 * 1024 * 1024 * 1024, // 10GB
  
  // 单文件最大大小
  maxFileSize: 100 * 1024 * 1024 // 100MB
}

// 清理配置
export const cleanupConfig = {
  // 临时文件保留时间（毫秒）
  tempFileRetention: 24 * 60 * 60 * 1000, // 24小时
  
  // 缓存保留时间（毫秒）
  cacheRetention: 7 * 24 * 60 * 60 * 1000, // 7天
  
  // 清理间隔（毫秒）
  cleanupInterval: 60 * 60 * 1000, // 1小时
  
  // 是否自动清理
  autoCleanup: true
}

// API限制配置
export const apiLimitConfig = {
  // 速率限制
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 1000 // 最大请求数
  },
  
  // 上传速率限制
  uploadRateLimit: {
    windowMs: 15 * 60 * 1000,
    max: 100
  },
  
  // 搜索速率限制
  searchRateLimit: {
    windowMs: 1 * 60 * 1000,
    max: 30
  }
}

// 日志配置
export const logConfig = {
  // 日志级别
  level: process.env.LOG_LEVEL || 'info',
  
  // 是否记录文件操作
  logFileOperations: true,
  
  // 是否记录搜索查询
  logSearchQueries: false,
  
  // 日志文件路径
  logPath: path.join(process.cwd(), 'logs'),
  
  // 日志文件名格式
  logFileFormat: 'assets-%DATE%.log',
  
  // 日志轮转
  logRotation: {
    maxSize: '10m',
    maxFiles: '7d'
  }
}

// 监控配置
export const monitoringConfig = {
  // 是否启用监控
  enabled: true,
  
  // 指标收集间隔（毫秒）
  metricsInterval: 60000, // 1分钟
  
  // 健康检查端点
  healthCheckEndpoint: '/health',
  
  // 指标端点
  metricsEndpoint: '/metrics'
}

// 备份配置
export const backupConfig = {
  // 是否启用自动备份
  enabled: false,
  
  // 备份路径
  backupPath: path.join(process.cwd(), 'backups'),
  
  // 备份间隔（毫秒）
  backupInterval: 24 * 60 * 60 * 1000, // 24小时
  
  // 保留备份数
  maxBackups: 7,
  
  // 备份时是否压缩
  compress: true
}

// 导出统一配置对象
export default {
  base: baseConfig,
  chokidar: chokidarConfig,
  upload: uploadConfig,
  image: imageConfig,
  video: videoConfig,
  index: indexConfig,
  event: eventConfig,
  queue: queueConfig,
  sse: sseConfig,
  permission: permissionConfig,
  cleanup: cleanupConfig,
  apiLimit: apiLimitConfig,
  log: logConfig,
  monitoring: monitoringConfig,
  backup: backupConfig
}

// 环境特定配置覆盖
export function getConfig() {
  const config = {
    base: { ...baseConfig },
    chokidar: { ...chokidarConfig },
    upload: { ...uploadConfig },
    image: { ...imageConfig },
    video: { ...videoConfig },
    index: { ...indexConfig },
    event: { ...eventConfig },
    queue: { ...queueConfig },
    sse: { ...sseConfig },
    permission: { ...permissionConfig },
    cleanup: { ...cleanupConfig },
    apiLimit: { ...apiLimitConfig },
    log: { ...logConfig },
    monitoring: { ...monitoringConfig },
    backup: { ...backupConfig }
  }
  
  // 开发环境配置
  if (process.env.NODE_ENV === 'development') {
    config.log.level = 'debug'
    config.chokidar.usePolling = true
    config.monitoring.metricsInterval = 10000
  }
  
  // 生产环境配置
  if (process.env.NODE_ENV === 'production') {
    config.log.level = 'warn'
    config.cleanup.autoCleanup = true
    config.backup.enabled = true
  }
  
  return config
}