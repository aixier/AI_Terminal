# 🚀 Claude Code API - 5-Minute Quick Start

> Get Claude Code API running in 5 minutes! No complex setup required.

## 📋 Prerequisites

- Docker installed on your system
- Port 8082 available
- Basic knowledge of REST APIs

## 🎯 Step 1: Deploy Claude Code API (30 seconds)

```bash
# Option 1: Using Docker Hub (Fastest)
docker run -d -p 8082:6000 --name claude-code-api coopotfan/ai-terminal:latest

# Option 2: Build from source
git clone https://github.com/aixier/AI_Terminal.git
cd AI_Terminal
docker build -t claude-code-api .
docker run -d -p 8082:6000 --name claude-code-api claude-code-api
```

## 🧪 Step 2: Test Your First API Call (30 seconds)

### Quick Test - Non-Streaming
```bash
curl -X POST http://localhost:8082/api/generate/card \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "Hello World in Python"
  }'
```

### Quick Test - Streaming (Real-time)
```bash
curl -X POST http://localhost:8082/api/generate/card/stream \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "REST API Best Practices"
  }' -N
```

## 💻 Step 3: Integrate into Your App (2 minutes)

### JavaScript/Node.js
```javascript
// Install axios: npm install axios
const axios = require('axios');

async function generateWithClaude(topic) {
    const response = await axios.post('http://localhost:8082/api/generate/card', {
        topic: topic
    });
    return response.data;
}

// Use it
generateWithClaude('React Hooks').then(console.log);
```

### Python
```python
# Install requests: pip install requests
import requests

def generate_with_claude(topic):
    response = requests.post('http://localhost:8082/api/generate/card', 
                            json={'topic': topic})
    return response.json()

# Use it
result = generate_with_claude('Python Decorators')
print(result)
```

### React
```jsx
import { useState, useEffect } from 'react';

function ClaudeGenerator() {
    const [content, setContent] = useState(null);
    
    const generate = async (topic) => {
        const response = await fetch('http://localhost:8082/api/generate/card', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic })
        });
        const data = await response.json();
        setContent(data.data.content);
    };
    
    return (
        <button onClick={() => generate('Your Topic')}>
            Generate with Claude
        </button>
    );
}
```

## 🌊 Step 4: Try Streaming API (1 minute)

### Browser JavaScript (Server-Sent Events)
```javascript
const eventSource = new EventSource('/api/generate/card/stream');

eventSource.addEventListener('output', (event) => {
    const data = JSON.parse(event.data);
    console.log('Claude is typing:', data.data);
});

eventSource.addEventListener('completed', (event) => {
    const result = JSON.parse(event.data);
    console.log('Done!', result.content);
    eventSource.close();
});
```

### Python Streaming
```python
import sseclient  # pip install sseclient-py
import requests

response = requests.post('http://localhost:8082/api/generate/card/stream',
                         json={'topic': 'Docker Best Practices'},
                         stream=True)

client = sseclient.SSEClient(response)
for event in client.events():
    print(f"Event: {event.event}, Data: {event.data}")
```

## 🎉 Step 5: You're Done!

You now have Claude Code running as an API! Here's what you can do next:

### 🔥 Popular Use Cases

1. **Content Generation Platform**
   ```bash
   POST /api/generate/card
   Body: {"topic": "Your Blog Topic"}
   ```

2. **Educational Tool**
   ```bash
   POST /api/generate/card
   Body: {"topic": "Explain Quantum Computing"}
   ```

3. **Documentation Generator**
   ```bash
   POST /api/generate/card
   Body: {"topic": "API Documentation for X"}
   ```

## 📊 API Response Format

### Successful Response
```json
{
  "code": 200,
  "success": true,
  "data": {
    "topic": "Your Topic",
    "fileName": "generated_file.json",
    "content": {
      // Your generated content here
    },
    "generationTime": 45230
  }
}
```

### Streaming Events
```
event: start
data: {"topic":"Your Topic","timestamp":1234567890}

event: output
data: {"data":"Claude output...","timestamp":1234567891}

event: completed
data: {"content":{...},"generationTime":45000}
```

## 🛠️ Configuration Options

### Environment Variables
```bash
docker run -d -p 8082:6000 \
  -e API_TIMEOUT=300000 \        # 5 minutes timeout
  -e MAX_CONCURRENT=10 \          # Max concurrent sessions
  --name claude-code-api \
  aixier/ai-terminal:latest
```

### Custom Templates
```bash
# Mount your templates directory
docker run -d -p 8082:6000 \
  -v /your/templates:/app/data/public_template \
  aixier/ai-terminal:latest
```

## 🚨 Troubleshooting

### API Not Responding?
```bash
# Check if container is running
docker ps | grep claude-code-api

# Check logs
docker logs claude-code-api

# Restart container
docker restart claude-code-api
```

### Timeout Issues?
```javascript
// Increase timeout in your client
const response = await axios.post(url, data, {
    timeout: 300000  // 5 minutes
});
```

## 📚 Next Steps

- 📖 [Full API Documentation](CLAUDE_CODE_API.md)
- 💡 [Example Code](examples/claude-code-api/)
- 🎯 [Advanced Features](docs/api/README.md)
- 💬 [Get Help](https://github.com/aixier/AI_Terminal/issues)

## 🎊 Congratulations!

You've successfully deployed Claude Code as an API! Share your experience:

- ⭐ [Star the project](https://github.com/aixier/AI_Terminal)
- 🐦 Tweet about it with #ClaudeCodeAPI
- 💬 Join our [Discord](https://discord.gg/ai-terminal)

---

**Need help?** Open an issue on [GitHub](https://github.com/aixier/AI_Terminal/issues)