# 阿里云函数计算 (Serverless) 部署指南

## 一、部署架构说明

AI Terminal 将部署为阿里云函数计算的 Web 函数，支持 HTTP 触发器，实现无服务器架构。

## 二、前置要求

### 2.1 阿里云账号准备
- 开通函数计算服务 (FC)
- 开通日志服务 (SLS)
- 开通对象存储服务 (OSS) - 用于存储用户数据
- 开通文件存储服务 (NAS) - 用于持久化存储（可选）

### 2.2 必要信息收集
```yaml
# 需要准备的信息
阿里云账号:
  - AccessKey ID
  - AccessKey Secret
  - 账号ID (Account ID)
  
地域选择:
  - 建议: cn-hangzhou (杭州)
  - 备选: cn-shanghai (上海)
  
服务配置:
  - 服务名称: ai-terminal-service
  - 函数名称: ai-terminal-web
  - 运行环境: Node.js 18 或 20
```

## 三、部署步骤

### 步骤 1: 安装阿里云 Serverless Devs 工具

```bash
# 安装 Serverless Devs CLI
npm install -g @serverless-devs/s

# 配置阿里云账号
s config add

# 按提示输入以下信息：
# - Provider: Alibaba Cloud (alibaba)
# - AccessKey ID: <your-access-key-id>
# - AccessKey Secret: <your-access-key-secret>
# - Account ID: <your-account-id>
# - Region: cn-hangzhou
```

### 步骤 2: 项目结构调整

创建以下目录结构：
```
AI_Terminal/
├── code/                       # 函数代码目录
│   ├── terminal-backend/       # 后端代码
│   ├── static/                 # 前端静态文件
│   └── index.js               # 函数入口文件
├── s.yaml                      # Serverless配置文件
└── .env                        # 环境变量配置
```

### 步骤 3: 创建函数入口文件

创建 `code/index.js`：
```javascript
'use strict';

const express = require('express');
const path = require('path');

// 导入后端应用
const backendApp = require('./terminal-backend/src/index.js');

// 创建主应用
const app = express();

// 静态文件服务
app.use(express.static(path.join(__dirname, 'static')));

// 后端API路由
app.use('/api', backendApp);

// SPA路由支持
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'static', 'index.html'));
});

// 函数计算入口
exports.handler = async (req, res, context) => {
  // 处理HTTP请求
  return app(req, res);
};
```

### 步骤 4: Serverless 配置文件

创建 `s.yaml`：
```yaml
edition: 1.0.0
name: ai-terminal-app
access: default

vars:
  region: cn-hangzhou
  service:
    name: ai-terminal-service
    description: AI Terminal Serverless Service

services:
  ai-terminal:
    component: devsapp/fc
    props:
      region: ${vars.region}
      service: ${vars.service}
      
      function:
        name: ai-terminal-web
        description: AI Terminal Web Function
        runtime: nodejs18
        codeUri: ./code
        handler: index.handler
        memorySize: 1024  # MB
        timeout: 300      # 秒
        instanceConcurrency: 10
        
        environmentVariables:
          NODE_ENV: production
          PORT: 9000
          LOG_LEVEL: info
          JWT_SECRET: ${env.JWT_SECRET}
          JWT_EXPIRE_TIME: 24h
          MAX_TERMINAL_SESSIONS: 10
          TERMINAL_TIMEOUT: 600000
          ALLOWED_ORIGINS: "*"
          DATA_PATH: /tmp/data
          LOG_PATH: /tmp/logs
          STATIC_PATH: /code/static
          SERVE_STATIC: "true"
          ANTHROPIC_AUTH_TOKEN: ${env.ANTHROPIC_AUTH_TOKEN}
          ANTHROPIC_BASE_URL: ${env.ANTHROPIC_BASE_URL}
          
        # NAS 配置（可选，用于持久化存储）
        nasConfig:
          userId: 10003
          groupId: 10003
          mountPoints:
            - serverAddr: xxx.cn-hangzhou.nas.aliyuncs.com
              mountDir: /mnt/nas
              
      triggers:
        - name: http-trigger
          type: http
          config:
            authType: anonymous
            methods:
              - GET
              - POST
              - PUT
              - DELETE
              - OPTIONS
              - HEAD
              - PATCH
            
      customDomains:
        - domainName: auto  # 使用函数计算自动分配的域名
          protocol: HTTP
          routeConfigs:
            - path: /*
              methods:
                - GET
                - POST
                - PUT
                - DELETE
                - OPTIONS
                - HEAD
                - PATCH
```

### 步骤 5: 环境变量配置

创建 `.env` 文件：
```bash
# JWT配置
JWT_SECRET=your-jwt-secret-key-here

# Claude API配置
ANTHROPIC_AUTH_TOKEN=your-anthropic-token
ANTHROPIC_BASE_URL=http://your-api-url/api/

# OSS配置（用于数据存储）
OSS_BUCKET=ai-terminal-data
OSS_REGION=oss-cn-hangzhou
OSS_ACCESS_KEY_ID=your-oss-key
OSS_ACCESS_KEY_SECRET=your-oss-secret
```

### 步骤 6: 构建和部署

```bash
# 1. 构建前端
cd terminal-ui
npm install
npm run build
cp -r dist/* ../code/static/

# 2. 准备后端代码
cd ../terminal-backend
npm install --production
cp -r . ../code/terminal-backend/

# 3. 部署到函数计算
cd ..
s deploy
```

### 步骤 7: 配置自定义域名（可选）

1. 登录阿里云函数计算控制台
2. 找到部署的函数
3. 在"触发器管理"中配置自定义域名
4. 绑定已备案的域名

## 四、数据持久化方案

### 方案 1: 使用 OSS（推荐）
```javascript
// 使用阿里云 OSS SDK
const OSS = require('ali-oss');

const client = new OSS({
  region: process.env.OSS_REGION,
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  bucket: process.env.OSS_BUCKET
});

// 保存数据
async function saveToOSS(key, data) {
  await client.put(key, Buffer.from(JSON.stringify(data)));
}

// 读取数据
async function readFromOSS(key) {
  const result = await client.get(key);
  return JSON.parse(result.content.toString());
}
```

### 方案 2: 使用 NAS
- 配置 NAS 挂载点
- 数据直接写入 `/mnt/nas/data` 目录
- 函数实例间共享数据

### 方案 3: 使用表格存储 (TableStore)
- 适合结构化数据存储
- 支持高并发访问
- 按量付费

## 五、监控和日志

### 5.1 配置日志服务
```yaml
# 在 s.yaml 中添加日志配置
logConfig:
  project: ai-terminal-logs
  logstore: function-logs
  enableRequestMetrics: true
  enableInstanceMetrics: true
```

### 5.2 查看日志
```bash
# 使用 s 工具查看日志
s logs -t

# 或在阿里云控制台查看
# 函数计算 -> 服务 -> 函数 -> 日志查询
```

## 六、性能优化

### 6.1 冷启动优化
- 使用预留实例：配置 1-2 个预留实例避免冷启动
- 代码优化：减少 node_modules 大小
- 使用层(Layer)：将依赖打包为层

### 6.2 配置预留实例
```yaml
# 在 s.yaml 的 function 配置中添加
reservedConcurrentExecutions: 2  # 预留2个实例
```

### 6.3 使用函数计算层
```bash
# 创建层
s layer publish --layer-name ai-terminal-deps --code ./node_modules

# 在函数中引用层
layers:
  - acs:fc:cn-hangzhou:${accountId}:layers/ai-terminal-deps/versions/1
```

## 七、成本估算

### 基础配置成本（月）
- 函数计算：~50-200 元（根据调用量）
- OSS 存储：~10-50 元（根据存储量）
- 日志服务：~10-30 元
- 预留实例：~100-200 元（可选）

### 免费额度
- 函数计算：每月 100万次调用免费
- OSS：5GB 存储免费
- 日志服务：500MB/月免费

## 八、故障排查

### 常见问题

1. **函数超时**
   - 增加 timeout 配置
   - 优化代码性能
   - 使用异步处理

2. **内存不足**
   - 增加 memorySize 配置
   - 优化内存使用

3. **权限问题**
   - 检查 RAM 角色权限
   - 确保有 OSS/NAS 访问权限

4. **WebSocket 不支持**
   - 函数计算不支持长连接
   - 改用轮询或 SSE
   - 或使用 API 网关的 WebSocket 功能

## 九、部署命令汇总

```bash
# 完整部署流程
# 1. 初始化
s init

# 2. 构建
npm run build:all

# 3. 部署
s deploy

# 4. 查看函数信息
s info

# 5. 查看日志
s logs -t

# 6. 更新函数
s deploy function

# 7. 删除资源
s remove
```

## 十、注意事项

1. **函数计算限制**
   - 最大执行时间：10分钟
   - 最大内存：3GB
   - 临时存储：512MB (/tmp)
   - 不支持 WebSocket（需要额外配置）

2. **数据安全**
   - 使用 RAM 角色而非 AK/SK
   - 敏感信息使用 KMS 加密
   - 定期备份数据

3. **成本控制**
   - 设置函数并发限制
   - 配置计费报警
   - 定期清理日志

## 联系支持

如需技术支持，请联系：
- 阿里云工单系统
- 函数计算用户群
- 官方文档：https://help.aliyun.com/zh/fc/