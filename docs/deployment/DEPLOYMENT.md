# Kiro Account Manager - 部署指南

## 环境要求

- Node.js 18+
- npm 或 yarn

## 后端部署

### 1. 安装依赖

```bash
cd Kiro-account-manager
npm install
```

### 2. 启动后端服务

```bash
npm run serve:backend
```

后端服务将在 `http://localhost:3000` 启动。

### 3. 环境变量配置（可选）

创建 `.env` 文件：

```bash
PORT=3000
CORS_ORIGIN=http://localhost:3001
```

## Web 前端部署

### 开发模式

```bash
cd Kiro-account-manager
npm run dev:web
```

前端开发服务器将在 `http://localhost:3001` 启动。

### 生产构建

```bash
cd Kiro-account-manager
npm run build:web
```

构建产物将输出到 `../web/dist` 目录。

### 使用 Nginx 部署

1. 构建前端：
   ```bash
   npm run build:web
   ```

2. 配置 Nginx：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /path/to/web/dist;
        try_files $uri $uri/ /index.html;
    }

    # API 反向代理
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket 反向代理
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

3. 重启 Nginx：
   ```bash
   sudo nginx -t
   sudo systemctl restart nginx
   ```

## 同时启动前后端（开发模式）

```bash
cd Kiro-account-manager
npm run start:web
```

这将同时启动后端服务（3000 端口）和前端开发服务器（3001 端口）。

## Electron 桌面端

### 开发模式

```bash
cd Kiro-account-manager
npm run dev
```

### 构建安装包

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

## 端口配置

- **3000**：Web 后端服务
- **3001**：Web 前端开发服务器
- **5581**：API 代理服务
- **8900**：K-Proxy 服务

## 验证部署

### 测试后端 API

```bash
# 健康检查
curl http://localhost:3000/health

# 测试账号加载
curl -X POST http://localhost:3000/api/accounts/load

# 测试代理服务状态
curl http://localhost:3000/api/proxy/status

# 测试 K-Proxy 状态
curl http://localhost:3000/api/kproxy/status
```

### 测试前端

访问 `http://localhost:3001`，检查：
- 页面是否正常加载
- API 调用是否正常
- WebSocket 连接是否正常

## 生产环境建议

### 使用 PM2 管理后端服务

1. 安装 PM2：
   ```bash
   npm install -g pm2
   ```

2. 创建 `ecosystem.config.js`：
   ```javascript
   module.exports = {
     apps: [{
       name: 'kiro-backend',
       script: 'npx',
       args: 'tsx src/server/index.ts',
       cwd: '/path/to/Kiro-account-manager',
       instances: 1,
       autorestart: true,
       watch: false,
       max_memory_restart: '1G',
       env: {
         NODE_ENV: 'production',
         PORT: 3000
       }
     }]
   }
   ```

3. 启动服务：
   ```bash
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup
   ```

### 安全建议

1. **使用 HTTPS**：配置 SSL 证书（Let's Encrypt）
2. **环境变量**：敏感信息存储在环境变量中
3. **CORS 配置**：限制允许的来源域名
4. **会话管理**：实现会话超时和刷新机制
5. **日志记录**：配置日志轮转和监控

## 故障排查

### 后端服务无法启动

1. 检查端口是否被占用：
   ```bash
   lsof -i:3000
   ```

2. 检查依赖是否安装完整：
   ```bash
   npm install
   ```

### 前端无法访问后端 API

1. 检查 CORS 配置
2. 检查代理配置（vite.web.config.ts）
3. 检查后端服务是否正常运行

### WebSocket 连接失败

1. 检查 Nginx 配置是否支持 WebSocket
2. 检查防火墙设置
3. 检查后端 WebSocket 服务是否启动

## 更新日志

- **2026-02-12**：初始版本，支持 Web 端和 Electron 端双平台部署
