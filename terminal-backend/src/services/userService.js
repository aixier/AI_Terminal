/**
 * 用户服务 - 管理用户认证和文件夹创建
 */

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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
   * 创建用户workspace结构
   */
  async createUserWorkspace(username) {
    const isDocker = process.env.NODE_ENV === 'production' || process.env.DATA_PATH
    const dataPath = process.env.DATA_PATH || path.join(process.cwd(), 'data')
    
    const userPath = isDocker
      ? `/app/data/users/${username}`
      : path.join(dataPath, 'users', username)
    
    const workspacePath = path.join(userPath, 'workspace')
    const cardPath = path.join(workspacePath, 'card')
    const markdownPath = path.join(workspacePath, 'markdown')
    const templatesPath = path.join(workspacePath, 'templates')
    const storagePath = path.join(workspacePath, 'storage')
    
    try {
      // 创建新的workspace目录结构
      await fs.mkdir(userPath, { recursive: true })
      await fs.mkdir(workspacePath, { recursive: true })
      await fs.mkdir(cardPath, { recursive: true })
      await fs.mkdir(markdownPath, { recursive: true })
      await fs.mkdir(templatesPath, { recursive: true })
      await fs.mkdir(storagePath, { recursive: true })
      
      // 创建用户设置文件
      const settings = {
        theme: 'dark',
        language: 'zh-CN',
        autoSave: true,
        defaultWorkspace: 'workspace',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      
      const settingsPath = path.join(userPath, 'settings.json')
      await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8')
      
      // 创建文件夹组织配置
      const folders = {
        folders: [
          {
            id: 'default-cards',
            name: '📁 卡片收集',
            description: '默认卡片文件夹',
            color: '#2196f3',
            files: []
          },
          {
            id: 'default-notes', 
            name: '📝 笔记文档',
            description: '默认笔记文件夹',
            color: '#4caf50',
            files: []
          }
        ]
      }
      
      const foldersPath = path.join(userPath, 'folders.json')
      await fs.writeFile(foldersPath, JSON.stringify(folders, null, 2), 'utf-8')
      
      console.log(`[UserService] ✅ User workspace created for: ${username}`)
      return {
        userPath,
        workspacePath,
        cardPath,
        markdownPath,
        templatesPath,
        storagePath
      }
      
    } catch (error) {
      console.error(`[UserService] Failed to create user workspace for ${username}:`, error)
      throw new Error(`用户工作空间创建失败: ${error.message}`)
    }
  }

  /**
   * 创建用户文件夹结构（兼容旧接口）
   */
  async createUserFolder(username) {
    return this.createUserWorkspace(username)
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
   * 获取用户workspace路径
   */
  getUserWorkspacePath(username) {
    const isDocker = process.env.NODE_ENV === 'production' || process.env.DATA_PATH
    const dataPath = process.env.DATA_PATH || path.join(process.cwd(), 'data')
    
    const userPath = isDocker
      ? `/app/data/users/${username}`
      : path.join(dataPath, 'users', username)
    
    return {
      userPath,
      workspacePath: path.join(userPath, 'workspace'),
      cardPath: path.join(userPath, 'workspace', 'card'),
      markdownPath: path.join(userPath, 'workspace', 'markdown'),
      templatesPath: path.join(userPath, 'workspace', 'templates'),
      storagePath: path.join(userPath, 'workspace', 'storage'),
      settingsPath: path.join(userPath, 'settings.json'),
      foldersPath: path.join(userPath, 'folders.json')
    }
  }

  /**
   * 获取用户卡片路径（兼容旧接口）
   */
  getUserCardPath(username, topic) {
    const sanitizedTopic = topic.trim().replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')
    const { cardPath } = this.getUserWorkspacePath(username)
    return path.join(cardPath, sanitizedTopic)
  }

  /**
   * 迁移用户数据到workspace结构
   */
  async migrateToWorkspace(username) {
    const { userPath, workspacePath, cardPath, markdownPath } = this.getUserWorkspacePath(username)
    const oldFoldersPath = path.join(userPath, 'folders')
    
    try {
      // 检查是否需要迁移
      const workspaceExists = await fs.access(workspacePath).then(() => true).catch(() => false)
      const oldFoldersExists = await fs.access(oldFoldersPath).then(() => true).catch(() => false)
      
      if (workspaceExists || !oldFoldersExists) {
        console.log(`[UserService] No migration needed for ${username}`)
        return
      }
      
      console.log(`[UserService] Starting migration for ${username}`)
      
      // 创建workspace结构
      await this.createUserWorkspace(username)
      
      // 获取所有旧文件夹
      const folders = await fs.readdir(oldFoldersPath)
      const migrationFiles = []
      
      for (const folderName of folders) {
        const folderPath = path.join(oldFoldersPath, folderName)
        const cardsPath = path.join(folderPath, 'cards')
        
        // 检查是否存在cards目录
        const cardsExists = await fs.access(cardsPath).then(() => true).catch(() => false)
        if (!cardsExists) continue
        
        // 获取所有cards
        const cards = await fs.readdir(cardsPath)
        
        for (const cardName of cards) {
          const cardItemPath = path.join(cardsPath, cardName)
          const stat = await fs.stat(cardItemPath)
          
          if (stat.isFile()) {
            // 处理单个文件
            const ext = path.extname(cardName).toLowerCase()
            const targetDir = ext === '.md' ? markdownPath : cardPath
            const targetPath = path.join(targetDir, cardName)
            
            await fs.copyFile(cardItemPath, targetPath)
            migrationFiles.push({ from: cardItemPath, to: targetPath, type: 'file' })
            
          } else if (stat.isDirectory()) {
            // 处理文件夹
            const targetPath = path.join(cardPath, cardName)
            await this.copyDirectory(cardItemPath, targetPath)
            migrationFiles.push({ from: cardItemPath, to: targetPath, type: 'directory' })
          }
        }
      }
      
      console.log(`[UserService] ✅ Migration completed for ${username}, moved ${migrationFiles.length} items`)
      
      // 备份旧结构
      const backupPath = path.join(userPath, 'folders_backup')
      await fs.rename(oldFoldersPath, backupPath)
      console.log(`[UserService] Old folders backed up to: ${backupPath}`)
      
      return migrationFiles
      
    } catch (error) {
      console.error(`[UserService] Migration failed for ${username}:`, error)
      throw new Error(`数据迁移失败: ${error.message}`)
    }
  }

  /**
   * 递归复制目录
   */
  async copyDirectory(src, dest) {
    await fs.mkdir(dest, { recursive: true })
    const entries = await fs.readdir(src)
    
    for (const entry of entries) {
      const srcPath = path.join(src, entry)
      const destPath = path.join(dest, entry)
      const stat = await fs.stat(srcPath)
      
      if (stat.isDirectory()) {
        await this.copyDirectory(srcPath, destPath)
      } else {
        await fs.copyFile(srcPath, destPath)
      }
    }
  }

  /**
   * 检查并创建用户workspace目录（登录时调用）
   */
  async ensureUserWorkspace(username) {
    const { userPath, workspacePath, cardPath, markdownPath, templatesPath, storagePath } = this.getUserWorkspacePath(username)
    
    try {
      // 检查每个目录是否存在，不存在则创建
      const dirsToCheck = [
        { path: userPath, name: '用户根目录' },
        { path: workspacePath, name: 'workspace' },
        { path: cardPath, name: 'card' },
        { path: markdownPath, name: 'markdown' },
        { path: templatesPath, name: 'templates' },
        { path: storagePath, name: 'storage' }
      ]
      
      const created = []
      
      for (const dir of dirsToCheck) {
        try {
          await fs.access(dir.path)
          // 目录存在，跳过
        } catch {
          // 目录不存在，创建
          await fs.mkdir(dir.path, { recursive: true })
          created.push(dir.name)
          console.log(`[UserService] Created ${dir.name}: ${dir.path}`)
        }
      }
      
      // 检查并创建用户设置文件
      const settingsPath = path.join(userPath, 'settings.json')
      try {
        await fs.access(settingsPath)
      } catch {
        const settings = {
          theme: 'dark',
          language: 'zh-CN',
          autoSave: true,
          defaultWorkspace: 'workspace',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8')
        created.push('settings.json')
        console.log(`[UserService] Created settings.json for ${username}`)
      }
      
      // 检查并创建文件夹配置文件
      const foldersPath = path.join(userPath, 'folders.json')
      try {
        await fs.access(foldersPath)
      } catch {
        const folders = {
          folders: [
            {
              id: 'default-cards',
              name: '📁 卡片收集',
              description: '默认卡片文件夹',
              color: '#2196f3',
              files: []
            },
            {
              id: 'default-notes', 
              name: '📝 笔记文档',
              description: '默认笔记文件夹',
              color: '#4caf50',
              files: []
            }
          ]
        }
        await fs.writeFile(foldersPath, JSON.stringify(folders, null, 2), 'utf-8')
        created.push('folders.json')
        console.log(`[UserService] Created folders.json for ${username}`)
      }
      
      if (created.length > 0) {
        console.log(`[UserService] ✅ Ensured workspace for ${username}, created: ${created.join(', ')}`)
      } else {
        console.log(`[UserService] ✅ Workspace already exists for ${username}`)
      }
      
      return {
        userPath,
        workspacePath,
        cardPath,
        markdownPath,
        templatesPath,
        storagePath,
        settingsPath,
        foldersPath,
        created
      }
      
    } catch (error) {
      console.error(`[UserService] Failed to ensure workspace for ${username}:`, error)
      throw new Error(`用户工作空间检查失败: ${error.message}`)
    }
  }

  /**
   * 获取用户模板路径
   */
  getUserTemplatePath(username, templateName) {
    const { templatesPath } = this.getUserWorkspacePath(username)
    return path.join(templatesPath, templateName)
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