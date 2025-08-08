/**
 * Terminal Service Factory
 * 根据服务器配置自动选择合适的终端服务
 */

import terminalService from './terminalService' // Socket.IO实现
import nativeWebSocketService from './nativeWebSocketService' // 原生WebSocket实现
import { getCurrentServer } from '../config/api.config'

class TerminalServiceFactory {
  /**
   * 获取合适的终端服务实例
   * @returns {Object} 终端服务实例
   */
  static getService() {
    const server = getCurrentServer()
    const protocol = server.protocol || 'socket.io'
    
    console.log(`[TerminalServiceFactory] Server: ${server.name}, Protocol: ${protocol}`)
    
    // 根据协议选择服务
    switch (protocol) {
      case 'websocket':
        console.log('[TerminalServiceFactory] Using Native WebSocket Service')
        return nativeWebSocketService
        
      case 'socket.io':
      default:
        console.log('[TerminalServiceFactory] Using Socket.IO Service')
        return terminalService
    }
  }
  
  /**
   * 创建终端服务实例（非单例）
   * @returns {Object} 新的终端服务实例
   */
  static createService() {
    const server = getCurrentServer()
    const protocol = server.protocol || 'socket.io'
    
    if (protocol === 'websocket') {
      // 动态导入以创建新实例
      const NativeWebSocketService = require('./nativeWebSocketService').default.constructor
      return new NativeWebSocketService()
    } else {
      const TerminalService = require('./terminalService').default.constructor
      return new TerminalService()
    }
  }
  
  /**
   * 获取当前协议类型
   * @returns {string} 协议类型
   */
  static getProtocol() {
    const server = getCurrentServer()
    return server.protocol || 'socket.io'
  }
  
  /**
   * 检查是否支持当前环境
   * @returns {boolean} 是否支持
   */
  static isSupported() {
    // 检查浏览器是否支持WebSocket
    if (!window.WebSocket) {
      console.error('[TerminalServiceFactory] WebSocket not supported')
      return false
    }
    
    return true
  }
}

export default TerminalServiceFactory