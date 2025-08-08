# Web Terminal 键盘事件发送规范

## 概述

本文档定义了 Web Terminal 前端向后端发送键盘事件的标准规范。该规范确保所有键盘输入（包括特殊键、组合键）能够正确传递到后端的伪终端（PTY）。

## 核心原理

### 1. 终端序列（Terminal Sequences）

终端使用 ANSI 转义序列来表示特殊键和控制字符。Web Terminal 必须将浏览器的键盘事件转换为相应的终端序列。

### 2. 数据传输格式

所有键盘输入应该转换为字节序列或字符串，通过 WebSocket 发送到后端：

```javascript
// 数据格式
{
  type: 'terminal:input',
  data: string | Uint8Array  // 终端序列
}
```

## 键盘事件映射规范

### 1. 普通字符键

普通可打印字符直接发送：

```javascript
// a-z, A-Z, 0-9, 特殊符号等
onData: (data) => {
  socket.emit('terminal:input', data)
}
```

### 2. 控制键（Ctrl）组合

| 组合键 | ASCII 码 | 十六进制 | 说明 |
|--------|---------|----------|------|
| Ctrl+A | 1 | \x01 | 移动到行首 |
| Ctrl+B | 2 | \x02 | 向后移动光标 |
| Ctrl+C | 3 | \x03 | 中断进程 |
| Ctrl+D | 4 | \x04 | EOF/退出 |
| Ctrl+E | 5 | \x05 | 移动到行尾 |
| Ctrl+F | 6 | \x06 | 向前移动光标 |
| Ctrl+G | 7 | \x07 | 响铃 |
| Ctrl+H | 8 | \x08 | 退格 |
| Ctrl+I | 9 | \x09 | Tab |
| Ctrl+J | 10 | \x0A | 换行 (Line Feed, LF) |
| Ctrl+K | 11 | \x0B | 删除到行尾 |
| Ctrl+L | 12 | \x0C | 清屏 |
| Ctrl+M | 13 | \x0D | 回车 (Carriage Return, CR) |
| Ctrl+N | 14 | \x0E | 下一个历史命令 |
| Ctrl+O | 15 | \x0F | 执行并获取下一行 |
| Ctrl+P | 16 | \x10 | 上一个历史命令 |
| Ctrl+Q | 17 | \x11 | 恢复输出 |
| Ctrl+R | 18 | \x12 | 反向搜索历史 |
| Ctrl+S | 19 | \x13 | 暂停输出 |
| Ctrl+T | 20 | \x14 | 交换字符 |
| Ctrl+U | 21 | \x15 | 删除到行首 |
| Ctrl+V | 22 | \x16 | 逐字输入 |
| Ctrl+W | 23 | \x17 | 删除前一个单词 |
| Ctrl+X | 24 | \x18 | 开始选择 |
| Ctrl+Y | 25 | \x19 | 粘贴 |
| Ctrl+Z | 26 | \x1A | 挂起进程 |
| Ctrl+[ | 27 | \x1B | ESC |
| Ctrl+\\ | 28 | \x1C | 退出 |
| Ctrl+] | 29 | \x1D | 进入 telnet 命令模式 |
| Ctrl+^ | 30 | \x1E | 记录分隔符 |
| Ctrl+_ | 31 | \x1F | 撤销 |

### 3. 功能键和特殊键

功能键使用 ANSI 转义序列：

```javascript
const functionKeys = {
  'F1':  '\x1BOP',     // ESC O P
  'F2':  '\x1BOQ',     // ESC O Q
  'F3':  '\x1BOR',     // ESC O R
  'F4':  '\x1BOS',     // ESC O S
  'F5':  '\x1B[15~',   // ESC [ 15 ~
  'F6':  '\x1B[17~',   // ESC [ 17 ~
  'F7':  '\x1B[18~',   // ESC [ 18 ~
  'F8':  '\x1B[19~',   // ESC [ 19 ~
  'F9':  '\x1B[20~',   // ESC [ 20 ~
  'F10': '\x1B[21~',   // ESC [ 21 ~
  'F11': '\x1B[23~',   // ESC [ 23 ~
  'F12': '\x1B[24~',   // ESC [ 24 ~
}
```

### 4. 方向键

```javascript
const arrowKeys = {
  'ArrowUp':    '\x1B[A',  // ESC [ A
  'ArrowDown':  '\x1B[B',  // ESC [ B
  'ArrowRight': '\x1B[C',  // ESC [ C
  'ArrowLeft':  '\x1B[D',  // ESC [ D
}

// 带修饰键的方向键
const modifiedArrowKeys = {
  'Shift+ArrowUp':    '\x1B[1;2A',
  'Shift+ArrowDown':  '\x1B[1;2B',
  'Shift+ArrowRight': '\x1B[1;2C',
  'Shift+ArrowLeft':  '\x1B[1;2D',
  'Alt+ArrowUp':      '\x1B[1;3A',
  'Alt+ArrowDown':    '\x1B[1;3B',
  'Alt+ArrowRight':   '\x1B[1;3C',
  'Alt+ArrowLeft':    '\x1B[1;3D',
  'Ctrl+ArrowUp':     '\x1B[1;5A',
  'Ctrl+ArrowDown':   '\x1B[1;5B',
  'Ctrl+ArrowRight':  '\x1B[1;5C',
  'Ctrl+ArrowLeft':   '\x1B[1;5D',
}
```

### 5. 其他特殊键

```javascript
const specialKeys = {
  'Enter':     '\r',        // 回车 (Carriage Return, CR)
  'Backspace': '\x7F',      // 删除前一个字符 (DEL)
  'Tab':       '\t',        // 制表符
  'Escape':    '\x1B',      // ESC
  'Insert':    '\x1B[2~',   // ESC [ 2 ~
  'Delete':    '\x1B[3~',   // ESC [ 3 ~
  'Home':      '\x1B[H',    // ESC [ H
  'End':       '\x1B[F',    // ESC [ F
  'PageUp':    '\x1B[5~',   // ESC [ 5 ~
  'PageDown':  '\x1B[6~',   // ESC [ 6 ~
}
```

### 6. Alt 键组合

Alt 键组合通常在字符前添加 ESC（\x1B）：

```javascript
// Alt+字符的处理
function handleAltKey(char) {
  return '\x1B' + char  // ESC + 字符
}

// 示例
'Alt+A': '\x1Ba'
'Alt+B': '\x1Bb'
'Alt+D': '\x1Bd'  // 删除单词
'Alt+F': '\x1Bf'  // 向前移动一个单词
```

## 实现示例

### 使用 xterm.js 的标准实现

```javascript
import { Terminal } from 'xterm'
import { io } from 'socket.io-client'

class WebTerminal {
  constructor() {
    this.terminal = new Terminal({
      cursorBlink: true,
      macOptionIsMeta: true,  // Mac 上 Option 键作为 Meta 键
      scrollback: 10000
    })
    
    this.socket = io('ws://localhost:3000')
  }

  init(container) {
    this.terminal.open(container)
    
    // 标准方式：使用 onData 事件
    // xterm.js 会自动处理所有键盘事件并转换为正确的终端序列
    this.terminal.onData((data) => {
      this.socket.emit('terminal:input', data)
    })
    
    // 接收后端数据
    this.socket.on('terminal:output', (data) => {
      this.terminal.write(data)
    })
  }
  
  // 如果需要自定义处理某些键
  attachCustomKeyHandler() {
    this.terminal.attachCustomKeyEventHandler((event) => {
      // 返回 false 让 xterm.js 处理
      // 返回 true 阻止默认处理
      
      // 示例：拦截 Ctrl+Shift+C 用于复制
      if (event.ctrlKey && event.shiftKey && event.key === 'C') {
        this.copySelection()
        return true  // 阻止默认处理
      }
      
      // 示例：拦截 Ctrl+Shift+V 用于粘贴
      if (event.ctrlKey && event.shiftKey && event.key === 'V') {
        this.paste()
        return true
      }
      
      return false  // 让 xterm.js 处理其他键
    })
  }
}
```

### 手动实现键盘事件处理（不推荐，仅供理解）

```javascript
class ManualKeyboardHandler {
  constructor(socket) {
    this.socket = socket
  }
  
  handleKeyDown(event) {
    let data = ''
    
    // Ctrl 组合键
    if (event.ctrlKey && !event.altKey && !event.metaKey) {
      if (event.key.length === 1) {
        // Ctrl+A-Z 转换为 ASCII 1-26
        const code = event.key.toUpperCase().charCodeAt(0) - 64
        if (code >= 1 && code <= 26) {
          data = String.fromCharCode(code)
        }
      } else {
        // 特殊 Ctrl 组合
        switch(event.key) {
          case 'Enter': data = '\r'; break
          case 'Backspace': data = '\x08'; break
          case 'Tab': data = '\t'; break
          case 'Escape': data = '\x1B'; break
        }
      }
    }
    
    // Alt 组合键
    else if (event.altKey && !event.ctrlKey && !event.metaKey) {
      if (event.key.length === 1) {
        data = '\x1B' + event.key
      } else {
        // Alt + 方向键
        switch(event.key) {
          case 'ArrowUp': data = '\x1B[1;3A'; break
          case 'ArrowDown': data = '\x1B[1;3B'; break
          case 'ArrowRight': data = '\x1B[1;3C'; break
          case 'ArrowLeft': data = '\x1B[1;3D'; break
        }
      }
    }
    
    // 功能键
    else if (event.key.startsWith('F')) {
      const functionKeyMap = {
        'F1': '\x1BOP', 'F2': '\x1BOQ', 'F3': '\x1BOR', 'F4': '\x1BOS',
        'F5': '\x1B[15~', 'F6': '\x1B[17~', 'F7': '\x1B[18~', 'F8': '\x1B[19~',
        'F9': '\x1B[20~', 'F10': '\x1B[21~', 'F11': '\x1B[23~', 'F12': '\x1B[24~'
      }
      data = functionKeyMap[event.key] || ''
    }
    
    // 方向键
    else if (event.key.startsWith('Arrow')) {
      const arrowKeyMap = {
        'ArrowUp': '\x1B[A',
        'ArrowDown': '\x1B[B',
        'ArrowRight': '\x1B[C',
        'ArrowLeft': '\x1B[D'
      }
      data = arrowKeyMap[event.key] || ''
    }
    
    // 其他特殊键
    else {
      switch(event.key) {
        case 'Enter': data = '\r'; break
        case 'Backspace': data = '\x7F'; break
        case 'Tab': data = '\t'; break
        case 'Escape': data = '\x1B'; break
        case 'Delete': data = '\x1B[3~'; break
        case 'Insert': data = '\x1B[2~'; break
        case 'Home': data = '\x1B[H'; break
        case 'End': data = '\x1B[F'; break
        case 'PageUp': data = '\x1B[5~'; break
        case 'PageDown': data = '\x1B[6~'; break
        default:
          // 普通字符
          if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
            data = event.key
          }
      }
    }
    
    if (data) {
      this.socket.emit('terminal:input', data)
      event.preventDefault()
    }
  }
}
```

## 后端处理

后端接收到终端序列后，直接写入 PTY：

```javascript
// Node.js 示例
const pty = require('node-pty')

socket.on('terminal:input', (data) => {
  // 直接写入 PTY，不需要额外处理
  ptyProcess.write(data)
})
```

## 测试用例

### 1. 基本输入测试
- 输入普通字符：`abc123`
- 输入特殊符号：`!@#$%^&*()`

### 2. 控制键测试
- `Ctrl+C`：应该中断当前进程
- `Ctrl+D`：应该退出 shell
- `Ctrl+L`：应该清屏
- `Ctrl+Z`：应该挂起进程

### 3. 导航键测试
- 方向键：在命令历史和文本中导航
- `Home/End`：移动到行首/行尾
- `Ctrl+A/E`：移动到行首/行尾

### 4. 编辑键测试
- `Backspace`：删除前一个字符
- `Delete`：删除当前字符
- `Ctrl+U`：删除到行首
- `Ctrl+K`：删除到行尾
- `Ctrl+W`：删除前一个单词

### 5. Alt 组合键测试
- `Alt+B`：向后移动一个单词
- `Alt+F`：向前移动一个单词
- `Alt+D`：删除下一个单词

## 注意事项

1. **使用 xterm.js 的 onData**：强烈推荐使用 xterm.js 的 `onData` 事件，它会自动处理所有键盘映射。

2. **避免手动处理**：手动处理键盘事件容易出错，特别是在处理不同操作系统和键盘布局时。

3. **浏览器兼容性**：某些键盘组合可能被浏览器或操作系统拦截（如 Ctrl+W, Ctrl+T）。

4. **字符编码**：确保 WebSocket 传输使用正确的编码（通常是 UTF-8）。

5. **IME 输入**：对于中文等输入法，应该使用 composition 事件处理。

6. **性能考虑**：避免在键盘事件处理中进行复杂计算，保持低延迟。

## 参考资源

- [ANSI Escape Sequences](https://en.wikipedia.org/wiki/ANSI_escape_code)
- [xterm.js Documentation](https://xtermjs.org/)
- [Terminal Control Sequences](https://invisible-island.net/xterm/ctlseqs/ctlseqs.html)
- [ASCII Control Characters](https://www.ascii-code.com/)