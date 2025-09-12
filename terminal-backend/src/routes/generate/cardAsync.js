import express from 'express'
import path from 'path'
import fs from 'fs/promises'
import apiTerminalService from '../../utils/apiTerminalService.js'
import claudeExecutorDirect from '../../services/claudeExecutorDirect.js'
import { authenticateUserOrDefault, ensureUserFolder } from '../../middleware/userAuth.js'
import userService from '../../services/userService.js'
import { ensureCardFolder, updateFolderStatus } from './utils/folderManager.js'
import { SessionMetadata } from './utils/sessionMetadata.js'
import { generateFourFiles, isDailyKnowledgeTemplate } from './utils/fileGenerator.js'

const router = express.Router()

/**
 * 异步生成卡片接口 - 立即返回任务ID和文件夹名称
 * POST /api/generate/card/async
 * 
 * 请求体:
 * {
 *   "topic": "主题名称",
 *   "templateName": "模板文件名" (可选，默认使用 cardplanet-Sandra-json)
 * }
 * 
 * 响应:
 * {
 *   "code": 200,
 *   "success": true,
 *   "data": {
 *     "taskId": "task_xxx",
 *     "folderName": "sanitized_topic_name",
 *     "folderPath": "/path/to/user/folder",
 *     "topic": "原始主题",
 *     "templateName": "使用的模板"
 *   }
 * }
 */
router.post('/', authenticateUserOrDefault, ensureUserFolder, async (req, res) => {
  try {
    const { 
      topic, 
      templateName,  // 不设置默认值，让自定义模式可以没有模板
      style: userStyle,      // 用户传入的风格参数（可选）
      language: userLanguage, // 用户传入的语言参数（可选）
      reference: userReference, // 用户传入的参考参数（可选）
      token: userToken,         // 用户传入的token（可选），用于指定生成到特定用户
      mode,                   // 自定义模式标识（custom/normal）
      references              // 素材引用数组
    } = req.body
    
    // 如果不是自定义模式且没有模板，使用默认模板
    const actualTemplateName = mode === 'custom' ? null : (templateName || 'cardplanet-Sandra-json')
    
    // 参数验证
    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '主题(topic)参数不能为空'
      })
    }
    
    // 清理主题名称，用于文件夹命名
    // 先尝试URL解码，处理可能的中文等特殊字符
    let decodedTopic = topic
    try {
      decodedTopic = decodeURIComponent(topic)
    } catch (e) {
      console.log(`[Async Card API] URL decode failed for topic: ${topic}, using original`)
    }
    const sanitizedTopic = decodedTopic.trim().replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')
    
    // 生成任务ID
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    
    // 处理用户token参数，如果传入了token，尝试查找对应用户
    let targetUser = req.user; // 默认使用认证中间件设置的用户
    if (userToken) {
      console.log(`[Async Card API] User token provided in request: ${userToken}`);
      const tokenUser = await userService.findUserByToken(userToken);
      if (tokenUser) {
        targetUser = tokenUser;
        console.log(`[Async Card API] Using token-specified user: ${tokenUser.username}`);
      } else {
        console.log(`[Async Card API] Token user not found, using default: ${req.user.username}`);
      }
    }
    
    // 使用目标用户的路径
    const userCardPath = userService.getUserCardPath(targetUser.username, topic)
    
    // 立即创建文件夹并获取信息
    const folderInfo = await ensureCardFolder(userCardPath, topic, sanitizedTopic)
    
    console.log(`[Async Card API] ==================== ASYNC REQUEST ====================`)
    console.log(`[Async Card API] Task ID: ${taskId}`)
    console.log(`[Async Card API] Topic: ${topic}`)
    console.log(`[Async Card API] Sanitized Topic: ${sanitizedTopic}`)
    console.log(`[Async Card API] Template: ${actualTemplateName || 'custom mode (no template)'}`)
    console.log(`[Async Card API] Target User: ${targetUser.username}`)
    console.log(`[Async Card API] Request User: ${req.user.username}`)
    console.log(`[Async Card API] Output Path: ${userCardPath}`)
    console.log(`[Async Card API] Folder Info:`, folderInfo)
    console.log(`[Async Card API] =======================================================`)
    
    // 立即返回任务信息，不等待生成完成
    const responseData = {
      taskId: taskId,
      folderName: sanitizedTopic,
      folderPath: userCardPath,
      topic: topic,
      templateName: actualTemplateName,
      status: 'submitted',
      submittedAt: new Date().toISOString(),
      folderCreated: !folderInfo.existed,
      folderExisted: folderInfo.existed
    }
    
    // 异步开始生成（不等待完成）
    setImmediate(async () => {
      try {
        console.log(`[Async Card API] Starting background generation for task: ${taskId}`)
        console.log(`[Async Card API] Background generation for user: ${targetUser.username}`)
        
        // 确保在异步执行中也使用正确的目标用户路径
        const backgroundUserCardPath = userService.getUserCardPath(targetUser.username, topic);
        
        // 更新文件夹状态为生成中
        await updateFolderStatus(backgroundUserCardPath, 'generating', { 
          taskId: taskId,
          templateName: actualTemplateName 
        })
        
        // 根据环境确定路径
        const isDocker = process.env.NODE_ENV === 'production' || process.env.DATA_PATH
        const dataPath = process.env.DATA_PATH || path.join(process.cwd(), 'data')
        
        // 检查是否有用户传入的参数
        const hasUserParams = userStyle || userLanguage || userReference;
        
        if (hasUserParams) {
          console.log(`[Async Card API] Task ${taskId}: Using user-provided parameters`);
          console.log(`[Async Card API] User Style: ${userStyle || 'not provided'}`);
          console.log(`[Async Card API] User Language: ${userLanguage || 'not provided'}`);
          console.log(`[Async Card API] User Reference: ${userReference ? userReference.substring(0, 100) + '...' : 'not provided'}`);
        }
        
        // 检查是否是自定义模式
        let pathMap = {};
        let processedTopic = topic;
        if (mode === 'custom' && references && references.length > 0) {
          console.log(`[Async Card API] Task ${taskId}: Custom mode enabled with ${references.length} references`);
          console.log(`[Async Card API] References details:`, JSON.stringify(references, null, 2));
          
          // 导入引用处理服务
          const { convertReferencesToPaths, buildReferencePrompt } = await import('../../services/referenceConverter.js');
          
          // 转换引用为实际路径
          const filePaths = await convertReferencesToPaths(references, targetUser.username);
          console.log(`[Async Card API] Converted file paths:`, JSON.stringify(filePaths, null, 2));
          
          // 获取路径映射
          const result = await buildReferencePrompt(filePaths, targetUser.username);
          pathMap = result.pathMap || {};
          
          // 替换topic中的@引用为实际路径
          processedTopic = topic;
          for (const [fileName, fullPath] of Object.entries(pathMap)) {
            // 替换 @文件名 为 完整路径
            const regex = new RegExp(`@${fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
            processedTopic = processedTopic.replace(regex, fullPath);
            console.log(`[Async Card API] Replaced @${fileName} with ${fullPath}`);
          }
          
          console.log(`[Async Card API] Original topic: "${topic}"`);
          console.log(`[Async Card API] Processed topic: "${processedTopic}"`);
          console.log(`[Async Card API] Custom mode paths converted: ${filePaths.length} files`);
        }
        
        // 使用前置提示词生成参数
        // 自定义模式下不生成参数，直接使用处理后的topic
        let parameters = { style: '', language: '', reference: '' };
        if (mode !== 'custom') {
          parameters = await claudeExecutorDirect.generateCardParameters(topic, actualTemplateName, {
            style: userStyle,
            language: userLanguage,
            reference: userReference
          });
        }
        
        // 根据模板类型解构参数
        let cover, style, language, referenceContent
        if (actualTemplateName === 'cardplanet-Sandra-cover' || actualTemplateName === 'cardplanet-Sandra-json') {
          ({ cover, style, language, reference: referenceContent } = parameters)
        } else {
          ({ style, language, reference: referenceContent } = parameters)
        }
        
        // 输出参数日志
        console.log(`[Async Card API] ========== PARAMETERS GENERATED ==========`)
        if (actualTemplateName === 'cardplanet-Sandra-cover' || actualTemplateName === 'cardplanet-Sandra-json') {
          console.log(`[Async Card API] Cover: ${cover}`)
          console.log(`[Async Card API] Style: ${style}`)
          console.log(`[Async Card API] Language: ${language}`)
          console.log(`[Async Card API] Reference: ${referenceContent ? referenceContent.substring(0, 200) + '...' : 'N/A'}`)
        } else {
          console.log(`[Async Card API] Style: ${style}`)
          console.log(`[Async Card API] Language: ${language}`)
          console.log(`[Async Card API] Reference: ${referenceContent ? referenceContent.substring(0, 200) + '...' : 'N/A'}`)
        }
        console.log(`[Async Card API] ==========================================`)
        
        // 构建提示词
        let prompt
        let templatePath = null  // 提前定义templatePath变量，避免作用域问题
        
        // 自定义模式 - 不使用模板
        if (mode === 'custom') {
          console.log(`[Async Card API] Custom mode - using processed topic with file paths`)
          
          // 直接使用已经替换过路径的topic
          prompt = processedTopic
          
          // 添加输出路径指示 - 注意路径末尾要加斜杠
          prompt += `\n\n请将生成的内容用恰当的文件名和格式写入到这个文件夹下：\n[${backgroundUserCardPath}/]\n`
          prompt += `注意：请根据内容类型生成相应的文件（如 .html, .json, .md 等）。`
          
        } else if (actualTemplateName) {
          // 模板模式 - 使用指定的模板
          templatePath = isDocker 
            ? path.join('/app/data/public_template', actualTemplateName)
            : path.join(dataPath, 'public_template', actualTemplateName)
          
          // 判断模板类型
          const isFolder = !actualTemplateName.includes('.md')
          
          if (isFolder) {
            const claudePath = path.join(templatePath, 'CLAUDE.md')
            
            if (actualTemplateName === 'cardplanet-Sandra-json') {
              prompt = `你是一位海报设计师，要为"${topic}"创作一套收藏级卡片海报作品。

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
生成的文件保存在[${backgroundUserCardPath}]`
            } else if (actualTemplateName === 'cardplanet-Sandra-cover') {
              prompt = `你是一位海报设计师，要为"${topic}"创作一套收藏级卡片海报作品。

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
生成的json文档保存在[${backgroundUserCardPath}]`
            } else {
              // 其他文件夹模板
              prompt = `你是一位海报设计师，要为"${topic}"创作一套收藏级卡片海报作品。

创作重点：
- 把每张卡片当作独立的艺术海报设计
- 深挖主题的趣味性和视觉潜力
- 用细节和创意打动人心

风格：${style}
语言：${language}
参考：${referenceContent}

从${claudePath}文档开始，按其指引阅读全部5个文档获取创作框架。
记住：规范是创作的基础，但你的目标是艺术品，不是代码任务。
生成的json文档保存在[${backgroundUserCardPath}]`
            }
          } else {
            // 单文件模式（.md文件）
            // 检查是否是 daily-knowledge-card-template
            if (actualTemplateName === 'daily-knowledge-card-template.md') {
              // Daily模板特殊处理：明确要求生成JSON文件
              prompt = `根据[${templatePath}]文档的规范，就以下命题：${topic}
              
请生成一个JSON文件，文件名格式为：主题名称-知识卡片.json
输出路径：[${backgroundUserCardPath}/]

注意：
1. 必须生成JSON格式文件
2. JSON内容要符合模板规范
3. 文件名使用中文主题名称`
            } else {
              // 其他单文件模板
              prompt = `根据[${templatePath}]文档的规范，就以下命题：${topic}，生成相应的文档在[${backgroundUserCardPath}/] 文件夹下`
            }
          }
        } else {
          // 没有模板也不是自定义模式 - 错误情况
          throw new Error('No template specified and not in custom mode')
        }
        
        // 输出完整组装后的提示词
        console.log('\n🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥')
        console.log('🎯 [Async Card API] ============ ASSEMBLED PROMPT ============')
        console.log('📋 [Async Card API] Template:', templateName)
        console.log('📝 [Async Card API] Topic:', topic)
        console.log('📐 [Async Card API] Prompt Length:', prompt.length, 'chars')
        console.log('💬 [Async Card API] ========== PROMPT BEGIN ==========\n')
        console.log(prompt)
        console.log('\n💬 [Async Card API] ========== PROMPT END ==========')
        console.log('🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥\n')
        
        // 使用统一的终端服务执行生成
        const apiId = `async_${taskId}`
        console.log(`[Async Card API] Executing Claude with API ID: ${apiId}`)
        
        // 执行Claude命令（不等待）
        apiTerminalService.executeClaude(apiId, prompt).catch(error => {
          console.error(`[Async Card API] Claude execution error:`, error)
        })
        
        // 文件检测器 - 根据模式决定检测策略
        console.log(`[Async Card API] Starting file detection for task: ${taskId}`)
        const fileDetected = await new Promise((resolve) => {
          let checkCount = 0
          const maxChecks = mode === 'custom' ? 60 : 300 // 自定义模式最多2分钟，模板模式10分钟
          
          const checkInterval = setInterval(async () => {
            checkCount++
            try {
              const files = await fs.readdir(backgroundUserCardPath)
              console.log(`[Async Card API] Check #${checkCount}: Found ${files.length} files in ${backgroundUserCardPath}`)
              
              // 过滤出生成的文件
              const generatedFiles = files.filter(f => {
                // 自定义模式：接受所有类型的文件
                if (mode === 'custom') {
                  return !f.includes('-response') &&
                         !f.startsWith('.') &&
                         !f.includes('_meta') &&
                         !f.includes('_backup')
                } else {
                  // 模板模式：只接受 json 和 html
                  return (f.endsWith('.json') || f.endsWith('.html')) && 
                         !f.includes('-response') &&
                         !f.startsWith('.') &&
                         !f.includes('_meta')
                }
              })
              
              if (generatedFiles.length > 0) {
                console.log(`[Async Card API] Generated files detected:`, generatedFiles)
              }
              
              // 自定义模式：检测到第一个文件就返回
              if (mode === 'custom') {
                if (generatedFiles.length > 0) {
                  console.log(`[Async Card API] Custom mode: First file detected!`)
                  clearInterval(checkInterval)
                  await updateFolderStatus(backgroundUserCardPath, 'partial', {
                    taskId: taskId,
                    filesDetected: generatedFiles.length,
                    mayHaveMore: true
                  })
                  resolve(true)
                }
              } 
              // 模板模式的原有逻辑
              else if (actualTemplateName === 'cardplanet-Sandra-json') {
                const htmlFiles = generatedFiles.filter(f => f.endsWith('.html'))
                const jsonFiles = generatedFiles.filter(f => f.endsWith('.json'))
                
                if (htmlFiles.length > 0 && jsonFiles.length > 0) {
                  console.log(`[Async Card API] Both HTML and JSON files detected!`)
                  clearInterval(checkInterval)
                  resolve(true)
                } else if (htmlFiles.length > 0 || jsonFiles.length > 0) {
                  console.log(`[Async Card API] Waiting for both files... HTML: ${htmlFiles.length}, JSON: ${jsonFiles.length}`)
                }
              } else {
                // 其他模板只需要一个JSON文件
                if (generatedFiles.length > 0) {
                  console.log(`[Async Card API] File detected!`)
                  clearInterval(checkInterval)
                  resolve(true)
                }
              }
              
              // 超时检查
              if (checkCount >= maxChecks) {
                console.error(`[Async Card API] File detection timeout after ${maxChecks * 2} seconds`)
                clearInterval(checkInterval)
                resolve(false)
              }
            } catch (error) {
              console.error(`[Async Card API] Error checking files:`, error)
            }
          }, 2000) // 每2秒检查一次
        })
        
        if (fileDetected) {
          console.log(`[Async Card API] Background generation completed for task: ${taskId}`)
        } else {
          console.error(`[Async Card API] File generation timeout for task: ${taskId}`)
          throw new Error('File generation timeout')
        }
        
        // === 新增：通用元数据记录和daily模板特殊处理 ===
        try {
          console.log(`[Async Card API] Starting meta processing for task: ${taskId}`)
          
          // 1. 创建会话元数据
          const metadata = new SessionMetadata(targetUser.username, topic, actualTemplateName, '/api/generate/card/async', taskId)
          
          // 设置请求参数
          if (style || language || referenceContent) {
            metadata.setUserParameters({ 
              style, 
              language, 
              reference: referenceContent
            })
          }
          
          // 设置处理信息
          metadata.setPaths(templatePath, backgroundUserCardPath)
          metadata.setAssembledPrompt(prompt)
          
          // 检查生成的文件并记录
          const files = await fs.readdir(backgroundUserCardPath)
          const generatedFiles = files.filter(f => 
            (f.endsWith('.json') || f.endsWith('.html')) && 
            !f.includes('-response') &&
            !f.startsWith('.') &&
            !f.includes('_meta')
          )
          
          // 记录生成的文件
          for (const fileName of generatedFiles) {
            const filePath = path.join(backgroundUserCardPath, fileName)
            const fileType = fileName.endsWith('.html') ? 'html' : 'json'
            await metadata.addFile(fileName, filePath, fileType)
          }
          
          metadata.logStep('file_generation', 'completed', {
            generatedFiles: generatedFiles,
            fileCount: generatedFiles.length
          })
          
          // 2. 检查是否为daily模板，需要四文件生成
          if (isDailyKnowledgeTemplate(actualTemplateName)) {
            console.log(`[Async Card API] Daily template detected, starting four-file generation for task: ${taskId}`)
            
            try {
              // 找到JSON文件作为输入
              const jsonFiles = generatedFiles.filter(f => f.endsWith('.json'))
              if (jsonFiles.length > 0) {
                const jsonFilePath = path.join(backgroundUserCardPath, jsonFiles[0])
                
                // 执行四文件生成流程
                const fourFileResult = await generateFourFiles({
                  userId: targetUser.username,
                  topic,
                  templateName: actualTemplateName,
                  outputDir: backgroundUserCardPath,
                  jsonFilePath,
                  baseName: path.basename(jsonFiles[0], '.json'), // 使用JSON文件的基础名
                  requestId: taskId,
                  apiEndpoint: '/api/generate/card/async'
                })
                
                if (fourFileResult.success) {
                  console.log(`[Async Card API] Four-file generation completed for task: ${taskId}`)
                  metadata.addLog('info', 'Four-file generation completed', {
                    files: fourFileResult.files
                  })
                } else {
                  console.warn(`[Async Card API] Four-file generation failed for task ${taskId}:`, fourFileResult.errors)
                  metadata.addLog('warn', 'Four-file generation failed', {
                    errors: fourFileResult.errors
                  })
                }
              } else {
                console.warn(`[Async Card API] No JSON file found for daily template processing: ${taskId}`)
                metadata.addLog('warn', 'No JSON file found for daily template processing')
              }
              
            } catch (fourFileError) {
              console.error(`[Async Card API] Four-file generation error for task ${taskId}:`, fourFileError)
              metadata.addLog('error', 'Four-file generation error', {
                error: fourFileError.message
              })
            }
          } else {
            // 非daily模板，只记录完成并保存元数据
            metadata.complete('success')
            const metaFilePath = await metadata.save(backgroundUserCardPath)
            console.log(`[Async Card API] Meta file saved for task ${taskId}: ${metaFilePath}`)
          }
          
        } catch (metaError) {
          console.error(`[Async Card API] Meta processing error for task ${taskId}:`, metaError)
          // 元数据处理失败不影响主流程
        }
        
        // 更新文件夹状态为完成
        await updateFolderStatus(backgroundUserCardPath, 'completed', { 
          taskId: taskId,
          completedAt: new Date() 
        })
        
        // 清理会话
        await apiTerminalService.destroySession(apiId)
        
      } catch (error) {
        console.error(`[Async Card API] Background generation failed for task ${taskId}:`, error)
        
        // 更新文件夹状态为失败
        try {
          await updateFolderStatus(backgroundUserCardPath, 'failed', { 
            taskId: taskId,
            errorMessage: error.message,
            failedAt: new Date() 
          })
        } catch (statusError) {
          console.error(`[Async Card API] Failed to update folder status:`, statusError)
        }
      }
    })
    
    // 立即返回响应
    res.json({
      code: 200,
      success: true,
      data: responseData,
      message: '任务已提交，正在后台生成'
    })
    
  } catch (error) {
    console.error('[Async Card API] Unexpected error:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '服务器内部错误',
      error: error.message
    })
  }
})

/**
 * 刷新检测文件接口 - 用于自定义模式的渐进式文件展示
 * GET /api/generate/card/async/refresh/:folderName
 * 
 * 响应:
 * {
 *   "code": 200,
 *   "success": true,
 *   "data": {
 *     "files": [...],
 *     "totalFiles": 2,
 *     "status": "partial",
 *     "folderName": "...",
 *     "lastChecked": "2025-09-05T10:00:00Z"
 *   }
 * }
 */
router.get('/refresh/:folderName', authenticateUserOrDefault, async (req, res) => {
  try {
    let { folderName } = req.params
    const username = req.user?.username || 'default'
    
    // 解码处理（兼容可能的URL编码）
    try {
      if (folderName.includes('%')) {
        const decoded = decodeURIComponent(folderName)
        console.log(`[Refresh API] URL decoded: ${folderName} -> ${decoded}`)
        folderName = decoded
      }
    } catch (e) {
      console.log(`[Refresh API] URL decode failed, using original: ${folderName}`)
    }
    
    // 构建用户卡片路径
    const userCardPath = userService.getUserCardPath(username, folderName)
    
    // 检查文件夹是否存在
    try {
      await fs.access(userCardPath)
    } catch (error) {
      return res.status(404).json({
        code: 404,
        success: false,
        message: '文件夹不存在'
      })
    }
    
    // 扫描文件夹获取文件列表
    const allFiles = await fs.readdir(userCardPath)
    
    // 过滤出生成的文件（排除元数据和临时文件）
    const generatedFiles = allFiles.filter(f => 
      !f.startsWith('.') &&           // 非隐藏文件
      !f.includes('_meta') &&          // 非元数据
      !f.includes('-response') &&      // 非响应日志
      !f.includes('_backup')           // 非备份文件
    )
    
    // 收集文件详细信息
    const fileInfos = []
    for (const fileName of generatedFiles) {
      const filePath = path.join(userCardPath, fileName)
      try {
        const stats = await fs.stat(filePath)
        const ext = path.extname(fileName).toLowerCase().substring(1)
        
        // 获取文件类型
        const fileType = getFileTypeFromExt(ext)
        
        // 对于文本类文件，读取前200字符作为预览
        let preview = ''
        if (['txt', 'md', 'json', 'html', 'csv', 'xml', 'js', 'css'].includes(ext)) {
          try {
            const content = await fs.readFile(filePath, 'utf-8')
            preview = content.substring(0, 200)
          } catch (e) {
            console.log(`[Refresh API] Cannot read preview for ${fileName}`)
          }
        }
        
        fileInfos.push({
          fileName,
          fileType,
          extension: ext,
          size: stats.size,
          createdAt: stats.birthtime,
          modifiedAt: stats.mtime,
          preview
        })
      } catch (error) {
        console.error(`[Refresh API] Error reading file ${fileName}:`, error)
      }
    }
    
    // 按创建时间排序（新的在前）
    fileInfos.sort((a, b) => b.createdAt - a.createdAt)
    
    // 读取文件夹元数据以获取任务状态
    let folderStatus = 'partial'
    let mayHaveMore = true
    
    try {
      const metaPath = path.join(userCardPath, '_meta.json')
      const metaData = JSON.parse(await fs.readFile(metaPath, 'utf-8'))
      folderStatus = metaData.status || 'partial'
      mayHaveMore = metaData.mayHaveMore !== false  // 默认为true
    } catch (e) {
      // 元数据可能不存在
    }
    
    // 返回文件列表和状态
    res.json({
      code: 200,
      success: true,
      data: {
        files: fileInfos,
        totalFiles: fileInfos.length,
        status: folderStatus,
        mayHaveMore,
        folderName,
        folderPath: userCardPath,
        lastChecked: new Date().toISOString()
      },
      message: `找到 ${fileInfos.length} 个文件`
    })
    
  } catch (error) {
    console.error('[Refresh API] Error:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '刷新失败',
      error: error.message
    })
  }
})

/**
 * 获取文件类型
 */
function getFileTypeFromExt(ext) {
  const typeMap = {
    // 图片
    jpg: 'image', jpeg: 'image', png: 'image', gif: 'image',
    svg: 'image', webp: 'image', bmp: 'image',
    // 文档
    pdf: 'pdf',
    doc: 'document', docx: 'document',
    txt: 'text', md: 'markdown',
    // 代码
    js: 'javascript', ts: 'typescript', py: 'python',
    java: 'java', cpp: 'cpp', c: 'c', cs: 'csharp',
    html: 'html', css: 'css', json: 'json', xml: 'xml',
    // 数据
    xlsx: 'excel', xls: 'excel', csv: 'csv',
    // 视频
    mp4: 'video', avi: 'video', mov: 'video', wmv: 'video',
    // 音频  
    mp3: 'audio', wav: 'audio', flac: 'audio'
  }
  return typeMap[ext] || ext || 'unknown'
}

export default router