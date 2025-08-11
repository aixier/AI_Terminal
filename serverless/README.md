# AI Terminal Serverless 部署

本目录包含将 AI Terminal 部署到阿里云函数计算的所有配置文件。

## 快速开始

### 1. 安装 Serverless Devs 工具

```bash
npm install -g @serverless-devs/s
```

### 2. 配置阿里云账号

```bash
s config add
```

按提示输入：
- Provider: `Alibaba Cloud (alibaba)`
- AccessKey ID: 你的AccessKey ID
- AccessKey Secret: 你的AccessKey Secret
- Account ID: 你的账号ID
- Region: `cn-hangzhou`

### 3. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入实际的配置值。

### 4. 构建项目

```bash
npm install
npm run build
```

这将：
- 构建前端项目
- 安装后端依赖
- 复制所有必要文件到 `code` 目录

### 5. 部署到函数计算

```bash
npm run deploy
```

或使用 Serverless Devs 命令：

```bash
s deploy
```

### 6. 查看部署信息

```bash
s info
```

### 7. 查看实时日志

```bash
npm run logs
```

## 目录结构

```
serverless/
├── code/                      # 函数代码目录（自动生成）
│   ├── index.js              # 函数入口文件
│   ├── terminal-backend/      # 后端代码
│   └── static/               # 前端静态文件
├── s.yaml                    # Serverless配置文件
├── .env                      # 环境变量配置（需创建）
├── .env.example              # 环境变量示例
├── package.json              # 项目依赖和脚本
└── README.md                 # 本文件
```

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run build` | 构建整个项目 |
| `npm run deploy` | 部署到函数计算 |
| `npm run deploy:function` | 仅更新函数代码 |
| `npm run logs` | 查看实时日志 |
| `npm run info` | 查看函数信息 |
| `npm run remove` | 删除函数资源 |
| `npm run local` | 本地调试 |

## 访问地址

部署成功后，可以通过以下地址访问：

1. **函数计算默认域名**：
   ```
   https://[functionId].cn-hangzhou.fc.aliyuncs.com/
   ```

2. **自定义域名**（如已配置）：
   ```
   https://aicard.yourdomain.com
   ```

## 注意事项

1. **冷启动优化**：首次访问可能较慢，建议配置预留实例
2. **数据持久化**：使用OSS存储用户数据
3. **日志查看**：通过阿里云控制台或CLI查看详细日志
4. **成本控制**：注意设置函数并发限制和计费报警

## 故障排查

1. **部署失败**：
   - 检查阿里云账号配置
   - 确认有足够的权限
   - 查看错误日志

2. **函数超时**：
   - 增加 `s.yaml` 中的 timeout 配置
   - 优化代码性能

3. **内存不足**：
   - 增加 `s.yaml` 中的 memorySize 配置

4. **无法访问**：
   - 检查触发器配置
   - 确认域名绑定正确

## 相关文档

- [阿里云函数计算文档](https://help.aliyun.com/zh/fc/)
- [Serverless Devs文档](https://docs.serverless-devs.com/)
- [AI Terminal主项目](../README.md)