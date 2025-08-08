import dotenv from 'dotenv'
dotenv.config()

export default {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret',
    expireTime: process.env.JWT_EXPIRE_TIME || '24h'
  },
  
  terminal: {
    maxSessions: parseInt(process.env.MAX_TERMINAL_SESSIONS) || 10,
    timeout: parseInt(process.env.TERMINAL_TIMEOUT) || 600000
  },
  
  cors: {
    origins: process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:5173', 
      'http://localhost:5174', 
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
      'http://127.0.0.1:3000',
      'http://0.0.0.0:5173',
      'http://0.0.0.0:5174',
      'http://0.0.0.0:3000',
      'http://188.8.9.99:5173',
      'http://8.130.86.152',
      'http://8.130.86.152:5173',
      'http://card.paitongai.com',
      'https://card.paitongai.com',
      'http://card.paitongai.com:80',
      'http://ai-terminal-xnbmzvtedv.ap-northeast-1.fcapp.run',
      'https://ai-terminal-xnbmzvtedv.ap-northeast-1.fcapp.run'
    ]
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info'
  }
}