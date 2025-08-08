import jwt from 'jsonwebtoken'
import config from '../config/config.js'
import logger from '../utils/logger.js'

// 验证JWT token
export const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  
  if (!token) {
    return res.status(401).json({
      code: 401,
      message: '未提供认证令牌'
    })
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret)
    req.user = decoded
    next()
  } catch (error) {
    logger.warn('Invalid token attempt:', { token: token.substring(0, 20) + '...', error: error.message })
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        code: 401,
        message: '认证令牌已过期'
      })
    }
    
    return res.status(401).json({
      code: 401,
      message: '无效的认证令牌'
    })
  }
}

// 可选的token验证（不强制要求）
export const optionalAuth = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  
  if (token) {
    try {
      const decoded = jwt.verify(token, config.jwt.secret)
      req.user = decoded
    } catch (error) {
      // 忽略无效token，继续处理请求
      req.user = null
    }
  } else {
    req.user = null
  }
  
  next()
}

// 检查用户角色
export const requireRole = (requiredRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        code: 401,
        message: '需要登录'
      })
    }

    const userRole = req.user.role || 'user'
    const roleHierarchy = {
      'admin': 3,
      'user': 2,
      'guest': 1
    }

    if (roleHierarchy[userRole] < roleHierarchy[requiredRole]) {
      logger.warn('Insufficient permissions:', { 
        userId: req.user.id, 
        userRole, 
        requiredRole 
      })
      
      return res.status(403).json({
        code: 403,
        message: '权限不足'
      })
    }

    next()
  }
}

// 刷新token
export const refreshToken = (req, res, next) => {
  const oldToken = req.headers.authorization?.replace('Bearer ', '')
  
  if (!oldToken) {
    return res.status(401).json({
      code: 401,
      message: '未提供原始令牌'
    })
  }

  try {
    // 验证旧token（忽略过期）
    const decoded = jwt.verify(oldToken, config.jwt.secret, { ignoreExpiration: true })
    
    // 生成新token
    const newToken = jwt.sign(
      { 
        id: decoded.id, 
        username: decoded.username, 
        role: decoded.role 
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expireTime }
    )

    res.json({
      code: 200,
      data: { token: newToken },
      message: '令牌已刷新'
    })
  } catch (error) {
    return res.status(401).json({
      code: 401,
      message: '无法刷新令牌'
    })
  }
}