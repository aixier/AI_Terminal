<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <h1>终端控制台</h1>
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
      
      <div class="login-footer">
        <p>默认账号：admin / admin123</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useTerminalStore } from '../store/terminal'
import request from '../api/config'

const router = useRouter()
const terminalStore = useTerminalStore()
const loginFormRef = ref()
const loading = ref(false)

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
    
    // 保存用户信息到store
    terminalStore.setUserInfo(res.data.user)
    
    ElMessage.success('登录成功')
    router.push('/card-generator')
  } catch (error) {
    ElMessage.error(error.message || '登录失败')
  } finally {
    loading.value = false
  }
}

// 自动填充记住的用户名
const savedUsername = localStorage.getItem('username')
if (savedUsername) {
  loginForm.username = savedUsername
  loginForm.remember = true
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-card {
  width: 400px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  overflow: hidden;
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