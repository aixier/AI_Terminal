import fs from 'fs/promises'
import { createWriteStream } from 'fs'
import path from 'path'
import { pipeline } from 'stream/promises'
import { spawn } from 'child_process'
import fetch from 'node-fetch'
import { createRequire } from 'module'
import config from '../../config/config.js'
import logger from '../../utils/logger.js'
import FrameExtractor from '../youtube2post/frameExtractor.js'
import VideoSegmenter from './videoSegmenter.js'
import {
  markProcessing,
  setStage,
  completeJob,
  failJob,
  getJobInternal
} from './jobStore.js'
import { parseSubtitleFile, selectHighlights } from './subtitleParser.js'

const require = createRequire(import.meta.url)
const { OSSService } = require('../oss/index.cjs')

const ensureDir = dir => fs.mkdir(dir, { recursive: true })

const detectExtension = (input, fallback) => {
  if (!input) return fallback
  try {
    const url = new URL(input)
    const ext = path.extname(url.pathname)
    return ext || fallback
  } catch (error) {
    const ext = path.extname(input)
    return ext || fallback
  }
}

async function downloadFile(sourceUrl, targetPath) {
  if (!sourceUrl) {
    const error = new Error('Missing source URL for download')
    error.code = 'VIDEO_DECOMPOSE_MISSING_SOURCE'
    throw error
  }

  let parsed = null
  try {
    parsed = new URL(sourceUrl)
  } catch (error) {
    parsed = null
  }

  await ensureDir(path.dirname(targetPath))

  if (parsed?.protocol === 'file:' || (!parsed && path.isAbsolute(sourceUrl))) {
    const filePath = parsed
      ? decodeURIComponent(parsed.pathname)
      : sourceUrl
    await fs.copyFile(filePath, targetPath)
    return targetPath
  }

  if (!parsed || (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')) {
    const error = new Error(`Unsupported source URL protocol: ${sourceUrl}`)
    error.code = 'VIDEO_DECOMPOSE_UNSUPPORTED_PROTOCOL'
    throw error
  }

  const response = await fetch(sourceUrl)
  if (!response.ok) {
    const error = new Error(`Failed to download ${sourceUrl}: ${response.status}`)
    error.code = 'VIDEO_DECOMPOSE_DOWNLOAD_FAILED'
    error.details = { status: response.status, statusText: response.statusText }
    throw error
  }

  const writeStream = createWriteStream(targetPath)
  await pipeline(response.body, writeStream)
  return targetPath
}

const toJsonl = items => items.map(item => JSON.stringify(item)).join('\n')

async function createCompilationVideo(clips, outputPath, options = {}) {
  const { ffmpegPath } = options
  const clipsListPath = outputPath.replace(/\.[^/.]+$/, '.txt')

  // 创建包含所有视频片段的文件列表
  const fileListContent = clips.map(clip => `file '${clip}'`).join('\n')
  await fs.writeFile(clipsListPath, fileListContent)

  // 使用ffmpeg合并视频片段
  const args = [
    '-f', 'concat',
    '-safe', '0',
    '-i', clipsListPath,
    '-c', 'copy',
    '-y',  // 覆盖输出文件
    outputPath
  ]

  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, {
      stdio: ['ignore', 'ignore', 'pipe']
    })

    let stderr = ''
    child.stderr.on('data', chunk => {
      stderr += chunk.toString()
    })

    child.on('error', error => {
      reject(new Error(`ffmpeg process error: ${error.message}`))
    })

    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`ffmpeg killed by signal: ${signal}`))
      } else if (code !== 0) {
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`))
      } else {
        resolve(outputPath)
      }
    })
  })
}

async function createCompilationWithSubtitles(clips, outputPath, options = {}) {
  const { ffmpegPath, subtitles = [] } = options

  if (clips.length === 0) {
    throw new Error('No clips provided for compilation')
  }

  // 创建包含所有视频片段的文件列表
  const clipsListPath = outputPath.replace(/\.[^/.]+$/, '_clips.txt')
  const fileListContent = clips.map(clip => `file '${clip}'`).join('\n')
  await fs.writeFile(clipsListPath, fileListContent)

  // 如果没有字幕，直接合并视频
  if (!subtitles || subtitles.length === 0) {
    return createCompilationVideo(clips, outputPath, { ffmpegPath })
  }

  // 创建字幕文件
  const subtitlePath = outputPath.replace(/\.[^/.]+$/, '.srt')
  let subtitleIndex = 1
  const subtitleContent = subtitles.map(sub => {
    const startTime = formatSRTTime(sub.startTime)
    const endTime = formatSRTTime(sub.endTime)
    return `${subtitleIndex++}\n${startTime} --> ${endTime}\n${sub.text}\n`
  }).join('\n')

  await fs.writeFile(subtitlePath, subtitleContent)

  // 使用ffmpeg合并视频并添加字幕
  const args = [
    '-f', 'concat',
    '-safe', '0',
    '-i', clipsListPath,
    '-i', subtitlePath,
    '-c', 'copy',
    '-c:s', 'mov_text',
    '-map', '0:v:0',
    '-map', '0:a:0',
    '-map', '1:s:0',
    '-y',  // 覆盖输出文件
    outputPath
  ]

  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, {
      stdio: ['ignore', 'ignore', 'pipe']
    })

    let stderr = ''
    child.stderr.on('data', chunk => {
      stderr += chunk.toString()
    })

    child.on('error', error => {
      reject(new Error(`ffmpeg process error: ${error.message}`))
    })

    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`ffmpeg killed by signal: ${signal}`))
      } else if (code !== 0) {
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`))
      } else {
        resolve(outputPath)
      }
    })
  })
}

function formatSRTTime(seconds) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`
}

async function cleanup(paths, keep) {
  if (keep) return
  await Promise.all(
    paths.map(async target => {
      try {
        await fs.rm(target, { recursive: true, force: true })
      } catch (error) {
        logger.warn(`[videoDecompose] Cleanup failed for ${target}: ${error.message}`)
      }
    })
  )
}

const PLACEHOLDER_IMAGE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=',
  'base64'
)

async function writePlaceholderImage(targetPath) {
  await ensureDir(path.dirname(targetPath))
  await fs.writeFile(targetPath, PLACEHOLDER_IMAGE)
  return targetPath
}

async function copyAsPlaceholderVideo(sourcePath, targetPath) {
  await ensureDir(path.dirname(targetPath))
  await fs.copyFile(sourcePath, targetPath)
  return targetPath
}

export default async function processJob(job) {
  if (!job) return
  const jobId = job.id
  const record = getJobInternal(jobId)
  if (!record) return

  const videoConfig = config.videoDecompose
  const tempDir = path.join(videoConfig.tempRoot, jobId)
  const workspaceDir = path.join(videoConfig.workspaceRoot, jobId)
  const outputDir = path.join(videoConfig.outputRoot, jobId)
  const screenshotsDir = path.join(outputDir, 'screenshots')
  const clipsDir = path.join(outputDir, 'clips')
  const allowPlaceholder = process.env.VIDEO_DECOMPOSE_PLACEHOLDER === 'true'

  try {
    markProcessing(jobId)
    setStage(jobId, 'initializing', 5, 'Initializing workspace directories')

    await Promise.all([
      ensureDir(tempDir),
      ensureDir(workspaceDir),
      ensureDir(outputDir),
      ensureDir(screenshotsDir),
      ensureDir(clipsDir)
    ])

    setStage(jobId, 'downloading_assets', 15, 'Downloading source video and subtitles')

    const videoExt = detectExtension(record.videoUrl, '.mp4')
    const subtitleExt = detectExtension(record.subtitleUrl, '.srt')

    const localVideoPath = path.join(tempDir, `source${videoExt}`)
    const localSubtitlePath = path.join(tempDir, `subtitle${subtitleExt}`)

    await downloadFile(record.videoUrl, localVideoPath)
    await downloadFile(record.subtitleUrl, localSubtitlePath)

    setStage(jobId, 'parsing_subtitle', 30, 'Parsing subtitle file')
    const segments = await parseSubtitleFile(localSubtitlePath)

    if (!segments || segments.length === 0) {
      const error = new Error('No subtitle segments found')
      error.code = 'VIDEO_DECOMPOSE_NO_SUBTITLES'
      throw error
    }

    setStage(jobId, 'extracting_highlights', 45, 'Selecting highlight quotes')
    const highlights = selectHighlights(segments, {
      maxHighlights: record.options.maxHighlights || videoConfig.maxHighlights,
      minQuoteLength: record.options.minQuoteLength || videoConfig.minQuoteLength
    })

    if (!highlights || highlights.length === 0) {
      const error = new Error('No highlight segments matched selection criteria')
      error.code = 'VIDEO_DECOMPOSE_NO_HIGHLIGHTS'
      throw error
    }

    const frameExtractor = new FrameExtractor({
      ffmpegPath: videoConfig.ffmpegPath,
      quality: videoConfig.screenshotQuality,
      scaleFilter: videoConfig.frameScaleFilter
    })
    const segmenter = new VideoSegmenter({
      ffmpegPath: videoConfig.ffmpegPath,
      clipPreset: videoConfig.clipPreset,
      clipCrf: videoConfig.clipCrf,
      defaultDuration: 8
    })

    const ossService = new OSSService('videoDecompose', {
      baseDir: videoConfig.ossBaseDir,
      structure: {
        clips: 'clips',
        screenshots: 'screenshots',
        temp: 'temp'
      }
    })

    const results = []
    const total = highlights.length
    const processingBase = 55
    const processingSpan = 35

    for (let index = 0; index < total; index += 1) {
      const highlight = highlights[index]
      const position = index + 1
      const progress = processingBase + Math.floor((index / total) * processingSpan)

      setStage(jobId, 'generating_assets', progress, `Processing highlight ${position}/${total}`)

      const frameName = `shot_${String(position).padStart(2, '0')}.jpg`
      const clipName = `clip_${String(position).padStart(2, '0')}.mp4`
      const framePath = path.join(screenshotsDir, frameName)
      const clipPath = path.join(clipsDir, clipName)

      const captureTimestamp = highlight.duration > 0
        ? highlight.start + highlight.duration / 2
        : highlight.start

      try {
        await frameExtractor.capture({
          videoPath: localVideoPath,
          timestamp: Math.max(0, captureTimestamp),
          outputPath: framePath
        })
      } catch (error) {
        if (!allowPlaceholder) {
          throw error
        }
        await writePlaceholderImage(framePath)
      }

      try {
        await segmenter.extract({
          videoPath: localVideoPath,
          start: highlight.start,
          end: highlight.end,
          duration: highlight.duration,
          padding: record.options.clipPaddingSeconds ?? videoConfig.clipPaddingSeconds,
          outputPath: clipPath
        })
      } catch (error) {
        if (!allowPlaceholder) {
          throw error
        }
        await copyAsPlaceholderVideo(localVideoPath, clipPath)
      }

      const uploadProgress = processingBase + Math.floor(((index + 0.5) / total) * processingSpan)
      setStage(jobId, 'uploading_assets', uploadProgress, `Uploading highlight ${position}/${total}`)

      const screenshotRemote = `${videoConfig.ossBaseDir}/${jobId}/screenshots/${frameName}`
      const clipRemote = `${videoConfig.ossBaseDir}/${jobId}/clips/${clipName}`

      await ossService.upload(framePath, {
        remotePath: screenshotRemote,
        headers: {
          'Content-Type': 'image/jpeg',
          'x-oss-object-acl': 'public-read'
        }
      })

      await ossService.upload(clipPath, {
        remotePath: clipRemote,
        headers: {
          'Content-Type': 'video/mp4',
          'x-oss-object-acl': 'public-read'
        }
      })

      const screenshotUrl = await ossService.generateSignedUrl(screenshotRemote, 24 * 3600)
      const clipUrl = await ossService.generateSignedUrl(clipRemote, 24 * 3600)

      results.push({
        quote: highlight.text,
        startTime: highlight.start,
        endTime: highlight.end,
        duration: highlight.duration,
        screenshotUrl: typeof screenshotUrl === 'string' ? screenshotUrl : screenshotUrl.url,
        videoUrl: typeof clipUrl === 'string' ? clipUrl : clipUrl.url
      })
    }

    // 检查是否需要创建合成视频
    let compilationVideoUrl = null
    if (record.options.createCompilation && results.length > 0) {
      setStage(jobId, 'creating_compilation', 92, 'Creating compilation video')

      try {
        const compilationName = `compilation_${jobId}.mp4`
        const compilationPath = path.join(outputDir, compilationName)

        // 收集所有片段路径
        const clipPaths = results.map((_, index) => {
          const position = index + 1
          return path.join(clipsDir, `clip_${String(position).padStart(2, '0')}.mp4`)
        })

        // 创建字幕数据
        const subtitles = results.map(item => ({
          startTime: item.startTime,
          endTime: item.endTime,
          text: item.quote
        }))

        // 创建带字幕的合成视频
        await createCompilationWithSubtitles(clipPaths, compilationPath, {
          ffmpegPath: videoConfig.ffmpegPath,
          subtitles
        })

        // 上传合成视频
        setStage(jobId, 'uploading_compilation', 94, 'Uploading compilation video')

        const compilationRemote = `${videoConfig.ossBaseDir}/${jobId}/${compilationName}`
        await ossService.upload(compilationPath, {
          remotePath: compilationRemote,
          headers: {
            'Content-Type': 'video/mp4',
            'x-oss-object-acl': 'public-read'
          }
        })

        const compilationResult = await ossService.generateSignedUrl(compilationRemote, 24 * 3600)
        compilationVideoUrl = typeof compilationResult === 'string' ? compilationResult : compilationResult.url

      } catch (error) {
        logger.warn(`[videoDecompose] Failed to create compilation video for ${jobId}: ${error.message}`)
        // 不让合成视频失败影响整个任务
      }
    }

    setStage(jobId, 'finalizing', 95, 'Finalizing result payload')

    const jsonl = toJsonl(
      results.map(item => ({
        quote: item.quote,
        screenshotUrl: item.screenshotUrl,
        videoUrl: item.videoUrl,
        startTime: item.startTime
      }))
    )

    const finalResult = {
      count: results.length,
      items: results,
      jsonl
    }

    // 如果有合成视频，添加到结果中
    if (compilationVideoUrl) {
      finalResult.compilationVideo = {
        url: compilationVideoUrl,
        duration: results.reduce((total, item) => total + (item.duration || 0), 0),
        clipCount: results.length
      }
    }

    completeJob(jobId, finalResult)

    await cleanup([tempDir, workspaceDir, outputDir], videoConfig.keepTemp)
  } catch (error) {
    logger.error(`[videoDecompose] Job ${jobId} failed: ${error.message}`, {
      code: error.code,
      stack: error.stack
    })
    failJob(jobId, error)
    await cleanup([tempDir, workspaceDir, outputDir], videoConfig.keepTemp)
  }
}
