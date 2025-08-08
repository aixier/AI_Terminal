/**
 * Card Generator API Service
 * 处理卡片生成相关的API调用
 */

import axios from 'axios'

// 创建专用的axios实例用于外部API
const externalAPI = axios.create({
  timeout: 120000, // 120秒超时
  headers: {
    'Content-Type': 'application/json'
  }
})

/**
 * 将JSON内容转换为API所需的格式
 */
const transformJsonToApiFormat = (jsonData) => {
  // 确保jsonData不为空
  if (!jsonData || typeof jsonData !== 'object') {
    console.warn('[CardGenerator API] Invalid JSON data:', jsonData)
    jsonData = { title: '知识卡片', content: '内容为空' }
  }
  
  // 默认配置
  const defaultConfig = {
    format: 'html',
    config: {
      theme: {
        name: 'knowledge-card',
        pageTitle: jsonData.title || '知识卡片',
        sectionTitle: jsonData.title || '知识卡片',
        sectionSubtitle: jsonData.subtitle || '',
        gradientColor1: '#06B6D4',
        gradientColor2: '#10B981',
        gradientColor1RGB: '6, 182, 212',
        accentColor: '#10B981',
        accentColorRGB: '16, 185, 129'
      },
      copy: {
        title: jsonData.title || '知识卡片',
        content: '',
        hashtags: '',
        tips: ''
      },
      cards: []
    }
  }

  // 处理内容
  if (jsonData.content) {
    if (typeof jsonData.content === 'string') {
      defaultConfig.config.copy.content = jsonData.content
    } else if (Array.isArray(jsonData.content)) {
      defaultConfig.config.copy.content = jsonData.content.join('\n\n')
    } else if (typeof jsonData.content === 'object') {
      defaultConfig.config.copy.content = JSON.stringify(jsonData.content, null, 2)
    }
  }

  // 处理标签
  if (jsonData.tags) {
    if (Array.isArray(jsonData.tags)) {
      defaultConfig.config.copy.hashtags = jsonData.tags.map(tag => `#${tag}`).join(' ')
    } else if (typeof jsonData.tags === 'string') {
      defaultConfig.config.copy.hashtags = jsonData.tags
    }
  }

  // 处理卡片数据
  if (jsonData.cards && Array.isArray(jsonData.cards)) {
    defaultConfig.config.cards = jsonData.cards.map((card, index) => {
      const cardConfig = {
        type: index === 0 ? 'main' : 'normal',
        icon: card.icon || '📋',
        header: card.title || card.header || `卡片 ${index + 1}`,
        subtitle: card.subtitle || '',
        content: {
          list: [],
          tip: card.tip || '',
          tags: card.tags || []
        }
      }
      
      // 处理list内容
      if (card.list && Array.isArray(card.list)) {
        cardConfig.content.list = card.list
      } else if (card.content) {
        if (typeof card.content === 'string') {
          cardConfig.content.list = [card.content]
        } else if (Array.isArray(card.content)) {
          cardConfig.content.list = card.content
        }
      }
      
      // 主卡片特有属性
      if (index === 0) {
        if (card.highlight) {
          cardConfig.content.highlight = card.highlight
        }
        if (card.points && Array.isArray(card.points)) {
          cardConfig.content.points = card.points.map(p => 
            typeof p === 'object' ? p : { icon: '→', text: p }
          )
        }
      }
      
      return cardConfig
    })
  } else {
    // 如果没有cards数组，智能解析JSON结构
    const cards = []
    
    // 创建主卡片
    const mainCard = {
      type: 'main',
      icon: '📋',
      header: jsonData.title || jsonData.name || '知识卡片',
      subtitle: jsonData.subtitle || jsonData.description || '',
      content: {
        highlight: {
          number: jsonData.mainPoint || jsonData.keyPoint || '核心内容',
          description: jsonData.summary || ''
        },
        points: [],
        tags: []
      }
    }
    
    // 处理points或keyPoints
    if (jsonData.points || jsonData.keyPoints) {
      const points = jsonData.points || jsonData.keyPoints
      if (Array.isArray(points)) {
        mainCard.content.points = points.map(p => {
          if (typeof p === 'string') {
            return { icon: '→', text: p }
          } else if (typeof p === 'object' && p !== null) {
            return {
              icon: p.icon || '→',
              text: p.text || p.content || JSON.stringify(p)
            }
          } else {
            return { icon: '→', text: String(p) }
          }
        })
      }
    } else {
      // 如果没有points，创建一个默认的
      mainCard.content.points = [{ icon: '→', text: '查看详细内容' }]
    }
    
    cards.push(mainCard)
    
    // 处理sections或其他结构化数据
    if (jsonData.sections && Array.isArray(jsonData.sections)) {
      jsonData.sections.forEach(section => {
        cards.push({
          type: 'normal',
          icon: section.icon || '📄',
          header: section.title || section.name || '内容',
          subtitle: section.subtitle || '',
          content: {
            list: section.content ? 
              (Array.isArray(section.content) ? section.content : [section.content]) : 
              [],
            tip: section.tip || '',
            tags: section.tags || []
          }
        })
      })
    } else {
      // 将其他字段转换为普通卡片
      const contentCard = {
        type: 'normal',
        icon: '📝',
        header: '详细内容',
        subtitle: '',
        content: {
          list: []
        }
      }
      
      Object.entries(jsonData).forEach(([key, value]) => {
        if (!['title', 'name', 'subtitle', 'description', 'mainPoint', 'keyPoint', 'summary', 'points', 'keyPoints', 'sections'].includes(key) && value) {
          if (typeof value === 'string' || typeof value === 'number') {
            contentCard.content.list.push(`<strong>${key}:</strong> ${value}`)
          } else if (Array.isArray(value)) {
            contentCard.content.list.push(`<strong>${key}:</strong>`)
            value.forEach(item => {
              if (typeof item === 'object') {
                contentCard.content.list.push(`• ${JSON.stringify(item)}`)
              } else {
                contentCard.content.list.push(`• ${item}`)
              }
            })
          } else if (typeof value === 'object') {
            contentCard.content.list.push(`<strong>${key}:</strong> ${JSON.stringify(value, null, 2)}`)
          }
        }
      })
      
      if (contentCard.content.list.length > 0) {
        cards.push(contentCard)
      }
    }
    
    defaultConfig.config.cards = cards
  }

  return defaultConfig
}

/**
 * 生成HTML卡片
 */
export const generateHtmlCard = async (jsonContent) => {
  try {
    console.log('[CardGenerator API] Original JSON content:', jsonContent)
    
    // 构建API请求格式 - 将JSON内容放入config
    const apiPayload = {
      format: 'html',
      config: jsonContent  // 直接将整个JSON作为config
    }
    
    // 如果jsonContent已经有正确的结构，直接使用
    // 否则，尝试转换格式
    if (!jsonContent.theme && !jsonContent.copy && !jsonContent.cards) {
      console.log('[CardGenerator API] JSON needs transformation, converting format...')
      // 转换JSON内容为API格式
      const transformed = transformJsonToApiFormat(jsonContent)
      apiPayload.format = transformed.format
      apiPayload.config = transformed.config
    }
    
    console.log('[CardGenerator API] Final payload:', JSON.stringify(apiPayload, null, 2))
    
    // 验证必要字段
    if (!apiPayload.config.theme) {
      apiPayload.config.theme = {
        name: 'knowledge-card',
        pageTitle: jsonContent.title || '知识卡片',
        sectionTitle: jsonContent.title || '知识卡片',
        sectionSubtitle: jsonContent.subtitle || '',
        gradientColor1: '#06B6D4',
        gradientColor2: '#10B981',
        gradientColor1RGB: '6, 182, 212',
        accentColor: '#10B981',
        accentColorRGB: '16, 185, 129'
      }
    }
    
    if (!apiPayload.config.copy) {
      apiPayload.config.copy = {
        title: jsonContent.title || '知识卡片',
        content: jsonContent.content || '',
        hashtags: '',
        tips: ''
      }
    }
    
    if (!apiPayload.config.cards || apiPayload.config.cards.length === 0) {
      console.warn('[CardGenerator API] No cards in payload, adding default card')
      apiPayload.config.cards = [{
        type: 'main',
        icon: '📋',
        header: jsonContent.title || '知识卡片',
        subtitle: jsonContent.subtitle || '',
        content: {
          highlight: {
            number: '内容',
            description: '暂无描述'
          },
          points: [{ icon: '→', text: '暂无内容' }],
          tags: []
        }
      }]
    }
    
    console.log('[CardGenerator API] Sending request to generate HTML...')
    
    // 重试逻辑
    let lastError = null
    const maxRetries = 2
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[CardGenerator API] Attempt ${attempt}/${maxRetries}...`)
        
        // 调用外部API
        const response = await externalAPI.post(
          'https://engagia-s-cdmxfcdbwa.cn-hangzhou.fcapp.run/generate-and-process',
          apiPayload
        )
        
        console.log('[CardGenerator API] Response received:', response.data)
        
        if (response.data.success) {
          // 提取所有可用的URL
          const urls = {
            fileId: response.data.fileId,
            fileName: response.data.originalFileName,
            fileSize: response.data.fileSize,
            shortCode: response.data.shortCode,
            shareLink: response.data.shareLink,
            shortUrl: response.data.data?.shortUrl,
            originalUrl: response.data.data?.originalUrl,
            qrCodeUrl: response.data.data?.qrCodeUrl,
            // 构建直接访问URL
            directViewUrl: response.data.data?.originalUrl || 
                          `http://engagia-s-cdmxfcdbwa.cn-hangzhou.fcapp.run/view/${response.data.fileId}`,
            directDownloadUrl: `http://engagia-s-cdmxfcdbwa.cn-hangzhou.fcapp.run/download/${response.data.fileId}`
          }
          
          console.log('[CardGenerator API] Available URLs:', urls)
          
          return {
            success: true,
            data: urls
          }
        } else {
          throw new Error(response.data.message || '生成失败')
        }
      } catch (error) {
        lastError = error
        console.warn(`[CardGenerator API] Attempt ${attempt} failed:`, error.message)
        
        // 如果不是最后一次尝试，等待后重试
        if (attempt < maxRetries) {
          console.log(`[CardGenerator API] Waiting 2 seconds before retry...`)
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }
    }
    
    // 所有尝试都失败了，抛出最后的错误
    throw lastError
  } catch (error) {
    console.error('[CardGenerator API] Error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      stack: error.stack
    })
    
    // 提取更详细的错误信息
    let errorMessage = '生成HTML失败'
    if (error.response?.data?.message) {
      errorMessage = error.response.data.message
    } else if (error.response?.data?.error) {
      errorMessage = error.response.data.error
    } else if (error.message) {
      errorMessage = error.message
    }
    
    return {
      success: false,
      error: errorMessage
    }
  }
}

/**
 * 下载HTML文件
 */
export const downloadHtmlFile = async (url, fileName = 'card.html') => {
  try {
    console.log('[CardGenerator API] Downloading HTML from:', url)
    
    // 方法1：尝试通过fetch下载（可能有CORS问题）
    try {
      const response = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit'
      })
      
      if (response.ok) {
        const blob = await response.blob()
        const downloadUrl = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = downloadUrl
        link.download = fileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(downloadUrl)
        
        return {
          success: true,
          message: '文件下载成功'
        }
      }
    } catch (fetchError) {
      console.warn('[CardGenerator API] Fetch failed, trying alternative method:', fetchError)
    }
    
    // 方法2：如果fetch失败，直接通过新窗口打开链接
    console.log('[CardGenerator API] Opening URL in new window:', url)
    window.open(url, '_blank')
    
    return {
      success: true,
      message: '已在新窗口打开HTML文件，请手动保存'
    }
  } catch (error) {
    console.error('[CardGenerator API] Error downloading HTML:', error)
    return {
      success: false,
      error: error.message || '下载失败'
    }
  }
}

export default {
  generateHtmlCard,
  downloadHtmlFile
}