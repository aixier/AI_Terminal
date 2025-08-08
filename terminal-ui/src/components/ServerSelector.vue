<template>
  <div class="server-selector">
    <el-dropdown trigger="click" @command="handleServerChange">
      <el-button type="text" class="server-btn">
        <span class="server-icon">🌐</span>
        <span class="server-name">{{ currentServer.name }}</span>
        <el-icon class="el-icon--right"><arrow-down /></el-icon>
      </el-button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item 
            v-for="(server, key) in servers" 
            :key="key"
            :command="key"
            :disabled="currentServerKey === key"
          >
            <span class="server-option">
              <span class="server-status" :class="{ active: currentServerKey === key }"></span>
              <div class="server-info">
                <div class="server-title">{{ server.name }}</div>
                <div class="server-detail">
                  <span class="server-url">{{ server.url }}</span>
                  <span v-if="server.description" class="server-desc">{{ server.description }}</span>
                </div>
              </div>
            </span>
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ArrowDown } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { API_SERVERS, getCurrentServer, switchServer } from '../config/api.config'

const servers = ref(API_SERVERS)
const currentServer = ref(getCurrentServer())
const currentServerKey = ref('')

// 获取当前服务器的key
const getCurrentServerKey = () => {
  for (const [key, server] of Object.entries(API_SERVERS)) {
    if (server.url === currentServer.value.url) {
      return key
    }
  }
  return 'local'
}

// 处理服务器切换
const handleServerChange = async (serverKey) => {
  if (serverKey === currentServerKey.value) return
  
  ElMessage.info(`切换到${API_SERVERS[serverKey].name}...`)
  
  // 切换服务器
  const success = await switchServer(serverKey)
  if (success) {
    ElMessage.success(`已切换到${API_SERVERS[serverKey].name}`)
  } else {
    ElMessage.error('切换失败')
  }
}

onMounted(() => {
  currentServerKey.value = getCurrentServerKey()
})
</script>

<style scoped>
.server-selector {
  display: inline-flex;
  align-items: center;
}

.server-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: #fff;
  transition: all 0.3s;
}

.server-btn:hover {
  background: rgba(255, 255, 255, 0.15);
}

.server-icon {
  font-size: 16px;
}

.server-name {
  font-size: 13px;
  font-weight: 500;
}

.server-option {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  padding: 4px 0;
}

.server-status {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ccc;
  margin-top: 4px;
  flex-shrink: 0;
}

.server-status.active {
  background: #67c23a;
}

.server-info {
  flex: 1;
  min-width: 0;
}

.server-title {
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 2px;
}

.server-detail {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.server-url {
  font-size: 11px;
  color: #999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.server-desc {
  font-size: 10px;
  color: #aaa;
  font-style: italic;
}

:deep(.el-dropdown-menu) {
  min-width: 350px;
}

:deep(.el-dropdown-menu__item) {
  padding: 8px 16px;
}

:deep(.el-dropdown-menu__item.is-disabled) {
  background: rgba(74, 158, 255, 0.05);
}
</style>