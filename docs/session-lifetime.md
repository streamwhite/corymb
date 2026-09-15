# 登录状态可维持多久?行业最佳实践

## 当前默认配置

| 项目 | 默认值 | 常量 |
| --- | --- | --- |
| 会话有效期(sliding) | 7 天 | `DEFAULT_SESSION_EXPIRES_IN_SECONDS` |
| 刷新阈值 updateAge | 1 天 | `DEFAULT_SESSION_UPDATE_AGE_SECONDS` |
| 访问 JWT | 15 分钟 | `DEFAULT_ACCESS_JWT_EXPIRATION` |
| Cookie 缓存 | 5 分钟 | `DEFAULT_COOKIE_CACHE_MAX_AGE_SECONDS` |

(均在 `src/constants/better-auth.ts`。)

## 行业最佳实践(按风险分级,OWASP / NIST 800-63)

- **低风险**(社交、内容站):绝对 30 天 + 滑动续期,支持"记住我"。
- **中风险**(SaaS、电商):绝对 7–30 天,空闲超时 30 分钟–2 小时;滑动续期。本项目默认的 7 天 / 1 天属于这一档,合理。
- **高风险**(银行、医疗、管理后台):空闲 5–15 分钟,绝对 8–12 小时,敏感操作二次验证。

## 要点

- **滑动 + 绝对上限**:每次活跃在 `updateAge` 后刷新,但设一个绝对过期时间,避免会话无限延长。
- **"记住我"与普通会话分开**:勾选才用长 Cookie(如 30 天),否则用 session cookie(关浏览器即失效)。
- **登录/提权时轮换 session token**(见 `src/auth/session-rotate.ts`)。
- **Cookie 属性**:`HttpOnly; Secure; SameSite=Lax`(生产环境),由 `useSecureCookies` 处理。
- **敏感操作必须二次验证**:改密码、改邮箱、绑/解绑 passkey、删除账号、查看或导出敏感数据、发起支付等高危动作,不依赖现有会话直接放行,需重新验证身份(重输密码 / passkey / TOTP)后再执行。

## 建议

通用后端模板保留 7 天较合适;若面向管理后台/金融类,把 `SESSION_EXPIRES_IN_SECONDS` 降到 `28800–43200`,`SESSION_UPDATE_AGE_SECONDS` 降到 `900–1800` 即可。

## 敏感操作二次验证(已实现)

采用 GitHub "sudo 模式"式的时间窗步进验证,规则:**会话新鲜(freshAge 内)或近期已重新验证**二者满足其一即放行。

| 机制 | 默认 | 环境变量 | 位置 |
| --- | --- | --- | --- |
| 会话新鲜窗口(Better Auth `freshAge`) | 1 小时 | `SESSION_FRESH_AGE_SECONDS` | `src/constants/better-auth.ts` |
| 重验证有效期(缓存 TTL) | 5 分钟 | `SENSITIVE_VERIFY_TTL_SECONDS` | `src/constants/sensitive-auth.ts` |

- `POST /api/auth/session/verify`(`AUTH_SESSION_VERIFY_PATH`)— 携带会话并提交当前密码;成功后把会话标记为"近期已验证"(存于 Cache,按会话 id,TTL 到期自动失效)。
- `requireSensitiveVerification` / `withSensitiveOperation`(`src/auth/sensitive-guard.ts`)— 保护自定义路由:无会话返回 `401`;会话既不新鲜也未验证返回 `403`(`SENSITIVE_VERIFICATION_REQUIRED`)。
- 已在 `/api/auth/session/rotate` 上启用;`changePassword`、`deleteUser`、passkey 新增等 Better Auth 内置高危端点由其自身的密码/freshAge 检查保护。
- 密码校验读取权威会话(绕过 Cookie 缓存),避免已撤销会话被放行。

