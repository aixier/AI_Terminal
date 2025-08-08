#!/usr/bin/env node

/**
 * 简单的WebSocket测试
 */

const WebSocket = require('ws');

const urls = [
    'ws://localhost:3000/ws/terminal',      // 原生WebSocket
    'ws://localhost:3000/socket.io/?EIO=4&transport=websocket', // Socket.IO
];

console.log('🧪 WebSocket端点测试\n');

urls.forEach(url => {
    console.log(`测试: ${url}`);
    
    const ws = new WebSocket(url, {
        timeout: 5000
    });
    
    ws.on('open', () => {
        console.log('  ✅ 连接成功');
        ws.close();
    });
    
    ws.on('error', (error) => {
        console.log(`  ❌ 连接失败: ${error.message}`);
    });
});

// 测试WebSocket状态API
const http = require('http');

setTimeout(() => {
    console.log('\n测试状态API:');
    http.get('http://localhost:3000/api/ws/status', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            console.log('  状态:', JSON.parse(data));
            process.exit(0);
        });
    }).on('error', (err) => {
        console.log('  ❌ API错误:', err.message);
        process.exit(1);
    });
}, 1000);