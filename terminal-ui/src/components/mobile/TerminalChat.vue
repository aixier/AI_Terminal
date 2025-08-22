<template>
  <div class="chat-terminal">
    <!-- Messages / Output -->
    <div 
      ref="scrollRef" 
      class="chat-scroll" 
      :style="{ paddingBottom: scrollPadCss }"
      @scroll="onScroll"
    >
      <div 
        v-for="m in messages" 
        :key="m.id"
        :class="['chat-msg', m.type]"
      >
        <div class="bubble" v-html="renderText(m.text)"></div>
        <div class="meta">{{ formatTime(m.ts) }}</div>
      </div>
    </div>

    <!-- Floating Input Bar (overlay) -->
    <div ref="barRef" class="chat-input-bar" :class="{ fixed: useFixedBar }">
      <div class="input-row">
        <textarea
          ref="inputRef"
          v-model="input"
          class="chat-textarea"
          placeholder="输入命令，Enter 发送，Shift+Enter 换行"
          @keydown.enter.prevent="handleEnter"
          @keydown.shift.enter.stop
          @input="onInput"
          rows="1"
        ></textarea>
        <div class="btns">
          <button class="send-btn" :disabled="!input.trim() || !isReady" @click="send">发送</button>
          <button class="clear-btn" @click="clear">清屏</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, nextTick, watch, computed } from 'vue'

// Simple chat message model
let uid = 0
const newId = () => (++uid).toString()

const messages = reactive([])
const input = ref('')
const isReady = ref(false)
const scrollRef = ref(null)
const inputRef = ref(null)
const barRef = ref(null)
const useFixedBar = ref(false) // 可切换 fixed/sticky 悬浮策略

let ws = null
let terminalId = null
let outputBuffer = ''
let flushTimer = null

const connect = () => {
  const wsUrl = `ws://${window.location.hostname}:${window.location.port}/ws/terminal`
  ws = new WebSocket(wsUrl)

  ws.onopen = () => {
    sendJson({ type: 'init', cols: 80, rows: 24 })
  }

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data)
      handleServerMessage(msg)
    } catch (e) {
      console.error('[TerminalChat] parse error', e)
    }
  }

  ws.onclose = () => {
    isReady.value = false
    pushSystem('[连接已断开]')
  }

  ws.onerror = () => {
    isReady.value = false
    pushSystem('[连接错误]')
  }
}

const sendJson = (obj) => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(obj))
  }
}

const handleServerMessage = (msg) => {
  switch (msg.type) {
    case 'connected':
      break
    case 'ready':
      terminalId = msg.terminalId
      isReady.value = true
      pushSystem('[终端已就绪]')
      break
    case 'output':
      bufferOutput(msg.data)
      break
    case 'exit':
      bufferOutput(`\r\n[进程已退出，退出码: ${msg.exitCode}]\r\n`)
      break
    case 'error':
      bufferOutput(`\r\n[错误: ${msg.error}]\r\n`)
      break
    default:
      break
  }
}

const bufferOutput = (data) => {
  outputBuffer += data || ''
  // 合并输出，降低渲染频率
  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flushTimer = null
      if (!outputBuffer) return
      pushTerminal(outputBuffer)
      outputBuffer = ''
    }, 80)
  }
}

const send = () => {
  const text = input.value.trimEnd()
  if (!text || !isReady.value) return
  // 显示用户消息
  messages.push({ id: newId(), type: 'user', text, ts: Date.now() })
  // 发送到后端，附带回车
  sendJson({ type: 'input', data: text + '\r' })
  input.value = ''
  autoResize()
  scrollToBottomSoon()
}

const clear = () => {
  messages.length = 0
  pushSystem('[已清屏]')
}

const handleEnter = (e) => {
  if (e.shiftKey) return // Shift+Enter 换行
  send()
}

const pushTerminal = (text) => {
  messages.push({ id: newId(), type: 'terminal', text, ts: Date.now() })
  scrollToBottomSoon()
}

const pushSystem = (text) => {
  messages.push({ id: newId(), type: 'system', text, ts: Date.now() })
  scrollToBottomSoon()
}

const formatTime = (ts) => {
  const d = new Date(ts)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

const renderText = (t) => {
  if (!t) return ''
  // 基本转义并保留换行
  const esc = (s) => s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return esc(t).replace(/\r?\n/g, '<br/>')
}

// 动态高度与滚动区 padding 自适应
const barHeight = ref(80)
const scrollPadCss = computed(() => `${barHeight.value + 12}px`)

const measureBar = async () => {
  await nextTick()
  const el = barRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  // 额外 +12 作为间距
  barHeight.value = Math.round(rect.height)
}

const autoResize = () => {
  const el = inputRef.value
  if (!el) return
  el.style.height = 'auto'
  const max = 120
  el.style.height = Math.min(el.scrollHeight, max) + 'px'
  measureBar()
}

const onInput = () => {
  autoResize()
}

const scrollToBottomSoon = async () => {
  await nextTick()
  const el = scrollRef.value
  if (!el) return
  el.scrollTop = el.scrollHeight
}

const onScroll = () => {
  // 预留：可加入“新消息提示”逻辑
}

// 软键盘与安全区适配
const setupViewportAdapt = () => {
  const onResize = () => measureBar()
  window.addEventListener('resize', onResize)
  return () => window.removeEventListener('resize', onResize)
}

onMounted(() => {
  connect()
  // 移动端使用固定悬浮，PC 端使用容器内 absolute，保证与终端窗口同宽
  const mq = window.matchMedia('(max-width: 1023px)')
  const applyMQ = () => { useFixedBar.value = mq.matches }
  try { mq.addEventListener ? mq.addEventListener('change', applyMQ) : mq.addListener(applyMQ) } catch {}
  applyMQ()
  autoResize()
  measureBar()
  const cleanup = setupViewportAdapt()
  // 聚焦输入
  setTimeout(() => inputRef.value?.focus(), 50)
  onUnmounted(() => {
    cleanup()
    try { mq.removeEventListener ? mq.removeEventListener('change', applyMQ) : mq.removeListener(applyMQ) } catch {}
  })
})

onUnmounted(() => {
  if (flushTimer) clearTimeout(flushTimer)
  try { ws?.close() } catch {}
})

watch(messages, () => {
  scrollToBottomSoon()
})
</script>

<style scoped>
.chat-terminal {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #0d1117;
  position: relative; /* 让输入条绝对定位在容器内 */
}

/* 保证输入条与容器同宽 */
.chat-terminal, .chat-input-bar { width: 100%; }

.chat-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 12px 12px 96px; /* 将被内联样式覆盖为动态高度 */
  -webkit-overflow-scrolling: touch;
}

.chat-msg { margin: 6px 0; display: flex; flex-direction: column; gap: 6px; }
.chat-msg .bubble { max-width: 86%; padding: 8px 12px; border-radius: 12px; line-height: 1.5; font-size: 14px; word-break: break-word; }
.chat-msg .meta { font-size: 11px; color: #8b949e; margin: 0 6px; }

.chat-msg.user { align-items: flex-end; }
.chat-msg.user .bubble { background: #1f6feb; color: #fff; border-top-right-radius: 4px; }

.chat-msg.terminal { align-items: flex-start; }
.chat-msg.terminal .bubble { background: #161b22; color: #c9d1d9; border-top-left-radius: 4px; border: 1px solid #30363d; }

.chat-msg.system { align-items: center; }
.chat-msg.system .bubble { background: transparent; color: #8b949e; border: 1px dashed #30363d; }

/* 输入条：覆盖在底部 */
.chat-input-bar {
  position: absolute;
  left: 0; right: 0; bottom: 0;
  z-index: 10;
  padding: 8px 12px calc(var(--spacing-mobile-safe-area, env(safe-area-inset-bottom)) + 8px);
  background: rgba(13, 17, 23, 0.92);
  border-top: 1px solid #30363d;
  backdrop-filter: blur(8px);
}

.chat-input-bar.fixed {
  position: fixed; /* 可切换为全局固定 */
  left: 0; right: 0;
  bottom: calc(var(--spacing-mobile-tabbar, 60px) + var(--spacing-mobile-safe-area, env(safe-area-inset-bottom)));
}

@media (min-width: 1024px) {
  .chat-input-bar.fixed { bottom: 0; }
}

.input-row { display: flex; gap: 8px; align-items: flex-end; }
.btns { display: flex; gap: 8px; align-items: center; flex-shrink: 0; }

.chat-textarea {
  width: 100%;
  min-height: 44px;
  max-height: 120px;
  resize: none;
  padding: 10px 12px;
  background: #0d1117;
  color: #c9d1d9;
  border: 1px solid #30363d;
  border-radius: 10px;
  outline: none;
  font-size: 14px;
}

.chat-textarea:focus { border-color: #58a6ff; box-shadow: 0 0 0 2px rgba(88,166,255,.15); }

.send-btn { padding: 10px 14px; height: 40px; background: #238636; color: #fff; border: 1px solid #2ea043; border-radius: 8px; font-size: 14px; }
.clear-btn { padding: 10px 12px; height: 40px; background: #30363d; color: #c9d1d9; border: 1px solid #3a3f4a; border-radius: 8px; font-size: 14px; }

</style> 