/**
 * JSON修复工具模块
 * 
 * 使用Claude API自动修复JSON语法错误
 * 主要用于修复模板生成的JSON文件中的格式问题
 * 
 * @author Claude Code
 * @version 1.0.0
 * @created 2025-08-28
 */

import fs from 'fs';
import path from 'path';
import logger from './logger.js';

/**
 * JSON修复器类
 */
class JsonRepair {
  constructor(options = {}) {
    this.apiBase = options.apiBase || 'http://8.130.86.152:80';  // 默认使用远程服务器
    this.apiToken = options.apiToken || 'default-secure-token-abc123';
    this.defaultTimeout = options.timeout || 120000; // 2分钟默认超时
    this.maxRetries = options.maxRetries || 2;
  }

  /**
   * HTTP请求函数
   */
  async makeRequest(url, options = {}) {
    const fetch = (await import('node-fetch')).default;
    
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiToken}`
      }
    };
    
    const response = await fetch(url, { ...defaultOptions, ...options });
    const data = await response.json();
    
    return {
      status: response.status,
      success: response.ok,
      data: data
    };
  }

  /**
   * 构造JSON修复的Prompt
   * @param {string} jsonContent - 需要修复的JSON内容
   * @param {Object} options - 额外选项
   * @returns {string} 修复prompt
   */
  buildFixPrompt(jsonContent, options = {}) {
    const { 
      templateName, 
      description, 
      includeContext = false  // 新增：是否包含上下文信息
    } = options;
    
    // 构建上下文信息（可选）
    let contextInfo = '';
    if (includeContext && (templateName || description)) {
      const parts = [];
      if (templateName && templateName !== 'unknown') {
        parts.push(`来源模板: ${templateName}`);
      }
      if (description && description !== 'JSON文件') {
        parts.push(`文件类型: ${description}`);
      }
      if (parts.length > 0) {
        contextInfo = `\n上下文信息: ${parts.join(', ')}\n`;
      }
    }
    
    return `请检查并修复以下JSON的语法错误。${contextInfo}
任务要求：
1. 识别并修复所有JSON语法错误（如缺少逗号、括号不匹配、引号问题等）
2. 保持原始数据内容和结构完全不变，只修复格式问题  
3. 确保修复后的JSON可以被JSON.parse()正确解析
4. 直接返回修复后的完整JSON内容，不要添加任何解释文字或markdown格式

需要修复的JSON内容：
${jsonContent}

请直接返回修复后的JSON：`;
  }

  /**
   * 从Claude响应中提取JSON内容
   * @param {string} response - Claude的原始响应
   * @returns {string} 提取的JSON内容
   */
  extractJsonFromResponse(response) {
    let jsonContent = response.trim();
    
    // 尝试提取markdown代码块中的JSON
    const markdownMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (markdownMatch) {
      jsonContent = markdownMatch[1].trim();
      logger.debug('[JsonRepair] 从markdown代码块中提取JSON');
    }
    
    // 如果响应包含解释文字，尝试提取JSON部分
    if (!jsonContent.startsWith('{') && !jsonContent.startsWith('[')) {
      const jsonStart = jsonContent.indexOf('{');
      const jsonEnd = jsonContent.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        jsonContent = jsonContent.substring(jsonStart, jsonEnd + 1);
        logger.debug('[JsonRepair] 从文本中提取JSON部分');
      } else {
        // 尝试查找数组形式的JSON
        const arrayStart = jsonContent.indexOf('[');
        const arrayEnd = jsonContent.lastIndexOf(']');
        if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
          jsonContent = jsonContent.substring(arrayStart, arrayEnd + 1);
          logger.debug('[JsonRepair] 从文本中提取JSON数组部分');
        }
      }
    }
    
    return jsonContent;
  }

  /**
   * 验证JSON格式和必要字段
   * @param {string} jsonContent - JSON内容
   * @param {Array} requiredFields - 必需字段列表
   * @returns {Object} 验证结果
   */
  validateJson(jsonContent, requiredFields = []) {
    try {
      const parsed = JSON.parse(jsonContent);
      
      // 检查必要字段
      const missingFields = requiredFields.filter(field => {
        const keys = field.split('.');
        let current = parsed;
        for (const key of keys) {
          if (current === null || current === undefined || !current.hasOwnProperty(key)) {
            return true;
          }
          current = current[key];
        }
        return false;
      });
      
      return {
        valid: true,
        data: parsed,
        missingFields,
        warning: missingFields.length > 0 ? `缺少字段: ${missingFields.join(', ')}` : null
      };
      
    } catch (error) {
      return {
        valid: false,
        error: error.message,
        data: null
      };
    }
  }

  /**
   * 检查JSON是否需要修复
   * @param {string} jsonContent - JSON内容
   * @param {Array} requiredFields - 必需字段
   * @returns {Object} 检查结果
   */
  checkJsonHealth(jsonContent, requiredFields = []) {
    try {
      const parsed = JSON.parse(jsonContent);
      
      // 检查必要字段
      const missingFields = requiredFields.filter(field => {
        const keys = field.split('.');
        let current = parsed;
        for (const key of keys) {
          if (current === null || current === undefined || !current.hasOwnProperty(key)) {
            return true;
          }
          current = current[key];
        }
        return false;
      });
      
      return {
        needsRepair: false,
        valid: true,
        data: parsed,
        missingFields,
        message: missingFields.length > 0 ? `JSON格式正确，但缺少字段: ${missingFields.join(', ')}` : 'JSON格式正确'
      };
      
    } catch (parseError) {
      return {
        needsRepair: true,
        valid: false,
        error: parseError.message,
        message: `JSON格式错误: ${parseError.message}`
      };
    }
  }

  /**
   * 修复JSON内容
   * @param {string} jsonContent - 需要修复的JSON内容
   * @param {Object} options - 修复选项
   * @returns {Promise<Object>} 修复结果
   */
  async repairJsonContent(jsonContent, options = {}) {
    const {
      timeout = this.defaultTimeout,
      templateName = 'unknown',
      description = 'JSON文件',
      requiredFields = ['theme', 'copy', 'cards'],
      retries = this.maxRetries,
      forceRepair = false  // 强制修复，即使JSON格式正确
    } = options;

    logger.info(`[JsonRepair] 开始修复JSON, 长度: ${jsonContent.length}, 模板: ${templateName}`);

    // 1. 首先检查JSON是否需要修复
    const healthCheck = this.checkJsonHealth(jsonContent, requiredFields);
    
    if (!forceRepair && !healthCheck.needsRepair) {
      logger.info(`[JsonRepair] JSON无需修复: ${healthCheck.message}`);
      return {
        success: true,
        data: healthCheck.data,
        fixedContent: jsonContent,
        skipped: true,
        warning: healthCheck.missingFields.length > 0 ? `缺少字段: ${healthCheck.missingFields.join(', ')}` : null
      };
    }

    // 2. JSON需要修复，记录原始错误
    const originalError = healthCheck.error;
    logger.warn(`[JsonRepair] JSON需要修复: ${healthCheck.message}`);

    let lastError;
    const repairAttempts = [];
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      const attemptStartTime = Date.now();
      
      if (attempt > 0) {
        logger.warn(`[JsonRepair] 第${attempt}次重试修复`);
      }
      
      try {
        // 3. 构造修复prompt
        const fixPrompt = this.buildFixPrompt(jsonContent, { templateName, description, ...options });
        
        // 4. 调用Claude API
        const url = `${this.apiBase}/api/generate/cc`;
        const apiStartTime = Date.now();
        
        const response = await this.makeRequest(url, {
          method: 'POST',
          body: JSON.stringify({
            prompt: fixPrompt,
            timeout: timeout
          })
        });
        
        const apiTime = Date.now() - apiStartTime;
        const executionTime = Date.now() - attemptStartTime;
        
        if (!response.success) {
          const apiError = `Claude API调用失败: HTTP ${response.status} - ${response.data?.message || JSON.stringify(response.data)}`;
          throw new Error(apiError);
        }

        logger.info(`[JsonRepair] Claude API调用成功, 耗时: ${response.data.executionTime}ms`);

        // 5. 提取修复后的JSON内容
        const claudeOutput = response.data.output;
        if (!claudeOutput) {
          throw new Error('Claude响应为空，无法获取修复后的JSON');
        }

        const fixedJsonContent = this.extractJsonFromResponse(claudeOutput);
        
        if (!fixedJsonContent || fixedJsonContent.trim().length === 0) {
          throw new Error('从Claude响应中无法提取有效的JSON内容');
        }
        
        // 6. 验证修复后的JSON
        const validation = this.validateJson(fixedJsonContent, requiredFields);
        
        if (!validation.valid) {
          // 记录修复失败的详细信息
          const repairError = `修复后的JSON仍有格式错误: ${validation.error}`;
          repairAttempts.push({
            attempt: attempt + 1,
            duration: executionTime,
            error: repairError,
            claudeResponse: claudeOutput.substring(0, 500) + (claudeOutput.length > 500 ? '...' : '')
          });
          throw new Error(repairError);
        }

        // 7. 修复成功，返回简洁结果
        const result = {
          success: true,
          data: validation.data,
          fixedContent: fixedJsonContent,
          originalError: originalError,
          executionTime,
          attempts: attempt + 1,
          warning: validation.warning,
          // 开发调试信息（可选）
          debug: process.env.NODE_ENV === 'development' ? {
            originalLength: jsonContent.length,
            fixedLength: fixedJsonContent.length,
            claudeTime: response.data.executionTime,
            repairHistory: repairAttempts.concat([{
              attempt: attempt + 1,
              duration: executionTime,
              success: true
            }])
          } : undefined
        };

        logger.info(`[JsonRepair] JSON修复成功, 尝试次数: ${attempt + 1}, 总耗时: ${executionTime}ms`);
        
        if (validation.warning) {
          logger.warn(`[JsonRepair] 修复警告: ${validation.warning}`);
        }

        return result;

      } catch (error) {
        lastError = error;
        const attemptTime = Date.now() - attemptStartTime;
        
        // 记录每次尝试的详细错误
        repairAttempts.push({
          attempt: attempt + 1,
          duration: attemptTime,
          error: error.message,
          errorType: this.classifyError(error),
          timestamp: new Date().toISOString()
        });
        
        logger.error(`[JsonRepair] 第${attempt + 1}次修复失败 (${attemptTime}ms):`, error.message);
        
        // 如果不是最后一次尝试，等待后重试
        if (attempt < retries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000); // 指数退避，最大5秒
          logger.info(`[JsonRepair] ${delay}ms后重试...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // 8. 所有重试都失败了，返回简洁的失败信息
    const failureResult = {
      success: false,
      error: lastError.message,
      errorType: this.classifyError(lastError),
      originalError: originalError,
      attempts: retries + 1,
      // 开发调试信息（可选）
      debug: process.env.NODE_ENV === 'development' ? {
        repairHistory: repairAttempts,
        troubleshooting: this.generateTroubleshootingTips(lastError, repairAttempts)
      } : undefined
    };

    logger.error(`[JsonRepair] JSON修复最终失败, 尝试次数: ${retries + 1}, 最终错误: ${lastError.message}`);
    
    return failureResult;
  }

  /**
   * 分类错误类型
   */
  classifyError(error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('connect') || message.includes('econnrefused')) {
      return 'NETWORK_ERROR';
    } else if (message.includes('timeout')) {
      return 'TIMEOUT_ERROR';
    } else if (message.includes('http') && message.includes('failed')) {
      return 'API_ERROR';
    } else if (message.includes('json') && (message.includes('parse') || message.includes('syntax'))) {
      return 'JSON_SYNTAX_ERROR';
    } else if (message.includes('empty') || message.includes('output')) {
      return 'EMPTY_RESPONSE_ERROR';
    } else {
      return 'UNKNOWN_ERROR';
    }
  }

  /**
   * 生成简洁的错误提示（仅用于开发调试）
   */
  generateTroubleshootingTips(error) {
    const errorType = this.classifyError(error);
    
    switch (errorType) {
      case 'NETWORK_ERROR':
        return ['网络连接失败', '检查API服务器状态'];
      case 'TIMEOUT_ERROR':
        return ['请求超时', '考虑增加timeout或分片处理'];
      case 'JSON_SYNTAX_ERROR':
        return ['JSON格式过于复杂', '建议手动预处理'];
      case 'EMPTY_RESPONSE_ERROR':
        return ['Claude响应为空', '检查prompt或添加上下文'];
      default:
        return ['修复失败', '检查输入格式或联系支持'];
    }
  }

  /**
   * 修复JSON文件
   * @param {string} filePath - JSON文件路径
   * @param {Object} options - 修复选项
   * @returns {Promise<Object>} 修复结果
   */
  async repairJsonFile(filePath, options = {}) {
    const {
      backup = true,
      outputPath = null,
      ...repairOptions
    } = options;

    logger.info(`[JsonRepair] 开始修复JSON文件: ${filePath}`);

    try {
      // 1. 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        throw new Error(`文件不存在: ${filePath}`);
      }

      // 2. 读取原始文件
      const originalContent = fs.readFileSync(filePath, 'utf-8');
      
      // 3. 创建备份
      if (backup) {
        const backupPath = filePath.replace(/\.json$/, '_backup.json');
        fs.writeFileSync(backupPath, originalContent, 'utf-8');
        logger.info(`[JsonRepair] 备份文件已创建: ${backupPath}`);
      }

      // 4. 修复JSON内容
      const repairResult = await this.repairJsonContent(originalContent, {
        ...repairOptions,
        templateName: path.basename(filePath, '.json')
      });

      if (!repairResult.success) {
        return {
          ...repairResult,
          filePath,
          backupCreated: backup
        };
      }

      // 5. 保存修复后的文件
      const targetPath = outputPath || filePath.replace(/\.json$/, '_fixed.json');
      const formattedJson = JSON.stringify(repairResult.parsedData, null, 2);
      
      fs.writeFileSync(targetPath, formattedJson, 'utf-8');
      
      logger.info(`[JsonRepair] 修复后文件已保存: ${targetPath}`);

      return {
        ...repairResult,
        filePath,
        outputPath: targetPath,
        backupCreated: backup
      };

    } catch (error) {
      logger.error(`[JsonRepair] 文件修复失败:`, error);
      return {
        success: false,
        error: error.message,
        filePath
      };
    }
  }

  /**
   * 批量修复JSON文件
   * @param {Array<string>} filePaths - 文件路径数组
   * @param {Object} options - 修复选项
   * @returns {Promise<Array>} 批量修复结果
   */
  async repairMultipleFiles(filePaths, options = {}) {
    logger.info(`[JsonRepair] 开始批量修复 ${filePaths.length} 个JSON文件`);

    const results = [];
    const { concurrent = false, ...repairOptions } = options;

    if (concurrent) {
      // 并发修复（注意API限制）
      const promises = filePaths.map(filePath => 
        this.repairJsonFile(filePath, repairOptions)
      );
      const batchResults = await Promise.allSettled(promises);
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            success: false,
            error: result.reason.message,
            filePath: filePaths[index]
          });
        }
      });
    } else {
      // 顺序修复
      for (const filePath of filePaths) {
        const result = await this.repairJsonFile(filePath, repairOptions);
        results.push(result);
      }
    }

    const successCount = results.filter(r => r.success).length;
    logger.info(`[JsonRepair] 批量修复完成: ${successCount}/${filePaths.length} 成功`);

    return {
      total: filePaths.length,
      success: successCount,
      failed: filePaths.length - successCount,
      results
    };
  }
}

// 创建默认实例
const defaultRepair = new JsonRepair();

// 导出类和默认实例
export { JsonRepair };
export default defaultRepair;

// 便捷函数导出
export const repairJsonContent = (jsonContent, options) => 
  defaultRepair.repairJsonContent(jsonContent, options);

export const repairJsonFile = (filePath, options) => 
  defaultRepair.repairJsonFile(filePath, options);

export const repairMultipleFiles = (filePaths, options) => 
  defaultRepair.repairMultipleFiles(filePaths, options);