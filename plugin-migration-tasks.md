# 插件化架构改造任务清单

## 任务概览
- **总任务数**: 32
- **优先级说明**: P0-阻塞级 | P1-高优先 | P2-中优先 | P3-低优先

---

## 阶段一：核心插件系统搭建

| 序号 | 状态 | 任务名称 | 任务目标 | 优先级 | 参考文件 | 操作说明 |
|------|------|---------|---------|--------|---------|---------|
| 1 | ⏳ 待开始 | 创建插件核心目录结构 | 建立插件系统基础目录 | P0 | - | **创建**: `terminal-backend/src/plugins/core/`, `terminal-backend/src/plugins/templates/` |
| 2 | ⏳ 待开始 | 实现BasePlugin基类 | 定义插件基础接口 | P0 | - | **创建**: `terminal-backend/src/plugins/core/BasePlugin.js` |
| 3 | ⏳ 待开始 | 实现PluginManager | 插件生命周期管理 | P0 | `terminal-backend/src/utils/apiTerminalService.js` | **创建**: `terminal-backend/src/plugins/core/PluginManager.js` |
| 4 | ⏳ 待开始 | 实现PluginLoader | 插件加载机制 | P0 | - | **创建**: `terminal-backend/src/plugins/core/PluginLoader.js` |
| 5 | ⏳ 待开始 | 实现PluginRegistry | 插件注册与查询 | P0 | - | **创建**: `terminal-backend/src/plugins/core/PluginRegistry.js` |
| 6 | ⏳ 待开始 | 实现PluginAPI | 插件API接口层 | P0 | `terminal-backend/src/services/claudeExecutorDirect.js` | **创建**: `terminal-backend/src/plugins/core/PluginAPI.js` |
| 7 | ⏳ 待开始 | 创建插件配置Schema | 验证manifest格式 | P1 | - | **创建**: `terminal-backend/src/plugins/schemas/manifest.schema.json` |
| 8 | ⏳ 待开始 | 实现插件错误处理 | 错误隔离与恢复 | P1 | - | **创建**: `terminal-backend/src/plugins/core/PluginError.js` |

## 阶段二：模板插件迁移

### 2.1 CardPlanet-Sandra插件

| 序号 | 状态 | 任务名称 | 任务目标 | 优先级 | 参考文件 | 操作说明 |
|------|------|---------|---------|--------|---------|---------|
| 9 | ⏳ 待开始 | 迁移cardplanet-sandra模板 | 创建第一个插件 | P0 | `terminal-backend/src/routes/generate.js:237-252` | **创建**: `plugins/templates/cardplanet-sandra/` <br> **移动**: `data/public_template/cardplanet-Sandra/*` → `plugins/templates/cardplanet-sandra/assets/` |
| 10 | ⏳ 待开始 | 编写manifest.json | 定义插件元数据 | P0 | - | **创建**: `plugins/templates/cardplanet-sandra/manifest.json` |
| 11 | ⏳ 待开始 | 实现插件主逻辑 | 提示词构建与文件检测 | P0 | `terminal-backend/src/routes/generate.js:892-906` | **创建**: `plugins/templates/cardplanet-sandra/index.js` |
| 12 | ⏳ 待开始 | 添加多语言支持 | 中英文名称描述 | P2 | - | **创建**: `plugins/templates/cardplanet-sandra/locales/zh-CN.json`, `en-US.json` |

### 2.2 CardPlanet-Sandra-Cover插件

| 序号 | 状态 | 任务名称 | 任务目标 | 优先级 | 参考文件 | 操作说明 |
|------|------|---------|---------|--------|---------|---------|
| 13 | ⏳ 待开始 | 迁移cardplanet-sandra-cover | 封面版插件 | P0 | `terminal-backend/src/routes/generate.js:221-236` | **创建**: `plugins/templates/cardplanet-sandra-cover/` <br> **移动**: `data/public_template/cardplanet-Sandra-cover/*` → `plugins/templates/cardplanet-sandra-cover/assets/` |
| 14 | ⏳ 待开始 | 实现4参数处理 | cover参数支持 | P0 | `terminal-backend/src/routes/generate.js:165-166` | **更新**: 插件index.js中处理cover参数 |
| 15 | ⏳ 待开始 | 参数自动生成逻辑 | 缺失参数自动补全 | P1 | `terminal-backend/src/services/claudeExecutorDirect.js:145-180` | **实现**: generateParameters方法 |

### 2.3 CardPlanet-Sandra-JSON插件

| 序号 | 状态 | 任务名称 | 任务目标 | 优先级 | 参考文件 | 操作说明 |
|------|------|---------|---------|--------|---------|---------|
| 16 | ⏳ 待开始 | 迁移cardplanet-sandra-json | 双文件输出插件 | P0 | `terminal-backend/src/routes/generate.js:204-220` | **创建**: `plugins/templates/cardplanet-sandra-json/` <br> **移动**: 相关资源文件 |
| 17 | ⏳ 待开始 | 实现双文件检测 | HTML+JSON检测逻辑 | P0 | `terminal-backend/src/routes/generate.js:320-384` | **实现**: detectFiles方法支持双文件 |
| 18 | ⏳ 待开始 | 文件验证逻辑 | 验证两种文件都生成 | P0 | `terminal-backend/src/routes/generate.js:963-1000` | **实现**: validateOutput方法 |

### 2.4 Daily-Knowledge-Card插件

| 序号 | 状态 | 任务名称 | 任务目标 | 优先级 | 参考文件 | 操作说明 |
|------|------|---------|---------|--------|---------|---------|
| 19 | ⏳ 待开始 | 迁移daily-knowledge-card | 简单模板插件 | P1 | `terminal-backend/src/routes/generate.js:272` | **创建**: `plugins/templates/daily-knowledge-card/` <br> **移动**: `data/public_template/daily-knowledge-card-template.md` → `plugins/templates/daily-knowledge-card/assets/` |
| 20 | ⏳ 待开始 | 实现单文件模板逻辑 | 单文件处理流程 | P1 | `terminal-backend/src/routes/generate.js:254-273` | **实现**: 简化的buildPrompt方法 |

## 阶段三：核心路由改造

| 序号 | 状态 | 任务名称 | 任务目标 | 优先级 | 参考文件 | 操作说明 |
|------|------|---------|---------|--------|---------|---------|
| 21 | ⏳ 待开始 | 重构generate.js主逻辑 | 使用插件系统 | P0 | `terminal-backend/src/routes/generate.js` | **重构**: 移除if-else，改用pluginManager |
| 22 | ⏳ 待开始 | 添加模板列表API | 获取所有可用模板 | P0 | - | **添加**: `GET /api/templates` 路由 |
| 23 | ⏳ 待开始 | 添加模板详情API | 获取模板参数说明 | P0 | - | **添加**: `GET /api/templates/:id` 路由 |
| 24 | ⏳ 待开始 | 添加模板图标API | 提供模板图标资源 | P1 | - | **添加**: `GET /api/templates/:id/icon` 路由 |
| 25 | ⏳ 待开始 | 实现向后兼容层 | 保持旧接口可用 | P0 | `terminal-backend/src/routes/generate.js:80-500` | **创建**: 兼容性适配器 |
| 26 | ⏳ 待开始 | 改造Stream API | 支持插件化 | P0 | `terminal-backend/src/routes/generate.js:700-1100` | **重构**: `/api/generate/card/stream` |

## 阶段四：前端改造

| 序号 | 状态 | 任务名称 | 任务目标 | 优先级 | 参考文件 | 操作说明 |
|------|------|---------|---------|--------|---------|---------|
| 27 | ⏳ 待开始 | 创建模板选择器组件 | 友好的模板展示 | P0 | 前端相关文件 | **创建**: TemplateSelector组件 |
| 28 | ⏳ 待开始 | 实现模板分类过滤 | 按类别筛选模板 | P1 | - | **添加**: 分类和标签过滤功能 |
| 29 | ⏳ 待开始 | 动态参数表单 | 根据模板生成表单 | P0 | - | **创建**: DynamicParameterForm组件 |
| 30 | ⏳ 待开始 | 模板预览功能 | 展示模板示例效果 | P2 | - | **添加**: 预览弹窗组件 |
| 31 | ⏳ 待开始 | 多语言切换 | 支持中英文界面 | P2 | - | **实现**: i18n支持 |

## 阶段五：测试与优化 (持续)

| 序号 | 状态 | 任务名称 | 任务目标 | 优先级 | 参考文件 | 操作说明 |
|------|------|---------|---------|--------|---------|---------|
| 32 | ⏳ 待开始 | 编写单元测试 | 插件系统测试覆盖 | P1 | - | **创建**: `test/plugins/` 测试用例 |

---

## 重要文件变更清单

### 需要删除的文件
```
无需删除文件，保持向后兼容
```

### 需要移动的文件
```bash
# 模板资源文件移动
terminal-backend/data/public_template/cardplanet-Sandra/* 
→ terminal-backend/src/plugins/templates/cardplanet-sandra/assets/

terminal-backend/data/public_template/cardplanet-Sandra-cover/* 
→ terminal-backend/src/plugins/templates/cardplanet-sandra-cover/assets/

terminal-backend/data/public_template/cardplanet-Sandra-json/* 
→ terminal-backend/src/plugins/templates/cardplanet-sandra-json/assets/

terminal-backend/data/public_template/daily-knowledge-card-template.md 
→ terminal-backend/src/plugins/templates/daily-knowledge-card/assets/template.md
```

### 需要修改的核心文件
```
1. terminal-backend/src/routes/generate.js
   - 移除硬编码的if-else逻辑
   - 集成PluginManager
   - 添加新的API端点

2. terminal-backend/src/index.js (或app.js)
   - 初始化PluginManager
   - 注册插件系统

3. 前端模板选择相关组件
   - 替换文件夹/文件名展示
   - 使用新的API接口
```

### 新增的核心文件
```
terminal-backend/src/plugins/
├── core/
│   ├── BasePlugin.js         # 插件基类
│   ├── PluginManager.js      # 插件管理器
│   ├── PluginLoader.js       # 插件加载器
│   ├── PluginRegistry.js     # 插件注册表
│   ├── PluginAPI.js          # 插件API
│   └── PluginError.js        # 错误处理
├── schemas/
│   └── manifest.schema.json  # 清单验证
└── templates/                # 各插件目录
```

---

## 注意事项

### 1. 数据迁移
- ⚠️ 保留原始模板文件作为备份
- ⚠️ 确保资源文件路径正确映射
- ⚠️ 测试文件读取权限

### 2. 兼容性
- ⚠️ 保持现有API接口不变
- ⚠️ 添加版本标识区分新旧接口
- ⚠️ 逐步迁移，避免一次性切换

### 3. 性能考虑
- ⚠️ 插件懒加载机制
- ⚠️ 缓存manifest信息
- ⚠️ 避免重复读取文件

### 4. 错误处理
- ⚠️ 插件加载失败不影响系统启动
- ⚠️ 单个插件错误不影响其他插件
- ⚠️ 完善的错误日志记录

### 5. 安全性
- ⚠️ 验证插件manifest合法性
- ⚠️ 限制插件API权限
- ⚠️ 防止路径遍历攻击

### 6. 测试重点
- ✅ 四个模板的完整功能测试
- ✅ 参数自动生成测试
- ✅ 双文件输出检测测试
- ✅ 超时处理测试
- ✅ API向后兼容测试

---

## 里程碑

| 里程碑 | 完成标准 |
|--------|---------:|
| M1: 核心系统就绪 | 插件系统可加载运行 |
| M2: 模板迁移完成 | 4个模板全部插件化 |
| M3: API改造完成 | 新旧接口共存可用 |
| M4: 前端改造完成 | 友好的模板选择界面 |
| M5: 全面上线 | 生产环境部署验证 |

---

## 风险点跟踪

| 风险 | 等级 | 缓解措施 | 负责人 |
|------|------|---------|--------|
| 插件加载性能问题 | 高 | 实现懒加载和缓存 | - |
| 文件路径兼容问题 | 中 | 充分测试各环境 | - |
| 前端改动过大 | 中 | 分阶段迭代 | - |
| 用户习惯改变 | 低 | 保留原有入口 | - |

---

## 验收标准

1. **功能验收**
   - [ ] 所有原有模板功能正常
   - [ ] 新增模板只需添加插件目录
   - [ ] 前端展示友好的模板名称和描述
   - [ ] 支持模板参数动态配置

2. **性能验收**
   - [ ] 系统启动时间 < 5秒
   - [ ] 插件加载时间 < 100ms
   - [ ] API响应时间无明显增加

3. **稳定性验收**
   - [ ] 插件错误不影响系统
   - [ ] 支持插件热更新
   - [ ] 完善的错误日志

4. **文档验收**
   - [ ] 插件开发文档完整
   - [ ] API文档更新
   - [ ] 部署文档更新