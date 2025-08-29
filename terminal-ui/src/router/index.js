import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    name: 'Home',
    component: Home,
    meta: { 
      requiresAuth: false,
      title: '终端能力友好化系统',
      description: '通过友好的Web界面执行复杂的终端命令'
    }
  },
  {
    path: '/terminal',
    name: 'Terminal',
    component: () => import('../views/TerminalEngineTest.vue'),
    meta: { 
      requiresAuth: false,
      title: 'Terminal',
      description: 'AI Terminal - Web Terminal Interface'
    }
  },
  {
    path: '/card-generator',
    name: 'CardGenerator',
    component: () => import('../views/CardGenerator/CardGenerator.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/history',
    name: 'History',
    component: () => import('../views/History.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('../views/Settings.vue'),
    meta: { requiresAuth: true }
  },
  // Terminal Engine 测试页面 - 独立验证新引擎
  {
    path: '/terminal-engine-test',
    name: 'TerminalEngineTest',
    component: () => import('../views/TerminalEngineTest.vue'),
    meta: { 
      requiresAuth: false,
      title: 'Terminal Engine 测试',
      description: '独立验证新Terminal Engine的功能和性能'
    }
  },
  // 简化Terminal测试页面 - 调试用
  {
    path: '/simple-terminal-test',
    name: 'SimpleTerminalTest',
    component: () => import('../views/SimpleTerminalTest.vue'),
    meta: { 
      requiresAuth: false,
      title: 'Terminal Engine 调试',
      description: '简化的Terminal Engine调试页面'
    }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 路由守卫
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')
  
  if (to.meta.requiresAuth && !token) {
    // 需要认证但没有token，跳转到登录页
    next('/login')
  } else if (to.path === '/login' && token) {
    // 已登录用户访问登录页，跳转到首页
    next('/')
  } else {
    next()
  }
})

export default router