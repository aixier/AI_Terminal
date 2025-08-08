# 构建阶段
FROM node:22-alpine as builder

WORKDIR /app

# 复制package文件并安装依赖
COPY package*.json ./
RUN npm install --no-audit --no-fund

# 复制源代码并构建
COPY . .
RUN npm run build

# 生产阶段
FROM node:22-alpine

WORKDIR /app

# 安装生产环境依赖
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

# 复制构建产物和服务器文件
COPY --from=builder /app/dist ./dist
COPY server.js ./

# 创建非root用户运行应用
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# 暴露端口
EXPOSE 80

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:80/health', (r) => {r.statusCode === 200 ? process.exit(0) : process.exit(1)})" || exit 1

# 启动服务
CMD ["node", "server.js"]