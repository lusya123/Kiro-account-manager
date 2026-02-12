// 账号服务 - 处理账号管理、Token 刷新、状态检查等业务逻辑

import { refreshTokenByMethod } from './authService'
import type { ProxyAccount } from '../main/proxy/types'

const KIRO_API_BASE = 'https://app.kiro.dev/service/KiroWebPortalService/operation'

// REST API 端点配置
const KIRO_REST_API_ENDPOINTS: Record<string, string> = {
  'us-east-1': 'https://q.us-east-1.amazonaws.com',
  'eu-central-1': 'https://q.eu-central-1.amazonaws.com'
}

const KIRO_VERSION = '0.6.18'

function getKiroUserAgent(machineId?: string): string {
  const suffix = machineId ? `KiroIDE-${KIRO_VERSION}-${machineId}` : `KiroIDE-${KIRO_VERSION}`
  return `aws-sdk-js/1.0.18 ua/2.1 os/windows lang/js md/nodejs#20.16.0 api/codewhispererstreaming#1.0.18 m/E ${suffix}`
}

function getKiroAmzUserAgent(machineId?: string): string {
  const suffix = machineId ? `KiroIDE ${KIRO_VERSION} ${machineId}` : `KiroIDE-${KIRO_VERSION}`
  return `aws-sdk-js/1.0.18 ${suffix}`
}

function generateInvocationId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function getRestApiBase(ssoRegion?: string): string {
  if (!ssoRegion) return KIRO_REST_API_ENDPOINTS['us-east-1']
  if (KIRO_REST_API_ENDPOINTS[ssoRegion]) return KIRO_REST_API_ENDPOINTS[ssoRegion]
  if (ssoRegion.startsWith('eu-')) return KIRO_REST_API_ENDPOINTS['eu-central-1']
  return KIRO_REST_API_ENDPOINTS['us-east-1']
}

export interface RefreshTokenResult {
  success: boolean
  accessToken?: string
  refreshToken?: string
  expiresIn?: number
  error?: string
}

export interface AccountStatusResult {
  success: boolean
  data?: {
    status: string
    email?: string
    userId?: string
    idp?: string
    userStatus?: string
    featureFlags?: string[]
    subscriptionTitle?: string
    usage?: {
      current: number
      limit: number
      percentUsed: number
      lastUpdated: number
      baseLimit: number
      baseCurrent: number
      freeTrialLimit: number
      freeTrialCurrent: number
      freeTrialExpiry?: string
      bonuses: Array<{
        code: string
        name: string
        current: number
        limit: number
        expiresAt?: string
      }>
      nextResetDate?: string
      resourceDetail?: {
        resourceType?: string
        displayName?: string
        displayNamePlural?: string
        currency?: string
        unit?: string
        overageRate?: number
        overageCap?: number
        overageEnabled?: boolean
      }
    }
    subscription?: {
      type: string
      title: string
      rawType?: string
      expiresAt?: number
      daysRemaining?: number
      upgradeCapability?: string
      overageCapability?: string
      managementTarget?: string
    }
    newCredentials?: {
      accessToken: string
      refreshToken?: string
      expiresAt?: number
    }
  }
  error?: {
    message: string
    isBanned?: boolean
  }
}

/**
 * 刷新账号 Token
 */
export async function refreshAccountToken(
  account: ProxyAccount,
  machineId?: string
): Promise<RefreshTokenResult> {
  try {
    const { refreshToken, clientId, clientSecret, region, authMethod } = account

    if (!refreshToken) {
      return { success: false, error: '缺少 Refresh Token' }
    }

    if (authMethod !== 'social' && (!clientId || !clientSecret)) {
      return { success: false, error: '缺少 OIDC 刷新凭证 (clientId/clientSecret)' }
    }

    console.log(`[AccountService] Refreshing token (authMethod: ${authMethod || 'IdC'})...`)

    const refreshResult = await refreshTokenByMethod(
      refreshToken,
      clientId || '',
      clientSecret || '',
      region || 'us-east-1',
      authMethod,
      machineId
    )

    if (!refreshResult.success || !refreshResult.accessToken) {
      return { success: false, error: refreshResult.error || 'Token 刷新失败' }
    }

    return {
      success: true,
      accessToken: refreshResult.accessToken,
      refreshToken: refreshResult.refreshToken || refreshToken,
      expiresIn: refreshResult.expiresIn ?? 3600
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * 检查账号状态（支持自动刷新 Token）
 */
export async function checkAccountStatus(
  account: ProxyAccount,
  getUserInfoFn: (accessToken: string, idp: string, machineId?: string) => Promise<any>,
  getUsageAndLimitsFn: (accessToken: string, idp: string, profileArn?: string, machineId?: string, region?: string) => Promise<any>,
  machineId?: string
): Promise<AccountStatusResult> {
  try {
    const { accessToken, refreshToken, clientId, clientSecret, region, authMethod, provider } = account

    let idp = 'BuilderId'
    if (authMethod === 'social') {
      idp = provider || account.idp || 'BuilderId'
    } else if (provider) {
      idp = provider
    }

    if (!accessToken) {
      return { success: false, error: { message: '缺少 accessToken' } }
    }

    const accountMachineId = account.machineId

    // 第一次尝试：使用当前 accessToken
    try {
      const [userInfoResult, usageResult] = await Promise.all([
        getUserInfoFn(accessToken, idp, accountMachineId).catch(() => undefined),
        getUsageAndLimitsFn(accessToken, idp, undefined, accountMachineId, region)
      ])
      return parseUsageResponse(usageResult, undefined, userInfoResult, account)
    } catch (apiError) {
      const errorMsg = apiError instanceof Error ? apiError.message : ''

      // 检查是否是封禁错误
      if (errorMsg.includes('AccountSuspendedException') || errorMsg.includes('423') || errorMsg.includes('403')) {
        return {
          success: false,
          error: { message: errorMsg, isBanned: true }
        }
      }

      // 检查是否是 401 错误（token 过期）
      const canRefresh = refreshToken && (authMethod === 'social' || (clientId && clientSecret))
      if (errorMsg.includes('401') && canRefresh) {
        console.log(`[AccountService] Token expired, attempting to refresh (authMethod: ${authMethod || 'IdC'})...`)

        const refreshResult = await refreshTokenByMethod(
          refreshToken,
          clientId || '',
          clientSecret || '',
          region || 'us-east-1',
          authMethod,
          machineId
        )

        if (refreshResult.success && refreshResult.accessToken) {
          console.log('[AccountService] Token refreshed, retrying API call...')

          const [userInfoResult, usageResult] = await Promise.all([
            getUserInfoFn(refreshResult.accessToken, idp, accountMachineId).catch(() => undefined),
            getUsageAndLimitsFn(refreshResult.accessToken, idp, undefined, accountMachineId, region)
          ])

          return parseUsageResponse(usageResult, {
            accessToken: refreshResult.accessToken,
            refreshToken: refreshResult.refreshToken,
            expiresIn: refreshResult.expiresIn
          }, userInfoResult, account)
        } else {
          return {
            success: false,
            error: { message: `Token 过期且刷新失败: ${refreshResult.error}` }
          }
        }
      }

      throw apiError
    }
  } catch (error) {
    return {
      success: false,
      error: { message: error instanceof Error ? error.message : 'Unknown error' }
    }
  }
}

function parseUsageResponse(
  result: any,
  newCredentials?: { accessToken: string; refreshToken?: string; expiresIn?: number },
  userInfo?: any,
  account?: ProxyAccount
): AccountStatusResult {
  const creditUsage = result.usageBreakdownList?.find(
    (b: any) => b.resourceType === 'CREDIT' || b.displayName === 'Credits'
  )

  const baseLimit = creditUsage?.usageLimitWithPrecision ?? creditUsage?.usageLimit ?? 0
  const baseCurrent = creditUsage?.currentUsageWithPrecision ?? creditUsage?.currentUsage ?? 0

  let freeTrialLimit = 0
  let freeTrialCurrent = 0
  let freeTrialExpiry: string | undefined
  if (creditUsage?.freeTrialInfo?.freeTrialStatus === 'ACTIVE') {
    freeTrialLimit = creditUsage.freeTrialInfo.usageLimitWithPrecision ?? creditUsage.freeTrialInfo.usageLimit ?? 0
    freeTrialCurrent = creditUsage.freeTrialInfo.currentUsageWithPrecision ?? creditUsage.freeTrialInfo.currentUsage ?? 0
    freeTrialExpiry = creditUsage.freeTrialInfo.freeTrialExpiry
  }

  const bonusesData: Array<{ code: string; name: string; current: number; limit: number; expiresAt?: string }> = []
  if (creditUsage?.bonuses) {
    for (const bonus of creditUsage.bonuses) {
      if (bonus.status === 'ACTIVE') {
        bonusesData.push({
          code: bonus.bonusCode || '',
          name: bonus.displayName || '',
          current: bonus.currentUsageWithPrecision ?? bonus.currentUsage ?? 0,
          limit: bonus.usageLimitWithPrecision ?? bonus.usageLimit ?? 0,
          expiresAt: bonus.expiresAt
        })
      }
    }
  }

  const totalLimit = baseLimit + freeTrialLimit + bonusesData.reduce((sum, b) => sum + b.limit, 0)
  const totalUsed = baseCurrent + freeTrialCurrent + bonusesData.reduce((sum, b) => sum + b.current, 0)
  const nextResetDate = result.nextDateReset

  const subscriptionTitle = result.subscriptionInfo?.subscriptionTitle ?? 'Free'
  let subscriptionType = account?.subscription?.type ?? 'Free'
  if (subscriptionTitle.toUpperCase().includes('PRO')) {
    subscriptionType = 'Pro'
  } else if (subscriptionTitle.toUpperCase().includes('ENTERPRISE')) {
    subscriptionType = 'Enterprise'
  } else if (subscriptionTitle.toUpperCase().includes('TEAMS')) {
    subscriptionType = 'Teams'
  }

  let expiresAt: number | undefined
  let daysRemaining: number | undefined
  if (result.nextDateReset) {
    expiresAt = new Date(result.nextDateReset).getTime()
    const now = Date.now()
    daysRemaining = Math.max(0, Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24)))
  }

  const resourceDetail = creditUsage ? {
    resourceType: creditUsage.resourceType,
    displayName: creditUsage.displayName,
    displayNamePlural: creditUsage.displayNamePlural,
    currency: creditUsage.currency,
    unit: creditUsage.unit,
    overageRate: creditUsage.overageRate,
    overageCap: creditUsage.overageCap,
    overageEnabled: result.overageConfiguration?.overageEnabled ?? false
  } : undefined

  return {
    success: true,
    data: {
      status: (!userInfo?.status || userInfo.status === 'Active' || userInfo.status === 'Stale') ? 'active' : 'error',
      email: result.userInfo?.email,
      userId: result.userInfo?.userId,
      idp: userInfo?.idp,
      userStatus: userInfo?.status,
      featureFlags: userInfo?.featureFlags,
      subscriptionTitle,
      usage: {
        current: totalUsed,
        limit: totalLimit,
        percentUsed: totalLimit > 0 ? totalUsed / totalLimit : 0,
        lastUpdated: Date.now(),
        baseLimit,
        baseCurrent,
        freeTrialLimit,
        freeTrialCurrent,
        freeTrialExpiry,
        bonuses: bonusesData,
        nextResetDate,
        resourceDetail
      },
      subscription: {
        type: subscriptionType,
        title: subscriptionTitle,
        rawType: result.subscriptionInfo?.type,
        expiresAt,
        daysRemaining,
        upgradeCapability: result.subscriptionInfo?.upgradeCapability,
        overageCapability: result.subscriptionInfo?.overageCapability,
        managementTarget: result.subscriptionInfo?.subscriptionManagementTarget
      },
      newCredentials: newCredentials ? {
        accessToken: newCredentials.accessToken,
        refreshToken: newCredentials.refreshToken,
        expiresAt: newCredentials.expiresIn
          ? Date.now() + newCredentials.expiresIn * 1000
          : undefined
      } : undefined
    }
  }
}
