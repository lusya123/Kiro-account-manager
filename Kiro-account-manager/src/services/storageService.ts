// 存储服务 - 提供统一的数据存储抽象层

export interface IStorageService {
  get(key: string, defaultValue?: unknown): unknown
  set(key: string, value: unknown): void
  path: string
}

/**
 * Electron Store 实现（用于桌面端）
 */
export class ElectronStorageService implements IStorageService {
  private store: any

  constructor(storePath?: string) {
    // 延迟初始化，在实际使用时才导入 electron-store
  }

  async initialize(): Promise<void> {
    if (this.store) return

    const Store = (await import('electron-store')).default
    this.store = new Store({
      name: 'kiro-accounts',
      encryptionKey: 'kiro-account-manager-secret-key'
    })
  }

  get(key: string, defaultValue?: unknown): unknown {
    if (!this.store) throw new Error('Store not initialized')
    return this.store.get(key, defaultValue)
  }

  set(key: string, value: unknown): void {
    if (!this.store) throw new Error('Store not initialized')
    this.store.set(key, value)
  }

  get path(): string {
    if (!this.store) throw new Error('Store not initialized')
    return this.store.path
  }
}

/**
 * Web Storage 实现（用于 Web 端）
 * 通过 HTTP API 与后端通信
 */
export class WebStorageService implements IStorageService {
  private apiBase: string
  private cache: Map<string, unknown> = new Map()

  constructor(apiBase: string = '/api/storage') {
    this.apiBase = apiBase
  }

  async initialize(): Promise<void> {
    // Web 端不需要初始化
  }

  get(key: string, defaultValue?: unknown): unknown {
    return this.cache.get(key) ?? defaultValue
  }

  set(key: string, value: unknown): void {
    this.cache.set(key, value)
  }

  get path(): string {
    return 'web-storage'
  }

  async load(): Promise<void> {
    const response = await fetch(`${this.apiBase}/load`)
    const data = await response.json()
    Object.entries(data).forEach(([key, value]) => {
      this.cache.set(key, value)
    })
  }

  async save(): Promise<void> {
    const data = Object.fromEntries(this.cache)
    await fetch(`${this.apiBase}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
  }
}
