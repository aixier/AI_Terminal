# Web Terminal Best Practices

## Overview
This document outlines the best practices for implementing a web-based terminal using Socket.io, node-pty, and xterm.js.

## Architecture

### Core Components
1. **Backend Terminal Manager** (`terminalManager.js`)
   - Manages PTY (Pseudo Terminal) instances
   - Direct streaming without buffering
   - Lifecycle management

2. **Backend Socket Handler** (`socketHandler.js`)
   - Manages WebSocket connections
   - Maps sockets to terminals
   - Handles data flow

3. **Frontend Terminal Service** (`terminalService.js`)
   - XTerm.js integration
   - Socket.io client
   - User interaction handling

## Key Design Principles

### 1. Direct Streaming
```javascript
// Backend: PTY output directly to socket
pty.onData((data) => {
  socket.emit('terminal:output', data)
})

// Frontend: Socket output directly to terminal
socket.on('terminal:output', (data) => {
  terminal.write(data)
})
```

### 2. No Buffering in Transport Layer
- Data flows directly: PTY → Socket → XTerm
- Buffering only for specific features (e.g., pattern matching)
- Preserves real-time streaming experience

### 3. Simple Message Format
```javascript
// Input: Send raw string
socket.emit('terminal:input', 'ls -la\r')

// Output: Receive raw string
socket.on('terminal:output', '\x1b[32mfile.txt\x1b[0m')
```

### 4. Socket-Terminal Mapping
```javascript
// Backend maintains bidirectional mapping
socketToTerminal: Map<socketId, terminalId>
terminalToSocket: Map<terminalId, socketId>
```

## Implementation Details

### Backend Setup

#### 1. Terminal Creation
```javascript
// socketHandler.js
socket.on('terminal:create', async (options) => {
  const terminal = await createOrAttachTerminal(socketId, options)
  socket.emit('terminal:ready', { 
    success: true, 
    terminalId: terminal.id 
  })
})
```

#### 2. Data Flow Setup
```javascript
// Direct PTY to Socket streaming
const dataHandler = (data) => {
  socket.emit('terminal:output', data)
}
pty.onData(dataHandler)
```

#### 3. Input Handling
```javascript
socket.on('terminal:input', (data) => {
  // data is raw string, not wrapped object
  const terminalId = socketToTerminal.get(socketId)
  terminalManager.write(terminalId, data)
})
```

### Frontend Setup

#### 1. Terminal Initialization
```javascript
// Create XTerm instance
this.terminal = new Terminal({
  theme: { /* theme config */ },
  fontFamily: 'monospace',
  fontSize: 14,
  cursorBlink: true
})

// Add addons
this.fitAddon = new FitAddon()
this.terminal.loadAddon(this.fitAddon)
```

#### 2. Socket Connection
```javascript
// Connect to backend
this.socket = io(wsUrl, {
  transports: ['polling', 'websocket'],
  reconnection: true
})

// Create terminal session
socket.emit('terminal:create', {
  cols: terminal.cols,
  rows: terminal.rows
})
```

#### 3. Bidirectional Data Flow
```javascript
// User input to backend
terminal.onData((data) => {
  socket.emit('terminal:input', data)
})

// Backend output to terminal
socket.on('terminal:output', (data) => {
  terminal.write(data)
})
```

## Common Issues and Solutions

### Issue 1: Input Not Working
**Problem**: Terminal doesn't respond to keyboard input
**Solution**: Ensure data is sent as raw string, not wrapped in object
```javascript
// ❌ Wrong
socket.emit('terminal:input', { terminalId: id, data: 'ls' })

// ✅ Correct
socket.emit('terminal:input', 'ls')
```

### Issue 2: Output Not Streaming
**Problem**: Output appears all at once instead of streaming
**Solution**: Remove buffering, send data immediately
```javascript
// ❌ Wrong - Buffering
let buffer = []
pty.onData((data) => {
  buffer.push(data)
  if (buffer.length > 10) {
    socket.emit('terminal:output', buffer.join(''))
    buffer = []
  }
})

// ✅ Correct - Direct streaming
pty.onData((data) => {
  socket.emit('terminal:output', data)
})
```

### Issue 3: Terminal Size Issues
**Problem**: Terminal content doesn't fit properly
**Solution**: Implement proper resize handling
```javascript
// Frontend
window.addEventListener('resize', () => {
  fitAddon.fit()
  socket.emit('terminal:resize', {
    cols: terminal.cols,
    rows: terminal.rows
  })
})

// Backend
socket.on('terminal:resize', ({ cols, rows }) => {
  pty.resize(cols, rows)
})
```

## Security Considerations

1. **Input Validation**
   ```javascript
   if (typeof data !== 'string') {
     return // Reject non-string input
   }
   ```

2. **Resource Limits**
   ```javascript
   const MAX_TERMINALS = 100
   if (terminals.size >= MAX_TERMINALS) {
     throw new Error('Terminal limit reached')
   }
   ```

3. **Cleanup on Disconnect**
   ```javascript
   socket.on('disconnect', () => {
     const terminalId = socketToTerminal.get(socketId)
     if (terminalId) {
       terminalManager.destroy(terminalId)
     }
   })
   ```

## Testing Checklist

- [ ] User can type commands and see input
- [ ] Commands execute and show output
- [ ] Output streams character by character
- [ ] ANSI colors display correctly
- [ ] Terminal resizes properly
- [ ] Ctrl+C interrupts running commands
- [ ] Terminal reconnects after disconnect
- [ ] Multiple terminals work independently
- [ ] Resource cleanup on disconnect
- [ ] No memory leaks during long sessions

## Performance Optimization

1. **Limit Buffer Size**
   ```javascript
   if (outputBuffer.length > 1000) {
     outputBuffer.shift()
   }
   ```

2. **Debounce Resize Events**
   ```javascript
   let resizeTimeout
   window.addEventListener('resize', () => {
     clearTimeout(resizeTimeout)
     resizeTimeout = setTimeout(() => {
       fitAddon.fit()
     }, 100)
   })
   ```

3. **Use Binary Transport for Large Data**
   ```javascript
   // For file transfers or large outputs
   socket.binary(true).emit('terminal:binary', buffer)
   ```

## Debugging Tips

1. **Enable Verbose Logging**
   ```javascript
   console.log('[Terminal] Input:', data.charCodeAt(0))
   console.log('[Socket] Connected:', socket.id)
   ```

2. **Monitor Socket Events**
   ```javascript
   socket.onAny((event, ...args) => {
     console.log(`[Socket Event] ${event}:`, args)
   })
   ```

3. **Check Terminal State**
   ```javascript
   console.log('Terminal ready:', terminal.isReady())
   console.log('Socket connected:', socket.connected)
   ```

## Example Full Flow

1. User opens web terminal
2. Frontend creates XTerm instance
3. Frontend connects to Socket.io server
4. Frontend emits `terminal:create` event
5. Backend creates PTY instance
6. Backend sets up data flow: PTY → Socket
7. Backend emits `terminal:ready` with terminalId
8. Frontend sets up bidirectional data flow
9. User types command
10. XTerm captures input via `onData`
11. Frontend emits `terminal:input` with raw string
12. Backend writes to PTY
13. PTY executes command and outputs
14. PTY `onData` sends output to socket
15. Frontend receives `terminal:output`
16. XTerm displays output via `write()`

## References

- [node-pty Documentation](https://github.com/microsoft/node-pty)
- [xterm.js Documentation](https://xtermjs.org/)
- [Socket.io Documentation](https://socket.io/docs/)
- [ANSI Escape Codes](https://en.wikipedia.org/wiki/ANSI_escape_code)