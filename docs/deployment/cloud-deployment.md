# ☁️ 云平台部署指南

本指南介绍如何在各主流云平台上部署AI Terminal，包括完整的配置和最佳实践。

## 🌟 平台选择对比

| 平台 | 优势 | 适用场景 | 成本 |
|------|------|----------|------|
| 阿里云FC | 🇨🇳 国内访问快 | 中国用户为主 | 按量付费 |
| AWS Lambda | 🌍 全球覆盖 | 国际化应用 | 按量付费 |
| Vercel | 🚀 简单易用 | 前端为主 | 免费层 |
| Docker平台 | 🐳 标准化 | 企业部署 | 固定成本 |

## 🅰️ 阿里云函数计算 (FC)

### 📋 部署准备

**安装工具**:
```bash
npm install -g @serverless-devs/s
s config add --AccessKeyID your-access-key --AccessKeySecret your-secret
```

**项目配置**:
```yaml
# s.yaml
edition: 1.0.0
name: ai-terminal
access: default

services:
  ai-terminal:
    component: fc
    props:
      region: cn-hangzhou
      service:
        name: ai-terminal-service
        description: AI Terminal 服务
        runtime: nodejs18
        memorySize: 1024
        timeout: 300
        environmentVariables:
          NODE_ENV: production
          ANTHROPIC_AUTH_TOKEN: ${env(ANTHROPIC_AUTH_TOKEN)}
          ANTHROPIC_BASE_URL: ${env(ANTHROPIC_BASE_URL)}
      
      function:
        name: ai-terminal-function
        handler: index.handler
        codeUri: ./
        
      triggers:
        - name: httpTrigger
          type: http
          config:
            authType: anonymous
            methods:
              - GET
              - POST
              - PUT
              - DELETE
```

**部署命令**:
```bash
# 构建并部署
npm run build
s deploy

# 查看部署状态
s info

# 查看日志
s logs
```

### 🔧 配置优化

**内存和超时设置**:
```yaml
# 根据使用情况调整
memorySize: 1024    # 1GB内存
timeout: 300        # 5分钟超时
instanceConcurrency: 10  # 并发实例数
```

**环境变量管理**:
```bash
# 使用阿里云参数存储
s env set ANTHROPIC_AUTH_TOKEN your-token --region cn-hangzhou
```

## 🅰️ Amazon Web Services (AWS)

### 📦 AWS Lambda + API Gateway

**Serverless Framework配置**:
```yaml
# serverless.yml
service: ai-terminal

provider:
  name: aws
  runtime: nodejs18.x
  region: us-west-2
  memorySize: 1024
  timeout: 300
  environment:
    NODE_ENV: production
    ANTHROPIC_AUTH_TOKEN: ${ssm:ANTHROPIC_AUTH_TOKEN}
    ANTHROPIC_BASE_URL: ${ssm:ANTHROPIC_BASE_URL}
  
  iamRoleStatements:
    - Effect: Allow
      Action:
        - ssm:GetParameter
      Resource: "*"

functions:
  api:
    handler: dist/lambda.handler
    events:
      - http:
          path: /{proxy+}
          method: ANY
          cors: true

plugins:
  - serverless-webpack
  - serverless-offline

custom:
  webpack:
    webpackConfig: 'webpack.config.js'
    includeModules: true
```

**部署脚本**:
```bash
# 安装依赖
npm install -g serverless
npm install

# 配置AWS凭证
aws configure

# 部署
serverless deploy

# 查看状态
serverless info

# 查看日志
serverless logs -f api
```

### 🗄️ AWS ECS (容器服务)

**任务定义**:
```json
{
  "family": "ai-terminal",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "ai-terminal",
      "image": "your-account.dkr.ecr.region.amazonaws.com/ai-terminal:latest",
      "portMappings": [
        {
          "containerPort": 6000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "ANTHROPIC_AUTH_TOKEN",
          "valueFrom": "arn:aws:ssm:region:account:parameter/ai-terminal/anthropic-token"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/ai-terminal",
          "awslogs-region": "us-west-2",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

## ▶️ Vercel 部署

### 🚀 前端部署

**配置文件**:
```json
// vercel.json
{
  "version": 2,
  "builds": [
    {
      "src": "terminal-ui/package.json",
      "use": "@vercel/static-build",
      "config": {
        "buildCommand": "npm run build",
        "outputDirectory": "dist"
      }
    },
    {
      "src": "terminal-backend/src/index.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/terminal-backend/src/index.js"
    },
    {
      "src": "/(.*)",
      "dest": "/terminal-ui/dist/$1"
    }
  ],
  "env": {
    "NODE_ENV": "production",
    "ANTHROPIC_AUTH_TOKEN": "@anthropic-auth-token",
    "ANTHROPIC_BASE_URL": "@anthropic-base-url"
  }
}
```

**部署命令**:
```bash
# 安装Vercel CLI
npm install -g vercel

# 登录
vercel login

# 部署
vercel --prod

# 设置环境变量
vercel env add ANTHROPIC_AUTH_TOKEN
vercel env add ANTHROPIC_BASE_URL
```

## 🔷 Microsoft Azure

### 🌐 Azure Container Apps

**配置文件**:
```yaml
# azure-container-app.yaml
apiVersion: 2022-03-01
location: East US
name: ai-terminal
properties:
  managedEnvironmentId: /subscriptions/{subscription-id}/resourceGroups/{resource-group}/providers/Microsoft.App/managedEnvironments/{environment-name}
  configuration:
    secrets:
      - name: anthropic-token
        value: your-anthropic-token
    ingress:
      external: true
      targetPort: 6000
  template:
    containers:
      - name: ai-terminal
        image: your-registry/ai-terminal:latest
        env:
          - name: NODE_ENV
            value: production
          - name: ANTHROPIC_AUTH_TOKEN
            secretRef: anthropic-token
        resources:
          cpu: 0.5
          memory: 1Gi
    scale:
      minReplicas: 0
      maxReplicas: 10
```

**部署命令**:
```bash
# 登录Azure
az login

# 创建资源组
az group create --name ai-terminal-rg --location eastus

# 部署容器应用
az containerapp create \
  --resource-group ai-terminal-rg \
  --name ai-terminal \
  --image your-registry/ai-terminal:latest \
  --target-port 6000 \
  --ingress external \
  --env-vars NODE_ENV=production \
  --secrets anthropic-token=your-token
```

## 🐳 通用Docker部署

### 🏗️ 多云平台Docker部署

**通用部署脚本**:
```bash
#!/bin/bash
# deploy.sh

# 构建镜像
docker build -t ai-terminal:latest .

# 标记镜像
docker tag ai-terminal:latest your-registry/ai-terminal:latest

# 推送到镜像仓库
docker push your-registry/ai-terminal:latest

# 部署到目标平台
case "$DEPLOY_TARGET" in
  "aws")
    # AWS ECS部署
    aws ecs update-service --cluster ai-terminal --service ai-terminal --force-new-deployment
    ;;
  "azure")
    # Azure Container Instances部署
    az container restart --resource-group ai-terminal-rg --name ai-terminal
    ;;
  "gcp")
    # Google Cloud Run部署
    gcloud run deploy ai-terminal --image your-registry/ai-terminal:latest --platform managed --region us-central1
    ;;
  *)
    echo "Unknown deployment target: $DEPLOY_TARGET"
    exit 1
    ;;
esac
```

### 🔧 Docker Compose (通用)

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  ai-terminal:
    image: your-registry/ai-terminal:latest
    ports:
      - "80:6000"
    environment:
      - NODE_ENV=production
      - ANTHROPIC_AUTH_TOKEN=${ANTHROPIC_AUTH_TOKEN}
      - ANTHROPIC_BASE_URL=${ANTHROPIC_BASE_URL}
    volumes:
      - ai-terminal-data:/app/data
      - ai-terminal-logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:6000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M

  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - ai-terminal
    restart: unless-stopped

volumes:
  ai-terminal-data:
  ai-terminal-logs:
```

## 📊 监控和日志

### 🔍 CloudWatch (AWS)

```javascript
// 集成CloudWatch
import AWS from 'aws-sdk'

const cloudwatch = new AWS.CloudWatch()

export const logMetric = async (metricName, value, unit = 'Count') => {
  const params = {
    Namespace: 'AI-Terminal',
    MetricData: [
      {
        MetricName: metricName,
        Value: value,
        Unit: unit,
        Timestamp: new Date()
      }
    ]
  }
  
  await cloudwatch.putMetricData(params).promise()
}
```

### 📈 Azure Monitor

```javascript
// 集成Azure Application Insights
import appInsights from 'applicationinsights'

appInsights.setup(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING)
  .setAutoDependencyCorrelation(true)
  .setAutoCollectRequests(true)
  .setAutoCollectPerformance(true)
  .setAutoCollectExceptions(true)
  .start()

export const trackEvent = (name, properties) => {
  appInsights.defaultClient.trackEvent({
    name,
    properties
  })
}
```

## 🔒 安全最佳实践

### 🛡️ 网络安全

**API网关配置**:
```yaml
# AWS API Gateway
securityDefinitions:
  api_key:
    type: apiKey
    name: x-api-key
    in: header

paths:
  /{proxy+}:
    x-amazon-apigateway-any-method:
      security:
        - api_key: []
      x-amazon-apigateway-integration:
        type: aws_proxy
        httpMethod: POST
        uri: arn:aws:apigateway:region:lambda:path/2015-03-31/functions/function-arn/invocations
```

**WAF规则** (Web Application Firewall):
```json
{
  "Rules": [
    {
      "Name": "SQLInjectionRule",
      "Priority": 1,
      "Statement": {
        "SqliMatchStatement": {
          "FieldToMatch": {
            "AllQueryArguments": {}
          },
          "TextTransformations": [
            {
              "Priority": 0,
              "Type": "URL_DECODE"
            }
          ]
        }
      },
      "Action": {
        "Block": {}
      }
    }
  ]
}
```

### 🔐 环境变量安全

**AWS Systems Manager**:
```bash
# 存储敏感配置
aws ssm put-parameter \
  --name "/ai-terminal/anthropic-token" \
  --value "your-token" \
  --type "SecureString"

# 在Lambda中读取
const token = await ssm.getParameter({
  Name: '/ai-terminal/anthropic-token',
  WithDecryption: true
}).promise()
```

**Azure Key Vault**:
```bash
# 创建密钥库
az keyvault create \
  --name ai-terminal-vault \
  --resource-group ai-terminal-rg

# 存储密钥
az keyvault secret set \
  --vault-name ai-terminal-vault \
  --name anthropic-token \
  --value your-token
```

## 🚀 CI/CD 部署流水线

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy to Cloud

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build application
      run: npm run build
    
    - name: Deploy to AWS
      if: contains(github.ref, 'aws')
      run: |
        npm install -g serverless
        serverless deploy
      env:
        AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
        AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
    
    - name: Deploy to Vercel
      if: contains(github.ref, 'vercel')
      run: |
        npm install -g vercel
        vercel --prod --token ${{ secrets.VERCEL_TOKEN }}
    
    - name: Deploy to Aliyun
      if: contains(github.ref, 'aliyun')
      run: |
        npm install -g @serverless-devs/s
        s deploy
      env:
        ALIBABA_CLOUD_ACCESS_KEY_ID: ${{ secrets.ALIBABA_ACCESS_KEY }}
        ALIBABA_CLOUD_ACCESS_KEY_SECRET: ${{ secrets.ALIBABA_SECRET_KEY }}
```

## 💰 成本优化

### 📊 成本对比

| 平台 | 月访问量1万 | 月访问量10万 | 月访问量100万 |
|------|-------------|--------------|---------------|
| 阿里云FC | ¥20-50 | ¥200-500 | ¥2000-5000 |
| AWS Lambda | $5-15 | $50-150 | $500-1500 |
| Vercel | 免费 | $20 | $200+ |
| VPS | $5-20 | $20-50 | $100-500 |

### 💡 优化策略

1. **按需扩容**: 使用自动扩缩容
2. **缓存策略**: CDN + Redis缓存
3. **资源池化**: 复用数据库连接
4. **监控告警**: 设置成本告警

---

选择适合您需求的云平台，开始部署AI Terminal到生产环境！