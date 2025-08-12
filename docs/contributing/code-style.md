# 📝 代码规范指南

本文档定义了AI Terminal项目的代码规范和最佳实践，确保代码质量和团队协作效率。

## 🎯 总体原则

### 📐 设计原则
- **一致性**: 保持代码风格的一致性
- **可读性**: 代码应该自解释，易于理解
- **可维护性**: 便于后期修改和扩展
- **性能**: 关注性能影响，避免不必要的计算
- **安全性**: 防范常见的安全漏洞

### 🔧 工具配置
项目使用以下工具来保证代码质量：
- **ESLint**: JavaScript/TypeScript代码检查
- **Prettier**: 代码格式化
- **Husky**: Git hooks管理
- **lint-staged**: 暂存文件检查

## 🎨 前端代码规范

### Vue.js 组件规范

#### 📂 文件命名
```
// ✅ 推荐 - PascalCase
components/
├── UserProfile.vue
├── CardGenerator.vue
├── mobile/
│   └── TabNavigation.vue

// ❌ 避免
components/
├── userprofile.vue
├── card-generator.vue
├── Mobile_Tab.vue
```

#### 🏗️ 组件结构
```vue
<template>
  <!-- 模板内容 -->
</template>

<script setup>
// 1. 导入
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

// 2. Props定义
const props = defineProps({
  title: {
    type: String,
    required: true
  },
  visible: {
    type: Boolean,
    default: false
  }
})

// 3. Emits定义
const emit = defineEmits(['update:visible', 'confirm'])

// 4. 响应式数据
const isLoading = ref(false)
const formData = reactive({
  name: '',
  email: ''
})

// 5. 计算属性
const isValid = computed(() => {
  return formData.name && formData.email
})

// 6. 方法
const handleSubmit = () => {
  if (!isValid.value) return
  emit('confirm', formData)
}

// 7. 生命周期
onMounted(() => {
  console.log('Component mounted')
})
</script>

<style scoped>
/* 样式内容 */
</style>
```

#### 🎨 模板规范
```vue
<template>
  <!-- ✅ 推荐：使用语义化的HTML标签 -->
  <main class="user-profile">
    <header class="profile-header">
      <h1 class="profile-title">{{ user.name }}</h1>
    </header>
    
    <section class="profile-content">
      <!-- 使用v-for时总是添加key -->
      <div
        v-for="item in items"
        :key="item.id"
        class="profile-item"
      >
        {{ item.name }}
      </div>
      
      <!-- 条件渲染使用v-if而不是v-show（除非需要频繁切换） -->
      <div v-if="isVisible" class="conditional-content">
        Hidden content
      </div>
    </section>
    
    <!-- 事件处理器命名明确 -->
    <footer class="profile-actions">
      <button @click="handleSave">保存</button>
      <button @click="handleCancel">取消</button>
    </footer>
  </main>
</template>
```

#### 📱 响应式设计规范
```scss
// ✅ 推荐：使用移动优先的断点
.component {
  // 移动端默认样式
  padding: 16px;
  font-size: 14px;
  
  // 平板端适配
  @media (min-width: 768px) {
    padding: 24px;
    font-size: 16px;
  }
  
  // 桌面端适配
  @media (min-width: 1024px) {
    padding: 32px;
    font-size: 18px;
  }
}

// 使用CSS变量提高可维护性
.theme-variables {
  --primary-color: #007bff;
  --secondary-color: #6c757d;
  --border-radius: 8px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
}
```

### JavaScript/TypeScript 规范

#### 🔤 命名约定
```javascript
// ✅ 推荐
// 常量使用 UPPER_SNAKE_CASE
const API_BASE_URL = 'https://api.example.com'
const MAX_RETRY_COUNT = 3

// 变量和函数使用 camelCase
const userName = 'john_doe'
const getUserProfile = async (userId) => {
  // 函数实现
}

// 类名使用 PascalCase
class UserManager {
  constructor() {
    this.users = []
  }
}

// 私有方法使用下划线前缀
class ApiService {
  _makeRequest(url) {
    // 私有方法实现
  }
  
  async fetchData(endpoint) {
    return this._makeRequest(endpoint)
  }
}
```

#### 📝 函数规范
```javascript
// ✅ 推荐：使用箭头函数处理简单逻辑
const add = (a, b) => a + b
const multiply = (a, b) => a * b

// ✅ 推荐：复杂函数使用 function 声明
async function fetchUserData(userId) {
  try {
    const response = await fetch(`/api/users/${userId}`)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch user: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('Error fetching user data:', error)
    throw error
  }
}

// ✅ 推荐：使用解构参数
function createUser({ name, email, age = 18 }) {
  return {
    id: generateId(),
    name,
    email,
    age,
    createdAt: new Date()
  }
}

// ✅ 推荐：参数验证
function calculateTotal(items) {
  if (!Array.isArray(items)) {
    throw new TypeError('items must be an array')
  }
  
  return items.reduce((total, item) => {
    if (typeof item.price !== 'number') {
      throw new TypeError('item.price must be a number')
    }
    return total + item.price
  }, 0)
}
```

#### 🔄 异步处理规范
```javascript
// ✅ 推荐：使用 async/await
async function processData() {
  try {
    const data = await fetchData()
    const processed = await transformData(data)
    await saveData(processed)
    return processed
  } catch (error) {
    console.error('Error processing data:', error)
    throw error
  }
}

// ✅ 推荐：并行处理独立操作
async function loadUserDashboard(userId) {
  const [user, posts, notifications] = await Promise.all([
    fetchUser(userId),
    fetchUserPosts(userId),
    fetchNotifications(userId)
  ])
  
  return {
    user,
    posts,
    notifications
  }
}

// ❌ 避免：回调地狱
function badAsyncCode(callback) {
  getData((data) => {
    processData(data, (processed) => {
      saveData(processed, (result) => {
        callback(result)
      })
    })
  })
}
```

## 🔧 后端代码规范

### Node.js/Express 规范

#### 📂 项目结构
```
src/
├── controllers/      # 控制器
├── services/        # 业务逻辑
├── routes/          # 路由定义
├── middleware/      # 中间件
├── models/          # 数据模型
├── utils/           # 工具函数
├── config/          # 配置文件
└── tests/           # 测试文件
```

#### 🛣️ 路由规范
```javascript
// ✅ 推荐：RESTful API设计
import express from 'express'
import { validateRequest } from '../middleware/validation.js'
import { authenticateToken } from '../middleware/auth.js'
import cardController from '../controllers/cardController.js'

const router = express.Router()

// 获取卡片列表
router.get('/cards', 
  authenticateToken,
  cardController.getCards
)

// 创建新卡片
router.post('/cards',
  authenticateToken,
  validateRequest(cardCreationSchema),
  cardController.createCard
)

// 获取单个卡片
router.get('/cards/:id',
  authenticateToken,
  cardController.getCard
)

// 更新卡片
router.put('/cards/:id',
  authenticateToken,
  validateRequest(cardUpdateSchema),
  cardController.updateCard
)

// 删除卡片
router.delete('/cards/:id',
  authenticateToken,
  cardController.deleteCard
)

export default router
```

#### 🎛️ 控制器规范
```javascript
// ✅ 推荐：控制器结构
class CardController {
  // 统一的响应格式
  _sendResponse(res, data, message = 'Success', statusCode = 200) {
    res.status(statusCode).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    })
  }
  
  _sendError(res, error, statusCode = 500) {
    console.error('Controller error:', error)
    
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      timestamp: new Date().toISOString()
    })
  }
  
  async getCards(req, res) {
    try {
      const { page = 1, limit = 10, category } = req.query
      const userId = req.user.id
      
      const cards = await cardService.getCardsByUser(userId, {
        page: parseInt(page),
        limit: parseInt(limit),
        category
      })
      
      this._sendResponse(res, cards, 'Cards retrieved successfully')
    } catch (error) {
      this._sendError(res, error)
    }
  }
  
  async createCard(req, res) {
    try {
      const { title, content, category, tags } = req.body
      const userId = req.user.id
      
      const card = await cardService.createCard({
        title,
        content,
        category,
        tags,
        userId
      })
      
      this._sendResponse(res, card, 'Card created successfully', 201)
    } catch (error) {
      if (error.name === 'ValidationError') {
        this._sendError(res, error, 400)
      } else {
        this._sendError(res, error)
      }
    }
  }
}

export default new CardController()
```

#### 🔐 安全规范
```javascript
// ✅ 推荐：输入验证和清理
import joi from 'joi'
import xss from 'xss'

const cardCreationSchema = joi.object({
  title: joi.string().min(1).max(100).required(),
  content: joi.string().min(1).max(10000).required(),
  category: joi.string().valid('tech', 'business', 'personal'),
  tags: joi.array().items(joi.string().max(50)).max(10)
})

export const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body)
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      })
    }
    
    // XSS 防护
    req.body = sanitizeObject(value)
    next()
  }
}

function sanitizeObject(obj) {
  const sanitized = {}
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = xss(value)
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => 
        typeof item === 'string' ? xss(item) : item
      )
    } else {
      sanitized[key] = value
    }
  }
  return sanitized
}
```

## 🧪 测试规范

### 单元测试
```javascript
// ✅ 推荐：测试结构
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createCard, validateCard } from '../services/cardService.js'

describe('Card Service', () => {
  beforeEach(() => {
    // 测试前的准备工作
  })
  
  afterEach(() => {
    // 测试后的清理工作
  })
  
  describe('createCard', () => {
    it('should create a card with valid data', async () => {
      // Arrange
      const cardData = {
        title: 'Test Card',
        content: 'Test content',
        category: 'tech'
      }
      
      // Act
      const result = await createCard(cardData)
      
      // Assert
      expect(result).toHaveProperty('id')
      expect(result.title).toBe(cardData.title)
      expect(result.content).toBe(cardData.content)
    })
    
    it('should throw error for invalid data', async () => {
      // Arrange
      const invalidData = {
        title: '', // 无效的空标题
        content: 'Test content'
      }
      
      // Act & Assert
      await expect(createCard(invalidData)).rejects.toThrow('Title is required')
    })
  })
})
```

### E2E测试
```javascript
// ✅ 推荐：端到端测试
import { test, expect } from '@playwright/test'

test.describe('Card Generator', () => {
  test('should create a new card successfully', async ({ page }) => {
    // 导航到卡片生成页面
    await page.goto('/card-generator')
    
    // 填写卡片信息
    await page.fill('[data-testid="card-title"]', 'Test Card')
    await page.fill('[data-testid="card-content"]', 'This is a test card')
    await page.selectOption('[data-testid="card-category"]', 'tech')
    
    // 提交表单
    await page.click('[data-testid="create-card-btn"]')
    
    // 验证结果
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible()
    await expect(page.locator('[data-testid="card-list"]')).toContainText('Test Card')
  })
})
```

## 📚 文档规范

### JSDoc 注释
```javascript
/**
 * 创建新的知识卡片
 * @param {Object} cardData - 卡片数据
 * @param {string} cardData.title - 卡片标题
 * @param {string} cardData.content - 卡片内容
 * @param {string} [cardData.category='general'] - 卡片分类
 * @param {string[]} [cardData.tags=[]] - 卡片标签
 * @param {string} userId - 用户ID
 * @returns {Promise<Object>} 创建的卡片对象
 * @throws {ValidationError} 当输入数据无效时抛出
 * @throws {DatabaseError} 当数据库操作失败时抛出
 * 
 * @example
 * const card = await createCard({
 *   title: 'JavaScript基础',
 *   content: '变量、函数、对象...',
 *   category: 'tech',
 *   tags: ['javascript', 'programming']
 * }, 'user123')
 */
async function createCard(cardData, userId) {
  // 函数实现
}
```

### README文档
```markdown
# 组件名称

## 概述
简要描述组件的用途和功能。

## 使用方法
\`\`\`vue
<template>
  <MyComponent :prop1="value1" @event1="handler1" />
</template>
\`\`\`

## Props
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| prop1 | String | '' | 属性说明 |

## Events
| 事件名 | 参数 | 说明 |
|--------|------|------|
| event1 | value | 事件说明 |

## 示例
详细的使用示例。
```

## 🔄 Git规范

### 提交信息格式
```bash
# 格式：<type>(<scope>): <description>

# 类型说明：
# feat: 新功能
# fix: 修复bug
# docs: 文档更新
# style: 代码格式化（不影响功能）
# refactor: 重构代码
# test: 添加测试
# chore: 构建过程或辅助工具的变动

# 示例：
feat(cards): 添加卡片分类筛选功能
fix(terminal): 修复移动端键盘遮挡问题
docs(api): 更新API文档中的认证说明
style(components): 统一组件的代码格式
refactor(services): 重构用户服务模块
test(cards): 添加卡片创建的单元测试
chore(deps): 升级Vue到最新版本
```

### 分支命名
```bash
# 功能分支
feature/card-export-functionality
feature/mobile-responsive-design

# 修复分支
fix/terminal-connection-issue
fix/mobile-keyboard-overlay

# 发布分支
release/v1.2.0

# 热修复分支
hotfix/security-vulnerability
```

## 🔍 代码审查清单

### 🎯 功能检查
- [ ] 功能是否按需求正确实现
- [ ] 是否处理了所有边界情况
- [ ] 错误处理是否充分
- [ ] 性能是否满足要求

### 🎨 代码质量
- [ ] 代码是否易于理解
- [ ] 命名是否恰当
- [ ] 函数是否职责单一
- [ ] 是否遵循了设计原则

### 🔒 安全检查
- [ ] 输入是否经过验证
- [ ] 是否存在XSS风险
- [ ] 敏感信息是否被保护
- [ ] 权限控制是否正确

### 📱 移动端检查
- [ ] 响应式设计是否正确
- [ ] 触控操作是否友好
- [ ] 性能在移动设备上是否良好
- [ ] 是否适配了不同屏幕尺寸

### 🧪 测试覆盖
- [ ] 是否有足够的单元测试
- [ ] 集成测试是否覆盖关键流程
- [ ] 是否有端到端测试

---

## 🛠️ 开发工具配置

### VSCode设置
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.validate": [
    "javascript",
    "typescript",
    "vue"
  ],
  "vetur.validation.template": false,
  "vetur.validation.script": false,
  "vetur.validation.style": false
}
```

### ESLint配置示例
```javascript
module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  extends: [
    'eslint:recommended',
    '@vue/eslint-config-typescript',
    'prettier'
  ],
  rules: {
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'vue/multi-word-component-names': 'off',
    '@typescript-eslint/no-unused-vars': 'error'
  }
}
```

---

📝 代码规范是团队协作的基础，遵循这些规范将帮助我们构建更高质量、更易维护的代码库！