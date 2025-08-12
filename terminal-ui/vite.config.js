import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        // 开发阶段保留 console/debugger 以便排查问题
        drop_console: false,
        drop_debugger: false
      }
    }
  },
  server: {
    host: '0.0.0.0',  // 监听所有网络接口
    port: 5173,
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      'card.paitongai.com',
      '.paitongai.com',  // 允许所有子域名
      '8.130.86.152',
      '188.8.9.99'
    ],
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:6000',
        changeOrigin: true,
        rewrite: (path) => path
      },
      // 代理 Socket.IO 到后端（开发模式下前端同源连接到5173，再由Vite转发到6000）
      '/socket.io': {
        target: process.env.VITE_API_URL || 'http://localhost:6000',
        changeOrigin: true,
        ws: true
      },
      // 代理原生 WebSocket
      '/ws': {
        target: process.env.VITE_API_URL || 'http://localhost:6000',
        changeOrigin: true,
        ws: true
      }
    }
  }
})
