# API 变更日志

## [v3.63.0] - 2025-08-27

### 🎉 新增功能

#### 1. 用户自定义参数支持
所有卡片生成接口（同步、流式、异步）现在支持用户自定义参数：

- **style** - 用户可以指定卡片风格，系统将优先使用用户提供的风格
- **language** - 用户可以指定语言类型（中文/英文/中英双语）
- **reference** - 用户可以提供额外的参考内容

**使用示例：**
```json
{
  "topic": "人工智能",
  "templateName": "cardplanet-Sandra-json",
  "style": "科技简约风",        // 用户指定，不会被AI覆盖
  "language": "中文",           // 用户指定，不会被AI覆盖
  "reference": "关于AI的最新进展" // 用户提供的参考内容
}
```

**优势：**
- 减少AI调用次数，提高生成速度
- 给用户更多控制权
- 支持灵活的参数组合（可只传部分参数）

#### 2. Token 参数支持
所有接口新增 `token` 参数，用于指定生成到特定用户目录：

```json
{
  "topic": "机器学习",
  "token": "user_token_123"  // 生成到该token对应的用户目录
}
```

**工作流程：**
1. 有token → 查找对应用户 → 生成到该用户目录
2. 无token → 使用default用户 → 生成到default目录
3. token无效 → 回退到default用户

#### 3. 异步生成接口
新增 `/api/generate/card/async` 接口，支持后台异步生成：

**特点：**
- 立即返回任务ID，不阻塞客户端
- 适合批量生成任务
- 支持所有参数配置

**响应示例：**
```json
{
  "data": {
    "taskId": "task_1234567890_abc",
    "folderName": "sanitized_topic_name",
    "status": "submitted"
  }
}
```

### 🔧 改进

1. **参数生成机制优化**
   - 仅生成用户未提供的参数
   - 所有参数都提供时跳过AI调用
   - 提高了生成效率

2. **文档改进**
   - 更详细的参数说明
   - 增加了更多使用示例
   - 清晰的版本标注

### 📝 接口兼容性

- ✅ **完全向后兼容** - 所有新参数都是可选的
- ✅ **无破坏性变更** - 现有集成无需修改
- ✅ **渐进式增强** - 可根据需要选择使用新功能

---

## [v3.62.2] - 2025-08-25

### 新增
- 添加 `pageinfo` 字段支持 cardplanet-Sandra-json 模板
- 支持双文件输出（HTML + JSON）

### 改进
- 优化文件检测逻辑
- 改进错误处理机制

---

## [v3.62.0] - 2025-08-24

### 新增
- 支持多文件输出模板
- 添加 `allFiles` 字段返回所有生成的文件信息

### 改进
- 增强模板验证
- 优化文件生成流程

---

## [v3.33.0] - 2025-01-19

### 改进
- 简化 Claude 执行流程
- 移除复杂的初始化步骤
- 提高执行效率

---

## [v3.10.27] - 2025-01-11

### 新增
- 自动参数生成功能
- AI智能选择风格、语言和参考内容

### 改进
- 优化提示词生成
- 增强参数验证

---

## 使用指南

### 快速开始

1. **基础使用（无需改动）**
```bash
curl -X POST http://localhost:4000/api/generate/card \
  -H "Content-Type: application/json" \
  -d '{"topic": "人工智能"}'
```

2. **使用自定义参数**
```bash
curl -X POST http://localhost:4000/api/generate/card \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "人工智能",
    "style": "科技风",
    "language": "中文"
  }'
```

3. **指定用户目录**
```bash
curl -X POST http://localhost:4000/api/generate/card \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "人工智能",
    "token": "user_token_123"
  }'
```

4. **异步生成**
```bash
# 提交任务
curl -X POST http://localhost:4000/api/generate/card/async \
  -H "Content-Type: application/json" \
  -d '{"topic": "人工智能"}'

# 查询结果
curl http://localhost:4000/api/generate/card/query/人工智能
```

### 最佳实践

1. **性能优化**
   - 提供完整参数可跳过AI生成，节省30-60秒
   - 使用异步接口处理批量任务

2. **用户体验**
   - 流式接口提供实时反馈
   - 异步接口避免长时间等待

3. **错误处理**
   - 检查返回的 `code` 字段
   - 记录 `taskId` 或 `apiId` 用于问题追踪

### 支持与反馈

如有问题或建议，请提交到项目 Issues：
https://github.com/your-repo/ai-terminal/issues