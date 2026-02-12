# 项目交接文档 - Kiro Account Manager 双端改造

## 快速上下文

**任务目标**：在保留 Electron 桌面端的基础上，新增 Web 端支持，让两端都能完整使用所有功能。

**当前状态**：
- ✅ 已完成深度代码探索（前端通信层、后端架构、认证机制）
- ✅ 已完成架构设计和实施计划
- ⏳ 待开始：Phase 1 - 基础架构搭建

**详细计划位置**：`/Users/xuehongyu/.claude/plans/toasty-sniffing-rossum.md`

---

## 项目概况

**技术栈**：
- 前端：Electron + React 19 + TypeScript + Zustand + Tailwind CSS
- 后端：Node.js + electron-store
- 代理服务：纯 Node.js（可复用）
- 端口：5581（API 代理）、8900（K-Proxy）

**核心挑战**：
- 前端有 120+ 个 IPC 调用需要适配
- OAuth 回调在 Web 端不能用 `kiro://` 自定义协议
- 需要提取业务逻辑到独立的 services 层

**解决方案**：
- 创建 API 适配层，统一 Electron IPC 和 Web HTTP 调用
- 提取业务逻辑到 `src/services/`，供双端共享
- 实现 Express 后端服务，提供 REST API 和 WebSocket

---

## 下一步行动（Phase 1：基础架构搭建）

### 第 1 步：创建目录结构

```bash
cd /Users/xuehongyu/Downloads/Kiro-account-manager-main/Kiro-account-manager

# 创建新目录
mkdir -p src/services
mkdir -p src/server/routes
mkdir -p src/server/middleware
mkdir -p src/renderer/src/adapters
mkdir -p web
```

### 第 2 步：提取业务逻辑

**优先级 1**：从 `src/main/index.ts` 提取账号管理逻辑

创建 `src/services/accountService.ts`，提取以下功能：
- Token 刷新逻辑（`refresh-account-token` handler）
- 账号状态检查（`check-account-status` handler）
- SSO Token 导入（`import-from-sso-token` handler）
- 凭证验证（`verify-account-credentials` handler）

**关键代码位置**：
- `src/main/index.ts:1100-1300`（Token 刷新逻辑）
- `src/main/index.ts:1300-1500`（账号状态检查）

### 第 3 步：创建 API 适配层框架

创建 `src/renderer/src/adapters/platform.ts`：
```typescript
export const isElectron = () => {
  return typeof window !== 'undefined' && window.electron !== undefined
}
```

创建 `src/renderer/src/adapters/accounts.ts`：
```typescript
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

export const accountAdapter: IAccountAdapter = isElectron()
  ? new ElectronAccountAdapter()
  : new WebAccountAdapter()
```

### 第 4 步：验证 Electron 端功能

```bash
# 启动 Electron 应用
npm run dev

# 测试核心功能：
# 1. 账号列表加载
# 2. 添加账号
# 3. Token 刷新
# 4. 代理服务启动/停止
```

---

## 关键文件路径

**需要读取的文件**：
- `src/main/index.ts`（IPC 层，2500+ 行）
- `src/main/proxy/proxyServer.ts`（代理服务核心）
- `src/main/proxy/kiroApi.ts`（Kiro API 调用）
- `src/renderer/src/store/accounts.ts`（前端状态管理，2383 行）
- `src/preload/index.ts`（IPC 接口定义）

**需要创建的文件**（Phase 1）：
- `src/services/accountService.ts`
- `src/services/authService.ts`
- `src/services/storageService.ts`
- `src/renderer/src/adapters/platform.ts`
- `src/renderer/src/adapters/accounts.ts`
- `src/renderer/src/adapters/index.ts`

---

## 实施计划概览

| 阶段 | 任务 | 时间 | 状态 |
|------|------|------|------|
| Phase 1 | 基础架构搭建 | 1 周 | ⏳ 待开始 |
| Phase 2 | Web 后端服务 | 1 周 | ⏳ 待开始 |
| Phase 3 | 前端适配层完善 | 1 周 | ⏳ 待开始 |
| Phase 4 | 前端组件改造 | 1 周 | ⏳ 待开始 |
| Phase 5 | Web 端构建和部署 | 1 周 | ⏳ 待开始 |
| Phase 6 | 完善和优化 | 1 周 | ⏳ 待开始 |

**总工作量**：200-220 小时（5-6 周，使用 Claude Code 辅助）

---

## 给下一个 Claude Code Session 的提示词

```
我需要继续 Kiro Account Manager 的双端改造项目。

项目背景：
- 这是一个 Electron + React 的桌面应用，用于管理多个 AWS Kiro 账号
- 目标是在保留桌面端的基础上，新增 Web 端支持
- 详细的实施计划在 /Users/xuehongyu/.claude/plans/toasty-sniffing-rossum.md
- 交接文档在 /Users/xuehongyu/Downloads/Kiro-account-manager-main/HANDOFF.md

当前任务：Phase 1 - 基础架构搭建

请按照 HANDOFF.md 中的"下一步行动"开始执行：
1. 创建目录结构
2. 从 src/main/index.ts 提取账号管理业务逻辑到 src/services/accountService.ts
3. 创建 API 适配层框架（src/renderer/src/adapters/）
4. 验证 Electron 端功能不受影响

注意事项：
- 每完成一个步骤，立即测试 Electron 端功能
- 提取业务逻辑时，保持原有 IPC handler 调用新的 service
- 适配层接口要完整定义，但 Web 实现可以先留空（返回 mock 数据）
- 端口已改为 5581（API 代理）和 8900（K-Proxy）

请开始执行 Phase 1 的第 1 步。
```

---

## 技术要点

### API 适配层模式

```typescript
// 统一接口
interface IAdapter {
  method(): Promise<Result>
}

// 平台检测
const isElectron = () => typeof window.electron !== 'undefined'

// 自动选择实现
export const adapter = isElectron()
  ? new ElectronAdapter()
  : new WebAdapter()
```

### 业务逻辑提取原则

1. **保持 IPC handler 不变**，只是内部调用 service
2. **service 不依赖 Electron API**，纯 Node.js 逻辑
3. **复用现有代码**，如 `src/main/proxy/` 下的模块

### OAuth 回调适配

- **Electron**：使用 `kiro://` 自定义协议
- **Web**：使用标准 HTTP 回调 `/oauth/callback`
- **后端处理**：验证 state，交换 token，创建会话

---

## 风险提示

1. **业务逻辑提取不完整**：每提取一个模块，立即测试 Electron 端
2. **前端组件改造引入 bug**：小步快跑，每改一个组件立即测试
3. **WebSocket 连接不稳定**：实现重连机制和心跳检测
4. **数据存储迁移失败**：实现备份和恢复机制

---

## 联系方式

如有问题，请参考：
- 详细计划：`/Users/xuehongyu/.claude/plans/toasty-sniffing-rossum.md`
- 项目 README：`/Users/xuehongyu/Downloads/Kiro-account-manager-main/README.md`
- 原始代码：`/Users/xuehongyu/Downloads/Kiro-account-manager-main/Kiro-account-manager/`
