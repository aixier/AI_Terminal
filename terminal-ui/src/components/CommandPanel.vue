<template>
  <div class="command-panel">
    <div class="command-categories">
      <el-tabs v-model="activeCategory">
        <el-tab-pane
          v-for="category in categories"
          :key="category.id"
          :label="category.name"
          :name="category.id"
        >
          <div class="command-grid">
            <el-card
              v-for="cmd in getCommandsByCategory(category.id)"
              :key="cmd.id"
              class="command-card"
              :class="{ danger: cmd.danger }"
              @click="selectCommand(cmd)"
            >
              <div class="command-info">
                <div class="command-name">
                  <el-icon v-if="cmd.danger" color="#f56c6c"><Warning /></el-icon>
                  {{ cmd.name }}
                </div>
                <div class="command-desc">{{ cmd.description }}</div>
                <div class="command-preview">
                  <code>{{ cmd.command }}</code>
                </div>
              </div>
            </el-card>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <!-- 命令参数对话框 -->
    <el-dialog
      v-model="paramDialogVisible"
      :title="`配置命令参数 - ${selectedCommand?.name}`"
      width="600px"
    >
      <el-form v-if="selectedCommand" :model="commandParams" label-width="120px">
        <el-form-item
          v-for="param in selectedCommand.parameters"
          :key="param.name"
          :label="param.description"
          :required="param.required"
        >
          <el-input
            v-if="param.type === 'string'"
            v-model="commandParams[param.name]"
            :placeholder="param.default || '请输入'"
          />
          <el-input-number
            v-else-if="param.type === 'number'"
            v-model="commandParams[param.name]"
            :min="0"
            :placeholder="param.default"
          />
          <el-switch
            v-else-if="param.type === 'boolean'"
            v-model="commandParams[param.name]"
          />
        </el-form-item>
      </el-form>
      
      <div class="command-preview-dialog">
        <h4>命令预览：</h4>
        <el-alert :closable="false" type="info">
          <code>{{ buildCommand() }}</code>
        </el-alert>
      </div>

      <template #footer>
        <el-button @click="paramDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          @click="executeSelectedCommand"
          :disabled="!validateParams()"
        >
          执行命令
        </el-button>
      </template>
    </el-dialog>

    <!-- 危险命令确认对话框 -->
    <el-dialog
      v-model="confirmDialogVisible"
      title="危险操作确认"
      width="400px"
    >
      <el-alert type="warning" :closable="false" show-icon>
        <template #title>
          您即将执行一个危险操作，这可能会对系统造成不可逆的影响。
        </template>
      </el-alert>
      <div class="confirm-command">
        <code>{{ pendingCommand }}</code>
      </div>
      <template #footer>
        <el-button @click="confirmDialogVisible = false">取消</el-button>
        <el-button type="danger" @click="confirmExecute">确认执行</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useTerminalStore } from '../store/terminal'
import websocket from '../services/websocket'
import request from '../api/config'

const terminalStore = useTerminalStore()

const activeCategory = ref('file')
const categories = ref([])
const commands = ref([])
const selectedCommand = ref(null)
const commandParams = reactive({})
const paramDialogVisible = ref(false)
const confirmDialogVisible = ref(false)
const pendingCommand = ref('')

onMounted(async () => {
  await loadCommands()
})

const loadCommands = async () => {
  try {
    const res = await request.get('/commands')
    categories.value = res.data.categories
    commands.value = res.data.commands
  } catch (error) {
    ElMessage.error('加载命令列表失败')
  }
}

const getCommandsByCategory = (categoryId) => {
  return commands.value.filter(cmd => cmd.category === categoryId)
}

const selectCommand = (cmd) => {
  selectedCommand.value = cmd
  // 重置参数
  Object.keys(commandParams).forEach(key => delete commandParams[key])
  
  // 设置默认参数
  cmd.parameters.forEach(param => {
    if (param.default !== undefined) {
      commandParams[param.name] = param.default
    }
  })

  if (cmd.parameters.length > 0) {
    paramDialogVisible.value = true
  } else {
    // 没有参数直接执行
    executeCommand(cmd.command)
  }
}

const buildCommand = () => {
  if (!selectedCommand.value) return ''
  
  let command = selectedCommand.value.command
  const params = []

  selectedCommand.value.parameters.forEach(param => {
    const value = commandParams[param.name]
    if (value !== undefined && value !== '' && value !== false) {
      if (param.type === 'boolean' && value) {
        params.push(param.flag)
      } else if (param.type !== 'boolean') {
        if (param.flag) {
          params.push(`${param.flag} ${value}`)
        } else {
          params.push(value)
        }
      }
    }
  })

  if (params.length > 0) {
    command += ' ' + params.join(' ')
  }

  return command
}

const validateParams = () => {
  if (!selectedCommand.value) return false
  
  for (const param of selectedCommand.value.parameters) {
    if (param.required && !commandParams[param.name]) {
      return false
    }
  }
  return true
}

const executeSelectedCommand = () => {
  const command = buildCommand()
  paramDialogVisible.value = false
  executeCommand(command)
}

const executeCommand = async (command) => {
  // 验证命令
  try {
    const res = await request.post('/commands/validate', { command })
    const validation = res.data
    
    if (!validation.valid) {
      ElMessage.error(validation.reason || '命令验证失败')
      return
    }

    if (validation.requireConfirm) {
      pendingCommand.value = command
      confirmDialogVisible.value = true
      return
    }

    // 执行命令
    doExecuteCommand(command)
  } catch (error) {
    ElMessage.error('命令验证失败')
  }
}

const confirmExecute = () => {
  confirmDialogVisible.value = false
  doExecuteCommand(pendingCommand.value)
}

const doExecuteCommand = (command) => {
  // 记录命令历史
  terminalStore.addCommandToHistory(command)
  
  // 显示命令
  terminalStore.addOutputLog({
    type: 'command',
    data: `$ ${command}`
  })

  // 发送命令
  websocket.sendInput(command + '\n')
  
  ElMessage.success('命令已执行')
  
  // 保存命令历史到后端
  request.post('/commands/history', {
    command: {
      command,
      success: true,
      output: ''
    }
  }).catch(() => {
    // 忽略历史记录保存失败
  })
}
</script>

<style scoped>
.command-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #fff;
  border-radius: 8px;
  padding: 20px;
  overflow: hidden;
}

.command-categories {
  flex: 1;
  overflow-y: auto;
}

.command-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  padding: 20px 0;
}

.command-card {
  cursor: pointer;
  transition: all 0.3s;
}

.command-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.command-card.danger {
  border-left: 4px solid #f56c6c;
}

.command-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.command-name {
  font-size: 16px;
  font-weight: 500;
  color: #303133;
  display: flex;
  align-items: center;
  gap: 6px;
}

.command-desc {
  font-size: 14px;
  color: #606266;
  line-height: 1.4;
}

.command-preview {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #ebeef5;
}

.command-preview code {
  display: block;
  padding: 6px 10px;
  background-color: #f5f7fa;
  border-radius: 4px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  color: #606266;
}

.command-preview-dialog {
  margin-top: 20px;
}

.command-preview-dialog h4 {
  margin-bottom: 10px;
  color: #303133;
}

.confirm-command {
  margin: 20px 0;
  padding: 12px;
  background-color: #fef0f0;
  border-radius: 4px;
  text-align: center;
}

.confirm-command code {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 14px;
  color: #f56c6c;
}

/* 自定义滚动条 */
.command-categories::-webkit-scrollbar {
  width: 6px;
}

.command-categories::-webkit-scrollbar-track {
  background: #f5f7fa;
}

.command-categories::-webkit-scrollbar-thumb {
  background: #dcdfe6;
  border-radius: 3px;
}

.command-categories::-webkit-scrollbar-thumb:hover {
  background: #c0c4cc;
}
</style>