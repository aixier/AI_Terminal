import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

/**
 * 小红书SDK分享功能封装
 * 使用官方 xhs-1.1.0.js SDK
 */
export function useXhsSDK() {
  const isSDKReady = ref(false)
  const isSharing = ref(false)
  
  /**
   * 初始化小红书SDK
   */
  const initSDK = async () => {
    try {
      // 等待SDK加载完成
      if (typeof window.xhs === 'undefined') {
        console.warn('[XHS SDK] SDK未加载，等待加载...')
        // 等待最多3秒
        let attempts = 0
        while (typeof window.xhs === 'undefined' && attempts < 30) {
          await new Promise(resolve => setTimeout(resolve, 100))
          attempts++
        }
      }
      
      if (typeof window.xhs !== 'undefined') {
        isSDKReady.value = true
        console.log('[XHS SDK] SDK加载成功')
        
        // 初始化配置（如果需要）
        if (window.xhs.init) {
          window.xhs.init({
            debug: false // 生产环境设为false
          })
        }
      } else {
        console.error('[XHS SDK] SDK加载失败')
      }
    } catch (error) {
      console.error('[XHS SDK] 初始化失败:', error)
    }
  }
  
  /**
   * 获取分享签名
   * @param {Object} shareData - 分享数据
   * @returns {Promise<string>} 签名字符串
   */
  const getShareSignature = async (shareData) => {
    try {
      // 调用后端接口生成签名
      const response = await fetch('/api/generate/share/xiaohongshu/signature', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: window.location.href,
          timestamp: Date.now(),
          ...shareData
        })
      })
      
      if (!response.ok) {
        throw new Error('获取签名失败')
      }
      
      const result = await response.json()
      return result.data?.signature || ''
    } catch (error) {
      console.error('[XHS SDK] 获取签名失败:', error)
      // 如果签名接口不存在，返回空（某些情况下可能不需要签名）
      return ''
    }
  }
  
  /**
   * 分享到小红书
   * @param {Object} options - 分享选项
   * @param {string} options.title - 标题
   * @param {string} options.content - 内容
   * @param {Array<string>} options.hashtags - 话题标签
   * @param {Array<string>} options.imageUrls - 图片URL列表
   * @param {string} options.shareLink - 分享链接
   */
  const shareToXHS = async (options) => {
    if (!isSDKReady.value) {
      ElMessage.warning('小红书SDK未就绪，请稍后重试')
      await initSDK()
      if (!isSDKReady.value) {
        return false
      }
    }
    
    if (isSharing.value) {
      ElMessage.warning('正在分享中，请稍候...')
      return false
    }
    
    try {
      isSharing.value = true
      
      const { title, content, hashtags = [], imageUrls = [], shareLink } = options
      
      // 构建分享内容
      const shareContent = `${title}\n\n${content}\n\n${hashtags.map(tag => `#${tag}`).join(' ')}`
      
      // 获取签名（如果需要）
      const signature = await getShareSignature({
        title,
        content: shareContent,
        images: imageUrls
      })
      
      // 检查是否在移动端
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      
      if (window.xhs && window.xhs.share) {
        // 使用小红书SDK分享
        const shareParams = {
          title: title,
          content: shareContent,
          imageUrl: imageUrls[0] || '', // 主图
          images: imageUrls, // 所有图片
          link: shareLink || window.location.href,
          signature: signature
        }
        
        console.log('[XHS SDK] 分享参数:', shareParams)
        
        // 调用SDK分享方法
        window.xhs.share(shareParams, {
          success: () => {
            console.log('[XHS SDK] 分享成功')
            ElMessage.success('已唤起小红书分享')
          },
          fail: (error) => {
            console.error('[XHS SDK] 分享失败:', error)
            // 失败时降级到复制内容
            fallbackToCopy(shareContent)
          },
          cancel: () => {
            console.log('[XHS SDK] 用户取消分享')
          }
        })
      } else if (isMobile) {
        // 移动端但SDK不可用，尝试URL Scheme
        tryOpenXHSApp(shareContent, imageUrls[0])
      } else {
        // PC端或SDK不可用，降级到复制
        fallbackToCopy(shareContent)
      }
      
      return true
    } catch (error) {
      console.error('[XHS SDK] 分享出错:', error)
      ElMessage.error('分享失败: ' + error.message)
      return false
    } finally {
      isSharing.value = false
    }
  }
  
  /**
   * 尝试使用URL Scheme打开小红书APP
   */
  const tryOpenXHSApp = (content, imageUrl) => {
    // 小红书URL Scheme
    // 注意：这个scheme可能会变化，且功能有限
    const scheme = 'xhsdiscover://'
    const appStoreUrl = 'https://apps.apple.com/cn/app/id741292507' // iOS
    const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.xingin.xhs' // Android
    
    // 先复制内容
    navigator.clipboard.writeText(content).then(() => {
      ElMessage.success('内容已复制，正在打开小红书...')
    })
    
    // 尝试打开APP
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    window.location.href = scheme
    
    // 如果3秒后还在当前页面，说明没有安装APP
    setTimeout(() => {
      if (document.visibilityState === 'visible') {
        if (confirm('未检测到小红书APP，是否前往下载？')) {
          window.open(isIOS ? appStoreUrl : playStoreUrl, '_blank')
        }
      }
    }, 3000)
  }
  
  /**
   * 降级方案：复制内容到剪贴板
   */
  const fallbackToCopy = async (content) => {
    try {
      await navigator.clipboard.writeText(content)
      ElMessage.success('分享内容已复制，请打开小红书APP粘贴发布')
    } catch (error) {
      ElMessage.error('复制失败，请手动复制内容')
    }
  }
  
  // 组件挂载时初始化SDK
  onMounted(() => {
    initSDK()
  })
  
  return {
    isSDKReady,
    isSharing,
    shareToXHS,
    initSDK
  }
}