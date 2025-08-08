/**
 * JSON格式验证器
 * 根据API要求验证JSON格式是否符合规范
 */

/**
 * 验证JSON格式是否符合API要求
 * @param {Object} jsonData - 要验证的JSON数据
 * @returns {Object} - { valid: boolean, errors: Array, warnings: Array, suggestions: Array }
 */
export const validateJsonFormat = (jsonData) => {
  const errors = []
  const warnings = []
  const suggestions = []
  
  // 检查基本结构
  if (!jsonData || typeof jsonData !== 'object') {
    errors.push({
      field: 'root',
      message: 'JSON数据必须是一个有效的对象'
    })
    return { valid: false, errors, warnings, suggestions }
  }
  
  // 检查是否是完整的API格式（包含theme, copy, cards）
  const isFullApiFormat = jsonData.theme && jsonData.copy && jsonData.cards
  
  if (isFullApiFormat) {
    // 验证完整API格式
    validateFullApiFormat(jsonData, errors, warnings, suggestions)
  } else {
    // 验证简化格式（将被转换）
    validateSimpleFormat(jsonData, errors, warnings, suggestions)
  }
  
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestions
  }
}

/**
 * 验证完整的API格式
 */
const validateFullApiFormat = (jsonData, errors, warnings, suggestions) => {
  // 验证theme
  if (jsonData.theme) {
    const theme = jsonData.theme
    if (!theme.name) warnings.push({ field: 'theme.name', message: '缺少主题名称' })
    if (!theme.pageTitle) warnings.push({ field: 'theme.pageTitle', message: '缺少页面标题' })
    if (!theme.gradientColor1 || !theme.gradientColor2) {
      warnings.push({ field: 'theme.gradientColors', message: '建议设置渐变色' })
    }
  }
  
  // 验证copy
  if (jsonData.copy) {
    const copy = jsonData.copy
    if (!copy.title) warnings.push({ field: 'copy.title', message: '缺少文案标题' })
    if (!copy.content) warnings.push({ field: 'copy.content', message: '缺少文案内容' })
  }
  
  // 验证cards
  if (jsonData.cards) {
    if (!Array.isArray(jsonData.cards)) {
      errors.push({ field: 'cards', message: 'cards必须是数组' })
    } else {
      jsonData.cards.forEach((card, index) => {
        validateCard(card, index, errors, warnings, suggestions)
      })
      
      // 检查第一张卡片是否为main类型
      if (jsonData.cards[0] && jsonData.cards[0].type !== 'main') {
        suggestions.push({
          field: 'cards[0].type',
          message: '第一张卡片建议设置为main类型'
        })
      }
    }
  }
}

/**
 * 验证简化格式
 */
const validateSimpleFormat = (jsonData, errors, warnings, suggestions) => {
  // 检查必要字段
  if (!jsonData.title && !jsonData.name && !jsonData.header) {
    warnings.push({
      field: 'title',
      message: '缺少标题字段（title/name/header），将使用默认值"知识卡片"'
    })
  }
  
  // 检查cards数组
  if (jsonData.cards) {
    if (!Array.isArray(jsonData.cards)) {
      errors.push({
        field: 'cards',
        message: 'cards字段必须是一个数组'
      })
    } else {
      jsonData.cards.forEach((card, index) => {
        validateCard(card, index, errors, warnings, suggestions)
      })
    }
  } else {
    suggestions.push({
      field: 'cards',
      message: '建议添加cards数组来定义卡片内容'
    })
  }
  
  // 检查content字段
  if (jsonData.content) {
    if (typeof jsonData.content === 'object' && !Array.isArray(jsonData.content)) {
      warnings.push({
        field: 'content',
        message: 'content是对象类型，将被转换为JSON字符串显示'
      })
    }
  }
  
  // 检查sections
  if (jsonData.sections) {
    if (!Array.isArray(jsonData.sections)) {
      errors.push({
        field: 'sections',
        message: 'sections字段必须是一个数组'
      })
    } else {
      jsonData.sections.forEach((section, index) => {
        validateSection(section, index, errors, warnings)
      })
    }
  }
}

/**
 * 验证单个card对象
 */
const validateCard = (card, index, errors, warnings, suggestions) => {
  const cardPath = `cards[${index}]`
  
  // 检查card类型
  if (!card || typeof card !== 'object') {
    errors.push({
      field: cardPath,
      message: '卡片必须是一个对象'
    })
    return
  }
  
  // 检查type字段
  if (card.type && !['main', 'normal'].includes(card.type)) {
    warnings.push({
      field: `${cardPath}.type`,
      message: `卡片类型"${card.type}"无效，应该是"main"或"normal"，将自动修正`
    })
  }
  
  // 检查必要字段
  if (!card.title && !card.header) {
    warnings.push({
      field: `${cardPath}.title`,
      message: '卡片缺少标题（title/header）'
    })
  }
  
  // 检查content结构
  if (card.content) {
    if (typeof card.content === 'string') {
      // 字符串内容是允许的
    } else if (typeof card.content === 'object') {
      // 验证content对象
      validateCardContent(card.content, cardPath, warnings, suggestions)
    } else if (!Array.isArray(card.content) && !card.list) {
      warnings.push({
        field: `${cardPath}.content`,
        message: 'content应该是字符串、数组或对象格式'
      })
    }
  }
  
  // 第一个卡片的特殊检查
  if (index === 0) {
    if (!card.highlight && !card.content?.highlight) {
      suggestions.push({
        field: `${cardPath}.highlight`,
        message: '主卡片建议添加highlight字段突出显示核心内容'
      })
    }
    if (!card.points && !card.content?.points) {
      suggestions.push({
        field: `${cardPath}.points`,
        message: '主卡片建议添加points数组展示要点'
      })
    }
  }
}

/**
 * 验证card的content对象
 */
const validateCardContent = (content, cardPath, warnings, suggestions) => {
  // 检查highlight
  if (content.highlight) {
    if (typeof content.highlight !== 'object') {
      warnings.push({
        field: `${cardPath}.content.highlight`,
        message: 'highlight应该是包含number和description的对象'
      })
    } else {
      if (!content.highlight.number && !content.highlight.description) {
        warnings.push({
          field: `${cardPath}.content.highlight`,
          message: 'highlight对象应该包含number或description字段'
        })
      }
    }
  }
  
  // 检查points
  if (content.points) {
    if (!Array.isArray(content.points)) {
      warnings.push({
        field: `${cardPath}.content.points`,
        message: 'points必须是一个数组'
      })
    } else {
      content.points.forEach((point, idx) => {
        if (typeof point === 'object') {
          if (!point.text && !point.content) {
            warnings.push({
              field: `${cardPath}.content.points[${idx}]`,
              message: 'point对象应该包含text或content字段'
            })
          }
        }
      })
    }
  }
  
  // 检查list
  if (content.list && !Array.isArray(content.list)) {
    warnings.push({
      field: `${cardPath}.content.list`,
      message: 'list必须是一个数组'
    })
  }
  
  // 检查tags
  if (content.tags && !Array.isArray(content.tags)) {
    warnings.push({
      field: `${cardPath}.content.tags`,
      message: 'tags必须是一个数组'
    })
  }
}

/**
 * 验证section对象
 */
const validateSection = (section, index, errors, warnings) => {
  const sectionPath = `sections[${index}]`
  
  if (!section || typeof section !== 'object') {
    errors.push({
      field: sectionPath,
      message: '章节必须是一个对象'
    })
    return
  }
  
  if (!section.title && !section.name) {
    warnings.push({
      field: `${sectionPath}.title`,
      message: '章节缺少标题（title/name）'
    })
  }
  
  if (section.content && typeof section.content === 'object' && !Array.isArray(section.content)) {
    warnings.push({
      field: `${sectionPath}.content`,
      message: '章节content是对象类型，建议使用字符串或数组'
    })
  }
}

/**
 * 格式化验证结果为可读的消息
 */
export const formatValidationMessage = (validationResult) => {
  const messages = []
  
  if (validationResult.errors.length > 0) {
    messages.push('❌ 错误：')
    validationResult.errors.forEach(error => {
      messages.push(`  • ${error.field}: ${error.message}`)
    })
  }
  
  if (validationResult.warnings.length > 0) {
    messages.push('⚠️ 警告：')
    validationResult.warnings.forEach(warning => {
      messages.push(`  • ${warning.field}: ${warning.message}`)
    })
  }
  
  if (validationResult.suggestions.length > 0) {
    messages.push('💡 建议：')
    validationResult.suggestions.forEach(suggestion => {
      messages.push(`  • ${suggestion.field}: ${suggestion.message}`)
    })
  }
  
  if (messages.length === 0) {
    messages.push('✅ JSON格式完全符合API要求')
  }
  
  return messages.join('\n')
}

/**
 * 自动修复常见的格式问题
 */
export const autoFixJsonFormat = (jsonData) => {
  const fixed = JSON.parse(JSON.stringify(jsonData)) // 深拷贝
  
  // 确保有title
  if (!fixed.title && !fixed.name && !fixed.header) {
    if (fixed.cards && fixed.cards[0]) {
      fixed.title = fixed.cards[0].title || fixed.cards[0].header || '知识卡片'
    } else {
      fixed.title = '知识卡片'
    }
  }
  
  // 修复cards
  if (fixed.cards && Array.isArray(fixed.cards)) {
    fixed.cards = fixed.cards.map((card, index) => {
      const fixedCard = { ...card }
      
      // 修复type
      if (!fixedCard.type || !['main', 'normal'].includes(fixedCard.type)) {
        fixedCard.type = index === 0 ? 'main' : 'normal'
      }
      
      // 确保有标题
      if (!fixedCard.header && !fixedCard.title) {
        fixedCard.header = `卡片 ${index + 1}`
      }
      
      // 修复content结构
      if (typeof fixedCard.content === 'string') {
        fixedCard.content = {
          list: [fixedCard.content]
        }
      } else if (Array.isArray(fixedCard.content)) {
        fixedCard.content = {
          list: fixedCard.content
        }
      }
      
      // 第一个卡片添加默认highlight和points
      if (index === 0 && fixedCard.type === 'main') {
        if (!fixedCard.content) {
          fixedCard.content = {}
        }
        if (!fixedCard.content.highlight) {
          fixedCard.content.highlight = {
            number: fixedCard.title || fixedCard.header || '核心内容',
            description: fixedCard.subtitle || ''
          }
        }
        if (!fixedCard.content.points && !Array.isArray(fixedCard.content.points)) {
          fixedCard.content.points = [
            { icon: '→', text: '查看详细内容' }
          ]
        }
      }
      
      return fixedCard
    })
  }
  
  return fixed
}

export default {
  validateJsonFormat,
  formatValidationMessage,
  autoFixJsonFormat
}