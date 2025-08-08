/**
 * Terminal输出解析器
 * 处理ANSI转义序列和特殊字符
 */

class TerminalParser {
  constructor() {
    // ANSI颜色映射
    this.colorMap = {
      '30': '#000000', // 黑色
      '31': '#ff0000', // 红色
      '32': '#00ff00', // 绿色
      '33': '#ffff00', // 黄色
      '34': '#0099ff', // 蓝色
      '35': '#ff00ff', // 品红
      '36': '#00ffff', // 青色
      '37': '#ffffff', // 白色
      '90': '#808080', // 亮黑（灰色）
      '91': '#ff6b6b', // 亮红
      '92': '#69ff69', // 亮绿
      '93': '#ffff69', // 亮黄
      '94': '#69b4ff', // 亮蓝
      '95': '#ff69ff', // 亮品红
      '96': '#69ffff', // 亮青
      '97': '#ffffff'  // 亮白
    }
    
    // 背景色映射（40-47, 100-107）
    this.bgColorMap = {
      '40': '#000000',
      '41': '#ff0000',
      '42': '#00ff00',
      '43': '#ffff00',
      '44': '#0099ff',
      '45': '#ff00ff',
      '46': '#00ffff',
      '47': '#ffffff',
      '100': '#808080',
      '101': '#ff6b6b',
      '102': '#69ff69',
      '103': '#ffff69',
      '104': '#69b4ff',
      '105': '#ff69ff',
      '106': '#69ffff',
      '107': '#ffffff'
    }
  }
  
  /**
   * 解析并清理终端输出
   * @param {string} content - 原始终端输出
   * @returns {object} - 包含处理后的文本和元数据
   */
  parse(content) {
    if (!content) return { text: '', html: '', type: 'normal' }
    
    // 检测特殊输出类型
    const outputType = this.detectOutputType(content)
    
    // 根据类型进行不同处理
    switch (outputType) {
      case 'claude-prompt':
        return this.parseClaudePrompt(content)
      case 'command':
        return this.parseCommand(content)
      case 'error':
        return this.parseError(content)
      default:
        return this.parseNormal(content)
    }
  }
  
  /**
   * 检测输出类型
   */
  detectOutputType(content) {
    // Claude的信任提示框
    if (content.includes('Do you trust the files') || 
        content.includes('Claude Code may read files')) {
      return 'claude-prompt'
    }
    
    // 命令提示符
    if (content.match(/^[\w@\-]+:[~\/\w]*[\$#]\s/)) {
      return 'command'
    }
    
    // 错误信息
    if (content.includes('Error:') || content.includes('error:')) {
      return 'error'
    }
    
    return 'normal'
  }
  
  /**
   * 解析Claude的信任提示
   */
  parseClaudePrompt(content) {
    // 提取关键信息
    const lines = content.split('\n')
    const filteredLines = []
    
    for (const line of lines) {
      const cleaned = this.cleanLine(line)
      if (cleaned && !this.isBoxDrawing(cleaned)) {
        // 特殊处理选项
        if (cleaned.includes('1. Yes, proceed')) {
          filteredLines.push('> [1] Yes, proceed')
        } else if (cleaned.includes('2. No, exit')) {
          filteredLines.push('> [2] No, exit')
        } else if (cleaned.includes('Do you trust')) {
          filteredLines.push('🔐 Security Check: Do you trust the files in this folder?')
        } else if (cleaned.includes('/root') || cleaned.match(/^\/[\w\/]+$/)) {
          filteredLines.push(`📁 Folder: ${cleaned}`)
        } else if (cleaned.length > 0) {
          filteredLines.push(cleaned)
        }
      }
    }
    
    return {
      type: 'claude-prompt',
      text: filteredLines.join('\n'),
      html: filteredLines.map(line => this.formatLine(line)).join('<br>'),
      metadata: {
        isSecurityPrompt: true,
        folder: '/root'
      }
    }
  }
  
  /**
   * 解析命令行
   */
  parseCommand(content) {
    const cleaned = this.cleanANSI(content)
    const parts = cleaned.match(/^([\w@\-]+:[~\/\w]*[\$#])\s*(.*)$/)
    
    if (parts) {
      return {
        type: 'command',
        text: cleaned,
        html: `<span class="prompt">${parts[1]}</span> <span class="cmd">${parts[2]}</span>`,
        metadata: {
          prompt: parts[1],
          command: parts[2]
        }
      }
    }
    
    return this.parseNormal(content)
  }
  
  /**
   * 解析错误信息
   */
  parseError(content) {
    const cleaned = this.cleanANSI(content)
    return {
      type: 'error',
      text: cleaned,
      html: `<span class="error-output">${this.escapeHtml(cleaned)}</span>`,
      metadata: {
        isError: true
      }
    }
  }
  
  /**
   * 解析普通输出
   */
  parseNormal(content) {
    const cleaned = this.cleanANSI(content)
    const lines = cleaned.split('\n').filter(line => line.trim().length > 0)
    
    return {
      type: 'normal',
      text: lines.join('\n'),
      html: lines.map(line => this.formatLine(line)).join('<br>'),
      metadata: {}
    }
  }
  
  /**
   * 清理单行内容
   */
  cleanLine(line) {
    return line
      .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '') // ANSI控制序列
      .replace(/\x1b\].*?\x07/g, '') // OSC序列
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // 控制字符
      .replace(/\r/g, '') // 回车符
      .trim()
  }
  
  /**
   * 清理ANSI序列
   */
  cleanANSI(content) {
    return content
      .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
      .replace(/\x1b\].*?\x07/g, '')
      .replace(/\x1b\[[\?]?[0-9;]*[hl]/g, '')
      .replace(/\x1b\[[0-9]*[ABCDEFGJKST]/g, '')
      .replace(/\x1b\[[0-9;]*m/g, '')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
  }
  
  /**
   * 检查是否为框线字符
   */
  isBoxDrawing(line) {
    // 如果超过30%的字符是框线字符，认为是框线
    const boxChars = line.match(/[╭╮╰╯│─┌┐└┘├┤┬┴┼]/g)
    if (boxChars && boxChars.length > line.length * 0.3) {
      return true
    }
    return false
  }
  
  /**
   * 格式化单行文本
   */
  formatLine(line) {
    // 处理特殊标记
    if (line.startsWith('> [')) {
      return `<span class="option">${this.escapeHtml(line)}</span>`
    }
    if (line.startsWith('🔐')) {
      return `<span class="security">${this.escapeHtml(line)}</span>`
    }
    if (line.startsWith('📁')) {
      return `<span class="folder">${this.escapeHtml(line)}</span>`
    }
    if (line.includes('Error:') || line.includes('error:')) {
      return `<span class="error">${this.escapeHtml(line)}</span>`
    }
    
    return this.escapeHtml(line)
  }
  
  /**
   * HTML转义
   */
  escapeHtml(text) {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }
  
  /**
   * 简化输出（用于抽屉显示）
   */
  simplify(content) {
    const parsed = this.parse(content)
    
    // 对于Claude提示，返回简化版本
    if (parsed.type === 'claude-prompt') {
      return '🔐 Security prompt: Trust folder /root?\n> Choose: [1] Yes, proceed | [2] No, exit'
    }
    
    // 对于普通内容，返回清理后的文本
    return parsed.text
  }
}

export default new TerminalParser()