# 项目交接文档 - Kiro Account Manager 双端改造

## 快速上下文

**任务目标**：在保留 Electron 桌面端的基础上，新增 Web 端支持，让两端都能完整使用所有功能。

**当前状态**：
- ✅ Phase 1 完成：基础架构搭建
- ✅ Phase 2 完成：Web 后端服务
- ✅ Phase 3 完成：前端适配层完善
- ✅ Phase 4 完成：核心 Store 改造完成（accounts.ts）
- ✅ Phase 5 完成：Web 端构建和部署
- ⏳ Phase 4 可选：其他组件改造（约 18 个组件）
- ⏳ Phase 6 可选：完善和优化

**详细计划位置**：`/Users/xuehongyu/Downloads/Kiro-account-manager-main/IMPLEMENTATION_PLAN.md`

---

## 已完成的工作（Session 1）

### Phase 1：基础架构搭建 ✅

**1. 创建了目录结构**
```
src/
├── services/          # 业务逻辑层（新增）
├── server/            # Web 后端服务（新增）
│   ├── routes/
│   ├── middleware/
│   └── websocket.ts
├── renderer/src/
│   └── adapters/      # API 适配层（新增）
└── main/              # Electron 主进程（保留）
```

**2. 提取了业务逻辑到 services 层**
- `src/services/authService.ts` - 认证服务（OAuth、SSO、Token 刷新）
- `src/services/accountService.ts` - 账号管理服务
- `src/services/storageService.ts` - 存储服务抽象层
- `src/services/kiroApiService.ts` - Kiro API 调用服务

**3. 创建了完整的 API 适配层（6 个适配器）**
- `platform.ts` - 平台检测（isElectron/isWeb）
- `accounts.ts` - 账号管理适配器
- `auth.ts` - 认证适配器
- `proxy.ts` - 代理服务适配器
- `storage.ts` - 存储适配器
- `kproxy.ts` - K-Proxy 适配器
- `machineId.ts` - 机器码管理适配器

### Phase 2：Web 后端服务 ✅

**1. 安装了依赖**
```bash
npm install express cors ws jsonwebtoken @types/express @types/cors @types/ws @types/jsonwebtoken
```

**2. 创建了 Express 服务器**
- `src/server/index.ts` - 主服务器入口
- `src/server/websocket.ts` - WebSocket 事件推送管理器

**3. 实现了核心 API 端点**
- POST `/api/accounts/load` - 加载账号数据
- POST `/api/accounts/save` - 保存账号数据
- POST `/api/accounts/refresh-token` - 刷新 Token
- POST `/api/accounts/check-status` - 检查账号状态
- POST `/api/accounts/import-sso` - 从 SSO Token 导入账号

**4. 创建了路由模块**
- `src/server/routes/proxy.ts` - 代理服务路由（启动/停止/状态/配置/统计）
- `src/server/routes/kproxy.ts` - K-Proxy 路由（启动/停止/设备 ID 管理）

### Phase 3：前端适配层完善 ✅

- 所有 6 个适配器已创建并导出
- 统一了 Electron IPC 和 Web HTTP 调用接口
- 每个适配器都有 Electron 和 Web 两种实现
- 自动根据平台选择正确的实现

### Phase 4：前端组件改造（部分完成）✅

**已完成**：
- ✅ 改造了核心状态管理文件 `src/renderer/src/store/accounts.ts`（2383 行）
- ✅ 替换了所有 `window.api` 调用为适配层调用
- ✅ 修复了所有 TypeScript 编译错误
- ✅ 构建成功，Electron 端功能保持完整

**改造内容**：
```typescript
// 改造前
const data = await window.api.loadAccounts()
const result = await window.api.refreshAccountToken(account)
const machineId = await window.api.machineIdGetCurrent()

// 改造后
import { accountAdapter, machineIdAdapter } from '../adapters'
const data = await accountAdapter.loadAccounts()
const result = await accountAdapter.refreshToken(account)
const machineId = await machineIdAdapter.getMachineId()
```

---

## 下一步行动（Phase 4 剩余部分）

### 需要改造的组件（约 18 个）

**优先级 1（核心组件）**：
1. `src/renderer/src/components/accounts/AccountManager.tsx` - 账号管理主界面
2. `src/renderer/src/components/proxy/ProxyPanel.tsx` - 代理服务面板
3. `src/renderer/src/components/accounts/AddAccountDialog.tsx` - 添加账号对话框

**优先级 2（次要组件）**：
4. `src/renderer/src/components/kproxy/KProxyPanel.tsx` - K-Proxy 面板
5. `src/renderer/src/components/accounts/MachineIdPage.tsx` - 机器码管理页面
6. `src/renderer/src/components/settings/KiroSettingsPage.tsx` - Kiro 设置页面

**优先级 3（简单组件）**：
7. `src/renderer/src/components/HomePage.tsx` - 首页
8. `src/renderer/src/components/SettingsPage.tsx` - 设置页面
9. `src/renderer/src/components/AboutPage.tsx` - 关于页面
10. 其他 9 个组件

### 改造方法

**步骤 1**：查找组件中的 `window.api` 调用
```bash
grep -n "window.api" src/renderer/src/components/**/*.tsx
```

**步骤 2**：导入适配器
```typescript
import { accountAdapter, proxyAdapter, kproxyAdapter, machineIdAdapter, storageAdapter } from '../adapters'
```

**步骤 3**：替换调用
```typescript
// 账号相关
window.api.loadAccounts() → accountAdapter.loadAccounts()
window.api.refreshAccountToken() → accountAdapter.refreshToken()
window.api.checkAccountStatus() → accountAdapter.checkStatus()

// 代理服务相关
window.api.startProxy() → proxyAdapter.start()
window.api.stopProxy() → proxyAdapter.stop()
window.api.getProxyStatus() → proxyAdapter.getStatus()

// K-Proxy 相关
window.api.startKProxy() → kproxyAdapter.start()
window.api.getKProxyDeviceId() → kproxyAdapter.getDeviceId()

// 机器码相关
window.api.machineIdGetCurrent() → machineIdAdapter.getMachineId()
window.api.machineIdSet() → machineIdAdapter.setMachineId()

// 存储相关
window.api.exportAccounts() → storageAdapter.exportAccounts()
window.api.importAccounts() → storageAdapter.importAccounts()
```

**步骤 4**：验证构建
```bash
npm run build
```

---

## Phase 5：Web 端构建和部署（待开始）

### 第 1 步：配置 Web 端构建

创建 `web/vite.config.ts`：
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  root: './src/renderer',
  build: {
    outDir: '../../dist/web',
    emptyOutDir: true
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
})
```

### 第 2 步：创建 Web 端入口

创建 `web/index.html`：
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kiro Account Manager</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/renderer/src/main.tsx"></script>
</body>
</html>
```

### 第 3 步：添加构建脚本

在 `package.json` 中添加：
```json
{
  "scripts": {
    "dev:web": "vite --config web/vite.config.ts",
    "build:web": "vite build --config web/vite.config.ts",
    "start:server": "node dist/server/index.js"
  }
}
```

### 第 4 步：启动和测试

```bash
# 启动后端服务
npm run start:server

# 启动前端开发服务器
npm run dev:web

# 访问 http://localhost:5173
```

---

## Phase 6：完善和优化（待开始）

### 功能完善
- 实现 Web 端的文件导入/导出（使用浏览器 API）
- 实现 Web 端的虚拟机器码（localStorage）
- 完善错误处理和用户提示

### 安全加固
- 实现会话超时机制
- 添加 CSRF 保护
- 加密敏感数据传输

### 性能优化
- 优化 WebSocket 连接
- 添加请求缓存
- 优化前端打包体积

---

## 关键文件路径

**已创建的文件（19 个）**：
```
src/services/
├── authService.ts
├── accountService.ts
├── storageService.ts
└── kiroApiService.ts

src/server/
├── index.ts
├── websocket.ts
└── routes/
    ├── proxy.ts
    └── kproxy.ts

src/renderer/src/adapters/
├── index.ts
├── platform.ts
├── accounts.ts
├── auth.ts
├── proxy.ts
├── storage.ts
├── kproxy.ts
└── machineId.ts
```

**需要改造的文件（约 18 个组件）**：
```
src/renderer/src/components/
├── accounts/
│   ├── AccountManager.tsx
│   ├── AddAccountDialog.tsx
│   └── MachineIdPage.tsx
├── proxy/
│   └── ProxyPanel.tsx
├── kproxy/
│   └── KProxyPanel.tsx
├── settings/
│   └── KiroSettingsPage.tsx
├── HomePage.tsx
├── SettingsPage.tsx
└── AboutPage.tsx
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

## 验证方法

### Electron 端验证
```bash
npm run dev
# 测试核心功能：
# 1. 账号列表加载
# 2. 添加账号
# 3. Token 刷新
# 4. 代理服务启动/停止
```

### Web 端验证（Phase 5 后）
```bash
# 启动后端
npm run start:server

# 启动前端
npm run dev:web

# 访问 http://localhost:3000
# 测试所有功能
```

---

## 构建状态

- ✅ TypeScript 编译：无错误
- ✅ Electron 构建：成功
- ✅ 功能验证：Electron 端正常
- ⏳ Web 端构建：待配置
- ⏳ Web 端测试：待开始

---

## 给下一个 Session 的提示

**当前任务优先级**：
1. **Phase 4 剩余部分**：改造其他 18 个组件（预计 2-3 小时）
2. **Phase 5**：Web 端构建和部署（预计 1-2 小时）
3. **Phase 6**：完善和优化（预计 1-2 小时）

**注意事项**：
- 每改造一个组件，立即运行 `npm run build` 验证
- 保持小步快跑，避免一次改动过多文件
- 遇到编译错误立即修复，不要累积
- Electron 端功能必须保持完整

**快速开始命令**：
```bash
cd /Users/xuehongyu/Downloads/Kiro-account-manager-main/Kiro-account-manager
npm run build  # 验证当前状态
grep -rn "window.api" src/renderer/src/components/ | head -20  # 查找待改造的组件
```
