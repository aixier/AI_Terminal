/**
 * Asset 数据模型
 * 定义资产的数据结构和验证规则
 */

class Asset {
  constructor(data = {}) {
    this.id = data.id || this.generateId()
    this.userId = data.userId
    this.name = data.name
    this.fileName = data.fileName || data.name
    this.path = data.path
    this.fullPath = data.fullPath
    this.size = data.size || 0
    this.type = data.type || 'file'
    this.mimeType = data.mimeType
    this.createdAt = data.createdAt || new Date().toISOString()
    this.modifiedAt = data.modifiedAt || new Date().toISOString()
    this.accessedAt = data.accessedAt
    this.metadata = data.metadata || {}
    this.tags = data.tags || []
    this.description = data.description
    this.thumbnail = data.thumbnail
    this.preview = data.preview
    this.parentId = data.parentId
    this.isDirectory = data.isDirectory || false
    this.permissions = data.permissions || {
      read: true,
      write: true,
      delete: true
    }
  }

  /**
   * 生成唯一ID
   */
  generateId() {
    return `asset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 验证数据有效性
   */
  validate() {
    const errors = []

    if (!this.userId) {
      errors.push('User ID is required')
    }

    if (!this.name) {
      errors.push('Name is required')
    }

    if (!this.path) {
      errors.push('Path is required')
    }

    if (this.size < 0) {
      errors.push('Size cannot be negative')
    }

    if (!this.type) {
      errors.push('Type is required')
    }

    if (!this.createdAt) {
      errors.push('Created date is required')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * 转换为JSON
   */
  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      name: this.name,
      fileName: this.fileName,
      path: this.path,
      fullPath: this.fullPath,
      size: this.size,
      type: this.type,
      mimeType: this.mimeType,
      createdAt: this.createdAt,
      modifiedAt: this.modifiedAt,
      accessedAt: this.accessedAt,
      metadata: this.metadata,
      tags: this.tags,
      description: this.description,
      thumbnail: this.thumbnail,
      preview: this.preview,
      parentId: this.parentId,
      isDirectory: this.isDirectory,
      permissions: this.permissions
    }
  }

  /**
   * 转换为简化格式
   */
  toSimple() {
    return {
      id: this.id,
      name: this.name,
      path: this.path,
      size: this.size,
      type: this.type,
      modifiedAt: this.modifiedAt,
      isDirectory: this.isDirectory
    }
  }

  /**
   * 从JSON创建实例
   */
  static fromJSON(json) {
    return new Asset(json)
  }

  /**
   * 批量创建实例
   */
  static fromArray(array) {
    return array.map(item => new Asset(item))
  }

  /**
   * 获取文件扩展名
   */
  getExtension() {
    const parts = this.name.split('.')
    return parts.length > 1 ? `.${parts.pop().toLowerCase()}` : ''
  }

  /**
   * 获取文件大小（格式化）
   */
  getFormattedSize() {
    const bytes = this.size
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }

  /**
   * 是否是图片
   */
  isImage() {
    return this.type === 'image' || 
           ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'].includes(this.mimeType)
  }

  /**
   * 是否是视频
   */
  isVideo() {
    return this.type === 'video' || 
           (this.mimeType && this.mimeType.startsWith('video/'))
  }

  /**
   * 是否是音频
   */
  isAudio() {
    return this.type === 'audio' || 
           (this.mimeType && this.mimeType.startsWith('audio/'))
  }

  /**
   * 是否是文档
   */
  isDocument() {
    return ['pdf', 'word', 'excel', 'powerpoint', 'text', 'markdown'].includes(this.type)
  }

  /**
   * 是否是代码文件
   */
  isCode() {
    return this.type === 'code'
  }

  /**
   * 更新修改时间
   */
  touch() {
    this.modifiedAt = new Date().toISOString()
    this.accessedAt = new Date().toISOString()
  }

  /**
   * 添加标签
   */
  addTag(tag) {
    if (!this.tags.includes(tag)) {
      this.tags.push(tag)
    }
  }

  /**
   * 移除标签
   */
  removeTag(tag) {
    const index = this.tags.indexOf(tag)
    if (index > -1) {
      this.tags.splice(index, 1)
    }
  }

  /**
   * 设置元数据
   */
  setMetadata(key, value) {
    this.metadata[key] = value
  }

  /**
   * 获取元数据
   */
  getMetadata(key) {
    return this.metadata[key]
  }

  /**
   * 检查权限
   */
  hasPermission(permission) {
    return this.permissions[permission] === true
  }

  /**
   * 克隆实例
   */
  clone() {
    return new Asset(this.toJSON())
  }

  /**
   * 合并数据
   */
  merge(data) {
    Object.keys(data).forEach(key => {
      if (data[key] !== undefined && key !== 'id') {
        this[key] = data[key]
      }
    })
    return this
  }
}

/**
 * AssetCollection 资产集合
 */
class AssetCollection {
  constructor(assets = []) {
    this.assets = assets.map(asset => 
      asset instanceof Asset ? asset : new Asset(asset)
    )
  }

  /**
   * 添加资产
   */
  add(asset) {
    if (!(asset instanceof Asset)) {
      asset = new Asset(asset)
    }
    this.assets.push(asset)
    return this
  }

  /**
   * 移除资产
   */
  remove(id) {
    const index = this.assets.findIndex(asset => asset.id === id)
    if (index > -1) {
      this.assets.splice(index, 1)
    }
    return this
  }

  /**
   * 查找资产
   */
  find(id) {
    return this.assets.find(asset => asset.id === id)
  }

  /**
   * 根据路径查找
   */
  findByPath(path) {
    return this.assets.find(asset => asset.path === path)
  }

  /**
   * 过滤资产
   */
  filter(callback) {
    return new AssetCollection(this.assets.filter(callback))
  }

  /**
   * 排序
   */
  sort(compareFunction) {
    this.assets.sort(compareFunction)
    return this
  }

  /**
   * 按名称排序
   */
  sortByName(ascending = true) {
    return this.sort((a, b) => {
      const result = a.name.localeCompare(b.name)
      return ascending ? result : -result
    })
  }

  /**
   * 按大小排序
   */
  sortBySize(ascending = true) {
    return this.sort((a, b) => {
      const result = a.size - b.size
      return ascending ? result : -result
    })
  }

  /**
   * 按修改时间排序
   */
  sortByModified(ascending = false) {
    return this.sort((a, b) => {
      const result = new Date(a.modifiedAt) - new Date(b.modifiedAt)
      return ascending ? result : -result
    })
  }

  /**
   * 获取总大小
   */
  getTotalSize() {
    return this.assets.reduce((total, asset) => total + asset.size, 0)
  }

  /**
   * 获取资产数量
   */
  getCount() {
    return this.assets.length
  }

  /**
   * 获取文件类型统计
   */
  getTypeStats() {
    const stats = {}
    this.assets.forEach(asset => {
      stats[asset.type] = (stats[asset.type] || 0) + 1
    })
    return stats
  }

  /**
   * 转换为JSON
   */
  toJSON() {
    return this.assets.map(asset => asset.toJSON())
  }

  /**
   * 转换为简化格式
   */
  toSimple() {
    return this.assets.map(asset => asset.toSimple())
  }

  /**
   * 分页
   */
  paginate(page = 1, limit = 20) {
    const start = (page - 1) * limit
    const end = start + limit
    return new AssetCollection(this.assets.slice(start, end))
  }

  /**
   * 搜索
   */
  search(query) {
    const queryLower = query.toLowerCase()
    return this.filter(asset => 
      asset.name.toLowerCase().includes(queryLower) ||
      asset.path.toLowerCase().includes(queryLower) ||
      (asset.description && asset.description.toLowerCase().includes(queryLower)) ||
      asset.tags.some(tag => tag.toLowerCase().includes(queryLower))
    )
  }

  /**
   * 按类型过滤
   */
  filterByType(type) {
    return this.filter(asset => asset.type === type)
  }

  /**
   * 只获取文件
   */
  getFiles() {
    return this.filter(asset => !asset.isDirectory)
  }

  /**
   * 只获取文件夹
   */
  getFolders() {
    return this.filter(asset => asset.isDirectory)
  }

  /**
   * 迭代器
   */
  [Symbol.iterator]() {
    return this.assets[Symbol.iterator]()
  }

  /**
   * forEach
   */
  forEach(callback) {
    this.assets.forEach(callback)
  }

  /**
   * map
   */
  map(callback) {
    return this.assets.map(callback)
  }
}

export { Asset, AssetCollection }