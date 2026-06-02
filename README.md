# 线上卡通家庭智能互动系统 (Cartoon Family)

一个基于 AI 的线上虚拟家庭场景应用：用户上传家庭成员照片、文字描述、对话样本，系统抽象出每个成员的性格特征与说话风格，生成卡通形象，并在每天饭点自动触发"开饭"事件，让卡通家庭成员根据各自性格展开对话。

## 核心功能

- 用户与家庭空间管理
- 家庭成员资料上传（照片 / 文字 / 对话样本）
- AI 人格建模：从资料中提取性格、情绪倾向、说话风格
- 卡通人物形象生成（提示词 + 图像）
- 饭点定时触发"开饭"场景，多成员对话
- 历史对话保存、回看、删除
- 用户参与对话、隐私保护

## 技术栈

- 后端：Python 3.11 + FastAPI + SQLAlchemy + Alembic
- 数据库：PostgreSQL 15
- 缓存 / 队列：Redis 7
- 任务调度：APScheduler（饭点触发）
- 文件存储：本地 `uploads/`（生产可替换为对象存储）
- AI：可插拔 Provider 接口（默认 OpenAI 兼容协议）
- 部署：Docker + docker-compose + Nginx

## 目录结构

```
server/
  app/
    api/         # FastAPI 路由
    core/        # 配置、数据库、安全
    models/      # SQLAlchemy ORM
    schemas/     # Pydantic 模型
    services/    # 业务逻辑（AI、对话、人格、上传）
    tasks/       # 定时任务（饭点触发）
    main.py
  alembic/       # 数据库迁移
  tests/
  requirements.txt
  Dockerfile
docker-compose.yml
README.md
```

## 快速启动（本地开发）

```bash
cd server
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # 按需修改
uvicorn app.main:app --reload
```

## Docker 部署

```bash
docker-compose up -d --build
```

服务默认监听 `:8000`，PostgreSQL 5432，Redis 6379。

## 接口文档

启动后访问 `http://localhost:8000/docs`。

## 数据模型概览

- `users`：账号
- `families`：家庭空间
- `family_members`：家庭成员
- `member_profiles`：人物画像（性格 / 风格 / JSON）
- `uploads`：上传的资料
- `conversations`：对话场景（饭点 / 用户触发）
- `messages`：对话消息
- `scheduled_jobs`：定时任务记录

## License

MIT
