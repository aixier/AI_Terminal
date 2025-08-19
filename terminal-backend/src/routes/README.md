# API Routes 路由模块说明

本目录包含AI Terminal后端的所有API路由模块。每个模块负责处理特定功能领域的HTTP请求。

## 📁 模块列表

### 1. **auth.js** - 认证授权
- 用户登录验证
- Token生成与验证
- 用户管理
- 权限控制

### 2. **terminal.js** - 终端管理
- 终端会话创建与管理
- 命令执行
- 文件夹和卡片管理
- 模板管理
- HTML内容保存与获取

### 3. **generate.js** - AI生成
- 卡片生成（标准版和流式版）
- 动态参数生成（style、language、reference）
- 模板管理
- 直接Claude命令执行（/cc接口）

### 4. **workspace.js** - 工作空间
- 用户工作空间管理
- 文件CRUD操作
- 目录结构管理
- 工作空间迁移

### 5. **sse.js** - 服务器推送事件
- 实时事件流
- 文件检测通知
- 生成进度推送
- 状态更新

### 6. **upload.js** - 文件上传
- 批量文件上传
- 文件夹创建
- 文件系统结构查询
- 文件删除

### 7. **claude.js** - Claude AI集成
- Claude命令执行
- AI会话管理
- 文件夹获取
- 健康检查

### 8. **commands.js** - 命令管理
- 命令列表获取
- 命令验证
- 历史记录管理

### 9. **preview.js** - 预览功能
- URL元数据获取
- 内容抓取
- 截图生成
- 代理请求

## 🔐 认证机制

### JWT Token认证
大部分API使用JWT Token进行认证：
```javascript
// 中间件示例
import { authenticateUser } from '../middleware/userAuth.js'
router.get('/protected', authenticateUser, handler)
```

### 默认用户回退
部分API支持未认证用户使用默认账户：
```javascript
import { authenticateUserOrDefault } from '../middleware/userAuth.js'
router.get('/public', authenticateUserOrDefault, handler)
```

## 📝 路由注册

所有路由在 `index.js` 中统一注册：
```javascript
app.use('/api/auth', authRoutes)
app.use('/api/terminal', terminalRoutes)
app.use('/api/generate', generateRoutes)
app.use('/api/workspace', workspaceRoutes)
// ... 其他路由
```

## 🎯 最佳实践

### 1. 错误处理
```javascript
router.post('/endpoint', async (req, res) => {
  try {
    // 业务逻辑
    res.json({ code: 200, success: true, data: result })
  } catch (error) {
    console.error('[Module] Error:', error)
    res.status(500).json({ 
      code: 500, 
      success: false, 
      error: error.message 
    })
  }
})
```

### 2. 参数验证
```javascript
// 验证必需参数
if (!param || typeof param !== 'string') {
  return res.status(400).json({
    code: 400,
    success: false,
    message: '参数错误'
  })
}
```

### 3. 日志记录
```javascript
console.log(`[Module] Operation started: ${operation}`)
// 使用统一的日志格式
```

## 🚀 新增功能

### /api/generate/cc 接口 (v3.10.3)
快速执行Claude命令的简化接口：
- 无需复杂的卡片生成流程
- 直接返回AI响应
- 支持超时控制

### 工作空间API (v3.10.3)
完整的用户工作空间管理：
- 文件CRUD操作
- 目录结构管理
- 多用户支持

## 📊 性能优化

1. **流式传输**: 卡片生成支持SSE流式传输
2. **会话复用**: 终端会话池管理
3. **缓存机制**: 模板和静态资源缓存
4. **并发控制**: 限制同时执行的AI请求数

## 🔧 开发指南

### 添加新路由
1. 在 `routes/` 目录创建新模块
2. 导出Express Router实例
3. 在 `index.js` 中注册路由
4. 更新API文档

### 测试路由
```bash
# 健康检查
curl http://localhost:6000/api/terminal/health

# 带认证的请求
curl -H "Authorization: Bearer <token>" \
     http://localhost:6000/api/terminal/sessions
```

## 📚 相关文档

- [完整API文档](../../API_DOCUMENTATION.md)
- [部署指南](../../docs/deployment.md)
- [开发者指南](../../docs/developer-guide.md)

---

*最后更新: 2025-01-19*