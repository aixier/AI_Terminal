#!/usr/bin/env node

/**
 * 云端WebSocket连接测试
 * 专注测试阿里云函数计算的WebSocket服务
 */

const io = require('socket.io-client');
const chalk = require('chalk');

const CLOUD_URL = 'http://ai-terminal-xnbmzvtedv.ap-northeast-1.fcapp.run';

function log(type, message) {
    const prefix = {
        info: chalk.blue('[INFO]'),
        success: chalk.green('[✓]'),
        error: chalk.red('[✗]'),
        warning: chalk.yellow('[⚠]')
    };
    console.log(`${prefix[type]} ${message}`);
}

async function testWebSocket() {
    console.log(chalk.cyan.bold('\n🔌 云端WebSocket连接测试'));
    console.log(chalk.gray(`服务器: ${CLOUD_URL}`));
    console.log(chalk.gray(`时间: ${new Date().toLocaleString()}\n`));
    
    return new Promise((resolve) => {
        log('info', '尝试连接WebSocket...');
        
        // 尝试不同的连接配置
        const configs = [
            {
                name: '标准配置',
                options: {
                    transports: ['websocket', 'polling'],
                    reconnection: false,
                    timeout: 10000
                }
            },
            {
                name: '仅WebSocket',
                options: {
                    transports: ['websocket'],
                    reconnection: false,
                    timeout: 10000,
                    upgrade: false
                }
            },
            {
                name: '仅Polling',
                options: {
                    transports: ['polling'],
                    reconnection: false,
                    timeout: 10000
                }
            },
            {
                name: '带认证头',
                options: {
                    transports: ['websocket', 'polling'],
                    reconnection: false,
                    timeout: 10000,
                    extraHeaders: {
                        'Date': new Date().toUTCString()
                    }
                }
            }
        ];
        
        let currentConfig = 0;
        
        function tryNextConfig() {
            if (currentConfig >= configs.length) {
                console.log(chalk.red('\n所有配置都失败了'));
                resolve(false);
                return;
            }
            
            const config = configs[currentConfig];
            console.log(`\n${chalk.yellow('尝试配置:')} ${config.name}`);
            
            const socket = io(CLOUD_URL, config.options);
            
            const timeout = setTimeout(() => {
                log('error', `连接超时 (${config.name})`);
                socket.disconnect();
                currentConfig++;
                tryNextConfig();
            }, 10000);
            
            socket.on('connect', () => {
                clearTimeout(timeout);
                log('success', `WebSocket连接成功！`);
                console.log(chalk.gray(`  Socket ID: ${socket.id}`));
                console.log(chalk.gray(`  传输方式: ${socket.io.engine.transport.name}`));
                console.log(chalk.gray(`  使用配置: ${config.name}`));
                
                // 测试发送消息
                log('info', '测试发送消息...');
                
                // 尝试创建终端会话
                socket.emit('terminal:create', {
                    cols: 80,
                    rows: 24
                });
                
                // 监听响应
                socket.on('terminal:ready', (data) => {
                    log('success', '终端会话创建成功！');
                    console.log(chalk.gray(`  Terminal ID: ${data.terminalId}`));
                });
                
                socket.on('error', (error) => {
                    log('warning', `Socket错误: ${error}`);
                });
                
                // 测试几秒后断开
                setTimeout(() => {
                    log('info', '测试完成，断开连接');
                    socket.disconnect();
                    resolve(true);
                }, 3000);
            });
            
            socket.on('connect_error', (error) => {
                clearTimeout(timeout);
                log('error', `连接失败 (${config.name}): ${error.message}`);
                
                // 如果是transport error，显示更多信息
                if (error.type === 'TransportError') {
                    console.log(chalk.gray(`  错误类型: ${error.type}`));
                    console.log(chalk.gray(`  传输层: ${error.transport?.name || 'unknown'}`));
                }
                
                currentConfig++;
                tryNextConfig();
            });
            
            socket.on('disconnect', (reason) => {
                if (reason === 'io client disconnect') {
                    // 主动断开，正常
                } else {
                    log('warning', `连接断开: ${reason}`);
                }
            });
        }
        
        tryNextConfig();
    });
}

// 测试不同的URL格式
async function testDifferentUrls() {
    const urls = [
        { url: CLOUD_URL, name: 'HTTP协议' },
        { url: CLOUD_URL.replace('http://', 'ws://'), name: 'WS协议' },
        { url: `${CLOUD_URL}/socket.io`, name: 'Socket.IO路径' }
    ];
    
    console.log(chalk.cyan.bold('\n📡 测试不同的URL格式'));
    
    for (const {url, name} of urls) {
        console.log(`\n${chalk.yellow('测试:')} ${name}`);
        console.log(chalk.gray(`URL: ${url}`));
        
        const socket = io(url, {
            transports: ['websocket', 'polling'],
            reconnection: false,
            timeout: 5000
        });
        
        await new Promise((resolve) => {
            const timeout = setTimeout(() => {
                log('error', '连接超时');
                socket.disconnect();
                resolve();
            }, 5000);
            
            socket.on('connect', () => {
                clearTimeout(timeout);
                log('success', '连接成功！');
                socket.disconnect();
                resolve();
            });
            
            socket.on('connect_error', (error) => {
                clearTimeout(timeout);
                log('error', `连接失败: ${error.message}`);
                resolve();
            });
        });
    }
}

// 主函数
async function main() {
    console.log(chalk.bold.cyan('\n🚀 云端WebSocket深度测试工具'));
    console.log(chalk.gray('=' .repeat(50)));
    
    // 测试基本连接
    const connected = await testWebSocket();
    
    if (!connected) {
        // 如果基本连接失败，尝试不同的URL格式
        await testDifferentUrls();
    }
    
    console.log(chalk.gray('\n' + '=' .repeat(50)));
    console.log(chalk.cyan('测试完成！'));
    
    if (!connected) {
        console.log(chalk.yellow('\n可能的解决方案:'));
        console.log('1. 检查阿里云函数计算是否支持WebSocket');
        console.log('2. 确认服务端Socket.IO版本兼容性');
        console.log('3. 检查是否需要特殊的认证配置');
        console.log('4. 尝试使用长轮询(polling)替代WebSocket');
    }
}

// 检查依赖
function checkDependencies() {
    const deps = ['socket.io-client', 'chalk'];
    const missing = [];
    
    for (const dep of deps) {
        try {
            require.resolve(dep);
        } catch {
            missing.push(dep);
        }
    }
    
    if (missing.length > 0) {
        console.log(chalk.red('缺少依赖:'));
        console.log(chalk.yellow(`npm install ${missing.join(' ')}`));
        process.exit(1);
    }
}

checkDependencies();
main().catch(console.error);