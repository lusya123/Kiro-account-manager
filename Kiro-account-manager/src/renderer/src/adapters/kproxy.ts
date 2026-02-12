// K-Proxy 适配器 - 统一 Electron IPC 和 Web HTTP 调用

import { isElectron } from './platform'

export interface KProxyConfig {
  enabled: boolean
  port: number
  host: string
  [key: string]: any
}

export interface DeviceIdMapping {
  accountId: string
  deviceId: string
}

/**
 * K-Proxy 适配器接口
 */
export interface IKProxyAdapter {
  start(): Promise<{ success: boolean; error?: string }>
  stop(): Promise<{ success: boolean; error?: string }>
  getStatus(): Promise<{ running: boolean; config: KProxyConfig }>
  getConfig(): Promise<KProxyConfig>
  updateConfig(config: Partial<KProxyConfig>): Promise<{ success: boolean }>
  getDeviceId(): Promise<string | undefined>
  setDeviceId(deviceId: string): Promise<{ success: boolean }>
  generateDeviceId(): Promise<string>
  getDeviceIdMappings(): Promise<DeviceIdMapping[]>
  setDeviceIdMapping(accountId: string, deviceId: string): Promise<{ success: boolean }>
  removeDeviceIdMapping(accountId: string): Promise<{ success: boolean }>
}

/**
 * Electron 端实现
 */
class ElectronKProxyAdapter implements IKProxyAdapter {
  async start(): Promise<{ success: boolean; error?: string }> {
    return (window as any).api.startKProxy()
  }

  async stop(): Promise<{ success: boolean; error?: string }> {
    return (window as any).api.stopKProxy()
  }

  async getStatus(): Promise<{ running: boolean; config: KProxyConfig }> {
    return (window as any).api.getKProxyStatus()
  }

  async getConfig(): Promise<KProxyConfig> {
    return (window as any).api.getKProxyConfig()
  }

  async updateConfig(config: Partial<KProxyConfig>): Promise<{ success: boolean }> {
    return (window as any).api.updateKProxyConfig(config)
  }

  async getDeviceId(): Promise<string | undefined> {
    return (window as any).api.getKProxyDeviceId()
  }

  async setDeviceId(deviceId: string): Promise<{ success: boolean }> {
    return (window as any).api.setKProxyDeviceId(deviceId)
  }

  async generateDeviceId(): Promise<string> {
    return (window as any).api.generateKProxyDeviceId()
  }

  async getDeviceIdMappings(): Promise<DeviceIdMapping[]> {
    return (window as any).api.getKProxyDeviceIdMappings()
  }

  async setDeviceIdMapping(accountId: string, deviceId: string): Promise<{ success: boolean }> {
    return (window as any).api.setKProxyDeviceIdMapping(accountId, deviceId)
  }

  async removeDeviceIdMapping(accountId: string): Promise<{ success: boolean }> {
    return (window as any).api.removeKProxyDeviceIdMapping(accountId)
  }
}

/**
 * Web 端实现
 */
class WebKProxyAdapter implements IKProxyAdapter {
  private apiBase: string

  constructor(apiBase: string = '/api') {
    this.apiBase = apiBase
  }

  async start(): Promise<{ success: boolean; error?: string }> {
    const response = await fetch(`${this.apiBase}/kproxy/start`, {
      method: 'POST',
      credentials: 'include'
    })
    return response.json()
  }

  async stop(): Promise<{ success: boolean; error?: string }> {
    const response = await fetch(`${this.apiBase}/kproxy/stop`, {
      method: 'POST',
      credentials: 'include'
    })
    return response.json()
  }

  async getStatus(): Promise<{ running: boolean; config: KProxyConfig }> {
    const response = await fetch(`${this.apiBase}/kproxy/status`, {
      credentials: 'include'
    })
    return response.json()
  }

  async getConfig(): Promise<KProxyConfig> {
    const response = await fetch(`${this.apiBase}/kproxy/config`, {
      credentials: 'include'
    })
    return response.json()
  }

  async updateConfig(config: Partial<KProxyConfig>): Promise<{ success: boolean }> {
    const response = await fetch(`${this.apiBase}/kproxy/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ config })
    })
    return response.json()
  }

  async getDeviceId(): Promise<string | undefined> {
    const response = await fetch(`${this.apiBase}/kproxy/device-id`, {
      credentials: 'include'
    })
    const data = await response.json()
    return data.deviceId
  }

  async setDeviceId(deviceId: string): Promise<{ success: boolean }> {
    const response = await fetch(`${this.apiBase}/kproxy/device-id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ deviceId })
    })
    return response.json()
  }

  async generateDeviceId(): Promise<string> {
    const response = await fetch(`${this.apiBase}/kproxy/device-id/generate`, {
      method: 'POST',
      credentials: 'include'
    })
    const data = await response.json()
    return data.deviceId
  }

  async getDeviceIdMappings(): Promise<DeviceIdMapping[]> {
    const response = await fetch(`${this.apiBase}/kproxy/device-id-mappings`, {
      credentials: 'include'
    })
    const data = await response.json()
    return data.mappings || []
  }

  async setDeviceIdMapping(accountId: string, deviceId: string): Promise<{ success: boolean }> {
    const response = await fetch(`${this.apiBase}/kproxy/device-id-mappings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ accountId, deviceId })
    })
    return response.json()
  }

  async removeDeviceIdMapping(accountId: string): Promise<{ success: boolean }> {
    const response = await fetch(`${this.apiBase}/kproxy/device-id-mappings/${accountId}`, {
      method: 'DELETE',
      credentials: 'include'
    })
    return response.json()
  }
}

export const kproxyAdapter: IKProxyAdapter = isElectron()
  ? new ElectronKProxyAdapter()
  : new WebKProxyAdapter()
