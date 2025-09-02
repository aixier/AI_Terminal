import fs from 'fs/promises'
import path from 'path'

/**
 * Prompt路径处理器
 * 负责替换prompt中的路径占位符
 */
class PromptProcessor {
  /**
   * 处理prompt中的路径占位符
   * [path] -> 模板目录中的实际路径
   * "用户card路径" -> 用户的card工作目录
   * 
   * @param {string} prompt - 原始prompt
   * @param {string} templateDir - 模板目录
   * @param {string} cardPath - 用户card路径
   * @returns {Promise<string>} 处理后的prompt
   */
  async processPrompt(prompt, templateDir, cardPath) {
    console.log('[PromptProcessor] ==========================================')
    console.log('[PromptProcessor] Processing prompt paths')
    console.log('[PromptProcessor] Template dir:', templateDir)
    console.log('[PromptProcessor] Card path:', cardPath)
    console.log('[PromptProcessor] Original prompt:')
    console.log('[PromptProcessor]  ', prompt.substring(0, 200) + (prompt.length > 200 ? '...' : ''))
    
    let processed = prompt
    const notFoundPaths = []
    
    // 1. 替换方括号路径 [xxx]，但排除特殊占位符
    const specialPlaceholders = ['[user]', '[用户card路径]']
    const bracketMatches = (prompt.match(/\[([^\]]+)\]/g) || [])
      .filter(match => !specialPlaceholders.includes(match.toLowerCase()))
    console.log(`[PromptProcessor] Found ${bracketMatches.length} bracket paths to replace`)
    
    for (const match of bracketMatches) {
      const fileName = match.slice(1, -1) // 去除方括号
      
      try {
        // 递归查找文件或目录
        const fullPath = await this.findPath(templateDir, fileName)
        
        if (fullPath) {
          processed = processed.replace(match, fullPath)
          console.log(`[PromptProcessor] Replaced [${fileName}] -> ${fullPath}`)
        } else {
          notFoundPaths.push(fileName)
          console.warn(`[PromptProcessor] Path not found: ${fileName}`)
        }
      } catch (error) {
        notFoundPaths.push(fileName)
        console.error(`[PromptProcessor] Error finding path ${fileName}:`, error.message)
      }
    }
    
    // 2. 替换用户card路径
    // 支持多种格式：[user], "用户card路径", [用户card路径]
    let totalUserPathReplacements = 0
    
    // 替换 [user] 占位符
    const userBracketMatches = processed.match(/\[user\]/gi) || []
    if (userBracketMatches.length > 0) {
      processed = processed.replace(/\[user\]/gi, cardPath)
      console.log(`[PromptProcessor] Replaced ${userBracketMatches.length} instances of [user] -> ${cardPath}`)
      totalUserPathReplacements += userBracketMatches.length
    }
    
    // 替换 "用户card路径" 占位符
    const cardPathMatches = processed.match(/"用户card路径"/g) || []
    if (cardPathMatches.length > 0) {
      processed = processed.replace(/"用户card路径"/g, `"${cardPath}"`)
      console.log(`[PromptProcessor] Replaced ${cardPathMatches.length} instances of "用户card路径" -> "${cardPath}"`)
      totalUserPathReplacements += cardPathMatches.length
    }
    
    // 替换 [用户card路径] 占位符
    const userCardBracketMatches = processed.match(/\[用户card路径\]/g) || []
    if (userCardBracketMatches.length > 0) {
      processed = processed.replace(/\[用户card路径\]/g, cardPath)
      console.log(`[PromptProcessor] Replaced ${userCardBracketMatches.length} instances of [用户card路径] -> ${cardPath}`)
      totalUserPathReplacements += userCardBracketMatches.length
    }
    
    // 如果有未找到的路径，抛出错误
    if (notFoundPaths.length > 0) {
      const error = new Error(`以下路径未找到: ${notFoundPaths.join(', ')}`)
      error.notFoundPaths = notFoundPaths
      throw error
    }
    
    // 打印处理后的prompt
    console.log('[PromptProcessor] ==========================================')
    console.log('[PromptProcessor] Processed prompt:')
    console.log('[PromptProcessor]  ', processed.substring(0, 300) + (processed.length > 300 ? '...' : ''))
    console.log('[PromptProcessor] Total replacements:', bracketMatches.length + totalUserPathReplacements)
    console.log('[PromptProcessor] ==========================================')
    
    return processed
  }
  
  /**
   * 查找文件或目录
   * @param {string} baseDir - 基础目录
   * @param {string} target - 目标文件/目录名
   * @returns {Promise<string|null>} 找到的完整路径
   */
  async findPath(baseDir, target) {
    // 如果target包含路径分隔符，说明是相对路径
    if (target.includes('/') || target.includes('\\')) {
      const fullPath = path.join(baseDir, target)
      try {
        await fs.access(fullPath)
        return fullPath
      } catch {
        return null
      }
    }
    
    // 否则递归搜索文件或目录名
    return await this.searchRecursive(baseDir, target)
  }
  
  /**
   * 递归搜索文件或目录
   * @param {string} dir - 搜索目录
   * @param {string} target - 目标名称
   * @returns {Promise<string|null>} 找到的路径
   */
  async searchRecursive(dir, target) {
    try {
      const items = await fs.readdir(dir, { withFileTypes: true })
      
      // 首先检查当前目录
      for (const item of items) {
        if (item.name === target) {
          return path.join(dir, item.name)
        }
      }
      
      // 然后递归搜索子目录
      for (const item of items) {
        if (item.isDirectory() && !item.name.startsWith('.')) {
          const found = await this.searchRecursive(
            path.join(dir, item.name),
            target
          )
          if (found) return found
        }
      }
    } catch (error) {
      console.warn(`[PromptProcessor] Error searching in ${dir}:`, error.message)
    }
    
    return null
  }
  
  /**
   * 验证路径是否存在
   * @param {string} filePath - 文件路径
   * @returns {Promise<boolean>} 是否存在
   */
  async pathExists(filePath) {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }
  
  /**
   * 构建路径映射表
   * @param {string} prompt - 原始prompt
   * @param {string} templateDir - 模板目录
   * @returns {Promise<Object>} 路径映射表
   */
  async buildPathMapping(prompt, templateDir) {
    const mapping = {}
    
    // 提取所有方括号路径
    const bracketMatches = prompt.match(/\[([^\]]+)\]/g) || []
    
    for (const match of bracketMatches) {
      const fileName = match.slice(1, -1)
      const fullPath = await this.findPath(templateDir, fileName)
      if (fullPath) {
        mapping[match] = fullPath
      }
    }
    
    return mapping
  }
}

export default new PromptProcessor()
export { PromptProcessor }