/**
 * 提示词构建工具函数
 * 用于统一管理和构建各种模板的提示词
 */

export function buildPromptForTemplate(templateName, topic, parameters, paths) {
  const { cover, style, language, referenceContent } = parameters
  const { claudePath, userCardPath } = paths
  
  if (templateName === 'cardplanet-Sandra-json') {
    return `你是一位海报设计师，要为"${topic}"创作一套收藏级卡片海报作品。

创作重点：
- 把每张卡片当作独立的艺术海报设计
- 深挖主题的趣味性和视觉潜力
- 用细节和创意打动人心
- 必须同时生成HTML和JSON两个文件

封面：${cover}
风格：${style}
语言：${language}
参考：${referenceContent}

从${claudePath}文档开始，按其指引阅读全部6个文档获取创作框架。
特别注意：必须按照html_generation_workflow.md中的双文件输出规范，同时生成HTML文件（主题英文名_style.html）和JSON文件（主题英文名_data.json）。
生成的文件保存在[${userCardPath}]`
  }
  
  if (templateName === 'cardplanet-Sandra-cover') {
    return `你是一位海报设计师，要为"${topic}"创作一套收藏级卡片海报作品。

创作重点：
- 把每张卡片当作独立的艺术海报设计
- 深挖主题的趣味性和视觉潜力
- 用细节和创意打动人心

封面：${cover}
风格：${style}
语言：${language}
参考：${referenceContent}

从${claudePath}文档开始，按其指引阅读全部6个文档获取创作框架。
记住：规范是创作的基础，但你的目标是艺术品，不是代码任务。
生成的json文档保存在[${userCardPath}]`
  }
  
  // 默认模板
  return `你是一位海报设计师，要为"${topic}"创作一套收藏级卡片海报作品。

创作重点：
- 把每张卡片当作独立的艺术海报设计
- 深挖主题的趣味性和视觉潜力
- 用细节和创意打动人心

风格：${style}
语言：${language}
参考：${referenceContent}

从${claudePath}文档开始，按其指引阅读全部5个文档获取创作框架。
记住：规范是创作的基础，但你的目标是艺术品，不是代码任务。
生成的json文档保存在[${userCardPath}]`
}

/**
 * 文件生成监控工具
 * 用于统一管理文件生成的检测逻辑
 */
export function waitForFileGeneration(userCardPath, templateName, timeout = 600000) {
  return new Promise((resolve, reject) => {
    let checkInterval
    let timeoutTimer
    
    const checkFile = async () => {
      try {
        const fs = await import('fs/promises')
        const path = await import('path')
        
        const files = await fs.readdir(userCardPath)
        const generatedFiles = files.filter(f => 
          (f.endsWith('.json') || f.endsWith('.html')) && !f.includes('-response')
        )
        
        // 对于 cardplanet-Sandra-json 模板，需要等待两个文件都生成
        if (templateName === 'cardplanet-Sandra-json') {
          const htmlFiles = generatedFiles.filter(f => f.endsWith('.html'))
          const jsonFiles = generatedFiles.filter(f => f.endsWith('.json'))
          
          if (htmlFiles.length > 0 && jsonFiles.length > 0) {
            clearInterval(checkInterval)
            clearTimeout(timeoutTimer)
            
            const result = { success: true, files: [] }
            
            // 读取HTML文件
            const htmlFileName = htmlFiles[0]
            const htmlFilePath = path.join(userCardPath, htmlFileName)
            try {
              const htmlContent = await fs.readFile(htmlFilePath, 'utf-8')
              result.files.push({
                fileName: htmlFileName,
                path: htmlFilePath,
                content: htmlContent,
                fileType: 'html'
              })
            } catch (error) {
              console.error(`Error reading HTML file:`, error)
            }
            
            // 读取JSON文件
            const jsonFileName = jsonFiles[0]
            const jsonFilePath = path.join(userCardPath, jsonFileName)
            try {
              const jsonContent = await fs.readFile(jsonFilePath, 'utf-8')
              try {
                const parsedJson = JSON.parse(jsonContent)
                result.files.push({
                  fileName: jsonFileName,
                  path: jsonFilePath,
                  content: parsedJson,
                  fileType: 'json'
                })
              } catch (parseError) {
                result.files.push({
                  fileName: jsonFileName,
                  path: jsonFilePath,
                  content: jsonContent,
                  fileType: 'json',
                  parseError: true
                })
              }
            } catch (error) {
              console.error(`Error reading JSON file:`, error)
            }
            
            const primaryFile = result.files.find(f => f.fileType === 'json') || result.files[0]
            resolve({
              ...result,
              ...primaryFile,
              allFiles: result.files
            })
          }
        } else {
          // 其他模板只需要一个文件
          if (generatedFiles.length > 0) {
            clearInterval(checkInterval)
            clearTimeout(timeoutTimer)
            
            const fileName = generatedFiles[0]
            const filePath = path.join(userCardPath, fileName)
            
            try {
              const content = await fs.readFile(filePath, 'utf-8')
              
              if (fileName.endsWith('.json')) {
                try {
                  const jsonContent = JSON.parse(content)
                  resolve({
                    success: true,
                    fileName: fileName,
                    path: filePath,
                    content: jsonContent,
                    fileType: 'json'
                  })
                } catch (parseError) {
                  resolve({
                    success: true,
                    fileName: fileName,
                    path: filePath,
                    content: content,
                    fileType: 'json',
                    parseError: true
                  })
                }
              } else if (fileName.endsWith('.html')) {
                resolve({
                  success: true,
                  fileName: fileName,
                  path: filePath,
                  content: content,
                  fileType: 'html'
                })
              }
            } catch (readError) {
              console.error(`File read error:`, readError)
            }
          }
        }
      } catch (error) {
        // 目录可能还不存在，继续等待
      }
    }
    
    checkInterval = setInterval(checkFile, 5000)
    timeoutTimer = setTimeout(() => {
      clearInterval(checkInterval)
      reject(new Error(`生成超时，已等待${timeout/1000}秒`))
    }, timeout)
    
    checkFile()
  })
}