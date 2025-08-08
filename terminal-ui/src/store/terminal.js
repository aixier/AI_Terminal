import { defineStore } from 'pinia'

export const useTerminalStore = defineStore('terminal', {
  state: () => ({
    // 当前会话信息
    currentSession: null,
    // 命令历史
    commandHistory: [],
    // 执行状态
    isExecuting: false,
    // 当前执行的命令
    currentCommand: null,
    // 输出日志
    outputLogs: [],
    // WebSocket连接状态
    wsConnected: false,
    // 用户信息
    userInfo: null
  }),

  getters: {
    // 获取最近的命令历史
    recentCommands: (state) => {
      return state.commandHistory.slice(-10).reverse()
    },
    // 获取当前执行进度
    executionProgress: (state) => {
      if (!state.currentCommand) return 0
      return state.currentCommand.progress || 0
    }
  },

  actions: {
    // 设置WebSocket连接状态
    setWsConnected(status) {
      this.wsConnected = status
    },

    // 添加命令到历史
    addCommandToHistory(command) {
      this.commandHistory.push({
        id: Date.now(),
        command,
        timestamp: new Date().toISOString(),
        status: 'pending'
      })
    },

    // 更新命令状态
    updateCommandStatus(commandId, status) {
      const command = this.commandHistory.find(cmd => cmd.id === commandId)
      if (command) {
        command.status = status
      }
    },

    // 设置当前执行命令
    setCurrentCommand(command) {
      this.currentCommand = command
      this.isExecuting = !!command
    },

    // 添加输出日志
    addOutputLog(log) {
      this.outputLogs.push({
        id: Date.now(),
        ...log,
        timestamp: new Date().toISOString()
      })
    },

    // 清空输出日志
    clearOutputLogs() {
      this.outputLogs = []
    },

    // 设置用户信息
    setUserInfo(userInfo) {
      this.userInfo = userInfo
    },

    // 清除历史记录
    clearHistory() {
      this.commandHistory = []
    },

    // 清除会话
    clearSession() {
      this.currentSession = null
      this.commandHistory = []
      this.outputLogs = []
      this.currentCommand = null
      this.isExecuting = false
      this.userInfo = null
    },

    // 更新设置
    updateSettings(settings) {
      // 这里可以应用设置到终端
      console.log('Settings updated:', settings)
    }
  }
})