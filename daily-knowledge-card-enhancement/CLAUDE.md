# Daily Knowledge Card Enhancement Project

## 项目概述
为所有模板实现元数据文件生成功能，并为 `daily-knowledge-card-template.md` 模板额外实现四文件连续生成：

### 通用功能（所有模板）
- Meta元数据文件（*_meta.json）- 记录每次生成的完整过程

### 特殊功能（daily-knowledge-card-template.md）
1. JSON数据文件
2. Response响应文件  
3. HTML展示文件
4. Meta元数据文件

## 核心原则

### 1. 代码安全性
- 禁止创建、修改或改进可能被恶意使用的代码
- 只允许安全分析、检测规则、漏洞解释、防御工具和安全文档

### 2. 兼容性原则
- 保持现有API接口不变
- 确保其他模板功能不受影响
- 向后兼容现有前端代码

### 3. 错误处理
- 每个步骤都要有完整的错误处理
- 失败时能够优雅降级
- 详细记录错误信息到meta文件

### 4. 性能考虑
- 避免重复的文件读写操作
- 使用内存中的数据传递URL信息
- 合理的超时和重试机制

### 5. 日志完整性
- 记录每个步骤的开始和结束时间
- 保存关键参数和中间结果
- 便于后续调试和审计

## 架构设计

### 文件结构
```
utils/
├── sessionMetadata.js    # 元数据管理工具
├── htmlProcessor.js      # HTML处理工具
└── fileGenerator.js      # 四文件生成协调器

routes/generate/
├── card.js              # 主API入口（需修改）
├── cardAsync.js         # 异步API（需修改）
└── cardStream.js        # 流式API（需修改）
```

### 核心流程

#### 通用流程（所有模板）
1. **初始化元数据** - 创建session和日志记录
2. **生成文件** - Claude执行正常流程
3. **更新元数据** - 记录完整执行过程和生成的文件

#### 特殊流程（daily-knowledge-card-template.md）
1. **检测模板类型** - 识别 daily-knowledge-card-template.md
2. **初始化元数据** - 创建session和日志记录
3. **生成JSON** - Claude执行正常流程
4. **调用HTML API** - 获取外部生成结果
5. **保存Response** - 记录API响应信息
6. **下载HTML** - 从directDownloadUrl获取文件
7. **更新元数据** - 记录完整执行过程

## 关键技术要点

### SessionID生成规则
```javascript
const sessionId = `${Date.now()}_${userId}_${Math.random().toString(36).substr(2, 9)}`
```

### Meta文件命名
```javascript
const metaFileName = `${formatTimestamp(new Date())}_${userId}_meta.json`
// 例如: 20250828_143025_default_meta.json
```

### 错误分类处理
- **参数错误**: 立即返回，不创建文件
- **JSON生成失败**: 创建meta文件记录错误
- **HTML API失败**: 保留JSON，记录API错误
- **下载失败**: 保留前两个文件，记录下载错误

## 测试要求

### 功能测试
- [ ] 正常四文件生成流程
- [ ] 各步骤失败时的降级处理
- [ ] Meta文件内容完整性
- [ ] 其他模板不受影响

### 性能测试
- [ ] 大文件下载超时处理
- [ ] 并发请求处理
- [ ] 内存使用合理性

### 兼容性测试
- [ ] 现有前端功能正常
- [ ] API响应格式一致
- [ ] 文件检测逻辑正确