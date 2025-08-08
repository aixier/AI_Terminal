#!/usr/bin/env node

/**
 * 测试原生WebSocket连接
 */

import WebSocket from 'ws';

const SERVER_URL = 'ws://localhost:3000/ws/terminal';

console.log('🧪 测试原生WebSocket连接');
console.log(`服务器: ${SERVER_URL}`);
console.log('-'.repeat(50));

const ws = new WebSocket(SERVER_URL);

ws.on('open', () => {
    console.log('✅ WebSocket连接成功！');
    
    // 发送初始化消息
    ws.send(JSON.stringify({
        type: 'init',
        cols: 80,
        rows: 24
    }));
});

ws.on('message', (data) => {
    const message = JSON.parse(data.toString());
    console.log('📥 收到消息:', message.type);
    
    switch (message.type) {
        case 'connected':
            console.log(`   Client ID: ${message.clientId}`);
            break;
            
        case 'ready':
            console.log(`   Terminal ID: ${message.terminalId}`);
            console.log(`   PID: ${message.pid}`);
            
            // 发送测试命令
            setTimeout(() => {
                console.log('📤 发送测试命令: ls -la');
                ws.send(JSON.stringify({
                    type: 'input',
                    data: 'ls -la\r'
                }));
            }, 1000);
            
            // 5秒后关闭
            setTimeout(() => {
                console.log('👋 关闭连接');
                ws.close();
            }, 5000);
            break;
            
        case 'output':
            console.log(`   输出: ${message.data.substring(0, 50)}...`);
            break;
            
        case 'error':
            console.log(`   ❌ 错误: ${message.error}`);
            break;
    }
});

ws.on('error', (error) => {
    console.error('❌ WebSocket错误:', error.message);
});

ws.on('close', (code, reason) => {
    console.log(`🔌 连接关闭: ${code} - ${reason}`);
    process.exit(0);
});