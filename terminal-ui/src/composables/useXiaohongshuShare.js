import { ref } from 'vue'
import { ElMessage } from 'element-plus'

/**
 * 小红书分享通用组合式函数
 * 提供完整的分享功能，包括对话框管理和API调用
 */
export function useXiaohongshuShare() {
  // 分享状态
  const isSharing = ref(false)
  const shareDialogVisible = ref(false)
  const shareResult = ref(null)
  const loadingProgress = ref('')

  /**
   * 检查是否为HTML文件
   */
  const isHtmlFile = (filename) => {
    if (!filename) return false
    const name = filename.toLowerCase()
    return name.endsWith('.html') || name.endsWith('.htm')
  }

  /**
   * 获取文件内容
   */
  const getFileContent = async (file) => {
    try {
      if (file.content) {
        return file.content
      }
      
      // 如果没有直接内容，尝试通过API获取
      if (file.path) {
        const username = localStorage.getItem('username') || 'default'
        // Convert absolute path to relative path from workspace
        const relativePath = file.path.replace(`/app/data/users/${username}/workspace/`, '')
        const response = await fetch(`/api/workspace/${username}/file/${encodeURIComponent(relativePath)}`)
        
        if (!response.ok) {
          throw new Error('获取文件内容失败')
        }
        
        const data = await response.json()
        return data.content
      }
      
      return null
    } catch (error) {
      console.error('[XHS Share] 获取文件内容失败:', error)
      return null
    }
  }

  /**
   * 分享到小红书
   * @param {Object} file - 文件对象，必须包含 name 属性
   * @param {Object} folder - 文件夹对象，可选，可包含 name 或 id 属性
   * @returns {Promise<boolean>} 分享是否成功
   */
  const shareToXiaohongshu = async (file, folder = null) => {
    console.log('[XHS Share] 开始分享:', { file, folder })

    // 参数验证
    if (!file) {
      ElMessage.warning('请选择要分享的文件')
      return false
    }

    if (!file.name) {
      ElMessage.warning('文件信息不完整')
      return false
    }

    if (!isHtmlFile(file.name)) {
      ElMessage.warning('只能分享HTML文件到小红书')
      return false
    }

    // 立即显示等待对话框，提升用户体验
    isSharing.value = true
    shareResult.value = null
    loadingProgress.value = '正在读取文件内容...'
    shareDialogVisible.value = true  // 立即显示对话框
    
    ElMessage.info('正在生成分享内容，请稍候...')

    try {
      // 获取文件内容
      loadingProgress.value = '正在读取文件内容...'
      const content = await getFileContent(file)
      if (!content) {
        throw new Error('无法获取文件内容')
      }

      // 准备请求体
      loadingProgress.value = '正在准备分享数据...'
      let requestBody = { 
        html: content,
        name: file.name  // 添加文件名参数
      }
      
      // 处理文件夹信息（如果存在）
      const folderName = folder?.name || folder?.id || null
      console.log('[XHS Share] 文件夹名称:', folderName)

      if (folderName && folderName !== 'root-files') {
        try {
          // 尝试获取页面信息（可选）
          loadingProgress.value = '正在获取模板信息...'
          // 对topic进行sanitize处理（与后端保持一致）
          const sanitizedFolderName = folderName.trim().replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')
          console.log('[XHS Share] Sanitized文件夹名称:', sanitizedFolderName)
          const queryUrl = `/api/generate/card/query/${encodeURIComponent(sanitizedFolderName)}`
          const queryResponse = await fetch(queryUrl)
          
          if (queryResponse.ok) {
            const queryData = await queryResponse.json()
            
            if (queryData.success && queryData.data) {
              const templateName = queryData.data.templateName || ''
              
              // 排除特定模板
              if (templateName !== 'daily-knowledge-card-template.md') {
                if (queryData.data.pageinfo) {
                  requestBody.pageinfo = JSON.stringify(queryData.data.pageinfo)
                } else {
                  // 查找JSON文件
                  const files = queryData.data.files || queryData.data.allFiles || []
                  const jsonFile = files.find(f => {
                    const fileName = f.fileName || f.name
                    return fileName && fileName.endsWith('.json') && 
                           !fileName.includes('meta') && 
                           !fileName.includes('-response')
                  })
                  
                  if (jsonFile && jsonFile.content) {
                    requestBody.pageinfo = JSON.stringify(jsonFile.content)
                  }
                }
              }
            }
          } else if (queryResponse.status === 404) {
            // 404是正常的，说明没有对应的文件夹信息
            console.log('[XHS Share] 文件夹信息不存在，继续处理')
          } else {
            console.warn('[XHS Share] 查询文件夹信息失败:', queryResponse.status)
          }
        } catch (error) {
          // 静默处理错误，pageinfo是可选的
          console.log('[XHS Share] 获取pageinfo时出错（可忽略）:', error.message)
        }
      }

      console.log('[XHS Share] 发送请求体:', requestBody)

      // 发送分享请求
      loadingProgress.value = '正在生成分享内容，请稍候...'
      const response = await fetch('/api/generate/share/xiaohongshu', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.message || '处理失败')
      }

      // 保存结果
      shareResult.value = result
      
      // 直接打开分享链接
      if (result.data?.shareLink) {
        window.open(result.data.shareLink, '_blank')
        ElMessage.success('正在打开分享页面...')
      } else {
        ElMessage.warning('分享链接生成失败')
      }
      
      return true
      
    } catch (error) {
      console.error('[XHS Share] 分享失败:', error)
      ElMessage.error('分享失败: ' + error.message)
      return false
    } finally {
      isSharing.value = false
    }
  }

  /**
   * 关闭分享对话框
   */
  const closeShareDialog = () => {
    shareDialogVisible.value = false
    shareResult.value = null
  }

  /**
   * 复制分享内容到剪贴板
   */
  const copyShareContent = async (content) => {
    try {
      await navigator.clipboard.writeText(content)
      ElMessage.success('发布内容已复制到剪贴板')
      return true
    } catch (e) {
      ElMessage.error('复制失败: ' + e.message)
      return false
    }
  }

  /**
   * 复制链接到剪贴板
   */
  const copyLink = async (url) => {
    try {
      await navigator.clipboard.writeText(url)
      ElMessage.success('链接已复制到剪贴板')
      return true
    } catch (e) {
      ElMessage.error('复制失败: ' + e.message)
      return false
    }
  }

  /**
   * 复制短链接到剪贴板
   */
  const copyShortLink = async (url) => {
    try {
      await navigator.clipboard.writeText(url)
      ElMessage.success('短链接已复制到剪贴板')
      return true
    } catch (e) {
      ElMessage.error('复制失败: ' + e.message)
      return false
    }
  }

  /**
   * 在新窗口打开分享链接
   */
  const openShareLink = (url) => {
    if (url) {
      window.open(url, '_blank')
    }
  }

  return {
    // 状态
    isSharing,
    shareDialogVisible,
    shareResult,
    loadingProgress,
    
    // 方法
    shareToXiaohongshu,
    closeShareDialog,
    copyShareContent,
    copyLink,
    copyShortLink,
    openShareLink,
    
    // 工具函数
    isHtmlFile
  }
}