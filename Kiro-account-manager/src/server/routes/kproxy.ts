// K-Proxy 路由

import { Router } from 'express'

const router = Router()

// K-Proxy 服务状态
let kproxyRunning = false
let kproxyPort = 8900
let globalDeviceId: string | undefined
const deviceIdMappings: Map<string, string> = new Map()

// 启动 K-Proxy 服务
router.post('/start', async (req, res) => {
  try {
    // TODO: 启动 K-Proxy 服务
    kproxyRunning = true
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// 停止 K-Proxy 服务
router.post('/stop', async (req, res) => {
  try {
    // TODO: 停止 K-Proxy 服务
    kproxyRunning = false
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// 获取 K-Proxy 服务状态
router.get('/status', (req, res) => {
  res.json({
    running: kproxyRunning,
    config: {
      enabled: kproxyRunning,
      host: '127.0.0.1',
      port: kproxyPort
    }
  })
})

// 获取 K-Proxy 配置
router.get('/config', (req, res) => {
  res.json({
    enabled: kproxyRunning,
    port: kproxyPort,
    host: '127.0.0.1'
  })
})

// 更新 K-Proxy 配置
router.post('/config', async (req, res) => {
  try {
    const { config } = req.body
    if (config.port) {
      kproxyPort = config.port
    }
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// 获取设备 ID
router.get('/device-id', (req, res) => {
  res.json({ deviceId: globalDeviceId })
})

// 设置设备 ID
router.post('/device-id', (req, res) => {
  const { deviceId } = req.body
  globalDeviceId = deviceId
  res.json({ success: true })
})

// 生成新的设备 ID
router.post('/device-id/generate', (req, res) => {
  const chars = '0123456789abcdef'
  let deviceId = ''
  for (let i = 0; i < 64; i++) {
    deviceId += chars[Math.floor(Math.random() * chars.length)]
  }
  globalDeviceId = deviceId
  res.json({ deviceId })
})

// 获取设备 ID 映射
router.get('/device-id-mappings', (req, res) => {
  const mappings = Array.from(deviceIdMappings.entries()).map(([accountId, deviceId]) => ({
    accountId,
    deviceId
  }))
  res.json({ mappings })
})

// 设置设备 ID 映射
router.post('/device-id-mappings', (req, res) => {
  const { accountId, deviceId } = req.body
  deviceIdMappings.set(accountId, deviceId)
  res.json({ success: true })
})

// 删除设备 ID 映射
router.delete('/device-id-mappings/:accountId', (req, res) => {
  const { accountId } = req.params
  deviceIdMappings.delete(accountId)
  res.json({ success: true })
})

export default router
