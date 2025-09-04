import { ref } from 'vue'
import { assetsApi } from '../api/assets'

export function useAssets() {
  const assets = ref([])
  const categories = ref([])
  const categoryTree = ref([])
  const loading = ref(false)
  const error = ref(null)
  const pagination = ref({
    page: 1,
    limit: 50,
    total: 0,
    hasMore: false
  })

  // 获取素材列表
  const fetchAssets = async (params = {}) => {
    loading.value = true
    error.value = null
    
    try {
      const response = await assetsApi.getAssets({
        page: pagination.value.page,
        limit: pagination.value.limit,
        ...params
      })
      
      if (response.data.success) {
        assets.value = response.data.data.assets || []
        pagination.value.total = response.data.data.total || 0
        pagination.value.hasMore = response.data.data.hasMore || false
      }
    } catch (err) {
      error.value = err.message
      console.error('Failed to fetch assets:', err)
    } finally {
      loading.value = false
    }
  }

  // 获取分类列表
  const fetchCategories = async () => {
    loading.value = true
    error.value = null
    
    try {
      const response = await assetsApi.getCategories()
      
      if (response.data.success) {
        categories.value = response.data.data.categories || {}
        categoryTree.value = response.data.data.tree || []
      }
    } catch (err) {
      error.value = err.message
      console.error('Failed to fetch categories:', err)
    } finally {
      loading.value = false
    }
  }

  // 上传素材
  const uploadAssets = async (files, category = '') => {
    const formData = new FormData()
    
    files.forEach(file => {
      formData.append('files', file)
    })
    
    if (category) {
      formData.append('category', category)
    }
    
    const response = await assetsApi.uploadAssets(formData)
    
    if (response.data.success) {
      await refreshAssets()
      return response.data.data
    } else {
      throw new Error(response.data.message || '上传失败')
    }
  }

  // 创建分类
  const createCategory = async (categoryData) => {
    const response = await assetsApi.createCategory(categoryData)
    
    if (response.data.success) {
      await refreshCategories()
      return response.data.data
    } else {
      throw new Error(response.data.message || '创建分类失败')
    }
  }

  // 更新分类
  const updateCategory = async (categoryKey, updates) => {
    const response = await assetsApi.updateCategory(categoryKey, updates)
    
    if (response.data.success) {
      await refreshCategories()
      return response.data.data
    } else {
      throw new Error(response.data.message || '更新分类失败')
    }
  }

  // 删除素材
  const deleteAssets = async (assetIds) => {
    const promises = assetIds.map(id => assetsApi.deleteAsset(id))
    await Promise.all(promises)
    await refreshAssets()
  }

  // 删除分类
  const deleteCategories = async (categoryKeys) => {
    const promises = categoryKeys.map(key => assetsApi.deleteCategory(key))
    await Promise.all(promises)
    await refreshFolders()
  }

  // 移动项目
  const moveItems = async (items, targetCategory) => {
    const response = await assetsApi.moveItems({
      items: items.map(item => ({
        id: item.id,
        type: item.type || 'asset'
      })),
      targetCategory
    })
    
    if (response.data.success) {
      await refreshAssets()
      await refreshCategories()
      return response.data.data
    } else {
      throw new Error(response.data.message || '移动失败')
    }
  }

  // 重命名项目
  const renameItem = async (item, newName) => {
    if (item.type === 'category') {
      return await updateCategory(item.key, { label: newName })
    } else {
      const response = await assetsApi.updateAsset(item.id, { name: newName })
      
      if (response.data.success) {
        await refreshAssets()
        return response.data.data
      } else {
        throw new Error(response.data.message || '重命名失败')
      }
    }
  }

  // 刷新素材列表
  const refreshAssets = async () => {
    await fetchAssets()
  }

  // 刷新分类列表
  const refreshCategories = async () => {
    await fetchCategories()
  }

  // 加载更多
  const loadMore = async () => {
    if (!pagination.value.hasMore) return
    
    pagination.value.page++
    
    const response = await assetsApi.getAssets({
      page: pagination.value.page,
      limit: pagination.value.limit
    })
    
    if (response.data.success) {
      assets.value.push(...(response.data.data.assets || []))
      pagination.value.hasMore = response.data.data.hasMore || false
    }
  }

  // 获取存储信息
  const getStorageInfo = async () => {
    try {
      const response = await assetsApi.getStorageInfo()
      if (response.data.success) {
        return response.data.data
      }
    } catch (err) {
      console.error('Failed to fetch storage info:', err)
    }
    return null
  }

  return {
    assets,
    categories,
    categoryTree,
    loading,
    error,
    pagination,
    fetchAssets,
    fetchCategories,
    uploadAssets,
    createCategory,
    updateCategory,
    deleteAssets,
    deleteCategories,
    moveItems,
    renameItem,
    refreshAssets,
    refreshCategories,
    loadMore,
    getStorageInfo
  }
}