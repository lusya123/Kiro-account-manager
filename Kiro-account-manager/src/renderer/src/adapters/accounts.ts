// 账号管理适配器 - 统一 Electron IPC 和 Web HTTP 调用

import { isElectron } from './platform'

// 账号数据类型定义
export interface AccountData {
  accounts: Account[]
  [key: string]: any
}

export interface Account {
  id: string
  email?: string
  credentials?: {
    accessToken: string
    refreshToken?: string
    clientId?: string
    clientSecret?: string
    region?: string
    authMethod?: string
    provider?: string
    expiresAt?: number
  }
  subscription?: {
    type: string
    title?: string
  }
  usage?: {
    current: number
    limit: number
  }
  idp?: string
  machineId?: string
  [key: string]: any
}

export interface RefreshResult {
  success: boolean
  data?: {
    accessToken: string
    refreshToken: string
    expiresIn: number
  }
  error?: {
    message: string
  }
}

export interface StatusResult {
  success: boolean
  data?: {
    status: string
    email?: string
    userId?: string
    idp?: string
    userStatus?: string
    featureFlags?: string[]
    subscriptionTitle?: string
    usage?: any
    subscription?: any
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
 * 账号管理适配器接口
 */
export interface IAccountAdapter {
  loadAccounts(): Promise<AccountData>
  saveAccounts(data: AccountData): Promise<void>
  refreshToken(account: Account): Promise<RefreshResult>
  checkStatus(account: Account): Promise<StatusResult>
  importFromSsoToken(bearerToken: string, region?: string): Promise<any>
  verifyCredentials(credentials: any): Promise<any>
}

/**
 * Electron 端实现 - 使用 IPC 通信
 */
class ElectronAccountAdapter implements IAccountAdapter {
  async loadAccounts(): Promise<AccountData> {
    return (window as any).api.loadAccounts()
  }

  async saveAccounts(data: AccountData): Promise<void> {
    return (window as any).api.saveAccounts(data)
  }

  async refreshToken(account: Account): Promise<RefreshResult> {
    return (window as any).api.refreshAccountToken(account)
  }

  async checkStatus(account: Account): Promise<StatusResult> {
    return (window as any).api.checkAccountStatus(account)
  }

  async importFromSsoToken(bearerToken: string, region?: string): Promise<any> {
    return (window as any).api.importFromSsoToken(bearerToken, region)
  }

  async verifyCredentials(credentials: any): Promise<any> {
    return (window as any).api.verifyAccountCredentials(credentials)
  }
}

/**
 * Web 端实现 - 使用 HTTP API
 */
class WebAccountAdapter implements IAccountAdapter {
  private apiBase: string

  constructor(apiBase: string = '/api') {
    this.apiBase = apiBase
  }

  async loadAccounts(): Promise<AccountData> {
    const response = await fetch(`${this.apiBase}/accounts/load`, {
      method: 'POST',
      credentials: 'include'
    })
    if (!response.ok) {
      throw new Error(`Failed to load accounts: ${response.statusText}`)
    }
    return response.json()
  }

  async saveAccounts(data: AccountData): Promise<void> {
    const response = await fetch(`${this.apiBase}/accounts/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data)
    })
    if (!response.ok) {
      throw new Error(`Failed to save accounts: ${response.statusText}`)
    }
  }

  async refreshToken(account: Account): Promise<RefreshResult> {
    const response = await fetch(`${this.apiBase}/accounts/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ account })
    })
    if (!response.ok) {
      throw new Error(`Failed to refresh token: ${response.statusText}`)
    }
    return response.json()
  }

  async checkStatus(account: Account): Promise<StatusResult> {
    const response = await fetch(`${this.apiBase}/accounts/check-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ account })
    })
    if (!response.ok) {
      throw new Error(`Failed to check status: ${response.statusText}`)
    }
    return response.json()
  }

  async importFromSsoToken(bearerToken: string, region?: string): Promise<any> {
    const response = await fetch(`${this.apiBase}/accounts/import-sso`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ bearerToken, region })
    })
    if (!response.ok) {
      throw new Error(`Failed to import from SSO: ${response.statusText}`)
    }
    return response.json()
  }

  async verifyCredentials(credentials: any): Promise<any> {
    const response = await fetch(`${this.apiBase}/accounts/verify-credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ credentials })
    })
    if (!response.ok) {
      throw new Error(`Failed to verify credentials: ${response.statusText}`)
    }
    return response.json()
  }
}

/**
 * 自动选择适配器实现
 */
export const accountAdapter: IAccountAdapter = isElectron()
  ? new ElectronAccountAdapter()
  : new WebAccountAdapter()
