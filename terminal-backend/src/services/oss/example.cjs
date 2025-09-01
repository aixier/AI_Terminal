/**
 * OSS服务使用示例
 */

const { OSSService } = require('./index');
const path = require('path');

async function examples() {
  // 1. 初始化服务
  console.log('=== 初始化OSS服务 ===');
  const ossService = new OSSService('tugo', {
    retryCount: 3,
    retryDelay: 1000
  });

  try {
    // 2. 上传HTML示例
    console.log('\n=== 上传HTML内容 ===');
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>TuGo Generated Page</title>
        <meta charset="UTF-8">
      </head>
      <body>
        <h1>Hello from TuGo!</h1>
        <p>This page was generated at ${new Date().toISOString()}</p>
      </body>
      </html>
    `;
    
    const htmlResult = await ossService.uploadHTML(
      htmlContent,
      'example-page.html',
      { customDir: 'examples' }
    );
    console.log('HTML上传成功:', htmlResult.url);

    // 3. 上传Buffer示例
    console.log('\n=== 上传Buffer数据 ===');
    const jsonData = {
      name: 'TuGo',
      version: '1.0.0',
      timestamp: Date.now()
    };
    const jsonBuffer = Buffer.from(JSON.stringify(jsonData, null, 2));
    
    const bufferResult = await ossService.uploadBuffer(
      jsonBuffer,
      'data.json',
      { 
        customDir: 'examples/json',
        headers: { 'Content-Type': 'application/json' }
      }
    );
    console.log('JSON上传成功:', bufferResult.url);

    // 4. 检查文件存在
    console.log('\n=== 检查文件存在 ===');
    const exists = await ossService.exists(htmlResult.name);
    console.log(`文件 ${htmlResult.name} 存在:`, exists);

    // 5. 获取文件元信息
    console.log('\n=== 获取文件元信息 ===');
    const metadata = await ossService.getMetadata(htmlResult.name);
    console.log('文件大小:', metadata.size, 'bytes');
    console.log('最后修改:', metadata.lastModified);
    console.log('ETag:', metadata.etag);

    // 6. 生成签名URL
    console.log('\n=== 生成签名URL ===');
    const signedUrl = await ossService.generateSignedUrl(
      htmlResult.name,
      3600 // 1小时有效
    );
    console.log('签名URL:', signedUrl.url);
    console.log('过期时间:', signedUrl.expires);

    // 7. 列出文件
    console.log('\n=== 列出文件 ===');
    const listResult = await ossService.list('tugo/examples/', {
      'max-keys': 10
    });
    console.log(`找到 ${listResult.objects.length} 个文件:`);
    listResult.objects.forEach(obj => {
      console.log(`  - ${obj.name} (${obj.size} bytes)`);
    });

    // 8. 下载文件内容
    console.log('\n=== 下载文件内容 ===');
    const downloadResult = await ossService.getBuffer(bufferResult.name);
    const downloadedData = JSON.parse(downloadResult.buffer.toString());
    console.log('下载的JSON数据:', downloadedData);

    // 9. 批量操作示例
    console.log('\n=== 批量上传示例 ===');
    const batchFiles = [];
    for (let i = 1; i <= 3; i++) {
      const content = `Test file ${i} content`;
      const result = await ossService.uploadBuffer(
        Buffer.from(content),
        `test-${i}.txt`,
        { customDir: 'examples/batch' }
      );
      batchFiles.push(result.name);
      console.log(`上传文件 ${i}:`, result.url);
    }

    // 10. 清理示例文件（可选）
    console.log('\n=== 清理示例文件 ===');
    const cleanup = false; // 设置为true以删除示例文件
    if (cleanup) {
      await ossService.deleteMultiple([
        htmlResult.name,
        bufferResult.name,
        ...batchFiles
      ]);
      console.log('示例文件已清理');
    } else {
      console.log('跳过清理（设置cleanup=true以删除示例文件）');
    }

  } catch (error) {
    console.error('错误:', error.message);
    if (error.code) {
      console.error('错误代码:', error.code);
    }
  }
}

// 分片上传大文件示例
async function multipartUploadExample() {
  console.log('\n=== 分片上传示例 ===');
  
  const ossService = new OSSService('tugo');
  
  // 模拟大文件上传（实际使用时替换为真实文件路径）
  const largeFilePath = '/path/to/large-file.zip';
  
  try {
    const result = await ossService.upload(largeFilePath, {
      customDir: 'large-files',
      onProgress: ({ progress, uploaded, total }) => {
        console.log(`上传进度: ${progress}% (${uploaded}/${total} 分片)`);
      }
    });
    
    console.log('大文件上传成功:', result.url);
    console.log('文件大小:', result.fileSize, 'bytes');
    console.log('分片数:', result.parts);
    
  } catch (error) {
    console.error('分片上传失败:', error.message);
  }
}

// STS凭证示例
async function stsExample() {
  console.log('\n=== STS凭证示例 ===');
  
  // 初始化带STS的服务
  const stsOSS = new OSSService('default', {
    stsConfig: {
      roleArn: process.env.STS_ROLE_ARN
    }
  });
  
  try {
    // 获取前端上传凭证
    const uploadCreds = await stsOSS.getUploadCredentials({
      directory: 'user-uploads',
      maxSize: 5 * 1024 * 1024, // 5MB
      allowedTypes: ['image/*'],
      durationSeconds: 1800 // 30分钟
    });
    
    console.log('前端上传凭证:');
    console.log('- AccessKeyId:', uploadCreds.accessKeyId);
    console.log('- Bucket:', uploadCreds.bucket);
    console.log('- Region:', uploadCreds.region);
    console.log('- Directory:', uploadCreds.directory);
    console.log('- 过期时间:', uploadCreds.expiration);
    
  } catch (error) {
    console.error('STS错误:', error.message);
  }
}

// 运行示例
if (require.main === module) {
  console.log('开始运行OSS服务示例...\n');
  
  examples()
    .then(() => {
      console.log('\n✅ 所有示例运行完成!');
    })
    .catch(error => {
      console.error('\n❌ 示例运行失败:', error);
    });
}