<template>
  <div class="settings-page">
    <el-card>
      <template #header>
        <span>系统设置</span>
      </template>
      
      <el-form :model="settings" label-width="120px">
        <el-form-item label="服务器选择">
          <el-select v-model="settings.apiServer" placeholder="请选择服务器" @change="handleServerChange">
            <el-option label="本地服务器 (localhost:6000)" value="local" />
            <el-option label="Docker服务 (localhost:6001)" value="docker" />
            <el-option label="云端服务器 (阿里云)" value="cloud" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="终端主题">
          <el-select v-model="settings.theme" placeholder="请选择主题">
            <el-option label="暗色" value="dark" />
            <el-option label="亮色" value="light" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="字体大小">
          <el-slider v-model="settings.fontSize" :min="12" :max="24" show-input />
        </el-form-item>
        
        <el-form-item label="历史记录数量">
          <el-input-number v-model="settings.historyLimit" :min="10" :max="1000" />
        </el-form-item>
        
        <el-form-item label="命令超时时间">
          <el-input-number v-model="settings.commandTimeout" :min="5" :max="300" />
          <span class="ml-2">秒</span>
        </el-form-item>
        
        <el-form-item label="自动保存">
          <el-switch v-model="settings.autoSave" />
        </el-form-item>
        
        <el-form-item>
          <el-button type="primary" @click="saveSettings">保存设置</el-button>
          <el-button @click="resetSettings">恢复默认</el-button>
        </el-form-item>
      </el-form>
    </el-card>
    
    <el-card style="margin-top: 20px;">
      <template #header>
        <span>账户信息</span>
      </template>
      
      <el-descriptions :column="1" border>
        <el-descriptions-item label="用户名">{{ userInfo.username }}</el-descriptions-item>
        <el-descriptions-item label="邮箱">{{ userInfo.email }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ formatTime(userInfo.createdAt) }}</el-descriptions-item>
      </el-descriptions>
      
      <div style="margin-top: 20px;">
        <el-button type="danger" @click="logout">退出登录</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useTerminalStore } from '../store/terminal'
import { switchServer, getCurrentServer } from '../config/api.config'

const router = useRouter()
const terminalStore = useTerminalStore()

const settings = ref({
  apiServer: 'local',
  theme: 'dark',
  fontSize: 14,
  historyLimit: 100,
  commandTimeout: 60,
  autoSave: true
})

const userInfo = ref({
  username: 'admin',
  email: 'admin@example.com',
  createdAt: new Date()
})

const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleString('zh-CN')
}

const loadSettings = () => {
  const savedSettings = localStorage.getItem('terminalSettings')
  if (savedSettings) {
    settings.value = JSON.parse(savedSettings)
  }
  
  // 获取当前服务器设置
  const currentServer = getCurrentServer()
  const serverKey = localStorage.getItem('api_server') || 'local'
  settings.value.apiServer = serverKey
}

const handleServerChange = async (value) => {
  try {
    await ElMessageBox.confirm(
      '切换服务器将会刷新页面，是否继续？',
      '提示',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    // 切换服务器
    await switchServer(value)
  } catch {
    // 用户取消，恢复原值
    const currentKey = localStorage.getItem('api_server') || 'local'
    settings.value.apiServer = currentKey
  }
}

const saveSettings = () => {
  localStorage.setItem('terminalSettings', JSON.stringify(settings.value))
  terminalStore.updateSettings(settings.value)
  ElMessage.success('设置已保存')
}

const resetSettings = () => {
  settings.value = {
    apiServer: 'local',
    theme: 'dark',
    fontSize: 14,
    historyLimit: 100,
    commandTimeout: 60,
    autoSave: true
  }
  ElMessage.info('已恢复默认设置')
}

const logout = () => {
  localStorage.removeItem('token')
  terminalStore.clearSession()
  router.push('/login')
  ElMessage.success('已退出登录')
}

onMounted(() => {
  loadSettings()
})
</script>

<style scoped>
.settings-page {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.ml-2 {
  margin-left: 8px;
}
</style>