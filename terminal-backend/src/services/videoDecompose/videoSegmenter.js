import fs from 'fs/promises'
import { constants as fsConstants } from 'fs'
import path from 'path'
import { spawn } from 'child_process'

class VideoSegmentError extends Error {
  constructor(message, code = 'VIDEO_SEGMENT_ERROR', details = null) {
    super(message)
    this.name = 'VideoSegmentError'
    this.code = code
    this.details = details
  }
}

const ensureDir = dir => fs.mkdir(dir, { recursive: true })

async function ensureExecutable(binaryPath) {
  const absolute = path.isAbsolute(binaryPath) ? binaryPath : path.join(process.cwd(), binaryPath)
  try {
    await fs.access(absolute, fsConstants.X_OK)
    return absolute
  } catch (error) {
    throw new VideoSegmentError(
      `ffmpeg binary not executable: ${absolute}`,
      'VIDEO_SEGMENT_FFMPEG_NOT_EXECUTABLE',
      { cause: error }
    )
  }
}

function runCommand(binary, args, { timeoutMs } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      stdio: ['ignore', 'ignore', 'pipe'],
      timeout: timeoutMs
    })

    let stderr = ''
    child.stderr.on('data', chunk => {
      stderr += chunk.toString()
    })

    child.on('error', error => {
      reject(
        new VideoSegmentError(
          `ffmpeg process error: ${error.message}`,
          'VIDEO_SEGMENT_FFMPEG_PROCESS',
          { cause: error }
        )
      )
    })

    child.on('close', code => {
      if (code === 0) {
        resolve({ stderr })
      } else {
        reject(
          new VideoSegmentError(
            `ffmpeg exited with code ${code}`,
            'VIDEO_SEGMENT_FFMPEG_FAILED',
            { exitCode: code, stderr }
          )
        )
      }
    })
  })
}

const toFixed = value => Number.parseFloat(value).toFixed(3)

export default class VideoSegmenter {
  constructor(options = {}) {
    this.ffmpegPath = options.ffmpegPath || 'ffmpeg'
    this.timeoutMs = options.timeoutMs || 5 * 60 * 1000
    this.defaultDuration = Number.isFinite(options.defaultDuration) ? options.defaultDuration : 6
    this.clipPreset = options.clipPreset || 'fast'
    this.clipCrf = Number.isFinite(options.clipCrf) ? options.clipCrf : 23
  }

  async ensureBinary() {
    if (!this._binary) {
      this._binary = await ensureExecutable(this.ffmpegPath)
    }
    return this._binary
  }

  async extract({ videoPath, start, end, duration, padding = 0.5, outputPath }) {
    if (!videoPath) {
      throw new VideoSegmentError('videoPath is required', 'VIDEO_SEGMENT_MISSING_VIDEO')
    }
    if (!outputPath) {
      throw new VideoSegmentError('outputPath is required', 'VIDEO_SEGMENT_MISSING_OUTPUT')
    }

    const ffmpeg = await this.ensureBinary()
    await ensureDir(path.dirname(outputPath))

    const safeStart = Number.isFinite(start) ? Math.max(0, start) : 0
    const safeEnd = Number.isFinite(end) && end > safeStart ? end : null
    const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : null

    const clipStart = Math.max(0, safeStart - (Number.isFinite(padding) ? padding : 0))
    const targetEnd = safeEnd ?? (safeStart + (safeDuration ?? this.defaultDuration))
    const clipDuration = Math.max(1, targetEnd - clipStart)

    const copyArgs = [
      '-hide_banner',
      '-loglevel',
      'error',
      '-ss',
      toFixed(clipStart),
      '-i',
      videoPath,
      '-t',
      toFixed(clipDuration),
      '-c',
      'copy',
      outputPath
    ]

    try {
      await runCommand(ffmpeg, copyArgs, { timeoutMs: this.timeoutMs })
    } catch (copyError) {
      const encodeArgs = [
        '-hide_banner',
        '-loglevel',
        'error',
        '-ss',
        toFixed(clipStart),
        '-i',
        videoPath,
        '-t',
        toFixed(clipDuration),
        '-c:v',
        'libx264',
        '-preset',
        this.clipPreset,
        '-crf',
        String(this.clipCrf),
        '-c:a',
        'aac',
        '-movflags',
        '+faststart',
        outputPath
      ]

      try {
        await runCommand(ffmpeg, encodeArgs, { timeoutMs: this.timeoutMs })
      } catch (encodeError) {
        throw new VideoSegmentError(
          'Failed to extract video segment with ffmpeg',
          'VIDEO_SEGMENT_EXTRACTION_FAILED',
          {
            copy: {
              message: copyError.message,
              code: copyError.code,
              details: copyError.details || null
            },
            encode: {
              message: encodeError.message,
              code: encodeError.code,
              details: encodeError.details || null
            }
          }
        )
      }
    }

    try {
      await fs.access(outputPath, fsConstants.F_OK)
    } catch (error) {
      throw new VideoSegmentError(
        `Segment file not created: ${outputPath}`,
        'VIDEO_SEGMENT_OUTPUT_MISSING',
        { cause: error }
      )
    }

    return outputPath
  }
}

export { VideoSegmentError }
