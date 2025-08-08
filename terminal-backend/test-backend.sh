#!/bin/bash

echo "=== 测试后端服务状态 ==="

# 1. 检查本地后端是否运行
echo -e "\n1. 检查本地后端服务 (localhost:3000):"
curl -s -o /dev/null -w "状态码: %{http_code}\n" http://localhost:3000/api/terminal/health || echo "本地后端未运行"

# 2. 测试本地登录接口
echo -e "\n2. 测试本地登录接口:"
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  -w "\n状态码: %{http_code}\n" \
  2>/dev/null | jq '.' 2>/dev/null || echo "登录接口无响应"

# 3. 测试云端访问
echo -e "\n3. 测试云端服务 (通过域名):"
curl -s -o /dev/null -w "状态码: %{http_code}\n" http://card.paitongai.com/api/terminal/health

echo -e "\n4. 测试云端登录:"
curl -X POST http://card.paitongai.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  -w "\n状态码: %{http_code}\n" \
  2>/dev/null

echo -e "\n=== 建议的 frp 配置 ==="
echo "如果使用 frp，确保 frpc.ini 包含："
cat << 'EOF'

# 前端映射
[web]
type = http
local_port = 5173
custom_domains = card.paitongai.com
host_header_rewrite = localhost

# 后端API映射 
[api]
type = http
local_port = 3000
custom_domains = card.paitongai.com
location = /api
host_header_rewrite = localhost

EOF

echo -e "\n如果使用 Nginx 反向代理，需要配置："
cat << 'EOF'

server {
    listen 80;
    server_name card.paitongai.com;

    # 前端
    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # 后端API
    location /api {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket
    location /socket.io {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

EOF