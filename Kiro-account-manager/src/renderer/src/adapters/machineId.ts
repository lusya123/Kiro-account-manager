// 机器码管理适配器 - 统一 Electron IPC 和 Web HTTP 调用

import { isElectron } from './platform'

/**
 * 机器码管理适配器接口
 */
export interface IMachineIdAdapter {
  getMachineId(): Promise<string>
  setMachineId(machineId: string): Promise<{ success: boolean }>
  resetMachineId(): Promise<{ success: boolean }>
  exportMachineId(filePath: string): Promise<{ success: boolean; error?: string }>
  importMachineId(filePath: string): Promise<{ success: boolean; machineId?: string; error?: string }>
}

/**
 * Electron 端实现
 */
class ElectronMachineIdAdapter implements IMachineIdAdapter {
  async getMachineId(): Promise<string> {
    return (window as any).api.getMachineId()
  }

  async setMachineId(machineId: string): Promise<{ success: boolean }> {
    return (window as any).api.setMachineId(machineId)
  }

  async resetMachineId(): Promise<{ success: boolean }> {
    return (window as any).api.resetMachineId()
  }

  async exportMachineId(filePath: string): Promise<{ success: boolean; error?: string }> {
    return (window as any).api.exportMachineId(filePath)
  }

  async importMachineId(filePath: string): Promise<{ success: boolean; machineId?: string; error?: string }> {
    return (window as any).api.importMachineId(filePath)
  }
}

/**
 * Web 端实现 - 使用 localStorage 存储虚拟机器码
 */
class WebMachineIdAdapter implements IMachineIdAdapter {
  private storageKey = 'virtual-machine-id'

  async getMachineId(): Promise<string> {
    // Web 端使用虚拟机器码（存储在 localStorage）
    let machineId = localStorage.getItem(this.storageKey)
    if (!machineId) {
      // 生成新的虚拟机器码
      machineId = this.generateVirtualMachineId()
      localStorage.setItem(this.storageKey, machineId)
    }
    return machineId
  }

  async setMachineId(machineId: string): Promise<{ success: boolean }> {
    localStorage.setItem(this.storageKey, machineId)
    return { success: true }
  }

  async resetMachineId(): Promise<{ success: boolean }> {
    const newMachineId = this.generateVirtualMachineId()
    localStorage.setItem(this.storageKey, newMachineId)
    return { success: true }
  }

  async exportMachineId(filePath: string): Promise<{ success: boolean; error?: string }> {
    try {
      const machineId = await this.getMachineId()
      const blob = new Blob([machineId], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filePath || 'machine-id.txt'
      a.click()
      URL.revokeObjectURL(url)
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  async importMachineId(_filePath: string): Promise<{ success: boolean; machineId?: string; error?: string }> {
    // Web 端通过 file input 实现
    return { success: false, error: 'Use file input for web import' }
  }

  private generateVirtualMachineId(): string {
    // 生成 64 位十六进制字符串（模拟真实机器码格式）
    const chars = '0123456789abcdef'
    let result = ''
    for (let i = 0; i < 64; i++) {
      result += chars[Math.floor(Math.random() * chars.length)]
    }
    return result
  }
}

export const machineIdAdapter: IMachineIdAdapter = isElectron()
  ? new ElectronMachineIdAdapter()
  : new WebMachineIdAdapter()
