/**
 * Terminal Service Factory
 * 同机同源部署：始终使用 Socket.IO 实现
 */

import terminalService from './terminalService'

class TerminalServiceFactory {
  static getService() {
    return terminalService
  }
  static createService() {
    // 返回新的实例（如需多实例）
    const TerminalService = require('./terminalService').default.constructor
    return new TerminalService()
  }
  static getProtocol() {
    return 'socket.io'
  }
  static isSupported() {
    return !!window.WebSocket
  }
}

export default TerminalServiceFactory