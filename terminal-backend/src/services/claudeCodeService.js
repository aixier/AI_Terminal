import logger from '../utils/logger.js'
import terminalManager from './terminalManager.js'
import dataService from '../services/dataService.js'

class ClaudeCodeService {
  constructor() {
    this.commandPatterns = {
      // 文件操作
      'list files': 'ls -la',
      'show files': 'ls -la',
      'create directory': (name) => `mkdir -p ${name}`,
      'create folder': (name) => `mkdir -p ${name}`,
      'delete file': (name) => `rm ${name}`,
      'remove file': (name) => `rm ${name}`,
      'copy file': (source, dest) => `cp ${source} ${dest}`,
      'move file': (source, dest) => `mv ${source} ${dest}`,
      'rename': (source, dest) => `mv ${source} ${dest}`,
      
      // 文件内容
      'show content': (file) => `cat ${file}`,
      'view file': (file) => `cat ${file}`,
      'edit file': (file) => `nano ${file}`,
      'search in files': (pattern) => `grep -r "${pattern}" .`,
      'find files': (pattern) => `find . -name "${pattern}"`,
      
      // 系统信息
      'system info': 'uname -a',
      'disk usage': 'df -h',
      'memory usage': 'free -h',
      'current directory': 'pwd',
      'process list': 'ps aux',
      
      // 开发相关
      'git status': 'git status',
      'git log': 'git log --oneline -10',
      'git branch': 'git branch -a',
      'npm install': 'npm install',
      'npm start': 'npm start',
      'npm test': 'npm test',
      'npm build': 'npm run build',
      
      // 网络
      'test connection': (host) => `ping -c 4 ${host}`,
      'check port': (port) => `netstat -tuln | grep ${port}`,
      'download file': (url) => `curl -O ${url}`,
    }
  }

  // 解析自然语言到命令
  async parseNaturalLanguage(input) {
    const lowerInput = input.toLowerCase().trim()
    
    // 尝试匹配预定义模式
    for (const [pattern, command] of Object.entries(this.commandPatterns)) {
      if (lowerInput.includes(pattern)) {
        if (typeof command === 'function') {
          // 提取参数
          const params = this.extractParameters(lowerInput, pattern)
          if (params.length > 0) {
            return {
              success: true,
              command: command(...params),
              confidence: 0.9,
              explanation: `将"${input}"转换为命令`
            }
          }
        } else {
          return {
            success: true,
            command,
            confidence: 0.95,
            explanation: `将"${input}"转换为命令`
          }
        }
      }
    }

    // 尝试智能推断
    const inferredCommand = this.inferCommand(lowerInput)
    if (inferredCommand) {
      return {
        success: true,
        command: inferredCommand.command,
        confidence: inferredCommand.confidence,
        explanation: inferredCommand.explanation
      }
    }

    return {
      success: false,
      message: '无法理解您的意图，请尝试更具体的描述',
      suggestions: this.getSuggestions(lowerInput)
    }
  }

  // 提取参数
  extractParameters(input, pattern) {
    const params = []
    
    // 提取引号中的内容
    const quotedMatches = input.match(/["']([^"']+)["']/g)
    if (quotedMatches) {
      params.push(...quotedMatches.map(m => m.replace(/["']/g, '')))
    }
    
    // 提取文件名或路径
    const words = input.split(' ')
    const patternWords = pattern.split(' ')
    
    // 找到模式后面的词作为参数
    for (let i = 0; i < words.length; i++) {
      if (!patternWords.includes(words[i]) && 
          !params.includes(words[i]) &&
          words[i].match(/^[a-zA-Z0-9\-_.\/]+$/)) {
        params.push(words[i])
      }
    }
    
    return params
  }

  // 智能推断命令
  inferCommand(input) {
    // 文件操作推断
    if (input.match(/创建|新建|create|make/) && input.match(/文件|file/)) {
      const filename = this.extractFilename(input)
      return {
        command: `touch ${filename || 'newfile.txt'}`,
        confidence: 0.7,
        explanation: '创建新文件'
      }
    }

    if (input.match(/查看|显示|show|display/) && input.match(/目录|文件夹|directory|folder/)) {
      return {
        command: 'ls -la',
        confidence: 0.8,
        explanation: '显示目录内容'
      }
    }

    if (input.match(/安装|install/) && input.match(/包|package|依赖|dependency/)) {
      const packageName = this.extractPackageName(input)
      return {
        command: packageName ? `npm install ${packageName}` : 'npm install',
        confidence: 0.8,
        explanation: '安装npm包'
      }
    }

    return null
  }

  // 提取文件名
  extractFilename(input) {
    const match = input.match(/[a-zA-Z0-9\-_.]+\.[a-zA-Z]+/)
    return match ? match[0] : null
  }

  // 提取包名
  extractPackageName(input) {
    const words = input.split(' ')
    for (const word of words) {
      if (word.match(/^[a-z\-]+$/) && !['install', '安装', 'package', '包'].includes(word)) {
        return word
      }
    }
    return null
  }

  // 获取建议
  getSuggestions(input) {
    const suggestions = []
    
    if (input.includes('文件') || input.includes('file')) {
      suggestions.push(
        '列出文件: "show files" 或 "list files"',
        '创建文件: "create file filename.txt"',
        '删除文件: "delete file filename.txt"',
        '查看内容: "show content filename.txt"'
      )
    }

    if (input.includes('git')) {
      suggestions.push(
        '查看状态: "git status"',
        '查看日志: "git log"',
        '查看分支: "git branch"'
      )
    }

    if (input.includes('npm') || input.includes('node')) {
      suggestions.push(
        '安装依赖: "npm install"',
        '启动项目: "npm start"',
        '运行测试: "npm test"',
        '构建项目: "npm build"'
      )
    }

    if (suggestions.length === 0) {
      suggestions.push(
        '尝试更具体的描述，例如:',
        '"列出当前目录的文件"',
        '"创建一个名为test的文件夹"',
        '"查看package.json的内容"'
      )
    }

    return suggestions
  }

  // 执行命令并提供智能反馈
  async executeWithFeedback(sessionId, command) {
    try {
      // 验证命令
      const validation = await dataService.validateCommand(command)
      if (!validation.valid) {
        return {
          success: false,
          error: validation.reason,
          suggestion: '该命令可能存在安全风险或不在允许列表中'
        }
      }

      // 执行命令
      terminalManager.write(sessionId, command + '\n')

      return {
        success: true,
        message: '命令已执行',
        tips: this.getExecutionTips(command)
      }
    } catch (error) {
      logger.error('Command execution error:', error)
      return {
        success: false,
        error: error.message,
        suggestion: this.getErrorSuggestion(error.message)
      }
    }
  }

  // 获取执行提示
  getExecutionTips(command) {
    const tips = []

    if (command.startsWith('rm ')) {
      tips.push('提示: 使用 rm -i 可以在删除前确认')
    }

    if (command.includes('git commit')) {
      tips.push('提示: 记得先使用 git add 添加文件')
    }

    if (command.includes('npm install')) {
      tips.push('提示: 使用 npm ci 可以获得更快的安装速度')
    }

    return tips
  }

  // 获取错误建议
  getErrorSuggestion(errorMessage) {
    if (errorMessage.includes('command not found')) {
      return '该命令可能未安装，请检查拼写或安装相应的工具'
    }

    if (errorMessage.includes('permission denied')) {
      return '权限不足，可能需要使用管理员权限'
    }

    if (errorMessage.includes('No such file')) {
      return '文件或目录不存在，请检查路径是否正确'
    }

    return '请检查命令语法是否正确'
  }

  // 命令历史分析
  async analyzeCommandHistory(userId) {
    const history = await dataService.getCommandHistory(userId, 7)
    
    const analysis = {
      totalCommands: history.length,
      frequentCommands: {},
      errorRate: 0,
      suggestions: []
    }

    // 统计命令频率
    history.forEach(entry => {
      const baseCommand = entry.command.split(' ')[0]
      analysis.frequentCommands[baseCommand] = (analysis.frequentCommands[baseCommand] || 0) + 1
      if (!entry.success) {
        analysis.errorRate++
      }
    })

    analysis.errorRate = history.length > 0 ? (analysis.errorRate / history.length) * 100 : 0

    // 生成建议
    if (analysis.errorRate > 20) {
      analysis.suggestions.push('您的错误率较高，建议使用命令提示功能')
    }

    const mostUsed = Object.entries(analysis.frequentCommands)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([cmd]) => cmd)

    if (mostUsed.length > 0) {
      analysis.suggestions.push(`您经常使用的命令: ${mostUsed.join(', ')}`)
    }

    return analysis
  }
}

export default new ClaudeCodeService()