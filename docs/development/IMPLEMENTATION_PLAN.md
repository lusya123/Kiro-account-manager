# Kiro Account Manager 双端架构改造方案

## Context

**改造目标**：在保留 Electron 桌面端的基础上，新增 Web 端支持，让两端都能完整使用所有功能。

**当前状态**：
- Electron + React 桌面应用
- 前端：120+ IPC 调用，19 个核心组件，使用 Zustand 状态管理
- 后端：60+ IPC handler，业务逻辑在 `src/main/`
- 代理服务（`src/main/proxy/`）是纯 Node.js，可直接复用
- 数据存储：electron-store（加密 JSON）
- 端口：5581（API 代理）、8900（K-Proxy）

**核心挑战**：
1. 前端组件大量使用 `window.api.xxx()` IPC 调用
2. OAuth 回调在 Web 端不能用 `kiro://` 自定义协议
3. 需要后端 API 服务替代 IPC 通信
4. 数据存储需要适配（electron-store → 数据库/localStorage）

---

## 架构设计

### 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    前端层（共享）                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ React 组件（19 个核心组件）                          │   │
│  │ Zustand Store（状态管理）                            │   │
│  │ UI 组件库（Tailwind CSS）                            │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ↓                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         API 适配层（新增）                           │   │
│  │  - 平台检测：isElectron()                            │   │
│  │  - Electron 端：调用 window.api.xxx()               │   │
│  │  - Web 端：调用 fetch('/api/xxx')                   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
         ↓ (Electron)                    ↓ (Web)
┌──────────────────────┐      ┌──────────────────────────────┐
│   Electron IPC 层    │      │   后端 API 服务（新增）      │
│  (src/main/index.ts) │      │  - Express/Fastify 服务器    │
└──────────────────────┘      │  - REST API 端点             │
         ↓                     │  - WebSocket（实时事件）     │
┌──────────────────────┐      └──────────────────────────────┘
│   业务逻辑层（共享） │                   ↓
│  - 账号管理          │←──────────────────┘
│  - 代理服务          │
│  - K-Proxy 服务      │
│  - 认证流程          │
└──────────────────────┘
         ↓
┌──────────────────────┐
│   数据存储层         │
│  - Electron: store   │
│  - Web: SQLite/JSON  │
└──────────────────────┘
```

### 代码组织结构

```
Kiro-account-manager/
├── src/
│   ├── main/                    # Electron 主进程（保留）
│   │   ├── index.ts             # IPC 层
│   │   ├── proxy/               # 代理服务（可复用）
│   │   ├── kproxy/              # K-Proxy（可复用）
│   │   └── machineId.ts         # 机器码管理
│   │
│   ├── services/                # 业务逻辑层（新增，双端共享）
│   │   ├── accountService.ts    # 账号管理业务逻辑
│   │   ├── authService.ts       # 认证流程业务逻辑
│   │   ├── proxyService.ts      # 代理服务业务逻辑
│   │   └── storageService.ts    # 数据存储抽象层
│   │
│   ├── server/                  # Web 后端服务（新增）
│   │   ├── index.ts             # Express 服务器入口
│   │   ├── routes/              # API 路由
│   │   │   ├── accounts.ts      # 账号管理 API
│   │   │   ├── auth.ts          # 认证 API
│   │   │   ├── proxy.ts         # 代理服务 API
│   │   │   └── kproxy.ts        # K-Proxy API
│   │   ├── middleware/          # 中间件
│   │   │   ├── auth.ts          # 会话验证
│   │   │   └── cors.ts          # CORS 配置
│   │   └── websocket.ts         # WebSocket 事件推送
│   │
│   ├── renderer/                # React 前端（保留）
│   │   └── src/
│   │       ├── adapters/        # API 适配层（新增）
│   │       │   ├── index.ts     # 统一导出
│   │       │   ├── platform.ts  # 平台检测
│   │       │   ├── accounts.ts  # 账号管理适配
│   │       │   ├── auth.ts      # 认证适配
│   │       │   ├── proxy.ts     # 代理服务适配
│   │       │   └── storage.ts   # 存储适配
│   │       ├── components/      # React 组件（保留）
│   │       ├── store/           # Zustand Store（保留）
│   │       └── types/           # TypeScript 类型（保留）
│   │
│   └── preload/                 # Electron preload（保留）
│
├── web/                         # Web 端独立构建（新增）
│   ├── index.html
│   ├── vite.config.ts
│   └── public/
│
└── package.json
```

---

## 关键改造点

### 1. API 适配层（核心）

**文件**：`src/renderer/src/adapters/index.ts`

```typescript
// 平台检测
export const isElectron = () => {
  return typeof window !== 'undefined' && window.electron !== undefined
}

// 统一的 API 接口
export interface IAccountAdapter {
  loadAccounts(): Promise<AccountData>
  saveAccounts(data: AccountData): Promise<void>
  refreshToken(account: Account): Promise<RefreshResult>
  checkStatus(account: Account): Promise<StatusResult>
}

// Electron 实现
class ElectronAccountAdapter implements IAccountAdapter {
  async loadAccounts() {
    return window.api.loadAccounts()
  }
  // ... 其他方法
}

// Web 实现
class WebAccountAdapter implements IAccountAdapter {
  async loadAccounts() {
    const res = await fetch('/api/accounts/load')
    return res.json()
  }
  // ... 其他方法
}

// 自动选择
export const accountAdapter: IAccountAdapter = isElectron()
  ? new ElectronAccountAdapter()
  : new WebAccountAdapter()
```

**需要创建的适配器**：
- `accounts.ts`：账号管理（12 个方法）
- `auth.ts`：认证流程（15 个方法）
- `proxy.ts`：代理服务（30 个方法）
- `kproxy.ts`：K-Proxy（20 个方法）
- `machineId.ts`：机器码管理（8 个方法）
- `storage.ts`：文件操作（导入/导出）

### 2. 业务逻辑提取

**从 `src/main/index.ts` 提取业务逻辑到 `src/services/`**

**示例**：`src/services/accountService.ts`

```typescript
import { ProxyAccount } from '../main/proxy/types'

export class AccountService {
  // Token 刷新逻辑（从 IPC handler 提取）
  async refreshToken(account: ProxyAccount): Promise<RefreshResult> {
    const { refreshToken, clientId, clientSecret, region, authMethod } = account.credentials

    if (authMethod === 'social') {
      return this.refreshSocialToken(refreshToken)
    } else {
      return this.refreshOidcToken(refreshToken, clientId, clientSecret, region)
    }
  }

  // 账号状态检查
  async checkStatus(account: ProxyAccount): Promise<StatusResult> {
    // 复用 src/main/proxy/kiroApi.ts 的逻辑
  }

  // 其他业务方法...
}
```

**关键文件**：
- `src/services/accountService.ts`：账号管理、Token 刷新、状态检查
- `src/services/authService.ts`：OAuth 流程、会话管理
- `src/services/proxyService.ts`：代理服务管理（复用 `src/main/proxy/proxyServer.ts`）
- `src/services/storageService.ts`：数据存储抽象（Electron 用 electron-store，Web 用 SQLite）

### 3. Web 后端 API 服务

**文件**：`src/server/index.ts`

```typescript
import express from 'express'
import { AccountService } from '../services/accountService'
import { ProxyServer } from '../main/proxy/proxyServer'

const app = express()
const accountService = new AccountService()
const proxyServer = new ProxyServer()

// 账号管理 API
app.post('/api/accounts/load', async (req, res) => {
  const data = await storageService.load()
  res.json(data)
})

app.post('/api/accounts/refresh-token', async (req, res) => {
  const result = await accountService.refreshToken(req.body.account)
  res.json(result)
})

// 代理服务 API
app.post('/api/proxy/start', async (req, res) => {
  await proxyServer.start()
  res.json({ success: true })
})

app.get('/api/proxy/status', async (req, res) => {
  const status = proxyServer.getStatus()
  res.json(status)
})

// WebSocket 事件推送
const wss = new WebSocketServer({ server })
wss.on('connection', (ws) => {
  proxyServer.on('request', (info) => {
    ws.send(JSON.stringify({ type: 'proxy-request', data: info }))
  })
})

app.listen(3000)
```

**需要的 API 端点**（共 40+ 个）：
- `/api/accounts/*`：账号管理（10 个）
- `/api/auth/*`：认证流程（8 个）
- `/api/proxy/*`：代理服务（15 个）
- `/api/kproxy/*`：K-Proxy（10 个）
- `/api/machine-id/*`：机器码管理（5 个）
- WebSocket：`/ws`（实时事件推送）

### 4. 前端组件改造

**改造方式**：替换所有 `window.api.xxx()` 为适配层调用

**示例**：`src/renderer/src/store/accounts.ts`

```typescript
// 改造前
import { window } from '@electron-toolkit/preload'

async loadFromStorage() {
  const data = await window.api.loadAccounts()
  // ...
}

// 改造后
import { accountAdapter } from '../adapters'

async loadFromStorage() {
  const data = await accountAdapter.loadAccounts()
  // ...
}
```

**需要改造的文件**（19 个组件 + 1 个 Store）：
- `src/renderer/src/store/accounts.ts`（核心，2383 行）
- `src/renderer/src/components/accounts/AccountManager.tsx`
- `src/renderer/src/components/proxy/ProxyPanel.tsx`
- `src/renderer/src/components/kproxy/KProxyPanel.tsx`
- 其他 16 个组件

### 5. Web 端 OAuth 回调处理

**问题**：Web 端不能用 `kiro://` 自定义协议

**解决方案**：使用标准 OAuth 回调 URL

```typescript
// src/server/routes/auth.ts
app.get('/oauth/callback', async (req, res) => {
  const { code, state } = req.query

  // 验证 state
  const storedState = await redis.get(`oauth:${state}`)
  if (!storedState) {
    return res.status(400).send('Invalid state')
  }

  // 交换 token
  const tokens = await authService.exchangeToken(code, storedState.codeVerifier)

  // 创建会话
  const sessionToken = jwt.sign({ userId, tokens }, SECRET, { expiresIn: '1h' })

  // 设置 HttpOnly Cookie
  res.cookie('session', sessionToken, { httpOnly: true, secure: true })

  // 重定向到前端
  res.redirect('/dashboard')
})
```

### 6. 数据存储适配

**Electron 端**：继续使用 electron-store

**Web 端**：使用 SQLite（服务器端）或 localStorage（客户端）

```typescript
// src/services/storageService.ts
export interface IStorageService {
  load(): Promise<AccountData>
  save(data: AccountData): Promise<void>
}

class ElectronStorageService implements IStorageService {
  private store = new Store({ encryptionKey: 'xxx' })

  async load() {
    return this.store.get('accountData')
  }
}

class WebStorageService implements IStorageService {
  async load() {
    // 从后端 API 加载
    const res = await fetch('/api/storage/load')
    return res.json()
  }
}
```

---

## 实施步骤

### Phase 1：基础架构搭建（第 1 周）

**目标**：建立双端架构的基础框架

1. **创建目录结构**
   - 创建 `src/services/`
   - 创建 `src/server/`
   - 创建 `src/renderer/src/adapters/`

2. **提取业务逻辑**
   - 从 `src/main/index.ts` 提取账号管理逻辑到 `src/services/accountService.ts`
   - 从 `src/main/index.ts` 提取认证逻辑到 `src/services/authService.ts`
   - 创建 `src/services/storageService.ts` 抽象层

3. **创建 API 适配层框架**
   - 实现 `src/renderer/src/adapters/platform.ts`（平台检测）
   - 实现 `src/renderer/src/adapters/accounts.ts`（账号管理适配器）
   - 定义统一的接口类型

4. **验证**：
   - Electron 端仍能正常运行
   - 业务逻辑提取后功能不受影响

### Phase 2：Web 后端服务（第 2 周）

**目标**：实现 Web 端的后端 API 服务

1. **搭建 Express 服务器**
   - 创建 `src/server/index.ts`
   - 配置 CORS、body-parser、session 中间件
   - 实现健康检查端点 `/health`

2. **实现核心 API 端点**
   - `/api/accounts/load`、`/api/accounts/save`
   - `/api/accounts/refresh-token`、`/api/accounts/check-status`
   - `/api/auth/init`、`/api/auth/callback`

3. **实现 WebSocket 事件推送**
   - 创建 `src/server/websocket.ts`
   - 推送代理服务事件（请求、响应、错误）

4. **验证**：
   - 使用 Postman/curl 测试 API 端点
   - 测试 WebSocket 连接和事件推送

### Phase 3：前端适配层完善（第 3 周）

**目标**：完善所有适配器，让前端组件能在两端运行

1. **实现所有适配器**
   - `adapters/auth.ts`（认证流程）
   - `adapters/proxy.ts`（代理服务）
   - `adapters/kproxy.ts`（K-Proxy）
   - `adapters/machineId.ts`（机器码管理）
   - `adapters/storage.ts`（文件操作）

2. **改造 Zustand Store**
   - 修改 `src/renderer/src/store/accounts.ts`
   - 替换所有 `window.api.xxx()` 为 `accountAdapter.xxx()`
   - 添加平台检测逻辑

3. **验证**：
   - Electron 端功能完整
   - 适配层接口定义完整

### Phase 4：前端组件改造（第 4 周）

**目标**：改造所有前端组件，支持双端运行

1. **改造核心组件**（优先级高）
   - `AccountManager.tsx`
   - `ProxyPanel.tsx`
   - `AddAccountDialog.tsx`

2. **改造次要组件**（优先级中）
   - `KProxyPanel.tsx`
   - `MachineIdPage.tsx`
   - `KiroSettingsPage.tsx`

3. **改造简单组件**（优先级低）
   - `HomePage.tsx`
   - `SettingsPage.tsx`
   - `AboutPage.tsx`

4. **验证**：
   - Electron 端所有功能正常
   - 组件改造后无回归问题

### Phase 5：Web 端构建和部署（第 5 周）

**目标**：实现 Web 端的独立构建和部署

1. **配置 Web 端构建**
   - 创建 `web/vite.config.ts`
   - 配置环境变量（API_BASE_URL）
   - 添加构建脚本到 `package.json`

2. **实现 Web 端入口**
   - 创建 `web/index.html`
   - 配置路由（React Router）
   - 实现登录页面

3. **部署到云服务器**
   - 构建前端：`npm run build:web`
   - 启动后端：`node dist/server/index.js`
   - 配置 Nginx 反向代理

4. **验证**：
   - Web 端能正常访问
   - 账号管理功能正常
   - 代理服务功能正常

### Phase 6：完善和优化（第 6 周）

**目标**：完善功能，修复 bug，优化性能

1. **功能完善**
   - 实现 Web 端的文件导入/导出（使用浏览器 API）
   - 实现 Web 端的虚拟机器码（localStorage）
   - 完善错误处理和用户提示

2. **安全加固**
   - 实现会话超时机制
   - 添加 CSRF 保护
   - 加密敏感数据传输

3. **性能优化**
   - 优化 WebSocket 连接
   - 添加请求缓存
   - 优化前端打包体积

4. **验证**：
   - 端到端测试所有功能
   - 性能测试（并发、响应时间）
   - 安全测试（渗透测试）

---

## 关键文件清单

### 需要创建的新文件（约 30 个）

**业务逻辑层**：
- `src/services/accountService.ts`
- `src/services/authService.ts`
- `src/services/proxyService.ts`
- `src/services/storageService.ts`

**后端 API 服务**：
- `src/server/index.ts`
- `src/server/routes/accounts.ts`
- `src/server/routes/auth.ts`
- `src/server/routes/proxy.ts`
- `src/server/routes/kproxy.ts`
- `src/server/middleware/auth.ts`
- `src/server/websocket.ts`

**前端适配层**：
- `src/renderer/src/adapters/index.ts`
- `src/renderer/src/adapters/platform.ts`
- `src/renderer/src/adapters/accounts.ts`
- `src/renderer/src/adapters/auth.ts`
- `src/renderer/src/adapters/proxy.ts`
- `src/renderer/src/adapters/kproxy.ts`
- `src/renderer/src/adapters/machineId.ts`
- `src/renderer/src/adapters/storage.ts`

**Web 端构建**：
- `web/index.html`
- `web/vite.config.ts`
- `web/tsconfig.json`

### 需要修改的现有文件（约 20 个）

**前端组件**：
- `src/renderer/src/store/accounts.ts`（核心）
- `src/renderer/src/components/accounts/AccountManager.tsx`
- `src/renderer/src/components/proxy/ProxyPanel.tsx`
- `src/renderer/src/components/kproxy/KProxyPanel.tsx`
- 其他 16 个组件

**配置文件**：
- `package.json`（添加 Web 端构建脚本）
- `tsconfig.json`（配置路径别名）

---

## 验证方法

### 端到端测试

**Electron 端**：
1. 启动应用：`npm run dev`
2. 测试账号管理：添加、编辑、删除、刷新 Token
3. 测试代理服务：启动、停止、查看日志
4. 测试 K-Proxy：启动、停止、设备 ID 管理
5. 测试机器码管理：获取、设置、备份

**Web 端**：
1. 启动后端：`node dist/server/index.js`
2. 启动前端：`npm run dev:web`
3. 访问 `http://localhost:3000`
4. 测试登录流程（OAuth 回调）
5. 测试账号管理功能
6. 测试代理服务功能
7. 测试实时事件推送（WebSocket）

### 功能对比测试

| 功能 | Electron 端 | Web 端 | 备注 |
|------|------------|--------|------|
| 账号管理 | ✓ | ✓ | 完全一致 |
| Token 刷新 | ✓ | ✓ | 完全一致 |
| 代理服务 | ✓ | ✓ | 完全一致 |
| K-Proxy | ✓ | ✓ | 完全一致 |
| 机器码管理 | ✓ | ✓（虚拟） | Web 端使用虚拟机器码 |
| 文件导入/导出 | ✓ | ✓ | Web 端使用浏览器 API |
| 系统托盘 | ✓ | ✗ | Web 端不支持 |
| 自动更新 | ✓ | ✗ | Web 端不需要 |

### 性能测试

1. **并发测试**：100 个并发请求，响应时间 < 500ms
2. **WebSocket 测试**：1000 个事件推送，无丢失
3. **内存测试**：长时间运行（24 小时），内存稳定

### 安全测试

1. **会话管理**：测试会话超时、Token 刷新
2. **CSRF 保护**：测试跨站请求伪造防护
3. **XSS 防护**：测试输入过滤和输出转义
4. **SQL 注入**：测试数据库查询安全

---

## 风险和缓解措施

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| 业务逻辑提取不完整 | 高 | 中 | 逐步提取，每步验证 Electron 端功能 |
| OAuth 回调在 Web 端失败 | 高 | 低 | 提前测试 OAuth 流程，准备备用方案 |
| WebSocket 连接不稳定 | 中 | 中 | 实现重连机制，添加心跳检测 |
| 前端组件改造引入 bug | 中 | 高 | 每改造一个组件立即测试，保持小步快跑 |
| 数据存储迁移失败 | 高 | 低 | 实现数据备份和恢复机制 |
| 性能不达标 | 中 | 中 | 提前进行性能测试，优化瓶颈 |

---

## 工作量估算

- **Phase 1**：基础架构搭建 - 40 小时
- **Phase 2**：Web 后端服务 - 60 小时
- **Phase 3**：前端适配层完善 - 50 小时
- **Phase 4**：前端组件改造 - 80 小时
- **Phase 5**：Web 端构建和部署 - 40 小时
- **Phase 6**：完善和优化 - 50 小时

**总计**：320 小时（约 8 周，1 人全职）

使用 Claude Code 辅助开发，预计可以节省 30-40% 的时间，实际工作量约 **200-220 小时（5-6 周）**。
