# Pod2Post Frontend

Transform your podcast episodes into shareable visual cards with AI.

## 🚀 Quick Start with Docker

### Build and Run

```bash
# Build image
docker build -t pod2post-frontend .

# Run with default settings (port 80)
docker run -d -p 80:80 --name pod2post pod2post-frontend

# Run with custom port
docker run -d -p 8080:80 --name pod2post pod2post-frontend

# Run with custom API endpoint
docker run -d -p 8080:80 \
  -e API_URL=http://your-api-server:8083 \
  --name pod2post \
  pod2post-frontend
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NGINX_PORT` | 80 | Nginx listening port |
| `NGINX_HOST` | localhost | Server hostname |
| `API_URL` | http://cardapi.paitongai.com | Backend API URL |
| `WORKER_PROCESSES` | auto | Nginx worker processes |
| `WORKER_CONNECTIONS` | 1024 | Max connections per worker |
| `KEEPALIVE_TIMEOUT` | 65 | Keep-alive timeout (seconds) |
| `CLIENT_MAX_BODY_SIZE` | 100M | Max upload size |
| `GZIP` | on | Enable gzip compression |

### Examples

#### Production deployment
```bash
docker run -d \
  -p 443:80 \
  -e API_URL=https://api.pod2post.com \
  -e NGINX_HOST=pod2post.com \
  -e CLIENT_MAX_BODY_SIZE=200M \
  --restart=always \
  --name pod2post-prod \
  pod2post-frontend
```

#### Development with local API
```bash
docker run -d \
  -p 3000:80 \
  -e API_URL=http://host.docker.internal:8083 \
  --name pod2post-dev \
  pod2post-frontend
```

#### With Docker network
```bash
# Create network
docker network create pod2post-network

# Run backend
docker run -d \
  --network pod2post-network \
  --name pod2post-api \
  pod2post-backend

# Run frontend
docker run -d \
  -p 80:80 \
  --network pod2post-network \
  -e API_URL=http://pod2post-api:8083 \
  --name pod2post-web \
  pod2post-frontend
```

## 🏗️ Docker Features

- **Multi-stage build** - Optimized for size
- **Alpine Linux** - Minimal base image (~25MB)
- **Environment configuration** - All settings via env vars
- **Health checks** - Built-in health monitoring
- **Gzip compression** - Enabled by default
- **Security headers** - XSS, clickjacking protection
- **Static asset caching** - 30-day cache for assets
- **API proxy** - Optional API gateway
- **CORS handling** - Configured for API calls

## 📦 Image Size

- Base image: ~25MB (nginx:alpine)
- Total size: ~30MB (with all assets)

## 🔍 Health Check

```bash
# Check container health
docker inspect --format='{{.State.Health.Status}}' pod2post

# View health logs
docker inspect --format='{{json .State.Health}}' pod2post | jq

# Manual health check
curl http://localhost/health
```

## 🛠️ Troubleshooting

```bash
# View logs
docker logs pod2post

# Access container shell
docker exec -it pod2post sh

# Check nginx config
docker exec pod2post nginx -t

# Reload nginx config
docker exec pod2post nginx -s reload
```

## 📊 Performance Tuning

For high traffic, adjust these variables:

```bash
docker run -d \
  -p 80:80 \
  -e WORKER_PROCESSES=4 \
  -e WORKER_CONNECTIONS=2048 \
  -e KEEPALIVE_TIMEOUT=120 \
  --name pod2post \
  pod2post-frontend
```

## 🔒 Security

The Docker image includes:
- Non-root nginx user
- Security headers (X-Frame-Options, X-Content-Type-Options, X-XSS-Protection)
- No unnecessary packages
- Alpine Linux base for minimal attack surface

## 📝 License

MIT