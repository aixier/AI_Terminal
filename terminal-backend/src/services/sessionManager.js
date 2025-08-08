import logger from '../utils/logger.js'
import terminalService from './terminalService.js'
import config from '../config/config.js'

class SessionManager {
  constructor() {
    this.userSessions = new Map() // userId -> Set of sessionIds
    this.sessionUsers = new Map() // sessionId -> userId
    this.sessionMetadata = new Map() // sessionId -> metadata
  }

  // 创建用户会话
  createUserSession(userId, sessionId, metadata = {}) {
    // 检查用户会话限制
    const userSessionCount = this.getUserSessionCount(userId)
    const maxSessionsPerUser = config.terminal.maxSessionsPerUser || 5

    if (userSessionCount >= maxSessionsPerUser) {
      throw new Error(`用户已达到最大会话数限制 (${maxSessionsPerUser})`)
    }

    // 记录用户会话映射
    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, new Set())
    }
    this.userSessions.get(userId).add(sessionId)
    
    // 记录会话用户映射
    this.sessionUsers.set(sessionId, userId)
    
    // 记录会话元数据
    this.sessionMetadata.set(sessionId, {
      userId,
      createdAt: new Date(),
      lastActivity: new Date(),
      ...metadata
    })

    logger.info(`Created session ${sessionId} for user ${userId}`)
  }

  // 获取用户的所有会话
  getUserSessions(userId) {
    const sessionIds = this.userSessions.get(userId) || new Set()
    const sessions = []
    
    for (const sessionId of sessionIds) {
      const session = terminalService.getSession(sessionId)
      const metadata = this.sessionMetadata.get(sessionId)
      
      if (session) {
        sessions.push({
          id: sessionId,
          ...metadata,
          status: 'active'
        })
      } else {
        // 清理已失效的会话
        this.removeSession(sessionId)
      }
    }
    
    return sessions
  }

  // 获取用户会话数量
  getUserSessionCount(userId) {
    const sessions = this.userSessions.get(userId)
    return sessions ? sessions.size : 0
  }

  // 获取会话的用户
  getSessionUser(sessionId) {
    return this.sessionUsers.get(sessionId)
  }

  // 更新会话活动时间
  updateSessionActivity(sessionId) {
    const metadata = this.sessionMetadata.get(sessionId)
    if (metadata) {
      metadata.lastActivity = new Date()
    }
  }

  // 删除会话
  removeSession(sessionId) {
    const userId = this.sessionUsers.get(sessionId)
    
    if (userId) {
      const userSessions = this.userSessions.get(userId)
      if (userSessions) {
        userSessions.delete(sessionId)
        if (userSessions.size === 0) {
          this.userSessions.delete(userId)
        }
      }
    }
    
    this.sessionUsers.delete(sessionId)
    this.sessionMetadata.delete(sessionId)
    
    logger.info(`Removed session ${sessionId}`)
  }

  // 删除用户的所有会话
  removeUserSessions(userId) {
    const sessionIds = this.userSessions.get(userId) || new Set()
    
    for (const sessionId of sessionIds) {
      terminalService.destroySession(sessionId)
      this.sessionUsers.delete(sessionId)
      this.sessionMetadata.delete(sessionId)
    }
    
    this.userSessions.delete(userId)
    
    logger.info(`Removed all sessions for user ${userId}`)
  }

  // 验证用户对会话的访问权限
  validateUserAccess(userId, sessionId) {
    const sessionUser = this.getSessionUser(sessionId)
    
    if (!sessionUser) {
      return { valid: false, reason: '会话不存在' }
    }
    
    if (sessionUser !== userId) {
      return { valid: false, reason: '无权访问此会话' }
    }
    
    return { valid: true }
  }

  // 获取系统会话统计
  getSystemStats() {
    const stats = {
      totalUsers: this.userSessions.size,
      totalSessions: this.sessionUsers.size,
      userSessionCounts: {}
    }
    
    for (const [userId, sessions] of this.userSessions.entries()) {
      stats.userSessionCounts[userId] = sessions.size
    }
    
    return stats
  }

  // 清理过期会话
  cleanupExpiredSessions() {
    const now = new Date()
    const sessionTimeout = config.terminal.sessionTimeout || 600000 // 10分钟
    
    for (const [sessionId, metadata] of this.sessionMetadata.entries()) {
      const idleTime = now - metadata.lastActivity
      
      if (idleTime > sessionTimeout) {
        logger.info(`Cleaning up expired session ${sessionId}`)
        terminalService.destroySession(sessionId)
        this.removeSession(sessionId)
      }
    }
  }
}

export default new SessionManager()