import express from 'express';
import { promises as fs } from 'fs';
import fsWatch from 'fs';
import path from 'path';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import apiTerminalService from '../utils/apiTerminalService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// 文件监控管理器
class FileChangeMonitor {
  constructor() {
    this.watchers = new Map();
    this.taskStatuses = new Map();
    this.apiIds = new Map(); // taskId -> apiId 映射
  }

  // 设置任务的apiId
  setApiId(taskId, apiId) {
    this.apiIds.set(taskId, apiId);
  }

  // 监控文件变化
  watchFile(filePath, taskId, mtimeBefore) {
    // 初始化任务状态
    this.taskStatuses.set(taskId, {
      status: 'processing',
      progress: 0,
      filePath,
      startTime: Date.now(),
      mtimeBefore
    });

    // 使用轮询检查文件修改时间（更可靠）
    const checkInterval = setInterval(async () => {
      try {
        const { promises: fsPromises } = await import('fs');
        const stat = await fsPromises.stat(filePath);
        const mtimeNow = stat.mtimeMs;

        // 检测到文件被修改
        if (mtimeNow > mtimeBefore) {
          console.log(`[FileChangeMonitor] File changed detected for task ${taskId}`);
          console.log(`[FileChangeMonitor] mtime before: ${mtimeBefore}, mtime now: ${mtimeNow}`);

          clearInterval(checkInterval);
          this.handleFileChange(taskId, filePath);
        }
      } catch (error) {
        console.error(`[FileChangeMonitor] Error checking file stat: ${error.message}`);
      }
    }, 500); // 每500ms检查一次

    // 同时使用fs.watch作为备用
    const watcher = fsWatch.watch(filePath, (eventType) => {
      if (eventType === 'change') {
        console.log(`[FileChangeMonitor] fs.watch detected change for task ${taskId}`);
        clearInterval(checkInterval);
        this.handleFileChange(taskId, filePath);
      }
    });

    this.watchers.set(taskId, {
      watcher,
      checkInterval,
      filePath,
      startTime: Date.now(),
      status: 'watching'
    });

    // 5分钟超时
    setTimeout(() => {
      if (this.watchers.has(taskId)) {
        clearInterval(checkInterval);
        this.timeout(taskId);
      }
    }, 300000); // 5分钟 = 300秒
  }

  // 处理文件变化
  handleFileChange(taskId, filePath) {
    const task = this.watchers.get(taskId);
    if (task) {
      const duration = Date.now() - task.startTime;

      // 更新任务状态
      this.taskStatuses.set(taskId, {
        status: 'completed',
        progress: 100,
        filePath,
        completedAt: new Date().toISOString(),
        duration
      });

      // 立即清理终端会话（文件已修改完成）
      const apiId = this.apiIds.get(taskId);
      if (apiId) {
        console.log(`[FileChangeMonitor] File changed, cleaning up terminal session: ${apiId}`);
        // 动态导入以避免循环依赖
        import('../utils/apiTerminalService.js').then(module => {
          module.default.destroySession(apiId);
        });
        this.apiIds.delete(taskId);
      }

      // 清理监听器
      this.cleanup(taskId);
    }
  }

  // 获取任务状态
  getTaskStatus(taskId) {
    const status = this.taskStatuses.get(taskId);
    if (!status) {
      return {
        status: 'not_found',
        error: 'Task not found'
      };
    }
    return status;
  }

  // 超时处理
  timeout(taskId) {
    const task = this.watchers.get(taskId);

    this.taskStatuses.set(taskId, {
      status: 'failed',
      error: 'Task timeout after 5 minutes',
      filePath: task?.filePath
    });

    this.cleanup(taskId);
  }

  // 清理
  cleanup(taskId) {
    const task = this.watchers.get(taskId);
    if (task) {
      // 清理文件监听器
      if (task.watcher) {
        task.watcher.close();
      }
      // 清理轮询定时器
      if (task.checkInterval) {
        clearInterval(task.checkInterval);
      }
    }
    this.watchers.delete(taskId);

    // 5分钟后清理状态缓存
    setTimeout(() => {
      this.taskStatuses.delete(taskId);
    }, 300000);
  }
}

// HTML编辑服务
class HtmlEditService {
  constructor() {
    this.monitor = new FileChangeMonitor();
  }

  // 构建AI提示词（使用标准格式）
  buildPrompt(filePath, elements, userRequest) {
    // 将elements数组转换为标准格式的JSON字符串
    const elementsJson = JSON.stringify(elements, null, 2);

    return `用户通过涂抹选中了${filePath}如下元素， 

${elementsJson}

//上面是用户选中的元素。selected_element是选中的元素，selection_coverage_percentage是涂抹或者选择区域和selected_element交集在selected_element的占比

用户的修改需求如下： 

${userRequest}    

需要监测目标html文件变化是否完成，以便于变更修改的状态，是进行中还是已完成

请执行以下操作：
1. 读取文件 ${filePath}
2. 找到用户选中的元素（根据selected_element内容匹配）
3. 根据用户需求修改这些元素
4. 保持其他内容完全不变
5. 保持原有格式和缩进
6. 直接覆盖原文件

重要：
- 只修改用户选中的元素
- 确保修改后的HTML结构正确
- 直接修改文件，不要只输出内容`;
  }

  // 使用 apiTerminalService 调用 Claude
  async callClaude(prompt, filePath, userId = 'default', taskId) {
    const apiId = `html_edit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    console.log(`[HTML_EDIT_CLAUDE] Using apiTerminalService to execute Claude`);
    console.log(`[HTML_EDIT_CLAUDE] API ID: ${apiId}`);
    console.log(`[HTML_EDIT_CLAUDE] Target file: ${filePath}`);
    console.log(`[HTML_EDIT_CLAUDE] Task ID: ${taskId}`);
    console.log(`[HTML_EDIT_CLAUDE] Prompt length: ${prompt.length} chars`);

    // 输出完整prompt用于调试
    console.log(`[HTML_EDIT_CLAUDE] Full prompt content:`);
    console.log('================== PROMPT START ==================');
    console.log(prompt);
    console.log('================== PROMPT END ====================');

    try {
      // 使用 apiTerminalService 执行 Claude（现在会等待Claude真正完成）
      const result = await apiTerminalService.executeClaude(apiId, prompt);

      console.log(`[HTML_EDIT_CLAUDE] Claude execution truly completed`);

      // 获取最后的输出（可选，用于调试）
      const lastOutput = await apiTerminalService.getLastOutput(apiId);
      if (lastOutput) {
        console.log(`[HTML_EDIT_CLAUDE] Last output: ${lastOutput.substring(0, 500)}`);
      }

      // 保存apiId到任务，用于后续清理
      if (taskId) {
        this.monitor.setApiId(taskId, apiId);
      }

      // 设置5分钟后自动清理（如果还没被清理的话）
      setTimeout(() => {
        console.log(`[HTML_EDIT_CLAUDE] Auto cleanup after 5 minutes: ${apiId}`);
        try {
          apiTerminalService.destroySession(apiId);
        } catch (error) {
          // 忽略清理错误（可能已经被清理）
          console.log(`[HTML_EDIT_CLAUDE] Session may already be cleaned: ${apiId}`);
        }
      }, 300000); // 5分钟

      return true;

    } catch (error) {
      console.error(`[HTML_EDIT_CLAUDE] Execution error:`, error);

      // 错误时延迟清理
      setTimeout(() => {
        apiTerminalService.destroySession(apiId);
      }, 5000);

      throw error;
    }
  }


  // 备份文件
  async backupFile(filePath) {
    const backupDir = '/app/data/backups';
    await fs.mkdir(backupDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = path.basename(filePath);
    const backupPath = path.join(backupDir, `${timestamp}_${fileName}`);

    await fs.copyFile(filePath, backupPath);
    return backupPath;
  }

  // 验证路径安全性
  validatePath(filePath, userId) {
    // 确保路径在用户工作空间内
    const userWorkspace = `/app/data/users/${userId || 'default'}/workspace/`;
    const resolvedPath = path.resolve(filePath);

    if (!resolvedPath.startsWith(path.resolve(userWorkspace))) {
      throw new Error('Invalid path: outside user workspace');
    }

    // 防止路径遍历
    if (filePath.includes('../') || filePath.includes('..\\')) {
      throw new Error('Invalid path: path traversal detected');
    }

    return true;
  }

  // 处理编辑请求
  async processEditRequest(request, userId) {
    // 1. 生成任务ID
    const taskId = `task_${Date.now()}_${uuidv4().substring(0, 8)}`;

    try {
      // 构建完整的文件路径 - 使用绝对路径
      const userWorkspace = `/app/data/users/${userId || 'default'}/workspace/`;
      const fullPath = path.join(userWorkspace, request.htmlPath);

      console.log('[HtmlEditService] Processing edit request');
      console.log('[HtmlEditService] User workspace:', userWorkspace);
      console.log('[HtmlEditService] Relative path:', request.htmlPath);
      console.log('[HtmlEditService] Full path:', fullPath);

      // 2. 验证路径
      this.validatePath(fullPath, userId);

      // 3. 验证文件存在
      await fs.access(fullPath);
      console.log('[HtmlEditService] File exists:', fullPath);

      // 4. 备份文件
      const backupPath = await this.backupFile(fullPath);

      // 5. 构建提示词（使用绝对路径，让Claude能找到文件）
      const prompt = this.buildPrompt(
        fullPath,  // 使用绝对路径
        request.elements,
        request.request
        // 不再传递文件内容，Claude会自己读取
      );

      // 6. 获取文件修改时间（用于检测变化）
      const statBefore = await fs.stat(fullPath);
      const mtimeBefore = statBefore.mtimeMs;

      // 7. 开始监控文件变化（先设置监控，再执行Claude）
      this.monitor.watchFile(fullPath, taskId, mtimeBefore);

      // 8. 调用Claude CLI（Claude会直接修改文件），传递taskId用于管理
      await this.callClaude(prompt, fullPath, userId, taskId);

      // 9. 返回成功响应（状态由文件监控器更新）
      return {
        success: true,
        taskId,
        status: 'processing',
        backupPath,
        message: '修改任务已创建，正在等待文件变化确认'
      };

    } catch (error) {
      console.error('Process edit request error:', error);

      // 更新任务状态为失败
      this.monitor.taskStatuses.set(taskId, {
        status: 'failed',
        error: error.message
      });

      throw error;
    }
  }

  // 获取任务状态
  getTaskStatus(taskId) {
    return this.monitor.getTaskStatus(taskId);
  }
}

// 创建服务实例
const editService = new HtmlEditService();

// API路由

// 提交HTML编辑任务
router.post('/edit', async (req, res) => {
  try {
    const { htmlPath, fileId, folderId, elements, request } = req.body;

    // 验证必要参数
    if (!htmlPath || !elements || !request) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }

    // 获取用户ID（从session或token）
    const userId = req.user?.id || 'default';

    // 处理编辑请求
    const result = await editService.processEditRequest(
      {
        htmlPath,
        fileId,
        folderId,
        elements,
        request
      },
      userId
    );

    res.json(result);

  } catch (error) {
    console.error('HTML edit error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

// 查询任务状态
router.get('/status/:taskId', (req, res) => {
  try {
    const { taskId } = req.params;
    const status = editService.getTaskStatus(taskId);

    res.json({
      taskId,
      ...status
    });

  } catch (error) {
    console.error('Get status error:', error);
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

// 批量查询任务状态
router.post('/status/batch', (req, res) => {
  try {
    const { taskIds } = req.body;

    if (!Array.isArray(taskIds)) {
      return res.status(400).json({
        error: 'taskIds must be an array'
      });
    }

    const results = {};
    taskIds.forEach(taskId => {
      results[taskId] = editService.getTaskStatus(taskId);
    });

    res.json(results);

  } catch (error) {
    console.error('Batch status error:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

export default router;