# 素材管理系统文档

## 概述

素材管理系统是 AI Terminal v4.0.0 引入的核心功能，提供了完整的文件上传、分类、引用和管理能力，支持与自定义模式深度集成。

## 系统架构

### 三栏布局设计
```
[左侧栏：分类列表] [中间栏：文件列表] [右侧栏：文件预览]
```

### 核心特性
1. **分类管理**: 基于分类而非文件路径的组织方式
2. **智能引用**: 通过 `@分类/文件` 语法快速引用
3. **实时预览**: 支持图片、文本、代码等多种格式预览
4. **批量操作**: 支持批量上传、移动、删除

## 技术实现

### 前端组件
- **AssetManagerSimple.vue** - 简化的素材管理器
- **AssetReferencePicker.vue** - 素材引用选择器
- **useAssetCache.js** - 素材缓存管理

### 后端服务
- **assets.js** - 素材管理主服务
- **referenceConverter.js** - 引用转换服务

### 数据存储
```
/data/users/{username}/assets/
├── {category}/           # 分类文件夹
│   ├── file1.jpg
│   ├── file2.txt
│   └── _metadata.json    # 分类元数据
└── _index.json          # 总索引文件
```

## API 接口

### 1. 获取素材列表
```http
GET /api/assets?category=分类名&page=1&pageSize=20
```

### 2. 上传素材
```http
POST /api/assets/upload
FormData: files[], category
```

### 3. 分类管理
```http
GET /api/assets/categories              # 获取分类列表
POST /api/assets/categories             # 创建分类
PUT /api/assets/categories/:category    # 重命名分类
DELETE /api/assets/categories/:category # 删除分类
```

### 4. 文件操作
```http
DELETE /api/assets/file                 # 删除文件
PUT /api/assets/file/rename            # 重命名文件
PUT /api/assets/file/move              # 移动文件
GET /api/assets/file/:category/:filename # 获取文件
```

### 5. 搜索功能
```http
GET /api/assets/search?keyword=关键词&category=分类
```

## 元数据管理

### 分类元数据 (_metadata.json)
```json
{
  "category": "分类名",
  "count": 10,
  "size": 1024000,
  "created": "2025-09-05T10:00:00Z",
  "modified": "2025-09-05T10:00:00Z",
  "files": {
    "file1.jpg": {
      "size": 102400,
      "type": "image/jpeg",
      "uploaded": "2025-09-05T10:00:00Z"
    }
  }
}
```

### 索引文件 (_index.json)
```json
{
  "categories": {
    "images": {
      "count": 10,
      "size": 1024000,
      "lastModified": "2025-09-05T10:00:00Z"
    }
  },
  "totalFiles": 50,
  "totalSize": 5242880
}
```

## 使用场景

### 1. 素材上传
1. 选择或创建分类
2. 拖拽或选择文件
3. 批量上传
4. 自动更新索引

### 2. 素材引用
1. 在自定义模式下输入 `@`
2. 选择分类和文件
3. 自动插入引用
4. Claude 读取并处理

### 3. 素材管理
1. 浏览分类和文件
2. 预览文件内容
3. 移动或重命名
4. 批量删除

## 最佳实践

### 分类命名规范
- 使用清晰的描述性名称
- 避免特殊字符
- 建议使用英文或拼音
- 例如：`designs`, `documents`, `images`

### 文件命名建议
- 保持简洁明了
- 包含版本或日期信息
- 避免空格，使用下划线或连字符
- 例如：`logo_v2.png`, `report-2025-09.md`

### 性能优化
1. **缓存策略**: 使用 IndexedDB 缓存常用素材
2. **懒加载**: 大型文件列表分页加载
3. **缩略图**: 图片自动生成缩略图
4. **索引更新**: 异步更新，避免阻塞

## 安全考虑

1. **文件类型限制**: 禁止上传可执行文件
2. **大小限制**: 单文件最大 10MB
3. **路径验证**: 防止目录遍历攻击
4. **权限隔离**: 用户只能访问自己的素材

## 故障排查

### 常见问题

1. **上传失败**
   - 检查文件大小是否超限
   - 确认文件类型是否允许
   - 验证网络连接状态

2. **引用无效**
   - 确认文件存在
   - 检查分类名称拼写
   - 刷新素材缓存

3. **预览异常**
   - 检查文件格式支持
   - 清理浏览器缓存
   - 更新到最新版本

## 版本历史

### v4.0.0 (2025-09-01)
- 初始素材管理系统
- 基础上传和分类功能

### v4.3.0 (2025-09-03)
- 三栏布局优化
- 元数据管理完善
- 搜索功能增强

### v4.5.0 (2025-09-05)
- 与自定义模式集成
- 实时预览功能
- 批量操作支持

---

*本文档整合了所有素材管理相关文档，提供完整的系统参考。*