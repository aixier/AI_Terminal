# 数据库改造任务清单

> 最后更新: 2024-01-20  
> 总任务数: 30  

## 任务状态说明
- **[ ]** - 未开始 (TODO)
- **[*]** - 进行中 (IN_PROGRESS)  
- **[✓]** - 已完成 (DONE)
- **[!]** - 阻塞中 (BLOCKED)
- **[X]** - 已取消 (CANCELLED)

---

## Phase 1: 基础架构搭建

### 1. 创建项目目录结构
**状态**: [ ]  
**任务目标**: 建立规范的目录结构，为后续开发提供基础  
**动作**:
1. 创建 `/terminal-backend/data/db/` 目录
2. 创建 `/terminal-backend/data/storage/` 及子目录
3. 创建 `/terminal-backend/src/dao/` 目录结构
4. 创建 `/terminal-backend/src/config/` 目录

**注意事项**: 
- 确保目录权限正确设置
- 创建 .gitignore 排除数据文件

### 2. 实现数据库配置模块
**状态**: [ ]  
**任务目标**: 创建统一的数据库配置管理  
**动作**:
1. 创建 `config/database.js` 配置文件
2. 实现环境变量支持
3. 添加路径配置常量
4. 实现配置验证逻辑

**注意事项**:
- 支持开发/生产环境切换
- 路径使用绝对路径避免相对路径问题

### 3. 实现BaseDAO基类
**状态**: [ ]  
**任务目标**: 创建通用的数据访问基类  
**动作**:
1. 创建 `dao/base/BaseDAO.js`
2. 实现基础CRUD方法
3. 实现文件锁机制防止并发冲突
4. 实现自增ID管理
5. 添加索引支持

**注意事项**:
- 使用async/await处理异步操作
- 实现proper error handling
- 添加操作日志

### 4. 创建数据库初始化脚本
**状态**: [ ]  
**任务目标**: 自动创建所有数据表文件  
**动作**:
1. 创建 `scripts/db-init.js`
2. 定义所有表结构
3. 创建初始JSON文件
4. 添加默认索引

**注意事项**:
- 检查文件是否已存在，避免覆盖
- 创建备份机制

---

## Phase 2: 核心表实现 (Day 3-4)

### 5. 实现UserDAO
**状态**: [ ]  
**任务目标**: 替换现有userService中的文件操作  
**动作**:
1. 创建 `dao/UserDAO.js`
2. 实现 findByUsername, findByToken 等特定方法
3. 迁移密码加密逻辑
4. 添加单元测试

**当前使用位置**:
- `/terminal-backend/src/services/userService.js` (主要实现: loadUsers, saveUsers, findUserByUsername, findUserByToken)
- `/terminal-backend/src/middleware/userAuth.js` (调用: findUserByToken, findUserByUsername)
- `/terminal-backend/data/users.json` (数据文件)

**注意事项**:
- 保持与现有userService接口兼容
- 密码必须加密存储

### 6. 实现UserSettingsDAO
**状态**: [ ]  
**任务目标**: 管理用户设置数据  
**动作**:
1. 创建 `dao/UserSettingsDAO.js`
2. 实现设置的CRUD操作
3. 处理JSON字段的序列化
4. 添加默认设置逻辑

**当前使用位置**:
- `/terminal-backend/src/services/userService.js:148-158` (createUserWorkspace中创建settings.json)
- `/terminal-backend/data/users/{username}/settings.json` (用户设置文件)
- `/terminal-backend/src/services/dataService.js:59-95` (getUserSettings, saveUserSettings)

**注意事项**:
- 支持设置的部分更新
- 处理设置的版本兼容

### 7. 实现TemplatesDAO
**状态**: [ ]  
**任务目标**: 管理模板数据  
**动作**:
1. 创建 `dao/TemplatesDAO.js`
2. 实现模板查询和统计
3. 添加使用计数更新
4. 实现分类管理

**当前使用位置**:
- `/terminal-backend/src/routes/generate/templates.js:11-53` (获取模板列表)
- `/terminal-backend/data/public_template/` (模板文件目录)
- `/terminal-backend/src/routes/generate/card.js:124-126` (判断模板类型)

**注意事项**:
- 缓存热门模板
- 支持模板版本管理

### 8. 实现GenerationTasksDAO
**状态**: [ ]  
**任务目标**: 持久化任务状态  
**动作**:
1. 创建 `dao/GenerationTasksDAO.js`
2. 迁移内存中的activeRequests
3. 实现任务状态更新
4. 添加任务查询接口

**当前使用位置**:
- `/terminal-backend/src/routes/generate/card.js:11` (activeRequests Map)
- `/terminal-backend/src/routes/generate/card.js:74-78` (创建请求跟踪)
- `/terminal-backend/src/routes/generate/cardAsync.js:59` (生成任务ID)
- `/terminal-backend/src/routes/generate/cardStream.js` (流式生成)

**注意事项**:
- 支持任务超时自动更新
- 实现任务重试机制

### 9. 实现GenerationMetadataDAO
**状态**: [ ]  
**任务目标**: 完整的元数据管理  
**动作**:
1. 创建 `dao/GenerationMetadataDAO.js`
2. 实现元数据收集逻辑
3. 添加智能标签提取
4. 实现统计查询方法

**当前使用位置**:
- `/terminal-backend/src/routes/generate/utils/workspaceMetadata.js:122-261` (updateFolderStatus, recordGeneratedFiles)
- `/terminal-backend/src/routes/generate/utils/folderManager.js:71-127` (文件夹元数据管理)
- 各用户文件夹内的 `_metadata.json` 文件

**注意事项**:
- 自动关联任务和用户
- 支持批量查询优化

### 10. 实现GenerationResultsDAO
**状态**: [ ]  
**任务目标**: 管理生成结果文件信息  
**动作**:
1. 创建 `dao/GenerationResultsDAO.js`
2. 记录文件路径和大小
3. 实现文件关联查询
4. 添加文件清理标记

**当前使用位置**:
- `/terminal-backend/src/routes/generate/card.js:386-526` (文件生成和读取)
- `/terminal-backend/src/routes/generate/utils/folderManager.js:114-117` (recordGeneratedFiles)
- `/terminal-backend/data/users/{username}/workspace/card/` (生成的文件)

**注意事项**:
- 验证文件存在性
- 计算文件哈希值

---

## Phase 3: 存储层实现

### 11. 实现StorageService基类
**状态**: [ ]  
**任务目标**: 统一的文件存储接口  
**动作**:
1. 创建 `services/storage/StorageService.js`
2. 实现文件上传/下载/删除
3. 添加文件元数据管理
4. 实现URL生成逻辑

**当前使用位置**:
- 文件存储分散在多处，需要统一管理
- `/terminal-backend/src/routes/upload.js` (文件上传)
- `/terminal-backend/src/routes/generate/card.js:492` (fs.readFile直接读取文件)

**注意事项**:
- 支持大文件流式处理
- 实现存储容量检查

### 12. 实现LocalStorageAdapter
**状态**: [ ]  
**任务目标**: 本地文件系统适配器  
**动作**:
1. 创建 `services/storage/LocalStorageAdapter.js`
2. 实现本地文件操作
3. 模拟OSS的目录结构
4. 添加文件权限管理

**当前使用位置**:
- 所有fs操作都需要通过适配器
- `/terminal-backend/src/services/userService.js` (多处fs操作)
- `/terminal-backend/src/services/dataService.js` (文件读写)

**注意事项**:
- 使用绝对路径
- 处理文件名冲突

### 13. 迁移模板文件存储
**状态**: [ ]  
**任务目标**: 将模板文件迁移到统一存储  
**动作**:
1. 复制现有模板到 `/data/storage/templates/`
2. 更新模板路径引用
3. 实现模板版本管理
4. 添加模板缓存

**当前使用位置**:
- `/terminal-backend/data/public_template/` (当前模板目录)
- `/terminal-backend/src/routes/generate/card.js:239-346` (模板路径处理)

**注意事项**:
- 保留原始模板备份
- 更新所有引用路径

### 14. 迁移用户生成文件存储
**状态**: [ ]  
**任务目标**: 规范用户文件存储结构  
**动作**:
1. 创建新的存储目录结构
2. 实现文件迁移脚本
3. 更新文件访问逻辑
4. 添加文件索引

**当前使用位置**:
- `/terminal-backend/data/users/{username}/workspace/` (当前用户文件)
- `/terminal-backend/src/services/userService.js:226-241` (getUserWorkspacePath)
- `/terminal-backend/src/services/userService.js:247-251` (getUserCardPath)

**注意事项**:
- 按用户ID而非用户名组织
- 保持文件名唯一性

---

## Phase 4: 服务层改造

### 15. 改造UserService
**状态**: [ ]  
**任务目标**: 使用DAO替换直接文件操作  
**动作**:
1. 注入UserDAO依赖
2. 替换loadUsers/saveUsers方法
3. 更新用户认证逻辑
4. 添加事务支持

**当前使用位置**:
- `/terminal-backend/src/services/userService.js:49-56` (loadUsers)
- `/terminal-backend/src/services/userService.js:62-69` (saveUsers)
- `/terminal-backend/src/services/userService.js:74-93` (authenticate)
- `/terminal-backend/src/services/userService.js:98-123` (findUserByUsername, findUserByToken)

**注意事项**:
- 保持API接口不变
- 添加操作日志

### 16. 创建MetadataService
**状态**: [ ]  
**任务目标**: 元数据业务逻辑封装  
**动作**:
1. 创建 `services/MetadataService.js`
2. 实现元数据自动收集
3. 添加统计分析方法
4. 实现报表生成

**当前使用位置**:
- 当前没有统一的元数据服务，需要新建
- 元数据分散在各个文件夹的 `_metadata.json` 中
- 需要在所有生成接口中集成

**注意事项**:
- 异步收集避免阻塞主流程
- 支持批量操作

### 17. 创建TaskService
**状态**: [ ]  
**任务目标**: 任务管理服务  
**动作**:
1. 创建 `services/TaskService.js`
2. 实现任务生命周期管理
3. 添加任务调度逻辑
4. 实现任务监控

**当前使用位置**:
- 当前任务管理分散在各个路由中
- `/terminal-backend/src/routes/generate/card.js:11` (activeRequests)
- `/terminal-backend/src/routes/generate/cardAsync.js` (异步任务)
- `/terminal-backend/src/services/sessionManager.js` (会话管理)

**注意事项**:
- 支持任务优先级
- 实现任务超时处理

### 18. 改造生成服务(card.js等)
**状态**: [ ]  
**任务目标**: 集成元数据收集  
**动作**:
1. 在生成流程中注入元数据收集
2. 更新任务状态管理
3. 实现结果持久化
4. 添加错误恢复

**当前使用位置**:
- `/terminal-backend/src/routes/generate/card.js` (同步生成)
- `/terminal-backend/src/routes/generate/cardAsync.js` (异步生成)
- `/terminal-backend/src/routes/generate/cardStream.js` (流式生成)
- `/terminal-backend/src/routes/generate/cardContent.js` (内容生成)

**注意事项**:
- 不影响生成性能
- 完整记录错误信息

---

## Phase 5: API层改造

### 19. 创建元数据查询API
**状态**: [ ]  
**任务目标**: 提供元数据查询接口  
**动作**:
1. 创建 `/api/metadata` 路由
2. 实现查询、统计接口
3. 添加分页和排序
4. 实现导出功能

**当前使用位置**:
- 新增功能，当前没有元数据查询API
- 需要添加到 `/terminal-backend/src/routes/` 中

**注意事项**:
- 添加权限控制
- 优化查询性能

### 20. 创建任务管理API
**状态**: [ ]  
**任务目标**: 任务状态查询和管理  
**动作**:
1. 创建 `/api/tasks` 路由
2. 实现任务查询接口
3. 添加任务取消功能
4. 实现任务重试

**当前使用位置**:
- 新增功能，当前没有独立的任务管理API
- 任务状态目前在各生成接口内部处理

**注意事项**:
- 防止重复提交
- 添加操作审计

### 21. 更新现有API集成
**状态**: [ ]  
**任务目标**: 现有API使用新的数据层  
**动作**:
1. 更新用户认证中间件
2. 修改生成API使用DAO
3. 更新文件访问接口
4. 添加响应缓存

**当前使用位置**:
- `/terminal-backend/src/middleware/userAuth.js` (认证中间件)
- `/terminal-backend/src/routes/generate/` (所有生成API)
- `/terminal-backend/src/routes/terminal.js` (终端接口)
- `/terminal-backend/src/index.js` (主入口)

**注意事项**:
- 保持接口兼容性
- 添加版本标识

---

## Phase 6: 测试和优化

### 22. 编写DAO层单元测试
**状态**: [ ]  
**任务目标**: 确保DAO层功能正确  
**动作**:
1. 为每个DAO创建测试文件
2. 测试CRUD操作
3. 测试并发场景
4. 测试错误处理

**注意事项**:
- 使用测试数据库
- 清理测试数据

### 23. 编写Service层测试
**状态**: [ ]  
**任务目标**: 验证业务逻辑  
**动作**:
1. 测试服务方法
2. Mock DAO依赖
3. 测试事务逻辑
4. 测试异常处理

**注意事项**:
- 覆盖边界条件
- 测试回滚逻辑

### 24. 编写集成测试
**状态**: [ ]  
**任务目标**: 端到端功能验证  
**动作**:
1. 测试完整的API流程
2. 测试文件生成流程
3. 测试元数据收集
4. 性能基准测试

**注意事项**:
- 模拟真实场景
- 记录性能数据

### 25. 性能优化
**状态**: [ ]  
**任务目标**: 优化系统性能  
**动作**:
1. 添加查询缓存
2. 优化文件I/O
3. 实现连接池
4. 添加索引优化

**注意事项**:
- 监控内存使用
- 避免过度优化

---

## Phase 7: 数据迁移

### 26. 创建数据迁移脚本
**状态**: [ ]  
**任务目标**: 迁移现有数据到新结构  
**动作**:
1. 创建 `scripts/migrate-data.js`
2. 实现用户数据迁移
3. 迁移文件元数据
4. 生成迁移报告

**当前使用位置**:
- `/terminal-backend/data/users.json` (用户数据)
- `/terminal-backend/data/users/{username}/` (用户文件夹)
- `/terminal-backend/src/services/userService.js:255-325` (已有迁移逻辑参考)

**注意事项**:
- 创建迁移前备份
- 支持增量迁移

### 27. 执行数据验证
**状态**: [ ]  
**任务目标**: 确保数据完整性  
**动作**:
1. 验证数据条数
2. 检查数据一致性
3. 验证文件存在性
4. 生成验证报告

**当前使用位置**:
- 需要新建验证脚本
- 验证所有JSON数据库文件的结构
- 检查storage目录的文件完整性

**注意事项**:
- 记录数据差异
- 提供修复建议

### 28. 创建回滚脚本
**状态**: [ ]  
**任务目标**: 支持快速回滚  
**动作**:
1. 创建 `scripts/rollback.js`
2. 实现数据恢复
3. 恢复代码版本
4. 验证回滚结果

**当前使用位置**:
- 新增功能
- 备份文件存储在 `/terminal-backend/data/backup/`

**注意事项**:
- 保留多个备份版本
- 测试回滚流程

---

## Phase 8: 部署和监控

### 29. 更新部署配置
**状态**: [ ]  
**任务目标**: 适配新的架构  
**动作**:
1. 更新Docker配置
2. 添加数据卷映射
3. 更新环境变量
4. 配置健康检查

**当前使用位置**:
- `/Dockerfile` (Docker配置文件)
- `/docker-compose.yml` (容器编排)
- `/.env.example` (环境变量示例)
- `/terminal-backend/src/index.js` (启动入口)

**注意事项**:
- 保持配置兼容性
- 添加启动检查

### 30. 设置监控和告警
**状态**: [ ]  
**任务目标**: 监控系统运行状态  
**动作**:
1. 添加性能监控
2. 设置错误告警
3. 监控存储使用
4. 创建监控面板

**当前使用位置**:
- `/terminal-backend/src/utils/logger.js` (日志系统)
- 新增监控功能，需要集成到主要服务中

**注意事项**:
- 设置合理阈值
- 避免告警风暴

---

## 里程碑检查点

| 阶段 | 完成标准 | 关键依赖 |
|------|---------|----------|
| Phase 1 | 基础架构就绪，BaseDAO可用 | 目录结构、配置文件 |
| Phase 2 | 所有DAO实现完成并测试 | BaseDAO、数据库文件 |
| Phase 3 | 存储层完成，文件可访问 | DAO层、存储配置 |
| Phase 4 | 服务层改造完成 | DAO层、存储层 |
| Phase 5 | API层集成完成 | 服务层 |
| Phase 6 | 测试覆盖率>80% | 所有代码完成 |
| Phase 7 | 数据迁移成功 | 新架构稳定 |
| Phase 8 | 系统上线运行 | 测试通过、数据迁移完成 |

---

## 风险和依赖

### 高风险项
1. **数据一致性**: 并发写入可能导致数据冲突
   - 缓解: 实现文件锁机制
   
2. **性能退化**: JSON文件操作可能比内存慢
   - 缓解: 添加内存缓存层

3. **文件系统限制**: 单目录文件数限制
   - 缓解: 按日期/ID分片存储

### 外部依赖
1. Node.js fs-extra 库
2. 文件锁库 (proper-lockfile)
3. 测试框架 (Jest)
4. 日志库 (winston)

---

## 验收标准

### 功能验收
- [ ] 所有现有功能正常工作
- [ ] 新增元数据查询功能可用
- [ ] 数据持久化正确

### 性能验收  
- [ ] API响应时间 < 200ms (P95)
- [ ] 并发支持 > 100 req/s
- [ ] 内存使用 < 512MB

### 质量验收
- [ ] 代码测试覆盖率 > 80%
- [ ] 无Critical级别bug
- [ ] 文档完整准确

---

**文档版本**: 1.0.0  
**创建日期**: 2024-01-20  
**最后更新**: 2024-01-20  
**负责人**: AI Terminal Team