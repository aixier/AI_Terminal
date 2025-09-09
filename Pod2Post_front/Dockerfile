# Pod2Post Frontend - Optimized Multi-stage Dockerfile

# Stage 1: Build stage (if needed for future build processes)
FROM node:18-alpine AS builder
WORKDIR /build
# Placeholder for future build steps (webpack, etc.)
# Currently static files, no build needed

# Stage 2: Production stage - nginx
FROM nginx:alpine

# Environment variables
ENV NGINX_PORT=80 \
    NGINX_HOST=localhost \
    API_URL=http://cardapi.paitongai.com \
    WORKER_PROCESSES=auto \
    WORKER_CONNECTIONS=1024 \
    KEEPALIVE_TIMEOUT=65 \
    CLIENT_MAX_BODY_SIZE=100M \
    GZIP=on \
    GZIP_TYPES="text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/rss+xml application/atom+xml image/svg+xml text/x-js text/x-cross-domain-policy application/x-font-ttf application/x-font-opentype application/vnd.ms-fontobject image/x-icon"

# Labels
LABEL maintainer="Pod2Post" \
      version="1.0.0" \
      description="Pod2Post Frontend - Transform Podcasts into Visual Cards"

# Copy static files
COPY css /usr/share/nginx/html/css
COPY js /usr/share/nginx/html/js
COPY templates /usr/share/nginx/html/templates
COPY config /usr/share/nginx/html/config
COPY assets /usr/share/nginx/html/assets
COPY index.html /usr/share/nginx/html/

# Nginx configuration template
RUN echo 'user nginx; \
worker_processes ${WORKER_PROCESSES}; \
error_log /var/log/nginx/error.log warn; \
pid /var/run/nginx.pid; \
\
events { \
    worker_connections ${WORKER_CONNECTIONS}; \
    use epoll; \
    multi_accept on; \
} \
\
http { \
    include /etc/nginx/mime.types; \
    default_type application/octet-stream; \
\
    # Logging \
    log_format main '\''$remote_addr - $remote_user [$time_local] "$request" '\'' \
                    '\''$status $body_bytes_sent "$http_referer" '\'' \
                    '\''"$http_user_agent" "$http_x_forwarded_for"'\''; \
    access_log /var/log/nginx/access.log main; \
\
    # Performance \
    sendfile on; \
    tcp_nopush on; \
    tcp_nodelay on; \
    keepalive_timeout ${KEEPALIVE_TIMEOUT}; \
    types_hash_max_size 2048; \
    client_max_body_size ${CLIENT_MAX_BODY_SIZE}; \
\
    # Gzip \
    gzip ${GZIP}; \
    gzip_vary on; \
    gzip_proxied any; \
    gzip_comp_level 6; \
    gzip_types ${GZIP_TYPES}; \
\
    # Security headers \
    add_header X-Frame-Options "SAMEORIGIN" always; \
    add_header X-Content-Type-Options "nosniff" always; \
    add_header X-XSS-Protection "1; mode=block" always; \
\
    server { \
        listen ${NGINX_PORT}; \
        server_name ${NGINX_HOST}; \
        root /usr/share/nginx/html; \
        index index.html; \
\
        # SPA routing \
        location / { \
            try_files $uri $uri/ /index.html; \
            \
            # Cache control for HTML \
            add_header Cache-Control "no-cache, no-store, must-revalidate"; \
            add_header Pragma "no-cache"; \
            add_header Expires "0"; \
        } \
\
        # Static assets caching \
        location ~* \.(css|js|jpg|jpeg|png|gif|ico|svg|woff|woff2|ttf|eot)$ { \
            expires 30d; \
            add_header Cache-Control "public, immutable"; \
        } \
\
        # API proxy (optional) \
        location /api/ { \
            proxy_pass ${API_URL}; \
            proxy_http_version 1.1; \
            proxy_set_header Upgrade $http_upgrade; \
            proxy_set_header Connection '\''upgrade'\''; \
            proxy_set_header Host $host; \
            proxy_cache_bypass $http_upgrade; \
            proxy_set_header X-Real-IP $remote_addr; \
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; \
            proxy_set_header X-Forwarded-Proto $scheme; \
            \
            # CORS headers \
            add_header '\''Access-Control-Allow-Origin'\'' '\''*'\'' always; \
            add_header '\''Access-Control-Allow-Methods'\'' '\''GET, POST, PUT, DELETE, OPTIONS'\'' always; \
            add_header '\''Access-Control-Allow-Headers'\'' '\''DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization'\'' always; \
            add_header '\''Access-Control-Expose-Headers'\'' '\''Content-Length,Content-Range'\'' always; \
            \
            if ($request_method = '\''OPTIONS'\'') { \
                add_header '\''Access-Control-Allow-Origin'\'' '\''*'\''; \
                add_header '\''Access-Control-Allow-Methods'\'' '\''GET, POST, PUT, DELETE, OPTIONS'\''; \
                add_header '\''Access-Control-Allow-Headers'\'' '\''DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization'\''; \
                add_header '\''Access-Control-Max-Age'\'' 1728000; \
                add_header '\''Content-Type'\'' '\''text/plain; charset=utf-8'\''; \
                add_header '\''Content-Length'\'' 0; \
                return 204; \
            } \
        } \
\
        # Health check \
        location /health { \
            access_log off; \
            add_header '\''Content-Type'\'' '\''application/json'\''; \
            return 200 '\''{"status":"healthy"}'\''; \
        } \
\
        # Error pages \
        error_page 404 /404.html; \
        error_page 500 502 503 504 /50x.html; \
        location = /50x.html { \
            root /usr/share/nginx/html; \
        } \
    } \
}' > /etc/nginx/nginx.conf

# Create entrypoint script for environment variable substitution
RUN echo '#!/bin/sh \
set -e \
\
# Substitute environment variables in nginx config \
envsubst '\''${WORKER_PROCESSES} ${WORKER_CONNECTIONS} ${KEEPALIVE_TIMEOUT} ${CLIENT_MAX_BODY_SIZE} ${GZIP} ${GZIP_TYPES} ${NGINX_PORT} ${NGINX_HOST} ${API_URL}'\'' < /etc/nginx/nginx.conf > /etc/nginx/nginx.conf.tmp \
mv /etc/nginx/nginx.conf.tmp /etc/nginx/nginx.conf \
\
# Update API URL in config.js if provided \
if [ ! -z "$API_URL" ]; then \
    sed -i "s|http://cardapi.paitongai.com|${API_URL}|g" /usr/share/nginx/html/config/config.js \
fi \
\
# Start nginx \
exec nginx -g '\''daemon off;'\''' > /docker-entrypoint.sh

# Make entrypoint executable
RUN chmod +x /docker-entrypoint.sh

# Create placeholder directories for assets if they don't exist
RUN mkdir -p /usr/share/nginx/html/assets/images /usr/share/nginx/html/assets/icons

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${NGINX_PORT}/health || exit 1

# Expose port
EXPOSE ${NGINX_PORT}

# Use the entrypoint script
ENTRYPOINT ["/docker-entrypoint.sh"]