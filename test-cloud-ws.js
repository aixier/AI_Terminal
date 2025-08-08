#!/usr/bin/env node

/**
 * 云端WebSocket测试工具
 * 专门测试阿里云FC的WebSocket支持
 */

const WebSocket = require('ws');
const chalk = require('chalk');

const CLOUD_URL = 'http://ai-terminal-xnbmzvtedv.ap-northeast-1.fcapp.run';

console.log(chalk.cyan.bold('\n🚀 阿里云FC WebSocket测试'));
console.log(chalk.gray('=' .repeat(60)));
console.log(chalk.yellow('服务器:'), CLOUD_URL);
console.log(chalk.yellow('时间:'), new Date().toLocaleString());
console.log(chalk.gray('=' .repeat(60)) + '\n');

// WebSocket基础URL（不包含http://）
const WS_BASE_URL = 'ws://ai-terminal-xnbmzvtedv.ap-northeast-1.fcapp.run';

// 测试不同的WebSocket端点
const endpoints = [
    {
        name: '原生WebSocket端点',
        url: `${WS_BASE_URL}/ws/terminal`,
        protocol: 'native'
    },
    {
        name: 'Socket.IO端点',
        url: `${WS_BASE_URL}/socket.io/?EIO=4&transport=websocket`,
        protocol: 'socket.io'
    }
];

async function testEndpoint(endpoint) {
    console.log(chalk.blue(`\n测试: ${endpoint.name}`));
    console.log(chalk.gray(`URL: ${endpoint.url}`));
    console.log(chalk.gray('-'.repeat(40)));
    
    return new Promise((resolve) => {
        let ws;
        let connected = false;
        
        const timeout = setTimeout(() => {
            if (!connected) {
                console.log(chalk.red('  ✗ 连接超时 (10秒)'));
                if (ws) ws.close();
                resolve(false);
            }
        }, 10000);
        
        try {
            // 添加必要的请求头
            const options = {
                headers: {
                    'Date': new Date().toUTCString(),
                    'User-Agent': 'AI-Terminal-Test/1.0'
                }
            };
            
            ws = new WebSocket(endpoint.url, options);
            
            ws.on('open', () => {
                connected = true;
                clearTimeout(timeout);
                console.log(chalk.green('  ✓ WebSocket连接成功！'));
                
                // 根据协议发送不同的初始化消息
                if (endpoint.protocol === 'native') {
                    // 原生WebSocket协议
                    ws.send(JSON.stringify({
                        type: 'init',
                        cols: 80,
                        rows: 24
                    }));
                } else {
                    // Socket.IO协议
                    ws.send('2probe');
                }
                
                // 等待响应
                setTimeout(() => {
                    ws.close();
                    resolve(true);
                }, 2000);
            });
            
            ws.on('message', (data) => {
                const dataStr = data.toString();
                console.log(chalk.cyan(`  📥 收到消息: ${dataStr.substring(0, 100)}${dataStr.length > 100 ? '...' : ''}`));
                
                // 解析消息
                try {
                    const msg = JSON.parse(dataStr);
                    if (msg.type) {
                        console.log(chalk.green(`     消息类型: ${msg.type}`));
                    }
                } catch {
                    // 不是JSON格式
                }
            });
            
            ws.on('error', (error) => {
                clearTimeout(timeout);
                console.log(chalk.red(`  ✗ 错误: ${error.message}`));
                
                // 分析错误原因
                if (error.message.includes('400')) {
                    console.log(chalk.yellow('    可能原因: 缺少必需的请求头'));
                } else if (error.message.includes('403')) {
                    console.log(chalk.yellow('    可能原因: 认证失败'));
                } else if (error.message.includes('404')) {
                    console.log(chalk.yellow('    可能原因: 端点不存在'));
                } else if (error.message.includes('ECONNREFUSED')) {
                    console.log(chalk.yellow('    可能原因: 服务器未启动或端口错误'));
                }
                
                resolve(false);
            });
            
            ws.on('close', (code, reason) => {
                if (connected) {
                    console.log(chalk.gray(`  连接关闭: ${code} - ${reason || '正常关闭'}`));
                }
            });
            
        } catch (error) {
            clearTimeout(timeout);
            console.log(chalk.red(`  ✗ 创建WebSocket失败: ${error.message}`));
            resolve(false);
        }
    });
}

// 测试HTTP端点
async function testHttpEndpoints() {
    console.log(chalk.blue('\n测试HTTP端点'));
    console.log(chalk.gray('-'.repeat(40)));
    
    const http = require('http');
    const endpoints = [
        '/health',
        '/api/ws/status',
        '/api/terminal/health'
    ];
    
    for (const endpoint of endpoints) {
        const url = `${CLOUD_URL}${endpoint}`;
        console.log(`\n  ${endpoint}:`);
        
        await new Promise((resolve) => {
            const options = {
                headers: {
                    'Date': new Date().toUTCString()
                }
            };
            
            http.get(url, options, (res) => {
                console.log(chalk.green(`    状态码: ${res.statusCode}`));
                
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        try {
                            const json = JSON.parse(data);
                            console.log(chalk.gray(`    响应: ${JSON.stringify(json).substring(0, 100)}...`));
                        } catch {
                            console.log(chalk.gray(`    响应: ${data.substring(0, 100)}...`));
                        }
                    } else {
                        console.log(chalk.yellow(`    错误: ${data}`));
                    }
                    resolve();
                });
            }).on('error', (err) => {
                console.log(chalk.red(`    ✗ 请求失败: ${err.message}`));
                resolve();
            });
        });
    }
}

// 主函数
async function main() {
    let successCount = 0;
    
    // 测试WebSocket端点
    for (const endpoint of endpoints) {
        const success = await testEndpoint(endpoint);
        if (success) successCount++;
    }
    
    // 测试HTTP端点
    await testHttpEndpoints();
    
    // 总结
    console.log(chalk.cyan('\n' + '=' .repeat(60)));
    console.log(chalk.cyan.bold('测试总结'));
    console.log(chalk.cyan('=' .repeat(60)));
    
    if (successCount > 0) {
        console.log(chalk.green(`✅ ${successCount}/${endpoints.length} 个WebSocket端点连接成功`));
    } else {
        console.log(chalk.red('❌ 所有WebSocket端点连接失败'));
        
        console.log(chalk.yellow('\n可能的解决方案:'));
        console.log('1. 确认阿里云FC已启用WebSocket支持');
        console.log('2. 检查FC函数的触发器配置');
        console.log('3. 确认使用了自定义运行时');
        console.log('4. 检查认证和签名配置');
        console.log('5. 查看FC函数日志了解详细错误');
    }
    
    console.log(chalk.gray('\n测试完成'));
}

// 检查依赖
function checkDependencies() {
    const deps = ['ws', 'chalk'];
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