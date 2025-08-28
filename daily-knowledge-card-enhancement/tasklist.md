# Universal Metadata & Daily Knowledge Card Enhancement Task List

## 项目目标
1. **通用功能**: 为所有模板添加Meta元数据文件生成
2. **特殊功能**: 为daily-knowledge-card-template.md实现四文件连续生成

| 状态 | 序号 | 任务名称 | 任务目标 | 任务动作 | 注意事项 | 涉及代码文件 |
|------|------|----------|----------|----------|----------|------------|
| ✅ | 1 | 创建通用元数据管理工具类 | 实现SessionMetadata类，支持所有模板的元数据管理 | 创建utils/sessionMetadata.js，实现初始化、日志记录、文件保存等方法 | 确保JSON Schema严格验证，时间格式统一使用ISO8601，支持不同模板类型 | `utils/sessionMetadata.js` (已完成) |
| ✅ | 2 | 创建HTML处理工具 | 实现HTML文件下载和保存功能（仅daily模板使用） | 创建utils/htmlProcessor.js，实现从directDownloadUrl下载并保存HTML文件 | 处理网络超时、文件大小限制、编码问题 | `utils/htmlProcessor.js` (已完成) |
| ✅ | 3 | 创建四文件生成协调器 | 统一协调daily模板的四个文件生成流程 | 创建utils/fileGenerator.js，封装完整的四文件生成逻辑 | 每步失败都要有回滚机制，状态管理要准确 | `utils/fileGenerator.js` (已完成) |
| ✅ | 4 | 修改同步卡片生成API | 为所有模板添加meta文件，为daily模板添加四文件生成 | 在card.js中集成通用meta文件生成和daily专用四文件流程 | 保持API接口不变，确保所有模板都生成meta文件 | `routes/generate/card.js` (已完成) |
| ✅ | 5 | 修改异步卡片生成API | 为所有模板添加meta文件，为daily模板添加四文件生成 | 在cardAsync.js中集成通用meta文件生成和daily专用四文件流程 | 异步状态更新要及时，所有模板都要记录完整过程 | `routes/generate/cardAsync.js` (已完成) |
| ✅ | 6 | 修改流式卡片生成API | 为所有模板添加meta文件，为daily模板添加四文件生成 | 在cardStream.js中集成通用meta文件生成和daily专用四文件流程 | SSE事件要包含每个步骤的状态更新，区分不同模板类型 | `routes/generate/cardStream.js` (已完成) |
| 📋 | 7 | 更新文件检测逻辑 | 修改文件检测支持不同模板的文件数量 | 在cardAsync.js中更新文件检测条件，根据模板类型检测相应数量的文件 | 所有模板至少检测meta文件，daily模板检测4个文件 | `routes/generate/cardAsync.js` |
| 📋 | 8 | 更新工作空间元数据 | 修改workspace元数据以记录所有生成的文件 | 在workspaceMetadata.js中更新recordGeneratedFiles方法，支持记录meta文件 | 确保所有模板的文件列表都包含meta文件，类型标识正确 | `utils/workspaceMetadata.js` |
| 📋 | 9 | 更新前端文件显示 | 前端支持显示和操作所有模板的meta文件 | 在CardGenerator.vue中添加meta文件的通用显示和查看功能 | Meta文件显示为📊图标，所有模板文件夹都应显示meta文件 | `terminal-ui/src/views/CardGenerator.vue` |
| 📋 | 10 | 实现通用Meta文件内容查看器 | 前端组件展示所有模板的meta文件内容 | 创建MetadataViewer组件，格式化显示执行步骤和日志，支持不同模板 | JSON内容要美化显示，步骤状态用图标表示，适配不同模板的meta结构 | `terminal-ui/src/components/MetadataViewer.vue` (新建) |
| ✅ | 11 | 添加全模板API测试 | 创建API测试用例验证所有模板的meta文件生成 | 编写测试脚本验证各模板的meta文件生成和daily模板的四文件生成 | 测试要覆盖所有模板类型，验证meta文件完整性和四文件生成逻辑 | `test-universal-metadata.sh` (已完成) |
| 📋 | 12 | 性能和兼容性测试 | 验证所有模板功能正确性和性能表现 | 执行完整测试，确保所有模板都能正确生成meta文件 | 重点测试各模板的meta文件生成和daily模板的特殊处理 | 所有相关文件 |

## 任务状态说明
- ⏳ 进行中
- ✅ 已完成  
- ❌ 失败/阻塞
- 📋 待开始

## 执行顺序
1. 先完成工具类创建（任务1-3）
2. 再修改API接口（任务4-6）
3. 然后更新辅助功能（任务7-8）
4. 最后前端和测试（任务9-12）

## 关键检查点
- 任务1完成后：验证通用元数据管理功能正确
- 任务3完成后：验证daily模板四文件生成逻辑正确  
- 任务6完成后：验证所有API都支持通用meta文件和daily四文件模式
- 任务8完成后：验证所有模板的元数据记录完整
- 任务12完成后：验证整体功能稳定，所有模板都能正确生成meta文件

## 预期文件结构

### 通用模板（如cardplanet-Sandra-json）
```
/workspace/card/主题文件夹/
├── 主题_style.html                    # 生成的HTML文件
├── 主题_data.json                     # 生成的JSON文件  
└── 20250828_143025_default_meta.json  # 元数据文件
```

### Daily模板专用结构
```
/workspace/card/主题文件夹/
├── knowledge-cards.json               # 1. Claude生成的JSON
├── knowledge-cards-response.json      # 2. HTML API响应
├── knowledge-cards.html               # 3. 下载的HTML文件  
└── 20250828_143025_default_meta.json  # 4. 元数据文件
```