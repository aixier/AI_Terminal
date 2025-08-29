import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'

export function useCardGeneration() {
  const isGenerating = ref(false)
  const generatingHint = ref('')
  const streamMessages = ref([])
  const abortController = ref(null)
  
  // 开始生成
  const startGeneration = async (params) => {
    if (isGenerating.value) {
      ElMessage.warning('正在生成中，请稍候')
      return null
    }
    
    isGenerating.value = true
    generatingHint.value = '准备生成...'
    streamMessages.value = []
    
    // 创建新的 AbortController
    abortController.value = new AbortController()
    
    try {
      const response = await fetch('/api/generate/card/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
        signal: abortController.value.signal
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      return response
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Generation aborted')
      } else {
        console.error('Generation error:', error)
        ElMessage.error('生成失败: ' + error.message)
      }
      isGenerating.value = false
      generatingHint.value = ''
      return null
    }
  }
  
  // 处理流式响应
  const processStream = async (response, onChunk, onComplete) => {
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    
    try {
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) {
          break
        }
        
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        
        for (const line of lines) {
          if (line.trim()) {
            streamMessages.value.push(line)
            if (onChunk) {
              onChunk(line)
            }
          }
        }
      }
      
      // 处理剩余的 buffer
      if (buffer.trim()) {
        streamMessages.value.push(buffer)
        if (onChunk) {
          onChunk(buffer)
        }
      }
      
      isGenerating.value = false
      generatingHint.value = '生成完成'
      
      if (onComplete) {
        onComplete(streamMessages.value)
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Stream processing aborted')
      } else {
        console.error('Stream processing error:', error)
        ElMessage.error('处理响应失败: ' + error.message)
      }
      isGenerating.value = false
      generatingHint.value = ''
    }
  }
  
  // 停止生成
  const stopGeneration = () => {
    if (abortController.value) {
      abortController.value.abort()
      abortController.value = null
    }
    isGenerating.value = false
    generatingHint.value = ''
    ElMessage.info('已停止生成')
  }
  
  // 计算总字符数
  const totalChars = computed(() => {
    return streamMessages.value.reduce((sum, msg) => sum + msg.length, 0)
  })
  
  return {
    isGenerating,
    generatingHint,
    streamMessages,
    totalChars,
    startGeneration,
    processStream,
    stopGeneration
  }
}