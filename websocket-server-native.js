#!/usr/bin/env node

/**
 * 原生 WebSocket 服务器示例
 * 用于配合 xterm.js 使用
 */

import { WebSocketServer } from 'ws';
import pty from 'node-pty';
import http from 'http';

const PORT = process.env.PORT || 3002;

// 创建 HTTP 服务器
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('WebSocket Terminal Server\n');
});

// 创建 WebSocket 服务器
const wss = new WebSocketServer({ 
    server,
    path: '/terminal'
});

// 终端会话管理
const sessions = new Map();

wss.on('connection', (ws, req) => {
    console.log(`[${new Date().toISOString()}] 新的 WebSocket 连接`);
    
    let ptyProcess = null;
    const sessionId = Math.random().toString(36).substring(7);
    
    // 处理客户端消息
    ws.on('message', (message) => {
        try {
            const msg = JSON.parse(message.toString());
            
            switch (msg.type) {
                case 'init':
                    // 创建终端进程
                    console.log(`[${sessionId}] 初始化终端: ${msg.cols}x${msg.rows}`);
                    
                    ptyProcess = pty.spawn(process.platform === 'win32' ? 'cmd.exe' : 'bash', [], {
                        name: 'xterm-color',
                        cols: msg.cols || 80,
                        rows: msg.rows || 24,
                        cwd: process.env.HOME,
                        env: process.env
                    });
                    
                    sessions.set(sessionId, ptyProcess);
                    
                    // 终端输出 -> WebSocket
                    ptyProcess.onData((data) => {
                        if (ws.readyState === ws.OPEN) {
                            ws.send(JSON.stringify({
                                type: 'output',
                                data: data
                            }));
                        }
                    });
                    
                    // 终端退出
                    ptyProcess.onExit(({ exitCode, signal }) => {
                        console.log(`[${sessionId}] 终端退出: ${exitCode}/${signal}`);
                        if (ws.readyState === ws.OPEN) {
                            ws.send(JSON.stringify({
                                type: 'exit',
                                code: exitCode,
                                signal: signal
                            }));
                            ws.close();
                        }
                        sessions.delete(sessionId);
                    });
                    
                    break;
                    
                case 'input':
                    // 用户输入 -> 终端
                    if (ptyProcess) {
                        ptyProcess.write(msg.data);
                    }
                    break;
                    
                case 'resize':
                    // 调整终端大小
                    if (ptyProcess) {
                        console.log(`[${sessionId}] 调整大小: ${msg.cols}x${msg.rows}`);
                        ptyProcess.resize(msg.cols, msg.rows);
                    }
                    break;
                    
                default:
                    console.log(`[${sessionId}] 未知消息类型: ${msg.type}`);
            }
        } catch (error) {
            console.error(`[${sessionId}] 处理消息错误:`, error);
        }
    });
    
    // 连接关闭
    ws.on('close', (code, reason) => {
        console.log(`[${sessionId}] WebSocket 关闭: ${code} - ${reason}`);
        if (ptyProcess) {
            ptyProcess.kill();
            sessions.delete(sessionId);
        }
    });
    
    // 错误处理
    ws.on('error', (error) => {
        console.error(`[${sessionId}] WebSocket 错误:`, error);
    });
    
    // 发送欢迎消息
    ws.send(JSON.stringify({
        type: 'output',
        data: '\x1b[32m欢迎使用 WebSocket 终端!\x1b[0m\r\n'
    }));
});

// 启动服务器
server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 原生 WebSocket 终端服务器`);
    console.log(`监听端口: ${PORT}`);
    console.log(`WebSocket 路径: ws://localhost:${PORT}/terminal`);
    console.log(`\n等待连接...\n`);
});

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\n正在关闭服务器...');
    
    // 关闭所有终端会话
    sessions.forEach((pty, id) => {
        console.log(`关闭会话: ${id}`);
        pty.kill();
    });
    
    wss.close(() => {
        server.close(() => {
            console.log('服务器已关闭');
            process.exit(0);
        });
    });
});