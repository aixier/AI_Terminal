import express from 'express'
import terminalManager from '../services/terminalManager.js'
import path from 'path'
import fs from 'fs/promises'

const router = express.Router()

// 获取所有会话
router.get('/sessions', (req, res) => {
  try {
    const sessions = terminalManager.getStatus()
    res.json({
      code: 200,
      data: sessions,
      message: 'success'
    })
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: error.message
    })
  }
})

// 获取会话信息
router.get('/sessions/:sessionId', (req, res) => {
  try {
    const session = terminalManager.get(req.params.sessionId)
    if (!session) {
      return res.status(404).json({
        code: 404,
        message: 'Session not found'
      })
    }
    res.json({
      code: 200,
      data: {
        id: session.id,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity
      },
      message: 'success'
    })
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: error.message
    })
  }
})

// 删除会话
router.delete('/sessions/:sessionId', (req, res) => {
  try {
    terminalManager.destroy(req.params.sessionId)
    res.json({
      code: 200,
      message: 'Session destroyed successfully'
    })
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: error.message
    })
  }
})

// 获取用户的卡片文件夹列表
router.get('/folders', async (req, res) => {
  try {
    const fs = await import('fs/promises')
    const path = await import('path')
    
    // 使用默认用户
    const userId = 'default'
    const dataPath = process.env.DATA_PATH || path.join(process.cwd(), 'data')
    const userFoldersPath = path.join(dataPath, 'users', userId, 'folders')
    
    // 确保目录存在
    try {
      await fs.access(userFoldersPath)
    } catch {
      // 如果目录不存在，创建它
      await fs.mkdir(userFoldersPath, { recursive: true })
      
      // 创建默认文件夹
      const defaultFolderPath = path.join(userFoldersPath, 'default-folder')
      await fs.mkdir(defaultFolderPath, { recursive: true })
      await fs.mkdir(path.join(defaultFolderPath, 'cards'), { recursive: true })
      
      const defaultMetadata = {
        id: 'default-folder',
        name: '默认文件夹',
        description: '默认卡片文件夹',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        cardCount: 0,
        color: '#0078d4'
      }
      
      await fs.writeFile(
        path.join(defaultFolderPath, 'metadata.json'),
        JSON.stringify(defaultMetadata, null, 2)
      )
    }
    
    // 读取所有文件夹
    const folderDirs = await fs.readdir(userFoldersPath)
    const folders = []
    
    for (const folderDir of folderDirs) {
      const folderPath = path.join(userFoldersPath, folderDir)
      const metadataPath = path.join(folderPath, 'metadata.json')
      
      try {
        const stats = await fs.stat(folderPath)
        if (stats.isDirectory()) {
          // 读取元数据
          let metadata = {
            id: folderDir,
            name: folderDir,
            cardCount: 0,
            color: '#0078d4'
          }
          
          try {
            const metadataContent = await fs.readFile(metadataPath, 'utf-8')
            metadata = { ...metadata, ...JSON.parse(metadataContent) }
          } catch {
            // 如果没有metadata文件，使用默认值
          }
          
          // 计算卡片数量
          const cardsPath = path.join(folderPath, 'cards')
          try {
            const cards = await fs.readdir(cardsPath)
            metadata.cardCount = cards.filter(card => card.endsWith('.json')).length
          } catch {
            // 卡片目录可能不存在
          }
          
          folders.push(metadata)
        }
      } catch (error) {
        console.error(`Error reading folder ${folderDir}:`, error)
      }
    }
    
    // 如果没有文件夹，返回默认文件夹
    if (folders.length === 0) {
      folders.push({
        id: 'default-folder',
        name: '默认文件夹',
        description: '默认卡片文件夹',
        cardCount: 0,
        color: '#0078d4'
      })
    }
    
    res.json({
      code: 200,
      success: true,
      folders: folders,
      message: 'success'
    })
  } catch (error) {
    console.error('Get folders error:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: error.message
    })
  }
})

// 获取cards目录树结构
router.get('/cards-directory', async (req, res) => {
  try {
    const fs = await import('fs/promises')
    const path = await import('path')
    
    const userId = 'default'
    // 支持Docker环境：优先使用DATA_PATH环境变量
    const dataPath = process.env.DATA_PATH || path.join(process.cwd(), 'data')
    const cardsBasePath = path.join(dataPath, 'users', userId, 'folders', 'default-folder', 'cards')
    
    const folders = []
    
    // 确保cards目录存在
    try {
      await fs.access(cardsBasePath)
    } catch {
      await fs.mkdir(cardsBasePath, { recursive: true })
    }
    
    // 读取cards目录下的所有子目录
    try {
      const dirs = await fs.readdir(cardsBasePath)
      
      for (const dir of dirs) {
        const dirPath = path.join(cardsBasePath, dir)
        const stats = await fs.stat(dirPath)
        
        if (stats.isDirectory()) {
          const folderData = {
            id: dir,
            name: dir,
            path: dirPath,  // 添加文件夹路径
            cards: []
          }
          
          // 读取每个子目录下的JSON和HTML文件
          try {
            const files = await fs.readdir(dirPath)
            for (const file of files) {
              if (file.endsWith('.json') || file.endsWith('.html') || file.endsWith('.htm')) {
                const filePath = path.join(dirPath, file)
                const fileExt = path.extname(file).toLowerCase()
                folderData.cards.push({
                  id: `${dir}-${file.replace(fileExt, '')}`,
                  name: file,
                  path: filePath,
                  type: fileExt.substring(1) // 移除点号，如 "json" 或 "html"
                })
              }
            }
          } catch (error) {
            console.error(`Error reading cards in ${dir}:`, error)
          }
          
          folders.push(folderData)
        }
      }
    } catch (error) {
      console.error('Error reading cards directory:', error)
    }
    
    res.json({
      code: 200,
      success: true,
      folders: folders,
      message: 'success'
    })
  } catch (error) {
    console.error('Get cards directory error:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: error.message
    })
  }
})

// 获取指定文件夹的卡片列表
router.get('/folders/:folderId/cards', async (req, res) => {
  try {
    const fs = await import('fs/promises')
    const path = await import('path')
    
    const userId = 'default'
    const { folderId } = req.params
    const cardsPath = path.join(dataPath, 'users', userId, 'folders', folderId, 'cards')
    
    const cards = []
    
    try {
      await fs.access(cardsPath)
      const cardFiles = await fs.readdir(cardsPath)
      
      for (const cardFile of cardFiles) {
        if (cardFile.endsWith('.json')) {
          try {
            const cardContent = await fs.readFile(path.join(cardsPath, cardFile), 'utf-8')
            const cardData = JSON.parse(cardContent)
            cards.push({
              id: cardFile.replace('.json', ''),
              ...cardData
            })
          } catch (error) {
            console.error(`Error reading card ${cardFile}:`, error)
          }
        }
      }
    } catch {
      // 卡片目录可能不存在
    }
    
    res.json({
      code: 200,
      success: true,
      cards: cards,
      message: 'success'
    })
  } catch (error) {
    console.error('Get cards error:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: error.message
    })
  }
})

// 执行Terminal命令（用于卡片生成）
router.post('/execute', async (req, res) => {
  try {
    const { command, type, topic } = req.body
    
    // 模拟命令执行结果
    let result = {
      success: true,
      code: 200
    }
    
    if (type === 'generate-json') {
      // 模拟生成JSON文件
      const timestamp = Date.now()
      const safeTopic = topic.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')
      // 注意：这个路径应该根据实际用户动态生成，这里只是模拟
      result.filePath = `/users/simulation/cards/${safeTopic}_${timestamp}/content.json`
      result.message = 'JSON file generated successfully'
    } else if (type === 'generate-card') {
      // 模拟生成卡片URL - 返回一个data URL以避免404和跨域问题
      const cardId = Math.random().toString(36).substr(2, 9)
      
      // 生成一个简单的HTML卡片内容
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Knowledge Card - ${topic}</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              margin: 0;
              padding: 20px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .card {
              background: white;
              border-radius: 20px;
              padding: 40px;
              max-width: 600px;
              box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            }
            .card-header {
              border-bottom: 2px solid #f0f0f0;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .card-title {
              color: #333;
              font-size: 28px;
              margin: 0;
            }
            .card-id {
              color: #999;
              font-size: 12px;
              margin-top: 10px;
            }
            .card-content {
              color: #666;
              line-height: 1.8;
              font-size: 16px;
            }
            .card-footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #f0f0f0;
              text-align: center;
              color: #999;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="card-header">
              <h1 class="card-title">${topic || 'Knowledge Card'}</h1>
              <div class="card-id">Card ID: ${cardId}</div>
            </div>
            <div class="card-content">
              <p>This is a generated knowledge card based on your topic: <strong>${topic}</strong></p>
              <p>The card content would be generated here based on the JSON data from the previous step.</p>
              <ul>
                <li>Key Point 1: Important information about ${topic}</li>
                <li>Key Point 2: Additional details and insights</li>
                <li>Key Point 3: Practical applications and examples</li>
              </ul>
              <p>Generated at: ${new Date().toLocaleString()}</p>
            </div>
            <div class="card-footer">
              Generated by AI Terminal Knowledge Card System
            </div>
          </div>
        </body>
        </html>
      `
      
      // 将HTML转换为data URL
      const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent)
      
      result.url = dataUrl
      result.cardId = cardId
      result.message = 'Card generated successfully'
    } else {
      // 通用命令执行
      result.output = `Command executed: ${command}`
      result.message = 'Command executed successfully'
    }
    
    res.json(result)
  } catch (error) {
    console.error('Execute command error:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: error.message
    })
  }
})

// 健康检查
router.get('/health', (req, res) => {
  try {
    const sessions = terminalManager.getStatus()
    res.json({
      code: 200,
      success: true,
      status: 'healthy',
      activeSessions: sessions.length,
      message: 'Terminal service is running'
    })
  } catch (error) {
    res.status(500).json({
      code: 500,
      success: false,
      status: 'unhealthy',
      message: error.message
    })
  }
})

// 获取公共模板列表
router.get('/templates', async (req, res) => {
  try {
    const fs = await import('fs/promises')
    const path = await import('path')
    
    // 支持Docker环境：优先使用DATA_PATH环境变量
    const dataPath = process.env.DATA_PATH || path.join(process.cwd(), 'data')
    const templatesPath = path.join(dataPath, 'public_template')
    
    // 确保目录存在
    try {
      await fs.access(templatesPath)
    } catch {
      return res.json({
        code: 200,
        success: true,
        templates: [],
        message: 'No templates directory found'
      })
    }
    
    // 读取所有文件和文件夹
    const items = await fs.readdir(templatesPath)
    const templates = []
    
    for (const item of items) {
      const itemPath = path.join(templatesPath, item)
      const stats = await fs.stat(itemPath)
      
      if (stats.isDirectory()) {
        // 处理文件夹模板
        // 检查是否有CLAUDE.md文件
        const claudePath = path.join(itemPath, 'CLAUDE.md')
        let hasClaudeFile = false
        try {
          await fs.access(claudePath)
          hasClaudeFile = true
        } catch {
          // 没有CLAUDE.md文件，跳过此文件夹
          continue
        }
        
        templates.push({
          fileName: item,
          displayName: item.replace(/-/g, ' '),
          type: 'folder'
        })
      } else if (item.endsWith('.md')) {
        // 处理单文件模板
        templates.push({
          fileName: item,
          displayName: item.replace('.md', '').replace(/-/g, ' '),
          type: 'file'
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
    console.error('Get templates error:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: error.message
    })
  }
})

// 提供HTML文件的静态服务
router.get('/card/html/:folderId/:fileName', async (req, res) => {
  try {
    const fs = await import('fs/promises')
    const path = await import('path')
    
    const { folderId, fileName } = req.params
    const userId = 'default'
    
    // 定义dataPath
    const dataPath = process.env.DATA_PATH || path.join(process.cwd(), 'data')
    
    // 构建文件路径
    const filePath = path.join(dataPath, 'users', userId, 'folders', 'default-folder', 'cards', folderId, fileName)
    
    // 安全检查：确保文件在允许的目录内
    const allowedBasePath = path.join(dataPath, 'users')
    const resolvedPath = path.resolve(filePath)
    
    if (!resolvedPath.startsWith(allowedBasePath)) {
      return res.status(403).send('Access denied: Path outside allowed directory')
    }
    
    // 检查文件是否存在
    try {
      await fs.access(resolvedPath)
    } catch {
      return res.status(404).send('HTML file not found')
    }
    
    // 检查文件扩展名
    if (!fileName.toLowerCase().endsWith('.html') && !fileName.toLowerCase().endsWith('.htm')) {
      return res.status(400).send('Only HTML files are supported')
    }
    
    // 读取并直接返回HTML内容
    const content = await fs.readFile(resolvedPath, 'utf-8')
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.send(content)
    
  } catch (error) {
    console.error('Serve HTML file error:', error)
    res.status(500).send('Internal server error')
  }
})

// 通过后端获取并保存HTML文件
router.post('/fetch-and-save-html', async (req, res) => {
  try {
    const fs = await import('fs/promises')
    const path = await import('path')
    const axios = await import('axios')
    
    const { fileId, shareLink, originalUrl, jsonPath, fileName, folderId } = req.body
    
    if (!jsonPath || !fileName) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: 'jsonPath and fileName are required'
      })
    }
    
    // 尝试获取HTML内容
    let htmlContent = null
    const urlsToTry = [
      shareLink,
      originalUrl,
      `http://engagia-s-cdmxfcdbwa.cn-hangzhou.fcapp.run/view/${fileId}`,
      `http://engagia-s-cdmxfcdbwa.cn-hangzhou.fcapp.run/s/${req.body.shortCode}`
    ].filter(Boolean)
    
    console.log('Trying to fetch HTML from URLs:', urlsToTry)
    
    for (const url of urlsToTry) {
      try {
        console.log('Fetching from:', url)
        const response = await axios.default.get(url, {
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        })
        
        if (response.data) {
          htmlContent = response.data
          console.log('Successfully fetched HTML from:', url)
          break
        }
      } catch (error) {
        console.log('Failed to fetch from:', url, error.message)
      }
    }
    
    // 如果无法获取内容，创建一个简单的HTML文件
    if (!htmlContent) {
      console.log('Could not fetch HTML content, creating placeholder')
      htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${fileName}</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        .container { max-width: 800px; margin: 0 auto; }
        .info { background: #f0f0f0; padding: 20px; border-radius: 8px; }
        .links { margin-top: 20px; }
        a { color: #0066cc; text-decoration: none; padding: 10px 20px; background: #e0e0e0; border-radius: 4px; display: inline-block; margin: 5px; }
        a:hover { background: #d0d0d0; }
    </style>
</head>
<body>
    <div class="container">
        <h1>HTML卡片已生成</h1>
        <div class="info">
            <p><strong>文件名：</strong>${fileName}</p>
            <p><strong>生成时间：</strong>${new Date().toLocaleString()}</p>
            <p><strong>文件ID：</strong>${fileId || 'N/A'}</p>
        </div>
        <div class="links">
            <h3>在线访问链接：</h3>
            ${shareLink ? `<a href="${shareLink}" target="_blank">分享链接</a>` : ''}
            ${originalUrl ? `<a href="${originalUrl}" target="_blank">原始链接</a>` : ''}
        </div>
        <p style="margin-top: 30px; color: #666;">
            提示：如果需要查看完整内容，请使用上方链接在线访问。
        </p>
    </div>
</body>
</html>`
    }
    
    // 保存HTML文件到与JSON相同的目录
    const htmlPath = jsonPath.replace('.json', '.html')
    
    // 确保目录存在
    const dirPath = path.dirname(htmlPath)
    await fs.mkdir(dirPath, { recursive: true })
    
    // 保存文件
    await fs.writeFile(htmlPath, htmlContent, 'utf-8')
    
    console.log('HTML file saved to:', htmlPath)
    
    res.json({
      code: 200,
      success: true,
      path: htmlPath,
      relativePath: path.relative(process.cwd(), htmlPath),
      message: 'HTML file saved successfully'
    })
    
  } catch (error) {
    console.error('Fetch and save HTML error:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: error.message
    })
  }
})

// 保存生成的HTML文件
router.post('/save-html', async (req, res) => {
  try {
    const fs = await import('fs/promises')
    const path = await import('path')
    
    const { jsonPath, content, folderId, fileName } = req.body
    
    if (!content || !fileName) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: 'Content and fileName are required'
      })
    }
    
    let finalPath
    
    // 如果提供了JSON路径，HTML保存在同目录
    if (jsonPath) {
      // 直接将.json替换为.html
      finalPath = jsonPath.replace('.json', '.html')
      console.log('Saving HTML to same directory as JSON:', finalPath)
    } else {
      // 使用备用逻辑
      const userId = 'default'
      const folderName = folderId || 'default-folder'
      const cardsPath = path.join(dataPath, 'users', userId, 'folders', folderName, 'cards')
      
      // 简单处理：创建一个临时目录
      const tempDir = path.join(cardsPath, 'generated')
      await fs.mkdir(tempDir, { recursive: true })
      finalPath = path.join(tempDir, fileName)
    }
    
    // 安全检查：确保路径在允许的目录内
    const allowedBasePath = path.join(dataPath, 'users')
    if (!finalPath.startsWith(allowedBasePath)) {
      return res.status(403).json({
        code: 403,
        success: false,
        message: 'Access denied: Path outside allowed directory'
      })
    }
    
    // 确保目录存在
    const dirPath = path.dirname(finalPath)
    await fs.mkdir(dirPath, { recursive: true })
    
    // 保存文件
    await fs.writeFile(finalPath, content, 'utf-8')
    
    console.log('HTML file saved:', finalPath)
    
    res.json({
      code: 200,
      success: true,
      path: finalPath,
      relativePath: path.relative(process.cwd(), finalPath),
      message: 'HTML file saved successfully'
    })
  } catch (error) {
    console.error('Save HTML error:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: error.message
    })
  }
})

// 获取卡片文件内容
router.get('/card', async (req, res) => {
  try {
    const fs = await import('fs/promises')
    const path = await import('path')
    
    const { path: cardPath } = req.query
    
    if (!cardPath) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: 'Card path is required'
      })
    }
    
    // 安全检查：确保路径在允许的目录内
    const dataPath = process.env.DATA_PATH || path.join(process.cwd(), 'data')
    const allowedBasePath = path.join(dataPath, 'users')
    const resolvedPath = path.resolve(cardPath)
    
    if (!resolvedPath.startsWith(allowedBasePath)) {
      return res.status(403).json({
        code: 403,
        success: false,
        message: 'Access denied: Path outside allowed directory'
      })
    }
    
    // 检查文件是否存在
    try {
      await fs.access(resolvedPath)
    } catch {
      return res.status(404).json({
        code: 404,
        success: false,
        message: 'Card file not found'
      })
    }
    
    // 读取文件内容
    const content = await fs.readFile(resolvedPath, 'utf-8')
    const stats = await fs.stat(resolvedPath)
    
    // 根据文件扩展名返回不同格式的内容
    const ext = path.extname(resolvedPath).toLowerCase()
    let parsedContent = content
    
    if (ext === '.json') {
      try {
        parsedContent = JSON.parse(content)
      } catch (parseError) {
        // JSON解析失败，返回原始内容
        console.warn('Failed to parse JSON file:', parseError.message)
      }
    }
    
    res.json({
      code: 200,
      success: true,
      content: parsedContent,
      metadata: {
        path: cardPath,
        size: stats.size,
        createdAt: stats.birthtime,
        updatedAt: stats.mtime,
        extension: ext
      },
      message: 'success'
    })
  } catch (error) {
    console.error('Get card content error:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: error.message
    })
  }
})

// 获取指定模板的内容
router.get('/templates/:templateId', async (req, res) => {
  try {
    const fs = await import('fs/promises')
    const path = await import('path')
    
    const { templateId } = req.params
    const templateFile = templateId.endsWith('.md') ? templateId : `${templateId}.md`
    const templatePath = path.join(dataPath, 'public_template', templateFile)
    
    // 检查文件是否存在
    try {
      await fs.access(templatePath)
    } catch {
      return res.status(404).json({
        code: 404,
        success: false,
        message: 'Template not found'
      })
    }
    
    // 读取文件内容
    const content = await fs.readFile(templatePath, 'utf-8')
    const stats = await fs.stat(templatePath)
    
    res.json({
      code: 200,
      success: true,
      template: {
        id: templateId,
        filename: templateFile,
        content: content,
        size: stats.size,
        createdAt: stats.birthtime,
        updatedAt: stats.mtime
      },
      message: 'success'
    })
  } catch (error) {
    console.error('Get template content error:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: error.message
    })
  }
})

// 保存卡片内容（包括response文件）
router.post('/save-card', async (req, res) => {
  try {
    const fs = await import('fs/promises')
    const path = await import('path')
    
    const { path: cardPath, content, type } = req.body
    
    if (!cardPath || !content) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: 'Path and content are required'
      })
    }
    
    // 安全检查：确保路径在允许的目录内
    const dataPath = process.env.DATA_PATH || path.join(process.cwd(), 'data')
    const allowedBasePath = path.join(dataPath, 'users')
    const resolvedPath = path.resolve(cardPath)
    
    if (!resolvedPath.startsWith(allowedBasePath)) {
      return res.status(403).json({
        code: 403,
        success: false,
        message: 'Access denied: Path outside allowed directory'
      })
    }
    
    // 确保目录存在
    const dirPath = path.dirname(resolvedPath)
    await fs.mkdir(dirPath, { recursive: true })
    
    // 保存文件
    await fs.writeFile(resolvedPath, content, 'utf-8')
    
    console.log(`[SaveCard] File saved: ${resolvedPath}, type: ${type}`)
    
    res.json({
      code: 200,
      success: true,
      path: resolvedPath,
      relativePath: path.relative(process.cwd(), resolvedPath),
      message: 'Card content saved successfully'
    })
  } catch (error) {
    console.error('Save card error:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: error.message
    })
  }
})

/**
 * 删除卡片文件或文件夹
 */
router.delete('/card', async (req, res) => {
  try {
    const fs = await import('fs/promises')
    const path = await import('path')
    
    // 支持从 body 或 query 参数获取
    const targetPath = req.body?.path || req.query?.path
    const type = req.body?.type || req.query?.type
    
    console.log('[DeleteCard] Request received:', { targetPath, type, body: req.body, query: req.query })
    
    if (!targetPath) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: 'Path is required'
      })
    }
    
    // 安全检查：确保路径在允许的目录内
    const dataPath = process.env.DATA_PATH || path.join(process.cwd(), 'data')
    const allowedBasePath = path.join(dataPath, 'users')
    const resolvedPath = path.resolve(targetPath)
    
    if (!resolvedPath.startsWith(allowedBasePath)) {
      return res.status(403).json({
        code: 403,
        success: false,
        message: 'Access denied: Path outside allowed directory'
      })
    }
    
    // 检查目标是否存在
    try {
      const stats = await fs.stat(resolvedPath)
      
      if (stats.isDirectory()) {
        // 删除文件夹及其所有内容
        await fs.rm(resolvedPath, { recursive: true, force: true })
        console.log(`[DeleteCard] Directory deleted: ${resolvedPath}`)
      } else {
        // 删除文件
        await fs.unlink(resolvedPath)
        console.log(`[DeleteCard] File deleted: ${resolvedPath}`)
      }
      
      // 发送 SSE 事件通知前端
      if (global.sseClients && global.sseClients.size > 0) {
        const event = {
          type: 'filesystem:changed',
          action: 'delete',
          path: resolvedPath,
          timestamp: Date.now()
        }
        
        global.sseClients.forEach(client => {
          client.write(`data: ${JSON.stringify(event)}\n\n`)
        })
      }
      
      res.json({
        code: 200,
        success: true,
        message: 'Successfully deleted'
      })
    } catch (error) {
      return res.status(404).json({
        code: 404,
        success: false,
        message: 'File or directory not found'
      })
    }
  } catch (error) {
    console.error('Delete card error:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: error.message
    })
  }
})

// 重命名文件夹
router.put('/folder/rename', async (req, res) => {
  try {
    const fs = await import('fs/promises')
    const path = await import('path')
    
    const { oldPath, newName } = req.body
    
    if (!oldPath || !newName) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: 'oldPath and newName are required'
      })
    }
    
    // 安全检查：确保路径在允许的目录内
    const dataPath = process.env.DATA_PATH || path.join(process.cwd(), 'data')
    const allowedBasePath = path.join(dataPath, 'users')
    
    // 构建完整的旧路径
    const fullOldPath = path.isAbsolute(oldPath) ? oldPath : path.join(allowedBasePath, 'default', 'folders', oldPath)
    const resolvedOldPath = path.resolve(fullOldPath)
    
    if (!resolvedOldPath.startsWith(allowedBasePath)) {
      return res.status(403).json({
        code: 403,
        success: false,
        message: 'Access denied: Path outside allowed directory'
      })
    }
    
    // 构建新路径
    const parentDir = path.dirname(resolvedOldPath)
    const newPath = path.join(parentDir, newName)
    
    // 检查文件夹是否存在
    try {
      const stats = await fs.stat(resolvedOldPath)
      if (!stats.isDirectory()) {
        return res.status(400).json({
          code: 400,
          success: false,
          message: 'Path is not a directory'
        })
      }
    } catch {
      return res.status(404).json({
        code: 404,
        success: false,
        message: 'Folder not found'
      })
    }
    
    // 检查新路径是否已存在
    try {
      await fs.access(newPath)
      return res.status(409).json({
        code: 409,
        success: false,
        message: 'A folder with this name already exists'
      })
    } catch {
      // 新路径不存在，可以重命名
    }
    
    // 执行重命名
    await fs.rename(resolvedOldPath, newPath)
    
    // 更新metadata.json文件
    const metadataPath = path.join(newPath, 'metadata.json')
    try {
      const metadataContent = await fs.readFile(metadataPath, 'utf-8')
      const metadata = JSON.parse(metadataContent)
      metadata.name = newName
      metadata.updatedAt = new Date().toISOString()
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2))
    } catch {
      // metadata文件可能不存在，忽略错误
    }
    
    console.log(`[RenameFolder] Renamed: ${resolvedOldPath} -> ${newPath}`)
    
    res.json({
      code: 200,
      success: true,
      message: 'Folder renamed successfully',
      newPath: newPath
    })
  } catch (error) {
    console.error('Rename folder error:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: error.message
    })
  }
})

// 重命名文件
router.put('/card/rename', async (req, res) => {
  try {
    const fs = await import('fs/promises')
    const path = await import('path')
    
    const { oldPath, newName } = req.body
    
    if (!oldPath || !newName) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: 'oldPath and newName are required'
      })
    }
    
    // 安全检查：确保路径在允许的目录内
    const dataPath = process.env.DATA_PATH || path.join(process.cwd(), 'data')
    const allowedBasePath = path.join(dataPath, 'users')
    const resolvedOldPath = path.resolve(oldPath)
    
    if (!resolvedOldPath.startsWith(allowedBasePath)) {
      return res.status(403).json({
        code: 403,
        success: false,
        message: 'Access denied: Path outside allowed directory'
      })
    }
    
    // 构建新路径
    const parentDir = path.dirname(resolvedOldPath)
    const newPath = path.join(parentDir, newName)
    
    // 检查文件是否存在
    try {
      const stats = await fs.stat(resolvedOldPath)
      if (stats.isDirectory()) {
        return res.status(400).json({
          code: 400,
          success: false,
          message: 'Path is a directory, not a file'
        })
      }
    } catch {
      return res.status(404).json({
        code: 404,
        success: false,
        message: 'File not found'
      })
    }
    
    // 检查新路径是否已存在
    try {
      await fs.access(newPath)
      return res.status(409).json({
        code: 409,
        success: false,
        message: 'A file with this name already exists'
      })
    } catch {
      // 新路径不存在，可以重命名
    }
    
    // 执行重命名
    await fs.rename(resolvedOldPath, newPath)
    
    console.log(`[RenameFile] Renamed: ${resolvedOldPath} -> ${newPath}`)
    
    res.json({
      code: 200,
      success: true,
      message: 'File renamed successfully',
      newPath: newPath
    })
  } catch (error) {
    console.error('Rename file error:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: error.message
    })
  }
})

// 清理会话
router.post('/cleanup', (req, res) => {
  try {
    // 清理所有非活动会话
    const sessions = terminalService.getAllSessions()
    let cleaned = 0
    
    sessions.forEach(session => {
      // 清理超过30分钟未活动的会话
      const inactiveTime = Date.now() - session.lastActivity
      if (inactiveTime > 30 * 60 * 1000) {
        terminalService.destroySession(session.id)
        cleaned++
      }
    })
    
    res.json({
      code: 200,
      success: true,
      cleaned: cleaned,
      message: `Cleaned ${cleaned} inactive sessions`
    })
  } catch (error) {
    res.status(500).json({
      code: 500,
      success: false,
      message: error.message
    })
  }
})

export default router