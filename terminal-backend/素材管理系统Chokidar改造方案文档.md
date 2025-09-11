# 素材管理系统 Chokidar 改造方案文档

## 一、系统概述

全新设计基于 Chokidar 的实时文件监控素材管理系统，采用**实际文件夹结构**替代虚拟文件夹，实现高性能、实时响应的文件管理。

## 二、核心架构设计

### 2.1 技术栈
- **文件监控**: Chokidar 3.5+
- **事件处理**: EventEmitter3
- **并发控制**: p-queue
- **文件处理**: Sharp (图片处理)
- **缓存**: Node内存缓存 + Redis (可选)

### 2.2 系统架构图
```
┌─────────────────────────────────────────────┐
│                  前端应用                    │
└──────────────────┬──────────────────────────┘
                   │ WebSocket/REST API
┌──────────────────▼──────────────────────────┐
│              API Gateway                     │
│         (路由层 + 认证 + 限流)                │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│          Asset Manager Service               │
│  ┌──────────────────────────────────────┐   │
│  │   FileSystemManager (文件操作核心)    │   │
│  ├──────────────────────────────────────┤   │
│  │   ChokidarWatcher (实时监控)          │   │
│  ├──────────────────────────────────────┤   │
│  │   EventProcessor (事件处理器)         │   │
│  ├──────────────────────────────────────┤   │
│  │   MediaProcessor (媒体处理)           │   │
│  └──────────────────────────────────────┘   │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│              文件系统                        │
│         /data/users/{userId}/                │
└──────────────────────────────────────────────┘
```

## 三、文件系统结构

### 3.1 目录结构设计
```
/data/
└── users/
    └── {userId}/
        ├── assets/                 # 素材根目录
        │   ├── images/            # 图片
        │   │   ├── photos/
        │   │   ├── designs/
        │   │   └── screenshots/
        │   ├── videos/            # 视频
        │   ├── documents/         # 文档
        │   │   ├── pdf/
        │   │   ├── word/
        │   │   └── markdown/
        │   ├── audio/             # 音频
        │   └── projects/          # 项目文件
        │       ├── web/
        │       └── mobile/
        ├── .cache/                # 缓存目录
        │   ├── thumbnails/        # 缩略图
        │   ├── previews/          # 预览文件
        │   └── metadata/          # 元数据缓存
        └── .system/               # 系统文件
            ├── index.db           # 文件索引数据库
            ├── tags.json          # 标签系统
            └── config.json        # 用户配置
```

### 3.2 文件命名规范
- 使用 UUID 作为文件前缀避免冲突
- 保留原始文件名用于显示
- 格式: `{uuid}_{timestamp}_{originalName}`

## 四、核心模块设计

### 4.1 需要创建的新文件

| 序号 | 文件路径 | 功能描述 | 代码行数(预估) |
|------|---------|---------|---------------|
| 1 | `src/services/assets/ChokidarWatcher.js` | Chokidar 监控服务封装 | 200 |
| 2 | `src/services/assets/FileSystemManager.js` | 文件系统操作核心 | 300 |
| 3 | `src/services/assets/EventProcessor.js` | 事件批处理和分发 | 150 |
| 4 | `src/services/assets/MediaProcessor.js` | 媒体文件处理(缩略图等) | 200 |
| 5 | `src/services/assets/IndexService.js` | 文件索引和搜索服务 | 250 |
| 6 | `src/services/assets/AssetManager.js` | 资产管理主服务 | 400 |
| 7 | `src/routes/v2/assets.js` | 新版 API 路由 | 300 |
| 8 | `src/models/Asset.js` | 资产数据模型 | 100 |
| 9 | `src/utils/fileHelper.js` | 文件操作辅助函数 | 150 |
| 10 | `src/config/assetConfig.js` | 资产管理配置 | 50 |

### 4.2 需要删除的旧文件

| 序号 | 文件路径 | 删除原因 |
|------|---------|---------|
| 1 | `src/routes/assets.js` | 使用新版路由替代 |
| 2 | `src/routes/assets.backup.js` | 不再需要备份 |

## 五、核心功能实现

### 5.1 ChokidarWatcher 服务
```javascript
class ChokidarWatcher {
  constructor(config) {
    this.watchers = new Map()
    this.eventQueue = []
    this.config = {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100
      },
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/.DS_Store',
        '**/Thumbs.db',
        '**/*.tmp'
      ],
      depth: 5,
      alwaysStat: true,
      atomic: true
    }
  }

  // 监控用户目录
  watchUserDirectory(userId, callback) {
    const userPath = `/data/users/${userId}/assets`
    const watcher = chokidar.watch(userPath, this.config)
    
    watcher
      .on('add', path => this.handleEvent('add', path, userId))
      .on('change', path => this.handleEvent('change', path, userId))
      .on('unlink', path => this.handleEvent('delete', path, userId))
      .on('addDir', path => this.handleEvent('addDir', path, userId))
      .on('unlinkDir', path => this.handleEvent('deleteDir', path, userId))
      .on('error', error => this.handleError(error, userId))
    
    this.watchers.set(userId, watcher)
  }

  // 批量事件处理
  handleEvent(type, path, userId) {
    this.eventQueue.push({ type, path, userId, timestamp: Date.now() })
    this.processBatch()
  }

  // 批处理逻辑
  processBatch = debounce(() => {
    if (this.eventQueue.length === 0) return
    
    const events = [...this.eventQueue]
    this.eventQueue = []
    
    EventProcessor.processEvents(events)
  }, 100)
}
```

### 5.2 FileSystemManager 服务
```javascript
class FileSystemManager {
  // 创建文件夹
  async createFolder(userId, folderPath) {
    const fullPath = this.getUserPath(userId, folderPath)
    await fs.mkdir(fullPath, { recursive: true })
    await this.updateIndex(userId, 'folder_created', folderPath)
    return { path: folderPath, created: true }
  }

  // 上传文件
  async uploadFile(userId, file, targetFolder) {
    const fileId = uuidv4()
    const timestamp = Date.now()
    const fileName = `${fileId}_${timestamp}_${file.originalname}`
    const targetPath = path.join(this.getUserPath(userId, targetFolder), fileName)
    
    // 移动文件
    await fs.rename(file.path, targetPath)
    
    // 生成缩略图（异步）
    if (this.isImage(file.mimetype)) {
      MediaProcessor.generateThumbnail(targetPath, userId, fileId)
    }
    
    // 更新索引
    await this.updateIndex(userId, 'file_added', {
      id: fileId,
      name: file.originalname,
      path: targetPath,
      size: file.size,
      type: file.mimetype
    })
    
    return { id: fileId, path: targetPath }
  }

  // 移动文件/文件夹
  async move(userId, sourcePath, targetPath) {
    const source = this.getUserPath(userId, sourcePath)
    const target = this.getUserPath(userId, targetPath)
    
    await fs.rename(source, target)
    await this.updateIndex(userId, 'moved', { from: sourcePath, to: targetPath })
  }

  // 删除文件/文件夹
  async delete(userId, itemPath) {
    const fullPath = this.getUserPath(userId, itemPath)
    const stats = await fs.stat(fullPath)
    
    if (stats.isDirectory()) {
      await fs.rm(fullPath, { recursive: true })
    } else {
      await fs.unlink(fullPath)
    }
    
    await this.updateIndex(userId, 'deleted', itemPath)
  }
}
```

### 5.3 EventProcessor 服务
```javascript
class EventProcessor extends EventEmitter {
  constructor() {
    super()
    this.queue = new PQueue({ concurrency: 10 })
    this.batchSize = 50
    this.batchTimeout = 100
  }

  async processEvents(events) {
    // 事件去重
    const uniqueEvents = this.deduplicateEvents(events)
    
    // 事件分类
    const categorized = this.categorizeEvents(uniqueEvents)
    
    // 批量处理
    for (const [type, typeEvents] of Object.entries(categorized)) {
      await this.queue.add(() => this.processBatch(type, typeEvents))
    }
  }

  deduplicateEvents(events) {
    const eventMap = new Map()
    
    for (const event of events) {
      const key = `${event.type}:${event.path}`
      const existing = eventMap.get(key)
      
      if (!existing || event.timestamp > existing.timestamp) {
        eventMap.set(key, event)
      }
    }
    
    return Array.from(eventMap.values())
  }

  async processBatch(type, events) {
    switch(type) {
      case 'add':
        await this.handleFileAdded(events)
        break
      case 'change':
        await this.handleFileChanged(events)
        break
      case 'delete':
        await this.handleFileDeleted(events)
        break
    }
    
    // 发送事件通知
    this.emit('batch_processed', { type, count: events.length })
  }
}
```

### 5.4 MediaProcessor 服务
```javascript
class MediaProcessor {
  constructor() {
    this.thumbnailQueue = new PQueue({ concurrency: 5 })
    this.thumbnailSizes = {
      small: { width: 150, height: 150 },
      medium: { width: 300, height: 300 },
      large: { width: 600, height: 600 }
    }
  }

  async generateThumbnail(filePath, userId, fileId) {
    await this.thumbnailQueue.add(async () => {
      const cachePath = `/data/users/${userId}/.cache/thumbnails`
      await fs.mkdir(cachePath, { recursive: true })
      
      for (const [size, dimensions] of Object.entries(this.thumbnailSizes)) {
        const outputPath = path.join(cachePath, `${fileId}_${size}.jpg`)
        
        await sharp(filePath)
          .resize(dimensions.width, dimensions.height, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .jpeg({ quality: 85 })
          .toFile(outputPath)
      }
    })
  }

  async extractMetadata(filePath) {
    const metadata = await sharp(filePath).metadata()
    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: metadata.size,
      density: metadata.density
    }
  }
}
```

## 六、API 设计

### 6.1 RESTful API

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/v2/assets` | 获取资产列表 |
| GET | `/api/v2/assets/tree` | 获取目录树结构 |
| GET | `/api/v2/assets/:id` | 获取资产详情 |
| POST | `/api/v2/assets/upload` | 上传文件 |
| POST | `/api/v2/assets/folder` | 创建文件夹 |
| PUT | `/api/v2/assets/:id/move` | 移动文件/文件夹 |
| PUT | `/api/v2/assets/:id/rename` | 重命名 |
| DELETE | `/api/v2/assets/:id` | 删除文件/文件夹 |
| POST | `/api/v2/assets/batch` | 批量操作 |
| GET | `/api/v2/assets/search` | 搜索文件 |
| GET | `/api/v2/assets/:id/thumbnail` | 获取缩略图 |

### 6.2 实时通信方案（HTTP + SSE）

#### 为什么选择 HTTP + SSE 而不是 WebSocket

| 对比项 | HTTP + SSE | WebSocket |
|--------|------------|-----------|  
| **单向推送** | ✅ 完美匹配（服务器→客户端） | 双向通信（过度设计） |
| **HTTP兼容** | ✅ 原生HTTP，防火墙友好 | 需要特殊端口和配置 |
| **自动重连** | ✅ 浏览器自动处理 | 需要手动实现 |
| **负载均衡** | ✅ 标准HTTP，易于分布式 | 需要粘性会话 |
| **缓存代理** | ✅ 支持CDN和代理 | 不支持 |
| **实现复杂度** | ✅ 简单，复用现有中间件 | 需要额外协议处理 |
| **现有代码** | ✅ 已有成熟的 `/routes/sse.js` | 需要新建WebSocket服务 |

#### SSE 事件格式

| 事件名 | 描述 | 数据格式 |
|--------|------|---------|  
| `file:added` | 文件添加 | `{ userId, fileId, path, metadata }` |
| `file:modified` | 文件修改 | `{ userId, fileId, path, changes }` |
| `file:deleted` | 文件删除 | `{ userId, fileId, path }` |
| `folder:created` | 文件夹创建 | `{ userId, path }` |
| `folder:deleted` | 文件夹删除 | `{ userId, path }` |
| `batch:completed` | 批量操作完成 | `{ userId, operation, count }` |

## 七、性能优化策略

### 7.1 缓存策略
- **内存缓存**: 热点文件元数据
- **Redis缓存**: 文件索引和搜索结果
- **CDN**: 静态资源分发

### 7.2 并发控制
- 文件上传并发限制: 5
- 缩略图生成并发: 3
- 事件处理并发: 10

### 7.3 监控优化
- 忽略临时文件和系统文件
- 限制监控深度
- 批量处理事件

## 八、数据迁移方案

### 8.1 迁移步骤
```javascript
// migration.js
async function migrateAssets() {
  // 1. 读取旧的元数据
  const oldMetadata = await readOldMetadata()
  
  // 2. 创建新的目录结构
  for (const user of oldMetadata.users) {
    await createUserDirectories(user.id)
  }
  
  // 3. 移动文件到新位置
  for (const asset of oldMetadata.assets) {
    const oldPath = getOldPath(asset)
    const newPath = getNewPath(asset)
    await fs.rename(oldPath, newPath)
    
    // 4. 生成缩略图
    if (isImage(asset.type)) {
      await MediaProcessor.generateThumbnail(newPath)
    }
  }
  
  // 5. 建立新索引
  await IndexService.rebuildIndex()
}
```

## 九、测试计划

### 9.1 单元测试
- ChokidarWatcher 事件监听
- FileSystemManager CRUD操作
- EventProcessor 批处理逻辑
- MediaProcessor 图片处理

### 9.2 集成测试
- 文件上传流程
- 批量操作
- 并发处理
- 错误恢复

### 9.3 性能测试
- 1000个文件同时上传
- 10000个文件的目录监控
- 事件风暴处理

## 十、部署和监控

### 10.1 部署检查清单
- [ ] 文件系统权限配置
- [ ] Chokidar 依赖安装
- [ ] 存储空间检查
- [ ] 缩略图目录创建
- [ ] 索引数据库初始化

### 10.2 监控指标
- 文件操作延迟 < 100ms
- 事件处理延迟 < 500ms
- 缩略图生成时间 < 2s
- 内存使用 < 512MB
- CPU 使用率 < 50%

## 十一、安全考虑

### 11.1 权限控制
- 用户只能访问自己的文件
- 文件路径验证防止目录遍历
- 上传文件类型限制

### 11.2 资源限制
- 单文件大小限制: 100MB
- 用户存储配额: 10GB
- 请求频率限制

## 十二、前端改造方案

### 12.1 前端文件改造清单

#### 需要修改的文件

| 序号 | 文件路径 | 功能描述 | 改造内容 |
|------|---------|---------|---------|
| 1 | `src/api/assets.js` | API接口层 | 更新为v2 API，适配新的数据结构 |
| 2 | `src/components/assets/AssetManagerSimple.vue` | 素材管理面板 | 改为实际文件夹树形展示，支持拖拽 |
| 3 | `src/components/assets/AssetReferencePicker.vue` | @引用选择器 | 支持实际路径选择，优化搜索 |
| 4 | `src/utils/referenceParser.js` | 引用解析器 | 更新解析逻辑，支持文件路径 |
| 5 | `src/composables/useAssets.js` | 素材状态管理 | 使用Pinia重构，支持实时更新 |
| 6 | `src/composables/useAssetCache.js` | 缓存管理 | 优化缓存策略，支持增量更新 |

#### 需要新建的文件

| 序号 | 文件路径 | 功能描述 |
|------|---------|---------|
| 1 | `src/stores/assetStore.js` | Pinia状态管理 |
| 2 | `src/components/assets/FileExplorer.vue` | 文件资源管理器组件 |
| 3 | `src/components/assets/FileUploader.vue` | 拖拽上传组件 |
| 4 | `src/components/assets/FilePreview.vue` | 文件预览组件 |
| 5 | `src/services/assetWebSocket.js` | WebSocket服务 |
| 6 | `src/utils/fileHelper.js` | 文件操作工具函数 |

### 12.2 核心功能改造

#### 1. API接口层改造 (`src/api/assets.js`)
```javascript
// 新版API接口
export const assetsApiV2 = {
  // 获取目录树
  getTree(userId) {
    return request.get(`/api/v2/assets/tree`, { params: { userId } })
  },
  
  // 批量上传（支持拖拽）
  uploadBatch(files, targetPath) {
    const formData = new FormData()
    files.forEach(file => formData.append('files', file))
    formData.append('path', targetPath)
    return request.post('/api/v2/assets/upload', formData)
  },
  
  // 监听文件变化（WebSocket）
  watchChanges(userId, callback) {
    return ws.subscribe(`/assets/${userId}/changes`, callback)
  }
}
```

#### 2. 素材管理面板改造 (`AssetManagerSimple.vue`)
```vue
<!-- 新版文件管理器界面 -->
<template>
  <div class="asset-manager-v2">
    <!-- 工具栏 -->
    <div class="toolbar">
      <button @click="createFolder">新建文件夹</button>
      <button @click="uploadFiles">上传文件</button>
      <input v-model="searchQuery" placeholder="搜索文件..." />
    </div>
    
    <!-- 分栏布局 -->
    <div class="split-view">
      <!-- 左侧：文件树 -->
      <div class="tree-panel">
        <FileTree 
          :data="treeData"
          @select="onFolderSelect"
          @drop="onFileDrop"
        />
      </div>
      
      <!-- 右侧：文件列表 -->
      <div class="file-panel">
        <FileGrid 
          :files="currentFiles"
          :view-mode="viewMode"
          @open="onFileOpen"
          @delete="onFileDelete"
        />
      </div>
    </div>
    
    <!-- 状态栏 -->
    <StatusBar :stats="fileStats" />
  </div>
</template>
```

#### 3. @引用功能改造 (`referenceParser.js`)
```javascript
// 新的引用格式支持
const PATTERNS = {
  // 文件路径格式：@/path/to/file.ext
  PATH: /@(\/[^\s]+\.[a-zA-Z0-9]+)/g,
  
  // 简化格式：@filename.ext  
  FILE: /@([^\s\/]+\.[a-zA-Z0-9]+)/g,
  
  // 文件夹格式：@folder/
  FOLDER: /@([^\s]+\/)/g
}

// 解析引用为实际路径
export function parseReference(text, currentPath) {
  const matches = []
  
  // 解析不同格式
  for (const [type, pattern] of Object.entries(PATTERNS)) {
    let match
    while ((match = pattern.exec(text)) !== null) {
      matches.push({
        type,
        value: match[1],
        fullPath: resolvePath(match[1], currentPath),
        start: match.index,
        end: match.index + match[0].length
      })
    }
  }
  
  return matches
}
```

#### 4. WebSocket实时更新 (`assetWebSocket.js`)
```javascript
class AssetWebSocket {
  constructor() {
    this.ws = null
    this.listeners = new Map()
  }
  
  connect(userId) {
    this.ws = new WebSocket(`ws://localhost:3000/ws/assets/${userId}`)
    
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      this.handleEvent(data)
    }
  }
  
  handleEvent(data) {
    switch(data.type) {
      case 'file:added':
        this.updateFileTree(data.path, 'add')
        break
      case 'file:deleted':
        this.updateFileTree(data.path, 'delete')
        break
      case 'file:modified':
        this.refreshFile(data.path)
        break
    }
  }
}
```

### 12.3 UI/UX改进

#### 1. 拖拽上传支持
```vue
<template>
  <div 
    class="drop-zone"
    @drop="handleDrop"
    @dragover.prevent
    @dragenter.prevent
    :class="{ active: isDragging }"
  >
    <div v-if="isDragging" class="drop-overlay">
      <Icon name="upload" />
      <span>拖放文件到此处上传</span>
    </div>
    <slot />
  </div>
</template>
```

#### 2. 文件预览增强
- 图片：缩略图 + 大图预览
- 文档：前几行预览
- 视频：封面 + 时长
- 代码：语法高亮

#### 3. 快捷操作
- `Ctrl+V`: 粘贴上传
- `Delete`: 删除选中
- `F2`: 重命名
- `Ctrl+A`: 全选

### 12.4 状态管理 (Pinia Store)
```javascript
// stores/assetStore.js
export const useAssetStore = defineStore('assets', {
  state: () => ({
    tree: [],
    currentPath: '/',
    selectedFiles: [],
    uploadQueue: [],
    searchResults: []
  }),
  
  actions: {
    async loadTree() {
      const { data } = await assetsApiV2.getTree()
      this.tree = data
    },
    
    async uploadFiles(files, path) {
      // 添加到上传队列
      this.uploadQueue.push(...files)
      
      // 批量上传
      const result = await assetsApiV2.uploadBatch(files, path)
      
      // 更新树形结构
      this.refreshPath(path)
    }
  }
})
```

### 12.5 兼容性处理

#### 1. 数据迁移提示
```vue
<template>
  <div v-if="needMigration" class="migration-banner">
    <Icon name="info" />
    <span>检测到旧版数据，需要迁移到新系统</span>
    <button @click="startMigration">开始迁移</button>
  </div>
</template>
```

#### 2. 渐进式切换
```javascript
// 功能开关
const features = {
  useNewAssetSystem: import.meta.env.VITE_NEW_ASSET_SYSTEM === 'true',
  enableWebSocket: import.meta.env.VITE_ENABLE_WS === 'true'
}

// 根据开关选择API
const api = features.useNewAssetSystem ? assetsApiV2 : assetsApi
```

## 十三、实施计划

### 13.1 第一阶段：后端核心
- Chokidar集成和文件监控
- FileSystemManager实现  
- API开发和测试
- SSE事件推送实现
- 性能优化

### 13.2 第二阶段：前端改造
- API对接和状态管理
- 文件管理器UI
- @引用功能升级
- SSE事件监听集成
- 拖拽上传实现

### 13.3 第三阶段：集成测试
- 功能测试
- 性能测试
- 用户测试和修复
- 边界情况处理

### 13.4 第四阶段：部署上线
- 数据迁移脚本
- 生产环境配置
- 监控告警设置
- 正式部署

## 十四、风险控制

### 14.1 技术风险
- **文件系统权限**：启动时检查，提供修复指导
- **大文件处理**：分片上传，流式处理
- **并发冲突**：乐观锁 + 冲突检测

### 14.2 用户体验风险
- **学习成本**：提供新手引导
- **数据丢失**：自动备份机制
- **性能问题**：渐进式加载

## 十五、后续优化

### 15.1 第一优先级
- 搜索功能增强
- 批量操作优化
- 快捷键支持
- 权限控制完善

### 15.2 第二优先级
- AI智能分类
- 版本控制
- 协作功能
- 文件去重

### 15.3 第三优先级
- 云存储集成
- 移动端支持
- 插件系统
- 多语言支持