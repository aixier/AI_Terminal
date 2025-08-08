import { spawn } from 'node-pty'
import logger from '../utils/logger.js'
import config from '../config/config.js'

class TerminalService {
  constructor() {
    this.sessions = new Map()
  }

  createSession(sessionId, options = {}) {
    try {
      if (this.sessions.has(sessionId)) {
        throw new Error('Session already exists')
      }

      if (this.sessions.size >= config.terminal.maxSessions) {
        throw new Error('Maximum terminal sessions reached')
      }

      const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash'
      const pty = spawn(shell, [], {
        name: 'xterm-256color',
        cols: options.cols || 80,
        rows: options.rows || 24,
        cwd: options.cwd || process.env.HOME,
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          LANG: 'en_US.UTF-8',
          LC_ALL: 'en_US.UTF-8'
        },
        encoding: 'utf8'
      })

      const session = {
        id: sessionId,
        pty,
        createdAt: new Date(),
        lastActivity: new Date()
      }

      this.sessions.set(sessionId, session)
      
      // 设置超时清理
      this.setupTimeout(sessionId)

      logger.info(`Terminal session created: ${sessionId}`)
      return session
    } catch (error) {
      logger.error(`Failed to create terminal session: ${error.message}`)
      throw error
    }
  }

  getSession(sessionId) {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.lastActivity = new Date()
      this.setupTimeout(sessionId)
    }
    return session
  }

  writeToSession(sessionId, data) {
    const session = this.getSession(sessionId)
    if (!session) {
      throw new Error('Session not found')
    }
    session.pty.write(data)
  }

  resizeSession(sessionId, cols, rows) {
    const session = this.getSession(sessionId)
    if (!session) {
      throw new Error('Session not found')
    }
    session.pty.resize(cols, rows)
  }

  destroySession(sessionId) {
    const session = this.sessions.get(sessionId)
    if (session) {
      try {
        session.pty.kill()
      } catch (error) {
        logger.error(`Error killing terminal: ${error.message}`)
      }
      this.sessions.delete(sessionId)
      logger.info(`Terminal session destroyed: ${sessionId}`)
    }
  }

  setupTimeout(sessionId) {
    const session = this.sessions.get(sessionId)
    if (!session) return

    if (session.timeoutId) {
      clearTimeout(session.timeoutId)
    }

    session.timeoutId = setTimeout(() => {
      logger.info(`Terminal session timeout: ${sessionId}`)
      this.destroySession(sessionId)
    }, config.terminal.timeout)
  }

  getAllSessions() {
    return Array.from(this.sessions.entries()).map(([id, session]) => ({
      id,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity
    }))
  }
}

export default new TerminalService()