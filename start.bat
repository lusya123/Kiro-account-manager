@echo off
REM Kiro Account Manager - 启动脚本（Windows）

echo Starting Kiro Account Manager (Web Mode)...

cd /d "%~dp0\Kiro-account-manager"

REM 检查依赖
if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
)

REM 启动服务
echo Starting backend and frontend...
call npm run start:web
