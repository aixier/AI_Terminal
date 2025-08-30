/**
 * API统一入口
 * 统一导出所有API模块
 */

// 配置
export { default as apiService, config, API_BASE_URL } from './config.js'

// 卡片生成相关API
export * as AsyncCardAPI from './asyncCardGeneration.js'
export { default as CardGeneratorAPI } from './cardGenerator.js'

// 模板相关API
export * as TemplatesAPI from './templates.js'

// 终端相关API
export { default as TerminalAPI } from './terminal.js'

// 默认导出常用API
export { generateCardAsync, submitAsyncGeneration, checkGenerationStatus, getGeneratedFiles } from './asyncCardGeneration.js'