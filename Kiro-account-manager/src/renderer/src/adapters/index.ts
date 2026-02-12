// API 适配层统一导出

export * from './platform'
export * from './accounts'
export * from './auth'
export * from './proxy'
export * from './storage'
export * from './kproxy'
export * from './machineId'

// 导出适配器实例
export { accountAdapter } from './accounts'
export { authAdapter } from './auth'
export { proxyAdapter } from './proxy'
export { storageAdapter } from './storage'
export { kproxyAdapter } from './kproxy'
export { machineIdAdapter } from './machineId'
