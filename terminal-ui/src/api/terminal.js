import axios from 'axios'
import { API_BASE_URL } from './config'
import { getApiBaseUrl } from '../config/api.config'

// API_BASE_URL 现在是函数，需要调用它
const getApiUrl = () => `${getApiBaseUrl()}/terminal`

/**
 * 执行Terminal命令（两阶段流程）
 * @param {Object} params
 * @param {string} params.command - 要执行的命令/prompt
 * @param {string} params.type - 命令类型：'generate-json' 或 'generate-card'
 * @param {string} params.topic - 主题（仅generate-json时需要）
 */
export const executeCommand = async (params) => {
  try {
    const response = await axios.post(`${getApiUrl()}/execute`, params, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })
    return response.data
  } catch (error) {
    console.error('Execute command error:', error)
    throw error
  }
}

/**
 * 获取用户的卡片文件夹列表
 */
export const getUserFolders = async () => {
  try {
    const response = await axios.get(`${getApiUrl()}/folders`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })
    return response.data
  } catch (error) {
    console.error('Get user folders error:', error)
    throw error
  }
}

/**
 * 检查Claude会话状态
 */
export const checkHealth = async () => {
  try {
    const response = await axios.get(`${getApiUrl()}/health`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })
    return response.data
  } catch (error) {
    console.error('Health check error:', error)
    throw error
  }
}

/**
 * 清理用户会话
 */
export const cleanupSession = async () => {
  try {
    const response = await axios.post(`${getApiUrl()}/cleanup`, {}, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })
    return response.data
  } catch (error) {
    console.error('Cleanup session error:', error)
    throw error
  }
}

/**
 * 获取公共模板列表
 */
export const getTemplates = async () => {
  try {
    const response = await axios.get(`${getApiUrl()}/templates`)
    return response.data
  } catch (error) {
    console.error('Get templates error:', error)
    throw error
  }
}

/**
 * 获取指定模板的内容
 */
export const getTemplateContent = async (templateId) => {
  try {
    const response = await axios.get(`${getApiUrl()}/templates/${templateId}`)
    return response.data
  } catch (error) {
    console.error('Get template content error:', error)
    throw error
  }
}

/**
 * 获取卡片内容 - 仅用于读取JSON文件内容
 */
export const getCardContent = async (cardPath) => {
  try {
    // 仅对JSON文件允许读取
    if (!cardPath.endsWith('.json')) {
      console.warn('getCardContent only supports JSON files')
      return { success: false, message: 'Only JSON files are supported' }
    }
    
    const response = await axios.get(`${getApiUrl()}/card`, {
      params: { path: cardPath },
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })
    return response.data
  } catch (error) {
    console.error('Get card content error:', error)
    // 返回失败而不是抛出错误，让调用方处理
    return { success: false, message: error.message }
  }
}

/**
 * 获取cards目录结构
 */
export const getCardsDirectory = async () => {
  try {
    const response = await axios.get(`${getApiUrl()}/cards-directory`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })
    return response.data
  } catch (error) {
    console.error('Get cards directory error:', error)
    throw error
  }
}

/**
 * 保存生成的HTML文件到本地
 */
export const saveGeneratedHtml = async (params) => {
  try {
    const response = await axios.post(`${getApiUrl()}/save-html`, {
      jsonPath: params.jsonPath,  // 使用JSON文件路径
      content: params.content,
      folderId: params.folderId,
      fileName: params.fileName
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })
    return response.data
  } catch (error) {
    console.error('Save HTML error:', error)
    // 不抛出错误，返回失败状态
    return { success: false, error: error.message }
  }
}

/**
 * 通过后端获取并保存HTML文件
 */
export const fetchAndSaveHtml = async (params) => {
  try {
    const response = await axios.post(`${getApiUrl()}/fetch-and-save-html`, params, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })
    return response.data
  } catch (error) {
    console.error('Fetch and save HTML error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 保存响应文件
 */
export const saveResponseFile = async (params) => {
  try {
    const response = await axios.post(`${getApiUrl()}/save-response`, {
      path: params.path,
      content: params.content
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })
    return response.data
  } catch (error) {
    console.error('Save response file error:', error)
    // 不抛出错误，返回失败状态
    return { success: false, error: error.message }
  }
}

/**
 * 保存卡片内容到文件
 */
export const saveCardContent = async (params) => {
  try {
    const response = await axios.post(`${getApiUrl()}/save-card`, {
      path: params.path,
      content: params.content,
      type: params.type || 'json'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })
    return response.data
  } catch (error) {
    console.error('Save card content error:', error)
    // 不抛出错误，返回失败状态
    return { success: false, error: error.message }
  }
}

/**
 * 删除卡片文件或文件夹
 */
export const deleteCard = async (targetPath) => {
  try {
    console.log('[API] Deleting card/folder:', targetPath)
    const response = await axios.delete(`${getApiUrl()}/card`, {
      data: { path: targetPath },
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    })
    return response.data
  } catch (error) {
    console.error('Delete card error:', error)
    console.error('Delete card request details:', {
      url: `${getApiUrl()}/card`,
      path: targetPath,
      headers: error.config?.headers,
      data: error.config?.data
    })
    throw error
  }
}

export default {
  executeCommand,
  getUserFolders,
  checkHealth,
  cleanupSession,
  getTemplates,
  getTemplateContent,
  getCardContent,
  getCardsDirectory,
  saveGeneratedHtml,
  fetchAndSaveHtml,
  saveResponseFile,
  saveCardContent,
  deleteCard
}