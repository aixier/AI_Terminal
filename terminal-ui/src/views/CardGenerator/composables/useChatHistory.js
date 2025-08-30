import { ref, watch } from 'vue'

export function useChatHistory() {
  const messages = ref([])
  const maxHistorySize = 50
  const storageKey = 'chat_history'
  
  // 添加用户消息
  const addUserMessage = (content, template = null) => {
    const message = {
      id: `user_${Date.now()}`,
      type: 'user',
      content,
      template,
      timestamp: new Date()
    }
    messages.value.push(message)
    saveToLocal()
    return message
  }
  
  // 添加AI消息
  const addAIMessage = (content = '', isGenerating = false, title = '', template = null, generationState = null) => {
    const message = {
      id: `ai_${Date.now()}`,
      type: 'ai',
      content,
      isGenerating,
      title,
      template,
      timestamp: new Date(),
      error: false,
      resultData: null,
      // 添加生成状态信息
      generationState: generationState ? {
        taskId: generationState.taskId,
        params: generationState.params,
        pollingAttempts: generationState.pollingAttempts || 0,
        maxAttempts: generationState.maxAttempts || 100,
        status: generationState.status
      } : null
    }
    messages.value.push(message)
    // 始终保存，包括生成中的消息，以防切换tab时丢失状态
    saveToLocal()
    return message
  }
  
  // 更新消息
  const updateMessage = (messageId, updates) => {
    const index = messages.value.findIndex(m => m.id === messageId)
    if (index !== -1) {
      messages.value[index] = {
        ...messages.value[index],
        ...updates
      }
      // 始终保存更新，确保状态变化被持久化
      saveToLocal()
    }
  }
  
  // 删除消息
  const deleteMessage = (messageId) => {
    const index = messages.value.findIndex(m => m.id === messageId)
    if (index !== -1) {
      messages.value.splice(index, 1)
      saveToLocal()
    }
  }
  
  // 清空历史
  const clearHistory = () => {
    messages.value = []
    localStorage.removeItem(storageKey)
  }
  
  // 保存到本地存储
  const saveToLocal = () => {
    try {
      // 只保存最近的消息
      const recentMessages = messages.value.slice(-maxHistorySize).map(msg => ({
        ...msg,
        timestamp: msg.timestamp.toISOString()
      }))
      localStorage.setItem(storageKey, JSON.stringify(recentMessages))
    } catch (error) {
      console.error('Failed to save chat history:', error)
    }
  }
  
  // 从本地存储恢复
  const restoreFromLocal = () => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsedMessages = JSON.parse(saved)
        messages.value = parsedMessages.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }))
      }
    } catch (error) {
      console.error('Failed to restore chat history:', error)
      messages.value = []
    }
  }
  
  // 获取最后的用户消息
  const getLastUserMessage = () => {
    for (let i = messages.value.length - 1; i >= 0; i--) {
      if (messages.value[i].type === 'user') {
        return messages.value[i]
      }
    }
    return null
  }
  
  // 获取会话统计
  const getSessionStats = () => {
    const userMessages = messages.value.filter(m => m.type === 'user').length
    const aiMessages = messages.value.filter(m => m.type === 'ai').length
    const errors = messages.value.filter(m => m.error).length
    
    return {
      total: messages.value.length,
      userMessages,
      aiMessages,
      errors,
      successRate: aiMessages > 0 ? ((aiMessages - errors) / aiMessages * 100).toFixed(1) : 0
    }
  }
  
  // 获取未完成的生成任务
  const getUnfinishedGeneration = () => {
    // 从后往前查找，找到最新的正在生成的消息
    for (let i = messages.value.length - 1; i >= 0; i--) {
      const msg = messages.value[i]
      if (msg.type === 'ai' && msg.isGenerating && msg.generationState) {
        return {
          message: msg,
          state: msg.generationState
        }
      }
    }
    return null
  }
  
  return {
    messages,
    addUserMessage,
    addAIMessage,
    updateMessage,
    deleteMessage,
    clearHistory,
    restoreFromLocal,
    getLastUserMessage,
    getSessionStats,
    getUnfinishedGeneration
  }
}