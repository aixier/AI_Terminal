import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { generateCardAsync } from '../../../api/asyncCardGeneration.js'

export function useAsyncCardGeneration() {
  const isGenerating = ref(false)
  const generatingStatus = ref('')
  const pollingAttempts = ref(0)
  const maxAttempts = ref(150) // 5分钟超时
  const pollingInterval = ref(2000) // 2秒间隔
  
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
      
      // 使用统一的API
      const result = await generateCardAsync(params, {
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
        fileName: result.htmlFile?.name || result.primaryFile?.name,
        topic: result.topic,
        allFiles: result.files,
        generatedAt: result.generatedAt,
        totalFiles: result.totalFiles
      }
      
      isGenerating.value = false
      generatingStatus.value = '生成完成'
      
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
    
    // 方法
    startAsyncGeneration,
    stopGeneration,
    refreshStatus
  }
}