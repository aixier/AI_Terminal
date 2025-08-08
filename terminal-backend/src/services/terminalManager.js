/**
 * Terminal Manager - 最佳实践实现
 * 
 * 设计原则：
 * 1. 单一数据流：PTY -> Socket -> Client
 * 2. 无状态传输：不缓存、不修改终端输出
 * 3. 原子操作：所有操作都是原子的
 * 4. 清晰的生命周期管理
 */

import { spawn } from 'node-pty'
import logger from '../utils/logger.js'
import config from '../config/config.js'
import EventEmitter from 'events'

class TerminalManager extends EventEmitter {
  constructor() {
    super()
    this.terminals = new Map()
    this.metadata = new Map()
    
    // 定期清理死亡的终端
    this.startCleanupInterval()
  }

  /**
   * 创建新的终端实例
   * 最佳实践：直接传递PTY流，不做任何缓冲或修改
   */
  create(id, options = {}) {
    if (this.terminals.has(id)) {
      logger.warn(`Terminal ${id} already exists`)
      return this.terminals.get(id)
    }

    const defaultOptions = {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: process.env.HOME || process.cwd(),
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        LANG: process.env.LANG || 'en_US.UTF-8'
      }
    }

    const ptyOptions = { ...defaultOptions, ...options }
    
    try {
      // 选择正确的shell
      const shell = process.platform === 'win32' 
        ? process.env.COMSPEC || 'cmd.exe'
        : process.env.SHELL || '/bin/bash'

      // 创建PTY实例
      const pty = spawn(shell, [], ptyOptions)
      
      // 存储终端实例
      this.terminals.set(id, pty)
      
      // 存储元数据
      this.metadata.set(id, {
        id,
        created: new Date(),
        lastActivity: new Date(),
        cols: ptyOptions.cols,
        rows: ptyOptions.rows,
        pid: pty.pid
      })

      // 设置事件监听（但不处理数据）
      this.setupPtyEvents(id, pty)
      
      logger.info(`Terminal created: ${id} (PID: ${pty.pid})`)
      this.emit('terminal:created', { id, pid: pty.pid })
      
      return pty
    } catch (error) {
      logger.error(`Failed to create terminal ${id}:`, error)
      throw error
    }
  }

  /**
   * 设置PTY事件监听
   * 最佳实践：只监听必要的事件，不修改数据
   */
  setupPtyEvents(id, pty) {
    // 监听退出事件
    pty.onExit(({ exitCode, signal }) => {
      logger.info(`Terminal ${id} exited (code: ${exitCode}, signal: ${signal})`)
      this.emit('terminal:exit', { id, exitCode, signal })
      this.destroy(id)
    })

    // 错误处理
    pty.on('error', (error) => {
      logger.error(`Terminal ${id} error:`, error)
      this.emit('terminal:error', { id, error })
    })
  }

  /**
   * 获取终端实例
   */
  get(id) {
    const pty = this.terminals.get(id)
    if (pty) {
      // 更新最后活动时间
      const meta = this.metadata.get(id)
      if (meta) {
        meta.lastActivity = new Date()
      }
    }
    return pty
  }

  /**
   * 写入数据到终端
   * 最佳实践：直接传递，不做任何处理
   */
  write(id, data) {
    const pty = this.get(id)
    if (!pty) {
      throw new Error(`Terminal ${id} not found`)
    }
    
    try {
      pty.write(data)
    } catch (error) {
      logger.error(`Failed to write to terminal ${id}:`, error)
      throw error
    }
  }

  /**
   * 调整终端大小
   */
  resize(id, cols, rows) {
    const pty = this.get(id)
    if (!pty) {
      throw new Error(`Terminal ${id} not found`)
    }

    try {
      pty.resize(cols, rows)
      
      // 更新元数据
      const meta = this.metadata.get(id)
      if (meta) {
        meta.cols = cols
        meta.rows = rows
      }
      
      logger.debug(`Terminal ${id} resized to ${cols}x${rows}`)
    } catch (error) {
      logger.error(`Failed to resize terminal ${id}:`, error)
      throw error
    }
  }

  /**
   * 销毁终端实例
   */
  destroy(id) {
    const pty = this.terminals.get(id)
    if (!pty) {
      return
    }

    try {
      // 尝试优雅关闭
      if (!pty.killed) {
        pty.kill()
      }
    } catch (error) {
      logger.error(`Error killing terminal ${id}:`, error)
    }

    // 清理资源
    this.terminals.delete(id)
    this.metadata.delete(id)
    
    logger.info(`Terminal destroyed: ${id}`)
    this.emit('terminal:destroyed', { id })
  }

  /**
   * 获取所有终端的状态
   */
  getStatus() {
    const status = []
    for (const [id, meta] of this.metadata.entries()) {
      const pty = this.terminals.get(id)
      status.push({
        ...meta,
        alive: pty && !pty.killed
      })
    }
    return status
  }

  /**
   * 获取终端数量
   */
  get count() {
    return this.terminals.size
  }

  /**
   * 检查是否达到最大终端数
   */
  isMaxReached() {
    return this.count >= (config.terminal?.maxSessions || 10)
  }

  /**
   * 定期清理死亡的终端
   */
  startCleanupInterval() {
    setInterval(() => {
      for (const [id, pty] of this.terminals.entries()) {
        if (pty.killed) {
          logger.info(`Cleaning up dead terminal: ${id}`)
          this.destroy(id)
        }
      }
    }, 30000) // 每30秒清理一次
  }

  /**
   * 清理所有终端（用于关闭服务器时）
   */
  destroyAll() {
    logger.info(`Destroying all ${this.count} terminals`)
    for (const id of this.terminals.keys()) {
      this.destroy(id)
    }
  }
}

// 导出单例
export default new TerminalManager()