import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { generateCardAsync, checkAsyncTaskStatus } from '../../../api/asyncCardGeneration.js'

// 不再使用单独的localStorage key，改为存储在chat_history中
// const GENERATION_STATE_KEY = 'ai_card_generation_state'

export function useAsyncCardGeneration(updateMessageCallback = null) {
  const isGenerating = ref(false)
  const generatingStatus = ref('')
  const pollingAttempts = ref(0)
  const maxAttempts = ref(100) // 100次轮询（配合6秒间隔 = 10分钟超时）
  const pollingInterval = ref(6000) // 6秒间隔
  const currentTaskId = ref(null) // 当前任务ID
  
  let pollingTimer = null
  
  // 计算轮询进度
  const pollingProgress = computed(() => {
    if (maxAttempts.value === 0) return 0
    return Math.min((pollingAttempts.value / maxAttempts.value) * 100, 100)
  })
  
  // 计算剩余时间（估算）
  const estimatedTimeLeft = computed(() => {
    const remainingAttempts = maxAttempts.value - pollingAttempts.value
    const remainingSeconds = (remainingAttempts * pollingInterval.value) / 1000
    return Math.max(remainingSeconds, 0)
  })
  
  // 格式化剩余时间
  const formatTimeLeft = computed(() => {
    const seconds = estimatedTimeLeft.value
    const minutes = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  })
  
  /**
   * 开始异步生成卡片
   * @param {Object} params - 生成参数
   * @param {string} params.topic - 主题
   * @param {string} params.templateName - 模板名称
   * @param {string} params.token - 用户token
   * @param {string} messageId - 关联的消息ID
   * @returns {Promise<Object>} - 生成结果
   */
  const startAsyncGeneration = async (params, messageId = null) => {
    if (isGenerating.value) {
      ElMessage.warning('正在生成中，请稍候')
      return null
    }
    
    try {
      isGenerating.value = true
      generatingStatus.value = '提交生成请求...'
      pollingAttempts.value = 0
      
      console.log('[AsyncCardGeneration] 开始异步生成:', params)
      
      // 生成临时taskId，立即保存状态
      let taskId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      currentTaskId.value = taskId
      
      // 立即保存初始状态
      saveGenerationState(taskId, params, messageId)
      console.log('[AsyncCardGeneration] 保存初始状态，临时taskId:', taskId, 'messageId:', messageId)
      
      // 使用统一的API，并获取taskId
      const result = await generateCardAsync(params, {
        onTaskCreated: (id) => {
          console.log('[AsyncCardGeneration] 收到真实taskId:', id, '替换临时taskId:', taskId)
          // 更新为真实taskId
          taskId = id
          currentTaskId.value = id
          // 保存真实状态
          saveGenerationState(id, params, messageId)
        },
        onProgress: (progressInfo) => {
          pollingAttempts.value = progressInfo.attempt
          const progress = Math.round(progressInfo.progress)
          
          // 如果有详细的文件进度信息，显示它
          if (progressInfo.detail) {
            generatingStatus.value = progressInfo.detail
          } else if (progressInfo.files) {
            const { json = 0, html = 0, expected = 0 } = progressInfo.files
            if (expected > 0 && json > 0) {
              // JSON已生成，显示HTML进度
              generatingStatus.value = `JSON已生成，正在生成HTML文件 (${html}/${expected})`
            } else if (expected > 0) {
              // 等待文件生成
              generatingStatus.value = `正在生成文件 (${html}/${expected})`
            } else {
              generatingStatus.value = `检查生成状态 (${progressInfo.attempt}/${progressInfo.maxAttempts}) - ${progress}%`
            }
          } else {
            generatingStatus.value = `检查生成状态 (${progressInfo.attempt}/${progressInfo.maxAttempts}) - ${progress}%`
          }
          
          // 持续更新消息中的轮询次数
          if (currentTaskId.value && messageId) {
            saveGenerationState(currentTaskId.value, params, messageId)
          }
        },
        onStatusChange: (status) => {
          generatingStatus.value = status.message
          console.log('[AsyncCardGeneration] 状态变化:', status)
          // 状态变化时也保存
          if (currentTaskId.value && messageId) {
            saveGenerationState(currentTaskId.value, params, messageId)
          }
        }
      })
      
      // 处理结果
      const finalResult = {
        type: 'html',
        content: result.htmlFile?.content || result.primaryFile?.content,
        fileName: result.htmlFile?.fileName || result.primaryFile?.fileName,
        topic: result.topic,
        allFiles: result.files,
        generatedAt: result.generatedAt,
        totalFiles: result.totalFiles
      }
      
      isGenerating.value = false
      generatingStatus.value = '生成完成'
      clearGenerationState(messageId) // 生成完成后清除状态
      
      console.log('[AsyncCardGeneration] 最终结果:', finalResult)
      return finalResult
      
    } catch (error) {
      console.error('[AsyncCardGeneration] 生成失败:', error)
      ElMessage.error('生成失败: ' + error.message)
      isGenerating.value = false
      generatingStatus.value = ''
      return null
    }
  }
  
  
  /**
   * 保存生成状态（通过更新消息的方式）
   */
  const saveGenerationState = (taskId, params, messageId = null) => {
    if (!taskId) {
      console.log('[AsyncCardGeneration] taskId为空，跳过保存')
      return
    }
    
    const state = {
      taskId,
      params,
      timestamp: Date.now(),
      status: generatingStatus.value,
      pollingAttempts: pollingAttempts.value, // 保存当前轮询次数
      maxAttempts: maxAttempts.value // 保存最大尝试次数
    }
    
    // 通过回调函数更新消息中的生成状态
    if (updateMessageCallback && messageId) {
      updateMessageCallback(messageId, {
        generationState: state
      })
      console.log('[AsyncCardGeneration] 保存生成状态到消息:', messageId)
      console.log('[AsyncCardGeneration] - state:', state)
    } else {
      console.log('[AsyncCardGeneration] 无法保存状态：缺少messageId或updateMessageCallback')
    }
  }
  
  /**
   * 清除保存的生成状态（通过更新消息的方式）
   */
  const clearGenerationState = (messageId = null) => {
    try {
      currentTaskId.value = null
      // 清除消息中的生成状态
      if (updateMessageCallback && messageId) {
        updateMessageCallback(messageId, {
          generationState: null,
          isGenerating: false
        })
      }
      console.log('[AsyncCardGeneration] 清除生成状态')
    } catch (error) {
      console.error('[AsyncCardGeneration] 清除状态失败:', error)
    }
  }
  
  /**
   * 恢复生成状态（从消息历史中恢复）
   */
  const recoverGenerationState = async (unfinishedGeneration) => {
    try {
      if (!unfinishedGeneration) {
        console.log('[AsyncCardGeneration] 没有未完成的生成任务')
        return null
      }
      
      const { message, state } = unfinishedGeneration
      console.log('[AsyncCardGeneration] 从消息历史恢复生成状态:', state)
      console.log('[AsyncCardGeneration] 消息ID:', message.id)
      
      // 不再检查时间过期，让轮询超时机制处理
      console.log('[AsyncCardGeneration] 恢复生成状态:', state)
      console.log('[AsyncCardGeneration] 状态保存时间:', new Date(state.timestamp).toLocaleString())
      
      // 检查任务状态
      const statusResult = await checkAsyncTaskStatus(state.taskId)
      console.log('[AsyncCardGeneration] 任务状态检查结果:', statusResult)
      
      if (statusResult.status === 'completed') {
        // 任务已完成，清除消息中的生成状态
        clearGenerationState(message.id)
        
        // 构造返回结果格式
        const result = {
          type: 'html',
          topic: statusResult.topic,
          allFiles: statusResult.files?.html?.map(fileName => ({
            fileName,
            fileType: 'html'
          })) || [],
          generatedAt: statusResult.metadata?.completedAt || new Date().toISOString(),
          totalFiles: statusResult.files?.total || 0
        }
        
        // 添加JSON文件
        if (statusResult.files?.json) {
          statusResult.files.json.forEach(fileName => {
            result.allFiles.push({
              fileName,
              fileType: 'json'
            })
          })
        }
        
        return result
      } else if (statusResult.status === 'processing' || statusResult.status === 'generating') {
        // 任务仍在进行中，恢复轮询
        currentTaskId.value = state.taskId
        isGenerating.value = true
        generatingStatus.value = statusResult.message || '恢复生成中...'
        
        // 恢复之前的轮询次数，从断开时的位置继续
        const savedAttempts = state.pollingAttempts || 0
        const savedMaxAttempts = state.maxAttempts || 100
        pollingAttempts.value = savedAttempts
        maxAttempts.value = savedMaxAttempts
        
        console.log(`[AsyncCardGeneration] 从第 ${savedAttempts} 次继续轮询，最大 ${savedMaxAttempts} 次`)
        
        // 继续轮询，传入已有的尝试次数
        const result = await generateCardAsync(state.params, {
          taskId: state.taskId, // 传入已有的taskId
          startAttempt: savedAttempts, // 传入起始尝试次数
          maxAttempts: savedMaxAttempts - savedAttempts, // 剩余尝试次数
          onProgress: (progressInfo) => {
            // 累加保存的次数
            pollingAttempts.value = savedAttempts + progressInfo.attempt
            const progress = Math.round(progressInfo.progress)
            generatingStatus.value = `恢复中 (${pollingAttempts.value}/${savedMaxAttempts}) - ${progressInfo.detail || `检查状态 ${progress}%`}`
            
            // 更新消息中的轮询次数
            saveGenerationState(state.taskId, state.params, message.id)
          },
          onStatusChange: (status) => {
            generatingStatus.value = status.message
          }
        })
        
        clearGenerationState(message.id)
        isGenerating.value = false
        return result
      } else {
        // 任务失败或不存在
        clearGenerationState(message.id)
        return null
      }
    } catch (error) {
      console.error('[AsyncCardGeneration] 恢复状态失败:', error)
      // 如果有消息ID，清除对应消息的状态
      if (unfinishedGeneration && unfinishedGeneration.message) {
        clearGenerationState(unfinishedGeneration.message.id)
      }
      return null
    }
  }
  
  /**
   * 停止生成（取消轮询）
   */
  const stopGeneration = () => {
    if (pollingTimer) {
      clearTimeout(pollingTimer)
      pollingTimer = null
    }
    isGenerating.value = false
    generatingStatus.value = ''
    pollingAttempts.value = 0
    currentTaskId.value = null
    ElMessage.info('已停止生成')
  }
  
  /**
   * 手动刷新状态（用户主动触发）
   */
  const refreshStatus = async (topic, folderName) => {
    if (!isGenerating.value) return null
    
    try {
      const statusResponse = await fetch(`/api/generate/status/${encodeURIComponent(topic)}`)
      const statusResult = await statusResponse.json()
      
      console.log('[AsyncCardGeneration] 手动刷新状态:', statusResult)
      
      if (statusResult.status === 'completed') {
        const filesResult = await getGeneratedFiles(folderName)
        isGenerating.value = false
        generatingStatus.value = ''
        return filesResult
      }
      
      return null
    } catch (error) {
      console.error('[AsyncCardGeneration] 刷新状态失败:', error)
      ElMessage.error('刷新状态失败: ' + error.message)
      return null
    }
  }
  
  return {
    // 状态
    isGenerating,
    generatingStatus,
    pollingAttempts,
    maxAttempts,
    pollingProgress,
    estimatedTimeLeft,
    formatTimeLeft,
    currentTaskId,
    
    // 方法
    startAsyncGeneration,
    stopGeneration,
    refreshStatus,
    recoverGenerationState,
    clearGenerationState
  }
}