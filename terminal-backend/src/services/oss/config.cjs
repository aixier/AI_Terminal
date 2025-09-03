/**
 * OSS配置管理
 * 支持多项目配置和环境变量管理
 */

const defaultConfig = {
  // 基础配置
  region: 'oss-cn-beijing',
  secure: true,
  timeout: 180000,  // 增加到3分钟
  
  // 重试配置
  retryCount: 5,    // 增加重试次数到5次
  retryDelay: 2000, // 增加重试延迟到2秒
  
  // 文件配置
  maxFileSize: 100 * 1024 * 1024, // 100MB
  allowedFileTypes: {
    image: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'],
    document: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'],
    html: ['.html', '.htm'],
    text: ['.txt', '.json', '.xml', '.csv'],
    video: ['.mp4', '.avi', '.mov', '.wmv'],
    audio: ['.mp3', '.wav', '.ogg']
  },
  
  // 分片上传配置
  multipartThreshold: 10 * 1024 * 1024, // 10MB以上使用分片上传
  partSize: 1 * 1024 * 1024, // 1MB每片
  parallel: 3, // 并行上传数
  
  // 默认ACL
  defaultACL: 'private' // private, public-read, public-read-write
};

/**
 * 项目配置预设
 */
const projectPresets = {
  tugo: {
    baseDir: 'tugo',
    structure: {
      html: 'pages',
      images: 'images',
      assets: 'assets',
      temp: 'temp'
    }
  },
  
  default: {
    baseDir: 'default',
    structure: {
      uploads: 'uploads',
      temp: 'temp'
    }
  }
};

/**
 * 获取项目配置
 */
function getProjectConfig(projectName = 'default') {
  const preset = projectPresets[projectName] || projectPresets.default;
  
  return {
    ...defaultConfig,
    ...preset,
    projectName,
    // 从环境变量读取敏感信息
    accessKeyId: process.env[`OSS_${projectName.toUpperCase()}_ACCESS_KEY_ID`] || process.env.OSS_ACCESS_KEY_ID,
    accessKeySecret: process.env[`OSS_${projectName.toUpperCase()}_ACCESS_KEY_SECRET`] || process.env.OSS_ACCESS_KEY_SECRET,
    bucket: process.env[`OSS_${projectName.toUpperCase()}_BUCKET`] || process.env.OSS_BUCKET,
    region: process.env[`OSS_${projectName.toUpperCase()}_REGION`] || process.env.OSS_REGION || defaultConfig.region
  };
}

/**
 * 验证文件类型
 */
function isAllowedFileType(filename, category = null) {
  const ext = filename.toLowerCase().match(/\.[^.]*$/)?.[0];
  if (!ext) return false;
  
  if (category) {
    return defaultConfig.allowedFileTypes[category]?.includes(ext) || false;
  }
  
  // 检查所有类别
  return Object.values(defaultConfig.allowedFileTypes)
    .some(types => types.includes(ext));
}

/**
 * 验证文件大小
 */
function isAllowedFileSize(size) {
  return size <= defaultConfig.maxFileSize;
}

/**
 * 生成存储路径配置
 */
function getStoragePathConfig(projectName, type = 'default') {
  const project = projectPresets[projectName] || projectPresets.default;
  const structure = project.structure;
  
  return {
    basePath: project.baseDir,
    typePath: structure[type] || structure.uploads || 'uploads',
    fullPath: `${project.baseDir}/${structure[type] || 'uploads'}`
  };
}

module.exports = {
  defaultConfig,
  projectPresets,
  getProjectConfig,
  isAllowedFileType,
  isAllowedFileSize,
  getStoragePathConfig
};