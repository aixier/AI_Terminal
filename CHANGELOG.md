# 更新日志

本文档记录AI Terminal项目的重要变更。

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
