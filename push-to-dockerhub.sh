#!/bin/bash

# Docker Hub Push Script for AI Terminal
# Usage: ./push-to-dockerhub.sh [username] [password]

echo "🐳 AI Terminal - Docker Hub Push Script"
echo "========================================"

# Docker Hub username (可以通过参数传入或设置环境变量)
DOCKER_USERNAME=${1:-$DOCKER_HUB_USERNAME}
DOCKER_PASSWORD=${2:-$DOCKER_HUB_PASSWORD}

# 如果没有提供用户名，提示用户输入
if [ -z "$DOCKER_USERNAME" ]; then
    read -p "Enter Docker Hub username: " DOCKER_USERNAME
fi

# 如果没有提供密码，提示用户输入
if [ -z "$DOCKER_PASSWORD" ]; then
    read -s -p "Enter Docker Hub password: " DOCKER_PASSWORD
    echo
fi

# 登录 Docker Hub
echo "🔐 Logging into Docker Hub..."
echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_USERNAME" --password-stdin

if [ $? -ne 0 ]; then
    echo "❌ Docker Hub login failed!"
    exit 1
fi

echo "✅ Successfully logged into Docker Hub"

# 构建镜像（如果还没构建）
echo "🏗️ Building Docker images..."
docker build -t aixier/ai-terminal:latest -t aixier/ai-terminal:v3.9 .

if [ $? -ne 0 ]; then
    echo "❌ Docker build failed!"
    exit 1
fi

echo "✅ Docker images built successfully"

# 推送镜像
echo "📤 Pushing images to Docker Hub..."

# 推送 latest 标签
echo "Pushing aixier/ai-terminal:latest..."
docker push aixier/ai-terminal:latest

if [ $? -ne 0 ]; then
    echo "❌ Failed to push latest tag!"
    exit 1
fi

# 推送版本标签
echo "Pushing aixier/ai-terminal:v2.5..."
docker push aixier/ai-terminal:v2.5

if [ $? -ne 0 ]; then
    echo "❌ Failed to push v2.5 tag!"
    exit 1
fi

echo "✅ All images pushed successfully!"

# 验证推送
echo "🔍 Verifying push..."
docker pull aixier/ai-terminal:latest > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Verification successful - Image is available on Docker Hub!"
else
    echo "⚠️ Could not verify image availability"
fi

# 显示镜像信息
echo ""
echo "📊 Image Information:"
docker images aixier/ai-terminal --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"

echo ""
echo "🎉 Docker Hub push complete!"
echo ""
echo "Users can now run:"
echo "  docker run -d -p 8082:6000 aixier/ai-terminal:latest"
echo ""
echo "Docker Hub URL: https://hub.docker.com/r/aixier/ai-terminal"