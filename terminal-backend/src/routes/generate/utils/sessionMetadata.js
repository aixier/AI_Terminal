/**
 * 通用会话元数据管理工具
 * 支持所有模板类型的元数据记录和日志管理
 * 符合JSON Schema规范
 */

import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

/**
 * 格式化时间戳为可读格式
 * @param {Date} date - 日期对象
 * @returns {string} 格式化的时间戳 (YYYYMMDD_HHMMSS)
 */
function formatTimestamp(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  
  return `${year}${month}${day}_${hours}${minutes}${seconds}`
}

/**
 * 生成唯一的Session ID
 * @param {string} userId - 用户ID
 * @returns {string} 唯一的Session ID
 */
function generateSessionId(userId) {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substr(2, 9)
  return `${timestamp}_${userId}_${random}`
}

/**
 * 计算文件校验和
 * @param {string} filePath - 文件路径
 * @returns {string} SHA256校验和
 */
async function calculateChecksum(filePath) {
  try {
    const fileBuffer = await fs.readFile(filePath)
    return crypto.createHash('sha256').update(fileBuffer).digest('hex')
  } catch (error) {
    return null
  }
}

/**
 * 获取文件大小
 * @param {string} filePath - 文件路径  
 * @returns {number} 文件大小（字节）
 */
async function getFileSize(filePath) {
  try {
    const stats = await fs.stat(filePath)
    return stats.size
  } catch (error) {
    return 0
  }
}

/**
 * 会话元数据管理类
 */
export class SessionMetadata {
  /**
   * 构造函数
   * @param {string} userId - 用户ID
   * @param {string} topic - 生成主题
   * @param {string} templateName - 模板名称
   * @param {string} apiEndpoint - API端点
   * @param {string} requestId - 请求ID
   */
  constructor(userId, topic, templateName, apiEndpoint = '/api/generate/card', requestId = null) {
    this.sessionId = generateSessionId(userId)
    this.userId = userId
    this.createdAt = new Date()
    
    // 初始化元数据结构
    this.data = {
      sessionInfo: {
        sessionId: this.sessionId,
        userId: userId,
        createdAt: this.createdAt.toISOString(),
        requestId: requestId || this.sessionId,
        apiEndpoint: apiEndpoint
      },
      
      request: {
        topic: topic,
        templateName: templateName,
        templateType: this.determineTemplateType(templateName),
        userParameters: {},
        promptTemplate: null
      },
      
      processing: {
        generatedParameters: {},
        assembledPrompt: null,
        claudePath: null,
        outputPath: null
      },
      
      execution: {
        steps: [],
        totalDuration: 0,
        finalStatus: 'started'
      },
      
      output: {
        generatedFiles: [],
        externalUrls: {}
      },
      
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        isDocker: process.env.NODE_ENV === 'production' || !!process.env.DATA_PATH,
        dataPath: process.env.DATA_PATH || process.cwd(),
        apiVersion: '1.0.0'
      },
      
      logs: []
    }
  }

  /**
   * 确定模板类型
   * @param {string} templateName - 模板名称
   * @returns {string} 模板类型 (file | folder)
   */
  determineTemplateType(templateName) {
    if (templateName.endsWith('.md')) {
      return 'file'
    }
    return 'folder'
  }

  /**
   * 设置用户参数
   * @param {Object} userParams - 用户传入的参数
   */
  setUserParameters(userParams) {
    this.data.request.userParameters = { ...userParams }
    this.addLog('info', 'User parameters set', userParams)
  }

  /**
   * 设置提示词模板
   * @param {string} promptTemplate - 提示词模板内容
   */
  setPromptTemplate(promptTemplate) {
    this.data.request.promptTemplate = promptTemplate
    this.addLog('info', 'Prompt template loaded', { length: promptTemplate?.length || 0 })
  }

  /**
   * 设置生成的参数
   * @param {Object} generatedParams - AI生成的参数
   */
  setGeneratedParameters(generatedParams) {
    this.data.processing.generatedParameters = { ...generatedParams }
    this.addLog('info', 'Generated parameters set', generatedParams)
  }

  /**
   * 设置组装的提示词
   * @param {string} assembledPrompt - 最终组装的提示词
   */
  setAssembledPrompt(assembledPrompt) {
    this.data.processing.assembledPrompt = assembledPrompt
    this.addLog('info', 'Assembled prompt set', { length: assembledPrompt?.length || 0 })
  }

  /**
   * 设置Claude路径和输出路径
   * @param {string} claudePath - Claude.md文档路径
   * @param {string} outputPath - 输出目录路径
   */
  setPaths(claudePath, outputPath) {
    this.data.processing.claudePath = claudePath
    this.data.processing.outputPath = outputPath
    this.addLog('info', 'Paths set', { claudePath, outputPath })
  }

  /**
   * 记录执行步骤
   * @param {string} stepName - 步骤名称
   * @param {string} status - 步骤状态 (started|completed|failed|skipped)
   * @param {Object} result - 执行结果
   * @param {Error} error - 错误信息
   */
  logStep(stepName, status, result = null, error = null) {
    const now = new Date()
    const existingStepIndex = this.data.execution.steps.findIndex(s => s.stepName === stepName)
    
    if (existingStepIndex >= 0) {
      // 更新现有步骤
      const step = this.data.execution.steps[existingStepIndex]
      step.status = status
      step.endTime = now.toISOString()
      step.duration = new Date(step.endTime) - new Date(step.startTime)
      
      if (result) step.result = result
      if (error) {
        step.error = {
          message: error.message,
          code: error.code,
          stack: error.stack
        }
      }
    } else {
      // 创建新步骤
      const step = {
        stepName,
        status,
        startTime: now.toISOString()
      }
      
      if (status !== 'started') {
        step.endTime = now.toISOString()
        step.duration = 0
      }
      
      if (result) step.result = result
      if (error) {
        step.error = {
          message: error.message,
          code: error.code || 'UNKNOWN_ERROR',
          stack: error.stack
        }
      }
      
      this.data.execution.steps.push(step)
    }
    
    this.addLog('info', `Step ${stepName}: ${status}`, { stepName, status })
  }

  /**
   * 添加生成的文件记录
   * @param {string} fileName - 文件名
   * @param {string} filePath - 文件路径
   * @param {string} fileType - 文件类型 (json|response|html|meta)
   */
  async addFile(fileName, filePath, fileType) {
    const fileSize = await getFileSize(filePath)
    const checksum = await calculateChecksum(filePath)
    
    const fileRecord = {
      fileName,
      filePath,
      fileType,
      fileSize,
      checksum,
      createdAt: new Date().toISOString()
    }
    
    this.data.output.generatedFiles.push(fileRecord)
    this.addLog('info', `File added: ${fileName}`, fileRecord)
  }

  /**
   * 设置外部URL
   * @param {Object} urls - 外部URL对象
   */
  setExternalUrls(urls) {
    this.data.output.externalUrls = { ...urls }
    this.addLog('info', 'External URLs set', urls)
  }

  /**
   * 添加日志记录
   * @param {string} level - 日志级别 (debug|info|warn|error)
   * @param {string} message - 日志消息
   * @param {Object} context - 上下文对象
   */
  addLog(level, message, context = {}) {
    this.data.logs.push({
      timestamp: new Date().toISOString(),
      level,
      message,
      context
    })
  }

  /**
   * 完成会话
   * @param {string} finalStatus - 最终状态 (success|partial_success|failed)
   */
  complete(finalStatus = 'success') {
    const now = new Date()
    this.data.execution.finalStatus = finalStatus
    this.data.execution.totalDuration = now - this.createdAt
    this.addLog('info', `Session completed with status: ${finalStatus}`)
  }

  /**
   * 生成元数据文件名
   * @returns {string} 元数据文件名
   */
  generateMetaFileName() {
    const timestamp = formatTimestamp(this.createdAt)
    return `${timestamp}_${this.userId}_meta.json`
  }

  /**
   * 保存元数据到文件
   * @param {string} outputDir - 输出目录
   * @returns {string} 保存的文件路径
   */
  async save(outputDir) {
    try {
      const fileName = this.generateMetaFileName()
      const filePath = path.join(outputDir, fileName)
      
      // 确保输出目录存在
      await fs.mkdir(outputDir, { recursive: true })
      
      // 保存JSON文件
      await fs.writeFile(filePath, JSON.stringify(this.data, null, 2), 'utf-8')
      
      // 记录元数据文件本身
      await this.addFile(fileName, filePath, 'meta')
      
      this.addLog('info', `Metadata saved to: ${filePath}`)
      return filePath
    } catch (error) {
      this.addLog('error', `Failed to save metadata: ${error.message}`, { error: error.message })
      throw error
    }
  }

  /**
   * 获取当前元数据的JSON字符串
   * @returns {string} JSON格式的元数据
   */
  toJSON() {
    return JSON.stringify(this.data, null, 2)
  }

  /**
   * 验证元数据完整性
   * @returns {Object} 验证结果
   */
  validate() {
    const errors = []
    const warnings = []
    
    // 检查必要字段
    if (!this.data.sessionInfo.sessionId) errors.push('Missing sessionId')
    if (!this.data.sessionInfo.userId) errors.push('Missing userId')
    if (!this.data.request.topic) errors.push('Missing topic')
    if (!this.data.request.templateName) errors.push('Missing templateName')
    
    // 检查执行步骤
    if (this.data.execution.steps.length === 0) {
      warnings.push('No execution steps recorded')
    }
    
    // 检查生成文件
    if (this.data.output.generatedFiles.length === 0) {
      warnings.push('No generated files recorded')
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }
}

export default SessionMetadata