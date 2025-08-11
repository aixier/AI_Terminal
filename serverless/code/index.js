/**
 * 阿里云函数计算入口文件
 * AI Terminal Serverless Handler
 */

'use strict';

const path = require('path');
const fs = require('fs');

// 设置环境变量
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.DATA_PATH = process.env.DATA_PATH || '/tmp/data';
process.env.LOG_PATH = process.env.LOG_PATH || '/tmp/logs';
process.env.STATIC_PATH = process.env.STATIC_PATH || path.join(__dirname, 'static');

// 创建必要的目录
const ensureDirectories = () => {
  const dirs = [
    process.env.DATA_PATH,
    process.env.LOG_PATH,
    path.join(process.env.DATA_PATH, 'users', 'default', 'folders', 'default-folder', 'cards'),
    path.join(process.env.DATA_PATH, 'public_template'),
    path.join(process.env.DATA_PATH, 'history')
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  
  // 创建初始metadata文件
  const metadataPath = path.join(process.env.DATA_PATH, 'users', 'default', 'folders', 'default-folder', 'metadata.json');
  if (!fs.existsSync(metadataPath)) {
    fs.writeFileSync(metadataPath, JSON.stringify({
      id: 'default-folder',
      name: '默认文件夹',
      description: '默认卡片文件夹',
      cardCount: 0,
      color: '#0078d4',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, null, 2));
  }
};

// 初始化目录
ensureDirectories();

// 导入Express应用
let app;
let isInitialized = false;

const initializeApp = async () => {
  if (isInitialized) return app;
  
  const express = require('express');
  const cors = require('cors');
  const bodyParser = require('body-parser');
  
  app = express();
  
  // 中间件配置
  app.use(cors({
    origin: true,
    credentials: true
  }));
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));
  
  // 静态文件服务（前端）
  app.use(express.static(process.env.STATIC_PATH));
  
  // 导入后端路由
  const terminalRoutes = require('./terminal-backend/src/routes/terminal.js');
  const authRoutes = require('./terminal-backend/src/routes/auth.js');
  const commandsRoutes = require('./terminal-backend/src/routes/commands.js');
  const claudeRoutes = require('./terminal-backend/src/routes/claude.js');
  const sseRoutes = require('./terminal-backend/src/routes/sse.js');
  const previewRoutes = require('./terminal-backend/src/routes/preview.js');
  
  // 注册API路由
  app.use('/api/terminal', terminalRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/commands', commandsRoutes);
  app.use('/api/claude', claudeRoutes);
  app.use('/api/sse', sseRoutes);
  app.use('/api/preview', previewRoutes);
  
  // 健康检查
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      environment: 'aliyun-fc'
    });
  });
  
  // API状态
  app.get('/api/status', (req, res) => {
    res.json({
      status: 'running',
      version: '1.0.0',
      serverless: true,
      provider: 'aliyun-fc'
    });
  });
  
  // SPA路由支持
  app.get('*', (req, res) => {
    const indexPath = path.join(process.env.STATIC_PATH, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).json({ error: 'Frontend not found' });
    }
  });
  
  // 错误处理
  app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  });
  
  isInitialized = true;
  return app;
};

/**
 * HTTP触发器处理函数
 * @param {Object} req - HTTP请求对象
 * @param {Object} res - HTTP响应对象
 * @param {Object} context - 函数计算上下文
 */
exports.handler = async (req, res, context) => {
  console.log(`Received ${req.method} request to ${req.path}`);
  
  try {
    // 初始化应用
    const app = await initializeApp();
    
    // 处理请求
    return new Promise((resolve, reject) => {
      // 设置响应完成回调
      res.on('finish', () => resolve());
      res.on('error', reject);
      
      // 处理请求
      app(req, res);
    });
  } catch (error) {
    console.error('Handler error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

/**
 * 初始化函数（可选）
 * 在函数实例创建时调用一次
 */
exports.initializer = async (context) => {
  console.log('Function initializing...');
  
  // 预热应用
  await initializeApp();
  
  // 如果使用OSS，初始化OSS客户端
  if (process.env.OSS_BUCKET) {
    const OSS = require('ali-oss');
    global.ossClient = new OSS({
      region: process.env.OSS_REGION || 'oss-cn-hangzhou',
      accessKeyId: process.env.OSS_ACCESS_KEY_ID,
      accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
      bucket: process.env.OSS_BUCKET
    });
    console.log('OSS client initialized');
  }
  
  console.log('Function initialized successfully');
};

/**
 * 预停止函数（可选）
 * 在函数实例销毁前调用
 */
exports.preStop = async (context) => {
  console.log('Function stopping...');
  
  // 清理资源
  if (global.ossClient) {
    global.ossClient = null;
  }
  
  console.log('Function stopped');
};