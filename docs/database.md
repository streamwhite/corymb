# 数据库与 Passkey 配置

## 使用方式

```bash
# SQLite(默认,不变)
SQLITE_PATH=data/items.sqlite bun dev

# PostgreSQL
DATABASE_URL=postgres://user:pass@localhost:5432/mydb bun dev
```

## 说明与限制

- PG 迁移仅面向全新安装(单一 init 迁移,位于 `src/db/migrations-pg/`);SQLite 历史迁移保持原样(`src/db/migrations/`)。
- PG 端到端集成测试需要真实 PG 实例(本地无 docker/PG),已用单元测试覆盖方言解析、PG 迁移 journal 读取和全部既有 SQLite 流程。
- `MAX_PASSKEYS_PER_USER` 限制在注册 verify 阶段服务端强制执行;因 WebAuthn 注册需要真实浏览器凭据,限制逻辑以单元测试覆盖。

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `DATABASE_URL` | (未设置) | 设置后优先;`postgres://` 或 `postgresql://` 开头走 PostgreSQL,其他值视为 SQLite 文件路径 |
| `SQLITE_PATH` | `<cwd>/data/items.sqlite` | SQLite 数据库文件路径(`:memory:` 为内存库) |
| `MAX_PASSKEYS_PER_USER` | `5` | 每个用户允许注册的 passkey 上限 |
