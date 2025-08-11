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
        // 跳转到登录页
        window.location.href = '/login'
      }
      
      return Promise.reject(new Error(res.message || '请求失败'))
    } else {
      // 返回完整的响应数据，而不是只返回res
      return res
    }
  },
  error => {
    // 对响应错误做点什么
    console.error('Response error:', error)
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

export default service