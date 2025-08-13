# 文件夹模板支持 - 任务清单

## 任务概览
实现文件夹形式的模板支持，使系统能够处理复杂的多文档模板体系。

## 详细任务列表

### 任务1：修改 generate.js 的 /card 端点
**文件：** `/mnt/d/work/AI_Terminal/terminal-backend/src/routes/generate.js`
**位置：** 第38-63行
**状态：** ⏳ 待完成

#### 修改内容：
1. 在构建模板路径前添加类型判断
2. 实现两种路径构建逻辑
3. 实现两种提示词构建策略
4. 优化错误处理

#### 具体代码修改：
```javascript
// 替换原有的第38-63行
// 1. 判断模板类型
const isFolder = !templateName.includes('.md');

// 2. 构建模板路径和提示词
let templatePath, prompt;

if (isFolder) {
  // 文件夹模式
  templatePath = isDocker 
    ? path.join('/app/data/public_template', templateName)
    : path.join(dataPath, 'public_template', templateName);
  
  // 检查文件夹是否存在
  try {
    const stats = await fs.stat(templatePath);
    if (!stats.isDirectory()) {
      throw new Error('不是有效的模板文件夹');
    }
  } catch {
    return res.status(404).json({
      code: 404,
      success: false,
      message: `模板文件夹不存在: ${templateName}`
    });
  }
  
  // 构建文件夹模式的提示词
  const claudePath = path.join(templatePath, 'CLAUDE.md');
  prompt = `你是一位海报设计师，要为"${topic}"创作一套收藏级卡片海报作品。
创作重点：
- 把每张卡片当作独立的艺术海报设计
- 深挖主题的趣味性和视觉潜力
- 用细节和创意打动人心
风格：根据主题自动选择最合适的风格（理解其精神内核，不只是表面元素）
语言：全中文
从${claudePath}文档开始，按其指引阅读全部4个文档获取创作框架。
记住：规范是创作的基础，但你的目标是艺术品，不是代码任务。
生成的json文档保存在[${userCardPath}]`;

} else {
  // 单文件模式（保持原有逻辑）
  templatePath = isDocker 
    ? path.join('/app/data/public_template', templateName)
    : path.join(dataPath, 'public_template', templateName);
  
  // 检查模板文件是否存在
  try {
    await fs.access(templatePath);
  } catch {
    return res.status(404).json({
      code: 404,
      success: false,
      message: `模板文件不存在: ${templateName}`
    });
  }
  
  // 原有的提示词
  prompt = `根据[${templatePath}]文档的规范，就以下命题，生成一组卡片的json文档在[${userCardPath}]：${topic}`;
}
```

---

### 任务2：修改 generate.js 的 /card/stream 端点
**文件：** `/mnt/d/work/AI_Terminal/terminal-backend/src/routes/generate.js`
**位置：** 第304-484行（第一个stream端点）
**状态：** ⏳ 待完成

#### 修改内容：
同任务1，在流式接口中实现相同的逻辑

---

### 任务3：修改 generate.js 的第二个 /card/stream 端点
**文件：** `/mnt/d/work/AI_Terminal/terminal-backend/src/routes/generate.js`
**位置：** 第492-648行（第二个stream端点）
**状态：** ⏳ 待完成

#### 修改内容：
同任务1，在流式接口中实现相同的逻辑

---

### 任务4：优化 /templates 端点
**文件：** `/mnt/d/work/AI_Terminal/terminal-backend/src/routes/generate.js`
**位置：** 第217-243行
**状态：** ⏳ 待完成

#### 修改内容：
```javascript
router.get('/templates', async (req, res) => {
  try {
    const isDocker = process.env.NODE_ENV === 'production' || process.env.DATA_PATH;
    const dataPath = process.env.DATA_PATH || path.join(process.cwd(), 'data');
    const templatesPath = isDocker
      ? '/app/data/public_template'
      : path.join(dataPath, 'public_template');
    
    const items = await fs.readdir(templatesPath, { withFileTypes: true });
    const templates = [];
    
    for (const item of items) {
      if (item.isDirectory()) {
        // 文件夹模板
        templates.push({
          fileName: item.name,
          displayName: item.name,
          type: 'folder'
        });
      } else if (item.name.endsWith('.md')) {
        // 单文件模板
        templates.push({
          fileName: item.name,
          displayName: item.name.replace('.md', '').replace(/-/g, ' '),
          type: 'file'
        });
      }
    }
    
    res.json({
      code: 200,
      success: true,
      templates: templates,
      message: 'success'
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      success: false,
      message: error.message
    });
  }
});
```

---

### 任务5：测试验证
**状态：** ⏳ 待完成

#### 测试用例：
1. **测试单文件模板（确保兼容性）**
   ```json
   {
     "topic": "AI幻觉",
     "templateName": "daily-knowledge-card-template.md"
   }
   ```

2. **测试文件夹模板**
   ```json
   {
     "topic": "心理韧性",
     "templateName": "cardplanet-Sandra"
   }
   ```

3. **测试模板列表API**
   ```
   GET /api/generate/templates
   ```

4. **测试错误处理**
   - 不存在的模板文件
   - 不存在的模板文件夹
   - 空的主题参数

---

### 任务6：更新项目文档
**文件：** 创建或更新README
**状态：** ⏳ 待完成

#### 内容：
- 说明文件夹模板的使用方法
- 提供API调用示例
- 说明模板类型的区别

---

## 执行顺序
1. ✅ 创建方案文档
2. ✅ 创建任务文档
3. ⏳ 修改generate.js支持文件夹模板（任务1-3）
4. ⏳ 优化模板列表API（任务4）
5. ⏳ 测试文件夹模板功能（任务5）
6. ⏳ 更新项目文档（任务6）

## 风险提醒
- 修改前请备份原文件
- 注意Docker环境和本地环境的路径差异
- 测试时注意观察Claude的执行日志

## 完成标准
- [ ] 所有代码修改完成
- [ ] 单文件模板功能正常
- [ ] 文件夹模板功能正常
- [ ] API接口返回正确
- [ ] 错误处理完善
- [ ] 文档更新完整