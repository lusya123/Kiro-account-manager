// 平台检测 - 判断当前运行环境是 Electron 还是 Web

/**
 * 检测是否在 Electron 环境中运行
 */
export function isElectron(): boolean {
  return typeof window !== 'undefined' && (window as any).electron !== undefined
}

/**
 * 检测是否在 Web 环境中运行
 */
export function isWeb(): boolean {
  return !isElectron()
}

/**
 * 获取当前平台类型
 */
export function getPlatform(): 'electron' | 'web' {
  return isElectron() ? 'electron' : 'web'
}
