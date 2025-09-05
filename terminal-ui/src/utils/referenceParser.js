/**
 * 引用解析工具
 * 用于解析和处理 @[type:value] 格式的引用标记
 */

// 引用标记正则表达式 - 支持两种格式
const REFERENCE_PATTERN = /@\[(category|file):([^\]]+)\]/g  // 标准格式：@[type:value]
// 自由格式：匹配 @文件名 或 空格@文件名
// 捕获组包含完整的文件名（包括扩展名），直到遇到空格或标点符号
// 重要：保留点号(.)用于文件扩展名，但其他标点符号作为结束符
const FREE_REFERENCE_PATTERN = /(?:^|\s)@([^\s,，。!?！？、；;：:'"'"]+)/g  // 自由格式：@文件名（包含扩展名）
const AT_SYMBOL_PATTERN = /(?:^|\s)@$/  // 检测开头或空格后的@符号

/**
 * 解析文本中的所有引用（支持标准格式和自由格式）
 * @param {string} text - 要解析的文本
 * @returns {Array} 引用数组
 */
export const parseReferences = (text) => {
  const references = []
  let match
  
  // 1. 先解析标准格式 @[type:value]
  REFERENCE_PATTERN.lastIndex = 0
  while ((match = REFERENCE_PATTERN.exec(text)) !== null) {
    references.push({
      type: match[1],           // 'category' 或 'file'
      value: match[2],           // 引用的值
      rawText: match[0],         // 原始匹配文本
      start: match.index,        // 开始位置
      end: match.index + match[0].length,  // 结束位置
      format: 'standard'        // 格式类型
    })
  }
  
  // 2. 再解析自由格式 空格@文件名
  FREE_REFERENCE_PATTERN.lastIndex = 0
  while ((match = FREE_REFERENCE_PATTERN.exec(text)) !== null) {
    // 检查是否已被标准格式覆盖
    const isOverlapped = references.some(ref => 
      ref.start <= match.index && ref.end >= match.index + match[0].length
    )
    
    if (!isOverlapped) {
      const value = match[1]
      // 根据文件扩展名判断类型
      // 修复：正确检测包含点号的文件名（即有扩展名的文件）
      const hasExtension = value.includes('.') && /\.[a-zA-Z0-9]+$/.test(value)
      const isFile = hasExtension  // 有扩展名的就是文件
      
      console.log(`[referenceParser] Parsing free format: "${value}", hasExtension: ${hasExtension}, isFile: ${isFile}`)
      
      references.push({
        type: isFile ? 'file' : 'category',
        value: value,
        rawText: match[0],
        start: match.index,
        end: match.index + match[0].length,
        format: 'free'          // 自由格式
      })
    }
  }
  
  // 按位置排序
  return references.sort((a, b) => a.start - b.start)
}

/**
 * 格式化引用为标准格式
 * @param {string} type - 引用类型 ('category' 或 'file')
 * @param {object} item - 引用项对象
 * @returns {string} 格式化的引用字符串
 */
export const formatReference = (type, item) => {
  if (type === 'category') {
    // 分类引用：@[category:key]
    return `@[category:${item.key}]`
  } else if (type === 'file') {
    // 文件引用：@[file:filename]
    return `@[file:${item.name || item.fileName}]`
  }
  return ''
}

/**
 * 从文本中移除指定位置的引用
 * @param {string} text - 原始文本
 * @param {number} start - 引用开始位置
 * @param {number} end - 引用结束位置
 * @returns {string} 移除引用后的文本
 */
export const removeReference = (text, start, end) => {
  return text.substring(0, start) + text.substring(end)
}

/**
 * 替换文本中的引用
 * @param {string} text - 原始文本
 * @param {object} reference - 要替换的引用
 * @param {string} newValue - 新值
 * @returns {string} 替换后的文本
 */
export const replaceReference = (text, reference, newValue) => {
  return text.substring(0, reference.start) + 
         newValue + 
         text.substring(reference.end)
}

/**
 * 检查文本是否包含@符号触发器（需要前面有空格或在开头）
 * @param {string} text - 要检查的文本
 * @param {number} cursorPosition - 光标位置
 * @returns {boolean} 是否包含触发器
 */
export const hasAtTrigger = (text, cursorPosition) => {
  // 获取光标前的文本
  const textBeforeCursor = text.substring(0, cursorPosition)
  
  console.log('[referenceParser] hasAtTrigger - textBeforeCursor:', textBeforeCursor)
  console.log('[referenceParser] AT_SYMBOL_PATTERN:', AT_SYMBOL_PATTERN.source)
  
  // 检查是否以 空格@ 结尾，或者在开头
  if (textBeforeCursor === '@') {
    console.log('[referenceParser] @ at beginning detected')
    return true  // 在文本开头
  }
  
  const result = AT_SYMBOL_PATTERN.test(textBeforeCursor)  // 空格后跟@
  console.log('[referenceParser] AT_SYMBOL_PATTERN test result:', result)
  return result
}

/**
 * 获取@符号的位置
 * @param {string} text - 文本
 * @param {number} cursorPosition - 光标位置
 * @returns {number|null} @符号的位置，如果没有则返回null
 */
export const getAtSymbolPosition = (text, cursorPosition) => {
  const textBeforeCursor = text.substring(0, cursorPosition)
  
  // 在开头的情况
  if (textBeforeCursor === '@') {
    return 0
  }
  
  // 空格后跟@的情况
  if (AT_SYMBOL_PATTERN.test(textBeforeCursor)) {
    return cursorPosition - 1
  }
  
  return null
}

/**
 * 验证引用格式是否有效
 * @param {string} reference - 引用字符串
 * @returns {boolean} 是否有效
 */
export const isValidReference = (reference) => {
  const pattern = /^@\[(category|file):[^\]]+\]$/
  return pattern.test(reference)
}

/**
 * 提取引用的显示文本
 * @param {string} reference - 引用字符串
 * @param {object} metadata - 元数据对象（用于获取label）
 * @returns {string} 显示文本
 */
export const getReferenceDisplayText = (reference, metadata = null) => {
  const parsed = parseReferences(reference)[0]
  if (!parsed) return reference
  
  if (parsed.type === 'category' && metadata?.labels) {
    // 如果有元数据，返回中文标签
    return metadata.labels[parsed.value] || parsed.value
  }
  
  // 默认返回原始值
  return parsed.value
}

/**
 * 将引用转换为请求参数
 * @param {Array} references - 引用数组
 * @param {object} metadata - 元数据对象
 * @returns {Array} 请求参数数组
 */
export const convertReferencesToParams = (references, metadata = null) => {
  return references.map(ref => {
    if (ref.type === 'category') {
      // 用户输入的可能是label（如"abcd"），需要找到对应的key
      let actualKey = ref.value
      let actualLabel = ref.value
      
      // 如果metadata中有labels，尝试反查key
      if (metadata?.labels) {
        // 先检查value是否本身就是key
        if (metadata.labels[ref.value]) {
          // ref.value是key，直接使用
          actualLabel = metadata.labels[ref.value]
        } else {
          // ref.value可能是label，需要反查key
          for (const [key, label] of Object.entries(metadata.labels)) {
            if (label === ref.value) {
              actualKey = key
              actualLabel = label
              break
            }
          }
        }
      }
      
      return {
        type: 'category',
        key: actualKey,
        label: actualLabel,
        action: 'include'  // 默认动作
      }
    } else if (ref.type === 'file') {
      // 尝试从元数据中找到文件所属的分类
      let category = null
      let categoryLabel = null
      
      if (metadata?.assets) {
        for (const [key, files] of Object.entries(metadata.assets)) {
          if (files.includes(ref.value)) {
            category = key
            categoryLabel = metadata.labels?.[key] || key
            break
          }
        }
      }
      
      return {
        type: 'file',
        name: ref.value,
        category: category || '',
        categoryLabel: categoryLabel || '',
        action: 'include'
      }
    }
    
    return null
  }).filter(Boolean)
}

/**
 * 高亮文本中的引用
 * @param {string} text - 原始文本
 * @param {string} highlightClass - 高亮CSS类名
 * @returns {string} 带HTML标记的文本
 */
export const highlightReferences = (text, highlightClass = 'reference-highlight') => {
  const references = parseReferences(text)
  
  if (references.length === 0) {
    return text
  }
  
  let result = ''
  let lastIndex = 0
  
  references.forEach(ref => {
    // 添加引用前的普通文本
    result += text.substring(lastIndex, ref.start)
    
    // 添加高亮的引用
    result += `<span class="${highlightClass}" data-type="${ref.type}" data-value="${ref.value}">${ref.rawText}</span>`
    
    lastIndex = ref.end
  })
  
  // 添加最后一个引用后的文本
  result += text.substring(lastIndex)
  
  return result
}

/**
 * 统计文本中的引用数量
 * @param {string} text - 文本
 * @returns {object} 统计结果 {total, category, file}
 */
export const countReferences = (text) => {
  const references = parseReferences(text)
  
  return {
    total: references.length,
    category: references.filter(r => r.type === 'category').length,
    file: references.filter(r => r.type === 'file').length
  }
}

/**
 * 清理文本中的所有引用
 * @param {string} text - 原始文本
 * @returns {string} 清理后的文本
 */
export const cleanReferences = (text) => {
  return text.replace(REFERENCE_PATTERN, '')
}

/**
 * 提取纯文本（移除引用但保留其显示值）
 * @param {string} text - 原始文本
 * @param {object} metadata - 元数据
 * @returns {string} 纯文本
 */
export const extractPlainText = (text, metadata = null) => {
  return text.replace(REFERENCE_PATTERN, (match, type, value) => {
    if (type === 'category' && metadata?.labels) {
      return metadata.labels[value] || value
    }
    return value
  })
}

// 导出所有函数
export default {
  parseReferences,
  formatReference,
  removeReference,
  replaceReference,
  hasAtTrigger,
  getAtSymbolPosition,
  isValidReference,
  getReferenceDisplayText,
  convertReferencesToParams,
  highlightReferences,
  countReferences,
  cleanReferences,
  extractPlainText,
  REFERENCE_PATTERN,
  FREE_REFERENCE_PATTERN,
  AT_SYMBOL_PATTERN
}