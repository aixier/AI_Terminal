import express from 'express'
import userService from '../services/userService.js'

const router = express.Router()

// 用户登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body

    // 参数验证
    if (!username || !password) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '用户名和密码不能为空'
      })
    }

    // 验证用户凭据
    const user = await userService.authenticate(username, password)
    
    if (!user) {
      return res.status(401).json({
        code: 401,
        success: false,
        message: '用户名或密码错误'
      })
    }

    // 检查并创建用户文件夹
    const folderExists = await userService.userFolderExists(username)
    if (!folderExists) {
      console.log(`[Auth] Creating folder for new login user: ${username}`)
      await userService.createUserFolder(username)
    }

    // 使用用户的真实token
    const token = user.token

    res.json({
      code: 200,
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          email: user.email
        }
      },
      message: '登录成功'
    })
  } catch (error) {
    console.error('[Auth] Login error:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: error.message || '登录服务错误'
    })
  }
})

// 验证token
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return res.status(401).json({
        code: 401,
        success: false,
        message: '未提供token'
      })
    }

    // 使用token查找用户
    const user = await userService.findUserByToken(token)
    
    if (!user) {
      return res.status(401).json({
        code: 401,
        success: false,
        message: 'Token无效或已过期'
      })
    }

    res.json({
      code: 200,
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          email: user.email
        }
      },
      message: 'Token有效'
    })
  } catch (error) {
    console.error('[Auth] Verify error:', error)
    res.status(401).json({
      code: 401,
      success: false,
      message: 'Token验证失败'
    })
  }
})

// 获取用户列表（用于管理）
router.get('/users', async (req, res) => {
  try {
    const users = await userService.getAllUsers()
    res.json({
      code: 200,
      success: true,
      data: { users },
      message: '获取用户列表成功'
    })
  } catch (error) {
    console.error('[Auth] Get users error:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '获取用户列表失败'
    })
  }
})

export default router