import logger from '../../utils/logger.js'
import {
  createJob,
  getJob,
  getJobInternal,
  failJob
} from './jobStore.js'
import processJob from './processor.js'

const sanitizeOptions = input => {
  if (!input) return {}
  const options = {}

  if (Number.isFinite(input.maxHighlights)) {
    options.maxHighlights = Math.max(1, Math.floor(input.maxHighlights))
  }

  if (Number.isFinite(input.minQuoteLength)) {
    options.minQuoteLength = Math.max(1, Math.floor(input.minQuoteLength))
  }

  if (Number.isFinite(input.clipPaddingSeconds)) {
    options.clipPaddingSeconds = Math.max(0, Number(input.clipPaddingSeconds))
  }

  return options
}

export function createVideoDecomposeTask(payload) {
  const job = createJob({
    videoUrl: payload.videoUrl,
    subtitleUrl: payload.subtitleUrl,
    options: sanitizeOptions(payload.options || payload)
  })

  queueMicrotask(() => {
    processJob(job).catch(error => {
      logger.error(`[videoDecompose] Unexpected processing error for ${job.id}: ${error.message}`)
      const record = getJobInternal(job.id)
      if (record) {
        failJob(job.id, error)
      }
    })
  })

  return getJob(job.id)
}

export function getVideoDecomposeTask(jobId) {
  return getJob(jobId)
}
