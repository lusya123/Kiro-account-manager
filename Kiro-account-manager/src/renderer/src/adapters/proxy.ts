// 代理服务适配器 - 统一 Electron IPC 和 Web HTTP 调用

import { isElectron } from './platform'

export interface ProxyConfig {
  enabled: boolean
  port: number
  host: string
  enableMultiAccount: boolean
  selectedAccountIds: string[]
  logRequests: boolean
  maxConcurrent: number
  [key: string]: any
}

export interface ProxyStats {
  totalRequests: number
  successRequests: number
  failedRequests: number
  totalCredits: number
  inputTokens: number
  outputTokens: number
  startTime: number
}

/**
 * 代理服务适配器接口
 */
export interface IProxyAdapter {
  start(): Promise<{ success: boolean; port?: number; error?: string }>
  stop(): Promise<{ success: boolean; error?: string }>
  getStatus(): Promise<{ running: boolean; port: number; config: ProxyConfig }>
  getConfig(): Promise<ProxyConfig>
  updateConfig(config: Partial<ProxyConfig>): Promise<{ success: boolean }>
  getStats(): Promise<ProxyStats>
  clearStats(): Promise<{ success: boolean }>
}

/**
 * Electron 端实现
 */
class ElectronProxyAdapter implements IProxyAdapter {
  async start(): Promise<{ success: boolean; port?: number; error?: string }> {
    return (window as any).api.startProxy()
  }

  async stop(): Promise<{ success: boolean; error?: string }> {
    return (window as any).api.stopProxy()
  }

  async getStatus(): Promise<{ running: boolean; port: number; config: ProxyConfig }> {
    return (window as any).api.getProxyStatus()
  }

  async getConfig(): Promise<ProxyConfig> {
    return (window as any).api.getProxyConfig()
  }

  async updateConfig(config: Partial<ProxyConfig>): Promise<{ success: boolean }> {
    return (window as any).api.updateProxyConfig(config)
  }

  async getStats(): Promise<ProxyStats> {
    return (window as any).api.getProxyStats()
  }

  async clearStats(): Promise<{ success: boolean }> {
    return (window as any).api.clearProxyStats()
  }
}

/**
 * Web 端实现
 */
class WebProxyAdapter implements IProxyAdapter {
  private apiBase: string

  constructor(apiBase: string = '/api') {
    this.apiBase = apiBase
  }

  async start(): Promise<{ success: boolean; port?: number; error?: string }> {
    const response = await fetch(`${this.apiBase}/proxy/start`, {
      method: 'POST',
      credentials: 'include'
    })
    return response.json()
  }

  async stop(): Promise<{ success: boolean; error?: string }> {
    const response = await fetch(`${this.apiBase}/proxy/stop`, {
      method: 'POST',
      credentials: 'include'
    })
    return response.json()
  }

  async getStatus(): Promise<{ running: boolean; port: number; config: ProxyConfig }> {
    const response = await fetch(`${this.apiBase}/proxy/status`, {
      credentials: 'include'
    })
    return response.json()
  }

  async getConfig(): Promise<ProxyConfig> {
    const response = await fetch(`${this.apiBase}/proxy/config`, {
      credentials: 'include'
    })
    return response.json()
  }

  async updateConfig(config: Partial<ProxyConfig>): Promise<{ success: boolean }> {
    const response = await fetch(`${this.apiBase}/proxy/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ config })
    })
    return response.json()
  }

  async getStats(): Promise<ProxyStats> {
    const response = await fetch(`${this.apiBase}/proxy/stats`, {
      credentials: 'include'
    })
    return response.json()
  }

  async clearStats(): Promise<{ success: boolean }> {
    const response = await fetch(`${this.apiBase}/proxy/stats`, {
      method: 'DELETE',
      credentials: 'include'
    })
    return response.json()
  }
}

export const proxyAdapter: IProxyAdapter = isElectron()
  ? new ElectronProxyAdapter()
  : new WebProxyAdapter()
