# Generate.js 重构计划

## 📊 现状分析
- 文件大小：1670行
- API端点数：7个
- 问题：文件过大，维护困难

## 🎯 重构目标
将 `generate.js` 拆分为多个模块化文件，提高可维护性

## 📁 建议的文件结构

```
terminal-backend/src/routes/
├── generate/
│   ├── index.js          # 主路由文件，组合所有子路由
│   ├── card.js           # 卡片生成相关 (POST /card)
│   ├── cardAsync.js      # 异步卡片生成 (POST /card/async)
│   ├── cardStream.js     # 流式卡片生成 (POST /card/stream)
│   ├── cardQuery.js      # 卡片查询 (GET /card/query/:folderName)
│   ├── templates.js      # 模板管理 (GET /templates)
│   ├── status.js         # 状态查询 (GET /status/:topic)
│   ├── claude.js         # Claude执行 (POST /cc)
│   └── utils/
│       ├── promptBuilder.js    # 提示词构建工具
│       ├── fileWatcher.js      # 文件监控工具
│       └── responseFormatter.js # 响应格式化工具
```

## 📋 拆分方案

### 1. **card.js** (~530行)
- 核心卡片生成逻辑
- POST /card

### 2. **cardAsync.js** (~150行)
- 异步卡片生成
- POST /card/async
- 立即返回，后台处理

### 3. **cardStream.js** (~480行)
- SSE流式生成
- POST /card/stream
- 实时事件推送

### 4. **cardQuery.js** (~180行)
- 查询生成结果
- GET /card/query/:folderName
- 文件检索逻辑

### 5. **templates.js** (~50行)
- 模板列表管理
- GET /templates

### 6. **status.js** (~60行)
- 生成状态查询
- GET /status/:topic

### 7. **claude.js** (~70行)
- 简化Claude执行
- POST /cc

### 8. **index.js** (新建，~30行)
```javascript
import express from 'express'
import cardRoutes from './card.js'
import cardAsyncRoutes from './cardAsync.js'
import cardStreamRoutes from './cardStream.js'
import cardQueryRoutes from './cardQuery.js'
import templateRoutes from './templates.js'
import statusRoutes from './status.js'
import claudeRoutes from './claude.js'

const router = express.Router()

// 组合所有子路由
router.use('/card', cardRoutes)
router.use('/card/async', cardAsyncRoutes)
router.use('/card/stream', cardStreamRoutes)
router.use('/card/query', cardQueryRoutes)
router.use('/templates', templateRoutes)
router.use('/status', statusRoutes)
router.use('/cc', claudeRoutes)

export default router
```

## 🔧 重构步骤

### 第一阶段：准备
1. ✅ 创建 `/routes/generate/` 目录
2. ✅ 创建第一个拆分文件 `card.js` 作为示例
3. 创建共享工具函数文件

### 第二阶段：逐步迁移
1. 拆分各个端点到对应文件
2. 提取公共函数到 `utils/`
3. 更新导入路径

### 第三阶段：测试验证
1. 单元测试每个模块
2. 集成测试所有端点
3. 压力测试验证性能

### 第四阶段：清理
1. 删除原 `generate.js`
2. 更新 `index.js` 中的导入
3. 更新文档

## 💡 重构优势

### 1. **可维护性**
- 每个文件职责单一
- 易于定位和修改代码
- 减少合并冲突

### 2. **可测试性**
- 独立测试各模块
- Mock更简单
- 覆盖率更清晰

### 3. **可扩展性**
- 新增功能不影响现有代码
- 模块间松耦合
- 易于添加中间件

### 4. **团队协作**
- 多人并行开发
- 代码审查更高效
- 职责划分清晰

## ⚠️ 注意事项

1. **保持向后兼容**
   - API路径不变
   - 响应格式不变
   - 错误码保持一致

2. **共享状态处理**
   - 提取共享配置
   - 统一错误处理
   - 日志格式一致

3. **性能考虑**
   - 避免重复导入
   - 优化模块加载
   - 缓存共享资源

## 📅 执行计划

- **Phase 1** (立即): 创建目录结构，拆分第一个模块
- **Phase 2** (1天): 完成所有模块拆分
- **Phase 3** (1天): 测试验证
- **Phase 4** (半天): 部署上线

## 🎯 预期效果

- 代码行数：从1670行 → 每个文件<500行
- 维护时间：降低60%
- 测试覆盖率：提升到90%+
- 开发效率：提升40%