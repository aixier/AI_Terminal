/**
 * 用户服务 - 管理用户认证和文件夹创建
 */

import fs from 'fs/promises'
import path from 'path'

class UserService {
  constructor() {
    // 根据环境确定用户数据文件路径
    const isDocker = process.env.NODE_ENV === 'production' || process.env.DATA_PATH
    
    if (isDocker && process.env.DATA_PATH) {
      // Docker环境，使用DATA_PATH
      this.usersFilePath = path.join(process.env.DATA_PATH, 'users.json')
    } else if (isDocker) {
      // Docker环境，使用默认路径
      this.usersFilePath = '/app/data/users.json'
    } else {
      // 本地开发环境，尝试多个可能的路径
      const possiblePaths = [
        path.join(process.cwd(), 'data', 'users.json'),
        path.join(process.cwd(), 'terminal-backend', 'data', 'users.json'),
        path.join(__dirname, '../../data/users.json'),
        '/mnt/d/work/AI_Terminal/terminal-backend/data/users.json'
      ]
      
      this.usersFilePath = possiblePaths[0]
      for (const testPath of possiblePaths) {
        try {
          require('fs').accessSync(testPath)
          this.usersFilePath = testPath
          break
        } catch {}
      }
    }
      
    console.log(`[UserService] Users file path: ${this.usersFilePath}`)
    console.log(`[UserService] Environment: NODE_ENV=${process.env.NODE_ENV}, DATA_PATH=${process.env.DATA_PATH}`)
  }

  /**
   * 加载用户数据
   */
  async loadUsers() {
    try {
      const data = await fs.readFile(this.usersFilePath, 'utf-8')
      return JSON.parse(data)
    } catch (error) {
      console.error('[UserService] Failed to load users:', error)
      throw new Error('用户数据加载失败')
    }
  }

  /**
   * 保存用户数据
   */
  async saveUsers(usersData) {
    try {
      await fs.writeFile(this.usersFilePath, JSON.stringify(usersData, null, 2), 'utf-8')
    } catch (error) {
      console.error('[UserService] Failed to save users:', error)
      throw new Error('用户数据保存失败')
    }
  }

  /**
   * 验证用户登录
   */
  async authenticate(username, password) {
    const usersData = await this.loadUsers()
    const user = usersData.users.find(u => 
      u.username === username && 
      u.password === password && 
      u.status === 'active'
    )

    if (user) {
      // 更新最后登录时间
      user.lastLogin = new Date().toISOString()
      await this.saveUsers(usersData)
      
      // 返回用户信息（不包含密码）
      const { password: _, ...userInfo } = user
      return userInfo
    }

    return null
  }

  /**
   * 根据用户名查找用户
   */
  async findUserByUsername(username) {
    const usersData = await this.loadUsers()
    const user = usersData.users.find(u => u.username === username)
    
    if (user) {
      const { password: _, ...userInfo } = user
      return userInfo
    }
    
    return null
  }

  /**
   * 根据token查找用户
   */
  async findUserByToken(token) {
    const usersData = await this.loadUsers()
    const user = usersData.users.find(u => u.token === token)
    
    if (user) {
      const { password: _, ...userInfo } = user
      return userInfo
    }
    
    return null
  }

  /**
   * 创建用户文件夹结构
   */
  async createUserFolder(username) {
    const isDocker = process.env.NODE_ENV === 'production' || process.env.DATA_PATH
    const dataPath = process.env.DATA_PATH || path.join(process.cwd(), 'data')
    
    const userPath = isDocker
      ? `/app/data/users/${username}`
      : path.join(dataPath, 'users', username)
    
    const foldersPath = path.join(userPath, 'folders')
    const defaultFolderPath = path.join(foldersPath, 'default-folder')
    const cardsPath = path.join(defaultFolderPath, 'cards')
    
    try {
      // 创建目录结构
      await fs.mkdir(userPath, { recursive: true })
      await fs.mkdir(foldersPath, { recursive: true })
      await fs.mkdir(defaultFolderPath, { recursive: true })
      await fs.mkdir(cardsPath, { recursive: true })
      
      // 创建默认文件夹元数据
      const metadata = {
        id: 'default-folder',
        name: 'Default Folder',
        description: `${username}的默认文件夹`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        cardCount: 0
      }
      
      const metadataPath = path.join(defaultFolderPath, 'metadata.json')
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8')
      
      console.log(`[UserService] ✅ User folder created for: ${username}`)
      return {
        userPath,
        defaultFolderPath,
        cardsPath
      }
      
    } catch (error) {
      console.error(`[UserService] Failed to create user folder for ${username}:`, error)
      throw new Error(`用户文件夹创建失败: ${error.message}`)
    }
  }

  /**
   * 检查用户文件夹是否存在
   */
  async userFolderExists(username) {
    const isDocker = process.env.NODE_ENV === 'production' || process.env.DATA_PATH
    const dataPath = process.env.DATA_PATH || path.join(process.cwd(), 'data')
    
    const userPath = isDocker
      ? `/app/data/users/${username}`
      : path.join(dataPath, 'users', username)
    
    try {
      const stats = await fs.stat(userPath)
      return stats.isDirectory()
    } catch {
      return false
    }
  }

  /**
   * 获取用户卡片路径
   */
  getUserCardPath(username, topic) {
    const sanitizedTopic = topic.trim().replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')
    const isDocker = process.env.NODE_ENV === 'production' || process.env.DATA_PATH
    
    return isDocker
      ? `/app/data/users/${username}/folders/default-folder/cards/${sanitizedTopic}`
      : path.join(process.cwd(), 'data', 'users', username, 'folders', 'default-folder', 'cards', sanitizedTopic)
  }

  /**
   * 获取所有用户列表（用于管理）
   */
  async getAllUsers() {
    const usersData = await this.loadUsers()
    return usersData.users.map(user => {
      const { password: _, ...userInfo } = user
      return userInfo
    })
  }
}

export default new UserService()