---
name: Opinionated Bun backend framework
overview: 将现有 Bun 后端 starter 收敛为 API 稳定、可组合、可直接作为依赖安装的框架包；移除 SQLite，运行时业务数据统一经 PostgREST 访问，并更新初始化脚手架、文档与发布流程。
todos:
  - id: postgrest-auth-spike
    content: 验证 PostgREST 鉴权/RLS 与 Better Auth 持久化的兼容方案，形成并确认 ADR（采用“明确的认证例外”）
    status: completed
  - id: framework-contract
    content: 定义框架公开 API、配置、错误/日志约定与资源生命周期
    status: completed
  - id: postgrest-data
    content: 引入 PostgREST 数据访问模块，移除 SQLite 和运行时 SQL 数据访问
    status: completed
  - id: auth-migration
    content: 认证持久化迁移到 Postgres auth schema，签发 role=authenticated JWT 并导出 JWKS
    status: completed
  - id: framework-hardening
    content: 基础中间件、配置校验、结构化日志、错误处理、CORS、ready、审计事件、后台任务队列
    status: completed
  - id: scaffold-docs
    content: 更新 CLI 新项目模板（tsconfig/.gitignore/postgrest）、环境变量、使用文档与示例
    status: completed
  - id: compatibility-release
    content: 迁移测试、验证公开导出与打包内容，制定版本升级/发布流程
    status: completed
isProject: false
---

# Opinionated Bun 后端框架改造计划

## 目标

- 本仓库是框架唯一源码与发布源；新项目通过安装/升级 package 同步框架更新，不复制框架源码。
- 新项目可用 CLI 快速初始化，只编写自己的路由、业务逻辑和配置；框架提供有约束、可组合的公开 API。
- SQLite 完全退出。应用运行时的业务数据请求统一通过 PostgREST HTTP API；PostgreSQL schema 迁移由独立管理命令执行，不把管理连接作为业务查询通道。
- 保留并整理现有能力：Better Auth、Redis 缓存、SSE、限流、安全头、上传、健康检查和 API 文档。

## 现状与关键约束

- 包已发布形态：`src/index.ts` 作为公共导出，`createApp` / `startServer` 建应用，CLI `init` 生成消费项目。
- 当前数据库实现同时包含 Bun SQL、`bun:sqlite`、Postgres pool、SQLite/Postgres 迁移；`AppInstance` 与路由 bundle 暴露 SQL。
- Better Auth 直接使用 SQLite 或 PostgreSQL 驱动。PostgREST 是 HTTP 数据 API，不是 SQL 协议驱动，不能仅通过替换连接 URL 继续使用现有 Better Auth 数据库适配器。
- PostgREST 的数据授权依赖数据库角色与 RLS。不能将具备绕过 RLS 权限的 service key 暴露给客户端；需明确用户 JWT、服务端授权和特权操作边界。

## 实施前架构决策（先做验证，不直接编码迁移）

用小型 spike 验证 Better Auth 所需的 CRUD、事务、唯一约束和 session 语义，确认它是否能安全、完整地通过 PostgREST 工作；同时验证认证后的用户身份如何映射成 PostgREST 可验证的 JWT/数据库角色并触发 RLS。

输出 ADR 并由项目 owner 确认以下路线之一：

1. **严格统一 PostgREST（目标优先）**：认证持久化也通过受支持的 HTTP/auth 服务完成。若 Better Auth 没有满足语义的受支持方案，则替换认证存储/提供方，避免维护脆弱的自制 SQL-to-REST 适配器。
2. **明确的认证例外**：Better Auth 只用独立的 PostgreSQL 驱动保存认证内部数据；所有应用业务数据仍只经 PostgREST。此路线不是“所有数据操作均经 PostgREST”，必须由 owner 明确接受。

ADR 同时决定 PostgREST JWT 签发与验证密钥、RLS role/claims 约定、服务端特权请求，以及失败/超时重试策略。没有通过此决策门槛前，不移除认证数据库实现。

## 目标模块与公开 API

- `createApp(config)` 创建并校验资源，返回 routes、认证/事件等稳定能力和幂等 `close()`；不暴露底层 SQL 或具体驱动对象。
- `startServer(config)` 负责监听、优雅关闭与生命周期绑定；用户通过路由注册/中间件 API 扩展，不依赖私有目录导入。
- `data` 模块提供基于标准 Fetch 的 PostgREST client：查询、写入、删除、RPC、请求级授权上下文和统一错误类型；允许注入 `fetch`/client 以便测试。
- 事务边界通过单次 PostgREST 请求或 PostgreSQL RPC 函数表达；不要伪装客户端多请求事务。
- 公共导出只承诺框架使用者需要的 API 和类型；内部实现保持可替换。发布入口、类型声明、`exports` 和包内文件清单保持一致。
- CLI 生成最小消费项目，框架能力通过 package 版本获取；建立清晰的升级说明和 changelog/version 规则，避免让生成项目拷贝框架实现。

## 分阶段实施

### 1. 架构验证与 API 契约

- 完成上面的 PostgREST/auth spike 和 ADR。
- 决定 PostgREST URL、请求超时、授权凭据、schema/profile、请求级 JWT 的配置入口与默认值。
- 定义稳定错误格式、配置校验、日志字段、路由扩展/中间件次序、关闭语义；划分稳定 API 与实验性 API。
- 先写契约测试：配置错误、PostgREST 请求/响应映射、错误映射、授权头/RLS claims，以及 app close 幂等行为。

### 2. 数据层迁移并移除 SQLite

- 新建模块化 PostgREST client 与类型；默认使用 Bun/标准 `fetch`，只有确定必要且获批后才加第三方依赖。
- 将业务 handler 从 SQL 注入迁到数据 client；复杂原子操作使用受控 RPC，并配套数据库函数与迁移。
- 区分运行时 `POSTGREST_URL`/服务端凭据与迁移管理连接 `DATABASE_URL`；后者只由 migrate/seed/admin 命令消费。
- 移除 SQLite dialect/path/URL、`bun:sqlite`、SQLite migrations/seed 分支和 SQLite 专属测试；删改前盘点迁移历史及已有用户数据，制定一次性数据迁移/备份说明。
- PostgreSQL schema migration 保留为显式部署步骤，应用启动不自动执行有写权限的 schema migration。

### 3. 按 ADR 迁移认证与授权

- 按确认路线实现认证存储，并验证 signup/signin/session/passkey/verification/password reset 等现有行为。
- 把已验证的用户身份以可信 claims 传给 PostgREST；建立最小权限数据库角色、RLS policy 和特权 RPC。
- 特权密钥只留在服务端；所有客户端输入仍需校验，不能把 RLS 当成输入校验的替代品。
- 为关键跨表/并发操作添加集成测试，覆盖未认证、越权、用户隔离、过期 token 和 token 重放等情形。

### 4. 建立框架默认能力与可选扩展

- 整理现有基础能力，确保安全头、请求体上限、限流、bot 防护、health、邮件、上传、SSE、docs 有清晰配置与稳定默认值。
- 建议列为核心补齐项：统一 request-id、结构化日志、统一错误响应、环境配置校验、CORS（显式 origin allowlist）、优雅关闭与 readiness/liveness 区分。
- 建议列为后续可选模块：Redis 分布式限流、对象存储适配器、OpenTelemetry 指标/追踪、后台任务/队列、审计事件、幂等键。每项独立启用，避免核心包强制依赖和默认增加运维负担。
- 逐项确认兼容性、供应链和配置需求；不在本轮无决策地引入队列/ORM/大型依赖。

### 5. CLI、环境变量、文档与迁移指引

- 重写 `init` 输出示例，展示路由组织、PostgREST 查询/RPC、认证身份与错误处理；模板只包含业务层代码。
- 更新 `.env.example`、README、数据库/认证/SSE/docs 文档；删除 SQLite 配置与过期描述，说明 PostgREST、迁移连接和 secret 管理。
- 需要生产环境样例时增加不含真实凭据的 `.env.production.example`；不提交任何 `.env` 密钥。
- 给出从当前版本升级的 breaking changes、SQLite 数据导出/迁移步骤、PostgREST schema/RLS 配置和回滚办法。

### 6. 发布与同步体验

- 更新 package 名称/描述、入口、CLI 命令与 scaffold 的 package 版本来源（是否改名另行确认，避免无必要的包名破坏）。
- 验证仅靠公开入口可完成新项目开发，package tarball 包含运行必需文件和类型声明，不依赖仓库私有路径。
- 使用语义化版本标记移除 SQLite、API 形状和认证变更；每次发布提供 changelog 与消费项目升级命令/步骤。

## 验收标准

- 全项目运行代码和新项目模板均无 SQLite 依赖、配置或文档残留；无业务请求绕过 PostgREST。
- 认证数据路径与 PostgREST 要求有明确、已确认的方案；用户级访问由可测试的 JWT/RLS 或等效策略强制隔离。
- package 公共 API、类型、初始化模板和文档相互一致，普通使用者不需要导入 `src/*` 私有实现。
- 单元测试覆盖 client、配置、错误和公开导出；真实 PostgREST/PostgreSQL 集成测试可通过显式环境配置运行，CI 不依赖 SQLite。
- 资源启动失败会释放已创建资源；正常关闭可重复调用；错误日志不泄露 token、secret 或敏感请求体。

## 实施结果（已完成）

采用“明确的认证例外”路线落地，核心交付：

- **数据层**：`src/data/postgrest-client.ts`（fluent `from/select/insert/update/
  delete/rpc`、`as/withToken`、`PostgrestError`、可注入 `fetch`）；SQLite 与
  运行时 SQL 数据访问全部移除。
- **认证**：`src/auth/auth-runtime.ts` + Postgres `auth` schema；JWT 增加
  `role=authenticated` claim；`src/auth/jwks.ts` 与 CLI `jwks` 导出
  `postgrest/jwks.json`。ADR 见 `docs/adr/0001-postgrest-auth-exception.md`。
- **迁移**：`src/db/migrations/0000_auth_schema.sql`、`0001_app_schema.sql`
  （`auth.uid()/jwt()/role()`）；`migrate`/`seed` CLI。
- **配置管理**：`src/config/`（`loadAppConfig`、`ConfigReader`、`ConfigError`
  聚合全部问题）。
- **日志**：`src/observability/logger.ts` 基于 consola，JSON 行输出 + 敏感字段
  脱敏，支持 `pretty` 与自定义 writer/reporter。
- **错误处理**：`src/errors/`（`AppError` 体系 + `toErrorResponse`），中间件统一
  映射并隐藏 5xx 细节。
- **审计事件**：`src/audit/`（多 sink fan-out、日志/文件/内存 sink、`withAudit`
  路径规则中间件、`createQueueAuditSink` 经队列持久化）。
- **后台任务**：`src/tasks/` 基于 **BullMQ + Redis**（持久化、跨副本共享、指数退避
  重试、dead-letter、延迟任务、`counts()`），`createNoopTaskQueue()` 供测试；旧的
  自研内存队列已移除。
- **对象存储**：`src/storage/`（S3 适配器基于 Bun 内置 `s3`、文件系统、内存），
  驱动 `STORAGE_DRIVER`，`/upload` 经 `app.storage` 写入。
- **幂等**：`src/http/idempotency.ts` + `IDEMPOTENCY_*` 常量，`Idempotency-Key`
  保护指定路径，命中回放/冲突返回 409，响应缓存于 Redis。
- **优雅关闭**：`src/server/graceful-shutdown.ts`（按序执行步骤、超时、幂等、
  信号处理），CLI 与脚手架默认启用；`app.close()` 排空 BullMQ 后关闭资源。
- **限流**：改用 `rate-limiter-flexible` + Redis（此前后续任务）。
- **脚手架**：`init` 生成 `tsconfig.json`、`.gitignore`、`postgrest/postgrest.conf`
  与展示错误/审计/任务/幂等/存储/优雅关闭的示例入口。
- **文档**：`docs/postgrest.md`、`docs/framework-features.md`、更新
  `README.md`/`docs/database.md`/`.env.example`。

验证：`bun test` 通过（166 pass / 5 选跳 / 0 fail），`tsc --noEmit` 无错误，未运行
lint/build。仍属“不做”：多数据库方言、ORM、自动 CRUD 生成器、社交登录。

## 本轮不做

- 不预先新增多数据库方言、ORM、自动 CRUD 生成器、社交登录、持久化队列或业务专属 API。
