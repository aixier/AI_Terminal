/**
 * 模板管理API
 */

import service from './config.js'

/**
 * 获取所有模板列表
 * @returns {Promise<Object>} 模板列表
 */
export const getTemplates = async () => {
  const response = await service.get('/generate/templates')
  return response
}

/**
 * 获取快捷按钮配置
 * @returns {Promise<Object>} 快捷按钮列表
 */
export const getTemplateButtons = async () => {
  const response = await service.get('/generate/templates/buttons')
  return response
}

/**
 * 获取单个模板信息
 * @param {string} templateId - 模板ID
 * @returns {Promise<Object>} 模板信息
 */
export const getTemplateInfo = async (templateId) => {
  const response = await service.get(`/generate/templates/${encodeURIComponent(templateId)}`)
  return response
}

export default {
  getTemplates,
  getTemplateButtons,
  getTemplateInfo
}