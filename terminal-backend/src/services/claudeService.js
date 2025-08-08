import { spawn } from 'node-pty'
import path from 'path'
import { promises as fs } from 'fs'
import logger from '../utils/logger.js'
import config from '../config/config.js'

class ClaudeService {
  constructor() {
    this.claudeSessions = new Map()
  }

  /**
   * 为每个用户创建独立的Claude终端会话
   * 使用node-pty实现进程隔离
   */
  async createClaudeSession(userId) {
    try {
      if (this.claudeSessions.has(userId)) {
        logger.info(`Claude session already exists for user: ${userId}`)
        return this.claudeSessions.get(userId)
      }

      // 创建用户专属工作目录
      const userWorkDir = path.join(process.cwd(), 'users', userId)
      await fs.mkdir(userWorkDir, { recursive: true })

      // 使用node-pty创建独立的claude进程
      const claudePty = spawn('claude', [], {
        name: 'xterm-color',
        cols: 80,
        rows: 24,
        cwd: userWorkDir,
        env: {
          ...process.env,
          USER_ID: userId,
          WORK_DIR: userWorkDir
        }
      })

      const session = {
        id: userId,
        pty: claudePty,
        workDir: userWorkDir,
        createdAt: new Date(),
        lastActivity: new Date(),
        outputBuffer: ''
      }

      // 监听输出
      claudePty.onData((data) => {
        session.outputBuffer += data
        session.lastActivity = new Date()
        logger.debug(`Claude output for ${userId}: ${data}`)
      })

      claudePty.onExit(({ exitCode, signal }) => {
        logger.info(`Claude session ended for ${userId}: code ${exitCode}, signal ${signal}`)
        this.claudeSessions.delete(userId)
      })

      this.claudeSessions.set(userId, session)
      logger.info(`Claude session created for user: ${userId}`)
      
      return session
    } catch (error) {
      logger.error(`Failed to create Claude session: ${error.message}`)
      throw error
    }
  }

  /**
   * 执行两阶段命令流程
   */
  async executeCommand(userId, params) {
    const { command, type, topic } = params

    // 确保用户有Claude会话
    let session = this.claudeSessions.get(userId)
    if (!session) {
      session = await this.createClaudeSession(userId)
    }

    try {
      if (type === 'generate-json') {
        return await this.generateJSON(session, command, topic)
      } else if (type === 'generate-card') {
        return await this.generateCard(session, command)
      } else {
        throw new Error('Unknown command type')
      }
    } catch (error) {
      logger.error(`Command execution error for ${userId}: ${error.message}`)
      throw error
    }
  }

  /**
   * 第一阶段：生成JSON文件
   */
  async generateJSON(session, prompt, topic) {
    logger.info(`Generating JSON for topic: ${topic}`)

    // 创建卡片目录
    const cardDir = path.join(session.workDir, 'cards', topic)
    const jsonPath = path.join(cardDir, 'content.json')
    await fs.mkdir(cardDir, { recursive: true })

    // 清空输出缓冲
    session.outputBuffer = ''

    // 发送命令到Claude
    session.pty.write(`${prompt}\n`)

    return new Promise((resolve, reject) => {
      // 设置超时
      const timeout = setTimeout(() => {
        reject(new Error('Command timeout'))
      }, 60000) // 60秒超时

      // 监听输出
      const checkOutput = setInterval(async () => {
        const output = session.outputBuffer

        // 查找JSON内容
        const jsonMatch = output.match(/```json\n([\s\S]*?)\n```/)
        if (jsonMatch && jsonMatch[1]) {
          clearInterval(checkOutput)
          clearTimeout(timeout)

          try {
            const jsonContent = JSON.parse(jsonMatch[1])
            
            // 保存JSON到文件
            await fs.writeFile(jsonPath, JSON.stringify(jsonContent, null, 2))
            
            resolve({
              success: true,
              filePath: `users/${session.id}/cards/${topic}/content.json`,
              absolutePath: jsonPath,
              content: jsonContent
            })
          } catch (parseError) {
            reject(new Error('Failed to parse JSON from Claude output'))
          }
        }

        // 检查是否有错误
        if (output.includes('Error:') || output.includes('error:')) {
          clearInterval(checkOutput)
          clearTimeout(timeout)
          reject(new Error('Claude returned an error'))
        }
      }, 1000) // 每秒检查一次
    })
  }

  /**
   * 第二阶段：生成卡片URL
   */
  async generateCard(session, prompt) {
    return new Promise((resolve, reject) => {
      logger.info(`Generating card URL with prompt: ${prompt}`)

      // 清空输出缓冲
      session.outputBuffer = ''

      // 发送命令到Claude
      session.pty.write(`${prompt}\n`)

      // 设置超时
      const timeout = setTimeout(() => {
        reject(new Error('Command timeout'))
      }, 30000) // 30秒超时

      // 监听输出
      const checkOutput = setInterval(() => {
        const output = session.outputBuffer

        // 查找URL
        const urlMatch = output.match(/https?:\/\/[^\s]+/)
        if (urlMatch) {
          clearInterval(checkOutput)
          clearTimeout(timeout)

          resolve({
            success: true,
            url: urlMatch[0]
          })
        }

        // 也检查JSON格式的响应
        const jsonMatch = output.match(/\{[\s\S]*?\}/)
        if (jsonMatch) {
          try {
            const result = JSON.parse(jsonMatch[0])
            if (result.url) {
              clearInterval(checkOutput)
              clearTimeout(timeout)
              
              resolve({
                success: true,
                url: result.url
              })
            }
          } catch (e) {
            // 忽略解析错误
          }
        }

        // 检查错误
        if (output.includes('Error:') || output.includes('error:')) {
          clearInterval(checkOutput)
          clearTimeout(timeout)
          reject(new Error('MCP tool execution failed'))
        }
      }, 500) // 每0.5秒检查一次
    })
  }

  /**
   * 获取用户的卡片文件夹列表
   */
  async getUserFolders(userId) {
    const userCardsDir = path.join(process.cwd(), 'users', userId, 'cards')
    
    try {
      await fs.mkdir(userCardsDir, { recursive: true })
      const folders = await fs.readdir(userCardsDir)
      
      const folderList = await Promise.all(
        folders.map(async (folderName) => {
          const folderPath = path.join(userCardsDir, folderName)
          const stats = await fs.stat(folderPath)
          
          if (stats.isDirectory()) {
            const files = await fs.readdir(folderPath)
            const jsonFiles = files.filter(f => f.endsWith('.json'))
            
            // 读取最新的content.json
            let latestUrl = null
            const metaPath = path.join(folderPath, 'metadata.json')
            try {
              const metaData = await fs.readFile(metaPath, 'utf8')
              const metadata = JSON.parse(metaData)
              latestUrl = metadata.url
            } catch (e) {
              // 文件不存在，忽略
            }
            
            return {
              id: Date.now() + Math.random(),
              name: folderName,
              count: jsonFiles.length,
              path: `users/${userId}/cards/${folderName}`,
              createdAt: stats.birthtime,
              url: latestUrl
            }
          }
          return null
        })
      )

      return folderList.filter(f => f !== null)
    } catch (error) {
      logger.error(`Error getting user folders: ${error.message}`)
      return []
    }
  }

  /**
   * 保存卡片元数据
   */
  async saveCardMetadata(userId, topic, url) {
    const metaPath = path.join(process.cwd(), 'users', userId, 'cards', topic, 'metadata.json')
    
    await fs.writeFile(metaPath, JSON.stringify({
      topic,
      url,
      createdAt: new Date(),
      updatedAt: new Date()
    }, null, 2))
  }

  /**
   * 清理用户会话
   */
  destroySession(userId) {
    const session = this.claudeSessions.get(userId)
    if (session) {
      try {
        session.pty.kill()
      } catch (error) {
        logger.error(`Error killing Claude session: ${error.message}`)
      }
      this.claudeSessions.delete(userId)
      logger.info(`Claude session destroyed for user: ${userId}`)
    }
  }

  /**
   * 清理所有会话
   */
  destroyAllSessions() {
    for (const [userId, session] of this.claudeSessions) {
      this.destroySession(userId)
    }
  }
}

export default new ClaudeService()