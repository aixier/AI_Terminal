import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config()

const toNumber = (value, fallback) => {
  const parsed = parseInt(value, 10)
  return Number.isNaN(parsed) ? fallback : parsed
}

const parseArgs = value => {
  if (!value) return null
  return value
    .split(/\s+/)
    .map(item => item.trim())
    .filter(Boolean)
}

const parseOptional = value => (value && value.trim()) || null

const resolvePath = (value, fallback) => {
  if (!value) return fallback
  return path.isAbsolute(value) ? value : path.join(process.cwd(), value)
}

const ensureDir = dir => {
  try {
    fs.mkdirSync(dir, { recursive: true })
  } catch (error) {
    console.warn(`[config] Could not ensure directory ${dir}: ${error.message}`)
  }
}

const workspaceRoot = resolvePath(
  process.env.YOUTUBE2POST_WORKSPACE_ROOT,
  path.join(process.cwd(), 'terminal-backend/data/users/default/workspace/card')
)
const tempRoot = resolvePath(
  process.env.YOUTUBE2POST_TEMP_ROOT,
  path.join(process.cwd(), 'terminal-backend/data/tmp/youtube2post')
)
const dataRoot = resolvePath(
  process.env.YOUTUBE2POST_DATA_ROOT,
  path.join(process.cwd(), 'terminal-backend/data/youtube2post')
)
const templateRoot = resolvePath(
  process.env.YOUTUBE2POST_TEMPLATE_ROOT,
  path.join(process.cwd(), 'terminal-backend/data/public_template/youtube2post')
)

ensureDir(workspaceRoot)
ensureDir(tempRoot)
ensureDir(dataRoot)

const videoDecomposeWorkspaceRoot = resolvePath(
  process.env.VIDEO_DECOMPOSE_WORKSPACE_ROOT,
  path.join(process.cwd(), 'terminal-backend/data/users/default/workspace/video-decompose')
)
const videoDecomposeTempRoot = resolvePath(
  process.env.VIDEO_DECOMPOSE_TEMP_ROOT,
  path.join(process.cwd(), 'terminal-backend/data/tmp/video-decompose')
)
const videoDecomposeOutputRoot = resolvePath(
  process.env.VIDEO_DECOMPOSE_OUTPUT_ROOT,
  path.join(process.cwd(), 'terminal-backend/data/video-decompose')
)

ensureDir(videoDecomposeWorkspaceRoot)
ensureDir(videoDecomposeTempRoot)
ensureDir(videoDecomposeOutputRoot)

const youtube2postConfig = {
  workerEnabled: process.env.YOUTUBE2POST_WORKER_ENABLED !== 'false',
  maxConcurrentTasks: toNumber(process.env.YOUTUBE2POST_MAX_CONCURRENT, 1),
  maxPendingTasks: toNumber(process.env.YOUTUBE2POST_MAX_PENDING, 20),
  pollIntervalMs: toNumber(process.env.YOUTUBE2POST_POLL_INTERVAL_MS, 5000),
  lockTtlMs: toNumber(process.env.YOUTUBE2POST_LOCK_TTL_MS, 10 * 60 * 1000),
  youtubeDlPath: process.env.YOUTUBE2POST_YOUTUBE_DL_PATH || path.join(process.cwd(), 'youtube-dl', 'bin', 'youtube-dl'),
  downloadTimeoutMs: toNumber(process.env.YOUTUBE2POST_DOWNLOAD_TIMEOUT_MS, 10 * 60 * 1000),
  youtubeDlArgs: parseArgs(process.env.YOUTUBE2POST_YOUTUBE_DL_ARGS) || ['-f', 'best'],
  ffmpegPath: process.env.YOUTUBE2POST_FFMPEG_PATH || 'ffmpeg',
  maxQuotes: toNumber(process.env.YOUTUBE2POST_MAX_QUOTES, 5),
  frameExtractionTimeoutMs: toNumber(process.env.YOUTUBE2POST_FRAME_TIMEOUT_MS, 60 * 1000),
  frameQuality: toNumber(process.env.YOUTUBE2POST_FRAME_QUALITY, 2),
  frameScaleFilter: parseOptional(process.env.YOUTUBE2POST_FRAME_SCALE_FILTER),
  transcriptionPollIntervalMs: toNumber(process.env.YOUTUBE2POST_TRANSCRIPTION_POLL_MS, 5000),
  transcriptionMaxAttempts: toNumber(process.env.YOUTUBE2POST_TRANSCRIPTION_MAX_ATTEMPTS, 120),
  ossEnabled: process.env.YOUTUBE2POST_OSS_ENABLED === 'true',
  ossProject: process.env.YOUTUBE2POST_OSS_PROJECT || 'youtube2post',
  ossBaseDir: process.env.YOUTUBE2POST_OSS_BASE_DIR || 'youtube2post',
  publicBaseUrl: process.env.YOUTUBE2POST_PUBLIC_BASE_URL || null,
  workspaceRoot,
  tempRoot,
  dataRoot,
  templateRoot
}

const videoDecomposeConfig = {
  ffmpegPath: process.env.VIDEO_DECOMPOSE_FFMPEG_PATH
    || process.env.YOUTUBE2POST_FFMPEG_PATH
    || 'ffmpeg',
  screenshotQuality: toNumber(process.env.VIDEO_DECOMPOSE_SCREENSHOT_QUALITY, 2),
  frameScaleFilter: parseOptional(process.env.VIDEO_DECOMPOSE_FRAME_SCALE_FILTER),
  clipPreset: process.env.VIDEO_DECOMPOSE_FFMPEG_PRESET || 'fast',
  clipCrf: toNumber(process.env.VIDEO_DECOMPOSE_FFMPEG_CRF, 23),
  maxHighlights: toNumber(process.env.VIDEO_DECOMPOSE_MAX_HIGHLIGHTS, 5),
  minQuoteLength: toNumber(process.env.VIDEO_DECOMPOSE_MIN_QUOTE_LENGTH, 12),
  clipPaddingSeconds: Number.isNaN(Number(process.env.VIDEO_DECOMPOSE_CLIP_PADDING))
    ? 0.5
    : Number(process.env.VIDEO_DECOMPOSE_CLIP_PADDING),
  ossBaseDir: process.env.VIDEO_DECOMPOSE_OSS_BASE_DIR || 'video-decompose',
  keepTemp: process.env.VIDEO_DECOMPOSE_KEEP_TEMP === 'true',
  workspaceRoot: videoDecomposeWorkspaceRoot,
  tempRoot: videoDecomposeTempRoot,
  outputRoot: videoDecomposeOutputRoot
}

export default {
  port: process.env.PORT || 6000,
  nodeEnv: process.env.NODE_ENV || 'development',

  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret',
    expireTime: process.env.JWT_EXPIRE_TIME || '24h'
  },

  aliyun: {
    apiKey: process.env.DASHSCOPE_API_KEY
      || process.env.ALIYUN_API_KEY
      || 'sk-4c89a24b73d24731b86bf26337398cef'
  },

  terminal: {
    maxSessions: toNumber(process.env.MAX_TERMINAL_SESSIONS, 10),
    timeout: toNumber(process.env.TERMINAL_TIMEOUT, 600000)
  },

  cors: {
    origins: process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:6000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
      'http://127.0.0.1:6000',
      'http://0.0.0.0:5173',
      'http://0.0.0.0:5174',
      'http://0.0.0.0:6000',
      'http://188.8.9.99:5173',
      'http://8.130.86.152',
      'http://8.130.86.152:5173',
      'http://8.130.86.152:8100',
      'http://8.130.86.152:8083',
      'http://card.paitongai.com',
      'https://card.paitongai.com',
      'http://card.paitongai.com:80',
      'http://cardapi.paitongai.com',
      'https://cardapi.paitongai.com',
      'http://aicard.paitongai.com',
      'https://aicard.paitongai.com',
      'http://ai-terminal-xnbmzvtedv.ap-northeast-1.fcapp.run',
      'https://ai-terminal-xnbmzvtedv.ap-northeast-1.fcapp.run'
    ]
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info'
  },

  llm: {
    qwen: {
      enabled: true,
      apiKey: process.env.QWEN_API_KEY || 'sk-4c89a24b73d24731b86bf26337398cef',
      baseUrl: 'https://dashscope.aliyuncs.com/api/v1',
      model: 'qwen-max',
      temperature: 0.3,
      maxTokens: 8000,
      timeout: 90,
      maxRetries: 3,
      retryDelay: 3.0
    },
    'qwen-plus': {
      enabled: true,
      apiKey: process.env.QWEN_PLUS_API_KEY || 'sk-4c89a24b73d24731b86bf26337398cef',
      baseUrl: 'https://dashscope.aliyuncs.com/api/v1',
      model: 'qwen-plus',
      temperature: 0.3,
      maxTokens: 8000,
      timeout: 90,
      maxRetries: 3,
      retryDelay: 3.0,
      description: '阿里云通义千问Plus - 平衡性能和成本'
    }
  },

  youtube2post: youtube2postConfig,
  videoDecompose: videoDecomposeConfig
}
