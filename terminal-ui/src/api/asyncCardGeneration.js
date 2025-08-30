/**
 * 异步卡片生成API服务
 * 统一管理所有异步卡片生成相关的API调用
 */

import service from './config.js'

/**
 * 1. 发起异步生成请求
 * @param {Object} params - 生成参数
 * @param {string} params.topic - 主题
 * @param {string} [params.templateName] - 模板名称
 * @param {string} [params.token] - 用户token
 * @param {string} [params.style] - 风格
 * @param {string} [params.language] - 语言
 * @param {string} [params.reference] - 参考内容
 * @returns {Promise<Object>} 任务提交结果
 */
export const submitAsyncGeneration = async (params) => {
  console.log('[AsyncCardAPI] 提交异步生成请求:', params)
  
  const payload = {
    topic: params.topic,
    templateName: params.templateName || 'cardplanet-Sandra-json',
    ...(params.token && { token: params.token }),
    ...(params.style && { style: params.style }),
    ...(params.language && { language: params.language }),
    ...(params.reference && { reference: params.reference })
  }
  
  const result = await service.post('/generate/card/async', payload)
  
  console.log('[AsyncCardAPI] 任务提交结果:', result)
  return result
}

/**
 * 2. 检查生成状态
 * @param {string} topic - 主题名称（URL编码）
 * @returns {Promise<Object>} 状态信息
 */
export const checkGenerationStatus = async (topic) => {
  console.log('[AsyncCardAPI] 检查生成状态:', topic)
  
  const encodedTopic = encodeURIComponent(topic)
  const result = await service.get(`/generate/status/${encodedTopic}`)
  
  console.log('[AsyncCardAPI] 状态结果:', result)
  return result
}

/**
 * 3. 获取生成的文件内容
 * @param {string} folderName - 文件夹名称（URL编码）
 * @returns {Promise<Object>} 文件内容
 */
export const getGeneratedFiles = async (folderName) => {
  console.log('[AsyncCardAPI] 获取生成文件:', folderName)
  
  const encodedFolderName = encodeURIComponent(folderName)
  const result = await service.get(`/generate/card/query/${encodedFolderName}`)
  
  console.log('[AsyncCardAPI] 文件内容:', result)
  return result
}

/**
 * 轮询生成状态直到完成
 * @param {string} topic - 主题
 * @param {Object} options - 轮询配置
 * @param {number} [options.maxAttempts=150] - 最大轮询次数
 * @param {number} [options.interval=2000] - 轮询间隔(ms)
 * @param {Function} [options.onProgress] - 进度回调
 * @returns {Promise<Object>} 最终状态
 */
export const pollGenerationStatus = async (topic, options = {}) => {
  const {
    maxAttempts = 100,  // 最多100次
    interval = 6000,    // 6秒间隔
    onProgress
  } = options
  
  console.log('[AsyncCardAPI] 开始轮询生成状态:', { topic, maxAttempts, interval })
  
  let attempts = 0
  
  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        attempts++
        
        if (onProgress) {
          onProgress({
            attempt: attempts,
            maxAttempts,
            progress: (attempts / maxAttempts) * 100
          })
        }
        
        const statusResult = await checkGenerationStatus(topic)
        
        // 传递详细的进度信息
        if (statusResult.progress && onProgress) {
          const progressMessage = statusResult.message || '检查生成状态'
          onProgress({
            attempt: attempts,
            maxAttempts,
            progress: (attempts / maxAttempts) * 100,
            detail: progressMessage,
            files: statusResult.progress
          })
        }
        
        if (statusResult.status === 'completed') {
          console.log('[AsyncCardAPI] 生成完成!')
          resolve(statusResult)
          return
        }
        
        if (statusResult.status === 'failed' || statusResult.status === 'error') {
          console.error('[AsyncCardAPI] 生成失败:', statusResult)
          reject(new Error(statusResult.message || '生成失败'))
          return
        }
        
        if (attempts >= maxAttempts) {
          console.error('[AsyncCardAPI] 轮询超时')
          reject(new Error(`生成超时，已等待 ${(maxAttempts * interval) / 1000} 秒`))
          return
        }
        
        // 继续轮询
        setTimeout(poll, interval)
        
      } catch (error) {
        console.error('[AsyncCardAPI] 轮询错误:', error)
        reject(error)
      }
    }
    
    // 开始第一次轮询（延迟6秒）
    setTimeout(poll, 6000)
  })
}

/**
 * 4.5. 根据taskId检查任务状态
 * @param {string} taskId - 任务ID
 * @returns {Promise<Object>} 任务状态
 */
export const checkAsyncTaskStatus = async (taskId) => {
  console.log('[AsyncCardAPI] 检查任务状态:', taskId)
  
  try {
    // 从taskId中提取topic（假设格式为 task_timestamp_topic）
    // 或者调用一个新的API endpoint
    const result = await service.get(`/generate/async/status/${taskId}`)
    
    console.log('[AsyncCardAPI] 任务状态结果:', result)
    return result
  } catch (error) {
    console.error('[AsyncCardAPI] 检查任务状态失败:', error)
    return {
      status: 'error',
      message: error.message
    }
  }
}

/**
 * 完整的异步卡片生成流程
 * @param {Object} params - 生成参数
 * @param {Object} options - 配置选项
 * @param {Function} [options.onProgress] - 进度回调
 * @param {Function} [options.onStatusChange] - 状态变化回调
 * @param {Function} [options.onTaskCreated] - 任务创建回调
 * @param {string} [options.taskId] - 恢复已有任务
 * @returns {Promise<Object>} 生成结果
 */
export const generateCardAsync = async (params, options = {}) => {
  const { onProgress, onStatusChange, onTaskCreated, taskId: existingTaskId } = options
  
  try {
    let taskId, folderName, topic
    
    // 如果有已存在的taskId，跳过提交步骤
    if (existingTaskId) {
      taskId = existingTaskId
      folderName = params.topic // 使用params中的topic作为folderName
      topic = params.topic
      
      if (onStatusChange) {
        onStatusChange({ 
          step: 'recovering', 
          message: `恢复任务 (${taskId})`,
          taskId,
          folderName
        })
      }
    } else {
      // 步骤1: 提交生成请求
      if (onStatusChange) onStatusChange({ step: 'submitting', message: '提交生成请求...' })
      
      const submitResult = await submitAsyncGeneration(params)
      
      if (!submitResult.success) {
        throw new Error(submitResult.message || '提交生成请求失败')
      }
      
      taskId = submitResult.data.taskId
      folderName = submitResult.data.folderName
      topic = submitResult.data.topic
      
      // 回调通知taskId已创建
      if (onTaskCreated) {
        onTaskCreated(taskId)
      }
      
      if (onStatusChange) {
        onStatusChange({ 
          step: 'submitted', 
          message: `任务已提交 (${taskId})`,
          taskId,
          folderName
        })
      }
    }
    
    // 步骤2: 轮询检查状态
    if (onStatusChange) onStatusChange({ step: 'polling', message: '检查生成状态...' })
    
    await pollGenerationStatus(topic, {
      onProgress: (progressInfo) => {
        if (onProgress) onProgress(progressInfo)
        if (onStatusChange) {
          onStatusChange({
            step: 'polling',
            message: `检查生成状态 (${progressInfo.attempt}/${progressInfo.maxAttempts})`,
            progress: progressInfo.progress
          })
        }
      }
    })
    
    // 步骤3: 获取生成的文件
    if (onStatusChange) onStatusChange({ step: 'fetching', message: '获取生成文件...' })
    
    const filesResult = await getGeneratedFiles(folderName)
    
    if (!filesResult.success) {
      throw new Error(filesResult.message || '获取文件失败')
    }
    
    // 处理文件结果
    const files = filesResult.data.allFiles || []
    const htmlFile = files.find(file => file.fileType === 'html')
    const jsonFile = files.find(file => file.fileType === 'json')
    
    const result = {
      success: true,
      taskId,
      folderName,
      topic: filesResult.data.topic || folderName,
      totalFiles: files.length,
      generatedAt: filesResult.data.generatedAt || new Date().toISOString(),
      files: files,
      allFiles: files,  // 兼容性
      // 主要文件信息
      primaryFile: htmlFile || jsonFile || files[0],
      htmlFile,
      jsonFile,
      // 从响应数据提取额外信息
      type: htmlFile ? 'html' : 'json',
      content: filesResult.data.content,
      fileName: filesResult.data.fileName,
      templateName: filesResult.data.templateName
    }
    
    if (onStatusChange) {
      onStatusChange({ 
        step: 'completed', 
        message: `生成完成! 共 ${result.totalFiles} 个文件`,
        result
      })
    }
    
    console.log('[AsyncCardAPI] 完整流程完成:', result)
    return result
    
  } catch (error) {
    console.error('[AsyncCardAPI] 生成流程失败:', error)
    
    if (onStatusChange) {
      onStatusChange({
        step: 'failed',
        message: `生成失败: ${error.message}`,
        error
      })
    }
    
    throw error
  }
}

/**
 * 批量生成卡片
 * @param {Array<Object>} paramsArray - 多个生成参数
 * @param {Object} options - 配置选项
 * @returns {Promise<Array<Object>>} 批量生成结果
 */
export const generateCardsInBatch = async (paramsArray, options = {}) => {
  const { onProgress, concurrency = 3 } = options
  
  console.log('[AsyncCardAPI] 开始批量生成:', { count: paramsArray.length, concurrency })
  
  const results = []
  const chunks = []
  
  // 分组处理，限制并发数
  for (let i = 0; i < paramsArray.length; i += concurrency) {
    chunks.push(paramsArray.slice(i, i + concurrency))
  }
  
  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    const chunk = chunks[chunkIndex]
    const chunkPromises = chunk.map(async (params, index) => {
      try {
        const result = await generateCardAsync(params, {
          onStatusChange: (status) => {
            const globalIndex = chunkIndex * concurrency + index
            if (onProgress) {
              onProgress({
                completed: results.length,
                total: paramsArray.length,
                current: globalIndex + 1,
                currentTopic: params.topic,
                currentStatus: status
              })
            }
          }
        })
        return result
      } catch (error) {
        return {
          success: false,
          topic: params.topic,
          error: error.message
        }
      }
    })
    
    const chunkResults = await Promise.all(chunkPromises)
    results.push(...chunkResults)
  }
  
  const successCount = results.filter(r => r.success).length
  const failureCount = results.length - successCount
  
  console.log('[AsyncCardAPI] 批量生成完成:', { 
    total: results.length, 
    success: successCount, 
    failed: failureCount 
  })
  
  return {
    results,
    summary: {
      total: results.length,
      success: successCount,
      failed: failureCount,
      successRate: (successCount / results.length * 100).toFixed(1) + '%'
    }
  }
}

/**
 * 获取生成任务的详细信息（用于调试）
 * @param {string} topic - 主题
 * @returns {Promise<Object>} 任务详情
 */
export const getTaskDetails = async (topic) => {
  try {
    const [statusResult, filesResult] = await Promise.allSettled([
      checkGenerationStatus(topic),
      getGeneratedFiles(topic).catch(() => null)
    ])
    
    return {
      topic,
      status: statusResult.status === 'fulfilled' ? statusResult.value : null,
      files: filesResult.status === 'fulfilled' ? filesResult.value : null,
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    console.error('[AsyncCardAPI] 获取任务详情失败:', error)
    return {
      topic,
      error: error.message,
      timestamp: new Date().toISOString()
    }
  }
}

export default {
  // 基础API
  submitAsyncGeneration,
  checkGenerationStatus,
  getGeneratedFiles,
  
  // 高级功能
  pollGenerationStatus,
  generateCardAsync,
  generateCardsInBatch,
  getTaskDetails
}