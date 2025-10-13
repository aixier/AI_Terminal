# jsonRepair 校验与修复逻辑详解

## 📋 目录
1. [核心校验流程](#核心校验流程)
2. [可修复的错误类型](#可修复的错误类型)
3. [字段验证机制](#字段验证机制)
4. [错误分类系统](#错误分类系统)
5. [修复案例示例](#修复案例示例)

---

## 核心校验流程

### 1. **健康检查 (checkJsonHealth)**
**位置**: `jsonRepair.js:172-205`

```javascript
checkJsonHealth(jsonContent, requiredFields = [])
```

**检查步骤**:
1. ✅ **语法检查**: 使用 `JSON.parse()` 尝试解析
2. ✅ **字段检查**: 验证必需字段是否存在（支持嵌套字段如 `social_content.post_title`）
3. ✅ **返回结果**:
   - `needsRepair: false` - JSON格式正确
   - `needsRepair: true` - 需要修复

**返回值**:
```javascript
{
  needsRepair: boolean,
  valid: boolean,
  data: Object | null,
  missingFields: Array,
  message: string,
  error?: string  // 仅在格式错误时存在
}
```

---

### 2. **修复流程 (repairJsonContent)**
**位置**: `jsonRepair.js:213-377`

```javascript
repairJsonContent(jsonContent, options = {
  timeout: 120000,           // API超时时间（2分钟）
  templateName: 'unknown',   // 模板名称（用于日志）
  description: 'JSON文件',   // 文件描述
  requiredFields: [],        // 必需字段列表
  retries: 2,                // 重试次数
  forceRepair: false         // 强制修复（跳过健康检查）
})
```

**完整流程**:

```
Step 1: 健康检查
  ├─ JSON.parse() 成功 ✅
  │   └─> 检查 requiredFields
  │       ├─ 字段完整 ✅ → 返回 { success: true, skipped: true }
  │       └─ 缺少字段 ⚠️ → 返回 { success: true, warning: "缺少字段: xxx" }
  │
  └─ JSON.parse() 失败 ❌
      └─> 进入修复流程

Step 2: 构建修复 Prompt (buildFixPrompt)
  └─> Prompt 内容:
      """
      请检查并修复以下JSON的语法错误。
      任务要求：
      1. 识别并修复所有JSON语法错误（如缺少逗号、括号不匹配、引号问题等）
      2. 保持原始数据内容和结构完全不变，只修复格式问题
      3. 确保修复后的JSON可以被JSON.parse()正确解析
      4. 直接返回修复后的完整JSON内容，不要添加任何解释文字或markdown格式

      需要修复的JSON内容：
      {原始JSON}
      """

Step 3: 调用 Claude API
  ├─ URL: http://8.130.86.152:80/api/generate/cc
  ├─ Method: POST
  ├─ Body: { prompt, timeout }
  └─> 获取修复后的JSON

Step 4: 提取修复结果 (extractJsonFromResponse)
  ├─ 尝试从 markdown 代码块提取: ```json ... ```
  ├─ 尝试提取 { ... } 对象
  └─ 尝试提取 [ ... ] 数组

Step 5: 验证修复结果 (validateJson)
  ├─ JSON.parse() 成功 ✅
  │   └─> 检查 requiredFields
  │       ├─ 字段完整 ✅ → 返回修复成功
  │       └─ 缺少字段 ⚠️ → 返回修复成功 + 警告
  │
  └─ JSON.parse() 失败 ❌
      └─> 重试（最多 2 次，指数退避延迟）

Step 6: 最终结果
  ├─ 修复成功 ✅ → { success: true, data, fixedContent, attempts }
  └─ 修复失败 ❌ → { success: false, error, errorType, attempts }
```

---

## 可修复的错误类型

### ✅ **语法错误 (自动修复)**

| 错误类型 | 示例 | 修复结果 |
|---------|------|---------|
| **缺少逗号** | `{"a": 1 "b": 2}` | `{"a": 1, "b": 2}` |
| **多余逗号** | `{"a": 1,}` | `{"a": 1}` |
| **括号不匹配** | `{"a": {"b": 1}` | `{"a": {"b": 1}}` |
| **引号错误** | `{'a': "1"}` | `{"a": "1"}` |
| **中文标点** | `{"a"："1"，"b"："2"}` | `{"a": "1", "b": "2"}` |
| **未转义双引号** | `{"text": "这个"关键"内容"}` | `{"text": "这个\"关键\"内容"}` |
| **换行符问题** | `{"a": "line1\nline2"}` | `{"a": "line1\\nline2"}` |
| **转义字符** | `{"path": "C:\test"}` | `{"path": "C:\\test"}` |
| **数字格式** | `{"count": 01}` | `{"count": 1}` |
| **注释干扰** | `{"a": 1 // comment}` | `{"a": 1}` |

**修复提示内容** (buildFixPrompt:78-88):
```
识别并修复所有JSON语法错误：
- 缺少逗号
- 括号不匹配
- 引号问题
```

---

### ⚠️ **字段缺失 (警告但不阻塞)**

**场景**: JSON 语法正确，但缺少必需字段

```javascript
// 输入配置
requiredFields: ['social_content.post_title', 'social_content.highlights']

// 实际JSON
{
  "social_content": {
    "post_content": "..."
    // ❌ 缺少 post_title 和 highlights
  }
}

// 返回结果
{
  success: true,
  data: {...},
  warning: "缺少字段: social_content.post_title, social_content.highlights"
}
```

**Pod2Post 特殊处理**:
```javascript
// pod2postAsync.js:872
requiredFields: []  // ❌ 不验证字段，只检查语法
```

---

### ❌ **无法修复的错误**

| 错误类型 | 原因 | 处理方式 |
|---------|------|---------|
| **网络错误** | Claude API 无法访问 | 返回 `NETWORK_ERROR` |
| **超时错误** | 修复超过 120 秒 | 返回 `TIMEOUT_ERROR` |
| **空响应** | Claude 返回空内容 | 返回 `EMPTY_RESPONSE_ERROR` |
| **API失败** | HTTP 状态码非 200 | 返回 `API_ERROR` |
| **结构破坏** | JSON 结构完全错乱 | 返回 `JSON_SYNTAX_ERROR` |

---

## 字段验证机制

### **validateJson 函数** (jsonRepair.js:133-164)

**支持嵌套字段验证**:

```javascript
validateJson(jsonContent, [
  'social_content',                    // 检查顶层字段
  'social_content.post_title',         // 检查嵌套字段
  'social_content.highlights',         // 检查数组字段
  'social_content.hashtags'
])
```

**验证算法**:
```javascript
// 1. 分割字段路径
const keys = 'social_content.post_title'.split('.')
// => ['social_content', 'post_title']

// 2. 逐层检查
let current = parsed
for (const key of keys) {
  if (!current.hasOwnProperty(key)) {
    return true  // 缺失
  }
  current = current[key]
}
return false  // 存在
```

**返回结果**:
```javascript
{
  valid: true/false,           // 语法是否正确
  data: Object | null,         // 解析后的数据
  missingFields: Array,        // 缺失的字段列表
  warning: string | null       // 警告信息
}
```

---

## 错误分类系统

### **classifyError 函数** (jsonRepair.js:382-398)

**错误类型映射**:

```javascript
classifyError(error) {
  const msg = error.message.toLowerCase()

  if (msg.includes('connect') || msg.includes('econnrefused'))
    return 'NETWORK_ERROR'          // 网络连接失败

  if (msg.includes('timeout'))
    return 'TIMEOUT_ERROR'          // 请求超时

  if (msg.includes('http') && msg.includes('failed'))
    return 'API_ERROR'              // API调用失败

  if (msg.includes('json') && (msg.includes('parse') || msg.includes('syntax')))
    return 'JSON_SYNTAX_ERROR'      // JSON语法错误

  if (msg.includes('empty') || msg.includes('output'))
    return 'EMPTY_RESPONSE_ERROR'   // 响应为空

  return 'UNKNOWN_ERROR'            // 未知错误
}
```

**故障排查建议** (generateTroubleshootingTips:403-418):

| 错误类型 | 排查建议 |
|---------|---------|
| `NETWORK_ERROR` | 网络连接失败 → 检查API服务器状态 |
| `TIMEOUT_ERROR` | 请求超时 → 考虑增加timeout或分片处理 |
| `JSON_SYNTAX_ERROR` | JSON格式过于复杂 → 建议手动预处理 |
| `EMPTY_RESPONSE_ERROR` | Claude响应为空 → 检查prompt或添加上下文 |
| `UNKNOWN_ERROR` | 修复失败 → 检查输入格式或联系支持 |

---

## 修复案例示例

### **案例 1: 缺少逗号**
```javascript
// ❌ 输入
{
  "social_content": {
    "post_title": "标题"
    "post_content": "内容"  // 缺少逗号
  }
}

// ✅ 修复后
{
  "social_content": {
    "post_title": "标题",
    "post_content": "内容"
  }
}

// 返回结果
{
  success: true,
  data: {...},
  fixedContent: "...",
  originalError: "Unexpected string in JSON at position 58",
  attempts: 1
}
```

---

### **案例 2: 中文标点符号**
```javascript
// ❌ 输入
{
  "post_title": "斯坦福哈佛最抢手，产品经理百里挑一，年薪17万美元"
}

// ✅ 修复后
{
  "post_title": "斯坦福哈佛最抢手,产品经理百里挑一,年薪17万美元"
}

// 返回结果
{
  success: true,
  data: {...},
  fixedContent: "...",
  originalError: "Unexpected token ， in JSON at position 45",
  attempts: 1
}
```

---

### **案例 3: 括号不匹配**
```javascript
// ❌ 输入
{
  "highlights": [
    "第一条",
    "第二条"
  // 缺少 ]
}

// ✅ 修复后
{
  "highlights": [
    "第一条",
    "第二条"
  ]
}

// 返回结果
{
  success: true,
  data: {...},
  fixedContent: "...",
  originalError: "Unexpected end of JSON input",
  attempts: 1
}
```

---

### **案例 4: 字段缺失（仅警告）**
```javascript
// 输入配置
requiredFields: ['social_content.post_title', 'social_content.highlights']

// ✅ JSON语法正确
{
  "social_content": {
    "post_content": "内容"
    // 缺少 post_title 和 highlights
  }
}

// 返回结果（不会触发修复）
{
  success: true,
  data: {...},
  skipped: true,
  warning: "缺少字段: social_content.post_title, social_content.highlights"
}
```

---

### **案例 5: 未转义双引号（字符串值内的引号）**
```javascript
// ❌ 输入
{
  "post_content": "揭示这个"离CEO最近的职位"为何成为顶尖人才梦想"
}
// 错误: Expected ',' or '}' after property value

// ✅ 修复后
{
  "post_content": "揭示这个\"离CEO最近的职位\"为何成为顶尖人才梦想"
}

// 返回结果
{
  success: true,
  data: {...},
  fixedContent: "...",
  originalError: "Expected ',' or '}' after property value in JSON at position 357",
  attempts: 1
}
```

**错误特征**:
- JSON 字符串值中包含未转义的双引号 `"`
- Node.js 报错: `Expected ',' or '}' after property value`
- Python 报错: `Expecting ',' delimiter`

**修复规则**:
- 字符串内的双引号 `"` → 转义为 `\"`
- 保持内容完整，只添加转义符

**常见场景**:
- 引用标题: `"离CEO最近的职位"`
- 专有名词: `"独角兽"企业`
- 对话内容: `他说"你好"`

---

### **案例 6: Pod2Post content.json（无字段验证）**
```javascript
// pod2postAsync.js:869-875
const repairResult = await repairJsonContent(jsonContent, {
  templateName: 'pod2post-content',
  description: 'Pod2Post content JSON',
  requiredFields: [],  // ❌ 空数组 = 不验证字段
  timeout: 60000,
  retries: 1
})

// 只要 JSON.parse() 成功即可，不检查字段
{
  "random_field": "任意内容"  // ✅ 会通过验证
}
```

---

## 重试机制

**指数退避算法** (jsonRepair.js:352-356):

```javascript
// 第1次重试: 延迟 1000ms
// 第2次重试: 延迟 2000ms
// 第3次重试: 延迟 4000ms (最大5000ms)
const delay = Math.min(1000 * Math.pow(2, attempt), 5000)
```

**重试条件**:
- ✅ API 调用失败 → 重试
- ✅ 修复后仍有语法错误 → 重试
- ✅ Claude 返回空响应 → 重试
- ❌ 网络连接失败 → 重试（但可能继续失败）

---

## 配置参数总览

```javascript
new JsonRepair({
  apiBase: 'http://8.130.86.152:80',        // Claude API地址
  apiToken: 'default-secure-token-abc123',  // 认证Token
  timeout: 120000,                           // 默认超时2分钟
  maxRetries: 2                              // 最大重试2次
})

repairJsonContent(jsonContent, {
  timeout: 60000,              // 本次请求超时（覆盖默认值）
  templateName: 'pod2post',    // 模板名称（日志用）
  description: 'content.json', // 文件描述（日志用）
  requiredFields: [],          // 必需字段（空=不验证）
  retries: 1,                  // 重试次数（覆盖默认值）
  forceRepair: false,          // 强制修复（跳过健康检查）
  includeContext: false        // 在prompt中包含上下文信息
})
```

---

## 在 Pod2Post 中的应用

**调用位置**: `pod2postAsync.js:869-880`

```javascript
// 1. 检测到 content.json
const contentFiles = files.filter(f =>
  f.toLowerCase().endsWith('content.json')
)

// 2. 尝试解析
try {
  JSON.parse(jsonContent)
  console.log('JSON file is valid, no repair needed')
} catch (parseError) {
  // 3. 触发修复
  const repairResult = await repairJsonContent(jsonContent, {
    templateName: 'pod2post-content',
    requiredFields: [],  // ❌ 不验证字段
    timeout: 60000,
    retries: 1
  })

  // 4. 保存修复后的文件
  if (repairResult.success) {
    await fs.writeFile(jsonFilePath, JSON.stringify(repairResult.data, null, 2))
  }
}
```

**特点**:
- ✅ 只修复语法错误
- ❌ 不验证特定字段
- ✅ 修复失败也继续任务（不阻塞）
- ✅ 修复成功后覆盖原文件

---

## 总结

| 维度 | 详情 |
|------|------|
| **检测时机** | OSS上传前，文件生成检测阶段 |
| **校验方式** | `JSON.parse()` + 字段存在性检查 |
| **修复方式** | Claude API自动修复 |
| **可修复错误** | 逗号、括号、引号、中文标点等语法错误 |
| **字段验证** | 支持嵌套字段，但Pod2Post不启用 |
| **重试机制** | 最多3次，指数退避延迟 |
| **失败处理** | 返回错误类型和排查建议 |
| **对任务影响** | 修复失败不阻塞任务继续执行 |

---

## 🆕 案例 7: 实战 - Pod2Post 中文引号组合错误

### **真实场景**
AI 生成的 `content.json` 中同时包含**中文逗号**和**未转义双引号**：

```json
{
  "social_content": {
    "post_title": "斯坦福哈佛最抢手，产品经理百里挑一，年薪17万美元",
    "post_content": "揭示这个"离CEO最近的职位"为何成为顶尖人才梦想，硅谷产品经理靠影响力而非权威，7个工程师配1个产品经理"
  }
}
```

### **错误分析**
1. **中文逗号**: `最抢手，产品经理` (第3行)
2. **未转义双引号**: `这个"离CEO最近的职位"为何` (第4行)

### **JSON.parse() 错误**
```
Node.js: Expected ',' or '}' after property value in JSON at position 357
Python:  Expecting ',' delimiter: line 4 column 280
```

### **修复流程**
```javascript
// 1. 检测到错误
waitForRequiredFiles() 
  → JSON.parse(jsonContent) ❌
  → parseError: "Expected ',' or '}'"

// 2. 触发 AI 修复
repairJsonContent(jsonContent, {
  templateName: 'pod2post-content',
  requiredFields: [],
  timeout: 60000,
  retries: 1
})

// 3. Claude API 修复 Prompt
"""
请检查并修复以下JSON的语法错误。
任务要求：
1. 识别并修复所有JSON语法错误（如缺少逗号、括号不匹配、引号问题等）
2. 保持原始数据内容和结构完全不变，只修复格式问题
...
"""

// 4. 修复结果
{
  "social_content": {
    "post_title": "斯坦福哈佛最抢手,产品经理百里挑一,年薪17万美元",
    "post_content": "揭示这个\"离CEO最近的职位\"为何成为顶尖人才梦想,硅谷产品经理靠影响力而非权威,7个工程师配1个产品经理"
  }
}

// 5. 保存修复后的文件
await fs.writeFile(jsonFilePath, JSON.stringify(repairResult.data, null, 2))
```

### **修复变更对比**
| 位置 | 原始内容 | 修复后 | 变更说明 |
|------|---------|--------|---------|
| post_title | `最抢手，产品经理` | `最抢手,产品经理` | 中文逗号 → 英文逗号 |
| post_title | `挑一，年薪` | `挑一,年薪` | 中文逗号 → 英文逗号 |
| post_content | `这个"离CEO最近的职位"为何` | `这个\"离CEO最近的职位\"为何` | 添加转义符 |
| post_content | `梦想，硅谷` | `梦想,硅谷` | 中文逗号 → 英文逗号 |

### **关键点**
✅ **同时修复多种错误**: Claude API 能一次性识别并修复所有语法问题  
✅ **保持内容完整**: 只修改标点符号和转义字符，不改变文本内容  
✅ **自动保存**: 修复成功后自动覆盖原文件  
✅ **不阻塞任务**: 即使修复失败，OSS上传仍会继续

---

## 📌 最佳实践建议

### **1. AI 生成时的预防**
在 prompt 中明确要求：
```
请确保生成的 JSON 符合标准格式：
1. 使用英文逗号 (,) 而非中文逗号 (，)
2. 字符串内的双引号需要转义 (\" 而非 ")
3. 所有键名和字符串值使用双引号 (") 而非单引号 (')
```

### **2. 修复配置优化**
```javascript
// 关键配置
repairJsonContent(jsonContent, {
  requiredFields: [],      // Pod2Post 不验证字段
  timeout: 60000,          // 给足够的修复时间
  retries: 2,              // 增加重试次数（复杂错误可能需要多次）
  forceRepair: false       // 不强制修复格式正确的JSON
})
```

### **3. 错误监控**
建议记录以下指标：
- 修复成功率 (repairResult.success)
- 修复尝试次数 (repairResult.attempts)
- 常见错误类型 (repairResult.errorType)
- 修复耗时 (repairResult.executionTime)

### **4. 降级策略**
```javascript
if (!repairResult.success) {
  // 策略1: 记录错误但继续任务
  console.error('JSON repair failed, continuing with broken JSON')
  
  // 策略2: 使用默认模板
  const defaultContent = {
    social_content: {
      post_title: "播客内容",
      post_content: "内容生成中...",
      highlights: [],
      hashtags: []
    }
  }
}
```

---

## 🔗 相关代码位置

| 功能 | 文件 | 行号 |
|------|------|------|
| **JSON 健康检查** | `jsonRepair.js` | 172-205 |
| **修复流程** | `jsonRepair.js` | 213-377 |
| **构建修复 Prompt** | `jsonRepair.js` | 56-89 |
| **提取修复结果** | `jsonRepair.js` | 96-125 |
| **验证修复结果** | `jsonRepair.js` | 133-164 |
| **错误分类** | `jsonRepair.js` | 382-398 |
| **Pod2Post 调用** | `pod2postAsync.js` | 869-893 |
| **文件检测等待** | `pod2postAsync.js` | 824-978 |

---

## 📚 完整测试用例

### **测试 1: 中文标点**
```bash
echo '{"a":"1"，"b"："2"}' | python3 -m json.tool
# 错误: Expecting ',' delimiter
```

### **测试 2: 未转义双引号**
```bash
echo '{"text":"这个"关键"词"}' | python3 -m json.tool
# 错误: Expecting ',' delimiter
```

### **测试 3: 组合错误**
```bash
echo '{"title":"最抢手，产品"离CEO最近""}' | python3 -m json.tool
# 错误: Expecting ',' delimiter (多处)
```

### **测试 4: 正确格式**
```bash
echo '{"title":"最抢手,产品\"离CEO最近\""}' | python3 -m json.tool
# ✅ 通过
```

---

**文档版本**: v1.1  
**更新日期**: 2025-10-11  
**新增内容**: 未转义双引号错误案例及实战场景分析
