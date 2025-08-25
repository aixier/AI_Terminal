# Engagia Process API 文档

## API 端点
`http://engagia-s3.paitongai.net/api/process`

## 请求方法
`POST`

## 请求头
```
Content-Type: application/json
```

## 请求体格式
```json
{
    "html": "<!DOCTYPE html>..."
}
```

### 请求参数说明
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| html | string | 是 | 完整的HTML内容字符串 |

## 请求示例

### 使用 curl
```bash
curl --location 'http://engagia-s3.paitongai.net/api/process' \
--header 'Content-Type: application/json' \
--data '{
    "html": "<!DOCTYPE html><html>...</html>"
}'
```

### 从文件读取HTML内容
```bash
curl --location 'http://engagia-s3.paitongai.net/api/process' \
--header 'Content-Type: application/json' \
--data "{
    \"html\": $(cat your-file.html | jq -Rs .)
}"
```

### 使用 JavaScript/Node.js
```javascript
const response = await fetch('http://engagia-s3.paitongai.net/api/process', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        html: htmlContent
    })
});

const result = await response.json();
```

## 响应格式

### 成功响应 (200 OK)
```json
{
    "success": true,
    "message": "处理完成",
    "fileId": "undefined-MeIBnNpm",
    "originalFileName": "raw-html.html",
    "fileSize": 32038,
    "shortCode": "oCZpq6G2",
    "shareLink": "http://engagia-s3.paitongai.net/s/oCZpq6G2",
    "extractedData": {
        "id": "8819c82c-1674-4799-a323-4f8ece12b19e",
        "title": "",
        "content": "",
        "hashtags": [],
        "images": [
            {
                "src": "https://www.cardplanet.me/p/undefined-MeIBnNpm/card-1.png"
            },
            {
                "src": "https://www.cardplanet.me/p/undefined-MeIBnNpm/card-2.png"
            }
            // ... 更多图片
        ],
        "cards": []
    },
    "data": {
        "fileId": "undefined-MeIBnNpm",
        "originalFileName": "raw-html.html",
        "fileSize": 32038,
        "title": "",
        "content": "",
        "hashtags": [],
        "cardCount": 8,
        "sidebarCount": 0,
        "cards": [],
        "imageCount": 0,
        "imagesDir": "/app/engagia-s2/s/undefined-MeIBnNpm",
        "galleryPath": "/images/undefined-MeIBnNpm",
        "exportStatus": "成功",
        "shortCode": "oCZpq6G2",
        "shortUrl": "http://engagia-s3.paitongai.net/s/oCZpq6G2",
        "originalUrl": "http://engagia-s3.paitongai.net/undefined-MeIBnNpm",
        "qrCodeUrl": "http://engagia-s3.paitongai.net/api/qr/oCZpq6G2"
    }
}
```

### 响应字段说明

#### 顶层字段
| 字段 | 类型 | 说明 |
|------|------|------|
| success | boolean | 请求是否成功 |
| message | string | 处理结果消息 |
| fileId | string | 生成的文件唯一标识 |
| originalFileName | string | 原始文件名 |
| fileSize | number | 文件大小（字节） |
| shortCode | string | 短链接代码 |
| shareLink | string | 分享链接 |
| extractedData | object | 提取的数据对象 |
| data | object | 详细数据对象 |

#### extractedData 对象
| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | UUID格式的唯一标识 |
| title | string | 提取的标题（可能为空） |
| content | string | 提取的内容（可能为空） |
| hashtags | array | 提取的标签数组 |
| images | array | 生成的卡片图片URL数组 |
| cards | array | 卡片数据数组 |

#### images 数组元素
| 字段 | 类型 | 说明 |
|------|------|------|
| src | string | 卡片图片的完整URL地址 |

#### data 对象
| 字段 | 类型 | 说明 |
|------|------|------|
| fileId | string | 文件ID |
| originalFileName | string | 原始文件名 |
| fileSize | number | 文件大小 |
| title | string | 标题 |
| content | string | 内容 |
| hashtags | array | 标签数组 |
| cardCount | number | 生成的卡片数量 |
| sidebarCount | number | 侧边栏数量 |
| cards | array | 卡片数据 |
| imageCount | number | 图片数量 |
| imagesDir | string | 服务器上的图片目录 |
| galleryPath | string | 图片库路径 |
| exportStatus | string | 导出状态 |
| shortCode | string | 短代码 |
| shortUrl | string | 短链接URL |
| originalUrl | string | 原始URL |
| qrCodeUrl | string | 二维码URL |

## 使用示例

### 完整的测试脚本
```bash
#!/bin/bash

# 读取HTML文件
HTML_FILE="/mnt/d/work/AI_Terminal/2019_ai_dune_style.html"

# 发送请求
response=$(curl -s --location 'http://engagia-s3.paitongai.net/api/process' \
--header 'Content-Type: application/json' \
--data "{
    \"html\": $(cat "$HTML_FILE" | jq -Rs .)
}")

# 解析响应
echo "$response" | jq '.'

# 提取生成的图片URL
echo "生成的卡片图片："
echo "$response" | jq -r '.extractedData.images[].src'

# 提取短链接
echo "短链接："
echo "$response" | jq -r '.shareLink'
```

## 注意事项

1. **HTML内容格式**：HTML内容必须是完整的有效HTML文档
2. **文件大小限制**：请注意可能存在的文件大小限制
3. **响应时间**：处理较大的HTML文件可能需要较长时间（测试中约35秒）
4. **卡片生成**：API会自动识别HTML中的卡片元素并生成对应的PNG图片
5. **图片访问**：生成的图片可通过返回的URL直接访问

## 常见用途

1. **将HTML页面转换为卡片图片**
2. **生成可分享的短链接**
3. **批量处理HTML内容生成图片资源**
4. **创建社交媒体分享内容**

## 错误处理

建议在使用时添加错误处理逻辑：

```javascript
try {
    const response = await fetch('http://engagia-s3.paitongai.net/api/process', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ html: htmlContent })
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
        throw new Error(result.message || '处理失败');
    }
    
    // 处理成功结果
    console.log('生成的图片:', result.extractedData.images);
    
} catch (error) {
    console.error('API调用失败:', error);
}
```