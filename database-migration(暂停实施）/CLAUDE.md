# 数据库改造指导文档

## 一、改造概述

本次改造旨在将AI Terminal系统从当前的分散文件存储迁移到规范的数据库架构，采用JSON文件模拟关系数据库，本地文件系统模拟对象存储的方式，为将来迁移到MySQL和OSS做准备。

## 二、改造原则

### 2.1 核心原则
1. **零数据丢失**: 虽然没有真实用户数据，但要确保改造过程可逆
2. **接口兼容**: 保持现有API接口不变，仅改变底层实现
3. **分层架构**: 严格的数据访问层(DAO)、服务层(Service)、控制层(Controller)分离
4. **配置驱动**: 所有路径、参数通过配置文件管理，便于切换环境

### 2.2 技术规范
1. **命名规范**:
   - 数据库表名: 小写下划线分隔 (user_settings)
   - DAO类名: PascalCase + DAO后缀 (UserDAO)
   - Service类名: PascalCase + Service后缀 (UserService)
   - JSON文件名: 表名.json (users.json)

2. **目录结构规范**:
```
/terminal-backend/
├── data/
│   ├── db/                  # JSON数据库文件
│   │   ├── users.json
│   │   ├── generation_tasks.json
│   │   └── ...
│   └── storage/            # 模拟对象存储
│       ├── templates/
│       ├── generated/
│       └── users/
├── src/
│   ├── dao/               # 数据访问层
│   │   ├── base/
│   │   │   └── BaseDAO.js
│   │   ├── UserDAO.js
│   │   └── ...
│   ├── services/          # 业务逻辑层（改造现有）
│   └── config/           # 配置文件
│       └── database.js
```

## 三、任务执行规范

### 3.1 任务状态定义
- **[ ]** - 未开始 (TODO)
- **[*]** - 进行中 (IN_PROGRESS)
- **[✓]** - 已完成 (DONE)
- **[!]** - 阻塞中 (BLOCKED)
- **[X]** - 已取消 (CANCELLED)

### 3.2 任务执行要求

#### 开始任务前
1. 阅读任务目标，理解需求
2. 检查依赖任务是否完成
3. 备份相关文件（如果涉及修改现有文件）

#### 执行任务中
1. 严格按照"动作"步骤执行
2. 每完成一个子步骤，进行测试验证
3. 遇到问题立即记录并标记为阻塞

#### 完成任务后
1. 运行相关测试确保功能正常
2. 更新任务状态为已完成
3. 记录完成时间和关键变更

### 3.3 代码规范

#### DAO层规范
```javascript
class BaseDAO {
  constructor(tableName) {
    this.tableName = tableName;
    this.dbPath = path.join(DB_PATH, `${tableName}.json`);
    this.autoIncrementKey = 'id';
    this.initDatabase();
  }

  async initDatabase() {
    // 确保数据库文件存在
    if (!fs.existsSync(this.dbPath)) {
      await this.createTable();
    }
  }

  async createTable() {
    const initialData = {
      table: this.tableName,
      auto_increment: 1,
      rows: [],
      indexes: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    await fs.writeFile(this.dbPath, JSON.stringify(initialData, null, 2));
  }

  // 必须实现的CRUD方法
  async create(data) { /* ... */ }
  async findById(id) { /* ... */ }
  async findAll(conditions) { /* ... */ }
  async update(id, data) { /* ... */ }
  async delete(id) { /* ... */ }
  async count(conditions) { /* ... */ }
}
```

#### Service层规范
```javascript
class UserService {
  constructor() {
    this.userDAO = new UserDAO();
    this.metadataDAO = new GenerationMetadataDAO();
  }

  async createUser(userData) {
    // 1. 数据验证
    this.validateUserData(userData);
    
    // 2. 业务逻辑
    const hashedPassword = await this.hashPassword(userData.password);
    
    // 3. 数据操作
    const user = await this.userDAO.create({
      ...userData,
      password: hashedPassword,
      created_at: new Date().toISOString()
    });
    
    // 4. 关联操作
    await this.createUserWorkspace(user.id);
    
    // 5. 返回结果（去除敏感信息）
    return this.sanitizeUser(user);
  }
}
```

## 四、测试规范

### 4.1 单元测试
每个DAO和Service必须有对应的测试文件：
```javascript
// test/dao/UserDAO.test.js
describe('UserDAO', () => {
  let userDAO;
  
  beforeEach(async () => {
    userDAO = new UserDAO();
    await userDAO.clearTable(); // 清空测试数据
  });
  
  test('should create user', async () => {
    const user = await userDAO.create({
      username: 'test',
      email: 'test@example.com'
    });
    expect(user.id).toBeDefined();
    expect(user.username).toBe('test');
  });
});
```

### 4.2 集成测试
测试完整的请求流程：
```javascript
// test/integration/generation.test.js
describe('Generation API', () => {
  test('should generate card with metadata', async () => {
    // 1. 创建用户
    const user = await createTestUser();
    
    // 2. 发起生成请求
    const response = await request(app)
      .post('/api/generate/card')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        topic: 'Test Topic',
        templateName: 'test-template.md'
      });
    
    // 3. 验证响应
    expect(response.status).toBe(200);
    expect(response.body.taskId).toBeDefined();
    
    // 4. 验证元数据
    const metadata = await metadataDAO.findById(response.body.taskId);
    expect(metadata).toBeDefined();
    expect(metadata.topic).toBe('Test Topic');
  });
});
```

## 五、数据迁移规范

### 5.1 数据结构转换
现有数据到新结构的映射规则：

| 现有文件 | 新数据表 | 转换规则 |
|---------|----------|----------|
| /data/users.json | users表 | 直接映射，添加created_at等字段 |
| /data/users/{username}/settings.json | user_settings表 | 提取并规范化 |
| /data/users/{username}/folders.json | user_folders表 | 解析嵌套结构 |
| 内存中的activeRequests | generation_tasks表 | 持久化任务状态 |
| 文件夹中的_metadata.json | generation_metadata表 | 合并和规范化 |

### 5.2 文件迁移规则
```javascript
// 文件路径映射
const pathMapping = {
  // 旧路径 -> 新路径
  '/data/users/{username}/workspace/card/{topic}/*.json': 
    '/data/storage/users/{user_id}/card/{task_id}/*.json',
  
  '/data/public_template/*': 
    '/data/storage/templates/*'
};
```

## 六、错误处理规范

### 6.1 错误码定义
```javascript
const ERROR_CODES = {
  // 数据库错误 (1xxx)
  DB_CONNECTION_ERROR: 1001,
  DB_QUERY_ERROR: 1002,
  DB_TRANSACTION_ERROR: 1003,
  
  // 业务错误 (2xxx)
  USER_NOT_FOUND: 2001,
  INVALID_PARAMETERS: 2002,
  DUPLICATE_ENTRY: 2003,
  
  // 文件系统错误 (3xxx)
  FILE_NOT_FOUND: 3001,
  FILE_WRITE_ERROR: 3002,
  STORAGE_FULL: 3003
};
```

### 6.2 错误处理模式
```javascript
class DatabaseError extends Error {
  constructor(code, message, details) {
    super(message);
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

// 使用示例
try {
  await userDAO.create(userData);
} catch (error) {
  if (error.code === 'DUPLICATE_ENTRY') {
    throw new DatabaseError(
      ERROR_CODES.DUPLICATE_ENTRY,
      '用户名已存在',
      { field: 'username', value: userData.username }
    );
  }
  throw error;
}
```

## 七、性能优化指南

### 7.1 缓存策略
1. **内存缓存**: 热点数据缓存在内存中
2. **文件缓存**: JSON文件读取后缓存一定时间
3. **查询缓存**: 复杂查询结果缓存

### 7.2 批量操作
```javascript
// 批量插入优化
async batchCreate(dataArray) {
  const db = await this.readDatabase();
  const newRows = [];
  
  for (const data of dataArray) {
    const id = db.auto_increment++;
    newRows.push({ id, ...data });
  }
  
  db.rows.push(...newRows);
  await this.writeDatabase(db);
  return newRows;
}
```

## 八、监控和日志

### 8.1 日志级别
- **ERROR**: 系统错误，需要立即处理
- **WARN**: 警告信息，可能的问题
- **INFO**: 重要业务操作
- **DEBUG**: 调试信息

### 8.2 监控指标
1. **性能指标**:
   - DAO操作耗时
   - 文件I/O次数
   - 内存使用量

2. **业务指标**:
   - 生成任务成功率
   - 平均生成时间
   - 模板使用统计

## 九、回滚方案

### 9.1 备份策略
1. 改造前完整备份现有data目录
2. 每个阶段完成后创建检查点备份
3. 保留最近3个版本的备份

### 9.2 回滚步骤
1. 停止应用服务
2. 恢复备份的data目录
3. 恢复代码到指定版本
4. 重启服务并验证

## 十、验收标准

### 10.1 功能验收
- [ ] 所有现有API正常工作
- [ ] 数据CRUD操作正常
- [ ] 元数据收集完整
- [ ] 文件存储访问正常

### 10.2 性能验收
- [ ] 响应时间不超过改造前的1.2倍
- [ ] 内存使用不超过改造前的1.5倍
- [ ] 支持并发请求数不低于改造前

### 10.3 质量验收
- [ ] 单元测试覆盖率 > 80%
- [ ] 集成测试全部通过
- [ ] 无critical级别的代码质量问题
- [ ] 文档完整且准确

## 附录A：常用命令

```bash
# 备份数据
tar -czf backup-$(date +%Y%m%d-%H%M%S).tar.gz terminal-backend/data/

# 运行测试
npm test                     # 所有测试
npm test -- --coverage      # 带覆盖率
npm test dao/              # 仅DAO测试

# 数据库操作
node scripts/db-init.js     # 初始化数据库
node scripts/db-migrate.js  # 执行迁移
node scripts/db-seed.js     # 填充测试数据

# 验证
node scripts/validate-db.js  # 验证数据库结构
node scripts/health-check.js # 健康检查
```

## 附录B：故障排查

| 问题 | 可能原因 | 解决方案 |
|------|----------|----------|
| 找不到数据文件 | 路径配置错误 | 检查database.js配置 |
| 数据不一致 | 并发写入冲突 | 实现文件锁机制 |
| 性能下降 | 缺少索引 | 添加索引优化查询 |
| 内存泄漏 | 缓存未清理 | 设置缓存过期时间 |

---

**文档版本**: 1.0.0  
**更新日期**: 2024-01-20  
**作者**: AI Terminal Team