// Express 服务器 - Web 端后端 API 服务

import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { refreshAccountToken, checkAccountStatus } from '../services/accountService'
import { ssoDeviceAuth } from '../services/authService'
import { getUserInfo, getUsageAndLimits } from '../services/kiroApiService'
import { WebSocketEventManager } from './websocket'
import proxyRoutes from './routes/proxy'
import kproxyRoutes from './routes/kproxy'
// 类型定义（从 main/proxy/types 复制）
interface ProxyAccount {
  id: string
  email?: string
  accessToken: string
  refreshToken?: string
  clientId?: string
  clientSecret?: string
  region?: string
  authMethod?: 'social' | 'idc'
  provider?: string
  profileArn?: string
  expiresAt?: number
  machineId?: string
  idp?: string
  subscription?: {
    type: string
  }
}

const app = express()
const PORT = process.env.PORT || 3000

// 中间件
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}))
app.use(express.json())

// 路由
app.use('/api/proxy', proxyRoutes)
app.use('/api/kproxy', kproxyRoutes)

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() })
})

// 账号管理 API
app.post('/api/accounts/load', async (req, res) => {
  try {
    // TODO: 从数据库或文件系统加载账号数据
    res.json({ accounts: [] })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' })
  }
})

app.post('/api/accounts/save', async (req, res) => {
  try {
    const { data } = req.body
    // TODO: 保存账号数据到数据库或文件系统
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' })
  }
})

app.post('/api/accounts/refresh-token', async (req, res) => {
  try {
    const { account } = req.body as { account: ProxyAccount }
    const result = await refreshAccountToken(account)
    res.json(result)
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

app.post('/api/accounts/check-status', async (req, res) => {
  try {
    const { account } = req.body as { account: ProxyAccount }
    const result = await checkAccountStatus(
      account,
      getUserInfo,
      getUsageAndLimits
    )
    res.json(result)
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: error instanceof Error ? error.message : 'Unknown error' }
    })
  }
})

app.post('/api/accounts/import-sso', async (req, res) => {
  try {
    const { bearerToken, region } = req.body
    const ssoResult = await ssoDeviceAuth(bearerToken, region || 'us-east-1')

    if (!ssoResult.success || !ssoResult.accessToken) {
      return res.json({
        success: false,
        error: { message: ssoResult.error || 'SSO 授权失败' }
      })
    }

    // 获取用户信息和使用量
    const [userInfo, usageData] = await Promise.all([
      getUserInfo(ssoResult.accessToken).catch(() => undefined),
      getUsageAndLimits(ssoResult.accessToken, 'BuilderId', undefined, undefined, region).catch(() => undefined)
    ])

    const creditUsage = usageData?.usageBreakdownList?.find((b: any) => b.resourceType === 'CREDIT')
    const subscriptionTitle = usageData?.subscriptionInfo?.subscriptionTitle || 'KIRO'

    let subscriptionType = 'Free'
    const titleUpper = subscriptionTitle.toUpperCase()
    if (titleUpper.includes('PRO+') || titleUpper.includes('PRO_PLUS') || titleUpper.includes('PROPLUS')) {
      subscriptionType = 'Pro_Plus'
    } else if (titleUpper.includes('POWER')) {
      subscriptionType = 'Enterprise'
    } else if (titleUpper.includes('PRO')) {
      subscriptionType = 'Pro'
    } else if (titleUpper.includes('ENTERPRISE')) {
      subscriptionType = 'Enterprise'
    } else if (titleUpper.includes('TEAMS')) {
      subscriptionType = 'Teams'
    }

    const baseLimit = creditUsage?.usageLimitWithPrecision ?? creditUsage?.usageLimit ?? 0
    const baseCurrent = creditUsage?.currentUsageWithPrecision ?? creditUsage?.currentUsage ?? 0

    let freeTrialLimit = 0, freeTrialCurrent = 0, freeTrialExpiry: string | undefined
    if (creditUsage?.freeTrialInfo?.freeTrialStatus === 'ACTIVE') {
      freeTrialLimit = creditUsage.freeTrialInfo.usageLimitWithPrecision ?? creditUsage.freeTrialInfo.usageLimit ?? 0
      freeTrialCurrent = creditUsage.freeTrialInfo.currentUsageWithPrecision ?? creditUsage.freeTrialInfo.currentUsage ?? 0
      freeTrialExpiry = creditUsage.freeTrialInfo.freeTrialExpiry
    }

    const bonuses = (creditUsage?.bonuses || []).map((b: any) => ({
      code: b.bonusCode || '',
      name: b.displayName || '',
      current: b.currentUsageWithPrecision ?? b.currentUsage ?? 0,
      limit: b.usageLimitWithPrecision ?? b.usageLimit ?? 0,
      expiresAt: b.expiresAt
    }))

    const totalLimit = baseLimit + freeTrialLimit + bonuses.reduce((s: number, b: any) => s + b.limit, 0)
    const totalCurrent = baseCurrent + freeTrialCurrent + bonuses.reduce((s: number, b: any) => s + b.current, 0)

    res.json({
      success: true,
      data: {
        accessToken: ssoResult.accessToken,
        refreshToken: ssoResult.refreshToken,
        clientId: ssoResult.clientId,
        clientSecret: ssoResult.clientSecret,
        region: ssoResult.region,
        expiresIn: ssoResult.expiresIn,
        email: usageData?.userInfo?.email || userInfo?.email,
        userId: usageData?.userInfo?.userId || userInfo?.userId,
        idp: userInfo?.idp || 'BuilderId',
        status: userInfo?.status,
        subscriptionType,
        subscriptionTitle,
        subscription: {
          managementTarget: usageData?.subscriptionInfo?.subscriptionManagementTarget,
          upgradeCapability: usageData?.subscriptionInfo?.upgradeCapability,
          overageCapability: usageData?.subscriptionInfo?.overageCapability
        },
        usage: {
          current: totalCurrent,
          limit: totalLimit,
          baseLimit,
          baseCurrent,
          freeTrialLimit,
          freeTrialCurrent,
          freeTrialExpiry,
          bonuses,
          nextResetDate: usageData?.nextDateReset,
          resourceDetail: creditUsage ? {
            displayName: creditUsage.displayName,
            displayNamePlural: creditUsage.displayNamePlural,
            resourceType: creditUsage.resourceType,
            currency: creditUsage.currency,
            unit: creditUsage.unit,
            overageRate: creditUsage.overageRate,
            overageCap: creditUsage.overageCap,
            overageEnabled: usageData?.overageConfiguration?.overageEnabled
          } : undefined
        },
        daysRemaining: usageData?.nextDateReset ? Math.max(0, Math.ceil((new Date(usageData.nextDateReset).getTime() - Date.now()) / 86400000)) : undefined
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: error instanceof Error ? error.message : 'Unknown error' }
    })
  }
})

// 创建 HTTP 服务器
const server = createServer(app)

// WebSocket 服务器（用于实时事件推送）
const wss = new WebSocketServer({ server })
const wsManager = new WebSocketEventManager(wss)

// 启动服务器
server.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`)
  console.log(`[WebSocket] Running on ws://localhost:${PORT}`)
})

export { app, server, wss, wsManager }
