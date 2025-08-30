import axios from 'axios'
import { ElMessage } from 'element-plus'
import { getApiBaseUrl } from '../config/api.config'

// 创建axios实例
const service = axios.create({
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器
service.interceptors.request.use(
  config => {
    // 动态设置baseURL
    config.baseURL = getApiBaseUrl()
    
    // 在发送请求之前做些什么
    const token = localStorage.getItem('token')
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
    }
    return config
  },
  error => {
    // 对请求错误做些什么
    console.error('Request error:', error)
    return Promise.reject(error)
  }
)

// 响应拦截器
service.interceptors.response.use(
  response => {
    // 对响应数据做点什么
    const res = response.data
    
    // 如果code存在且不是200，则判断为错误
    if (res.code && res.code !== 200) {
      ElMessage({
        message: res.message || '请求失败',
        type: 'error',
        duration: 5 * 1000
      })

      // 401: 未登录
      if (res.code === 401) {
        // 清除失效的token
        localStorage.removeItem('token')
        // 跳转到登录页
        window.location.href = '/login'
      }
      
      return Promise.reject(new Error(res.message || '请求失败'))
    } else {
      // ⚠️ 注意：这里返回res(即response.data)而不是完整的response对象
      // 这意味着调用axios.get()时，返回的response实际是原始的response.data
      // 所以前端代码应该直接使用response.success而不是response.data.success
      return res
    }
  },
  error => {
    // 对响应错误做点什么
    console.error('Response error:', error)
    
    // 检查是否是401未授权错误(token失效)
    if (error.response && error.response.status === 401) {
      // 清除失效的token
      localStorage.removeItem('token')
      // 跳转到登录页
      window.location.href = '/login'
      return Promise.reject(error)
    }
    
    // 只在不是取消请求的情况下显示错误消息
    if (error.code !== 'ECONNABORTED' && error.message !== 'Network Error') {
      ElMessage({
        message: error.message || '网络错误',
        type: 'error',
        duration: 5 * 1000
      })
    }
    return Promise.reject(error)
  }
)

// 导出API基础URL (动态获取)
export const API_BASE_URL = () => getApiBaseUrl()

// 导出配置对象
export const config = {
  apiUrl: getApiBaseUrl(),
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
}

export default service