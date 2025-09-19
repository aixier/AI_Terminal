import express from 'express';
import { promises as fs } from 'fs';
import fsWatch from 'fs';
import path from 'path';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import apiTerminalService from '../utils/apiTerminalService.js';
import { OSSUploader } from './generate/utils/ossUploader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// 健康检查路由
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'html-edit',
    timestamp: new Date().toISOString(),
    routes: {
      'GET /status/:taskId': 'available',
      'POST /edit': 'available',
      'POST /status/batch': 'available'
    }
  });
});

// 文件监控管理器
class FileChangeMonitor {
  constructor() {
    this.watchers = new Map();
    this.taskStatuses = new Map();
    this.apiIds = new Map(); // taskId -> apiId 映射
    this.taskMetadata = new Map(); // taskId -> 任务元数据映射
    this.ossUploader = new OSSUploader();
  }

  // 设置任务的apiId
  setApiId(taskId, apiId) {
    this.apiIds.set(taskId, apiId);
  }

  // 设置任务元数据（用于OSS上传）
  setTaskMetadata(taskId, metadata) {
    this.taskMetadata.set(taskId, metadata);
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

    let changeDetected = false;  // 防止重复处理

    // 使用轮询检查文件修改时间（更可靠）
    const checkInterval = setInterval(async () => {
      try {
        const { promises: fsPromises } = await import('fs');
        const stat = await fsPromises.stat(filePath);
        const mtimeNow = stat.mtimeMs;

        // 检测到文件被修改
        if (mtimeNow > mtimeBefore && !changeDetected) {
          changeDetected = true;
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
      if (eventType === 'change' && !changeDetected) {
        changeDetected = true;
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

    // 1小时超时
    setTimeout(() => {
      if (this.watchers.has(taskId)) {
        clearInterval(checkInterval);
        this.timeout(taskId);
      }
    }, 3600000); // 1小时 = 3600秒
  }

  // 处理文件变化
  async handleFileChange(taskId, filePath) {
    console.log(`[FileChangeMonitor] handleFileChange called for task ${taskId}`);
    const task = this.watchers.get(taskId);
    if (task) {
      const duration = Date.now() - task.startTime;
      console.log(`[FileChangeMonitor] Updating task ${taskId} to completed`);

      // 更新任务状态为处理中（准备上传OSS）
      this.taskStatuses.set(taskId, {
        status: 'uploading',
        progress: 50,
        filePath,
        message: '文件修改完成，正在上传到OSS...',
        completedAt: new Date().toISOString(),
        duration
      });

      try {
        // 获取任务元数据
        const metadata = this.taskMetadata.get(taskId);
        if (metadata && metadata.userId && metadata.folderId) {
          console.log(`[FileChangeMonitor] Starting OSS upload for task ${taskId}`);

          // 构建文件夹路径用于OSS上传
          const folderPath = path.dirname(filePath);
          const folderName = metadata.folderId || path.basename(folderPath);

          // 上传修改后的文件到OSS
          const uploadResult = await this.uploadModifiedFileToOSS(
            metadata.userId,
            folderName,
            filePath
          );

          if (uploadResult.success) {
            // OSS上传成功，更新meta文件中的ossUrl
            try {
              await this.updateMetaFileWithNewOssUrl(metadata, uploadResult.ossUrl, uploadResult.fileName, filePath);
              console.log(`[FileChangeMonitor] Meta file updated with new OSS URL for task ${taskId}`);
            } catch (metaError) {
              console.error(`[FileChangeMonitor] Failed to update meta file for task ${taskId}:`, metaError);
            }

            // 更新任务状态
            this.taskStatuses.set(taskId, {
              status: 'completed',
              progress: 100,
              filePath,
              ossUrl: uploadResult.ossUrl,
              uploadResult: uploadResult,
              completedAt: new Date().toISOString(),
              duration,
              message: '文件修改并上传OSS完成'
            });

            console.log(`[FileChangeMonitor] Task ${taskId} completed with OSS upload success`);
          } else {
            // OSS上传失败
            this.taskStatuses.set(taskId, {
              status: 'upload_failed',
              progress: 75,
              filePath,
              error: uploadResult.error,
              completedAt: new Date().toISOString(),
              duration,
              message: '文件修改完成但OSS上传失败'
            });

            console.error(`[FileChangeMonitor] OSS upload failed for task ${taskId}:`, uploadResult.error);
          }
        } else {
          // 没有元数据，只标记文件修改完成
          console.log(`[FileChangeMonitor] No metadata found for task ${taskId}, skipping OSS upload`);
          this.taskStatuses.set(taskId, {
            status: 'completed',
            progress: 100,
            filePath,
            completedAt: new Date().toISOString(),
            duration,
            message: '文件修改完成'
          });
        }
      } catch (error) {
        console.error(`[FileChangeMonitor] Error during OSS upload for task ${taskId}:`, error);
        this.taskStatuses.set(taskId, {
          status: 'upload_failed',
          progress: 75,
          filePath,
          error: error.message,
          completedAt: new Date().toISOString(),
          duration,
          message: '文件修改完成但OSS上传出错'
        });
      }

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

      // 清理监听器和元数据
      this.cleanup(taskId);
    }
  }

  // 上传修改后的文件到OSS
  async uploadModifiedFileToOSS(userId, folderId, filePath) {
    try {
      console.log(`[FileChangeMonitor] Uploading modified file to OSS: ${filePath}`);

      const fileName = path.basename(filePath);
      const fileStats = await fs.stat(filePath);

      // 对中文文件名进行URL编码
      const encodedFileName = encodeURIComponent(fileName);
      // OSS键名
      const ossKey = `pod2post/${userId}/${folderId}/${encodedFileName}`;

      // 获取文件MIME类型
      const mimeType = this.getMimeType(fileName);

      // 上传到OSS
      const uploadResult = await this.ossUploader.ossService.client.uploadFile(filePath, ossKey, {
        headers: {
          'Content-Type': mimeType,
          'Cache-Control': 'public, max-age=31536000',
          'Content-Disposition': `attachment; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`
        }
      });

      if (uploadResult.success) {
        // 生成1年有效期的签名URL
        const signedUrlResult = await this.ossUploader.ossService.client.generateSignedUrl(ossKey, 3600 * 24 * 365);

        return {
          success: true,
          ossUrl: signedUrlResult.url,
          ossKey: ossKey,
          fileName: fileName,
          fileSize: fileStats.size,
          uploadedAt: new Date().toISOString()
        };
      } else {
        return {
          success: false,
          error: uploadResult.error || 'Upload failed'
        };
      }
    } catch (error) {
      console.error(`[FileChangeMonitor] OSS upload error:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 获取文件MIME类型
  getMimeType(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  // 更新meta文件中的OSS URL
  async updateMetaFileWithNewOssUrl(metadata, newOssUrl, fileName, filePath) {
    try {
      console.log(`[FileChangeMonitor] Updating meta file with new OSS URL for file: ${fileName}`);

      // 构建meta文件路径
      const userWorkspace = `/app/data/users/${metadata.userId || 'default'}/workspace/`;
      const metaFilePath = path.join(userWorkspace, `card/${metadata.folderId}/${metadata.folderId}_meta.json`);

      console.log(`[FileChangeMonitor] Meta file path: ${metaFilePath}`);

      // 检查meta文件是否存在
      try {
        await fs.access(metaFilePath);
      } catch (error) {
        console.log(`[FileChangeMonitor] Meta file not found: ${metaFilePath}, skipping update`);
        return;
      }

      // 读取现有的meta文件
      const metaContent = await fs.readFile(metaFilePath, 'utf8');
      const metaData = JSON.parse(metaContent);

      console.log(`[FileChangeMonitor] Checking meta structure for OSS update...`);

      // 确保OSS上传结构存在
      if (!metaData.custom) {
        metaData.custom = {};
      }
      if (!metaData.custom.ossUpload) {
        metaData.custom.ossUpload = { success: true };
      }
      if (!metaData.custom.ossUpload.urls) {
        metaData.custom.ossUpload.urls = {};
      }
      if (!metaData.custom.ossUpload.uploadedFiles) {
        metaData.custom.ossUpload.uploadedFiles = [];
      }

      // 确定要更新的字段
      let updated = false;

      // 根据文件名确定更新哪个URL字段
      if (fileName.includes('content_ossurl') || (fileName.includes('content') && fileName.endsWith('.html'))) {
        // 更新originalHtml URL
        metaData.custom.ossUpload.urls.originalHtml = newOssUrl;
        updated = true;
        console.log(`[FileChangeMonitor] Updated originalHtml URL`);
      } else if (fileName.includes('base64') && fileName.endsWith('.html')) {
        // 更新withBase64 URL
        metaData.custom.ossUpload.urls.withBase64 = newOssUrl;
        updated = true;
        console.log(`[FileChangeMonitor] Updated withBase64 URL`);
      }

      if (updated) {
        // 更新对应的uploadedFiles数组中的记录
        const existingFileIndex = metaData.custom.ossUpload.uploadedFiles.findIndex(
          file => file.fileName === fileName
        );

        const currentTime = new Date().toISOString();

        if (existingFileIndex !== -1) {
          // 更新现有记录
          metaData.custom.ossUpload.uploadedFiles[existingFileIndex].ossUrl = newOssUrl;
          metaData.custom.ossUpload.uploadedFiles[existingFileIndex].uploadedAt = currentTime;
          console.log(`[FileChangeMonitor] Updated existing file record for: ${fileName}`);
        } else {
          // 添加新记录 - 从uploadResult获取文件大小
          const fileSize = await this.getFileSize(filePath);
          metaData.custom.ossUpload.uploadedFiles.push({
            fileName: fileName,
            fileSize: fileSize,
            ossKey: `pod2post/${metadata.userId}/${metadata.folderId}/${encodeURIComponent(fileName)}`,
            ossUrl: newOssUrl,
            uploadedAt: currentTime
          });
          console.log(`[FileChangeMonitor] Added new file record for: ${fileName}`);
        }

        // 更新上传时间
        metaData.custom.ossUpload.uploadedAt = currentTime;

        // 添加到logs数组
        if (!metaData.logs) {
          metaData.logs = [];
        }
        metaData.logs.push({
          timestamp: currentTime,
          level: "info",
          message: "HTML文件编辑后重新上传OSS",
          context: {
            fileName: fileName,
            newOssUrl: newOssUrl,
            action: "html_edit_oss_update"
          }
        });

        // 写回meta文件
        await fs.writeFile(metaFilePath, JSON.stringify(metaData, null, 2), 'utf8');
        console.log(`[FileChangeMonitor] Meta file updated successfully`);
      } else {
        console.log(`[FileChangeMonitor] No matching URL field found for file: ${fileName}, skipping meta update`);
      }

    } catch (error) {
      console.error(`[FileChangeMonitor] Error updating meta file:`, error);
      throw error;
    }
  }

  // 获取文件大小
  async getFileSize(filePath) {
    try {
      const stats = await fs.stat(filePath);
      return stats.size;
    } catch (error) {
      console.error(`[FileChangeMonitor] Error getting file size for ${filePath}:`, error);
      return 0;
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
    this.taskMetadata.delete(taskId);

    // 1小时后清理状态缓存
    setTimeout(() => {
      this.taskStatuses.delete(taskId);
    }, 3600000);
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

用户的修改需求修改selected_element的内容： 

这个元素：${userRequest}    



请执行以下操作：
1. 读取文件 ${filePath}
2. 找到用户选中的元素（根据selected_element内容匹配）
3. 只能修改selected_element元素，保持其他内容完全不变

重要：
- 只修改用户选中的selected_element元素
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

      // 7. 设置任务元数据（用于OSS上传）
      this.monitor.setTaskMetadata(taskId, {
        userId: userId,
        folderId: request.folderId,
        fileId: request.fileId,
        htmlPath: request.htmlPath,
        elements: request.elements,
        originalRequest: request.request
      });

      // 8. 开始监控文件变化（先设置监控，再执行Claude）
      this.monitor.watchFile(fullPath, taskId, mtimeBefore);

      // 9. 异步调用Claude（不等待完成，立即返回）
      this.callClaude(prompt, fullPath, userId, taskId).catch(error => {
        console.error('[HtmlEditService] Claude execution failed:', error);
        // 更新任务状态为失败
        this.monitor.taskStatuses.set(taskId, {
          status: 'failed',
          error: error.message,
          filePath: fullPath
        });
      });

      // 10. 立即返回响应（不等待Claude执行）
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
    console.log(`[HTML_EDIT_STATUS] GET /api/html/status/${req.params.taskId}`);
    const { taskId } = req.params;
    const status = editService.getTaskStatus(taskId);

    console.log(`[HTML_EDIT_STATUS] Status for ${taskId}:`, status);

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

// 添加OPTIONS支持用于CORS预检
router.options('/status/:taskId', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(200);
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