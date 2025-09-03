# ============================
# Stage 1: Build Frontend (terminal-ui)
# ============================
FROM node:22-alpine AS ui-builder

WORKDIR /build/ui

# Install deps (cache npm)
COPY terminal-ui/package*.json ./
RUN --mount=type=cache,target=/root/.npm npm install --no-audit --no-fund

# Build
COPY terminal-ui .
RUN npm run build

# ============================
# Stage 2: Install Backend deps (terminal-backend)
# ============================
FROM node:22-alpine AS backend-builder

# build tools for native modules like node-pty
RUN apk add --no-cache python3 make g++ git

WORKDIR /build/backend

# Install deps (prod only, cache npm)
COPY terminal-backend/package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --no-audit --no-fund

# Copy source
COPY terminal-backend .

# ============================
# Final Stage: Runtime
# ============================
FROM node:22-alpine

# Runtime extras
RUN apk add --no-cache bash tini git

# Use pre-existing non-root 'node' user provided by base image
# (Avoids GID/UID conflicts like "addgroup: gid '1000' in use")
USER root

# App root
WORKDIR /app

# Environment (keep run command simple)
ENV NODE_ENV=production \
    PORT=6000 \
    LOG_LEVEL=info \
    JWT_EXPIRE_TIME=24h \
    MAX_TERMINAL_SESSIONS=10 \
    TERMINAL_TIMEOUT=600000 \
    ALLOWED_ORIGINS=http://localhost,http://localhost:*,http://127.0.0.1:*,http://0.0.0.0:*,http://aicard.paitongai.com,https://aicard.paitongai.com,http://8.130.86.152:* \
    DATA_PATH=/app/data \
    LOG_PATH=/app/logs \
    STATIC_PATH=/app/static \
    SERVE_STATIC=true \
    UV_THREADPOOL_SIZE=4

# Note: Sensitive environment variables should be provided at runtime:
# JWT_SECRET, ANTHROPIC_AUTH_TOKEN, ANTHROPIC_BASE_URL, GEMINI_API_KEY

# Global tools (requested)
RUN npm install -g @anthropic-ai/claude-code @google/gemini-cli && npm cache clean --force

# Copy backend runtime files
COPY --from=backend-builder --chown=node:node /build/backend/node_modules ./terminal-backend/node_modules
COPY --from=backend-builder --chown=node:node /build/backend/package*.json ./terminal-backend/
COPY --from=backend-builder --chown=node:node /build/backend/src ./terminal-backend/src

# Copy data files from backend-builder
# src/data contains system config files
COPY --from=backend-builder --chown=node:node /build/backend/src/data/. ./data/
# data directory contains public templates and example cards
COPY --from=backend-builder --chown=node:node /build/backend/data/. ./data/

# Copy built frontend to static path to be served by backend
COPY --from=ui-builder --chown=node:node /build/ui/dist ./static

# Create data/logs and initial structure
RUN mkdir -p /app/data/users/default/folders/default-folder/cards \
 && mkdir -p /app/data/users/default/workspace/card \
 && mkdir -p /app/data/public_template \
 && mkdir -p /app/data/history \
 && mkdir -p /app/logs \
 && chown -R node:node /app

# Create initial metadata.json if not exists
RUN if [ ! -f /app/data/users/default/folders/default-folder/metadata.json ]; then \
    echo '{"id":"default-folder","name":"默认文件夹","description":"默认卡片文件夹","cardCount":0,"color":"#0078d4","createdAt":"2025-01-06T00:00:00.000Z","updatedAt":"2025-01-06T00:00:00.000Z"}' > /app/data/users/default/folders/default-folder/metadata.json; \
    fi && \
    chown node:node /app/data/users/default/folders/default-folder/metadata.json

# Network
EXPOSE 6000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://localhost:6000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Set NODE_PATH for global modules
ENV NODE_PATH="/usr/local/lib/node_modules"

# Note: Sensitive environment variables (JWT_SECRET, ANTHROPIC_AUTH_TOKEN, 
# ANTHROPIC_BASE_URL, GEMINI_API_KEY) should be provided at runtime

WORKDIR /app/terminal-backend

# Drop privileges
USER node

# Use tini for PID 1
ENTRYPOINT ["/sbin/tini", "--"]

# Run
CMD ["node", "src/index.js"]
