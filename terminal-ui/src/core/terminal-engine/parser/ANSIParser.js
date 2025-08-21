/**
 * ANSI 转义序列解析器
 * 解析终端输出中的ANSI控制序列
 */

export class ANSIParser {
  constructor() {
    this.state = 'NORMAL'
    this.currentSequence = ''
    this.params = []
    this.intermediate = ''
    this.collect = ''
    
    // 解析状态
    this.parseState = {
      position: 0,
      length: 0,
      data: null
    }
  }
  
  /**
   * 解析数据
   * @param {string|Uint8Array} data - 输入数据
   * @returns {Array} 解析后的命令数组
   */
  parse(data) {
    if (!data) return []
    
    // 统一转换为字符串
    const text = typeof data === 'string' ? data : this.arrayToString(data)
    
    const commands = []
    this.parseState.data = text
    this.parseState.length = text.length
    this.parseState.position = 0
    
    while (this.parseState.position < this.parseState.length) {
      const result = this.parseNext()
      if (result) {
        commands.push(result)
      }
    }
    
    return commands
  }
  
  /**
   * 解析下一个字符
   */
  parseNext() {
    const char = this.parseState.data[this.parseState.position]
    const code = char.charCodeAt(0)
    
    this.parseState.position++
    
    switch (this.state) {
      case 'NORMAL':
        return this.parseNormal(char, code)
        
      case 'ESCAPE':
        return this.parseEscape(char, code)
        
      case 'CSI':
        return this.parseCSI(char, code)
        
      case 'OSC':
        return this.parseOSC(char, code)
        
      case 'DCS':
        return this.parseDCS(char, code)
        
      default:
        this.reset()
        return this.parseNormal(char, code)
    }
  }
  
  /**
   * 解析普通状态
   */
  parseNormal(char, code) {
    // ESC 开始转义序列
    if (code === 0x1B) { // ESC
      this.state = 'ESCAPE'
      this.currentSequence = char
      return null
    }
    
    // 控制字符
    if (code < 0x20) {
      return this.createControlCommand(char, code)
    }
    
    // 普通字符
    return {
      type: 'CHAR',
      char: char,
      code: code
    }
  }
  
  /**
   * 解析转义状态
   */
  parseEscape(char, code) {
    this.currentSequence += char
    
    switch (char) {
      case '[': // CSI - Control Sequence Introducer
        this.state = 'CSI'
        this.params = []
        this.intermediate = ''
        this.collect = ''
        return null
        
      case ']': // OSC - Operating System Command
        this.state = 'OSC'
        this.collect = ''
        return null
        
      case 'P': // DCS - Device Control String
        this.state = 'DCS'
        this.collect = ''
        return null
        
      case '\\': // ST - String Terminator
        const result = this.createEscapeCommand()
        this.reset()
        return result
        
      default:
        // 单字符转义序列
        if (code >= 0x40 && code <= 0x7E) {
          const result = this.createEscapeCommand(char)
          this.reset()
          return result
        }
        
        // 继续收集
        return null
    }
  }
  
  /**
   * 解析CSI状态
   */
  parseCSI(char, code) {
    this.currentSequence += char
    
    // 参数字符 (0-9, ;)
    if ((code >= 0x30 && code <= 0x39) || code === 0x3B) {
      this.collect += char
      return null
    }
    
    // 中间字符 (0x20-0x2F)
    if (code >= 0x20 && code <= 0x2F) {
      this.intermediate += char
      return null
    }
    
    // 终止字符 (0x40-0x7E)
    if (code >= 0x40 && code <= 0x7E) {
      this.parseCSIParams()
      const result = this.createCSICommand(char)
      this.reset()
      return result
    }
    
    // 无效字符，重置
    this.reset()
    return null
  }
  
  /**
   * 解析OSC状态
   */
  parseOSC(char, code) {
    this.currentSequence += char
    
    // 字符串终止符
    if (code === 0x07 || (code === 0x1B && this.peekNext() === '\\')) { // BEL or ESC\
      if (code === 0x1B) {
        this.parseState.position++ // 跳过 '\'
        this.currentSequence += '\\'
      }
      
      const result = this.createOSCCommand()
      this.reset()
      return result
    }
    
    // 收集OSC数据
    this.collect += char
    return null
  }
  
  /**
   * 解析DCS状态
   */
  parseDCS(char, code) {
    this.currentSequence += char
    
    // 字符串终止符
    if (code === 0x1B && this.peekNext() === '\\') { // ESC\
      this.parseState.position++ // 跳过 '\'
      this.currentSequence += '\\'
      
      const result = this.createDCSCommand()
      this.reset()
      return result
    }
    
    // 收集DCS数据
    this.collect += char
    return null
  }
  
  /**
   * 解析CSI参数
   */
  parseCSIParams() {
    if (!this.collect) {
      this.params = []
      return
    }
    
    this.params = this.collect.split(';').map(param => {
      const num = parseInt(param, 10)
      return isNaN(num) ? 0 : num
    })
  }
  
  /**
   * 创建控制命令
   */
  createControlCommand(char, code) {
    const controlNames = {
      0x07: 'BEL',  // Bell
      0x08: 'BS',   // Backspace
      0x09: 'HT',   // Horizontal Tab
      0x0A: 'LF',   // Line Feed
      0x0B: 'VT',   // Vertical Tab
      0x0C: 'FF',   // Form Feed
      0x0D: 'CR',   // Carriage Return
      0x0E: 'SO',   // Shift Out
      0x0F: 'SI'    // Shift In
    }
    
    return {
      type: 'CONTROL',
      name: controlNames[code] || 'UNKNOWN',
      char: char,
      code: code
    }
  }
  
  /**
   * 创建转义命令
   */
  createEscapeCommand(finalChar = null) {
    return {
      type: 'ESC',
      sequence: this.currentSequence,
      finalChar: finalChar,
      intermediate: this.intermediate
    }
  }
  
  /**
   * 创建CSI命令
   */
  createCSICommand(finalChar) {
    return {
      type: 'CSI',
      sequence: this.currentSequence,
      finalChar: finalChar,
      params: [...this.params],
      intermediate: this.intermediate
    }
  }
  
  /**
   * 创建OSC命令
   */
  createOSCCommand() {
    const parts = this.collect.split(';')
    const command = parts[0] ? parseInt(parts[0], 10) : 0
    const data = parts.slice(1).join(';')
    
    return {
      type: 'OSC',
      sequence: this.currentSequence,
      command: command,
      data: data
    }
  }
  
  /**
   * 创建DCS命令
   */
  createDCSCommand() {
    return {
      type: 'DCS',
      sequence: this.currentSequence,
      data: this.collect
    }
  }
  
  /**
   * 查看下一个字符
   */
  peekNext() {
    if (this.parseState.position >= this.parseState.length) {
      return null
    }
    return this.parseState.data[this.parseState.position]
  }
  
  /**
   * 重置解析器状态
   */
  reset() {
    this.state = 'NORMAL'
    this.currentSequence = ''
    this.params = []
    this.intermediate = ''
    this.collect = ''
  }
  
  /**
   * 数组转字符串
   */
  arrayToString(array) {
    if (typeof TextDecoder !== 'undefined') {
      const decoder = new TextDecoder('utf-8')
      return decoder.decode(array)
    }
    
    // 回退方案
    let result = ''
    for (let i = 0; i < array.length; i++) {
      result += String.fromCharCode(array[i])
    }
    return result
  }
  
  /**
   * 获取解析器状态信息
   */
  getState() {
    return {
      state: this.state,
      currentSequence: this.currentSequence,
      params: [...this.params],
      intermediate: this.intermediate,
      collect: this.collect
    }
  }
}