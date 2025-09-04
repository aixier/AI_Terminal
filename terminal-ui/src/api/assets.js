/**
 * 素材管理 API 服务
 * 用于处理素材的上传、查询、删除等操作
 */

import request from './config'

export const assetsApi = {
  /**
   * 获取素材列表
   * @param {Object} params - 查询参数
   * @param {string} params.type - 文件类型筛选 (image, document, other)
   * @param {string} params.folder - 文件夹筛选
   * @param {number} params.limit - 限制返回数量
   * @param {number} params.offset - 分页偏移
   * @param {string} params.search - 搜索关键词
   */
  getAssets(params = {}) {
    return request.get('/assets', { params })
  },

  /**
   * 获取单个素材详情
   * @param {string} id - 素材ID
   */
  getAsset(id) {
    return request.get(`/assets/${id}`)
  },

  /**
   * 上传素材（支持批量）
   * @param {FormData|File[]} data - FormData对象或文件数组
   * @param {Object} options - 上传选项
   */
  uploadAssets(data, options = {}) {
    let formData = data
    
    // 如果传入的是文件数组，转换为FormData
    if (Array.isArray(data)) {
      formData = new FormData()
      data.forEach(file => {
        formData.append('files', file)
      })
      
      // 添加其他参数
      if (options.folderId) {
        formData.append('folderId', options.folderId)
      }
      if (options.tags && options.tags.length > 0) {
        formData.append('tags', options.tags.join(','))
      }
      if (options.description) {
        formData.append('description', options.description)
      }
    }
    
    return request.post('/assets/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: options.onProgress
    })
  },

  /**
   * 更新素材信息
   * @param {string} id - 素材ID
   * @param {Object} data - 更新数据
   */
  updateAsset(id, data) {
    return request.put(`/assets/${id}`, data)
  },

  /**
   * 删除单个素材
   * @param {string} id - 素材ID
   */
  deleteAsset(id) {
    return request.delete(`/assets/${id}`)
  },

  /**
   * 批量删除素材
   * @param {string[]} ids - 素材ID数组
   */
  deleteAssets(ids) {
    return request.delete('/assets', {
      data: { ids }
    })
  },

  /**
   * 获取素材引用列表（用于@选择器）
   * @param {boolean} recent - 是否只返回最近使用的
   * @param {number} limit - 限制数量
   */
  getReferences(recent = false, limit = 20) {
    return request.get('/assets/references', {
      params: { recent, limit }
    })
  },

  /**
   * 获取存储使用情况
   */
  getStorageInfo() {
    return request.get('/assets/storage')
  },

  /**
   * 健康检查
   */
  checkHealth() {
    return request.get('/assets/health')
  },

  // ========== 文件夹相关API ==========
  
  /**
   * 创建文件夹
   * @param {Object} data - 文件夹数据
   * @param {string} data.name - 文件夹名称
   * @param {string} data.parentId - 父文件夹ID
   * @param {string} data.color - 文件夹颜色
   * @param {string} data.description - 描述
   */
  createCategory(data) {
    return request.post('/assets/categories', data)
  },

  /**
   * 获取文件夹列表（树形结构）
   */
  getCategories() {
    return request.get('/assets/categories')
  },

  /**
   * 更新文件夹信息
   * @param {string} id - 文件夹ID
   * @param {Object} data - 更新数据
   */
  updateCategory(category, data) {
    return request.put(`/assets/categories/${encodeURIComponent(category)}`, data)
  },

  /**
   * 删除文件夹
   * @param {string} id - 文件夹ID
   * @param {boolean} moveToParent - 是否将子内容移动到父文件夹
   */
  deleteCategory(category, moveToParent = false) {
    return request.delete(`/assets/categories/${encodeURIComponent(category)}`, {
      params: { moveToParent }
    })
  },

  /**
   * 移动文件或文件夹
   * @param {Object} data - 移动数据
   * @param {Array} data.items - 要移动的项目 [{id, type: 'asset'|'folder'}]
   * @param {string} data.targetFolderId - 目标文件夹ID
   */
  moveItems(data) {
    return request.post('/assets/move', data)
  }
}

// 工具函数
export const assetUtils = {
  /**
   * 获取文件类型图标
   * @param {string} type - 文件类型
   */
  getAssetIcon(type) {
    const icons = {
      image: '🖼️',
      document: '📄',
      media: '🎬',
      other: '📦'
    }
    return icons[type] || icons.other
  },

  /**
   * 格式化文件大小
   * @param {number} bytes - 字节数
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  },

  /**
   * 检查文件类型是否为图片
   * @param {string} filename - 文件名
   */
  isImageFile(filename) {
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp']
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'))
    return imageExts.includes(ext)
  },

  /**
   * 检查文件类型是否为文档
   * @param {string} filename - 文件名
   */
  isDocumentFile(filename) {
    const docExts = ['.pdf', '.doc', '.docx', '.txt', '.md', '.rtf']
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'))
    return docExts.includes(ext)
  },

  /**
   * 生成素材引用路径
   * @param {Object} asset - 素材对象
   */
  generateReference(asset) {
    return asset.referencePath || `@${asset.name}`
  }
}

export default assetsApi