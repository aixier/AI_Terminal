#!/bin/bash

echo "================================"
echo "配置 HTTPS 访问"
echo "================================"

# 1. 安装 Nginx(如果未安装)
if ! command -v nginx &> /dev/null; then
    echo "正在安装 Nginx..."
    apt update && apt install nginx -y
else
    echo "Nginx 已安装"
fi

# 2. 检查证书文件
if [ ! -f "/etc/nginx/ssl/card.paitongai.com.pem" ]; then
    echo "错误: 证书文件不存在!"
    exit 1
fi

if [ ! -f "/etc/nginx/ssl/card.paitongai.com.key" ]; then
    echo "错误: 密钥文件不存在!"
    exit 1
fi

echo "证书文件检查通过"

# 3. 检查 80 端口占用情况
echo "检查端口占用..."
netstat -tlnp | grep :80

# 4. 停止旧容器并重新映射端口
echo "重新配置 Docker 容器端口..."

# 删除已存在的容器(无论是否运行)
if docker ps -a | grep -q ai_terminal_container; then
    echo "删除现有容器..."
    docker stop ai_terminal_container 2>/dev/null || true
    docker rm ai_terminal_container 2>/dev/null || true
fi

# 启动容器,映射到 9080 端口(避免端口冲突)
echo "启动容器到 9080 端口..."
docker run -d \
  -p 9080:6009 \
  --name ai_terminal_container \
  --restart unless-stopped \
  -v /data/ai-terminal:/app/data \
  -v /logs/ai-terminal:/app/logs \
  registry.cn-hangzhou.aliyuncs.com/pentron_docker/ai-terminal-01:v4.8.27

# 等待容器启动
echo "等待容器启动..."
sleep 3

# 5. 创建 Nginx 配置
echo "创建 Nginx 配置文件..."
cat > /etc/nginx/sites-enabled/default << 'NGINX_EOF'
server {
    listen 80;
    server_name card.paitongai.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name card.paitongai.com;

    ssl_certificate /etc/nginx/ssl/card.paitongai.com.pem;
    ssl_certificate_key /etc/nginx/ssl/card.paitongai.com.key;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # 增加上传大小限制到 100MB
    client_max_body_size 100M;

    location / {
        proxy_pass http://localhost:9080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io {
        proxy_pass http://localhost:9080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    location /ws {
        proxy_pass http://localhost:9080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGINX_EOF

# 6. 测试配置
echo "测试 Nginx 配置..."
nginx -t

if [ $? -ne 0 ]; then
    echo "配置文件有错误,请检查!"
    exit 1
fi

# 7. 重启 Nginx
echo "重启 Nginx..."
systemctl restart nginx

# 8. 显示状态
echo ""
echo "Docker 容器状态:"
docker ps | grep ai_terminal

echo ""
echo "Nginx 状态:"
systemctl status nginx --no-pager -l

echo ""
echo "================================"
echo "配置完成!"
echo "================================"
echo "Docker 容器端口: 9080"
echo "Nginx HTTP: 80 (自动重定向到 HTTPS)"
echo "Nginx HTTPS: 443"
echo ""
echo "现在可以访问: https://card.paitongai.com"
echo ""
echo "测试命令:"
echo "  curl https://card.paitongai.com/health"
echo "  curl -I http://card.paitongai.com (测试重定向)"
