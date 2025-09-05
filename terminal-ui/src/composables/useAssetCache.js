/**
 * 素材缓存管理模块
 * 实现三层缓存架构：L1内存缓存 < 1ms，L2 localStorage < 10ms，L3服务器请求 200-500ms
 */

import { ref } from 'vue'

// 内存缓存（L1）
const memoryCache = ref(null)
const memoryCacheTime = ref(0)

export const useAssetCache = () => {
  const CACHE_KEY = 'asset_metadata'
  const CACHE_VERSION_KEY = 'asset_metadata_version'
  const CACHE_EXPIRY = 24 * 60 * 60 * 1000 // 24小时过期
  const MEMORY_CACHE_EXPIRY = 5 * 60 * 1000 // 内存缓存5分钟过期
  
  /**
   * 保存到 localStorage（L2缓存）
   */
  const saveToCache = (data) => {
    const cacheData = {
      data: data,
      timestamp: Date.now(),
      version: data.version || '3.0',
      lastUpdated: data.lastUpdated || new Date().toISOString()
    }
    
    try {
      // 直接保存 JSON
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData))
      localStorage.setItem(CACHE_VERSION_KEY, cacheData.lastUpdated)
      
      // 同时更新内存缓存
      memoryCache.value = data
      memoryCacheTime.value = Date.now()
      
      return true
    } catch (e) {
      console.warn('localStorage 存储失败:', e)
      // 存储失败时清理过期数据
      clearExpiredCache()
      return false
    }
  }
  
  /**
   * 从 localStorage 读取（L2缓存）
   */
  const getFromCache = () => {
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      if (!cached) return null
      
      // 直接解析 JSON
      const cacheData = JSON.parse(cached)
      
      // 检查是否过期
      if (Date.now() - cacheData.timestamp > CACHE_EXPIRY) {
        localStorage.removeItem(CACHE_KEY)
        localStorage.removeItem(CACHE_VERSION_KEY)
        return null
      }
      
      // 更新内存缓存
      memoryCache.value = cacheData.data
      memoryCacheTime.value = Date.now()
      
      return cacheData.data
    } catch (e) {
      console.warn('读取缓存失败:', e)
      return null
    }
  }
  
  /**
   * 从内存获取（L1缓存）
   */
  const getFromMemory = () => {
    if (!memoryCache.value) return null
    
    // 检查内存缓存是否过期
    if (Date.now() - memoryCacheTime.value > MEMORY_CACHE_EXPIRY) {
      console.log('[AssetCache] Memory cache expired, clearing')
      memoryCache.value = null
      return null
    }
    
    console.log('[AssetCache] Returning memory cache:', memoryCache.value)
    return memoryCache.value
  }
  
  /**
   * 清理过期缓存
   */
  const clearExpiredCache = () => {
    try {
      const keys = Object.keys(localStorage)
      const now = Date.now()
      
      keys.forEach(key => {
        if (key.startsWith('asset_') && key !== CACHE_KEY && key !== CACHE_VERSION_KEY) {
          try {
            const item = localStorage.getItem(key)
            const data = JSON.parse(item)
            if (data.timestamp && now - data.timestamp > CACHE_EXPIRY) {
              localStorage.removeItem(key)
            }
          } catch {
            // 解析失败的数据直接删除
            localStorage.removeItem(key)
          }
        }
      })
    } catch (e) {
      console.warn('清理缓存失败:', e)
    }
  }
  
  /**
   * 智能获取数据（仅使用本地缓存）
   * @param {boolean} forceRefresh - 是否强制刷新（此参数现在无效）
   */
  const getMetadata = async (forceRefresh = false) => {
    // 1. 优先使用内存缓存（L1 - 零延迟 < 1ms）
    const memoryData = getFromMemory()
    if (memoryData) {
      console.log('[AssetCache] L1命中 - 内存缓存')
      return memoryData
    }
    
    // 2. 尝试localStorage缓存（L2 - < 10ms）
    const cached = getFromCache()
    if (cached) {
      console.log('[AssetCache] L2命中 - localStorage缓存')
      return cached
    }
    
    // 3. 没有缓存数据，返回空
    console.log('[AssetCache] 没有找到缓存的元数据')
    return null
  }
  
  /**
   * 后台静默更新（已禁用，不再使用 API）
   */
  const checkAndUpdateInBackground = async () => {
    // 不再进行后台更新
    console.log('[AssetCache] 后台更新已禁用')
  }
  
  /**
   * 预加载缓存（应用启动时调用）
   */
  const preloadCache = async () => {
    try {
      // 尝试从localStorage加载
      const cached = getFromCache()
      if (cached) {
        console.log('[Cache] 预加载成功 - 使用本地缓存')
        // 后台更新
        checkAndUpdateInBackground()
      } else {
        // 没有缓存，从服务器加载
        console.log('[Cache] 预加载 - 从服务器获取')
        await getMetadata(true)
      }
    } catch (error) {
      console.error('[Cache] 预加载失败:', error)
    }
  }
  
  /**
   * 清除所有缓存
   */
  const clearCache = () => {
    localStorage.removeItem(CACHE_KEY)
    localStorage.removeItem(CACHE_VERSION_KEY)
    memoryCache.value = null
    memoryCacheTime.value = 0
    console.log('[Cache] 所有缓存已清除')
  }
  
  /**
   * 仅清除内存缓存
   */
  const clearMemoryCache = () => {
    memoryCache.value = null
    memoryCacheTime.value = 0
    console.log('[Cache] 内存缓存已清除')
  }
  
  /**
   * 获取缓存统计信息
   */
  const getCacheStats = () => {
    const hasMemoryCache = !!memoryCache.value
    const hasLocalCache = !!localStorage.getItem(CACHE_KEY)
    const cacheSize = localStorage.getItem(CACHE_KEY)?.length || 0
    
    return {
      hasMemoryCache,
      hasLocalCache,
      cacheSize,
      memoryCacheAge: hasMemoryCache ? Date.now() - memoryCacheTime.value : null,
      localCacheVersion: localStorage.getItem(CACHE_VERSION_KEY)
    }
  }
  
  return {
    getMetadata,
    saveToCache,
    getFromCache,
    getFromMemory,
    clearCache,
    clearMemoryCache,
    clearExpiredCache,
    checkAndUpdateInBackground,
    preloadCache,
    getCacheStats
  }
}