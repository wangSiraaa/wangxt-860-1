# SaaS 客户实施里程碑全栈管理平台

## 项目概述

基于 React + Node.js + PostgreSQL + Docker 的 SaaS 客户实施里程碑全栈管理平台，实现客户项目从建档到验收的全流程管理，核心业务规则为**前置里程碑未完成不能验收**。

## 技术栈

| 层级 | 技术栈 |
|------|--------|
| 前端 | React 18 + TypeScript + Vite + Tailwind CSS + React Router v6 |
| 后端 | Node.js + Express + TypeScript + PostgreSQL + JWT |
| 数据库 | PostgreSQL 15 |
| 容器化 | Docker + Docker Compose |
| 文件上传 | Multer (支持 50MB 附件) |

## 核心数据模型

- **客户项目** (projects)：项目基本信息、状态、进度
- **里程碑** (milestones)：里程碑定义、前置依赖关系、状态流转
- **风险项** (risks)：风险等级、状态、缓解措施
- **会议纪要** (meeting_minutes)：会议内容、参会人员、附件上传
- **验收单** (acceptance_forms)：验收内容、审核流程、附件管理

## 核心业务规则

### 前置里程碑校验

系统在以下场景自动校验前置里程碑是否完成：

1. **里程碑状态变更为 completed 时** - 调用 `checkPredecessorMilestones` 校验
2. **验收单提交时** - 调用 `checkAcceptanceCanSubmit` 校验
3. **前端提交前置检查** - 调用 `checkMilestoneCanAccept` 预检

**错误响应格式**：
```json
{
  "success": false,
  "message": "前置里程碑[需求调研]未完成，无法完成当前里程碑",
  "code": "PREDECESSOR_NOT_COMPLETED"
}
```

## 快速开始

### 方式一：Docker 容器启动（推荐）

#### 1. 环境要求
- Docker >= 20.10
- Docker Compose >= 2.0

#### 2. 启动所有服务
```bash
# 构建并启动容器（后台运行）
npm run docker:up

# 或手动执行
docker-compose up -d --build
```

**服务端口映射**：
| 服务 | 端口 | 访问地址 |
|------|------|----------|
| 前端 | 3000 | http://localhost:3000 |
| 后端 API | 3001 | http://localhost:3001 |
| PostgreSQL | 5432 | localhost:5432 |

#### 3. 数据初始化

数据库会在首次启动时自动执行 `backend/prisma/init.sql` 初始化表结构。

如需手动初始化种子数据：
```bash
# 进入后端容器
docker exec -it milestone-backend sh

# 执行种子数据脚本
npm run db:seed
```

#### 4. 验证服务启动
```bash
# 查看容器状态
docker-compose ps

# 查看服务日志
docker-compose logs -f backend
docker-compose logs -f frontend
```

### 方式二：本地开发启动

#### 1. 安装依赖
```bash
# 安装根目录依赖
npm install

# 安装前后端依赖
npm run install:all
```

#### 2. 配置环境变量
```bash
cp .env.example .env
```

#### 3. 启动 PostgreSQL
```bash
docker-compose up -d postgres
```

#### 4. 初始化数据库
```bash
npm run db:init
```

#### 5. 启动开发服务
```bash
# 同时启动前后端
npm run dev

# 分别启动
npm run dev:backend    # 后端: http://localhost:3001
npm run dev:frontend   # 前端: http://localhost:3000
```

## 健康检查

### 后端健康检查接口

**接口地址**：`GET /api/health`

**请求示例**：
```bash
# 使用 npm 脚本
npm run healthcheck

# 手动调用
curl -f http://localhost:3001/api/health
```

**成功响应**：
```json
{
  "success": true,
  "message": "Service is healthy",
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "database": "connected",
    "version": "1.0.0"
  }
}
```

**Docker 健康检查配置**：
- 检查间隔：30秒
- 超时时间：10秒
- 重试次数：3次
- 启动延迟：40秒

### PostgreSQL 健康检查
```bash
docker exec milestone-postgres pg_isready -U postgres
```

## 测试账号

系统预置以下测试用户（密码均为 `password123`）：

| 用户名 | 角色 | 权限说明 |
|--------|------|----------|
| admin | admin | 系统管理员，拥有所有权限 |
| manager | manager | 项目经理，可管理项目、里程碑、提交验收 |
| member | member | 普通成员，可查看、登记风险、上传纪要 |

## 业务流程说明

### 1. 项目建档
- 管理员/项目经理创建项目，配置基本信息
- 添加项目成员，分配角色权限
- 设置项目起止日期

### 2. 里程碑维护
- 按顺序创建里程碑（需求调研 → 方案设计 → 开发实施 → UAT测试 → 上线交付）
- 配置里程碑前置依赖关系（如：方案设计 依赖 需求调研）
- 维护里程碑计划日期、描述等信息

### 3. 风险登记
- 项目成员登记识别到的风险项
- 设置风险等级（低/中/高/致命）
- 记录缓解措施，跟踪处理状态

### 4. 纪要上传
- 上传项目会议纪要
- 支持附件上传（PDF、Word、Excel 等）
- 记录参会人员、会议地点

### 5. 验收流程
1. **创建验收单** - 选择关联项目和里程碑
2. **提交验收** - 系统自动校验前置里程碑是否完成
3. **审核验收** - 管理员审核通过或拒绝
4. **里程碑自动完成** - 验收通过后关联里程碑自动标记为 completed

### 6. 管理看板
- 项目总体进度统计
- 里程碑完成情况概览
- 风险项统计（按等级、状态）
- 待办验收单提醒

## 接口验证：跳过前置里程碑验收

### 验证目的

验证核心业务规则**"前置里程碑未完成不能验收"**是否生效，确保系统拒绝跳过前置里程碑的验收操作。

### 前置条件
1. 系统已启动，服务正常运行
2. 已登录获取有效 Token
3. 存在至少两个具有依赖关系的里程碑（M1 是 M2 的前置）
4. M1 状态为 `pending` 或 `in_progress`（未完成）
5. M2 状态为 `in_progress`

### 验证步骤

#### 步骤 1：获取访问令牌
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "manager",
    "password": "password123"
  }'
```

**响应**：
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": { "id": "...", "username": "manager", "role": "manager" }
  }
}
```

保存 Token：
```bash
TOKEN="eyJhbGciOiJIUzI1NiIs..."
```

#### 步骤 2：查询里程碑列表，确认依赖关系
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/milestones?project_id=<项目ID>
```

确认：
- 里程碑 M1（前置）状态非 `completed`
- 里程碑 M2（当前）的 `predecessors` 包含 M1

#### 步骤 3：尝试直接完成后置里程碑 M2
```bash
curl -X PATCH http://localhost:3001/api/milestones/<M2_ID>/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "status": "completed"
  }'
```

#### 步骤 4：验证接口拒绝响应
**预期响应（HTTP 400）**：
```json
{
  "success": false,
  "message": "前置里程碑[需求调研]未完成，无法完成当前里程碑",
  "code": "PREDECESSOR_NOT_COMPLETED"
}
```

#### 步骤 5：创建验收单关联 M2
```bash
curl -X POST http://localhost:3001/api/acceptance \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "<项目ID>",
    "milestone_id": "<M2_ID>",
    "title": "UAT测试验收",
    "content": "UAT测试通过，功能符合需求规格说明书要求"
  }'
```

#### 步骤 6：尝试提交验收单（关联未完成前置的里程碑）
```bash
curl -X PATCH http://localhost:3001/api/acceptance/<验收单ID>/submit \
  -H "Authorization: Bearer $TOKEN"
```

#### 步骤 7：再次验证接口拒绝
**预期响应（HTTP 400）**：
```json
{
  "success": false,
  "message": "关联里程碑的前置里程碑[需求调研]未完成，无法提交验收",
  "code": "PREDECESSOR_NOT_COMPLETED"
}
```

#### 步骤 8：完成前置里程碑 M1（对照组）
```bash
# 先完成 M1
curl -X PATCH http://localhost:3001/api/milestones/<M1_ID>/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "status": "completed"
  }'

# 再尝试完成 M2
curl -X PATCH http://localhost:3001/api/milestones/<M2_ID>/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "status": "completed"
  }'
```

**预期响应（HTTP 200）**：
```json
{
  "success": true,
  "message": "里程碑状态更新成功",
  "data": {
    "id": "<M2_ID>",
    "status": "completed"
  }
}
```

### 验证结论

- ✅ 接口正确拒绝了跳过前置里程碑的操作
- ✅ 返回了正确的错误码 `PREDECESSOR_NOT_COMPLETED`
- ✅ 返回了清晰的错误信息，指明具体哪个前置里程碑未完成
- ✅ 完成前置里程碑后，操作可正常进行
- ✅ 前端在提交前也进行了预检，禁用提交按钮并显示警告

## 权限控制说明

### 三级角色体系

| 权限 | admin | manager | member |
|------|-------|---------|--------|
| 项目CRUD | ✅ | ✅（自有项目） | ❌ |
| 项目状态变更 | ✅ | ✅ | ❌ |
| 里程碑CRUD | ✅ | ✅ | ❌ |
| 里程碑状态变更 | ✅ | ✅ | ❌ |
| 风险CRUD | ✅ | ✅ | ✅（自有） |
| 会议纪要CRUD | ✅ | ✅ | ✅（自有） |
| 验收单创建 | ✅ | ✅ | ❌ |
| 验收单提交 | ✅ | ✅ | ❌ |
| 验收单审核 | ✅ | ❌ | ❌ |
| 删除操作 | ✅ | ❌ | ❌ |
| 用户管理 | ✅ | ❌ | ❌ |

### 项目级权限

非 admin 用户只能访问和操作自己作为成员的项目数据，通过 `checkProjectPermission` 中间件校验。

## API 接口列表

### 认证接口
- `POST /api/auth/login` - 用户登录
- `GET /api/auth/profile` - 获取当前用户信息

### 健康检查
- `GET /api/health` - 服务健康检查

### 项目管理
- `GET /api/projects` - 项目列表（支持筛选）
- `GET /api/projects/:id` - 项目详情
- `POST /api/projects` - 创建项目
- `PUT /api/projects/:id` - 更新项目
- `DELETE /api/projects/:id` - 删除项目
- `PATCH /api/projects/:id/status` - 变更项目状态

### 里程碑管理
- `GET /api/milestones` - 里程碑列表
- `GET /api/milestones/:id` - 里程碑详情
- `GET /api/milestones/:id/can-accept` - 检查是否可验收
- `POST /api/milestones` - 创建里程碑
- `PUT /api/milestones/:id` - 更新里程碑
- `DELETE /api/milestones/:id` - 删除里程碑
- `PATCH /api/milestones/:id/status` - 变更里程碑状态

### 风险登记
- `GET /api/risks` - 风险列表
- `GET /api/risks/:id` - 风险详情
- `POST /api/risks` - 创建风险
- `PUT /api/risks/:id` - 更新风险
- `DELETE /api/risks/:id` - 删除风险
- `PATCH /api/risks/:id/status` - 变更风险状态

### 会议纪要
- `GET /api/meetings` - 会议纪要列表
- `GET /api/meetings/:id` - 会议纪要详情
- `GET /api/meetings/:id/download` - 下载附件
- `POST /api/meetings` - 上传会议纪要（支持附件）
- `PUT /api/meetings/:id` - 更新会议纪要
- `DELETE /api/meetings/:id` - 删除会议纪要

### 验收管理
- `GET /api/acceptance` - 验收单列表
- `GET /api/acceptance/:id` - 验收单详情
- `GET /api/acceptance/:id/download` - 下载附件
- `POST /api/acceptance` - 创建验收单（支持附件）
- `PUT /api/acceptance/:id` - 更新验收单
- `DELETE /api/acceptance/:id` - 删除验收单
- `PATCH /api/acceptance/:id/submit` - 提交验收
- `PATCH /api/acceptance/:id/review` - 审核验收

### 管理看板
- `GET /api/dashboard/stats` - 统计概览
- `GET /api/dashboard/projects` - 项目看板数据
- `GET /api/dashboard/timeline` - 里程碑时间线

## 常见问题

### 1. 容器启动失败，数据库连接超时
**解决**：确保 postgres 容器健康检查通过后再启动后端
```bash
docker-compose up -d postgres
# 等待健康检查通过
docker-compose ps
# 再启动其他服务
docker-compose up -d backend frontend
```

### 2. 前端无法访问后端 API
**解决**：检查 nginx 配置或 vite 代理配置，确保 `/api` 请求正确转发到 `http://backend:3001`

### 3. 文件上传失败
**解决**：检查 `backend/uploads` 目录权限，确保容器有写入权限
```bash
chmod 777 backend/uploads
```

### 4. 登录失败，返回 401
**解决**：确认种子数据已执行，或检查密码是否为 `password123`

### 5. 如何重置数据库
```bash
# 停止服务并删除数据卷
docker-compose down -v

# 重新启动
docker-compose up -d --build
```

## 目录结构

```
.
├── backend/                    # 后端服务
│   ├── prisma/                 # 数据库脚本
│   │   └── init.sql            # 初始化 DDL
│   ├── src/
│   │   ├── config/             # 配置
│   │   ├── middleware/         # 中间件（认证、权限）
│   │   ├── routes/             # API 路由
│   │   ├── scripts/            # 脚本（初始化、种子数据）
│   │   ├── utils/              # 工具函数（业务规则、响应、校验）
│   │   └── index.ts            # 入口文件
│   ├── uploads/                # 文件上传目录
│   ├── Dockerfile
│   └── package.json
├── frontend/                   # 前端应用
│   ├── src/
│   │   ├── components/         # 通用组件
│   │   ├── context/            # React Context
│   │   ├── pages/              # 页面
│   │   │   ├── projects/
│   │   │   ├── milestones/
│   │   │   ├── risks/
│   │   │   ├── meetings/
│   │   │   └── acceptance/
│   │   ├── services/           # API 服务层
│   │   ├── types/              # TypeScript 类型定义
│   │   └── App.tsx             # 应用入口
│   ├── Dockerfile
│   ├── nginx.conf              # Nginx 配置
│   └── package.json
├── docker-compose.yml          # Docker Compose 配置
├── package.json                # Monorepo 配置
└── README.md                   # 本文档
```

## 许可证

MIT License
