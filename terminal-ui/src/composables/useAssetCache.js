/**
 * 素材缓存管理模块
 * 实现三层缓存架构：L1内存缓存 < 1ms，L2 localStorage < 10ms，L3服务器请求 200-500ms
 */

import { ref } from 'vue'
import { assetsApiV2 } from '@/api/assetsV2'

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
    console.log('[asset_metadata_debug] Saving to cache, data:', data)
    console.log('[asset_metadata_debug] Data has workspace:', !!data.workspace)
    console.log('[asset_metadata_debug] Workspace keys:', data.workspace ? Object.keys(data.workspace) : 'none')
    console.log('[asset_metadata_debug] Assets keys:', Object.keys(data.assets || {}))

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

      console.log('[asset_metadata_debug] Successfully saved to localStorage')
      return true
    } catch (e) {
      console.warn('[asset_metadata_debug] localStorage save failed:', e)
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
   * 智能获取数据（支持从服务器获取）
   * @param {boolean} forceRefresh - 是否强制刷新
   */
  const getMetadata = async (forceRefresh = false) => {
    console.log('[asset_metadata_debug] getMetadata called, forceRefresh:', forceRefresh)

    // 如果不强制刷新，尝试使用缓存
    if (!forceRefresh) {
      // 1. 优先使用内存缓存（L1 - 零延迟 < 1ms）
      const memoryData = getFromMemory()
      if (memoryData) {
        console.log('[asset_metadata_debug] L1 hit - checking memory cache')
        console.log('[asset_metadata_debug] Memory cache has workspace:', !!memoryData.workspace)

        // 检查缓存数据是否有效（不为空）
        const hasContent = memoryData.assets && Object.keys(memoryData.assets).length > 0
        if (hasContent) {
          console.log('[asset_metadata_debug] Memory cache has content, returning')
          return memoryData
        } else {
          console.log('[asset_metadata_debug] Memory cache is empty, will fetch from server')
          // 清除无效的内存缓存
          memoryCache.value = null
        }
      }

      // 2. 尝试localStorage缓存（L2 - < 10ms）
      const cached = getFromCache()
      if (cached) {
        console.log('[asset_metadata_debug] L2 hit - checking localStorage cache')
        console.log('[asset_metadata_debug] localStorage cache has workspace:', !!cached.workspace)

        // 检查缓存数据是否有效（不为空）
        const hasContent = cached.assets && Object.keys(cached.assets).length > 0
        if (hasContent) {
          console.log('[asset_metadata_debug] localStorage cache has content, returning')
          return cached
        } else {
          console.log('[asset_metadata_debug] localStorage cache is empty, will fetch from server')
          // 清除无效的缓存
          localStorage.removeItem(CACHE_KEY)
          localStorage.removeItem(CACHE_VERSION_KEY)
        }
      }
    }

    // 3. 从服务器获取（L3 - 200-500ms）
    try {
      console.log('[asset_metadata_debug] L3 request - fetching from server')
      const response = await assetsApiV2.getMetadata()
      console.log('[asset_metadata_debug] Server response:', response)

      if (response.data && response.data.success) {
        const metadata = response.data.data
        console.log('[asset_metadata_debug] Server metadata received:', metadata)
        console.log('[asset_metadata_debug] Server metadata has workspace:', !!metadata.workspace)
        console.log('[asset_metadata_debug] Server workspace keys:', metadata.workspace ? Object.keys(metadata.workspace) : 'none')
        console.log('[asset_metadata_debug] Server assets keys:', Object.keys(metadata.assets || {}))

        // 保存到缓存
        saveToCache(metadata)

        console.log('[asset_metadata_debug] Server data cached successfully')
        return metadata
      }
    } catch (error) {
      console.error('[asset_metadata_debug] Server fetch failed:', error)
    }

    // 4. 所有方法都失败，返回空
    console.log('[asset_metadata_debug] All methods failed, returning null')
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