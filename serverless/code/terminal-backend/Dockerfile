# 使用Node.js 22版本的Alpine镜像
FROM node:22-alpine

# 设置环境变量（生产环境配置）
ENV NODE_ENV=production \
    PORT=6000 \
    LOG_LEVEL=info \
    # JWT配置
    JWT_SECRET=mvp-jwt-secret-2025 \
    JWT_EXPIRE_TIME=24h \
    # 终端配置
    MAX_TERMINAL_SESSIONS=10 \
    TERMINAL_TIMEOUT=600000 \
    # CORS配置 - 支持云环境和本地开发
    ALLOWED_ORIGINS="http://localhost,http://localhost:*,http://127.0.0.1:*,http://0.0.0.0:*,http://aicard.paitongai.com,https://aicard.paitongai.com" \
    # 路径配置
    DATA_PATH=/app/data \
    LOG_PATH=/app/logs \
    STATIC_PATH=/app/static \
    SERVE_STATIC=true \
    # Claude API配置（需要在运行时通过-e参数提供）
    ANTHROPIC_AUTH_TOKEN=${ANTHROPIC_AUTH_TOKEN} \
    ANTHROPIC_BASE_URL=${ANTHROPIC_BASE_URL:-http://3.91.230.6:3000/api/} \
    # 其他配置
    HOME=/home/nodeuser \
    LANG=en_US.UTF-8

# 安装必要的系统依赖
# python3, make, g++ 用于编译原生Node模块
# git 用于某些npm包的安装
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    bash \
    sudo

# 创建非root用户和组
# 检查并创建用户，如果GID 1000已存在则使用不同的GID
RUN if ! getent group 1000 >/dev/null 2>&1; then \
        addgroup -g 1000 -S nodeuser; \
    else \
        addgroup -S nodeuser; \
    fi && \
    adduser -u 1000 -S nodeuser -G nodeuser 2>/dev/null || \
    adduser -S nodeuser -G nodeuser

# 设置工作目录并确保正确的所有权
WORKDIR /app
RUN chown nodeuser:nodeuser /app

# 复制package文件并设置正确的所有权
COPY --chown=nodeuser:nodeuser package*.json ./

# 安装Claude Code CLI工具（以root用户全局安装）
RUN npm install -g @anthropic-ai/claude-code && \
    # 修复npm缓存权限问题
    chown -R nodeuser:nodeuser /home/nodeuser/.npm

# 切换到非root用户并安装项目依赖
USER nodeuser
RUN npm ci --only=production

# 切换回root用户复制应用代码
USER root
COPY --chown=nodeuser:nodeuser . .

# 复制src/data目录内容到容器内的data目录（系统配置文件）
# 这包含了系统配置、命令配置、用户设置模板等重要文件
COPY --chown=nodeuser:nodeuser src/data/. /app/data/

# 复制根目录的data目录内容（用户数据和模板）
# 这包含了公共模板和示例卡片数据
COPY --chown=nodeuser:nodeuser data/. /app/data/

# 创建必要的数据目录并设置权限（容器内部持久化）
RUN mkdir -p /app/data/users/default/folders/default-folder/cards && \
    mkdir -p /app/data/public_template && \
    mkdir -p /app/data/history && \
    mkdir -p /app/logs && \
    # 确保nodeuser拥有这些目录
    chown -R nodeuser:nodeuser /app/data /app/logs && \
    # 设置适当的权限
    chmod -R 755 /app/data && \
    chmod -R 755 /app/logs

# 如果metadata.json不存在，创建初始数据结构
RUN if [ ! -f /app/data/users/default/folders/default-folder/metadata.json ]; then \
        echo '{"id":"default-folder","name":"默认文件夹","description":"默认卡片文件夹","cardCount":0,"color":"#0078d4"}' > /app/data/users/default/folders/default-folder/metadata.json; \
    fi && \
    chown nodeuser:nodeuser /app/data/users/default/folders/default-folder/metadata.json

# 暴露端口
EXPOSE 6000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:6000/api/terminal/health', (r) => {r.statusCode === 200 ? process.exit(0) : process.exit(1)})" || exit 1

# 使用非root用户运行应用
USER nodeuser

# 启动应用
CMD ["node", "src/index.js"]