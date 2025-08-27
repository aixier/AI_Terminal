# 异步卡片生成API测试脚本

## 📋 功能说明

完整测试异步卡片生成API的流程：
1. 提交异步任务
2. 轮询查询状态
3. 获取生成内容
4. 保存到本地文件

## 🚀 快速开始

### 测试远程服务 (8.130.86.152:8083)
```bash
node test-async-card-api.js
```

### 测试本地服务
```bash
node test-async-card-api.js http://127.0.0.1:8083
```

### 使用快捷脚本
```bash
# 测试远程
node test-remote.js

# 测试本地
node test-remote.js --local
```

## 📝 测试配置

默认测试参数：
- **主题**: 泰国孕妇坠崖案王暖暖专访深度解析
- **模板**: cardplanet-Sandra-json
- **Token**: bob-secure-token-def456
- **参考文本**: 采访总结.md（前2000字）

## 🔧 高级配置

### 使用环境变量
```bash
API_URL=http://your-server:port API_TOKEN=your-token node test-async-card-api.js
```

### 命令行参数
```bash
node test-async-card-api.js <API_URL> <TOKEN>
```

## 📁 输出文件

测试结果保存在 `test-output/` 目录：
- HTML文件：展示页面
- JSON文件：数据内容
- _metadata.json：元数据信息

## ⏱️ 预期时间

- 提交任务：立即返回
- 等待时间：30秒后开始查询
- 生成时间：3-5分钟（cardplanet-Sandra-json模板）
- 总时间：约4-6分钟

## 🔍 调试信息

脚本会实时输出：
- ✅ 成功状态（绿色）
- ⏳ 进行中状态（黄色）
- ❌ 错误信息（红色）
- 📊 统计信息（青色）

## 📌 注意事项

1. 确保服务器已启动并可访问
2. Token需要有效（默认使用bob用户）
3. 生成时间较长，请耐心等待
4. 如果超时，可以手动查询：
   ```bash
   curl http://8.130.86.152:8083/api/generate/card/query/文件夹名
   ```

## 🆘 常见问题

### 连接失败
- 检查服务器是否运行
- 检查防火墙和端口设置
- 确认API地址正确

### 生成超时
- 增加轮询次数（修改maxAttempts参数）
- 检查服务器日志
- 可能是模板复杂度导致

### Token无效
- 确认用户存在
- 检查token是否正确
- 查看users.json配置