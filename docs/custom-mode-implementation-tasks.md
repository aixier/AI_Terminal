# 自定义模式改造任务清单

## 任务总览
- **总任务数**：15个
- **前端任务**：10个
- **后端任务**：5个
- **改造原则**：仅修改两个现有接口，不新增任何API接口

---

## 前端任务

| 序号 | 状态 | 任务名称 | 目标 | 改造的文件 | 参考文件 | 注意事项 |
|------|------|---------|------|-----------|---------|---------|
| 1 | ✅ 完成 | 创建localStorage缓存管理模块 | 实现三层缓存架构，零延迟响应 | `terminal-ui/src/composables/useAssetCache.js` (新建) | `docs/custom-mode-design.md` 第175-273行 | 1. 使用LZString压缩数据<br>2. 24小时过期机制<br>3. 后台静默更新 |
| 2 | ✅ 完成 | 创建自定义模式切换按钮组件 | 在输入面板上方添加模式切换 | `terminal-ui/src/views/CardGenerator/components/CustomModeToggle.vue` (新建) | `docs/custom-mode-design.md` 第24-36行 | 1. 默认关闭状态<br>2. 切换时显示提示文本<br>3. 按钮高亮状态管理 |
| 3 | ✅ 完成 | 改造ChatInputPanel组件状态管理 | 支持自定义模式状态和引用管理 | `terminal-ui/src/views/CardGenerator/components/ChatInputPanel.vue` | `docs/custom-mode-design.md` 第156-170行 | 1. 新增customModeEnabled状态<br>2. 新增assetReferences数组<br>3. 保持原有功能不受影响 |
| 4 | ✅ 完成 | 实现@符号检测和触发机制 | 检测输入框@符号并触发选择器 | `terminal-ui/src/views/CardGenerator/components/ChatInputPanel.vue` | `docs/custom-mode-design.md` 第350-374行 | 1. 仅在自定义模式下触发<br>2. 获取光标位置<br>3. 优先使用缓存数据 |
| 5 | ✅ 完成 | 创建素材选择器浮层组件 | 显示分类和文件选择界面 | `terminal-ui/src/views/CardGenerator/components/AssetReferencePicker.vue` (新建) | `docs/custom-mode-design.md` 第89-122行 | 1. 浮层定位跟随光标<br>2. 支持分类/文件两种模式<br>3. 支持搜索过滤 |
| 6 | ✅ 完成 | 实现引用标记插入功能 | 在输入框中插入引用标记 | `terminal-ui/src/views/CardGenerator/components/ChatInputPanel.vue` | `docs/custom-mode-design.md` 第410-422行 | 1. 格式：@[type:value]<br>2. 保持光标位置<br>3. 支持删除整个标记 |
| 7 | ✅ 完成 | 创建引用标记显示组件 | 可视化显示引用标记 | `terminal-ui/src/views/CardGenerator/components/ReferenceTag.vue` (新建) | `docs/custom-mode-design.md` 第137-142行 | 1. 蓝色高亮显示<br>2. 悬停显示完整路径<br>3. 点击可删除 |
| 8 | ✅ 完成 | 实现资源索引构建 | 优化查找性能 | `terminal-ui/src/views/CardGenerator/components/ChatInputPanel.vue` | `docs/custom-mode-design.md` 第307-348行 | 1. 构建分类索引<br>2. 构建文件列表<br>3. 构建搜索映射 |
| 9 | ✅ 完成 | 改造发送请求逻辑 | 支持自定义模式参数 | `terminal-ui/src/views/CardGenerator/pages/AICreationPage.vue` | `docs/custom-mode-design.md` 第476-500行 | 1. 添加mode参数<br>2. 添加references数组<br>3. 解析引用标记 |
| 10 | ✅ 完成 | 实现引用解析正则 | 从文本中提取引用 | `terminal-ui/src/utils/referenceParser.js` (新建) | `docs/custom-mode-design.md` 第919-938行 | 1. 支持category和file类型<br>2. 记录位置信息<br>3. 处理嵌套情况 |

---

## 后端任务

| 序号 | 状态 | 任务名称 | 目标 | 改造的文件 | 参考文件 | 注意事项 |
|------|------|---------|------|-----------|---------|---------|
| 11 | ✅ 完成 | 修改生成接口参数处理 | 支持mode和references参数 | `terminal-backend/src/routes/generate.js` | `docs/custom-mode-design.md` 第475-500行 | 1. 保持向后兼容<br>2. 参数为可选<br>3. mode默认为普通模式 |
| 12 | ✅ 完成 | 实现引用路径转换逻辑 | 转换引用为文件系统路径 | `terminal-backend/src/services/referenceConverter.js` (新建) | `docs/custom-mode-design.md` 第517-556行 | 1. 基础路径：/data/users/{userId}/storage/<br>2. 读取assets_metadata.json<br>3. 处理分类和文件两种类型 |
| 13 | ✅ 完成 | 实现文件内容读取 | 根据文件类型读取内容 | `terminal-backend/src/services/fileReader.js` (新建) | `docs/custom-mode-design.md` 第720-754行 | 1. 支持图片、PDF、文本等<br>2. 大文件截断处理<br>3. 错误处理机制 |
| 14 | ✅ 完成 | 构建增强提示词 | 组装完整的AI提示词 | `terminal-backend/src/services/promptBuilder.js` (新建) | `docs/custom-mode-design.md` 第842-898行 | 1. 包含文件路径信息<br>2. 分类组织素材<br>3. 明确使用说明 |
| 15 | ✅ 完成 | 集成到生成流程 | 将自定义模式集成到现有流程 | `terminal-backend/src/routes/generate.js` | `docs/custom-mode-design.md` 第560-598行 | 1. 判断mode类型<br>2. 调用转换和构建服务<br>3. 传递给AI模型 |

---

## 实施顺序建议

### 第一阶段：基础设施
1. 任务1：创建缓存管理模块（前提条件）
2. 任务10：实现引用解析正则（基础工具）

### 第二阶段：前端核心功能
3. 任务2：创建模式切换按钮
4. 任务3：改造状态管理
5. 任务4：实现@符号检测
6. 任务5：创建选择器浮层
7. 任务6：实现引用插入
8. 任务7：创建引用标记组件
9. 任务8：实现资源索引

### 第三阶段：前端请求处理
10. 任务9：改造发送请求逻辑

### 第四阶段：后端实现
11. 任务11：修改生成接口
12. 任务12：实现路径转换
13. 任务13：实现文件读取
14. 任务14：构建提示词
15. 任务15：集成到流程

---

## 测试要点

### 前端测试
- [ ] localStorage缓存的存取和过期
- [ ] @符号触发的响应时间（<10ms）
- [ ] 引用标记的插入和删除
- [ ] 选择器浮层的定位
- [ ] 不同浏览器兼容性

### 后端测试
- [ ] 引用路径转换正确性
- [ ] 文件读取的异常处理
- [ ] 大文件处理性能
- [ ] 提示词生成完整性
- [ ] 向后兼容性

### 集成测试
- [ ] 端到端流程测试
- [ ] 缓存更新机制
- [ ] 多用户并发
- [ ] 错误恢复机制

---

## 风险控制

| 风险项 | 影响 | 缓解措施 |
|--------|------|---------|
| localStorage容量限制 | 缓存失效 | 1. 数据压缩<br>2. 智能清理<br>3. 分片存储 |
| 大文件处理性能 | 响应变慢 | 1. 文件大小限制<br>2. 异步处理<br>3. 内容摘要 |
| 引用解析错误 | 功能失效 | 1. 严格正则匹配<br>2. 错误边界处理<br>3. 用户提示 |
| AI Token超限 | 生成失败 | 1. 内容截断<br>2. 智能摘要<br>3. 引用数量限制 |

---

## 验收标准

### 功能验收
- [ ] 自定义模式可正常开启/关闭
- [ ] @符号能触发选择器（响应时间<10ms）
- [ ] 能正确插入和显示引用标记
- [ ] 后端能正确解析引用并读取文件
- [ ] AI能基于引用内容生成结果

### 性能验收
- [ ] 首次加载时间<500ms
- [ ] 二次使用响应<10ms
- [ ] 缓存命中率>90%
- [ ] 文件读取时间<2s

### 用户体验验收
- [ ] 操作流程自然流畅
- [ ] 错误提示清晰友好
- [ ] 引用标记可视化良好
- [ ] 支持快捷键操作

---

## 相关文档
- 设计文档：`/docs/custom-mode-design.md`
- 素材系统：`/docs/assets-metadata-final-solution.md`
- API规范：`/docs/api-design-guide.md`

---

## 注意事项汇总
1. **不新增任何API接口**，仅修改现有两个接口
2. **优先使用缓存**，实现零延迟用户体验
3. **保持向后兼容**，不影响现有功能
4. **前端处理为主**，后端改动最小化
5. **错误处理完善**，确保系统稳定性