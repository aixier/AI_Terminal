import express from 'express'
import dataService from '../services/dataService.js'

const router = express.Router()

// 获取所有命令
router.get('/', async (req, res) => {
  try {
    const commands = await dataService.getCommands()
    res.json({
      code: 200,
      data: commands,
      message: 'success'
    })
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: error.message
    })
  }
})

// 验证命令
router.post('/validate', async (req, res) => {
  try {
    const { command } = req.body
    const validation = await dataService.validateCommand(command)
    res.json({
      code: 200,
      data: validation,
      message: 'success'
    })
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: error.message
    })
  }
})

// 获取命令历史
router.get('/history', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || 'anonymous'
    const days = parseInt(req.query.days) || 7
    const history = await dataService.getCommandHistory(userId, days)
    res.json({
      code: 200,
      data: history,
      message: 'success'
    })
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: error.message
    })
  }
})

// 保存命令历史
router.post('/history', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || 'anonymous'
    const { command } = req.body
    await dataService.saveCommandHistory(userId, command)
    res.json({
      code: 200,
      message: 'History saved'
    })
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: error.message
    })
  }
})

export default router