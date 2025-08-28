/**
 * BaseDAO - 数据访问对象基类
 * 提供JSON文件模拟数据库的基础CRUD操作
 */

const fs = require('fs').promises;
const path = require('path');
const lockfile = require('proper-lockfile');

class BaseDAO {
  constructor(tableName) {
    this.tableName = tableName;
    this.dbPath = path.join(process.cwd(), 'terminal-backend', 'data', 'db', `${tableName}.json`);
    this.autoIncrementKey = 'id';
    this.initDatabase();
  }

  /**
   * 初始化数据库文件
   */
  async initDatabase() {
    try {
      await fs.access(this.dbPath);
    } catch (error) {
      await this.createTable();
    }
  }

  /**
   * 创建数据表文件
   */
  async createTable() {
    const initialData = {
      table: this.tableName,
      auto_increment: 1,
      rows: [],
      indexes: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    await fs.mkdir(path.dirname(this.dbPath), { recursive: true });
    await fs.writeFile(this.dbPath, JSON.stringify(initialData, null, 2));
    console.log(`[BaseDAO] Created table: ${this.tableName}`);
  }

  /**
   * 读取数据库文件
   */
  async readDatabase() {
    const data = await fs.readFile(this.dbPath, 'utf-8');
    return JSON.parse(data);
  }

  /**
   * 写入数据库文件（带文件锁）
   */
  async writeDatabase(data) {
    const release = await lockfile.lock(this.dbPath, { retries: 3 });
    try {
      data.updated_at = new Date().toISOString();
      await fs.writeFile(this.dbPath, JSON.stringify(data, null, 2));
    } finally {
      await release();
    }
  }

  /**
   * 创建记录
   */
  async create(data) {
    const db = await this.readDatabase();
    
    // 生成自增ID
    const id = db.auto_increment++;
    const record = {
      [this.autoIncrementKey]: id,
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    db.rows.push(record);
    await this.writeDatabase(db);
    
    console.log(`[${this.tableName}] Created record with ID: ${id}`);
    return record;
  }

  /**
   * 根据ID查找记录
   */
  async findById(id) {
    const db = await this.readDatabase();
    return db.rows.find(row => row[this.autoIncrementKey] === id);
  }

  /**
   * 查找所有符合条件的记录
   */
  async findAll(conditions = {}) {
    const db = await this.readDatabase();
    
    if (Object.keys(conditions).length === 0) {
      return db.rows;
    }
    
    return db.rows.filter(row => {
      return Object.entries(conditions).every(([key, value]) => {
        // 支持简单的操作符
        if (typeof value === 'object' && value !== null) {
          if ('$in' in value) {
            return value.$in.includes(row[key]);
          }
          if ('$gte' in value && '$lte' in value) {
            return row[key] >= value.$gte && row[key] <= value.$lte;
          }
          if ('$gt' in value) {
            return row[key] > value.$gt;
          }
          if ('$lt' in value) {
            return row[key] < value.$lt;
          }
        }
        return row[key] === value;
      });
    });
  }

  /**
   * 查找单个记录
   */
  async findOne(conditions) {
    const results = await this.findAll(conditions);
    return results[0] || null;
  }

  /**
   * 更新记录
   */
  async update(id, data) {
    const db = await this.readDatabase();
    const index = db.rows.findIndex(row => row[this.autoIncrementKey] === id);
    
    if (index === -1) {
      throw new Error(`Record with ID ${id} not found in ${this.tableName}`);
    }
    
    // 保留原有数据，仅更新提供的字段
    db.rows[index] = {
      ...db.rows[index],
      ...data,
      updated_at: new Date().toISOString()
    };
    
    await this.writeDatabase(db);
    console.log(`[${this.tableName}] Updated record with ID: ${id}`);
    return db.rows[index];
  }

  /**
   * 删除记录
   */
  async delete(id) {
    const db = await this.readDatabase();
    const index = db.rows.findIndex(row => row[this.autoIncrementKey] === id);
    
    if (index === -1) {
      throw new Error(`Record with ID ${id} not found in ${this.tableName}`);
    }
    
    const deleted = db.rows.splice(index, 1)[0];
    await this.writeDatabase(db);
    
    console.log(`[${this.tableName}] Deleted record with ID: ${id}`);
    return deleted;
  }

  /**
   * 批量创建
   */
  async batchCreate(dataArray) {
    const db = await this.readDatabase();
    const newRecords = [];
    
    for (const data of dataArray) {
      const id = db.auto_increment++;
      const record = {
        [this.autoIncrementKey]: id,
        ...data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      newRecords.push(record);
      db.rows.push(record);
    }
    
    await this.writeDatabase(db);
    console.log(`[${this.tableName}] Batch created ${newRecords.length} records`);
    return newRecords;
  }

  /**
   * 计数
   */
  async count(conditions = {}) {
    const results = await this.findAll(conditions);
    return results.length;
  }

  /**
   * 清空表（仅测试使用）
   */
  async truncate() {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('Truncate is only allowed in test environment');
    }
    
    const db = await this.readDatabase();
    db.rows = [];
    db.auto_increment = 1;
    await this.writeDatabase(db);
    
    console.log(`[${this.tableName}] Table truncated`);
  }

  /**
   * 创建索引（提升查询性能）
   */
  async createIndex(fieldName) {
    const db = await this.readDatabase();
    
    if (!db.indexes[fieldName]) {
      db.indexes[fieldName] = {};
      
      // 构建索引
      for (const row of db.rows) {
        const value = row[fieldName];
        if (value !== undefined) {
          if (!db.indexes[fieldName][value]) {
            db.indexes[fieldName][value] = [];
          }
          db.indexes[fieldName][value].push(row[this.autoIncrementKey]);
        }
      }
      
      await this.writeDatabase(db);
      console.log(`[${this.tableName}] Created index on field: ${fieldName}`);
    }
  }

  /**
   * 使用索引查询
   */
  async findByIndex(fieldName, value) {
    const db = await this.readDatabase();
    
    if (db.indexes[fieldName] && db.indexes[fieldName][value]) {
      const ids = db.indexes[fieldName][value];
      return db.rows.filter(row => ids.includes(row[this.autoIncrementKey]));
    }
    
    // 降级到普通查询
    return this.findAll({ [fieldName]: value });
  }
}

module.exports = BaseDAO;