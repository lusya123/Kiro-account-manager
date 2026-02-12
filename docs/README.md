# 文档目录

本目录包含 Kiro Account Manager 项目的所有文档，按类型分类组织。

## 目录结构

```
docs/
├── README.md                    # 本文件
├── development/                 # 开发过程文档
│   ├── README.md               # 开发文档索引
│   ├── PROJECT_SUMMARY.md      # 项目完成总结（当前有效）
│   └── archive/                # 历史文档归档
│       ├── 01-IMPLEMENTATION_PLAN.md   # 实施计划
│       ├── 02-HANDOFF.md              # 项目交接记录
│       └── 03-NEXT_SESSION_PROMPT.md  # 会话提示词
└── deployment/                  # 部署相关文档
    ├── DEPLOYMENT.md           # 部署指南
    ├── start.sh                # Linux/macOS 启动脚本
    └── start.bat               # Windows 启动脚本
```

## 文档说明

### 开发过程文档 (`development/`)

这些文档记录了双端架构改造的完整开发过程，供 AI 和开发者阅读。

**当前有效文档**：
- **PROJECT_SUMMARY.md** - 项目完成总结，包含技术架构、使用方法、验证结果

**历史文档归档** (`archive/`)：
- **01-IMPLEMENTATION_PLAN.md** - 最初的实施计划，包含架构设计、改造方案、分阶段计划
- **02-HANDOFF.md** - 项目交接文档，记录每个 session 的详细进度、已完成工作、待解决问题
- **03-NEXT_SESSION_PROMPT.md** - 给下一个 AI session 的完整提示词，包含背景、进度、执行要求

**阅读顺序建议**：
1. 新接手项目：直接读 `PROJECT_SUMMARY.md` 了解最终状态
2. 了解开发过程：按顺序阅读 archive 目录中的 01 → 02 → 03
3. 继续开发：参考 `PROJECT_SUMMARY.md` 中的"下一步建议"

### 部署文档 (`deployment/`)

这些文档用于实际部署和运行项目：

- **DEPLOYMENT.md** - 完整的部署指南，包含环境要求、部署步骤、验证方法
- **start.sh** - Linux/macOS 一键启动脚本
- **start.bat** - Windows 一键启动脚本

## 快速链接

- [项目主 README](../README.md)
- [中文 README](../README_CN.md)
- [部署指南](deployment/DEPLOYMENT.md)
- [项目总结](development/PROJECT_SUMMARY.md)

## 文档维护

- 开发过程文档：每个重要 session 结束后更新 `HANDOFF.md`
- 部署文档：功能变更或部署流程变化时更新
- 本 README：新增文档类型时更新目录结构
