/**
 * 简化版 API 配置（单机同源部署）
 * - 统一通过同源的 /api 访问后端
 * - WebSocket 走同源（Socket.IO 默认路径）
 */

// 获取 API 基础 URL（同源）
export const getApiBaseUrl = () => '/api'

// 获取 WebSocket 基础 URL（同源）
// 支持Docker部署时的端口映射（如6003:6000）
export const getWsUrl = () => {
  // 使用当前页面的协议和主机，确保端口正确
  const origin = window.location.origin
  console.log('[API Config] WebSocket URL:', origin)
  return origin
}

// 为兼容旧代码的导出（不再支持多服务器切换）
export const API_BASE_URL = getApiBaseUrl()
export const WS_BASE_URL = getWsUrl()

// 占位导出，避免旧 import 报错（不再使用）
export const API_SERVERS = {}
export const getCurrentServer = () => ({ name: '同源', url: window.location.origin, ws: window.location.origin })
export const switchServer = async () => true