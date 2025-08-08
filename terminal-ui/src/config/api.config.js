/**
 * API配置管理
 * 支持本地和云端多个后端地址
 */

// 后端服务器列表
export const API_SERVERS = {
  // 本地开发环境
  local: {
    name: '本地服务器',
    url: 'http://localhost:6000',
    ws: 'ws://localhost:6000',
    protocol: 'socket.io', // 使用Socket.IO
    default: true
  },
  
  // 本地Docker环境
  docker: {
    name: '本地Docker服务',
    url: 'http://localhost:6001',
    ws: 'ws://localhost:6001',
    protocol: 'socket.io', // 使用Socket.IO
    default: false
  },
  
  // FRP穿透模式（方案1：使用6000端口）
  frp: {
    name: 'FRP穿透服务(6000端口)',
    url: 'http://8.130.86.152:6000',   // API也使用IP:6000
    ws: 'ws://8.130.86.152:6000',      // 原生WebSocket使用IP:6000
    protocol: 'websocket',              // 使用原生WebSocket
    default: false,
    description: '使用原生WebSocket通过IP:6000端口直连'
  },
  
  // FRP穿透模式（方案2：使用80端口）
  frp80: {
    name: 'FRP穿透服务(80端口)',
    url: 'http://card.paitongai.com',  // 使用域名80端口
    ws: 'ws://card.paitongai.com',     // WebSocket也使用域名80端口
    protocol: 'socket.io',
    default: false,
    description: '所有服务通过域名80端口（frp HTTP代理）'
  },
  
  // 云端生产环境
  cloud: {
    name: '云端服务器',
    url: 'http://ai-terminal-xnbmzvtedv.ap-northeast-1.fcapp.run',
    ws: 'ws://ai-terminal-xnbmzvtedv.ap-northeast-1.fcapp.run',
    protocol: 'websocket', // 使用原生WebSocket
    default: false
  },
  
  // AWS云服务器
  aws: {
    name: 'AWS云服务器',
    url: 'http://3.91.230.6:6000',
    ws: 'ws://3.91.230.6:6000',
    protocol: 'socket.io',
    default: false
  }
}

// 获取当前使用的服务器配置
export const getCurrentServer = () => {
  // 优先从localStorage读取用户选择
  const savedServer = localStorage.getItem('api_server')
  if (savedServer && API_SERVERS[savedServer]) {
    return API_SERVERS[savedServer]
  }
  
  // 检查环境变量
  const envServer = import.meta.env.VITE_API_SERVER
  if (envServer && API_SERVERS[envServer]) {
    return API_SERVERS[envServer]
  }
  
  // 根据当前访问地址动态确定后端
  const hostname = window.location.hostname
  const port = window.location.port
  
  // 特殊处理：如果是通过域名或云主机IP访问
  if (hostname === 'card.paitongai.com' || hostname === '8.130.86.152') {
    // frp映射场景：使用原生WebSocket
    return {
      name: 'FRP映射服务器',
      url: `http://8.130.86.152:6000`,  // API使用IP:6000
      ws: `ws://8.130.86.152:6000`,     // 原生WebSocket使用IP:6000
      protocol: 'websocket',             // 使用原生WebSocket而不是Socket.IO
      default: false
    }
  }
  
  // AWS云服务器特殊处理
  if (hostname === '3.91.230.6') {
    return API_SERVERS.aws
  }
  
  // 如果是通过其他IP地址访问，使用相同IP的后端
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    // 如果是本地网络IP访问，使用相同主机的后端
    const backendPort = 6000 // 后端默认端口
    return {
      name: '动态服务器',
      url: `http://${hostname}:${backendPort}`,
      ws: `ws://${hostname}:${backendPort}`,
      protocol: 'socket.io',
      default: false
    }
  }
  
  // 返回默认服务器
  return Object.values(API_SERVERS).find(s => s.default) || API_SERVERS.local
}

// 切换服务器
export const switchServer = async (serverKey) => {
  if (API_SERVERS[serverKey]) {
    localStorage.setItem('api_server', serverKey)
    
    // 断开所有现有连接
    try {
      // 断开终端连接
      const terminalService = await import('../services/terminalService').then(m => m.default)
      if (terminalService && terminalService.isConnected) {
        terminalService.disconnect()
      }
      
      // 断开SSE连接
      const sseService = await import('../services/sseService').then(m => m.default)
      if (sseService && sseService.isConnected) {
        sseService.disconnect()
      }
    } catch (error) {
      console.error('Error disconnecting services:', error)
    }
    
    // 刷新页面以应用新配置
    window.location.reload()
    return true
  }
  return false
}

// 获取API基础URL
export const getApiBaseUrl = () => {
  const server = getCurrentServer()
  return `${server.url}/api`
}

// 获取WebSocket URL
export const getWsUrl = () => {
  const server = getCurrentServer()
  return server.ws
}

// 导出当前配置
export const API_BASE_URL = getApiBaseUrl()
export const WS_BASE_URL = getWsUrl()