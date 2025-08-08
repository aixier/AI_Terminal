import logger from '../utils/logger.js'
import dataService from '../services/dataService.js'
import config from '../config/config.js'

// 命令注入防护
export const preventCommandInjection = (req, res, next) => {
  // 检查是否是卡片生成相关的API
  if (req.body && req.body.type && (req.body.type === 'generate-json' || req.body.type === 'generate-card')) {
    // 卡片生成命令允许中文和一些特殊字符
    return next()
  }
  
  const dangerousPatterns = [
    /[;&|`$(){}[\]<>]/g,  // 危险的shell元字符
    /\.\.\//g,            // 路径遍历
    /(?:^|[^\\])\\n/g,    // 未转义的换行符
    /(?:^|[^\\])\\r/g,    // 未转义的回车符
  ]

  const checkValue = (value) => {
    if (typeof value === 'string') {
      for (const pattern of dangerousPatterns) {
        if (pattern.test(value)) {
          return false
        }
      }
    }
    return true
  }

  // 检查请求体
  const checkObject = (obj) => {
    for (const key in obj) {
      const value = obj[key]
      if (typeof value === 'object' && value !== null) {
        if (!checkObject(value)) return false
      } else if (!checkValue(value)) {
        return false
      }
    }
    return true
  }

  if (req.body && !checkObject(req.body)) {
    logger.warn(`Command injection attempt detected from ${req.ip}`)
    return res.status(400).json({
      code: 400,
      message: '检测到潜在的命令注入攻击'
    })
  }

  next()
}

// 命令白名单验证
export const validateCommandWhitelist = async (req, res, next) => {
  const { command } = req.body

  if (!command) {
    return next()
  }

  try {
    const validation = await dataService.validateCommand(command)
    
    if (!validation.valid) {
      return res.status(403).json({
        code: 403,
        message: validation.reason || '命令不在白名单中'
      })
    }

    // 将验证结果附加到请求对象
    req.commandValidation = validation
    next()
  } catch (error) {
    logger.error('Command validation error:', error)
    return res.status(500).json({
      code: 500,
      message: '命令验证失败'
    })
  }
}

// 限制请求大小
export const limitRequestSize = (req, res, next) => {
  const contentLength = parseInt(req.headers['content-length'] || '0')
  const maxSize = 1024 * 1024 // 1MB

  if (contentLength > maxSize) {
    return res.status(413).json({
      code: 413,
      message: '请求体过大'
    })
  }

  next()
}

// 审计日志记录
export const auditLog = (req, res, next) => {
  const startTime = Date.now()
  
  // 记录请求信息
  const requestInfo = {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    userId: req.headers['x-user-id'] || 'anonymous',
    timestamp: new Date().toISOString()
  }

  // 记录响应信息
  const originalSend = res.send
  res.send = function(data) {
    const responseTime = Date.now() - startTime
    const auditEntry = {
      ...requestInfo,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      command: req.body?.command
    }

    // 只记录重要操作
    if (req.path.includes('/terminal') || req.path.includes('/command')) {
      logger.info('Audit log:', auditEntry)
    }

    originalSend.call(this, data)
  }

  next()
}

// 速率限制
const requestCounts = new Map()

export const rateLimit = (req, res, next) => {
  const key = `${req.ip}:${req.path}`
  const now = Date.now()
  const windowMs = 60000 // 1分钟
  const maxRequests = 100

  // 清理过期的记录
  for (const [k, v] of requestCounts.entries()) {
    if (now - v.startTime > windowMs) {
      requestCounts.delete(k)
    }
  }

  // 检查当前请求
  const record = requestCounts.get(key)
  if (record) {
    if (now - record.startTime <= windowMs) {
      record.count++
      if (record.count > maxRequests) {
        return res.status(429).json({
          code: 429,
          message: '请求过于频繁，请稍后再试'
        })
      }
    } else {
      // 重置计数
      requestCounts.set(key, { startTime: now, count: 1 })
    }
  } else {
    requestCounts.set(key, { startTime: now, count: 1 })
  }

  next()
}

// 验证用户权限
export const checkPermission = (requiredRole) => {
  return (req, res, next) => {
    const userRole = req.user?.role || 'guest'
    
    const roleHierarchy = {
      'admin': 3,
      'user': 2,
      'guest': 1
    }

    if (roleHierarchy[userRole] < roleHierarchy[requiredRole]) {
      return res.status(403).json({
        code: 403,
        message: '权限不足'
      })
    }

    next()
  }
}