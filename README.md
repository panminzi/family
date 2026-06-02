# 线上卡通家庭

一个让每个用户上传家人资料、由 AI 抽取性格画像、生成卡通形象、并在每天饭点自动开饭对话的 Web 应用。

仓库 = 后端 (`server/`，Node.js + TypeScript) + 前端 (`family-frontend/`，Vue 3 + Vite) + Docker Compose 一键部署。

> 想直接看怎么跑，跳到 [本地启动](#local-dev) 或 [Docker 启动](#docker)。

## 目录

- [技术栈](#stack)
- [目录结构](#layout)
- [环境变量](#env)
- [API 端点](#api)
- [AI 配置](#ai)
- [本地启动](#local-dev)
- [Docker 启动](#docker)
- [测试命令](#tests)
- [隐私说明](#privacy)
- [已知遗漏 / 后续计划](#known)

<a id="stack"></a>
## 技术栈

| 层 | 选型 |
|---|---|
| 后端框架 | Node.js 20, Express 4, TypeScript 5 |
| ORM / DB | Prisma 6 + Postgres 16（生产）/ SQLite（测试，0 外部依赖） |
| 鉴权 | JWT (jsonwebtoken) + bcryptjs |
| 文件上传 | multer 2.x（本地落盘 `uploads/`） |
| 定时任务 | node-cron |
| AI | OpenAI Chat Completions（人格画像 / 多人对话）+ OpenAI Images（卡通头像，DALL·E 3 默认）。无 key 时落到内置 stub 自动生成占位画像 / 占位头像 / 模板对话，端到端可跑。 |
| 后端测试 | vitest + supertest（29 用例） |
| 前端框架 | Vue 3, Vite 5, TypeScript 5, Pinia 2, Vue Router 4, Element Plus 2 |
| 前端测试 | vitest + @vue/test-utils + happy-dom（19 用例） |
| 部署 | Docker Compose（postgres + server + nginx 静态前端） |

<a id="layout"></a>
## 目录结构

```
.
├── server/                       后端
│   ├── src/
│   │   ├── routes/               auth / spaces / members / dinner / admin
│   │   ├── services/             ai (stub) / openai (真实) / dinner
│   │   ├── jobs/scheduler.ts     早 / 午 / 晚餐 cron + runMealTrigger
│   │   ├── middleware/auth.ts    JWT + 错误处理
│   │   ├── utils/                prisma + jwt
│   │   ├── app.ts                Express app 工厂
│   │   ├── config.ts             env 加载
│   │   └── index.ts              入口
│   ├── prisma/
│   │   ├── schema.prisma         生产 Schema (Postgres)
│   │   └── schema.test.prisma    测试 Schema (SQLite，结构完全一致)
│   ├── tests/                    auth / spaces / members / dinner / scheduler
│   ├── Dockerfile
│   └── .env.example
├── family-frontend/              前端
│   ├── src/
│   │   ├── api/                  client + authApi/spacesApi/membersApi/dinnerApi
│   │   ├── stores/auth.ts        Pinia 鉴权 store
│   │   ├── components/           MemberCard / ChatBubble
│   │   ├── pages/                Login / Register / Spaces / SpaceDetail /
│   │   │                         MemberAdd / MemberDetail / SceneHome / Dinner / History
│   │   ├── router.ts
│   │   ├── App.vue
│   │   └── main.ts
│   ├── tests/                    上述组件 + 页面 + store 测试
│   ├── nginx.conf
│   ├── Dockerfile
│   └── .env.example
├── docker-compose.yml            一键拉起 postgres + server + frontend
└── README.md
```

<a id="env"></a>
## 环境变量

后端读取 `server/.env`（参考 `server/.env.example`）：

| 变量 | 默认 | 说明 |
|---|---|---|
| `PORT` | `3000` | HTTP 端口 |
| `NODE_ENV` | `development` | `production` 时默认开启调度器 |
| `JWT_SECRET` | `dev-only-...` | **生产必须改** |
| `JWT_EXPIRES_IN` | `7d` | JWT 过期时间 |
| `DATABASE_URL` | _（必填）_ | Prisma 连 Postgres 的 URL，例如 `postgresql://family:family@localhost:5432/family` |
| `UPLOADS_DIR` | `uploads` | 上传目录（相对 server 工作目录） |
| `OPENAI_BASE_URL` | `https://maas.10rig.com/v1` | OpenAI 兼容协议的 base URL（默认走 10rig 中转站） |
| `OPENAI_API_KEY` | _（示例已填）_ | 留空时使用 stub，端到端仍可跑 |
| `OPENAI_TEXT_MODEL` | `minimax-m2.7` | Chat Completions 模型；必须是 `/v1/models` 列出来的模型，当前 key 授权 `minimax-m2.7` |
| `OPENAI_IMAGE_MODEL` | `dall-e-3` | Images 模型，10rig 当前不一定支持图像生成；失败时自动回退占位图 |
| `CRON_BREAKFAST` | `30 7 * * *` | 早餐触发 cron |
| `CRON_LUNCH` | `0 12 * * *` | 午餐触发 cron |
| `CRON_DINNER` | `30 18 * * *` | 晚餐触发 cron |
| `ENABLE_SCHEDULER` | `production` 默认 1 | 是否在 boot 时拉起 cron |

前端读取 `family-frontend/.env`（参考 `.env.example`）：`VITE_API_BASE`，默认 `/api`，依赖 Vite 代理或 nginx 反代。

<a id="api"></a>
## API 端点

所有 `/api/*` 接口除 `auth/register|login` 外都需要 `Authorization: Bearer <token>`。

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth/register` | 邮箱 + 密码注册，返回 token |
| POST | `/api/auth/login` | 登录 |
| GET | `/api/auth/me` | 当前用户信息 |
| GET | `/api/spaces` | 我的家庭空间列表 |
| POST | `/api/spaces` | 创建家庭空间 |
| GET | `/api/spaces/:id` | 空间详情（含成员） |
| PUT | `/api/spaces/:id` | 重命名 |
| DELETE | `/api/spaces/:id` | 删除（级联清理成员、画像、对话） |
| GET | `/api/members/space/:spaceId` | 成员列表 |
| POST | `/api/members` | 添加成员 |
| GET | `/api/members/:id` | 成员详情（含画像） |
| PUT | `/api/members/:id` | 更新成员 |
| DELETE | `/api/members/:id` | 删除成员（级联清理资料、对话） |
| POST | `/api/members/:id/materials/photo` | multipart 上传单张照片 |
| POST | `/api/members/:id/materials/text` | 添加文本/对话样本 |
| DELETE | `/api/members/:id/materials/:materialId` | 删除单条资料 |
| POST | `/api/members/:id/personality` | 调 AI 抽取人格画像 |
| POST | `/api/members/:id/avatar` | 调 AI 生成卡通头像（需先有画像） |
| POST | `/api/dinner/start` | 手动开饭，立即生成一段对话 |
| POST | `/api/dinner/message` | 用户参与对话，AI 自动续写 |
| POST | `/api/dinner/:sessionId/end` | 结束饭局 |
| GET | `/api/dinner/space/:spaceId/sessions` | 饭局历史列表 |
| GET | `/api/dinner/:sessionId` | 饭局详情 + 全部消息 |
| POST | `/api/admin/trigger-meal` | 手动触发整批家庭的饭点（调试） |
| GET | `/health` | 健康检查 |

<a id="ai"></a>
## AI 配置

后端用一个 `AiService` 接口隔离 AI 调用：

- 默认实现：本地 stub（`server/src/services/ai.ts`）。返回基于关键词推断的简易画像、`placehold.co` 占位头像、模板化轮流对话。**无网络也能跑通完整闭环和测试。**
- 生产实现：在 `OPENAI_API_KEY` 存在时切换到 `services/openai.ts`，使用 `OPENAI_TEXT_MODEL` 抽人格 / 生对话，`OPENAI_IMAGE_MODEL` 生成头像。默认走 10rig 中转站（`https://maas.10rig.com/v1`），可通过 `OPENAI_BASE_URL` 切换到 OpenAI 官方或其它兼容协议的端点。**模型必须是 base URL `/v1/models` 列出来的，否则会 403。** 当前 key 默认开放 `minimax-m2.7`。
- 测试：`setAiService(...)` 可以注入任意 mock；`tests/dinner.test.ts` 用 mock 验证调度器调用形态。

切换只需要在 `.env` 里填 `OPENAI_API_KEY` 和 `OPENAI_BASE_URL`（已预填 10rig 中转站地址），无需改代码。

<a id="local-dev"></a>
## 本地启动

需要 Node.js ≥ 20。Postgres 可用本机服务，也可只用 Docker 起一个：

```bash
docker run -d --name family-pg -p 5432:5432 \
  -e POSTGRES_USER=family -e POSTGRES_PASSWORD=family -e POSTGRES_DB=family \
  postgres:16-alpine
```

后端：

```bash
cd server
cp .env.example .env       # 已预填 10rig 中转站 + API key，按需修改
npm install
npx prisma generate
npx prisma db push         # 把 schema.prisma 同步到 Postgres
npm run dev                # http://localhost:3000
```

前端：

```bash
cd family-frontend
cp .env.example .env       # 默认无需修改
npm install
npm run dev                # http://localhost:5173 ，已配 /api 代理到 :3000
```

打开 http://localhost:5173 注册账号 → 创建家庭空间 → 添加成员 → 生成画像 → 生成卡通形象 → 进入家庭场景 → 手动开饭。

<a id="docker"></a>
## Docker 启动

仓库根：

```bash
# 可在仓库根放 .env 提供 JWT_SECRET / OPENAI_BASE_URL / OPENAI_API_KEY 之类的覆盖。
docker compose up -d --build
```

启动后：

- 前端：http://localhost:8080
- 后端：http://localhost:3000
- Postgres：暴露在 5432，凭据 `family/family`

容器化时后端会自动 `prisma db push`（若没有 migrations 目录），然后启动调度器。

<a id="tests"></a>
## 测试命令

```bash
# 后端：vitest + supertest，29 用例。SQLite 沙盒，无外部依赖。
cd server && npm test

# 前端：vitest + @vue/test-utils，19 用例
cd family-frontend && npm test
```

后端测试覆盖：

- 鉴权：注册 / 重复邮箱 / 登录 / 错密码 / `/me` 鉴权
- 家庭空间：创建 / 列表 / 跨用户隔离 / 更新 / 删除 / 越权 404
- 成员 + AI：CRUD、跨空间越权、人格生成（stub + 注入 mock）、头像、上传、删除级联
- 饭点：开饭、用户消息 + AI 续写（顺序连续）、历史、结束、`runMealTrigger` 全部 / 跳过
- 调度器：cron 表达式有效 / 非法即抛 / `stop()` 干净

前端测试覆盖：MemberCard / ChatBubble 渲染、auth store 行为、SpacesPage 列表 + 创建、LoginPage 成功/失败、MemberAddPage 表单、DinnerPage 加载 + 发送 + 结束。

<a id="privacy"></a>
## 隐私说明

- 用户密码使用 bcrypt 加盐 hash 存储，不可逆。
- 家庭空间、成员、画像、对话全部按 `ownerId` 做权限隔离。任何越权访问都返回 404，避免泄露资源是否存在。
- 删除空间 / 成员触发 Prisma `onDelete: Cascade`，关联的画像、上传文件元数据、饭局、对话一并清空。上传的物理文件（`uploads/`）会在删除资料 API 中同步删除。
- 默认 stub AI 不联网；启用 OpenAI 兼容协议的 API 后（本项目默认使用 10rig 中转站），发送给 API 的内容包括成员姓名、关系、用户填写的描述和上传的文本资料；不包括邮箱、密码、JWT。**生产部署前请向最终用户披露这一点**。
- `.env` 不进 git；`uploads/` 不进 git。

<a id="known"></a>
## 已知遗漏 / 后续计划

- 上传图片仅按文件名落盘，未做内容嗅探 / 病毒扫描；MVP 简化。
- 单家庭场景，每用户一个 owner，`owner` 概念也不允许多用户共享同一空间。多账户协作未实现。
- 前端轮询拉取饭局对话，未做 SSE / WebSocket，长会话性能未优化。
- 没有 prisma migration 文件，部署用 `db push`。生产建议补 `prisma migrate dev` 流程。
- 头像生成失败时回退占位图（`placehold.co`），未自托管，依赖外部域名。
- 国际化未做，UI 文案中文硬编码。
