import fs from 'fs'
import path from 'path'
import { promises as fsPromises } from 'fs'
import logger from '../../utils/logger.js'

class TaskManager {
  constructor() {
    this.tasks = new Map()
    this.taskDataDir = path.join(process.cwd(), 'data', 'transcription', 'tasks')
    this.initializeStorage()
  }

  async initializeStorage() {
    try {
      await fsPromises.mkdir(this.taskDataDir, { recursive: true })
      await this.loadPersistedTasks()
    } catch (error) {
      logger.error('Failed to initialize task storage:', error)
    }
  }

  /**
   * 加载持久化的任务数据
   */
  async loadPersistedTasks() {
    try {
      const files = await fsPromises.readdir(this.taskDataDir)
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const taskId = file.replace('.json', '')
          const filePath = path.join(this.taskDataDir, file)
          const data = await fsPromises.readFile(filePath, 'utf8')
          const task = JSON.parse(data)
          
          // 只加载24小时内的任务
          const taskAge = Date.now() - new Date(task.createdAt).getTime()
          if (taskAge < 24 * 60 * 60 * 1000) {
            this.tasks.set(taskId, task)
          } else {
            // 删除过期任务文件
            await fsPromises.unlink(filePath).catch(() => {})
          }
        }
      }
      
      logger.info(`Loaded ${this.tasks.size} persisted tasks`)
    } catch (error) {
      logger.error('Error loading persisted tasks:', error)
    }
  }

  /**
   * 创建新任务
   */
  async createTask(type, params = {}) {
    const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    const task = {
      taskId,
      type, // 'file', 'url', 'batch'
      status: 'pending', // pending, processing, succeeded, failed
      progress: 0,
      params,
      result: null,
      error: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      logs: []
    }

    this.tasks.set(taskId, task)
    await this.persistTask(taskId, task)
    
    return taskId
  }

  /**
   * 更新任务状态
   */
  async updateTask(taskId, updates) {
    const task = this.tasks.get(taskId)
    if (!task) {
      throw new Error(`Task ${taskId} not found`)
    }

    const updatedTask = {
      ...task,
      ...updates,
      updatedAt: new Date().toISOString()
    }

    // 记录状态变化
    if (updates.status && updates.status !== task.status) {
      updatedTask.logs = updatedTask.logs || []
      updatedTask.logs.push({
        timestamp: new Date().toISOString(),
        event: 'status_change',
        from: task.status,
        to: updates.status,
        message: updates.message
      })

      if (updates.status === 'processing' && !updatedTask.startedAt) {
        updatedTask.startedAt = new Date().toISOString()
      }
      
      if (['succeeded', 'failed'].includes(updates.status) && !updatedTask.completedAt) {
        updatedTask.completedAt = new Date().toISOString()
      }
    }

    this.tasks.set(taskId, updatedTask)
    await this.persistTask(taskId, updatedTask)
    
    return updatedTask
  }

  /**
   * 获取任务状态
   */
  getTask(taskId) {
    const task = this.tasks.get(taskId)
    if (!task) {
      return null
    }
    
    // 计算任务执行时间
    if (task.startedAt) {
      const endTime = task.completedAt || new Date().toISOString()
      task.executionTime = new Date(endTime) - new Date(task.startedAt)
    }
    
    return task
  }

  /**
   * 获取所有任务列表
   */
  getAllTasks(filter = {}) {
    const tasks = Array.from(this.tasks.values())
    
    let filtered = tasks
    
    // 按状态过滤
    if (filter.status) {
      filtered = filtered.filter(t => t.status === filter.status)
    }
    
    // 按类型过滤
    if (filter.type) {
      filtered = filtered.filter(t => t.type === filter.type)
    }
    
    // 按时间范围过滤
    if (filter.since) {
      const sinceDate = new Date(filter.since)
      filtered = filtered.filter(t => new Date(t.createdAt) >= sinceDate)
    }
    
    // 排序（默认按创建时间倒序）
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    
    // 分页
    const page = filter.page || 1
    const limit = filter.limit || 20
    const start = (page - 1) * limit
    const end = start + limit
    
    return {
      tasks: filtered.slice(start, end),
      total: filtered.length,
      page,
      limit,
      hasMore: end < filtered.length
    }
  }

  /**
   * 添加任务日志
   */
  async addLog(taskId, event, message, data = {}) {
    const task = this.tasks.get(taskId)
    if (!task) return
    
    const log = {
      timestamp: new Date().toISOString(),
      event,
      message,
      ...data
    }
    
    task.logs = task.logs || []
    task.logs.push(log)
    
    await this.persistTask(taskId, task)
  }

  /**
   * 持久化任务数据
   */
  async persistTask(taskId, task) {
    try {
      const filePath = path.join(this.taskDataDir, `${taskId}.json`)
      await fsPromises.writeFile(filePath, JSON.stringify(task, null, 2))
    } catch (error) {
      logger.error(`Failed to persist task ${taskId}:`, error)
    }
  }

  /**
   * 删除任务
   */
  async deleteTask(taskId) {
    this.tasks.delete(taskId)
    
    try {
      const filePath = path.join(this.taskDataDir, `${taskId}.json`)
      await fsPromises.unlink(filePath)
    } catch (error) {
      logger.error(`Failed to delete task file ${taskId}:`, error)
    }
  }

  /**
   * 清理过期任务
   */
  async cleanupOldTasks(maxAge = 24 * 60 * 60 * 1000) {
    const now = Date.now()
    const tasksToDelete = []
    
    for (const [taskId, task] of this.tasks.entries()) {
      const taskAge = now - new Date(task.createdAt).getTime()
      if (taskAge > maxAge) {
        tasksToDelete.push(taskId)
      }
    }
    
    for (const taskId of tasksToDelete) {
      await this.deleteTask(taskId)
    }
    
    logger.info(`Cleaned up ${tasksToDelete.length} old tasks`)
    return tasksToDelete.length
  }

  /**
   * 获取任务统计信息
   */
  getStatistics() {
    const stats = {
      total: this.tasks.size,
      byStatus: {},
      byType: {},
      averageExecutionTime: 0,
      successRate: 0
    }
    
    let totalExecutionTime = 0
    let completedCount = 0
    let successCount = 0
    
    for (const task of this.tasks.values()) {
      // 按状态统计
      stats.byStatus[task.status] = (stats.byStatus[task.status] || 0) + 1
      
      // 按类型统计
      stats.byType[task.type] = (stats.byType[task.type] || 0) + 1
      
      // 计算平均执行时间
      if (task.startedAt && task.completedAt) {
        const executionTime = new Date(task.completedAt) - new Date(task.startedAt)
        totalExecutionTime += executionTime
        completedCount++
      }
      
      // 计算成功率
      if (task.status === 'succeeded') {
        successCount++
      }
    }
    
    if (completedCount > 0) {
      stats.averageExecutionTime = Math.round(totalExecutionTime / completedCount)
    }
    
    if (this.tasks.size > 0) {
      stats.successRate = (successCount / this.tasks.size) * 100
    }
    
    return stats
  }

  /**
   * 重试失败的任务
   */
  async retryTask(taskId) {
    const task = this.tasks.get(taskId)
    if (!task) {
      throw new Error(`Task ${taskId} not found`)
    }
    
    if (task.status !== 'failed') {
      throw new Error(`Task ${taskId} is not in failed status`)
    }
    
    // 创建新任务，保留原始参数
    const newTaskId = await this.createTask(task.type, task.params)
    
    // 记录重试关系
    const newTask = this.tasks.get(newTaskId)
    newTask.retryOf = taskId
    await this.persistTask(newTaskId, newTask)
    
    // 在原任务中记录重试
    task.retriedAs = newTaskId
    await this.persistTask(taskId, task)
    
    return newTaskId
  }
}

export default new TaskManager()