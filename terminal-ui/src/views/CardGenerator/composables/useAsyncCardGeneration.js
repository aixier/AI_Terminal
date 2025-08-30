import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { generateCardAsync, checkAsyncTaskStatus } from '../../../api/asyncCardGeneration.js'

// 本地存储的key
const GENERATION_STATE_KEY = 'ai_card_generation_state'

export function useAsyncCardGeneration() {
  const isGenerating = ref(false)
  const generatingStatus = ref('')
  const pollingAttempts = ref(0)
  const maxAttempts = ref(150) // 5分钟超时
  const pollingInterval = ref(2000) // 2秒间隔
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
   * @returns {Promise<Object>} - 生成结果
   */
  const startAsyncGeneration = async (params) => {
    if (isGenerating.value) {
      ElMessage.warning('正在生成中，请稍候')
      return null
    }
    
    try {
      isGenerating.value = true
      generatingStatus.value = '提交生成请求...'
      pollingAttempts.value = 0
      
      console.log('[AsyncCardGeneration] 开始异步生成:', params)
      
      // 使用统一的API，并获取taskId
      let taskId = null
      const result = await generateCardAsync(params, {
        onTaskCreated: (id) => {
          taskId = id
          currentTaskId.value = id
          // 保存状态到本地存储
          saveGenerationState(id, params)
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
        },
        onStatusChange: (status) => {
          generatingStatus.value = status.message
          console.log('[AsyncCardGeneration] 状态变化:', status)
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
      clearGenerationState() // 生成完成后清除状态
      
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
   * 保存生成状态到本地存储
   */
  const saveGenerationState = (taskId, params) => {
    if (!taskId) return
    
    const state = {
      taskId,
      params,
      timestamp: Date.now(),
      status: generatingStatus.value
    }
    
    try {
      localStorage.setItem(GENERATION_STATE_KEY, JSON.stringify(state))
      console.log('[AsyncCardGeneration] 保存生成状态:', state)
    } catch (error) {
      console.error('[AsyncCardGeneration] 保存状态失败:', error)
    }
  }
  
  /**
   * 清除保存的生成状态
   */
  const clearGenerationState = () => {
    try {
      localStorage.removeItem(GENERATION_STATE_KEY)
      currentTaskId.value = null
      console.log('[AsyncCardGeneration] 清除生成状态')
    } catch (error) {
      console.error('[AsyncCardGeneration] 清除状态失败:', error)
    }
  }
  
  /**
   * 恢复生成状态（页面刷新后）
   */
  const recoverGenerationState = async () => {
    try {
      const savedState = localStorage.getItem(GENERATION_STATE_KEY)
      if (!savedState) return null
      
      const state = JSON.parse(savedState)
      
      // 检查状态是否过期（超过10分钟）
      const now = Date.now()
      const age = now - state.timestamp
      if (age > 10 * 60 * 1000) {
        console.log('[AsyncCardGeneration] 状态已过期，清除')
        clearGenerationState()
        return null
      }
      
      console.log('[AsyncCardGeneration] 恢复生成状态:', state)
      
      // 检查任务状态
      const statusResult = await checkAsyncTaskStatus(state.taskId)
      console.log('[AsyncCardGeneration] 任务状态检查结果:', statusResult)
      
      if (statusResult.status === 'completed') {
        // 任务已完成
        clearGenerationState()
        
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
        
        // 继续轮询
        const result = await generateCardAsync(state.params, {
          taskId: state.taskId, // 传入已有的taskId
          onProgress: (progressInfo) => {
            pollingAttempts.value = progressInfo.attempt
            const progress = Math.round(progressInfo.progress)
            generatingStatus.value = `恢复中 - ${progressInfo.detail || `检查状态 ${progress}%`}`
          },
          onStatusChange: (status) => {
            generatingStatus.value = status.message
          }
        })
        
        clearGenerationState()
        isGenerating.value = false
        return result
      } else {
        // 任务失败或不存在
        clearGenerationState()
        return null
      }
    } catch (error) {
      console.error('[AsyncCardGeneration] 恢复状态失败:', error)
      clearGenerationState()
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
    clearGenerationState() // 清除保存的状态
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