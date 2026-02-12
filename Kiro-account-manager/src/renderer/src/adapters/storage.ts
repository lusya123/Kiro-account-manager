// 存储适配器 - 统一 Electron IPC 和 Web HTTP 调用

import { isElectron } from './platform'

/**
 * 存储适配器接口
 */
export interface IStorageAdapter {
  exportAccounts(filePath: string): Promise<{ success: boolean; error?: string }>
  importAccounts(filePath: string): Promise<{ success: boolean; data?: any; error?: string }>
  selectFile(options: { filters?: any[] }): Promise<{ filePath?: string; canceled: boolean }>
  saveFile(options: { defaultPath?: string; filters?: any[] }): Promise<{ filePath?: string; canceled: boolean }>
}

/**
 * Electron 端实现
 */
class ElectronStorageAdapter implements IStorageAdapter {
  async exportAccounts(filePath: string): Promise<{ success: boolean; error?: string }> {
    return (window as any).api.exportAccounts(filePath)
  }

  async importAccounts(filePath: string): Promise<{ success: boolean; data?: any; error?: string }> {
    return (window as any).api.importAccounts(filePath)
  }

  async selectFile(options: { filters?: any[] }): Promise<{ filePath?: string; canceled: boolean }> {
    return (window as any).api.selectFile(options)
  }

  async saveFile(options: { defaultPath?: string; filters?: any[] }): Promise<{ filePath?: string; canceled: boolean }> {
    return (window as any).api.saveFile(options)
  }
}

/**
 * Web 端实现 - 使用浏览器 File API
 */
class WebStorageAdapter implements IStorageAdapter {
  async exportAccounts(filePath: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Web 端使用浏览器下载
      const response = await fetch('/api/storage/export', {
        method: 'POST',
        credentials: 'include'
      })
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filePath || 'accounts.json'
      a.click()
      URL.revokeObjectURL(url)
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  async importAccounts(_filePath: string): Promise<{ success: boolean; data?: any; error?: string }> {
    // Web 端通过 file input 实现
    return { success: false, error: 'Use file input for web import' }
  }

  async selectFile(options: { filters?: any[] }): Promise<{ filePath?: string; canceled: boolean }> {
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = options.filters?.map(f => f.extensions.map((e: string) => `.${e}`).join(',')).join(',') || '*'
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (file) {
          resolve({ filePath: file.name, canceled: false })
        } else {
          resolve({ canceled: true })
        }
      }
      input.click()
    })
  }

  async saveFile(options: { defaultPath?: string; filters?: any[] }): Promise<{ filePath?: string; canceled: boolean }> {
    // Web 端直接返回默认路径
    return { filePath: options.defaultPath || 'download.json', canceled: false }
  }
}

export const storageAdapter: IStorageAdapter = isElectron()
  ? new ElectronStorageAdapter()
  : new WebStorageAdapter()
