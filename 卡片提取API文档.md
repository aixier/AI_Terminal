# 卡片提取API文档

## API概述

智能卡片提取API能够自动识别HTML页面中的卡片元素，进行截图，并返回JSONL格式的结果。

基础URL: `http://localhost:3000/api`

## 接口列表

### 1. 上传HTML文件提取卡片

**接口**: `POST /api/extract-cards`

**描述**: 上传HTML文件并提取其中的卡片元素

**请求格式**: `multipart/form-data`

**请求参数**:
- `html` (file): HTML文件

**查询参数**:
- `format` (string, 可选): 返回格式，可选值: `json` (默认) 或 `jsonl`

**响应示例** (format=json):
```json
{
  "success": true,
  "sessionId": "a1b2c3d4",
  "timestamp": 1234567890,
  "fileName": "example.html",
  "cardsCount": 3,
  "cards": [
    {
      "card_img": "/path/to/image.png",
      "card_element": "<div class=\"card\">...</div>"
    }
  ],
  "jsonl": "{\"card_img\":\"/path/to/image.png\",\"card_element\":\"<div>...</div>\"}\n..."
}
```

**响应示例** (format=jsonl):
```jsonl
{"card_img":"/path/to/image1.png","card_element":"<div class=\"card\">...</div>"}
{"card_img":"/path/to/image2.png","card_element":"<div class=\"card\">...</div>"}
```

### 2. 直接提交HTML内容

**接口**: `POST /api/extract-cards-raw`

**描述**: 直接POST HTML内容进行卡片提取

**请求格式**: `text/html`

**请求头**:
- `Content-Type`: `text/html`
- `X-Filename` (可选): 文件名

**请求体**: HTML内容字符串

**查询参数**:
- `format` (string, 可选): 返回格式，可选值: `json` (默认) 或 `jsonl`

**cURL示例**:
```bash
curl -X POST http://localhost:3000/api/extract-cards-raw \
  -H "Content-Type: text/html" \
  -H "X-Filename: test.html" \
  -d @test.html
```

### 3. 获取历史提取结果

**接口**: `GET /api/extract-cards/:sessionId`

**描述**: 根据会话ID获取之前的提取结果

**路径参数**:
- `sessionId`: 提取会话ID

**查询参数**:
- `format` (string, 可选): 返回格式，可选值: `json` (默认) 或 `jsonl`

**响应**: 同上传接口

### 4. 获取卡片截图

**接口**: `GET /api/extract-cards/:sessionId/images/:imageFile`

**描述**: 获取特定的卡片截图文件

**路径参数**:
- `sessionId`: 会话ID
- `imageFile`: 图片文件名

**响应**: PNG图片文件

### 5. 清理旧文件

**接口**: `DELETE /api/extract-cards/cleanup`

**描述**: 清理过期的提取结果和图片

**查询参数**:
- `maxAge` (number, 可选): 最大保留时间（毫秒），默认24小时

**响应示例**:
```json
{
  "success": true,
  "message": "已清理超过 24 小时的文件"
}
```

### 6. 健康检查

**接口**: `GET /api/extract-cards/health`

**描述**: 检查服务状态和Chrome可用性

**响应示例**:
```json
{
  "success": true,
  "status": "healthy",
  "chromePath": "/usr/bin/chromium-browser"
}
```

## 卡片识别规则

系统会自动识别以下类型的元素作为卡片：

1. **类名匹配**（优先级从高到低）:
   - `tutorial-card`
   - `content-card`
   - `cover-card`
   - `card-container`
   - 包含 `card` 的类名
   - 包含 `panel`、`tile`、`item` 的类名

2. **结构特征**:
   - 最小尺寸: 200x250px
   - 最大尺寸: 800x1200px
   - 支持的宽高比: 3:4, 4:3, 1:1, 16:9

3. **内容特征**:
   - 包含子元素
   - 文本长度 > 20字符
   - 可能包含图片或标题

## 使用示例

### JavaScript (Fetch API)

```javascript
// 上传HTML文件
const formData = new FormData();
formData.append('html', fileInput.files[0]);

fetch('http://localhost:3000/api/extract-cards?format=jsonl', {
    method: 'POST',
    body: formData
})
.then(response => response.text())
.then(jsonl => {
    // 处理JSONL数据
    const lines = jsonl.split('\n').filter(line => line);
    const cards = lines.map(line => JSON.parse(line));
    console.log(cards);
});
```

### Node.js

```javascript
const axios = require('axios');
const fs = require('fs');

// 直接提交HTML内容
const htmlContent = fs.readFileSync('test.html', 'utf8');

axios.post('http://localhost:3000/api/extract-cards-raw', htmlContent, {
    headers: {
        'Content-Type': 'text/html',
        'X-Filename': 'test.html'
    },
    params: { format: 'jsonl' }
})
.then(response => {
    console.log('提取成功:', response.data);
})
.catch(error => {
    console.error('提取失败:', error);
});
```

### Python

```python
import requests

# 上传文件
with open('test.html', 'rb') as f:
    files = {'html': ('test.html', f, 'text/html')}
    response = requests.post(
        'http://localhost:3000/api/extract-cards',
        files=files,
        params={'format': 'jsonl'}
    )

# 解析JSONL
import json
for line in response.text.strip().split('\n'):
    card = json.loads(line)
    print(f"图片: {card['card_img']}")
```

## 注意事项

1. **文件大小限制**: 上传的HTML文件不能超过10MB
2. **Chrome依赖**: 服务器需要安装Chrome或Chromium
3. **文件清理**: 建议定期调用清理接口删除旧文件
4. **并发限制**: 建议控制并发请求数量，避免服务器过载
5. **图片路径**: 返回的图片路径是服务器本地路径，需要通过图片接口获取

## 错误码

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |
| 503 | 服务不可用（Chrome未安装）|