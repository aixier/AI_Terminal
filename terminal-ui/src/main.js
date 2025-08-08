import { createApp } from 'vue'
import './style.css'
import './styles/fluent-theme.css'
// 导入设计系统
import './design-system/global.css'
import { DesignSystemPlugin } from './design-system'
import App from './App.vue'

// Element Plus
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

// Router
import router from './router'

// Store
import store from './store'

const app = createApp(App)

// 注册Element Plus图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(ElementPlus, {
  locale: zhCn,
})
app.use(router)
app.use(store)
// 使用设计系统插件
app.use(DesignSystemPlugin)

app.mount('#app')
