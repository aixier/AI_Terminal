#!/usr/bin/env node

/**
 * WebSocket连接测试脚本
 * 测试不同的URL和端口组合
 */

import { io } from 'socket.io-client'
import axios from 'axios'
import WebSocket from 'ws'

// 测试配置
const testConfigs = [
  {
    name: '本地服务',
    baseUrl: 'http://localhost:3000',
    socketioUrl: 'http://localhost:3000',
    wsUrl: 'ws://localhost:3000/ws/terminal',
    testApi: true,
    testSocketIO: true,
    testWebSocket: true
  },
  {
    name: '域名80端口',
    baseUrl: 'http://card.paitongai.com',
    socketioUrl: 'http://card.paitongai.com',
    wsUrl: 'ws://card.paitongai.com/ws/terminal',
    testApi: true,
    testSocketIO: true,
    testWebSocket: true
  },
  {
    name: 'IP地址80端口',
    baseUrl: 'http://8.130.86.152',
    socketioUrl: 'http://8.130.86.152',
    wsUrl: 'ws://8.130.86.152/ws/terminal',
    testApi: true,
    testSocketIO: true,
    testWebSocket: true
  },
  {
    name: 'IP地址3000端口',
    baseUrl: 'http://8.130.86.152:3000',
    socketioUrl: 'http://8.130.86.152:3000',
    wsUrl: 'ws://8.130.86.152:3000/ws/terminal',
    testApi: true,
    testSocketIO: true,
    testWebSocket: true
  },
  {
    name: '域名3000端口',
    baseUrl: 'http://card.paitongai.com:3000',
    socketioUrl: 'http://card.paitongai.com:3000',
    wsUrl: 'ws://card.paitongai.com:3000/ws/terminal',
    testApi: true,
    testSocketIO: true,
    testWebSocket: true
  }
]

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

// 测试API连接
async function testApiConnection(config) {
  log(`\n  📡 测试API连接: ${config.baseUrl}`, 'cyan')
  
  try {
    // 测试健康检查
    const healthUrl = `${config.baseUrl}/api/terminal/health`
    log(`     GET ${healthUrl}`)
    
    const response = await axios.get(healthUrl, { timeout: 5000 })
    
    if (response.status === 200) {
      log(`     ✅ API连接成功 (${response.status})`, 'green')
      
      // 测试登录
      try {
        const loginUrl = `${config.baseUrl}/api/auth/login`
        log(`     POST ${loginUrl}`)
        
        const loginResponse = await axios.post(loginUrl, {
          username: 'admin',
          password: 'admin123'
        }, { timeout: 5000 })
        
        if (loginResponse.data.code === 200) {
          log(`     ✅ 登录测试成功`, 'green')
        } else {
          log(`     ⚠️ 登录失败: ${loginResponse.data.message}`, 'yellow')
        }
      } catch (loginErr) {
        log(`     ❌ 登录测试失败: ${loginErr.message}`, 'red')
      }
      
      return true
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      log(`     ❌ 连接被拒绝 - 服务未运行或端口未开放`, 'red')
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      log(`     ❌ 连接超时 - 可能是防火墙阻止或网络不通`, 'red')
    } else if (error.response) {
      log(`     ❌ 服务器错误: ${error.response.status} ${error.response.statusText}`, 'red')
    } else {
      log(`     ❌ 连接失败: ${error.message}`, 'red')
    }
    return false
  }
}

// 测试Socket.IO连接
async function testSocketIOConnection(config) {
  log(`\n  🔌 测试Socket.IO连接: ${config.socketioUrl}`, 'cyan')
  
  return new Promise((resolve) => {
    log(`     连接到: ${config.socketioUrl}/socket.io`)
    
    const socket = io(config.socketioUrl, {
      transports: ['polling', 'websocket'],
      timeout: 5000,
      reconnection: false
    })
    
    const timeout = setTimeout(() => {
      log(`     ❌ Socket.IO连接超时 (5秒)`, 'red')
      socket.disconnect()
      resolve(false)
    }, 5000)
    
    socket.on('connect', () => {
      clearTimeout(timeout)
      log(`     ✅ Socket.IO连接成功`, 'green')
      log(`     📝 Socket ID: ${socket.id}`, 'green')
      
      // 测试终端创建
      socket.emit('terminal:create', {
        cols: 80,
        rows: 24
      })
      
      socket.on('terminal:created', (data) => {
        log(`     ✅ 终端创建成功: ${data.id}`, 'green')
        socket.disconnect()
        resolve(true)
      })
      
      socket.on('terminal:error', (error) => {
        log(`     ⚠️ 终端错误: ${error}`, 'yellow')
        socket.disconnect()
        resolve(true) // 连接成功但终端创建失败
      })
      
      // 3秒后如果没有响应，断开连接
      setTimeout(() => {
        log(`     ⚠️ 终端创建无响应`, 'yellow')
        socket.disconnect()
        resolve(true) // 连接成功
      }, 3000)
    })
    
    socket.on('connect_error', (error) => {
      clearTimeout(timeout)
      if (error.type === 'TransportError') {
        log(`     ❌ 传输错误 - 可能是CORS问题或服务不可达`, 'red')
      } else {
        log(`     ❌ 连接错误: ${error.message}`, 'red')
      }
      socket.disconnect()
      resolve(false)
    })
    
    socket.on('error', (error) => {
      clearTimeout(timeout)
      log(`     ❌ Socket错误: ${error}`, 'red')
      socket.disconnect()
      resolve(false)
    })
  })
}

// 测试原生WebSocket连接
async function testWebSocketConnection(config) {
  log(`\n  🌐 测试原生WebSocket连接: ${config.wsUrl}`, 'cyan')
  
  return new Promise((resolve) => {
    log(`     连接到: ${config.wsUrl}`)
    
    let ws
    try {
      ws = new WebSocket(config.wsUrl)
    } catch (error) {
      log(`     ❌ 无法创建WebSocket: ${error.message}`, 'red')
      resolve(false)
      return
    }
    
    const timeout = setTimeout(() => {
      log(`     ❌ WebSocket连接超时 (5秒)`, 'red')
      ws.close()
      resolve(false)
    }, 5000)
    
    ws.on('open', () => {
      clearTimeout(timeout)
      log(`     ✅ WebSocket连接成功`, 'green')
      
      // 发送测试消息
      const testMessage = JSON.stringify({
        type: 'init',
        cols: 80,
        rows: 24
      })
      ws.send(testMessage)
      log(`     📤 发送测试消息: ${testMessage}`, 'blue')
      
      // 等待响应
      setTimeout(() => {
        log(`     ⚠️ 无响应，关闭连接`, 'yellow')
        ws.close()
        resolve(true) // 连接成功
      }, 2000)
    })
    
    ws.on('message', (data) => {
      log(`     📥 收到消息: ${data.toString().substring(0, 100)}...`, 'green')
      ws.close()
      resolve(true)
    })
    
    ws.on('error', (error) => {
      clearTimeout(timeout)
      if (error.code === 'ECONNREFUSED') {
        log(`     ❌ 连接被拒绝`, 'red')
      } else if (error.code === 'ETIMEDOUT') {
        log(`     ❌ 连接超时`, 'red')
      } else {
        log(`     ❌ WebSocket错误: ${error.message}`, 'red')
      }
      resolve(false)
    })
    
    ws.on('close', () => {
      clearTimeout(timeout)
    })
  })
}

// 主测试函数
async function runTests() {
  log('========================================', 'bright')
  log('WebSocket 连接测试工具', 'bright')
  log('========================================', 'bright')
  log(`测试时间: ${new Date().toLocaleString()}`)
  log('')
  
  const results = []
  
  for (const config of testConfigs) {
    log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'blue')
    log(`测试: ${config.name}`, 'bright')
    log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'blue')
    
    let apiSuccess = false
    let socketIOSuccess = false
    let wsSuccess = false
    
    if (config.testApi) {
      apiSuccess = await testApiConnection(config)
    }
    
    if (config.testSocketIO) {
      socketIOSuccess = await testSocketIOConnection(config)
    }
    
    if (config.testWebSocket) {
      wsSuccess = await testWebSocketConnection(config)
    }
    
    results.push({
      name: config.name,
      url: config.baseUrl,
      api: apiSuccess,
      socketio: socketIOSuccess,
      websocket: wsSuccess
    })
  }
  
  // 显示测试结果总结
  log('\n\n========================================', 'bright')
  log('测试结果总结', 'bright')
  log('========================================', 'bright')
  
  console.table(results.map(r => ({
    '配置名称': r.name,
    'URL': r.url,
    'API': r.api ? '✅ 成功' : '❌ 失败',
    'Socket.IO': r.socketio ? '✅ 成功' : '❌ 失败',
    'WebSocket': r.websocket ? '✅ 成功' : '❌ 失败'
  })))
  
  // 推荐配置
  const working = results.filter(r => r.api && (r.socketio || r.websocket))
  if (working.length > 0) {
    log('\n✅ 可用的配置:', 'green')
    working.forEach(w => {
      log(`   - ${w.name}: ${w.url}`, 'green')
    })
  } else {
    log('\n❌ 没有找到完全可用的配置', 'red')
    
    const apiWorking = results.filter(r => r.api)
    if (apiWorking.length > 0) {
      log('\n⚠️ API可用但WebSocket不可用:', 'yellow')
      apiWorking.forEach(w => {
        if (!w.socketio && !w.websocket) {
          log(`   - ${w.name}: ${w.url}`, 'yellow')
        }
      })
    }
  }
  
  log('\n建议:', 'cyan')
  if (results.some(r => r.url.includes(':3000') && !r.api)) {
    log('  - 端口3000无法访问，请检查防火墙设置或frp配置', 'yellow')
  }
  if (results.some(r => r.api && !r.socketio && !r.websocket)) {
    log('  - API可用但WebSocket不可用，可能是CORS或WebSocket升级问题', 'yellow')
  }
  if (results.some(r => r.socketio && !r.websocket)) {
    log('  - Socket.IO可用但原生WebSocket不可用，后端可能只支持Socket.IO', 'yellow')
  }
  if (results.some(r => !r.socketio && r.websocket)) {
    log('  - 原生WebSocket可用但Socket.IO不可用，后端可能只支持原生WebSocket', 'yellow')
  }
  
  process.exit(0)
}

// 运行测试
runTests().catch(error => {
  log(`\n测试失败: ${error.message}`, 'red')
  process.exit(1)
})