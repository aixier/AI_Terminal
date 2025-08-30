import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 模板注册文件路径
const REGISTRY_PATH = path.join(__dirname, '../../data/template-registry.jsonl')

// 缓存模板信息
let templateCache = null
let lastLoadTime = 0
const CACHE_TTL = 60000 // 缓存1分钟

/**
 * 加载模板注册信息
 */
async function loadTemplateRegistry() {
  const now = Date.now()
  
  // 使用缓存
  if (templateCache && (now - lastLoadTime) < CACHE_TTL) {
    return templateCache
  }
  
  try {
    const content = await fs.readFile(REGISTRY_PATH, 'utf-8')
    const lines = content.trim().split('\n').filter(line => line.trim())
    
    const templates = {}
    for (const line of lines) {
      try {
        const template = JSON.parse(line)
        templates[template.id] = template
      } catch (err) {
        console.error('Error parsing template registry line:', line, err)
      }
    }
    
    templateCache = templates
    lastLoadTime = now
    return templates
  } catch (error) {
    console.error('Error loading template registry:', error)
    return {}
  }
}

/**
 * 获取单个模板信息
 * @param {string} templateId - 模板ID
 */
export async function getTemplateInfo(templateId) {
  const templates = await loadTemplateRegistry()
  return templates[templateId] || null
}

/**
 * 获取所有模板列表
 */
export async function getAllTemplates() {
  const templates = await loadTemplateRegistry()
  return Object.values(templates)
}

/**
 * 检查生成是否完成
 * @param {string} templateId - 模板ID
 * @param {Array} jsonFiles - JSON文件列表
 * @param {Array} htmlFiles - HTML文件列表
 * @returns {Object} - { isCompleted, progress, message }
 */
export async function checkGenerationCompletion(templateId, jsonFiles = [], htmlFiles = []) {
  const template = await getTemplateInfo(templateId)
  
  if (!template) {
    // 未知模板，使用默认逻辑
    return {
      isCompleted: jsonFiles.length > 0 || htmlFiles.length > 0,
      progress: { json: jsonFiles.length, html: htmlFiles.length },
      message: '生成中'
    }
  }
  
  // 根据模板配置检查完成状态
  const { outputType, outputCount, waitForTrigger, triggerFile } = template
  
  // 如果需要等待触发文件
  if (waitForTrigger && triggerFile === 'json') {
    if (jsonFiles.length === 0) {
      return {
        isCompleted: false,
        progress: { json: 0, html: 0, expected: outputCount },
        message: '等待JSON文件生成'
      }
    }
    
    // JSON已生成，检查目标文件
    if (outputType === 'html') {
      const isCompleted = htmlFiles.length >= outputCount
      return {
        isCompleted,
        progress: { 
          json: jsonFiles.length, 
          html: htmlFiles.length, 
          expected: outputCount 
        },
        message: isCompleted 
          ? `生成完成（${htmlFiles.length}/${outputCount} HTML文件）`
          : `JSON已生成，正在生成HTML文件 (${htmlFiles.length}/${outputCount})`
      }
    }
  }
  
  // 直接检查目标文件
  if (outputType === 'html') {
    const isCompleted = htmlFiles.length >= outputCount
    return {
      isCompleted,
      progress: { 
        json: jsonFiles.length, 
        html: htmlFiles.length, 
        expected: outputCount 
      },
      message: isCompleted 
        ? `生成完成（${htmlFiles.length} HTML文件）`
        : `正在生成HTML文件 (${htmlFiles.length}/${outputCount})`
    }
  } else if (outputType === 'json') {
    const isCompleted = jsonFiles.length >= outputCount
    return {
      isCompleted,
      progress: { 
        json: jsonFiles.length, 
        html: htmlFiles.length, 
        expected: outputCount 
      },
      message: isCompleted 
        ? `生成完成（${jsonFiles.length} JSON文件）`
        : `正在生成JSON文件 (${jsonFiles.length}/${outputCount})`
    }
  }
  
  // 默认逻辑
  return {
    isCompleted: jsonFiles.length > 0 || htmlFiles.length > 0,
    progress: { json: jsonFiles.length, html: htmlFiles.length },
    message: '生成中'
  }
}

/**
 * 获取模板的快捷按钮信息
 */
export async function getTemplateQuickButtons() {
  const templates = await getAllTemplates()
  return templates.map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    icon: t.outputType === 'html' ? '🌐' : '📄'
  }))
}

export default {
  getTemplateInfo,
  getAllTemplates,
  checkGenerationCompletion,
  getTemplateQuickButtons
}