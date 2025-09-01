#!/usr/bin/env node

/**
 * 完整的音视频转录测试脚本 - 最终版本
 * 流程：上传到OSS -> 提交转录任务 -> 轮询状态 -> 获取转录结果 -> 生成带时间戳的MD文件
 */

import OSS from 'ali-oss';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载环境变量
dotenv.config();

// 配置
const ossConfig = {
  region: process.env.OSS_REGION || 'oss-cn-hangzhou',
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  bucket: process.env.OSS_BUCKET || 'cms-mcp',
  secure: true,
  timeout: 60000
};

const ALIYUN_API_KEY = process.env.ALIYUN_API_KEY;
const TEST_VIDEO = '/mnt/d/work/AI_Terminal/2025-04-18 16.11.02-视频-科言说科研-美国人把英伟达逼上绝路，黄仁勋却...CEO黄仁勋 #中美科技 #科言说科研.mp4';

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m'
};

function log(message, color = 'reset') {
  const timestamp = new Date().toISOString();
  console.log(`${colors[color]}[${timestamp}] ${message}${colors.reset}`);
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatTimestamp(seconds) {
  if (isNaN(seconds) || seconds === null || seconds === undefined) {
    return '00:00.000';
  }
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
  } else {
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
  }
}

/**
 * 步骤1: 上传文件到OSS
 */
async function uploadToOSS(filePath) {
  log('=== 步骤1: 上传文件到OSS ===', 'bright');
  
  try {
    // 检查文件
    if (!fs.existsSync(filePath)) {
      throw new Error(`文件不存在: ${filePath}`);
    }
    
    const stats = fs.statSync(filePath);
    const fileName = path.basename(filePath);
    
    log(`文件: ${fileName}`, 'cyan');
    log(`大小: ${formatFileSize(stats.size)}`, 'cyan');
    
    // 初始化OSS客户端
    log('初始化OSS客户端...', 'yellow');
    const client = new OSS(ossConfig);
    
    // 生成OSS路径
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const ext = path.extname(fileName);
    const ossPath = `transcription/video/${timestamp}-${randomStr}${ext}`;
    
    log(`OSS路径: ${ossPath}`, 'cyan');
    
    // 上传文件
    log('开始上传...', 'yellow');
    const startTime = Date.now();
    
    let result;
    if (stats.size > 10 * 1024 * 1024) { // 大于10MB使用分片上传
      log('使用分片上传（文件大于10MB）', 'yellow');
      result = await client.multipartUpload(ossPath, filePath, {
        progress: (p) => {
          const percent = Math.floor(p * 100);
          process.stdout.write(`\r上传进度: ${percent}%`);
        },
        partSize: 1024 * 1024, // 1MB per part
        parallel: 3
      });
      console.log(''); // 换行
    } else {
      result = await client.put(ossPath, filePath);
    }
    
    const uploadTime = (Date.now() - startTime) / 1000;
    log(`✓ 上传成功！耗时: ${uploadTime.toFixed(2)}秒`, 'green');
    
    // 生成签名URL（2小时有效）
    const signedUrl = client.signatureUrl(ossPath, {
      expires: 7200,
      method: 'GET'
    });
    
    log(`✓ 签名URL生成成功`, 'green');
    
    return {
      ossPath,
      signedUrl,
      uploadTime,
      fileSize: stats.size
    };
    
  } catch (error) {
    log(`✗ OSS上传失败: ${error.message}`, 'red');
    throw error;
  }
}

/**
 * 步骤2: 提交转录任务到SenseVoice
 */
async function submitTranscriptionTask(fileUrl) {
  log('\n=== 步骤2: 提交转录任务 ===', 'bright');
  
  try {
    const requestBody = {
      model: 'sensevoice-v1',
      input: {
        file_urls: [fileUrl]
      },
      parameters: {
        language_hints: ['zh', 'en'],
        enable_timestamp: true,
        enable_words: true,
        enable_punctuation: true,
        disfluency_removal: false
      }
    };
    
    log('发送转录请求到SenseVoice API...', 'yellow');
    
    const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ALIYUN_API_KEY}`,
        'Content-Type': 'application/json',
        'X-DashScope-Async': 'enable'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API请求失败: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    
    if (result.output?.task_id) {
      log('✓ 任务提交成功！', 'green');
      log(`任务ID: ${result.output.task_id}`, 'cyan');
      log(`请求ID: ${result.request_id}`, 'cyan');
      return result.output.task_id;
    } else {
      throw new Error('未获取到任务ID');
    }
    
  } catch (error) {
    log(`✗ 任务提交失败: ${error.message}`, 'red');
    throw error;
  }
}

/**
 * 步骤3: 轮询任务状态直到完成
 */
async function pollTaskStatus(taskId, maxAttempts = 120) {
  log('\n=== 步骤3: 轮询任务状态 ===', 'bright');
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await new Promise(resolve => setTimeout(resolve, 5000)); // 等待5秒
      
      const response = await fetch(`https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${ALIYUN_API_KEY}`
        }
      });
      
      if (!response.ok) {
        log(`查询状态失败: ${response.status}`, 'yellow');
        continue;
      }
      
      const result = await response.json();
      const status = result.output?.task_status;
      
      if (status === 'SUCCEEDED') {
        console.log(''); // 换行
        log('✓ 转录完成！', 'green');
        
        // 获取转录结果URL
        if (result.output?.results?.[0]?.transcription_url) {
          log('获取转录结果...', 'yellow');
          const transcriptionUrl = result.output.results[0].transcription_url;
          
          // 下载转录结果
          const transcriptionResponse = await fetch(transcriptionUrl);
          if (transcriptionResponse.ok) {
            const transcriptionData = await transcriptionResponse.json();
            return transcriptionData;
          } else {
            log('无法获取转录结果，使用任务响应', 'yellow');
            return result;
          }
        }
        
        return result;
      } else if (status === 'FAILED') {
        throw new Error(`转录失败: ${result.output?.message || '未知错误'}`);
      } else {
        const progress = Math.min(Math.floor((i / maxAttempts) * 100), 95);
        process.stdout.write(`\r状态: ${status || 'PROCESSING'} - 进度: ${progress}% - 尝试 ${i + 1}/${maxAttempts}`);
      }
    } catch (error) {
      if (error.message.includes('转录失败')) {
        throw error;
      }
      log(`\n查询出错，继续尝试: ${error.message}`, 'yellow');
    }
  }
  
  throw new Error('转录超时');
}

/**
 * 步骤4: 生成带时间戳的Markdown文件
 */
async function generateTimestampedMarkdown(transcriptionResult, videoPath) {
  log('\n=== 步骤4: 生成带时间戳的Markdown文件 ===', 'bright');
  
  try {
    let sentences = [];
    
    // 尝试从不同的位置提取转录结果
    if (transcriptionResult.transcription) {
      // 直接的转录结果
      sentences = transcriptionResult.transcription;
    } else if (transcriptionResult.output?.transcription) {
      // 嵌套在output中
      sentences = transcriptionResult.output.transcription;
    } else if (transcriptionResult.sentences) {
      // 直接的sentences字段
      sentences = transcriptionResult.sentences;
    } else if (Array.isArray(transcriptionResult)) {
      // 直接是数组
      sentences = transcriptionResult;
    } else {
      log('转录结果格式未知，尝试解析...', 'yellow');
      console.log('原始数据结构:', JSON.stringify(transcriptionResult, null, 2).substring(0, 500));
      
      // 如果没有找到标准格式，创建一个默认的
      sentences = [{
        text: '转录结果格式不标准，请查看JSON文件获取原始数据',
        begin_time: 0,
        end_time: 0
      }];
    }
    
    const videoName = path.basename(videoPath, path.extname(videoPath));
    const outputDir = path.dirname(videoPath);
    const mdFilePath = path.join(outputDir, `${videoName}-转录文本.md`);
    
    // 构建Markdown内容
    let mdContent = `# 视频转录文本\n\n`;
    mdContent += `**文件名**: ${path.basename(videoPath)}\n`;
    mdContent += `**转录时间**: ${new Date().toISOString()}\n`;
    mdContent += `**总句数**: ${sentences.length}\n\n`;
    mdContent += `---\n\n`;
    mdContent += `## 带时间戳的转录内容\n\n`;
    
    // 添加每句话的时间戳和内容
    sentences.forEach((sentence, index) => {
      const startTime = formatTimestamp(sentence.begin_time || sentence.start_time || 0);
      const endTime = formatTimestamp(sentence.end_time || 0);
      const text = sentence.text || sentence.transcript || '(无文本)';
      
      mdContent += `### 句子 ${index + 1}: [${startTime} - ${endTime}]\n\n`;
      mdContent += `${text}\n\n`;
    });
    
    // 添加完整文本
    mdContent += `---\n\n`;
    mdContent += `## 完整文本（无时间戳）\n\n`;
    const fullText = sentences.map(s => s.text || s.transcript || '').join(' ');
    mdContent += `${fullText}\n\n`;
    
    // 添加统计信息
    mdContent += `---\n\n`;
    mdContent += `## 统计信息\n\n`;
    const lastSentence = sentences[sentences.length - 1] || {};
    const totalDuration = lastSentence.end_time || 0;
    mdContent += `- **总时长**: ${formatTimestamp(totalDuration)}\n`;
    mdContent += `- **总字数**: ${fullText.length}\n`;
    mdContent += `- **总句数**: ${sentences.length}\n`;
    mdContent += `- **平均每句字数**: ${sentences.length > 0 ? Math.round(fullText.length / sentences.length) : 0}\n`;
    
    // 写入文件
    fs.writeFileSync(mdFilePath, mdContent, 'utf8');
    log(`✓ Markdown文件已生成: ${mdFilePath}`, 'green');
    
    // 同时生成JSON格式保存原始数据
    const jsonFilePath = path.join(outputDir, `${videoName}-转录数据.json`);
    fs.writeFileSync(jsonFilePath, JSON.stringify(transcriptionResult, null, 2), 'utf8');
    log(`✓ JSON数据已保存: ${jsonFilePath}`, 'green');
    
    // 生成SRT字幕文件
    const srtFilePath = path.join(outputDir, `${videoName}.srt`);
    let srtContent = '';
    sentences.forEach((sentence, index) => {
      const startTime = formatSRTTime((sentence.begin_time || sentence.start_time || 0));
      const endTime = formatSRTTime((sentence.end_time || 0));
      const text = sentence.text || sentence.transcript || '';
      srtContent += `${index + 1}\n`;
      srtContent += `${startTime} --> ${endTime}\n`;
      srtContent += `${text}\n\n`;
    });
    fs.writeFileSync(srtFilePath, srtContent, 'utf8');
    log(`✓ SRT字幕文件已生成: ${srtFilePath}`, 'green');
    
    return {
      mdFilePath,
      jsonFilePath,
      srtFilePath,
      sentenceCount: sentences.length,
      totalDuration: totalDuration
    };
    
  } catch (error) {
    log(`✗ 生成文件失败: ${error.message}`, 'red');
    throw error;
  }
}

function formatSRTTime(seconds) {
  if (isNaN(seconds) || seconds === null || seconds === undefined) {
    return '00:00:00,000';
  }
  
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

/**
 * 主函数
 */
async function main() {
  console.clear();
  log('🎬 视频转录完整测试流程', 'bright');
  log('================================\n', 'bright');
  
  const startTime = Date.now();
  
  try {
    // 检查配置
    if (!ALIYUN_API_KEY) {
      throw new Error('ALIYUN_API_KEY未配置');
    }
    if (!ossConfig.accessKeyId || !ossConfig.accessKeySecret) {
      throw new Error('OSS配置缺失');
    }
    
    // 步骤1: 上传到OSS
    const uploadResult = await uploadToOSS(TEST_VIDEO);
    
    // 步骤2: 提交转录任务
    const taskId = await submitTranscriptionTask(uploadResult.signedUrl);
    
    // 步骤3: 轮询直到完成并获取结果
    const transcriptionResult = await pollTaskStatus(taskId);
    
    // 步骤4: 生成带时间戳的Markdown文件
    const fileResult = await generateTimestampedMarkdown(transcriptionResult, TEST_VIDEO);
    
    // 完成总结
    const totalTime = (Date.now() - startTime) / 1000;
    log('\n=== ✅ 测试完成 ===', 'bright');
    log(`总耗时: ${totalTime.toFixed(2)}秒`, 'green');
    log(`OSS路径: ${uploadResult.ossPath}`, 'cyan');
    log(`任务ID: ${taskId}`, 'cyan');
    log(`\n生成的文件:`, 'bright');
    log(`  📝 Markdown文本: ${fileResult.mdFilePath}`, 'cyan');
    log(`  📊 JSON数据: ${fileResult.jsonFilePath}`, 'cyan');
    log(`  🎬 SRT字幕: ${fileResult.srtFilePath}`, 'cyan');
    log(`\n统计信息:`, 'bright');
    log(`  总句数: ${fileResult.sentenceCount}`, 'cyan');
    log(`  视频时长: ${formatTimestamp(fileResult.totalDuration)}`, 'cyan');
    
  } catch (error) {
    log('\n❌ 测试失败', 'red');
    log(error.message, 'red');
    if (error.stack) {
      console.error('\n错误堆栈:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// 运行测试
main();