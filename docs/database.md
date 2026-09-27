# 数据库配置

SQLite 已移除。认证数据写入 PostgreSQL 的 `auth` schema，应用数据通过
PostgREST 暴露 `app` schema 并受 RLS 保护。完整说明见
[PostgREST 数据层](postgrest.md) 与
[ADR 0001](adr/0001-postgrest-auth-exception.md)。

## 两个连接

| 连接 | 变量 | 用途 |
| --- | --- | --- |
| 管理连接 | `DATABASE_URL` | 迁移、seed、Better Auth 持久化（`auth` schema） |
| 数据 API | `POSTGREST_URL` | 运行时应用数据读写（`app` schema + RLS） |

`DATABASE_URL` 是特权连接，仅服务端使用，绝不能下发给客户端。

## 使用方式

```bash
# 1. 应用迁移（创建 auth / app schema 与 auth.uid() 辅助函数）
bun run db:migrate:prd

# 2. 导出 PostgREST 校验用的 JWKS（首次会生成签名密钥对）
bun run jwks:export

# 3. 按 postgrest/bootstrap.sql 创建角色与授权，然后启动 PostgREST
```

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `DATABASE_URL` | (必填) | PostgreSQL 管理连接；非 `postgres://`/`postgresql://` 会启动失败 |
| `POSTGREST_URL` | (未设置) | 设置后才启用 `app.data`，格式为 http(s) URL |
| `POSTGREST_SCHEMA` | `app` | PostgREST 目标 schema |
| `POSTGREST_SERVICE_TOKEN` | (未设置) | 服务端特权请求使用的预签发 JWT |
| `POSTGREST_TIMEOUT_MS` | `10000` | 单次请求超时 |
| `MAX_PASSKEYS_PER_USER` | `5` | 每个用户允许注册的 passkey 上限 |

## 迁移

- 迁移文件位于 `src/db/migrations/`，按 journal 顺序应用，记录在
  `__drizzle_migrations`。
- 运行时不会自动迁移；部署时显式执行 `migrate`。
- `auth` schema 由迁移创建；数据库角色与 RLS policy 是环境相关配置，见
  `postgrest/bootstrap.sql`。
