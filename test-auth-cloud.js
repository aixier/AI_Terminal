#!/usr/bin/env node

/**
 * 云端认证测试工具
 * 测试阿里云FC的认证和WebSocket连接
 */

const axios = require('axios');
const WebSocket = require('ws');
const chalk = require('chalk');

// 配置
const CLOUD_URL = 'http://ai-terminal-xnbmzvtedv.ap-northeast-1.fcapp.run';
const LOCAL_URL = 'http://localhost:3000';

// 认证信息
const AUTH_CREDENTIALS = {
    username: 'admin',
    password: 'admin123'
};

class AuthTester {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
        this.token = null;
        this.isCloud = baseUrl.includes('fcapp.run');
    }

    log(message, type = 'info') {
        const prefix = {
            info: chalk.blue('[INFO]'),
            success: chalk.green('[✓]'),
            error: chalk.red('[✗]'),
            warning: chalk.yellow('[⚠]')
        };
        console.log(`${prefix[type]} ${message}`);
    }

    // 步骤1: 登录获取JWT Token
    async login() {
        this.log('步骤1: 登录获取Token', 'info');
        const loginUrl = `${this.baseUrl}/api/auth/login`;
        
        try {
            const headers = {};
            
            // 云端需要Date头
            if (this.isCloud) {
                headers['Date'] = new Date().toUTCString();
            }
            
            this.log(`POST ${loginUrl}`, 'info');
            this.log(`Payload: ${JSON.stringify(AUTH_CREDENTIALS)}`, 'info');
            
            const response = await axios.post(loginUrl, AUTH_CREDENTIALS, {
                headers,
                validateStatus: () => true
            });
            
            if (response.status === 200) {
                this.token = response.data.data.token;
                this.log(`登录成功! Token: ${this.token.substring(0, 20)}...`, 'success');
                this.log(`用户: ${response.data.data.user.username}`, 'info');
                return true;
            } else {
                this.log(`登录失败: ${response.status} - ${JSON.stringify(response.data)}`, 'error');
                return false;
            }
        } catch (error) {
            this.log(`登录错误: ${error.message}`, 'error');
            return false;
        }
    }

    // 步骤2: 验证Token
    async verifyToken() {
        if (!this.token) {
            this.log('没有Token，跳过验证', 'warning');
            return false;
        }

        this.log('步骤2: 验证Token', 'info');
        const verifyUrl = `${this.baseUrl}/api/auth/verify`;
        
        try {
            const headers = {
                'Authorization': `Bearer ${this.token}`
            };
            
            if (this.isCloud) {
                headers['Date'] = new Date().toUTCString();
            }
            
            const response = await axios.get(verifyUrl, {
                headers,
                validateStatus: () => true
            });
            
            if (response.status === 200) {
                this.log('Token验证成功!', 'success');
                this.log(`Token数据: ${JSON.stringify(response.data.data)}`, 'info');
                return true;
            } else {
                this.log(`Token验证失败: ${response.status} - ${JSON.stringify(response.data)}`, 'error');
                return false;
            }
        } catch (error) {
            this.log(`验证错误: ${error.message}`, 'error');
            return false;
        }
    }

    // 步骤3: 测试需要认证的API
    async testAuthenticatedAPI() {
        if (!this.token) {
            this.log('没有Token，跳过API测试', 'warning');
            return;
        }

        this.log('步骤3: 测试需要认证的API', 'info');
        
        const endpoints = [
            '/api/terminal/health',
            '/api/terminal/sessions',
            '/api/ws/status'
        ];
        
        for (const endpoint of endpoints) {
            const url = `${this.baseUrl}${endpoint}`;
            
            try {
                const headers = {
                    'Authorization': `Bearer ${this.token}`
                };
                
                if (this.isCloud) {
                    headers['Date'] = new Date().toUTCString();
                }
                
                const response = await axios.get(url, {
                    headers,
                    validateStatus: () => true
                });
                
                if (response.status === 200) {
                    this.log(`${endpoint}: ✓ 成功`, 'success');
                } else {
                    this.log(`${endpoint}: ${response.status} - ${JSON.stringify(response.data)}`, 'warning');
                }
            } catch (error) {
                this.log(`${endpoint}: 错误 - ${error.message}`, 'error');
            }
        }
    }

    // 步骤4: 测试WebSocket连接（带Token）
    async testWebSocket() {
        this.log('步骤4: 测试WebSocket连接', 'info');
        
        const wsUrl = this.baseUrl.replace('http://', 'ws://') + '/ws/terminal';
        this.log(`WebSocket URL: ${wsUrl}`, 'info');
        
        return new Promise((resolve) => {
            const options = {};
            
            // 添加认证头
            if (this.token) {
                options.headers = {
                    'Authorization': `Bearer ${this.token}`
                };
                
                if (this.isCloud) {
                    options.headers['Date'] = new Date().toUTCString();
                }
                
                this.log('使用Token进行WebSocket认证', 'info');
            }
            
            const ws = new WebSocket(wsUrl, options);
            
            const timeout = setTimeout(() => {
                this.log('WebSocket连接超时', 'error');
                ws.close();
                resolve(false);
            }, 10000);
            
            ws.on('open', () => {
                clearTimeout(timeout);
                this.log('WebSocket连接成功!', 'success');
                
                // 发送初始化消息
                ws.send(JSON.stringify({
                    type: 'init',
                    cols: 80,
                    rows: 24
                }));
                
                setTimeout(() => {
                    ws.close();
                    resolve(true);
                }, 2000);
            });
            
            ws.on('message', (data) => {
                this.log(`收到消息: ${data.toString().substring(0, 100)}`, 'info');
            });
            
            ws.on('error', (error) => {
                clearTimeout(timeout);
                this.log(`WebSocket错误: ${error.message}`, 'error');
                resolve(false);
            });
            
            ws.on('close', (code, reason) => {
                this.log(`WebSocket关闭: ${code} - ${reason || '正常'}`, 'info');
            });
        });
    }

    // 运行完整测试
    async runFullTest() {
        console.log(chalk.cyan.bold('\n' + '='.repeat(60)));
        console.log(chalk.cyan.bold(`测试服务器: ${this.baseUrl}`));
        console.log(chalk.cyan.bold('='.repeat(60)));
        
        // 1. 登录
        const loginSuccess = await this.login();
        if (!loginSuccess && this.isCloud) {
            this.log('\n云端可能需要特殊的认证配置', 'warning');
        }
        
        // 2. 验证Token
        if (loginSuccess) {
            await this.verifyToken();
        }
        
        // 3. 测试API
        await this.testAuthenticatedAPI();
        
        // 4. 测试WebSocket
        const wsSuccess = await this.testWebSocket();
        
        // 总结
        console.log(chalk.cyan('\n' + '='.repeat(60)));
        console.log(chalk.cyan.bold('测试总结'));
        console.log(chalk.cyan('='.repeat(60)));
        
        if (loginSuccess) {
            this.log('认证流程: ✓ 成功', 'success');
        } else {
            this.log('认证流程: ✗ 失败', 'error');
        }
        
        if (wsSuccess) {
            this.log('WebSocket: ✓ 成功', 'success');
        } else {
            this.log('WebSocket: ✗ 失败', 'error');
        }
    }
}

async function main() {
    console.log(chalk.bold.cyan('\n🔐 认证和WebSocket测试工具'));
    
    const args = process.argv.slice(2);
    const testLocal = args.includes('--local');
    const testCloud = args.includes('--cloud') || !testLocal;
    
    if (testLocal) {
        console.log(chalk.yellow('\n测试本地服务器...'));
        const localTester = new AuthTester(LOCAL_URL);
        await localTester.runFullTest();
    }
    
    if (testCloud) {
        console.log(chalk.yellow('\n测试云端服务器...'));
        const cloudTester = new AuthTester(CLOUD_URL);
        await cloudTester.runFullTest();
    }
}

// 运行测试
main().catch(console.error);