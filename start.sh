#!/bin/bash

# Kiro Account Manager - 启动脚本（Linux/macOS）

set -e

echo "🚀 Starting Kiro Account Manager (Web Mode)..."

# 切换到项目目录
cd "$(dirname "$0")/Kiro-account-manager"

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# 启动服务
echo "✅ Starting backend and frontend..."
npm run start:web
