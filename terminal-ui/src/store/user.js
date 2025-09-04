import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUserStore = defineStore('user', () => {
  // 用户信息
  const userInfo = ref(null)
  const isLoggedIn = ref(false)
  
  // 设置用户信息
  function setUserInfo(info) {
    userInfo.value = info
    isLoggedIn.value = !!info
    if (info) {
      localStorage.setItem('userInfo', JSON.stringify(info))
    } else {
      localStorage.removeItem('userInfo')
    }
  }
  
  // 获取用户信息
  function getUserInfo() {
    if (!userInfo.value) {
      const stored = localStorage.getItem('userInfo')
      if (stored) {
        try {
          userInfo.value = JSON.parse(stored)
          isLoggedIn.value = true
        } catch (e) {
          console.error('Failed to parse stored user info:', e)
        }
      }
    }
    return userInfo.value
  }
  
  // 清除用户信息（登出）
  function clearUserInfo() {
    userInfo.value = null
    isLoggedIn.value = false
    localStorage.removeItem('userInfo')
    localStorage.removeItem('token')
  }
  
  // 初始化时尝试恢复用户信息
  const storedInfo = localStorage.getItem('userInfo')
  if (storedInfo) {
    try {
      userInfo.value = JSON.parse(storedInfo)
      isLoggedIn.value = true
    } catch (e) {
      console.error('Failed to parse stored user info on init:', e)
    }
  }
  
  return {
    userInfo,
    isLoggedIn,
    setUserInfo,
    getUserInfo,
    clearUserInfo
  }
})