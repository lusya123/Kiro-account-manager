// 认证适配器 - 统一 Electron IPC 和 Web HTTP 调用

import { isElectron } from './platform'

export interface AuthResult {
  success: boolean
  data?: any
  error?: {
    message: string
  }
}

/**
 * 认证适配器接口
 */
export interface IAuthAdapter {
  startOAuth(provider: string): Promise<AuthResult>
  handleOAuthCallback(code: string, state: string): Promise<AuthResult>
  logout(): Promise<void>
}

/**
 * Electron 端实现
 */
class ElectronAuthAdapter implements IAuthAdapter {
  async startOAuth(provider: string): Promise<AuthResult> {
    return (window as any).api.startOAuth(provider)
  }

  async handleOAuthCallback(code: string, state: string): Promise<AuthResult> {
    return (window as any).api.handleOAuthCallback(code, state)
  }

  async logout(): Promise<void> {
    return (window as any).api.logout()
  }
}

/**
 * Web 端实现
 */
class WebAuthAdapter implements IAuthAdapter {
  private apiBase: string

  constructor(apiBase: string = '/api') {
    this.apiBase = apiBase
  }

  async startOAuth(provider: string): Promise<AuthResult> {
    const response = await fetch(`${this.apiBase}/auth/oauth/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ provider })
    })
    return response.json()
  }

  async handleOAuthCallback(code: string, state: string): Promise<AuthResult> {
    const response = await fetch(`${this.apiBase}/auth/oauth/callback?code=${code}&state=${state}`, {
      method: 'GET',
      credentials: 'include'
    })
    return response.json()
  }

  async logout(): Promise<void> {
    await fetch(`${this.apiBase}/auth/logout`, {
      method: 'POST',
      credentials: 'include'
    })
  }
}

export const authAdapter: IAuthAdapter = isElectron()
  ? new ElectronAuthAdapter()
  : new WebAuthAdapter()
