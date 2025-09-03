# 自定义模板异步API使用文档

## 概述

自定义模板异步API允许用户上传ZIP格式的模板文件，通过异步处理生成定制化的HTML卡片内容。该API采用两阶段处理流程：首先生成基础HTML内容，然后自动将本地图片资源转换为base64嵌入格式，确保生成的HTML文件可以独立使用。

## API端点概览

### 1. 提交异步任务
- **端点**: `POST /api/generate/custom/async`
- **用途**: 提交自定义模板生成任务

### 2. 查询任务状态  
- **端点**: `GET /api/generate/custom/status/{taskId}`
- **用途**: 查询任务处理状态和进度

### 3. 获取生成结果
- **端点**: `GET /api/generate/card/content/{folderName}`
- **用途**: 获取生成完成后的HTML文件内容

---

## 详细使用流程

### 步骤1：提交异步任务

**请求方式**: POST
**端点**: `/api/generate/custom/async`
**内容类型**: multipart/form-data

#### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| zipFile | File | 是 | ZIP格式的模板文件 |
| prompt | String | 是 | 生成内容的提示词 |
| templateName | String | 否 | 模板名称，默认为"podcast-template" |
| token | String | 否 | 用户认证token |

#### 示例请求 (cURL)

```bash
curl -X POST "http://localhost:6009/api/generate/custom/async" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "zipFile=@/path/to/template.zip" \
  -F "prompt=根据提供的模板生成播客卡片，包含标题、描述和背景图片" \
  -F "templateName=podcast-card-template"
```

#### 响应示例

```json
{
  "code": 200,
  "success": true,
  "data": {
    "taskId": "custom_1756824840092_xyz123",
    "folderName": "custom_template_1756824840092", 
    "folderPath": "/app/data/users/default/folders/custom_template_1756824840092",
    "topic": "自定义模板: podcast-card-template",
    "templateName": "podcast-card-template",
    "status": "submitted",
    "extractedStructure": {
      "totalFiles": 15,
      "directories": ["assets", "images", "css"],
      "totalSize": 2048000
    },
    "statusUrl": "/api/generate/custom/status/custom_1756824840092_xyz123"
  },
  "message": "任务已提交，正在后台处理"
}
```

### 步骤2：查询任务状态

使用返回的`taskId`查询任务处理状态。

**请求方式**: GET  
**端点**: `/api/generate/custom/status/{taskId}`

#### 示例请求

```bash
curl -X GET "http://localhost:6009/api/generate/custom/status/custom_1756824840092_xyz123" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 状态说明

| 状态 | 描述 | 说明 |
|------|------|------|
| submitted | 已提交 | 任务已接收，等待处理 |
| generating | 生成中 | AI正在生成HTML内容（第一阶段） |
| embedding | 嵌入中 | 正在将图片转换为base64格式（第二阶段） |
| completed | 已完成 | 任务处理完成，可获取结果 |
| failed | 失败 | 任务处理失败 |

#### 响应示例

**处理中状态**:
```json
{
  "code": 200,
  "success": true,
  "status": "generating",
  "taskId": "custom_1756824840092_xyz123",
  "folderName": "custom_template_1756824840092",
  "topic": "自定义模板: podcast-card-template",
  "message": "正在AI生成中",
  "progress": {
    "phase": "first_generation",
    "description": "正在生成基础HTML内容"
  },
  "metadata": {
    "phases": {
      "extraction": "completed",
      "promptProcessing": "completed", 
      "firstGeneration": "processing",
      "base64Embedding": "pending"
    }
  }
}
```

**完成状态**:
```json
{
  "code": 200,
  "success": true,
  "status": "completed",
  "taskId": "custom_1756824840092_xyz123",
  "folderName": "custom_template_1756824840092",
  "topic": "自定义模板: podcast-card-template",
  "message": "任务处理完成",
  "files": {
    "html": ["播客卡片.html", "播客卡片_with_base64.html"],
    "total": 2
  },
  "progress": {
    "phase": "completed",
    "generatedFiles": {
      "original": "播客卡片.html",
      "withBase64": "播客卡片_with_base64.html"
    }
  },
  "templateName": "podcast-card-template",
  "metadata": {
    "phases": {
      "extraction": "completed",
      "promptProcessing": "completed",
      "firstGeneration": "completed", 
      "base64Embedding": "completed"
    },
    "stats": {
      "totalImages": 3,
      "convertedImages": 3,
      "totalCssUrls": 5,
      "convertedCssUrls": 4,
      "processingTime": 2580
    }
  }
}
```

### 步骤3：获取生成结果

当任务状态为`completed`时，可以获取生成的HTML文件内容。

**请求方式**: GET
**端点**: `/api/generate/card/content/{folderName}`

#### 示例请求

```bash
curl -X GET "http://localhost:6009/api/generate/card/content/custom_template_1756824840092" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 响应示例

```json
{
  "code": 200,
  "success": true,
  "data": {
    "folderName": "custom_template_1756824840092",
    "content": "<!DOCTYPE html><html>...</html>",
    "fileName": "播客卡片_with_base64.html",
    "fileSize": 1024000,
    "contentType": "text/html",
    "generationTime": "2025-01-06T10:30:45.123Z",
    "fourFileGeneration": false
  },
  "message": "获取成功"
}
```

---

## 完整示例代码

### JavaScript/Node.js 示例

```javascript
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

class CustomTemplateClient {
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl;
    this.headers = {
      'Authorization': `Bearer ${token}`
    };
  }

  // 1. 提交任务
  async submitTask(zipFilePath, prompt, templateName = 'podcast-template') {
    const form = new FormData();
    form.append('zipFile', fs.createReadStream(zipFilePath));
    form.append('prompt', prompt);
    form.append('templateName', templateName);

    const response = await axios.post(
      `${this.baseUrl}/api/generate/custom/async`,
      form,
      {
        headers: {
          ...this.headers,
          ...form.getHeaders()
        }
      }
    );

    return response.data;
  }

  // 2. 查询状态
  async checkStatus(taskId) {
    const response = await axios.get(
      `${this.baseUrl}/api/generate/custom/status/${taskId}`,
      { headers: this.headers }
    );
    return response.data;
  }

  // 3. 获取结果
  async getResult(folderName) {
    const response = await axios.get(
      `${this.baseUrl}/api/generate/card/content/${folderName}`,
      { headers: this.headers }
    );
    return response.data;
  }

  // 完整流程
  async processTemplate(zipFilePath, prompt, templateName, options = {}) {
    const { pollInterval = 5000, maxWaitTime = 1200000 } = options; // 5秒轮询，最多20分钟

    console.log('1. 提交任务...');
    const submitResult = await this.submitTask(zipFilePath, prompt, templateName);
    const { taskId, folderName } = submitResult.data;
    
    console.log(`任务已提交: ${taskId}`);

    console.log('2. 等待处理完成...');
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      const status = await this.checkStatus(taskId);
      console.log(`状态: ${status.status} - ${status.message}`);

      if (status.status === 'completed') {
        console.log('3. 获取结果...');
        const result = await this.getResult(folderName);
        return {
          success: true,
          taskId,
          folderName,
          content: result.data.content,
          fileName: result.data.fileName,
          metadata: status.metadata
        };
      }

      if (status.status === 'failed') {
        throw new Error(`任务失败: ${status.message}`);
      }

      // 等待后再次检查
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('任务超时');
  }
}

// 使用示例
async function main() {
  const client = new CustomTemplateClient('http://localhost:6009', 'your-token');

  try {
    const result = await client.processTemplate(
      './template.zip',
      '根据模板生成一个播客节目的宣传卡片，包含主持人信息、节目标题和背景图片',
      'podcast-card-v2'
    );

    console.log('生成成功!');
    console.log('文件名:', result.fileName);
    console.log('任务ID:', result.taskId);
    
    // 保存HTML文件
    fs.writeFileSync('./result.html', result.content);
    console.log('HTML文件已保存为 result.html');

  } catch (error) {
    console.error('处理失败:', error.message);
  }
}

main();
```

### Python 示例

```python
import requests
import time
import json

class CustomTemplateClient:
    def __init__(self, base_url, token):
        self.base_url = base_url
        self.headers = {'Authorization': f'Bearer {token}'}

    def submit_task(self, zip_file_path, prompt, template_name='podcast-template'):
        """提交任务"""
        url = f"{self.base_url}/api/generate/custom/async"
        
        with open(zip_file_path, 'rb') as f:
            files = {'zipFile': f}
            data = {
                'prompt': prompt,
                'templateName': template_name
            }
            
            response = requests.post(url, files=files, data=data, headers=self.headers)
            return response.json()

    def check_status(self, task_id):
        """查询状态"""
        url = f"{self.base_url}/api/generate/custom/status/{task_id}"
        response = requests.get(url, headers=self.headers)
        return response.json()

    def get_result(self, folder_name):
        """获取结果"""
        url = f"{self.base_url}/api/generate/card/content/{folder_name}"
        response = requests.get(url, headers=self.headers)
        return response.json()

    def process_template(self, zip_file_path, prompt, template_name, poll_interval=5, max_wait_time=1200):
        """完整流程"""
        # 1. 提交任务
        print("1. 提交任务...")
        submit_result = self.submit_task(zip_file_path, prompt, template_name)
        task_id = submit_result['data']['taskId']
        folder_name = submit_result['data']['folderName']
        print(f"任务已提交: {task_id}")

        # 2. 轮询状态
        print("2. 等待处理完成...")
        start_time = time.time()
        
        while time.time() - start_time < max_wait_time:
            status = self.check_status(task_id)
            print(f"状态: {status['status']} - {status['message']}")

            if status['status'] == 'completed':
                # 3. 获取结果
                print("3. 获取结果...")
                result = self.get_result(folder_name)
                return {
                    'success': True,
                    'task_id': task_id,
                    'folder_name': folder_name,
                    'content': result['data']['content'],
                    'file_name': result['data']['fileName'],
                    'metadata': status['metadata']
                }

            if status['status'] == 'failed':
                raise Exception(f"任务失败: {status['message']}")

            time.sleep(poll_interval)

        raise Exception("任务超时")

# 使用示例
def main():
    client = CustomTemplateClient('http://localhost:6009', 'your-token')

    try:
        result = client.process_template(
            './template.zip',
            '根据模板生成一个播客节目的宣传卡片，包含主持人信息、节目标题和背景图片',
            'podcast-card-v2'
        )

        print("生成成功!")
        print(f"文件名: {result['file_name']}")
        print(f"任务ID: {result['task_id']}")

        # 保存HTML文件
        with open('result.html', 'w', encoding='utf-8') as f:
            f.write(result['content'])
        print("HTML文件已保存为 result.html")

    except Exception as error:
        print(f"处理失败: {error}")

if __name__ == "__main__":
    main()
```

---

## 高级特性

### 1. Base64图片嵌入

API会自动处理以下类型的图片资源转换：

- **IMG标签**: `<img src="./images/photo.jpg">` → `<img src="data:image/jpeg;base64,..."`
- **CSS背景图**: `background-image: url('/path/to/image.png')` → `background-image: url('data:image/png;base64,...')`
- **内联样式**: `style="background-image: url('./bg.jpg')"` → `style="background-image: url('data:image/jpeg;base64,..)'"`

支持的图片格式：PNG、JPG、JPEG、GIF、SVG、WebP、BMP、ICO

### 2. 路径解析规则

- 绝对路径：直接使用
- 相对路径（`./`、`../`）：相对于HTML文件目录解析  
- 模板路径：相对于解压的模板目录解析

### 3. 错误处理和重试机制

- ZIP文件安全验证
- 文件生成超时检测（20分钟）
- Base64转换失败时的降级处理
- 详细的错误日志和状态跟踪

---

## 错误码说明

| 错误码 | 说明 | 解决方案 |
|--------|------|----------|
| 400 | 请求参数错误 | 检查必填参数和文件格式 |
| 404 | 任务不存在 | 确认taskId正确性 |
| 500 | 服务器内部错误 | 查看日志，联系技术支持 |

### 常见错误示例

```json
{
  "code": 400,
  "success": false,
  "message": "ZIP文件不能为空"
}
```

```json
{
  "code": 404,
  "success": false,
  "status": "not_found",
  "message": "任务不存在或已过期"
}
```

---

## 性能优化建议

1. **文件大小**: 建议ZIP文件大小不超过100MB
2. **轮询间隔**: 建议使用5-10秒的轮询间隔
3. **超时设置**: 复杂任务可能需要10-20分钟处理时间
4. **并发控制**: 建议同时运行的任务数不超过5个

---

## 版本更新历史

### v3.10.2
- 新增CSS中url()引用的base64转换支持
- 优化图片路径解析逻辑
- 改进错误处理和日志记录

### v3.10.1  
- 实现两阶段处理流程
- 添加base64图片嵌入功能
- 优化任务状态跟踪

### v3.10.0
- 初始版本发布
- 基础异步处理功能
- ZIP文件上传和解析

---

## 技术支持

如有问题或建议，请联系技术支持团队或查看项目GitHub仓库的Issues页面。