# Pod2Post Write Text API

## Overview

Writes text content to a file and optionally uploads it to OSS, returning a downloadable URL.

## Endpoint

**POST** `/api/generate/pod2post/write-text`

## Request

### Headers
```
Content-Type: application/json
```

### Body Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| task_id | string | Yes | - | Task ID in format: `pod2post_{timestamp}_{random}` |
| filename | string | Yes | - | Filename with extension (e.g., `content.json`) |
| content | string | Yes | - | Text content (max 10MB) |
| token | string | No | - | User authentication token |
| upload_to_oss | boolean | No | true | Whether to upload to OSS |
| return_oss_url | boolean | No | true | Whether to return OSS download URL |

### Example Request

```json
{
  "task_id": "pod2post_1736781000_abc123",
  "filename": "content.json",
  "content": "{\"title\": \"Article Title\", \"content\": \"Article content...\"}",
  "upload_to_oss": true,
  "return_oss_url": true
}
```

## Response

### Success Response (200 OK)

```json
{
  "code": 200,
  "success": true,
  "message": "File written successfully and download link generated",
  "data": {
    "filename": "content.json",
    "path": "/app/data/users/default/workspace/card/pod2post_1736781000_abc123/content.json",
    "size": 1024,
    "isNew": true,
    "taskId": "pod2post_1736781000_abc123",
    "username": "default",
    "createdAt": "2025-01-13T10:30:00.000Z",
    "modifiedAt": "2025-01-13T10:30:00.000Z",
    "downloadUrl": "https://cms-mcp.oss-cn-hangzhou.aliyuncs.com/pod2post/default/pod2post_1736781000_abc123/content.json?OSSAccessKeyId=LTAI5tP7iEeXDKDgc8B1GWeW&Expires=2075711157&Signature=xxx",
    "ossPath": "pod2post/default/pod2post_1736781000_abc123/content.json",
    "ossUrl": "https://cms-mcp.oss-cn-hangzhou.aliyuncs.com/default/default/content.json",
    "oss": {
      "ossPath": "pod2post/default/pod2post_1736781000_abc123/content.json",
      "ossUrl": "https://cms-mcp.oss-cn-hangzhou.aliyuncs.com/default/default/content.json",
      "downloadUrl": "https://cms-mcp.oss-cn-hangzhou.aliyuncs.com/pod2post/default/pod2post_1736781000_abc123/content.json?OSSAccessKeyId=LTAI5tP7iEeXDKDgc8B1GWeW&Expires=2075711157&Signature=xxx",
      "uploadedAt": "2025-01-13T10:30:05.000Z"
    }
  }
}
```

### Error Responses

#### 400 Bad Request
```json
{
  "code": 400,
  "success": false,
  "message": "Invalid parameter: task_id format is incorrect, should be pod2post_{timestamp}_{random}"
}
```

#### 500 Internal Server Error
```json
{
  "code": 500,
  "success": false,
  "message": "File write failed"
}
```

## Response Fields

| Field | Type | Description |
|-------|------|-------------|
| filename | string | The filename |
| path | string | Local file path |
| size | number | File size in bytes |
| isNew | boolean | Whether the file is newly created |
| taskId | string | Task ID |
| username | string | Username |
| downloadUrl | string | OSS download URL (if uploaded to OSS) |
| ossPath | string | OSS storage path |
| ossUrl | string | OSS base URL |
| oss | object | OSS detailed information (optional) |

## Usage Examples

### JavaScript/TypeScript

```javascript
const writeTextFile = async (taskId, filename, content) => {
  const response = await fetch('/api/generate/pod2post/write-text', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      task_id: taskId,
      filename: filename,
      content: content
    })
  });

  const result = await response.json();

  if (result.success) {
    return result.data.downloadUrl; // Returns OSS download URL
  } else {
    throw new Error(result.message);
  }
};

// Example usage
const taskId = `pod2post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const content = JSON.stringify({
  title: "My Document",
  content: "This is the document content",
  timestamp: new Date().toISOString()
});

try {
  const downloadUrl = await writeTextFile(taskId, "document.json", content);
  console.log("Download URL:", downloadUrl);
  // You can now use this URL to download the file
  window.open(downloadUrl);
} catch (error) {
  console.error("Error:", error.message);
}
```

### cURL

```bash
curl -X POST http://localhost:8098/api/generate/pod2post/write-text \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "pod2post_1736781000_abc123",
    "filename": "data.json",
    "content": "{\"message\": \"Hello World\"}"
  }'
```

### Python

```python
import requests
import json
import time
import random
import string

def write_text_to_pod2post(filename, content, token=None):
    # Generate task ID
    timestamp = int(time.time())
    random_str = ''.join(random.choices(string.ascii_lowercase + string.digits, k=9))
    task_id = f"pod2post_{timestamp}_{random_str}"

    url = "http://localhost:8098/api/generate/pod2post/write-text"

    payload = {
        "task_id": task_id,
        "filename": filename,
        "content": content
    }

    if token:
        payload["token"] = token

    response = requests.post(url, json=payload)
    result = response.json()

    if result["success"]:
        return result["data"]["downloadUrl"]
    else:
        raise Exception(result["message"])

# Usage
content = json.dumps({
    "title": "Python Example",
    "data": [1, 2, 3, 4, 5]
})

try:
    download_url = write_text_to_pod2post("example.json", content)
    print(f"Download URL: {download_url}")
except Exception as e:
    print(f"Error: {e}")
```

## Notes

1. **Download URL**: The `downloadUrl` field contains a signed URL valid for 10 years
2. **Task ID Format**: Must start with `pod2post_` followed by timestamp and random characters
3. **File Extensions**: Must include file extension (.json, .txt, .md, .html, etc.)
4. **Content Limit**: Maximum content size is 10MB
5. **Error Handling**: OSS upload failure doesn't affect local file write success
6. **Supported File Types**: .txt, .json, .md, .html, .css, .js, .xml, .csv, .pdf, .doc, .docx, etc.

## SDK/Helper Functions

### JavaScript

```javascript
// Generate task ID helper
function generateTaskId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `pod2post_${timestamp}_${random}`;
}

// Write file wrapper
async function writeFileWithOSS(filename, content, options = {}) {
  const defaultOptions = {
    upload_to_oss: true,
    return_oss_url: true
  };

  const payload = {
    task_id: generateTaskId(),
    filename,
    content,
    ...defaultOptions,
    ...options
  };

  const response = await fetch('/api/generate/pod2post/write-text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  return response.json();
}
```

## Rate Limits

- No explicit rate limits
- Content size limited to 10MB per request
- File size limited to 50MB for uploaded files

## Version History

- **v1.1.0** (2025-01-13): Added OSS upload functionality
- **v1.0.0** (2025-10-11): Initial release with local file write only