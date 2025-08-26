import express from 'express'
import claudeExecutorDirect from '../../services/claudeExecutorDirect.js'

const router = express.Router()

/**
 * 简化的Claude执行API
 * POST /api/generate/cc
 * 
 * 请求体：
 * {
 *   "prompt": "提示词内容",
 *   "timeout": 30000 (可选，默认30秒)
 * }
 */
router.post('/', async (req, res) => {
  try {
    const { prompt, timeout = 30000 } = req.body
    
    // 参数验证
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: 'prompt参数不能为空'
      })
    }
    
    console.log(`[CC API] ==================== REQUEST ====================`)
    console.log(`[CC API] Prompt: ${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}`)
    console.log(`[CC API] Timeout: ${timeout}ms`)
    console.log(`[CC API] =================================================`)
    
    // 使用直接执行服务（避免 PTY 兼容性问题）
    const result = await claudeExecutorDirect.executePrompt(prompt, timeout, 'cc_api')
    
    if (!result.success) {
      console.log(`[CC API] Execution failed: ${result.error}`)
      
      // 根据错误类型返回不同的状态码
      const statusCode = result.error === 'Execution timeout' ? 408 : 500
      
      return res.status(statusCode).json({
        code: statusCode,
        success: false,
        message: result.error || '执行失败',
        timeout: timeout,
        partialOutput: result.output
      })
    }
    
    console.log(`[CC API] ==================== SUCCESS ====================`)
    console.log(`[CC API] Execution time: ${result.executionTime}ms`)
    console.log(`[CC API] Output length: ${result.output.length} bytes`)
    console.log(`[CC API] =================================================`)
    
    return res.json({
      code: 200,
      success: true,
      output: result.output,
      executionTime: result.executionTime
    })
    
  } catch (error) {
    console.error(`[CC API] ==================== ERROR ====================`)
    console.error(`[CC API] Unexpected error:`, error)
    console.error(`[CC API] ===============================================`)
    
    return res.status(500).json({
      code: 500,
      success: false,
      message: '执行失败',
      error: error.message
    })
  }
})

export default router