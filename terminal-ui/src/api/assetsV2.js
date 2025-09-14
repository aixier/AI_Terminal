/**
 * Assets V2 API
 * 新版资产管理接口
 */

import request from './config'

export const assetsApiV2 = {
  /**
   * 获取资产列表
   */
  getAssets(params = {}) {
    return request({
      url: '/v2/assets',
      method: 'get',
      params
    })
  },

  /**
   * 获取目录树
   */
  getTree(params = {}) {
    return request({
      url: '/v2/assets/tree',
      method: 'get',
      params
    })
  },

  /**
   * 获取存储统计
   */
  getStats() {
    return request({
      url: '/v2/assets/stats',
      method: 'get'
    })
  },

  /**
   * 获取资产元数据（包含作品集）
   */
  getMetadata() {
    return request({
      url: '/v2/assets/metadata',
      method: 'get'
    })
  },

  /**
   * 搜索文件
   */
  search(params) {
    return request({
      url: '/v2/assets/search',
      method: 'get',
      params
    })
  },

  /**
   * 获取文件详情
   */
  getFileInfo(path) {
    return request({
      url: '/v2/assets/file',
      method: 'get',
      params: { path }
    })
  },

  /**
   * 上传文件
   */
  upload(formData, config = {}) {
    return request({
      url: '/v2/assets/upload',
      method: 'post',
      data: formData,
      ...config
    })
  },

  /**
   * 批量上传
   */
  uploadBatch(formData, config = {}) {
    return request({
      url: '/v2/assets/upload',
      method: 'post',
      data: formData,
      ...config
    })
  },

  /**
   * 创建文件夹
   */
  createFolder(data) {
    return request({
      url: '/v2/assets/folder',
      method: 'post',
      data
    })
  },

  /**
   * 移动文件/文件夹
   */
  move(data) {
    return request({
      url: '/v2/assets/move',
      method: 'put',
      data
    })
  },

  /**
   * 重命名
   */
  rename(data) {
    return request({
      url: '/v2/assets/rename',
      method: 'put',
      data
    })
  },

  /**
   * 删除
   */
  delete(path) {
    return request({
      url: '/v2/assets',
      method: 'delete',
      params: { path }
    })
  },

  /**
   * 批量操作
   */
  batch(data) {
    return request({
      url: '/v2/assets/batch',
      method: 'post',
      data
    })
  },

  /**
   * 优化图片
   */
  optimizeImage(data) {
    return request({
      url: '/v2/assets/optimize',
      method: 'post',
      data
    })
  },

  /**
   * 重建索引
   */
  rebuildIndex() {
    return request({
      url: '/v2/assets/rebuild-index',
      method: 'post'
    })
  },

  /**
   * 清理缓存
   */
  clearCache(type = 'all') {
    return request({
      url: '/v2/assets/clear-cache',
      method: 'post',
      data: { type }
    })
  }
}