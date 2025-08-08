# API接口文档

## 生成和处理卡片接口

### 接口信息
- **URL**: `https://engagia-s-cdmxfcdbwa.cn-hangzhou.fcapp.run/generate-and-process`
- **方法**: `POST`
- **Content-Type**: `application/json`

### 请求参数

#### 请求体结构
```json
{
  "format": "html",
  "config": {
    "theme": {
      "name": "string",
      "pageTitle": "string",
      "sectionTitle": "string",
      "sectionSubtitle": "string",
      "gradientColor1": "string",
      "gradientColor2": "string",
      "gradientColor1RGB": "string",
      "accentColor": "string",
      "accentColorRGB": "string"
    },
    "copy": {
      "title": "string",
      "content": "string",
      "hashtags": "string",
      "tips": "string"
    },
    "cards": [
      {
        "type": "main | normal",
        "icon": "string",
        "header": "string",
        "subtitle": "string",
        "content": {
          "highlight": {
            "number": "string",
            "description": "string"
          },
          "points": [
            {
              "icon": "string",
              "text": "string"
            }
          ],
          "list": ["string"],
          "special": {
            "type": "info-box",
            "title": "string",
            "description": "string"
          },
          "tip": "string",
          "tags": ["string"]
        }
      }
    ]
  }
}
```

#### 参数说明

##### format
- **类型**: `string`
- **必填**: 是
- **说明**: 输出格式，当前支持 "html"

##### config.theme
- **name**: 主题名称
- **pageTitle**: 页面标题
- **sectionTitle**: 章节标题
- **sectionSubtitle**: 章节副标题
- **gradientColor1**: 渐变色1（十六进制）
- **gradientColor2**: 渐变色2（十六进制）
- **gradientColor1RGB**: 渐变色1的RGB值
- **accentColor**: 强调色（十六进制）
- **accentColorRGB**: 强调色的RGB值

##### config.copy
- **title**: 内容标题
- **content**: 主要内容文本（支持markdown格式）
- **hashtags**: 标签（用于社交媒体）
- **tips**: 发布提示和建议

##### config.cards
卡片数组，每个卡片包含：
- **type**: 卡片类型（"main" 为主卡片，"normal" 为普通卡片）
- **icon**: 卡片图标（支持emoji）
- **header**: 卡片标题
- **subtitle**: 卡片副标题
- **content**: 卡片内容对象
  - **highlight**: 高亮内容（主卡片特有）
  - **points**: 要点列表（主卡片特有）
  - **list**: 列表内容（普通卡片）
  - **special**: 特殊信息框
  - **tip**: 提示信息
  - **tags**: 标签数组

### 响应参数

#### 成功响应（200 OK）
```json
{
  "success": true,
  "message": "生成并处理完成",
  "fileId": "string",
  "originalFileName": "string",
  "fileSize": number,
  "shortCode": "string",
  "shareLink": "string",
  "extractedData": {
    "id": "string",
    "title": "string",
    "content": "string",
    "hashtags": ["string"],
    "images": [],
    "cards": [
      {
        "id": "string",
        "title": "string",
        "content": "string",
        "icon": "string",
        "subtitle": "string"
      }
    ]
  },
  "data": {
    "fileId": "string",
    "originalFileName": "string",
    "fileSize": number,
    "title": "string",
    "content": "string",
    "hashtags": ["string"],
    "cardCount": number,
    "sidebarCount": number,
    "cards": [
      {
        "id": "string",
        "title": "string",
        "content": "string",
        "icon": "string",
        "subtitle": "string"
      }
    ],
    "imageCount": number,
    "imagesDir": "string",
    "galleryPath": "string",
    "exportStatus": "string",
    "shortCode": "string",
    "shortUrl": "string",
    "originalUrl": "string",
    "qrCodeUrl": "string"
  }
}
```

#### 响应字段说明

##### 基础信息
- **success**: 请求是否成功
- **message**: 响应消息
- **fileId**: 生成文件的唯一ID
- **originalFileName**: 原始文件名
- **fileSize**: 文件大小（字节）
- **shortCode**: 短代码
- **shareLink**: 分享链接

##### extractedData（提取的数据）
- **id**: 数据唯一标识
- **title**: 提取的标题
- **content**: 提取的内容
- **hashtags**: 标签数组
- **images**: 图片数组（如果有）
- **cards**: 卡片信息数组

##### data（完整数据）
包含更详细的信息：
- **cardCount**: 卡片数量
- **sidebarCount**: 侧边栏数量
- **imageCount**: 图片数量
- **imagesDir**: 图片目录路径
- **galleryPath**: 图库路径
- **exportStatus**: 导出状态
- **shortUrl**: 短链接
- **originalUrl**: 原始链接
- **qrCodeUrl**: 二维码链接

### 示例请求

```bash
curl --location 'https://engagia-s-cdmxfcdbwa.cn-hangzhou.fcapp.run/generate-and-process' \
--header 'Content-Type: application/json' \
--data '{
    "format": "html",
    "config": {
        "theme": {
            "name": "property-trust-management",
            "pageTitle": "物业管理信托制：让业主做主的透明管理模式",
            "sectionTitle": "你的物业费都花哪了？",
            "sectionSubtitle": "天鹅湖花园小区品质提升方案",
            "gradientColor1": "#06B6D4",
            "gradientColor2": "#10B981",
            "gradientColor1RGB": "6, 182, 212",
            "accentColor": "#10B981",
            "accentColorRGB": "16, 185, 129"
        },
        "copy": {
            "title": "🏘️ 你的物业费都花哪了？",
            "content": "详细内容...",
            "hashtags": "#物业管理 #信托制物业",
            "tips": "发布时间：晚7-9点"
        },
        "cards": [
            {
                "type": "main",
                "icon": "",
                "header": "你的物业费都花哪了？",
                "subtitle": "透明管理，业主做主",
                "content": {
                    "highlight": {
                        "number": "信托制物业",
                        "description": "每一分钱都看得见"
                    },
                    "points": [
                        {"icon": "→", "text": "让物业管理回归服务本质"}
                    ],
                    "tags": []
                }
            }
        ]
    }
}'
```

### 性能指标
- **平均响应时间**: 10-15秒
- **文件大小**: 约20-30KB（HTML格式）
- **并发限制**: 建议不超过10个并发请求

### 错误码
| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 500 | 服务器内部错误 |
| 503 | 服务暂时不可用 |

### 注意事项
1. 请求体大小限制为 10MB
2. 生成的文件会保存在服务器上，通过短链接访问
3. 短链接有效期为30天
4. 支持中文内容，请确保使用UTF-8编码
5. HTML内容中支持内联样式和emoji表情

### 更新日志
- **2025-08-07**: 初始版本发布