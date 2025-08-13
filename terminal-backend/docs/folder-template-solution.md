# 文件夹模板支持方案文档

## 一、背景与需求

### 当前状态
- 系统目前仅支持单个markdown文件作为模板
- cardplanet-Sandra等复杂模板需要多个文档协同工作
- 现有提示词过于技术化，缺乏艺术创作引导

### 需求目标
1. 支持文件夹形式的模板包
2. 为文件夹模板使用专门的艺术化提示词
3. 保持向后兼容，不影响现有单文件模板
4. 前端零改动，仅通过后端智能识别处理

## 二、技术方案

### 2.1 模板类型识别
```javascript
// 通过文件扩展名判断
const isFolder = !templateName.includes('.md');
```

### 2.2 文件夹结构规范
```
public_template/
├── daily-knowledge-card-template.md     # 单文件模板
└── cardplanet-Sandra/                   # 文件夹模板
    ├── CLAUDE.md                        # 入口文档
    ├── style_guide.md                   # 风格指南
    ├── html_generation_workflow.md      # 工作流程
    └── layout_guidelines_updated.md    # 布局指南
```

### 2.3 提示词策略

#### 单文件模板提示词（保持不变）
```
根据[${templatePath}]文档的规范，就以下命题，生成一组卡片的json文档在[${userCardPath}]：${topic}
```

#### 文件夹模板提示词（新增）
```
你是一位海报设计师，要为"${topic}"创作一套收藏级卡片海报作品。
创作重点：
- 把每张卡片当作独立的艺术海报设计
- 深挖主题的趣味性和视觉潜力
- 用细节和创意打动人心
风格：根据主题自动选择最合适的风格（理解其精神内核，不只是表面元素）
语言：全中文
从${claudePath}文档开始，按其指引阅读全部4个文档获取创作框架。
记住：规范是创作的基础，但你的目标是艺术品，不是代码任务。
生成的json文档保存在[${userCardPath}]
```

## 三、接口设计

### 3.1 生成卡片接口（无需修改）
```
POST /api/generate/card
{
  "topic": "主题名称",
  "templateName": "cardplanet-Sandra"  // 文件夹名或文件名
}
```

### 3.2 模板列表接口（需优化）
```
GET /api/generate/templates

响应：
{
  "templates": [
    {
      "fileName": "daily-knowledge-card-template.md",
      "displayName": "daily knowledge card template",
      "type": "file"
    },
    {
      "fileName": "cardplanet-Sandra",
      "displayName": "cardplanet-Sandra",
      "type": "folder"
    }
  ]
}
```

## 四、实施步骤

1. **修改 generate.js**
   - 添加模板类型判断逻辑
   - 实现两种提示词构建策略
   - 优化错误处理

2. **优化模板列表API**
   - 区分文件和文件夹类型
   - 返回类型标识

3. **测试验证**
   - 测试单文件模板兼容性
   - 测试文件夹模板功能
   - 验证错误处理

## 五、风险评估

### 风险点
1. Claude可能无法正确读取文件夹路径
2. 提示词变化可能影响生成质量

### 缓解措施
1. 在提示词中明确指定CLAUDE.md的完整路径
2. 保留测试期，根据效果调整提示词

## 六、预期效果

1. **扩展性提升**：支持更复杂的多文档模板体系
2. **创作质量提升**：艺术化提示词引导更好的创作
3. **维护性提升**：模板内容与代码分离，便于独立更新
4. **用户体验一致**：前端无感知，使用体验保持一致

## 七、后续优化建议

1. **配置文件支持**：在文件夹根目录添加config.json配置默认参数
2. **模板预览**：提供模板说明和示例展示
3. **动态参数**：支持风格、语言等参数的动态传递
4. **模板市场**：建立模板共享机制

## 八、验收标准

1. ✅ 现有单文件模板功能正常
2. ✅ 文件夹模板能正确识别和处理
3. ✅ 生成的卡片符合艺术化要求
4. ✅ API接口向后兼容
5. ✅ 错误处理完善