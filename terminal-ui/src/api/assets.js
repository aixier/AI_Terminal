/**
 * 素材管理 API - 新版实时文件系统
 * 基于Chokidar的真实文件管理系统
 */

import request from './config'

// 默认用户ID（可从store或登录信息获取）
const getUserId = () => {
  return localStorage.getItem('userId') || 'default'
}

export const assetsApi = {
  /**
   * 获取文件列表
   * @param {Object} params - 查询参数
   * @param {string} params.path - 文件路径
   * @param {string} params.search - 搜索关键词
   */
  getAssets(params = {}) {
    return request.get('/assets/list', { 
      params: {
        ...params,
        userId: getUserId()
      }
    })
  },

  /**
   * 获取目录树结构
   */
  getTree() {
    return request.get('/assets/tree', {
      params: { userId: getUserId() }
    })
  },

  /**
   * 获取分类（兼容旧代码）
   */
  getCategories() {
    // 将树形结构转换为旧格式
    return this.getTree().then(res => {
      if (res.success && res.data) {
        // 转换为旧的分类格式
        const categories = {}
        const labels = {}
        const tree = res.data.tree || []
        
        const processNode = (node, parentKey = '') => {
          const key = parentKey ? `${parentKey}.${node.name}` : node.name
          categories[key] = node.files || []
          labels[key] = node.name
          
          if (node.children) {
            node.children.forEach(child => processNode(child, key))
          }
        }
        
        tree.forEach(node => processNode(node))
        
        return {
          success: true,
          data: {
            categories,
            labels,
            tree
          }
        }
      }
      return res
    })
  },

  /**
   * 创建文件夹
   * @param {Object} data - 文件夹信息
   * @param {string} data.path - 文件夹路径
   * @param {string} data.label - 显示名称（兼容旧代码）
   */
  createFolder(data) {
    return request.post('/assets/folder', {
      path: data.path || data.label,
      userId: getUserId()
    })
  },

  /**
   * 创建分类（兼容旧代码）
   */
  createCategory(data) {
    // 转换为新的文件夹创建
    const path = data.parent 
      ? `${data.parent}/${data.label}`
      : data.label
    
    return this.createFolder({ path })
  },

  /**
   * 上传文件
   * @param {FormData} formData - 包含文件的表单数据
   */
  uploadAssets(formData) {
    // 添加用户ID
    formData.append('userId', getUserId())
    
    // 如果有category参数，转换为path
    const category = formData.get('category')
    if (category) {
      formData.delete('category')
      formData.append('path', category)
    }
    
    return request.post('/assets/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  },

  /**
   * 移动文件/文件夹
   * @param {string} oldPath - 原路径
   * @param {string} newPath - 新路径
   */
  move(oldPath, newPath) {
    return request.put('/assets/move', {
      oldPath,
      newPath,
      userId: getUserId()
    })
  },

  /**
   * 重命名
   * @param {string} path - 文件/文件夹路径
   * @param {string} newName - 新名称
   */
  rename(path, newName) {
    return request.put('/assets/rename', {
      path,
      newName,
      userId: getUserId()
    })
  },

  /**
   * 删除文件/文件夹
   * @param {string} path - 要删除的路径
   */
  delete(path) {
    return request.delete('/assets', {
      params: {
        path,
        userId: getUserId()
      }
    })
  },

  /**
   * 删除文件（兼容旧代码）
   */
  deleteFile(fileName, category) {
    const path = category ? `${category}/${fileName}` : fileName
    return this.delete(path)
  },

  /**
   * 删除分类（兼容旧代码）
   */
  deleteCategory(categoryKey) {
    return this.delete(categoryKey)
  },

  /**
   * 批量操作
   * @param {string} operation - 操作类型 (move, copy, delete)
   * @param {Array} items - 要操作的项目列表
   */
  batch(operation, items) {
    return request.post('/assets/batch', {
      operation,
      items,
      userId: getUserId()
    })
  },

  /**
   * 搜索文件
   * @param {string} query - 搜索关键词
   * @param {Object} options - 搜索选项
   */
  search(query, options = {}) {
    return request.get('/assets/search', {
      params: {
        q: query,
        ...options,
        userId: getUserId()
      }
    })
  },

  /**
   * 获取文件内容
   * @param {string} path - 文件路径
   */
  getFileContent(path) {
    return request.get('/assets/content', {
      params: {
        path,
        userId: getUserId()
      }
    })
  },

  /**
   * 获取缩略图
   * @param {string} path - 文件路径
   * @param {string} size - 缩略图尺寸 (small, medium, large)
   */
  getThumbnail(path, size = 'medium') {
    return `/api/assets/thumbnail?path=${encodeURIComponent(path)}&size=${size}&userId=${getUserId()}`
  },

  /**
   * 下载文件
   * @param {string} path - 文件路径
   */
  download(path) {
    return `/api/assets/download?path=${encodeURIComponent(path)}&userId=${getUserId()}`
  },

  /**
   * 获取存储信息
   */
  getStorageInfo() {
    return request.get('/assets/storage', {
      params: { userId: getUserId() }
    })
  }
}

// 导出SSE事件监听
export const assetEvents = {
  /**
   * 监听文件变化事件
   * @param {Function} callback - 事件回调
   * @returns {EventSource} 事件源对象
   */
  watch(callback) {
    const userId = getUserId()
    const eventSource = new EventSource(`/api/assets/events/${userId}`)
    
    // 文件事件
    eventSource.addEventListener('file:added', (e) => {
      callback({ type: 'file:added', data: JSON.parse(e.data) })
    })
    
    eventSource.addEventListener('file:modified', (e) => {
      callback({ type: 'file:modified', data: JSON.parse(e.data) })
    })
    
    eventSource.addEventListener('file:deleted', (e) => {
      callback({ type: 'file:deleted', data: JSON.parse(e.data) })
    })
    
    // 文件夹事件
    eventSource.addEventListener('folder:created', (e) => {
      callback({ type: 'folder:created', data: JSON.parse(e.data) })
    })
    
    eventSource.addEventListener('folder:deleted', (e) => {
      callback({ type: 'folder:deleted', data: JSON.parse(e.data) })
    })
    
    // 批量事件
    eventSource.addEventListener('batch:completed', (e) => {
      callback({ type: 'batch:completed', data: JSON.parse(e.data) })
    })
    
    // 错误处理
    eventSource.onerror = (error) => {
      console.error('[SSE] Connection error:', error)
      callback({ type: 'error', error })
    }
    
    return eventSource
  },
  
  /**
   * 停止监听
   * @param {EventSource} eventSource - 事件源对象
   */
  unwatch(eventSource) {
    if (eventSource) {
      eventSource.close()
    }
  }
}

export default assetsApi