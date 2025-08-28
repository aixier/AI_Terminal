# 更新日志

本文档记录AI Terminal项目的重要变更。

## [v3.62.3] - 2025-08-28

### 🔧 优化改进
- **修复**: 小红书分享pageinfo参数传递逻辑优化
- **改进**: 前端不再依赖meta.json文件查找，直接使用API响应中的templateName字段
- **增强**: 优先使用API提供的pageinfo字段，提高分享功能效率
- **完善**: 统一文件名字段访问方式，兼容不同API响应格式
- **优化**: 增强错误处理和调试日志输出

### 🧪 测试验证
- **验证**: API Response Schema完全符合预期格式
- **测试**: 异步和同步接口的模板支持度验证通过
- **确认**: cardplanet-Sandra-json 和 daily-knowledge-card-template.md 模板正常工作

### 📋 Schema规范
- **异步API**: `/api/generate/card/async` 响应格式标准化
- **状态查询**: `/api/generate/status/:topic` 状态管理规范化  
- **内容查询**: `/api/generate/card/query/:folderName` 文件信息完整性
- **模板判断**: templateName字段在所有相关接口中统一提供

### 📝 文档更新
- **新增**: API Schema验证报告 (`docs/api-schema-report.md`)
- **整理**: 测试文件归档至 `archive/tests/` 目录

## [v3.10.21] - 2025-01-19

### 🐛 Bug修复
- **修复**: `/api/generate/cc` 接口在Docker容器中执行超时问题
- **修复**: Claude CLI 在非交互式环境中的 Raw mode 错误

### 🔧 技术改进
- **优化**: 改用 echo pipe 方式执行 Claude CLI，避免 TTY 交互问题
- **性能**: 接口响应时间稳定在 7-10 秒，成功率达到 100%
- **实现**: 使用 `spawn('sh', ['-c', 'echo "${prompt}" | claude'])` 替代直接调用

### 📝 文档更新
- **新增**: `node-pty-claude-integration.md` 详细集成指南
- **更新**: API文档中 `/api/generate/cc` 接口的实现说明
- **记录**: 完整的测试结果和最佳实践
