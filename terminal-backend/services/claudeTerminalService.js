const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs-extra');

class ClaudeTerminalService {
  constructor() {
    this.claudeProcess = null;
    this.isClaudeRunning = false;
  }

  /**
   * 启动Claude Code CLI
   */
  async startClaude() {
    if (this.isClaudeRunning) {
      console.log('Claude Code is already running');
      return;
    }

    try {
      console.log('Starting Claude Code CLI...');
      this.claudeProcess = spawn('claude', [], {
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.claudeProcess.stdout.on('data', (data) => {
        console.log(`Claude stdout: ${data}`);
      });

      this.claudeProcess.stderr.on('data', (data) => {
        console.error(`Claude stderr: ${data}`);
      });

      this.claudeProcess.on('close', (code) => {
        console.log(`Claude process exited with code ${code}`);
        this.isClaudeRunning = false;
      });

      this.isClaudeRunning = true;
      console.log('Claude Code CLI started successfully');
    } catch (error) {
      console.error('Failed to start Claude Code:', error);
      throw error;
    }
  }

  /**
   * 执行Terminal命令（两阶段流程）
   * @param {Object} params
   * @param {string} params.command - 要执行的命令/prompt
   * @param {string} params.type - 命令类型：'generate-json' 或 'generate-card'
   * @param {string} params.username - 用户名
   * @param {string} params.topic - 主题（仅generate-json时需要）
   */
  async executeCommand(params) {
    const { command, type, username, topic } = params;

    try {
      if (type === 'generate-json') {
        return await this.generateJSON(command, username, topic);
      } else if (type === 'generate-card') {
        return await this.generateCard(command);
      } else {
        throw new Error('Unknown command type');
      }
    } catch (error) {
      console.error('Command execution error:', error);
      throw error;
    }
  }

  /**
   * 第一阶段：生成JSON文件
   */
  async generateJSON(prompt, username, topic) {
    return new Promise((resolve, reject) => {
      console.log(`Executing prompt: ${prompt}`);

      // 创建用户文件夹结构
      const userDir = path.join(__dirname, '..', 'users', username);
      const cardDir = path.join(userDir, 'cards', topic);
      const jsonPath = path.join(cardDir, 'content.json');

      // 确保目录存在
      fs.ensureDirSync(cardDir);

      // 执行Claude命令
      const claudeExec = spawn('claude', ['--prompt', prompt], {
        shell: true,
        cwd: cardDir
      });

      let output = '';
      let errorOutput = '';

      claudeExec.stdout.on('data', (data) => {
        output += data.toString();
      });

      claudeExec.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      claudeExec.on('close', async (code) => {
        if (code !== 0) {
          reject(new Error(`Claude execution failed: ${errorOutput}`));
          return;
        }

        try {
          // 解析输出中的JSON内容
          const jsonMatch = output.match(/```json\n([\s\S]*?)\n```/);
          if (jsonMatch && jsonMatch[1]) {
            const jsonContent = JSON.parse(jsonMatch[1]);
            
            // 保存JSON到文件
            await fs.writeJson(jsonPath, jsonContent, { spaces: 2 });
            
            resolve({
              success: true,
              filePath: `users/${username}/cards/${topic}/content.json`,
              content: jsonContent
            });
          } else {
            // 如果没有找到JSON块，尝试直接解析输出
            const jsonContent = JSON.parse(output.trim());
            await fs.writeJson(jsonPath, jsonContent, { spaces: 2 });
            
            resolve({
              success: true,
              filePath: `users/${username}/cards/${topic}/content.json`,
              content: jsonContent
            });
          }
        } catch (parseError) {
          console.error('JSON parsing error:', parseError);
          // 保存原始输出以便调试
          await fs.writeFile(path.join(cardDir, 'raw_output.txt'), output);
          reject(new Error('Failed to parse JSON from Claude output'));
        }
      });
    });
  }

  /**
   * 第二阶段：使用JSON生成卡片URL
   */
  async generateCard(prompt) {
    return new Promise((resolve, reject) => {
      console.log(`Executing MCP prompt: ${prompt}`);

      // 执行Claude命令调用MCP工具
      const claudeExec = spawn('claude', ['--prompt', prompt], {
        shell: true
      });

      let output = '';
      let errorOutput = '';

      claudeExec.stdout.on('data', (data) => {
        output += data.toString();
      });

      claudeExec.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      claudeExec.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`MCP execution failed: ${errorOutput}`));
          return;
        }

        try {
          // 解析输出中的URL
          const urlMatch = output.match(/https?:\/\/[^\s]+/);
          if (urlMatch) {
            resolve({
              success: true,
              url: urlMatch[0]
            });
          } else {
            // 如果没有直接的URL，可能在JSON响应中
            const jsonMatch = output.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const result = JSON.parse(jsonMatch[0]);
              if (result.url) {
                resolve({
                  success: true,
                  url: result.url
                });
                return;
              }
            }
            reject(new Error('No URL found in MCP output'));
          }
        } catch (parseError) {
          console.error('Output parsing error:', parseError);
          reject(new Error('Failed to parse MCP output'));
        }
      });
    });
  }

  /**
   * 获取用户的卡片文件夹列表
   */
  async getUserFolders(username) {
    const userCardsDir = path.join(__dirname, '..', 'users', username, 'cards');
    
    try {
      await fs.ensureDir(userCardsDir);
      const folders = await fs.readdir(userCardsDir);
      
      const folderList = await Promise.all(
        folders.map(async (folderName) => {
          const folderPath = path.join(userCardsDir, folderName);
          const stats = await fs.stat(folderPath);
          
          if (stats.isDirectory()) {
            // 计算文件夹中的卡片数量
            const files = await fs.readdir(folderPath);
            const jsonFiles = files.filter(f => f.endsWith('.json'));
            
            return {
              name: folderName,
              count: jsonFiles.length,
              path: `users/${username}/cards/${folderName}`,
              createdAt: stats.birthtime
            };
          }
          return null;
        })
      );

      return folderList.filter(f => f !== null);
    } catch (error) {
      console.error('Error getting user folders:', error);
      return [];
    }
  }

  /**
   * 停止Claude进程
   */
  stopClaude() {
    if (this.claudeProcess) {
      this.claudeProcess.kill();
      this.isClaudeRunning = false;
      console.log('Claude Code CLI stopped');
    }
  }
}

module.exports = new ClaudeTerminalService();