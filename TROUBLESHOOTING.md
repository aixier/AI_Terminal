# AI Terminal 项目故障排除指南

## 前端API响应处理常见问题

### 问题1: 模板列表不显示 - Axios响应拦截器数据结构错位

#### 🐛 问题描述
- **症状**: 右边栏模板列表为空，不显示 `public_template` 目录下的模板
- **日志特征**: 
  ```
  [Templates] API Response received: {
    status: undefined, 
    success: undefined, 
    hasData: false
  }
  ```

#### 🔍 问题根因
**Axios响应拦截器影响数据结构**：
- `src/api/config.js:58` 处的响应拦截器返回 `response.data` 而不是完整的 `response` 对象
- 导致前端代码访问错误的数据路径

**错误的数据访问**：
```javascript
// ❌ 错误：axios拦截器已返回response.data，这里实际访问response.data.data
if (response.data.success && response.data.data) {
  // 永远不会执行，因为response.data.data不存在
}
```

**正确的数据访问**：
```javascript
// ✅ 正确：直接访问拦截器返回的数据
if (response.success && response.data) {
  // response就是原始的response.data
}
```

#### 💡 解决方案
1. **理解axios拦截器行为**：
   ```javascript
   // src/api/config.js 响应拦截器
   service.interceptors.response.use(response => {
     const res = response.data  // 提取响应体
     return res                 // 返回响应体而非完整response对象
   })
   ```

2. **修正前端数据访问**：
   ```javascript
   // 修改前
   if (response.data.success && response.data.data) {
     processTemplates(response.data.data)
   }
   
   // 修改后  
   if (response.success && response.data) {
     processTemplates(response.data)
   }
   ```

3. **API响应结构对比**：
   ```json
   // 后端实际返回
   {
     "success": true,
     "data": [...],
     "message": "目录结构获取成功"
   }
   
   // 经过axios拦截器后，前端收到的response对象
   {
     "success": true,     // 直接访问response.success
     "data": [...],       // 直接访问response.data
     "message": "目录结构获取成功"
   }
   ```

#### 🔧 修复步骤
1. **定位问题**：
   ```javascript
   console.log('[DEBUG] Full response:', response)
   console.log('[DEBUG] Response keys:', Object.keys(response))
   ```

2. **修正代码**：
   - 移除多余的 `.data` 访问层级
   - 直接使用 `response.success` 和 `response.data`

3. **重新构建**：
   ```bash
   cd terminal-ui && npm run build
   ```

4. **强制刷新浏览器缓存**：
   - Chrome/Firefox: `Ctrl+F5` 或 `Cmd+Shift+R`

### 问题2: Token传递问题导致用户数据隔离失效

#### 🐛 问题描述
- **症状**: 已登录用户生成的文件保存到default用户目录
- **影响范围**: 桌面端SSE流式接口不传递token

#### 💡 解决方案
1. **桌面端fetch请求添加token**：
   ```javascript
   // 修改前：原生fetch没有token
   const response = await fetch('/api/generate/card/stream', {
     method: 'POST', 
     headers: { 'Content-Type': 'application/json' }
   })
   
   // 修改后：手动添加token
   const token = localStorage.getItem('token')
   const headers = { 'Content-Type': 'application/json' }
   if (token) {
     headers['Authorization'] = `Bearer ${token}`
   }
   
   const response = await fetch('/api/generate/card/stream', {
     method: 'POST',
     headers
   })
   ```

2. **移动端使用配置好的axios实例**：
   ```javascript
   // 修改前：直接导入原生axios
   import axios from 'axios'
   
   // 修改后：使用配置好的axios实例
   import axios from '../api/config.js'
   ```

### 问题3: URL路径重复导致404错误

#### 🐛 问题描述
- **症状**: API请求返回404错误
- **错误URL**: `GET /api/api/upload/structure 404`

#### 🔍 问题根因
- axios配置 `baseURL = '/api'`
- 请求路径写成 `/api/upload/structure`
- 最终URL: `/api` + `/api/upload/structure` = `/api/api/upload/structure`

#### 💡 解决方案
```javascript
// 修改前
const response = await axios.get('/api/upload/structure')  // 导致/api/api/...

// 修改后  
const response = await axios.get('/upload/structure')      // 正确: /api/upload/structure
```

### 问题4: 未定义变量引用错误

#### 🐛 问题描述
- **错误**: `ReferenceError: terminalService is not defined`
- **触发时机**: 组件卸载时

#### 💡 解决方案
```javascript
// 修改前：引用未导入的service
onBeforeUnmount(() => {
  if (terminalService) {
    terminalService.cleanup()  // ❌ 未定义
  }
})

// 修改后：移除未定义的引用
onBeforeUnmount(() => {
  // 清理终端相关资源通过API完成
  console.log('[Component] Cleaned up successfully')
})
```

## 🛠️ 调试最佳实践

### 1. 添加详细日志
```javascript
console.log('[Feature] 🔄 Starting operation...')
console.log('[Feature] ✅ Success:', data)
console.log('[Feature] ❌ Error:', error) 
console.log('[Feature] 🔍 DEBUG:', debugInfo)
```

### 2. API测试方法
```bash
# 直接测试API端点
curl -X GET "http://127.0.0.1:8083/api/upload/structure" \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json"
```

### 3. 响应结构验证
```javascript
// 完整响应结构调试
console.log('Response keys:', Object.keys(response))
console.log('Data type:', typeof response.data)  
console.log('Is array?:', Array.isArray(response.data))
```

### 4. 前端构建与缓存
```bash
# 重新构建
npm run build

# 清除浏览器缓存
# Chrome/Firefox: Ctrl+F5 或 Cmd+Shift+R
```

## 📋 检查清单

### API集成问题排查
- [ ] 直接curl测试API端点是否正常
- [ ] 检查axios拦截器对响应数据的处理
- [ ] 验证前端数据访问路径是否正确
- [ ] 确认token是否正确传递
- [ ] 检查URL路径拼接是否重复

### 前端开发问题排查  
- [ ] 检查import路径是否正确
- [ ] 确认变量是否已定义和导入
- [ ] 验证组件生命周期函数逻辑
- [ ] 重新构建前端代码
- [ ] 清除浏览器缓存并强制刷新

---

**更新时间**: 2025-08-25  
**适用版本**: AI Terminal v3.33+