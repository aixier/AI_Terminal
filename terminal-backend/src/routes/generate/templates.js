import express from 'express'
import path from 'path'
import fs from 'fs/promises'
import { getAllTemplates, getTemplateQuickButtons, getTemplateInfo } from '../../utils/templateRegistry.js'

const router = express.Router()

/**
 * 获取可用的模板列表（结合文件系统和注册信息）
 * GET /api/generate/templates
 */
router.get('/', async (_req, res) => {
  try {
    const isDocker = process.env.NODE_ENV === 'production' || process.env.DATA_PATH
    const dataPath = process.env.DATA_PATH || path.join(process.cwd(), 'data')
    const templatesPath = isDocker
      ? '/app/data/public_template'
      : path.join(dataPath, 'public_template')
    
    const items = await fs.readdir(templatesPath, { withFileTypes: true })
    const registeredTemplates = await getAllTemplates()
    const templates = []
    
    for (const item of items) {
      const fileName = item.isDirectory() ? item.name : item.name
      const templateInfo = registeredTemplates[fileName]
      
      if (item.isDirectory()) {
        // 文件夹模板
        templates.push({
          fileName: item.name,
          displayName: templateInfo?.name || item.name,
          description: templateInfo?.description || '',
          type: 'folder',
          outputType: templateInfo?.outputType || 'json',
          outputCount: templateInfo?.outputCount || 1
        })
      } else if (item.name.endsWith('.md')) {
        // 单文件模板
        templates.push({
          fileName: item.name,
          displayName: templateInfo?.name || item.name.replace('.md', '').replace(/-/g, ' '),
          description: templateInfo?.description || '',
          type: 'file',
          outputType: templateInfo?.outputType || 'json',
          outputCount: templateInfo?.outputCount || 1
        })
      }
    }
    
    res.json({
      code: 200,
      success: true,
      templates: templates,
      message: 'success'
    })
  } catch (error) {
    res.status(500).json({
      code: 500,
      success: false,
      message: error.message
    })
  }
})

/**
 * 获取快捷按钮配置
 * GET /api/generate/templates/buttons
 */
router.get('/buttons', async (req, res) => {
  try {
    const buttons = await getTemplateQuickButtons()
    res.json({
      code: 200,
      success: true,
      data: buttons,
      message: '获取快捷按钮成功'
    })
  } catch (error) {
    console.error('[Templates API] Error getting buttons:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: error.message
    })
  }
})

/**
 * 获取单个模板信息
 * GET /api/generate/templates/:templateId
 */
router.get('/:templateId', async (req, res) => {
  try {
    const { templateId } = req.params
    const template = await getTemplateInfo(templateId)
    
    if (!template) {
      return res.status(404).json({
        code: 404,
        success: false,
        message: '模板不存在'
      })
    }
    
    res.json({
      code: 200,
      success: true,
      data: template,
      message: '获取模板信息成功'
    })
  } catch (error) {
    console.error('[Templates API] Error getting template info:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: error.message
    })
  }
})

export default router