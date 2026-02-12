// WebSocket 事件推送服务

import type { WebSocketServer, WebSocket } from 'ws'

export interface ProxyRequestEvent {
  timestamp: number
  path: string
  model: string
  accountId: string
  method: string
}

export interface ProxyResponseEvent {
  timestamp: number
  path: string
  model: string
  accountId: string
  inputTokens: number
  outputTokens: number
  credits?: number
  responseTime: number
  success: boolean
}

export interface ProxyErrorEvent {
  timestamp: number
  message: string
  accountId?: string
}

export interface ProxyStatusChangeEvent {
  running: boolean
  port: number
}

/**
 * WebSocket 事件推送管理器
 */
export class WebSocketEventManager {
  private wss: WebSocketServer
  private clients: Set<WebSocket> = new Set()

  constructor(wss: WebSocketServer) {
    this.wss = wss

    this.wss.on('connection', (ws) => {
      console.log('[WebSocket] Client connected')
      this.clients.add(ws)

      ws.on('close', () => {
        console.log('[WebSocket] Client disconnected')
        this.clients.delete(ws)
      })

      ws.on('error', (error) => {
        console.error('[WebSocket] Client error:', error)
        this.clients.delete(ws)
      })
    })
  }

  /**
   * 广播事件到所有连接的客户端
   */
  private broadcast(event: { type: string; data: any }): void {
    const message = JSON.stringify(event)
    this.clients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        try {
          client.send(message)
        } catch (error) {
          console.error('[WebSocket] Failed to send message:', error)
        }
      }
    })
  }

  /**
   * 推送代理请求事件
   */
  sendProxyRequest(info: ProxyRequestEvent): void {
    this.broadcast({ type: 'proxy-request', data: info })
  }

  /**
   * 推送代理响应事件
   */
  sendProxyResponse(info: ProxyResponseEvent): void {
    this.broadcast({ type: 'proxy-response', data: info })
  }

  /**
   * 推送代理错误事件
   */
  sendProxyError(error: ProxyErrorEvent): void {
    this.broadcast({ type: 'proxy-error', data: error })
  }

  /**
   * 推送代理状态变化事件
   */
  sendProxyStatusChange(status: ProxyStatusChangeEvent): void {
    this.broadcast({ type: 'proxy-status-change', data: status })
  }

  /**
   * 推送账号更新事件
   */
  sendAccountUpdate(accountId: string, credentials: any): void {
    this.broadcast({
      type: 'proxy-account-update',
      data: { id: accountId, ...credentials }
    })
  }

  /**
   * 获取当前连接的客户端数量
   */
  getClientCount(): number {
    return this.clients.size
  }
}
