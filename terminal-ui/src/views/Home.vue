<template>
  <div class="login-container">
    <div v-if="checking" class="loading-container">
      <el-icon class="is-loading" :size="32">
        <Loading />
      </el-icon>
      <p>正在验证登录状态...</p>
    </div>
    
    <div v-else class="login-card">
      <div class="login-header">
        <h1 class="logo-title">cardplanet</h1>
        <p>请登录以继续</p>
      </div>
      
      <el-form
        ref="loginFormRef"
        :model="loginForm"
        :rules="loginRules"
        class="login-form"
        @submit.prevent="handleLogin"
      >
        <el-form-item prop="username">
          <el-input
            v-model="loginForm.username"
            placeholder="用户名"
            prefix-icon="User"
            size="large"
          />
        </el-form-item>
        
        <el-form-item prop="password">
          <el-input
            v-model="loginForm.password"
            type="password"
            placeholder="密码"
            prefix-icon="Lock"
            size="large"
            show-password
            @keyup.enter="handleLogin"
          />
        </el-form-item>
        
        <el-form-item>
          <el-checkbox v-model="loginForm.remember">记住我</el-checkbox>
        </el-form-item>
        
        <el-form-item>
          <el-button
            type="primary"
            size="large"
            class="login-button"
            :loading="loading"
            @click="handleLogin"
          >
            登录
          </el-button>
        </el-form-item>
      </el-form>
    
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'
import { useUserStore } from '../store/user'
import request from '../api/config'

const router = useRouter()
const userStore = useUserStore()
const loginFormRef = ref()
const loading = ref(false)
const checking = ref(true)

const loginForm = reactive({
  username: '',
  password: '',
  remember: false
})

const loginRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于6位', trigger: 'blur' }
  ]
}

const handleLogin = async () => {
  const valid = await loginFormRef.value.validate()
  if (!valid) return
  
  loading.value = true
  
  try {
    const res = await request.post('/auth/login', {
      username: loginForm.username,
      password: loginForm.password
    })
    
    // 保存token和用户信息
    localStorage.setItem('token', res.data.token)
    // 始终保存当前登录的用户名，用于显示
    localStorage.setItem('username', loginForm.username)
    
    // 如果选择记住我，保存密码（实际生产环境应该加密）
    if (loginForm.remember) {
      localStorage.setItem('rememberedUsername', loginForm.username)
    } else {
      localStorage.removeItem('rememberedUsername')
    }
    
    // 保存用户信息到store
    userStore.setUserInfo(res.data.user)
    
    ElMessage.success('登录成功')
    router.push('/card-generator')
  } catch (error) {
    ElMessage.error(error.message || '登录失败')
  } finally {
    loading.value = false
  }
}

// 验证已存在的token
const verifyToken = async () => {
  const token = localStorage.getItem('token')
  if (!token) {
    checking.value = false
    return false
  }
  
  try {
    // 验证token是否有效
    const res = await request.get('/auth/verify')
    if (res.data && res.data.valid) {
      // Token有效，保存用户信息并跳转
      userStore.setUserInfo(res.data.user)
      ElMessage.success('自动登录成功')
      router.push('/card-generator')
      return true
    }
  } catch (error) {
    // Token无效，清除并显示登录界面
    localStorage.removeItem('token')
    console.log('Token验证失败:', error.message)
  }
  
  checking.value = false
  return false
}

onMounted(async () => {
  // 首先尝试自动登录
  const autoLoggedIn = await verifyToken()
  
  if (!autoLoggedIn) {
    // 如果没有自动登录，检查是否有记住的用户名
    const savedUsername = localStorage.getItem('rememberedUsername')
    if (savedUsername) {
      loginForm.username = savedUsername
      loginForm.remember = true
    }
  }
})
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.loading-container {
  text-align: center;
  color: white;
}

.loading-container p {
  margin-top: 16px;
  font-size: 16px;
}

.login-card {
  width: 400px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.login-header {
  padding: 40px 40px 30px;
  text-align: center;
  background: #f5f7fa;
}

.login-header h1 {
  margin: 0 0 10px;
  font-size: 28px;
  color: #303133;
}

.logo-title {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-weight: bold;
  letter-spacing: 1px;
}

.login-header p {
  margin: 0;
  color: #909399;
}

.login-form {
  padding: 30px 40px;
}

.login-button {
  width: 100%;
}

.login-footer {
  padding: 20px 40px;
  text-align: center;
  background: #f5f7fa;
  color: #909399;
  font-size: 14px;
}

.login-footer p {
  margin: 0;
}
</style>