# AI Terminal API Reference

## Base Configuration

- **Base URL**: `http://localhost:6000/api`
- **Content Type**: `application/json`
- **Authentication**: Bearer Token (JWT)

## Authentication

Most endpoints require authentication via Bearer token:

```http
Authorization: Bearer <token>
```

## Response Format

### Success Response
```json
{
  "code": 200,
  "success": true,
  "data": {},
  "message": "Success message"
}
```

### Error Response
```json
{
  "code": 400,
  "success": false,
  "error": "Error details",
  "message": "Error message"
}
```

## API Endpoints

### 1. Authentication APIs

#### Login
```http
POST /auth/login
```

**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "code": 200,
  "success": true,
  "data": {
    "token": "jwt_token",
    "username": "user",
    "userId": "user_id",
    "expiresIn": 86400
  }
}
```

#### Verify Token
```http
GET /auth/verify
```

**Headers:**
- `Authorization: Bearer <token>`

**Response:**
```json
{
  "code": 200,
  "success": true,
  "data": {
    "valid": true,
    "user": {
      "username": "user",
      "userId": "user_id"
    }
  }
}
```

### 2. Card Generation APIs

#### Generate Card (Synchronous)
```http
POST /generate/card
```

**Request Body:**
```json
{
  "topic": "string",
  "templateName": "string (optional)",
  "style": "string (optional)",
  "language": "string (optional)",
  "reference": "string (optional)"
}
```

**Response:**
```json
{
  "code": 200,
  "success": true,
  "data": {
    "folderName": "sanitized_topic",
    "folderPath": "/path/to/folder",
    "files": {
      "json": ["file1.json"],
      "html": ["file1.html", "file2.html"]
    },
    "metadata": {}
  }
}
```

#### Generate Card (Asynchronous)
```http
POST /generate/card/async
```

**Request Body:**
```json
{
  "topic": "string",
  "templateName": "string (optional)",
  "token": "string (optional)"
}
```

**Response:**
```json
{
  "code": 200,
  "success": true,
  "data": {
    "taskId": "task_xxx",
    "folderName": "sanitized_topic",
    "folderPath": "/path/to/folder",
    "topic": "original_topic",
    "templateName": "template_used",
    "status": "submitted"
  }
}
```

#### Check Generation Status
```http
GET /generate/status/:taskId
```

**Response:**
```json
{
  "code": 200,
  "success": true,
  "data": {
    "taskId": "task_xxx",
    "status": "completed|processing|failed",
    "progress": {
      "json": 1,
      "html": 4,
      "expected": 4
    },
    "files": {
      "json": ["data.json"],
      "html": ["card1.html", "card2.html"]
    },
    "message": "Generation complete"
  }
}
```

#### Stream Card Generation
```http
POST /generate/card/stream
```

**Request Body:**
```json
{
  "topic": "string",
  "templateName": "string (optional)"
}
```

**Response:** Server-Sent Events stream

```
data: {"type": "start", "message": "Starting generation"}
data: {"type": "progress", "message": "Generating content..."}
data: {"type": "complete", "data": {...}}
```

### 3. Template APIs

#### Get All Templates
```http
GET /generate/templates
```

**Response:**
```json
{
  "code": 200,
  "success": true,
  "data": [
    {
      "id": "template-id",
      "name": "Template Name",
      "description": "Template description",
      "version": "1.0",
      "outputType": "html",
      "outputCount": 4,
      "icon": "🌐"
    }
  ]
}
```

#### Get Template Quick Buttons
```http
GET /generate/templates/quick-buttons
```

**Response:**
```json
{
  "code": 200,
  "success": true,
  "data": [
    {
      "id": "template-id",
      "name": "Quick",
      "description": "Quick generation",
      "icon": "⚡"
    }
  ]
}
```

### 4. Card Query APIs

#### Query Card Files
```http
GET /generate/card/query/:folderName
```

**Query Parameters:**
- `user`: Username (optional, defaults to current user)

**Response:**
```json
{
  "code": 200,
  "success": true,
  "data": {
    "folderName": "folder_name",
    "files": {
      "json": [
        {
          "name": "data.json",
          "size": 1024,
          "modified": "2024-01-01T00:00:00Z"
        }
      ],
      "html": [
        {
          "name": "card.html",
          "size": 2048,
          "modified": "2024-01-01T00:00:00Z"
        }
      ]
    },
    "metadata": {
      "created": "2024-01-01T00:00:00Z",
      "template": "template-name"
    }
  }
}
```

#### Get Card Content
```http
GET /generate/card/content/:folderName
```

**Query Parameters:**
- `user`: Username (optional)
- `format`: Output format (json|html|all)

**Response:**
```json
{
  "code": 200,
  "success": true,
  "data": {
    "folderName": "folder_name",
    "content": {
      "json": {...},
      "html": ["<html>...</html>"]
    }
  }
}
```

### 5. Terminal APIs

#### Get Terminal Sessions
```http
GET /terminal/sessions
```

**Response:**
```json
{
  "code": 200,
  "success": true,
  "data": [
    {
      "sessionId": "session_123",
      "userId": "user_id",
      "created": "2024-01-01T00:00:00Z",
      "status": "active"
    }
  ]
}
```

#### Execute Command
```http
POST /terminal/execute
```

**Request Body:**
```json
{
  "command": "ls -la",
  "sessionId": "session_123"
}
```

**Response:**
```json
{
  "code": 200,
  "success": true,
  "data": {
    "output": "command output",
    "exitCode": 0
  }
}
```

### 6. WebSocket Events

#### Terminal Connection
```javascript
// Connect to terminal
socket.emit('terminal:create', {
  cols: 80,
  rows: 24
});

// Send input
socket.emit('terminal:input', {
  sessionId: 'session_123',
  data: 'ls\n'
});

// Receive output
socket.on('terminal:output', (data) => {
  console.log(data.output);
});
```

#### Card Generation Updates
```javascript
// Subscribe to generation updates
socket.emit('generation:subscribe', {
  taskId: 'task_xxx'
});

// Receive progress updates
socket.on('generation:progress', (data) => {
  console.log(data.progress);
});
```

### 7. File Operations

#### Upload File
```http
POST /upload
```

**Headers:**
- `Content-Type: multipart/form-data`

**Form Data:**
- `file`: File to upload
- `path`: Target path (optional)

**Response:**
```json
{
  "code": 200,
  "success": true,
  "data": {
    "filename": "uploaded_file.txt",
    "path": "/uploads/uploaded_file.txt",
    "size": 1024
  }
}
```

#### List Workspace Files
```http
GET /workspace/files
```

**Query Parameters:**
- `path`: Directory path (optional)

**Response:**
```json
{
  "code": 200,
  "success": true,
  "data": {
    "files": [
      {
        "name": "file.txt",
        "type": "file",
        "size": 1024,
        "modified": "2024-01-01T00:00:00Z"
      }
    ],
    "directories": [
      {
        "name": "folder",
        "type": "directory",
        "modified": "2024-01-01T00:00:00Z"
      }
    ]
  }
}
```

## Error Codes

| Code | Description |
|------|-------------|
| 200  | Success |
| 400  | Bad Request |
| 401  | Unauthorized |
| 403  | Forbidden |
| 404  | Not Found |
| 409  | Conflict |
| 500  | Internal Server Error |

## Rate Limiting

API endpoints are rate-limited to prevent abuse:

- Authentication: 5 requests per minute
- Card Generation: 10 requests per minute
- File Operations: 30 requests per minute
- Terminal Operations: No limit (WebSocket)

Rate limit headers:
```http
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 8
X-RateLimit-Reset: 1640995200
```

## Pagination

List endpoints support pagination:

```http
GET /api/endpoint?page=1&limit=20
```

Response includes pagination metadata:
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```