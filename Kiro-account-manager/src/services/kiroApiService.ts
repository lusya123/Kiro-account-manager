// Kiro API 服务 - 处理与 Kiro API 的通信

import { encode, decode } from 'cbor-x'

const KIRO_API_BASE = 'https://app.kiro.dev/service/KiroWebPortalService/operation'
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

function getFallbackRestApiBase(ssoRegion?: string): string {
  const primary = getRestApiBase(ssoRegion)
  return primary === KIRO_REST_API_ENDPOINTS['eu-central-1']
    ? KIRO_REST_API_ENDPOINTS['us-east-1']
    : KIRO_REST_API_ENDPOINTS['eu-central-1']
}

/**
 * Kiro API CBOR 请求
 */
export async function kiroApiRequest<T>(
  operation: string,
  body: Record<string, unknown>,
  accessToken: string,
  idp: string = 'BuilderId',
  accountMachineId?: string
): Promise<T> {
  console.log(`[Kiro API] Calling ${operation}`)

  const headers: Record<string, string> = {
    'accept': 'application/cbor',
    'content-type': 'application/cbor',
    'smithy-protocol': 'rpc-v2-cbor',
    'amz-sdk-invocation-id': generateInvocationId(),
    'amz-sdk-request': 'attempt=1; max=1',
    'x-amz-user-agent': getKiroAmzUserAgent(accountMachineId),
    'authorization': `Bearer ${accessToken}`,
    'cookie': `Idp=${idp}; AccessToken=${accessToken}`
  }

  const response = await fetch(`${KIRO_API_BASE}/${operation}`, {
    method: 'POST',
    headers,
    body: Buffer.from(encode(body))
  })

  console.log(`[Kiro API] Response status: ${response.status}`)

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`
    const errorBuffer = await response.arrayBuffer()
    try {
      const errorData = decode(Buffer.from(errorBuffer)) as { __type?: string; message?: string }
      if (errorData.__type && errorData.message) {
        const errorType = errorData.__type.split('#').pop() || errorData.__type
        errorMessage = `HTTP ${response.status}: ${errorType}: ${errorData.message}`
      } else if (errorData.message) {
        errorMessage = `HTTP ${response.status}: ${errorData.message}`
      }
      console.error(`[Kiro API] Error:`, errorData)
    } catch {
      const errorText = Buffer.from(errorBuffer).toString('utf-8')
      console.error(`[Kiro API] Error (raw): ${errorText}`)
    }
    throw new Error(errorMessage)
  }

  const arrayBuffer = await response.arrayBuffer()
  const result = decode(Buffer.from(arrayBuffer)) as T
  return result
}

/**
 * Kiro REST API 请求
 */
async function fetchRestApi(
  baseUrl: string,
  path: string,
  accessToken: string,
  machineId?: string
): Promise<Response> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
    'User-Agent': getKiroUserAgent(machineId),
    'x-amz-user-agent': getKiroAmzUserAgent(machineId)
  }
  const url = `${baseUrl}${path}`
  return await fetch(url, { method: 'GET', headers })
}

function normalizeResetDate(value: number | string | undefined): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'number') {
    return new Date(value * 1000).toISOString()
  }
  return value
}

/**
 * 获取用户使用量和限制（REST API）
 */
export async function getUsageLimitsRest(
  accessToken: string,
  profileArn?: string,
  accountMachineId?: string,
  ssoRegion?: string
): Promise<any> {
  console.log(`[Kiro REST API] Calling GetUsageLimits (ssoRegion: ${ssoRegion || 'default'})`)

  const params = new URLSearchParams({
    origin: 'AI_EDITOR',
    resourceType: 'AGENTIC_REQUEST',
    isEmailRequired: 'true'
  })
  if (profileArn) {
    params.append('profileArn', profileArn)
  }

  const primaryBase = getRestApiBase(ssoRegion)
  const fallbackBase = getFallbackRestApiBase(ssoRegion)

  let response = await fetchRestApi(primaryBase, `/usage-limits?${params}`, accessToken, accountMachineId)

  if (!response.ok && response.status >= 500) {
    console.log(`[Kiro REST API] Primary endpoint failed (${response.status}), trying fallback...`)
    response = await fetchRestApi(fallbackBase, `/usage-limits?${params}`, accessToken, accountMachineId)
  }

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`[Kiro REST API] Error: ${errorText}`)
    throw new Error(`HTTP ${response.status}: ${errorText}`)
  }

  const result = await response.json()
  return result
}

/**
 * 获取用户信息
 */
export async function getUserInfo(
  accessToken: string,
  idp: string = 'BuilderId',
  accountMachineId?: string
): Promise<any> {
  return kiroApiRequest('GetUserInfo', { origin: 'KIRO_IDE' }, accessToken, idp, accountMachineId)
}

/**
 * 统一的用量查询接口
 */
export async function getUsageAndLimits(
  accessToken: string,
  idp: string = 'BuilderId',
  profileArn?: string,
  accountMachineId?: string,
  ssoRegion?: string,
  usageApiType: 'rest' | 'cbor' = 'rest'
): Promise<any> {
  if (usageApiType === 'rest') {
    const result = await getUsageLimitsRest(accessToken, profileArn, accountMachineId, ssoRegion)
    return {
      usageBreakdownList: result.usageBreakdownList?.map((b: any) => ({
        resourceType: b.resourceType || b.type,
        displayName: b.displayName,
        displayNamePlural: b.displayNamePlural,
        currentUsage: b.currentUsage,
        currentUsageWithPrecision: b.currentUsageWithPrecision,
        usageLimit: b.usageLimit,
        usageLimitWithPrecision: b.usageLimitWithPrecision,
        currency: b.currency,
        unit: b.unit,
        overageRate: b.overageRate,
        overageCap: b.overageCap,
        type: b.type,
        freeTrialInfo: b.freeTrialInfo ? {
          freeTrialStatus: b.freeTrialInfo.freeTrialStatus,
          usageLimit: b.freeTrialInfo.usageLimit,
          usageLimitWithPrecision: b.freeTrialInfo.usageLimitWithPrecision,
          currentUsage: b.freeTrialInfo.currentUsage,
          currentUsageWithPrecision: b.freeTrialInfo.currentUsageWithPrecision,
          freeTrialExpiry: typeof b.freeTrialInfo.freeTrialExpiry === 'number'
            ? new Date(b.freeTrialInfo.freeTrialExpiry * 1000).toISOString()
            : b.freeTrialInfo.freeTrialExpiry
        } : undefined,
        bonuses: b.bonuses?.map((bonus: any) => ({
          ...bonus,
          expiresAt: typeof bonus.expiresAt === 'number'
            ? new Date(bonus.expiresAt * 1000).toISOString()
            : bonus.expiresAt
        }))
      })),
      nextDateReset: normalizeResetDate(result.nextDateReset),
      subscriptionInfo: result.subscriptionInfo,
      overageConfiguration: result.overageConfiguration,
      userInfo: result.userInfo
    }
  } else {
    // CBOR API
    try {
      return await kiroApiRequest(
        'GetUserUsageAndLimits',
        { isEmailRequired: true, origin: 'KIRO_IDE' },
        accessToken,
        idp,
        accountMachineId
      )
    } catch (cborError) {
      const errorMsg = cborError instanceof Error ? cborError.message : ''
      if (errorMsg.includes('401') || errorMsg.includes('403')) {
        console.log(`[API] CBOR API failed (${errorMsg}), falling back to REST API...`)
        const result = await getUsageLimitsRest(accessToken, profileArn, accountMachineId, ssoRegion)
        return {
          usageBreakdownList: result.usageBreakdownList,
          nextDateReset: normalizeResetDate(result.nextDateReset),
          subscriptionInfo: result.subscriptionInfo,
          overageConfiguration: result.overageConfiguration,
          userInfo: result.userInfo
        }
      }
      throw cborError
    }
  }
}
