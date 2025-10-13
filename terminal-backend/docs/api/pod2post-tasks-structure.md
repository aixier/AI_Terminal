# Pod2Post Tasks 目录生成逻辑分析

## 📋 目录结构

```
/mnt/d/work/AI_Terminal/terminal-backend/data/users/default/workspace/templates/pod2post/
├── CDN/                    # 公共CDN资源（所有任务共享）
├── photos/                 # 公共照片（所有任务共享）
├── resources/              # 公共资源（所有任务共享）
├── tasks/                  # 任务隔离目录（每个任务独立）
│   ├── pod2post_1757592663331_lsymdox/   # 任务1
│   │   ├── CDN/           # 任务特定CDN资源
│   │   ├── photos/        # 任务特定照片
│   │   └── resources/     # 任务特定资源
│   └── pod2post_1758854411575_test/      # 任务2
│       ├── CDN/
│       ├── photos/
│       └── resources/
├── 播客小红书图文卡片需求文档.md
├── 内容页模板规范.md
└── 新闻感封面.md
```

### **Docker 容器内路径映射**

```
宿主机路径:
/mnt/d/work/AI_Terminal/terminal-backend/data/users/default/workspace/templates/pod2post/tasks/

↓ Docker 挂载映射 ↓

容器内路径:
/app/data/users/default/workspace/templates/pod2post/tasks/
```

**容器信息**:
- Container ID: `409b69ad53ff`
- Name: `excel-translation`
- Status: `Exited (255)` ⚠️ (已停止)

---

## 1. Tasks 目录生成逻辑

### **触发时机**

Tasks 目录在**用户上传文件时自动创建**，不是在任务创建时创建。

### **生成流程**

```
用户提交 Pod2Post 任务
    ↓
生成 taskId (如 pod2post_1757592663331_lsymdox)
    ↓
用户通过前端上传资源文件（CDN/photos/resources）
    ↓
后端接收上传请求，包含 taskId 参数
    ↓
getUserUploadPath() 计算目标路径
    ↓
创建 tasks/{taskId}/{path} 目录
    ↓
保存上传的文件
```

---

## 2. 关键代码分析

### **2.1 路径计算函数** (pod2postUpload.js:55-72)

```javascript
async function getUserUploadPath(username, uploadPath, taskId = null) {
  const basePath = userService.getUserTemplatePath(username, 'pod2post')
  // basePath = /app/data/users/default/workspace/templates/pod2post

  // 安全处理路径，防止路径遍历
  const sanitizedPath = uploadPath
    .split('/')
    .filter(segment => segment && segment !== '..' && segment !== '.' && !segment.startsWith('~'))
    .join('/')

  // 如果有taskId，使用任务特定目录
  if (taskId && taskId.startsWith('pod2post_')) {
    return path.join(basePath, 'tasks', taskId, sanitizedPath)
    // 返回: /app/data/users/default/workspace/templates/pod2post/tasks/pod2post_xxx/CDN
  }

  // 默认路径（无taskId）
  return path.join(basePath, sanitizedPath)
  // 返回: /app/data/users/default/workspace/templates/pod2post/CDN
}
```

**关键点**:
- ✅ 有 taskId → 使用 `tasks/{taskId}/{path}`
- ❌ 无 taskId → 使用 `{path}` (公共目录)

---

### **2.2 目录自动创建** (pod2postUpload.js:164)

```javascript
// 确保目录存在
await fs.mkdir(targetPath, { recursive: true })
```

**说明**:
- `recursive: true` → 自动创建多级目录
- 如果 `tasks/pod2post_xxx/` 不存在，会自动创建

---

### **2.3 文件保存** (pod2postUpload.js:172)

```javascript
const filePath = path.join(targetPath, finalFilename)
await fs.writeFile(filePath, req.file.buffer)
```

**完整路径示例**:
```
/app/data/users/default/workspace/templates/pod2post/tasks/pod2post_1757592663331_lsymdox/photos/封面顶部.png
```

---

## 3. 上传接口详解

### **3.1 主上传接口**

```
POST /api/generate/pod2post/upload?path={path}&taskId={taskId}
```

**Query 参数**:
| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `path` | String | ✅ | 目标目录 (CDN/photos/resources) |
| `taskId` | String | ❌ | 任务ID (格式: pod2post_{timestamp}_{random}) |

**Body 参数** (multipart/form-data):
| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `file` | File | ✅ | 上传的文件（单个） |
| `filename` | String | ❌ | 自定义文件名 |
| `clearBase64` | Boolean | ❌ | 是否清理Base64 HTML（默认true） |

---

### **3.2 通用上传接口**

```
POST /api/generate/pod2post/upload?path={path}&taskId={taskId}
```

**特点**:
- 支持上传到任意子目录（如 `CDN/2024/images`）
- 自动创建多级目录
- 自动处理中文文件名编码

---

### **3.3 专用上传接口**

| 接口 | 路径 | 说明 |
|------|------|------|
| `/api/generate/pod2post/cdn` | CDN 上传 | 仅接受图片文件 |
| `/api/generate/pod2post/pic` | photos 上传 | 仅接受图片文件 |
| `/api/generate/pod2post/resources` | resources 上传 | 接受文档类型 |

**这些专用接口内部都调用相同的路径计算逻辑**:
```javascript
// pod2postCdn.js:16
return path.join(basePath, 'tasks', taskId, 'CDN')

// pod2postPic.js:16
return path.join(basePath, 'tasks', taskId, 'photos')

// pod2postResources.js:16
return path.join(basePath, 'tasks', taskId, 'resources')
```

---

## 4. 任务目录的使用逻辑

### **4.1 Prompt 处理时的路径替换** (promptProcessor.js:45)

```javascript
// 如果有taskId且是资源目录，直接使用任务特定路径
if (taskId && ['CDN', 'photos', 'resources'].includes(fileName)) {
  const taskPath = path.join(userTemplateDir, 'tasks', taskId, fileName)

  // CDN特殊处理：如果任务特定的CDN目录不存在，使用公共模板CDN
  if (fileName === 'CDN') {
    const taskCdnExists = await this.pathExists(taskPath)
    if (!taskCdnExists) {
      // 回退到公共CDN
      const publicCdnPath = '/app/data/public_template/pod2post/CDN'
      console.log(`Task CDN not found, using public CDN: ${publicCdnPath}`)
    }
  }
}
```

**回退机制**:
```
优先级1: tasks/{taskId}/CDN/  (任务特定)
    ↓ 不存在时回退
优先级2: /app/data/public_template/pod2post/CDN/  (公共模板)
```

---

### **4.2 Base64 转换时的资源查找** (pod2postAsync.js:343-354)

```javascript
// 使用任务特定路径进行资源解析
const taskSpecificPath = taskId ? path.join(templatePath, 'tasks', taskId) : templatePath

// CDN特殊处理：检查任务CDN目录
const taskCdnPath = path.join(taskSpecificPath, 'CDN')
const publicCdnPath = '/app/data/public_template/pod2post/CDN'

try {
  await fs.access(taskCdnPath)
  console.log('Looking for CDN resources in:', taskCdnPath)
} catch {
  console.log('Task CDN not found, will fallback to public CDN:', publicCdnPath)
}

// 使用任务特定路径转换Base64
await htmlProcessor.convertHtmlToBase64(htmlFilePath, taskSpecificPath)
```

**资源查找顺序**:
1. `tasks/{taskId}/CDN/封面背景.jpeg`
2. `/app/data/public_template/pod2post/CDN/封面背景.jpeg`

---

### **4.3 任务完成后清理** (pod2postAsync.js:759-815)

```javascript
async function cleanUserTemplateResources(username, taskId = null) {
  const templatePath = userService.getUserTemplatePath(username, 'pod2post')

  // 如果有taskId，清理任务特定目录
  if (taskId && taskId.startsWith('pod2post_')) {
    const taskPath = path.join(templatePath, 'tasks', taskId)

    // 删除整个任务目录及其内容
    await fs.rm(taskPath, { recursive: true, force: true })
    console.log(`Cleaned task directory: ${taskPath}`)

    return
  }

  // 默认清理逻辑（无taskId时）
  const dirsToClean = ['CDN', 'photos', 'resources']
  for (const dir of dirsToClean) {
    // 清理公共目录下的所有文件
  }
}
```

**清理时机**:
- 任务完成后（Phase 4）
- 删除整个 `tasks/{taskId}/` 目录
- 避免任务间资源冲突

---

## 5. 完整示例：任务 pod2post_1757592663331_lsymdox

### **5.1 目录结构**

```bash
$ tree pod2post_1757592663331_lsymdox/
pod2post_1757592663331_lsymdox/
└── photos/
    ├── 12351750995095_.pic_hd.jpg
    ├── 12361750995096_.pic_hd.jpg
    ├── 12381750995098_.pic_hd.jpg
    ├── 12391750995099_.pic_hd.jpg
    ├── 12401750995103_.pic_hd.jpg
    ├── 12411750995105_.pic_hd.jpg
    ├── 12421750995106_.pic_hd.jpg
    ├── 12431750995108_.pic_hd.jpg
    ├── 12441750995109_.pic_hd.jpg
    ├── 12451750995110_.pic.jpg
    ├── 封面底部.png
    └── 封面顶部.png
```

**说明**:
- ✅ 只有 `photos/` 目录（用户只上传了照片）
- ❌ 没有 `CDN/`、`resources/`（未上传，回退到公共目录）

---

### **5.2 生成流程**

#### **Step 1: 任务创建**
```javascript
// 生成 taskId
taskId = 'pod2post_1757592663331_lsymdox'

// 路径计算
templatePath = '/app/data/users/default/workspace/templates/pod2post'
taskSpecificPath = '/app/data/users/default/workspace/templates/pod2post/tasks/pod2post_1757592663331_lsymdox'
```

#### **Step 2: 用户上传 photos**
```http
POST /api/generate/pod2post/upload?path=photos&taskId=pod2post_1757592663331_lsymdox
Content-Type: multipart/form-data

file: 封面顶部.png
file: 封面底部.png
file: 12351750995095_.pic_hd.jpg
... (共12张图片)
```

#### **Step 3: 后端处理**
```javascript
// 1. 计算目标路径
targetPath = getUserUploadPath('default', 'photos', 'pod2post_1757592663331_lsymdox')
// → /app/data/users/default/workspace/templates/pod2post/tasks/pod2post_1757592663331_lsymdox/photos

// 2. 创建目录（自动创建 tasks/ 和任务子目录）
await fs.mkdir(targetPath, { recursive: true })

// 3. 保存文件
await fs.writeFile('/app/data/.../tasks/pod2post_1757592663331_lsymdox/photos/封面顶部.png', buffer)
```

#### **Step 4: AI 生成时资源查找**
```javascript
// Prompt 处理（promptProcessor.js）
processPrompt(prompt, templatePath, userCardPath, 'pod2post_1757592663331_lsymdox')

// 路径替换
'../photos/封面顶部.png'
  → 查找: tasks/pod2post_1757592663331_lsymdox/photos/封面顶部.png ✅
  → 替换为: 相对路径或绝对路径
```

#### **Step 5: Base64 转换时资源查找**
```javascript
// Base64 转换（pod2postAsync.js:343）
taskSpecificPath = '/app/data/users/default/workspace/templates/pod2post/tasks/pod2post_1757592663331_lsymdox'

// 资源查找
convertHtmlToBase64(htmlFilePath, taskSpecificPath)
  → 查找: tasks/pod2post_1757592663331_lsymdox/photos/封面顶部.png ✅
  → 查找: tasks/pod2post_1757592663331_lsymdox/CDN/封面背景.jpeg ❌
  → 回退: /app/data/public_template/pod2post/CDN/封面背景.jpeg ✅
```

#### **Step 6: 任务完成后清理**
```javascript
// 清理任务目录（pod2postAsync.js:765-773）
cleanUserTemplateResources('default', 'pod2post_1757592663331_lsymdox')

// 删除整个任务目录
await fs.rm('/app/data/users/default/workspace/templates/pod2post/tasks/pod2post_1757592663331_lsymdox', {
  recursive: true,
  force: true
})
```

---

## 3. 为什么需要 Tasks 隔离？

### **问题场景**

```
❌ 没有 tasks 隔离时:

任务1（9:00）: 上传 封面顶部.png (图片A)
任务2（9:05）: 上传 封面顶部.png (图片B) → 覆盖了任务1的文件！
任务1 生成完成（9:10）: 使用的是图片B ❌ 错误！
```

### **解决方案**

```
✅ 有 tasks 隔离时:

任务1: templates/pod2post/tasks/pod2post_xxx1/photos/封面顶部.png (图片A)
任务2: templates/pod2post/tasks/pod2post_xxx2/photos/封面顶部.png (图片B)

→ 互不干扰，并发安全 ✅
```

### **任务隔离的优势**

1. ✅ **并发安全**: 多个任务可同时运行，资源不冲突
2. ✅ **资源隔离**: 每个任务使用自己的照片、CDN资源
3. ✅ **自动清理**: 任务完成后删除临时目录，节省空间
4. ✅ **回退机制**: 如果任务目录没有某资源，自动使用公共资源

---

## 4. 资源查找优先级

### **完整查找链**

```
查找 CDN/封面背景.jpeg:

优先级1: tasks/{taskId}/CDN/封面背景.jpeg         (任务特定，用户上传)
    ↓ 不存在
优先级2: CDN/封面背景.jpeg                        (用户公共资源)
    ↓ 不存在
优先级3: /app/data/public_template/pod2post/CDN/封面背景.jpeg  (系统模板)
    ↓ 不存在
优先级4: 报错或使用占位符
```

**代码实现位置**:
- Prompt 处理: `promptProcessor.js:42-60`
- Base64 转换: `pod2postAsync.js:343-354`
- OSS URL 转换: `pod2postAsync.js:397-402`

---

## 5. Docker 容器路径映射

### **容器内路径结构**

```
容器 409b69ad53ff (excel-translation):

/app/
├── data/
│   ├── users/
│   │   └── default/
│   │       └── workspace/
│   │           └── templates/
│   │               └── pod2post/
│   │                   └── tasks/               ← 任务隔离目录
│   │                       ├── pod2post_1757592663331_lsymdox/
│   │                       └── pod2post_1758854411575_test/
│   └── public_template/
│       └── pod2post/
│           ├── CDN/                             ← 公共CDN资源
│           ├── photos/                          ← 公共照片
│           └── resources/                       ← 公共资源
└── (应用代码)
```

### **挂载映射**

```bash
# docker run -v 宿主机路径:容器路径

宿主机:
/mnt/d/work/AI_Terminal/terminal-backend/data

Docker 容器:
/app/data
```

**验证容器路径** (容器已停止，需启动后执行):
```bash
docker start 409b69ad53ff
docker exec 409b69ad53ff ls -lah /app/data/users/default/workspace/templates/pod2post/tasks/
```

---

## 6. 完整上传示例

### **场景**: 用户为任务 `pod2post_1757592663331_lsymdox` 上传照片

#### **前端请求**
```javascript
// 构建 FormData
const formData = new FormData()
formData.append('file', photoFile1, '封面顶部.png')

// 发送请求
POST /api/generate/pod2post/upload?path=photos&taskId=pod2post_1757592663331_lsymdox
Content-Type: multipart/form-data

Body: formData
```

#### **后端处理**
```javascript
// 1. 计算路径
getUserUploadPath('default', 'photos', 'pod2post_1757592663331_lsymdox')
// → /app/data/users/default/workspace/templates/pod2post/tasks/pod2post_1757592663331_lsymdox/photos

// 2. 创建目录
await fs.mkdir(targetPath, { recursive: true })
// 创建: /app/data/users/default/workspace/templates/pod2post/tasks/pod2post_1757592663331_lsymdox/photos/

// 3. 保存文件
await fs.writeFile(
  '/app/data/users/default/workspace/templates/pod2post/tasks/pod2post_1757592663331_lsymdox/photos/封面顶部.png',
  buffer
)

// 4. 返回响应
{
  "code": 200,
  "success": true,
  "message": "成功上传 1 个文件到照片目录",
  "data": {
    "uploadedFiles": [{
      "originalName": "封面顶部.png",
      "filename": "封面顶部.png",
      "size": 102400,
      "path": "/app/data/.../tasks/pod2post_1757592663331_lsymdox/photos/封面顶部.png",
      "url": "/data/users/default/workspace/templates/pod2post/tasks/pod2post_1757592663331_lsymdox/photos/封面顶部.png"
    }],
    "picPath": "/app/data/.../tasks/pod2post_1757592663331_lsymdox/photos"
  }
}
```

---

## 7. 代码位置索引

| 功能 | 文件 | 关键行号 |
|------|------|---------|
| **路径计算** | `pod2postUpload.js` | 55-72 |
| **目录创建** | `pod2postUpload.js` | 164 |
| **文件保存** | `pod2postUpload.js` | 172 |
| **Prompt 路径处理** | `promptProcessor.js` | 42-60 |
| **Base64 资源查找** | `pod2postAsync.js` | 343-354 |
| **任务清理** | `pod2postAsync.js` | 759-815 |
| **CDN 上传** | `pod2postCdn.js` | 16 |
| **Photos 上传** | `pod2postPic.js` | 16 |
| **Resources 上传** | `pod2postResources.js` | 16 |

---

## 8. 前端上传调用

### **前端使用哪个接口？**

前端主要使用 **通用素材上传接口**，而不是 Pod2Post 专用接口：

```javascript
// terminal-ui/src/api/assets.js:93-109
uploadAssets(formData) {
  formData.append('userId', getUserId())

  return request.post('/assets/upload', formData, {  // ← 通用接口
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
}
```

**注意**:
- 前端使用的是 `/api/assets/upload` (通用素材管理)
- 而 Pod2Post 专用接口是 `/api/generate/pod2post/upload`
- 两个接口功能相似，但路径和参数略有不同

---

## 9. 总结

### **Tasks 目录生成逻辑**

| 步骤 | 说明 |
|------|------|
| **1. 任务创建** | 生成 taskId，但不创建 tasks 目录 |
| **2. 用户上传资源** | 前端调用上传接口，传递 taskId 参数 |
| **3. 后端计算路径** | `getUserUploadPath()` 拼接 `tasks/{taskId}/{path}` |
| **4. 自动创建目录** | `fs.mkdir(recursive: true)` 创建多级目录 |
| **5. 保存文件** | 文件保存到任务特定目录 |
| **6. AI 生成使用** | Prompt 处理和 Base64 转换时使用任务资源 |
| **7. 任务完成清理** | 删除整个 `tasks/{taskId}/` 目录 |

### **Docker 容器路径**

**容器**: `409b69ad53ff` (excel-translation) - 当前已停止
**容器内路径**: `/app/data/users/default/workspace/templates/pod2post/tasks/`
**宿主机路径**: `/mnt/d/work/AI_Terminal/terminal-backend/data/users/default/workspace/templates/pod2post/tasks/`

### **关键特性**

1. ✅ **按需创建**: 只在上传文件时创建目录
2. ✅ **任务隔离**: 每个任务有独立的资源目录
3. ✅ **资源回退**: 任务资源不存在时使用公共资源
4. ✅ **自动清理**: 任务完成后删除临时资源
5. ✅ **并发安全**: 支持多任务同时运行

---

**文档版本**: v1.0
**创建日期**: 2025-10-11
**分析任务**: pod2post_1757592663331_lsymdox
**容器状态**: Exited (需启动后访问)
