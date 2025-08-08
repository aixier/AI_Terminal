#!/bin/bash
set -e

# 配置变量
DOCKERHUB_USERNAME="coopotfan"  # Docker Hub用户名
VERSION="0.2"

echo "🐳 开始推送AI Terminal镜像到Docker Hub..."
echo "📌 版本: $VERSION"
echo "👤 用户: $DOCKERHUB_USERNAME"

# 登录检查 - 简化版本，直接尝试推送验证
echo "📝 验证Docker Hub登录状态..."
echo "✅ 跳过登录检查，直接尝试推送（如果失败会提示登录）"

echo "🏷️  重新打标镜像..."
# 前端镜像
echo "  📦 标记前端镜像..."
docker tag terminal-ui:$VERSION $DOCKERHUB_USERNAME/ai-terminal-ui:$VERSION
docker tag terminal-ui:$VERSION $DOCKERHUB_USERNAME/ai-terminal-ui:latest

# 后端镜像  
echo "  📦 标记后端镜像..."
docker tag terminal-backend:$VERSION $DOCKERHUB_USERNAME/ai-terminal-backend:$VERSION
docker tag terminal-backend:$VERSION $DOCKERHUB_USERNAME/ai-terminal-backend:latest

echo "🚀 推送前端镜像到公共仓库..."
docker push $DOCKERHUB_USERNAME/ai-terminal-ui:$VERSION
docker push $DOCKERHUB_USERNAME/ai-terminal-ui:latest

echo "🚀 推送后端镜像到公共仓库..."
docker push $DOCKERHUB_USERNAME/ai-terminal-backend:$VERSION
docker push $DOCKERHUB_USERNAME/ai-terminal-backend:latest

echo "✅ 所有镜像推送完成！"
echo ""
echo "📋 公共镜像信息："
echo "   🖥️  前端: $DOCKERHUB_USERNAME/ai-terminal-ui:$VERSION"
echo "   ⚙️  后端: $DOCKERHUB_USERNAME/ai-terminal-backend:$VERSION"
echo ""
echo "🌐 Docker Hub仓库："
echo "   https://hub.docker.com/r/$DOCKERHUB_USERNAME/ai-terminal-ui"
echo "   https://hub.docker.com/r/$DOCKERHUB_USERNAME/ai-terminal-backend"
echo ""
echo "🚀 任何人现在都可以使用："
echo "   docker pull $DOCKERHUB_USERNAME/ai-terminal-ui:latest"
echo "   docker pull $DOCKERHUB_USERNAME/ai-terminal-backend:latest"