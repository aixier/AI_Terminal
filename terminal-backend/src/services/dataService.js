import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import logger from '../utils/logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

class DataService {
  constructor() {
    this.dataPath = path.join(__dirname, '../data')
    this.historyPath = path.join(this.dataPath, 'history')
    this.userDataPath = path.join(this.dataPath, 'users')
    this.initialize()
  }

  async initialize() {
    try {
      // 确保必要的目录存在
      await this.ensureDirectory(this.historyPath)
      await this.ensureDirectory(this.userDataPath)
      logger.info('Data service initialized')
    } catch (error) {
      logger.error('Failed to initialize data service:', error)
    }
  }

  async ensureDirectory(dirPath) {
    try {
      await fs.access(dirPath)
    } catch {
      await fs.mkdir(dirPath, { recursive: true })
    }
  }

  // 读取命令配置
  async getCommands() {
    try {
      const data = await fs.readFile(path.join(this.dataPath, 'commands.json'), 'utf-8')
      return JSON.parse(data)
    } catch (error) {
      logger.error('Failed to read commands:', error)
      return { categories: [], commands: [] }
    }
  }

  // 读取系统配置
  async getSystemConfig() {
    try {
      const data = await fs.readFile(path.join(this.dataPath, 'system-config.json'), 'utf-8')
      return JSON.parse(data)
    } catch (error) {
      logger.error('Failed to read system config:', error)
      return {}
    }
  }

  // 获取用户设置
  async getUserSettings(userId) {
    try {
      const filePath = path.join(this.userDataPath, `${userId}-settings.json`)
      const data = await fs.readFile(filePath, 'utf-8')
      return JSON.parse(data)
    } catch (error) {
      // 如果用户设置不存在，创建默认设置
      return this.createDefaultUserSettings(userId)
    }
  }

  // 保存用户设置
  async saveUserSettings(userId, settings) {
    try {
      const filePath = path.join(this.userDataPath, `${userId}-settings.json`)
      await fs.writeFile(filePath, JSON.stringify(settings, null, 2))
      return true
    } catch (error) {
      logger.error('Failed to save user settings:', error)
      return false
    }
  }

  // 创建默认用户设置
  async createDefaultUserSettings(userId) {
    try {
      const templatePath = path.join(this.dataPath, 'user-settings-template.json')
      const template = await fs.readFile(templatePath, 'utf-8')
      const settings = JSON.parse(template)
      settings.userId = userId
      await this.saveUserSettings(userId, settings)
      return settings
    } catch (error) {
      logger.error('Failed to create default user settings:', error)
      return {}
    }
  }

  // 保存命令历史
  async saveCommandHistory(userId, command) {
    try {
      const date = new Date().toISOString().split('T')[0]
      const filePath = path.join(this.historyPath, `${userId}-${date}.json`)
      
      let history = []
      try {
        const data = await fs.readFile(filePath, 'utf-8')
        history = JSON.parse(data)
      } catch {
        // 文件不存在，创建新的
      }

      history.push({
        id: Date.now(),
        command: command.command,
        timestamp: new Date().toISOString(),
        success: command.success,
        output: command.output?.substring(0, 1000) // 限制输出长度
      })

      // 限制每日历史记录数量
      if (history.length > 1000) {
        history = history.slice(-1000)
      }

      await fs.writeFile(filePath, JSON.stringify(history, null, 2))
      return true
    } catch (error) {
      logger.error('Failed to save command history:', error)
      return false
    }
  }

  // 获取命令历史
  async getCommandHistory(userId, days = 7) {
    try {
      const history = []
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const date = d.toISOString().split('T')[0]
        const filePath = path.join(this.historyPath, `${userId}-${date}.json`)
        
        try {
          const data = await fs.readFile(filePath, 'utf-8')
          const dayHistory = JSON.parse(data)
          history.push(...dayHistory)
        } catch {
          // 文件不存在，跳过
        }
      }

      return history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    } catch (error) {
      logger.error('Failed to get command history:', error)
      return []
    }
  }

  // 验证命令是否在白名单中
  async validateCommand(command) {
    const commands = await this.getCommands()
    const systemConfig = await this.getSystemConfig()

    if (!systemConfig.features?.security?.commandWhitelist) {
      return { valid: true }
    }

    // 检查是否是预定义命令
    const cmd = commands.commands.find(c => c.command === command || c.command.startsWith(command.split(' ')[0]))
    
    if (!cmd) {
      return { 
        valid: false, 
        reason: '该命令不在白名单中' 
      }
    }

    if (cmd.danger && systemConfig.features?.security?.dangerousCommandConfirm) {
      return { 
        valid: true, 
        requireConfirm: true,
        message: '这是一个危险操作，请确认是否继续执行？'
      }
    }

    return { valid: true }
  }

  // 清理过期的历史记录
  async cleanupOldHistory(daysToKeep = 30) {
    try {
      const files = await fs.readdir(this.historyPath)
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

      for (const file of files) {
        if (file.endsWith('.json')) {
          const dateMatch = file.match(/\d{4}-\d{2}-\d{2}/)
          if (dateMatch) {
            const fileDate = new Date(dateMatch[0])
            if (fileDate < cutoffDate) {
              await fs.unlink(path.join(this.historyPath, file))
              logger.info(`Deleted old history file: ${file}`)
            }
          }
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup old history:', error)
    }
  }
}

export default new DataService()