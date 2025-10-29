import { randomUUID } from 'crypto'

const jobs = new Map()

const createJobId = () => `vd_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`
const now = () => new Date().toISOString()

const clampPercent = value => {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

function createJob(payload) {
  const id = createJobId()
  const job = {
    id,
    status: 'queued',
    stage: 'pending',
    progress: {
      percent: 0,
      message: 'Job queued'
    },
    videoUrl: payload.videoUrl,
    subtitleUrl: payload.subtitleUrl,
    options: payload.options || {},
    result: null,
    error: null,
    history: [
      {
        stage: 'pending',
        message: 'Job queued',
        percent: 0,
        timestamp: now()
      }
    ],
    createdAt: now(),
    updatedAt: now()
  }

  jobs.set(id, job)
  return job
}

function mutateJob(id, mutator) {
  const job = jobs.get(id)
  if (!job) return null
  mutator(job)
  job.updatedAt = now()
  return job
}

function addHistory(job, stage, message, percent) {
  job.history.push({
    stage,
    message,
    percent: clampPercent(percent),
    timestamp: now()
  })
}

function setStage(id, stage, percent, message) {
  return mutateJob(id, job => {
    job.stage = stage
    job.progress = {
      percent: clampPercent(percent),
      message
    }
    addHistory(job, stage, message, percent)
  })
}

function markProcessing(id) {
  return mutateJob(id, job => {
    job.status = 'processing'
    job.stage = 'processing'
    addHistory(job, 'processing', 'Processing started', job.progress.percent)
  })
}

function completeJob(id, result) {
  return mutateJob(id, job => {
    job.status = 'completed'
    job.stage = 'completed'
    job.progress = {
      percent: 100,
      message: 'Processing completed'
    }
    job.result = result
    addHistory(job, 'completed', 'Processing completed', 100)
  })
}

function failJob(id, error) {
  return mutateJob(id, job => {
    job.status = 'failed'
    job.stage = 'failed'
    job.progress = {
      percent: job.progress.percent,
      message: error?.message || 'Processing failed'
    }
    job.error = {
      message: error?.message || 'Unknown error',
      code: error?.code || 'VIDEO_DECOMPOSE_FAILED',
      details: error?.details || null
    }
    addHistory(job, 'failed', job.progress.message, job.progress.percent)
  })
}

function getJob(id) {
  const job = jobs.get(id)
  if (!job) return null
  return {
    jobId: job.id,
    status: job.status,
    stage: job.stage,
    progress: job.progress,
    history: job.history,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    result: job.status === 'completed' ? job.result : null,
    error: job.status === 'failed' ? job.error : null,
    options: job.options
  }
}

function getJobInternal(id) {
  return jobs.get(id) || null
}

export {
  createJob,
  markProcessing,
  setStage,
  completeJob,
  failJob,
  getJob,
  getJobInternal
}
