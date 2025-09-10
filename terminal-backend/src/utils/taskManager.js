import fs from 'fs/promises'
import path from 'path'

/**
 * Pod2Post任务管理器
 * 负责管理任务目录的生命周期和清理
 */
class TaskManager {
  constructor() {
    // 任务过期时间（30分钟）
    this.TASK_EXPIRY_MINUTES = 30
    // 清理间隔（10分钟）
    this.CLEANUP_INTERVAL_MINUTES = 10
    // 清理定时器
    this.cleanupTimer = null
  }

  /**
   * 验证任务ID格式
   * @param {string} taskId 
   * @returns {boolean}
   */
  isValidTaskId(taskId) {
    if (!taskId || typeof taskId !== 'string') {
      return false
    }
    
    // 格式：pod2post_{timestamp}_{random}
    const pattern = /^pod2post_\d+_[a-z0-9]+$/
    return pattern.test(taskId)
  }

  /**
   * 从任务ID提取时间戳
   * @param {string} taskId 
   * @returns {number|null}
   */
  extractTimestamp(taskId) {
    if (!this.isValidTaskId(taskId)) {
      return null
    }
    
    const parts = taskId.split('_')
    const timestamp = parseInt(parts[1])
    
    return isNaN(timestamp) ? null : timestamp
  }

  /**
   * 检查任务是否过期
   * @param {string} taskId 
   * @returns {boolean}
   */
  isTaskExpired(taskId) {
    const timestamp = this.extractTimestamp(taskId)
    if (!timestamp) {
      return true // 无效的taskId视为过期
    }
    
    const now = Date.now()
    const expiryTime = this.TASK_EXPIRY_MINUTES * 60 * 1000
    
    return (now - timestamp) > expiryTime
  }

  /**
   * 获取用户的任务目录路径
   * @param {string} username 
   * @param {string} taskId 
   * @returns {Promise<string>}
   */
  async getTaskPath(username, taskId) {
    const userService = await import('../services/userService.js')
    const templatePath = userService.default.getUserTemplatePath(username, 'pod2post')
    return path.join(templatePath, 'tasks', taskId)
  }

  /**
   * 创建任务目录
   * @param {string} username 
   * @param {string} taskId 
   * @param {string} subDir - 子目录名（CDN/photos/resources）
   * @returns {Promise<string>} 创建的目录路径
   */
  async createTaskDirectory(username, taskId, subDir = null) {
    const taskPath = await this.getTaskPath(username, taskId)
    const fullPath = subDir ? path.join(taskPath, subDir) : taskPath
    
    await fs.mkdir(fullPath, { recursive: true })
    console.log(`[TaskManager] Created task directory: ${fullPath}`)
    
    return fullPath
  }

  /**
   * 删除任务目录
   * @param {string} username 
   * @param {string} taskId 
   */
  async deleteTaskDirectory(username, taskId) {
    const taskPath = await this.getTaskPath(username, taskId)
    
    try {
      const exists = await fs.access(taskPath).then(() => true).catch(() => false)
      if (exists) {
        await fs.rm(taskPath, { recursive: true, force: true })
        console.log(`[TaskManager] Deleted task directory: ${taskPath}`)
      }
    } catch (error) {
      console.error(`[TaskManager] Failed to delete task directory ${taskPath}:`, error.message)
    }
  }

  /**
   * 清理过期的任务目录
   * @param {string} username 
   */
  async cleanupExpiredTasks(username) {
    const userService = await import('../services/userService.js')
    const templatePath = userService.default.getUserTemplatePath(username, 'pod2post')
    const tasksPath = path.join(templatePath, 'tasks')
    
    try {
      // 检查tasks目录是否存在
      const exists = await fs.access(tasksPath).then(() => true).catch(() => false)
      if (!exists) {
        return
      }
      
      // 读取所有任务目录
      const entries = await fs.readdir(tasksPath, { withFileTypes: true })
      const taskDirs = entries.filter(entry => entry.isDirectory())
      
      let cleanedCount = 0
      for (const dir of taskDirs) {
        const taskId = dir.name
        
        // 检查任务是否过期
        if (this.isTaskExpired(taskId)) {
          await this.deleteTaskDirectory(username, taskId)
          cleanedCount++
        }
      }
      
      if (cleanedCount > 0) {
        console.log(`[TaskManager] Cleaned ${cleanedCount} expired task(s) for user ${username}`)
      }
      
    } catch (error) {
      console.error(`[TaskManager] Failed to cleanup expired tasks for ${username}:`, error.message)
    }
  }

  /**
   * 清理所有用户的过期任务
   */
  async cleanupAllExpiredTasks() {
    console.log('[TaskManager] Starting global expired tasks cleanup...')
    
    try {
      // 获取data目录路径
      const isDocker = process.env.NODE_ENV === 'production' || process.env.DATA_PATH
      const dataPath = isDocker ? '/app/data' : path.join(process.cwd(), 'data')
      const usersPath = path.join(dataPath, 'users')
      
      // 读取所有用户目录
      const userDirs = await fs.readdir(usersPath, { withFileTypes: true })
      
      for (const userDir of userDirs) {
        if (userDir.isDirectory()) {
          const username = userDir.name
          await this.cleanupExpiredTasks(username)
        }
      }
      
      console.log('[TaskManager] Global expired tasks cleanup completed')
      
    } catch (error) {
      console.error('[TaskManager] Failed to cleanup all expired tasks:', error.message)
    }
  }

  /**
   * 启动定期清理任务
   */
  startPeriodicCleanup() {
    if (this.cleanupTimer) {
      console.log('[TaskManager] Periodic cleanup already running')
      return
    }
    
    const intervalMs = this.CLEANUP_INTERVAL_MINUTES * 60 * 1000
    
    // 立即执行一次清理
    this.cleanupAllExpiredTasks()
    
    // 设置定期清理
    this.cleanupTimer = setInterval(() => {
      this.cleanupAllExpiredTasks()
    }, intervalMs)
    
    console.log(`[TaskManager] Started periodic cleanup (every ${this.CLEANUP_INTERVAL_MINUTES} minutes)`)
  }

  /**
   * 停止定期清理任务
   */
  stopPeriodicCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
      console.log('[TaskManager] Stopped periodic cleanup')
    }
  }

  /**
   * 获取任务统计信息
   * @param {string} username 
   * @returns {Promise<Object>}
   */
  async getTaskStats(username) {
    const userService = await import('../services/userService.js')
    const templatePath = userService.default.getUserTemplatePath(username, 'pod2post')
    const tasksPath = path.join(templatePath, 'tasks')
    
    const stats = {
      totalTasks: 0,
      activeTasks: 0,
      expiredTasks: 0,
      totalSize: 0
    }
    
    try {
      const exists = await fs.access(tasksPath).then(() => true).catch(() => false)
      if (!exists) {
        return stats
      }
      
      const entries = await fs.readdir(tasksPath, { withFileTypes: true })
      const taskDirs = entries.filter(entry => entry.isDirectory())
      
      for (const dir of taskDirs) {
        const taskId = dir.name
        stats.totalTasks++
        
        if (this.isTaskExpired(taskId)) {
          stats.expiredTasks++
        } else {
          stats.activeTasks++
        }
        
        // 计算目录大小（简化版）
        const taskPath = path.join(tasksPath, taskId)
        const size = await this.getDirectorySize(taskPath)
        stats.totalSize += size
      }
      
    } catch (error) {
      console.error(`[TaskManager] Failed to get task stats for ${username}:`, error.message)
    }
    
    return stats
  }

  /**
   * 获取目录大小
   * @param {string} dirPath 
   * @returns {Promise<number>} 大小（字节）
   */
  async getDirectorySize(dirPath) {
    let totalSize = 0
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)
        
        if (entry.isDirectory()) {
          totalSize += await this.getDirectorySize(fullPath)
        } else if (entry.isFile()) {
          const stats = await fs.stat(fullPath)
          totalSize += stats.size
        }
      }
    } catch (error) {
      // 忽略错误，返回当前累计大小
    }
    
    return totalSize
  }
}

// 创建单例实例
const taskManager = new TaskManager()

export default taskManager