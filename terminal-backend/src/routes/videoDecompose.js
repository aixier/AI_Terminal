import express from 'express'
import logger from '../utils/logger.js'
import {
  createVideoDecomposeTask,
  getVideoDecomposeTask
} from '../services/videoDecompose/index.js'

const router = express.Router()

router.post('/jobs', (req, res) => {
  try {
    const {
      videoUrl,
      subtitleUrl,
      maxHighlights,
      minQuoteLength,
      clipPaddingSeconds,
      createCompilation
    } = req.body || {}

    if (!videoUrl || !subtitleUrl) {
      return res.status(400).json({
        success: false,
        error: 'videoUrl and subtitleUrl are required'
      })
    }

    logger.info('[videoDecompose] Creating job', {
      videoUrl,
      subtitleUrl,
      createCompilation
    })

    const job = createVideoDecomposeTask({
      videoUrl,
      subtitleUrl,
      options: {
        maxHighlights: Number(maxHighlights),
        minQuoteLength: Number(minQuoteLength),
        clipPaddingSeconds: Number(clipPaddingSeconds),
        createCompilation: Boolean(createCompilation)
      }
    })

    return res.json({
      success: true,
      data: job
    })
  } catch (error) {
    logger.error(`[videoDecompose] Failed to create job: ${error.message}`)
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create job'
    })
  }
})

router.get('/jobs/:id', (req, res) => {
  const job = getVideoDecomposeTask(req.params.id)
  if (!job) {
    return res.status(404).json({
      success: false,
      error: 'Job not found'
    })
  }

  return res.json({
    success: true,
    data: job
  })
})

export default router
