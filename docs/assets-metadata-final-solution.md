# 素材管理系统 - 最终元数据方案

## 一、核心设计理念

1. **分类而非路径**：使用分类标识符（如 `projects.designs`）而不是文件路径
2. **数据最小化**：只存储必要信息，减少数据冗余
3. **清晰无歧义**：让大模型能准确理解数据结构，不会误解为文件系统路径

## 二、元数据结构

### 完整结构示例

```json
{
  "version": "3.0",
  "userId": "default",
  "lastUpdated": "2025-09-03T15:30:00.000Z",
  
  "assets": {
    "projects": ["需求文档.pdf", "项目计划.xlsx", "会议纪要.docx"],
    "projects.designs": ["首页设计.fig", "列表页设计.fig", "详情页设计.fig"],
    "projects.designs.mobile": ["移动端首页.sketch", "移动端导航.sketch"],
    "projects.designs.desktop": ["PC端首页.psd", "PC端详情页.psd"],
    "projects.technical": ["API文档.md", "数据库设计.xlsx", "架构图.drawio"],
    "media": ["封面图.jpg", "宣传海报.png"],
    "media.icons": ["home.svg", "user.svg", "settings.svg", "search.svg"],
    "media.backgrounds": ["渐变蓝.jpg", "渐变紫.jpg", "纯色灰.png"],
    "media.logos": ["公司logo.svg", "公司logo.png", "公司logo_白色.png"],
    "tutorials": ["入门教程.mp4", "进阶教程.mp4", "案例分析.mp4"],
    "": ["README.md", "演示视频.mp4", "快速开始.pdf"]
  },
  
  "labels": {
    "projects": "项目文档",
    "projects.designs": "设计稿",
    "projects.designs.mobile": "移动端",
    "projects.designs.desktop": "PC端",
    "projects.technical": "技术文档",
    "media": "图片素材",
    "media.icons": "图标",
    "media.backgrounds": "背景图",
    "media.logos": "Logo",
    "tutorials": "视频教程"
  }
}
```

### 最小化结构（仅必需字段）

```json
{
  "assets": {
    "projects": ["需求文档.pdf"],
    "projects.designs": ["首页设计.fig"],
    "media.icons": ["home.svg"]
  },
  "labels": {
    "projects": "项目文档",
    "projects.designs": "设计稿",
    "media.icons": "图标"
  }
}
```

## 三、数据字段说明

### assets（核心数据）
- **键（Key）**：分类标识符，使用点号分隔表示层级
  - `projects` - 一级分类
  - `projects.designs` - 二级分类
  - `projects.designs.mobile` - 三级分类
  - `""` - 空字符串表示根目录（未分类）
- **值（Value）**：该分类下的文件名数组

### labels（显示名称）
- **键（Key）**：与 assets 中的分类标识符对应
- **值（Value）**：该分类的中文显示名称

## 四、分类标识符规则

1. **命名规范**
   - 使用英文小写
   - 多个单词用驼峰或下划线
   - 避免特殊字符

2. **层级表示**
   - 用点号 `.` 分隔层级
   - 最多支持 5 层嵌套
   - 示例：`projects.designs.mobile.ios.icons`

3. **预定义分类建议**
   ```
   projects          - 项目相关
   media            - 媒体资源
   documents        - 文档资料
   templates        - 模板文件
   archives         - 归档文件
   temp             - 临时文件
   ```

## 五、文件存储映射

### 物理存储路径规则
```
分类标识符 → 物理路径
projects.designs.mobile → /data/users/{userId}/storage/projects/designs/mobile/
media.icons → /data/users/{userId}/storage/media/icons/
"" → /data/users/{userId}/storage/

完整文件路径示例：
/data/users/default/storage/projects/designs/mobile/移动端首页.sketch
```

### OSS 存储路径规则
```
分类标识符 → OSS路径
projects.designs.mobile → users/{userId}/storage/projects/designs/mobile/
media.icons → users/{userId}/storage/media/icons/

完整OSS路径示例：
users/default/storage/projects/designs/mobile/移动端首页.sketch
```

## 六、@引用功能实现

### 引用格式
- `@项目文档` - 引用分类
- `@项目文档/需求文档.pdf` - 引用具体文件
- `@设计稿/移动端` - 引用子分类

### 搜索匹配逻辑
```javascript
// 用户输入 @设计
1. 搜索 labels 中包含"设计"的分类
2. 搜索文件名中包含"设计"的文件
3. 返回匹配结果：
   - 📁 设计稿 (projects.designs)
   - 📄 首页设计.fig
   - 📄 列表页设计.fig
```

## 七、文件操作映射

### 创建文件夹
```javascript
// 前端操作：在"项目文档"下创建"新文件夹"
// 元数据更新：
{
  "assets": {
    "projects.newfolder": []
  },
  "labels": {
    "projects.newfolder": "新文件夹"
  }
}
```

### 上传文件
```javascript
// 前端操作：上传"测试.pdf"到"技术文档"
// 元数据更新：
{
  "assets": {
    "projects.technical": ["API文档.md", "测试.pdf"]  // 添加到数组
  }
}
```

### 移动文件
```javascript
// 前端操作：将"测试.pdf"从"技术文档"移到"项目文档"
// 元数据更新：
{
  "assets": {
    "projects.technical": ["API文档.md"],  // 从原分类移除
    "projects": ["需求文档.pdf", "测试.pdf"]  // 添加到新分类
  }
}
```

### 重命名
```javascript
// 前端操作：重命名"测试.pdf"为"测试报告.pdf"
// 元数据更新：
{
  "assets": {
    "projects": ["需求文档.pdf", "测试报告.pdf"]  // 直接替换文件名
  }
}
// 物理文件也需要重命名
```

## 八、优势总结

1. **数据量极小**：相比原方案减少 90% 数据量
2. **结构清晰**：分类关系一目了然
3. **无歧义**：不会被误解为文件路径
4. **易于维护**：增删改查操作简单
5. **大模型友好**：结构直观，易于理解和处理
6. **搜索高效**：扁平结构便于快速搜索

## 九、迁移指南

### 从旧结构迁移
```javascript
// 旧结构
{
  "folders": {
    "folder_xxx": {
      "name": "项目文档",
      "path": "/assets/项目文档",
      "files": [...]
    }
  }
}

// 新结构
{
  "assets": {
    "projects": [...]
  },
  "labels": {
    "projects": "项目文档"
  }
}
```

### 兼容性处理
- 保留旧结构文件，新系统同时支持两种格式
- 提供一键迁移工具
- 新上传的文件使用新结构

## 十、注意事项

1. **文件名处理**
   - 保持原始文件名，包括扩展名
   - 重名文件自动添加序号：`文档.pdf` → `文档(1).pdf`

2. **分类限制**
   - 最多 5 层嵌套
   - 分类名避免使用特殊字符
   - 单个分类下文件数建议不超过 1000

3. **性能优化**
   - 前端缓存元数据，减少请求
   - 大文件列表分页加载
   - 搜索结果实时缓存

## 十一、实施计划

### 第一阶段：准备工作
1. 备份现有元数据
2. 开发数据迁移脚本
3. 更新 API 接口文档

### 第二阶段：后端改造
1. 实现新的元数据读写逻辑
2. 兼容旧数据格式
3. 添加数据验证

### 第三阶段：前端适配
1. 更新数据处理逻辑
2. 优化 @引用功能
3. 改进用户界面

### 第四阶段：数据迁移
1. 批量迁移存量数据
2. 验证数据完整性
3. 清理旧数据（可选）