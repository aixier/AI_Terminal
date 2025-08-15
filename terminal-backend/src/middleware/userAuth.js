/**
 * 用户认证中间件
 */

import userService from '../services/userService.js'

/**
 * JWT token 验证中间件（简化版）
 * 实际项目中应该使用真正的JWT
 */
export const authenticateUser = async (req, res, next) => {
  try {
    // 从header中获取token（简化版：直接使用username）
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        code: 401,
        success: false,
        message: '未提供认证令牌'
      })
    }

    // 使用token查找用户
    const token = authHeader.replace('Bearer ', '')
    
    // 验证token是否存在
    const user = await userService.findUserByToken(token)
    if (!user) {
      return res.status(401).json({
        code: 401,
        success: false,
        message: '无效的用户令牌'
      })
    }

    // 将用户信息添加到请求对象
    req.user = user
    next()
    
  } catch (error) {
    console.error('[UserAuth] Authentication error:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '认证服务错误'
    })
  }
}

/**
 * 可选用户认证中间件（允许匿名访问，但如果有token则验证）
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '')
      const user = await userService.findUserByToken(token)
      
      if (user) {
        req.user = user
      }
    }
    
    // 无论是否有用户，都继续处理
    next()
    
  } catch (error) {
    console.error('[UserAuth] Optional auth error:', error)
    // 可选认证出错时，不阻止请求继续
    next()
  }
}

/**
 * 可选用户认证中间件（支持默认用户）
 * 用于generate API，如果没有token则使用default用户
 */
export const authenticateUserOrDefault = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // 有token，使用标准认证流程
      const token = authHeader.replace('Bearer ', '')
      const user = await userService.findUserByToken(token)
      
      if (user) {
        req.user = user
        next()
        return
      }
    }
    
    // 没有token或token无效，使用默认用户
    console.log('[UserAuth] No valid token provided, using default user')
    const defaultUser = await userService.findUserByUsername('default')
    
    if (!defaultUser) {
      return res.status(500).json({
        code: 500,
        success: false,
        message: '系统默认用户不存在'
      })
    }
    
    req.user = defaultUser
    next()
    
  } catch (error) {
    console.error('[UserAuth] Authentication error:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '认证服务错误'
    })
  }
}

/**
 * SSE专用认证中间件（支持查询参数token）
 */
export const authenticateSSE = async (req, res, next) => {
  try {
    // 从header或查询参数中获取token
    let token = null
    
    // 先尝试从Authorization header获取
    const authHeader = req.headers.authorization
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.replace('Bearer ', '')
    }
    
    // 如果header中没有，尝试从查询参数获取
    if (!token && req.query.token) {
      token = req.query.token
    }
    
    if (!token) {
      return res.status(401).json({
        code: 401,
        success: false,
        message: '未提供认证令牌'
      })
    }

    // 验证token是否存在
    const user = await userService.findUserByToken(token)
    if (!user) {
      return res.status(401).json({
        code: 401,
        success: false,
        message: '无效的用户令牌'
      })
    }

    // 将用户信息添加到请求对象
    req.user = user
    next()
    
  } catch (error) {
    console.error('[UserAuth] SSE Authentication error:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '认证服务错误'
    })
  }
}

/**
 * 确保用户文件夹存在的中间件
 */
export const ensureUserFolder = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        code: 401,
        success: false,
        message: '需要用户认证'
      })
    }

    const { username } = req.user
    
    // 检查用户文件夹是否存在
    const folderExists = await userService.userFolderExists(username)
    
    if (!folderExists) {
      console.log(`[UserAuth] Creating folder for user: ${username}`)
      await userService.createUserFolder(username)
    }

    next()
    
  } catch (error) {
    console.error('[UserAuth] Ensure user folder error:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '用户文件夹初始化失败'
    })
  }
}