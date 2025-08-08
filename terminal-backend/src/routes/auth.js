import express from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import config from '../config/config.js'

const router = express.Router()

// 临时用户数据（实际应该使用数据库）
const users = [
  {
    id: 1,
    username: 'admin',
    password: '$2a$10$YourHashedPasswordHere', // 密码: admin123
    role: 'admin'
  }
]

// 登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body

    // 查找用户
    const user = users.find(u => u.username === username)
    if (!user) {
      return res.status(401).json({
        code: 401,
        message: '用户名或密码错误'
      })
    }

    // 验证密码（暂时使用明文比较，实际应该使用bcrypt）
    // const isValidPassword = await bcrypt.compare(password, user.password)
    const isValidPassword = password === 'admin123' // 临时处理

    if (!isValidPassword) {
      return res.status(401).json({
        code: 401,
        message: '用户名或密码错误'
      })
    }

    // 生成JWT
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      config.jwt.secret,
      { expiresIn: config.jwt.expireTime }
    )

    res.json({
      code: 200,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        }
      },
      message: '登录成功'
    })
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: error.message
    })
  }
})

// 验证token
router.get('/verify', (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return res.status(401).json({
        code: 401,
        message: '未提供token'
      })
    }

    const decoded = jwt.verify(token, config.jwt.secret)
    res.json({
      code: 200,
      data: decoded,
      message: 'Token有效'
    })
  } catch (error) {
    res.status(401).json({
      code: 401,
      message: 'Token无效或已过期'
    })
  }
})

export default router