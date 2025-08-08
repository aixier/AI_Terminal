/**
 * 后端启动脚本 - 带调试信息
 */

import('./src/index.js').then(() => {
  console.log('✅ Backend started successfully');
}).catch(error => {
  console.error('❌ Failed to start backend:', error);
  process.exit(1);
});