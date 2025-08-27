# 卡片生成 API 快速开始指南

## 🚀 5分钟快速上手

### 1. 最简单的请求（使用默认配置）

```bash
# 生成一个关于"人工智能"的卡片
curl -X POST http://localhost:4000/api/generate/card \
  -H "Content-Type: application/json" \
  -d '{"topic": "人工智能"}'
```

这将：
- 使用默认模板生成卡片
- AI自动选择合适的风格和语言
- 保存到 default 用户目录

### 2. 使用自定义参数（v3.63.0 新功能）

```bash
# 指定风格和语言
curl -X POST http://localhost:4000/api/generate/card \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "机器学习",
    "style": "科技简约风",
    "language": "中文",
    "reference": "深度学习是机器学习的一个分支..."
  }'
```

**优势：**
- 🚀 跳过AI参数生成，节省30-60秒
- 🎨 完全控制输出风格
- 🌍 指定输出语言

### 3. 生成到特定用户目录（v3.63.0 新功能）

```bash
# 使用 token 参数指定用户
curl -X POST http://localhost:4000/api/generate/card \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "区块链技术",
    "token": "user_alice_token"
  }'
```

### 4. 使用流式接口（实时反馈）

```javascript
// JavaScript 示例
const eventSource = new EventSource('/api/generate/card/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    topic: '量子计算',
    style: '未来科技风'  // v3.63.0: 可选参数
  })
});

eventSource.addEventListener('output', (e) => {
  console.log('实时输出:', JSON.parse(e.data));
});

eventSource.addEventListener('success', (e) => {
  const result = JSON.parse(e.data);
  console.log('生成完成:', result);
  eventSource.close();
});
```

### 5. 异步生成（批量处理）

```bash
# 步骤1: 提交任务
response=$(curl -X POST http://localhost:4000/api/generate/card/async \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "元宇宙",
    "templateName": "cardplanet-Sandra-json"
  }')

# 获取任务ID和文件夹名
taskId=$(echo $response | jq -r '.data.taskId')
folderName=$(echo $response | jq -r '.data.folderName')

# 步骤2: 查询结果（稍后）
curl http://localhost:4000/api/generate/card/query/$folderName
```

## 📊 接口对比表

| 特性 | 同步接口 | 流式接口 | 异步接口 |
|-----|---------|---------|---------|
| **端点** | `/card` | `/card/stream` | `/card/async` |
| **响应时间** | 2-5分钟 | 实时 | 立即返回 |
| **适用场景** | 简单集成 | 需要进度反馈 | 批量生成 |
| **超时风险** | 有 | 低 | 无 |
| **支持参数** | ✅ 全部 | ✅ 全部 | ✅ 全部 |

## 🎯 参数说明（v3.63.0）

### 必需参数
- `topic` (string) - 卡片主题

### 可选参数
| 参数 | 类型 | 说明 | 示例 |
|-----|------|------|------|
| `templateName` | string | 模板名称 | `"cardplanet-Sandra-json"` |
| `style` | string | 自定义风格 | `"科技简约风"` |
| `language` | string | 输出语言 | `"中文"` / `"英文"` / `"中英双语"` |
| `reference` | string | 参考内容 | `"相关背景信息..."` |
| `token` | string | 用户令牌 | `"user_token_123"` |

## 🔥 最佳实践

### 1. 提高生成速度
```json
{
  "topic": "你的主题",
  "style": "明确的风格",      // ✅ 提供所有参数
  "language": "中文",          // ✅ 跳过AI生成
  "reference": "参考内容"      // ✅ 节省30-60秒
}
```

### 2. 批量生成
```javascript
// 使用异步接口批量提交
const topics = ['AI', '区块链', '量子计算'];
const tasks = topics.map(topic => 
  fetch('/api/generate/card/async', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic })
  })
);

// 并行提交所有任务
Promise.all(tasks).then(responses => {
  console.log('所有任务已提交');
});
```

### 3. 错误处理
```javascript
try {
  const response = await fetch('/api/generate/card', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic: '主题' })
  });
  
  const result = await response.json();
  
  if (result.code !== 200) {
    // 处理业务错误
    console.error('生成失败:', result.message);
  }
} catch (error) {
  // 处理网络错误
  console.error('请求失败:', error);
}
```

## 📈 性能参考

| 模板 | AI参数生成 | 卡片生成 | 总时间 |
|------|-----------|----------|---------|
| daily-knowledge | 30s | 70-90s | 100-120s |
| cardplanet-Sandra | 45s | 185-215s | 230-260s |
| 用户提供参数 | 0s | 70-215s | 70-215s ⚡ |

## 🆘 常见问题

### Q: 如何选择合适的接口？
- **同步接口**：适合简单场景，一次性生成
- **流式接口**：需要实时反馈，显示进度
- **异步接口**：批量生成，后台处理

### Q: token 参数和 Authorization 头的区别？
- `token` 参数：指定生成文件保存到哪个用户目录
- `Authorization` 头：API访问认证
- 两者可以同时使用，也可以单独使用

### Q: 如何加快生成速度？
1. 提供完整的 style、language、reference 参数
2. 使用异步接口进行批量处理
3. 选择合适的模板（daily-knowledge 最快）

## 📚 相关文档

- [完整 API 参考](./card-generation-api.md)
- [变更日志](./CHANGELOG.md)
- [模板开发指南](../template-development.md)

## 💡 需要帮助？

- 查看 [Issues](https://github.com/your-repo/ai-terminal/issues)
- 提交 Bug 或功能建议
- 参与开源贡献