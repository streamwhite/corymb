# Bot 检测与响应处理

基于 User-Agent 的 bot 检测(使用 [`isbot`](https://www.npmjs.com/package/isbot) 维护的持续更新列表),默认**拦截 AI 爬虫、放行搜索引擎**,并对外提供 `/robots.txt`。

## 默认策略

| 分类 | 判定 | 默认动作 |
| --- | --- | --- |
| `search-engine` | 命中允许列表(googlebot / bingbot / duckduckbot …) | 放行 |
| `ai-crawler` | 命中拦截列表(gptbot / claudebot / ccbot / perplexitybot …) | **403 拦截** |
| `tool` | curl / wget / python-requests … | 放行(可配置为拦截) |
| `other-bot` | 其它被 `isbot` 识别为 bot 的 UA | 放行 |
| `human` | 非 bot,或空/缺失 UA | 放行 |

> 空 UA 视为 human,避免误伤不带 UA 的 API 客户端。`tool` 默认不拦,便于健康检查和监控使用 curl。

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `BOT_DETECTION_MODE` | `block` | `block` 拦截 AI 爬虫;`log` 只记录不拦;`off` 完全关闭 |
| `BOT_BLOCK_EXTRA` | (空) | 追加拦截 token,逗号/空格分隔(如 `my-scraper`) |
| `BOT_ALLOW_EXTRA` | (空) | 追加放行 token,优先级高于拦截列表 |

## 应用范围

- **内置路由**默认全部启用(`/health`、`/docs`、`/ui`、`/api/auth/*`、`/upload`、`/realtime/events` 等)。
- **未匹配路由的 fallback 404** 同样启用(爬虫探测常见入口)。
- **`/robots.txt`** 不拦截,始终可读,内容为放行全部 + 逐个 `Disallow` AI 爬虫。
- **使用者自定义路由**不自动包装,可按需使用导出的 `withBotDetection`。

## 编程接口

```ts
import {
  classifyUserAgent,
  shouldBlockBot,
  withBotDetection,
  buildRobotsTxt,
  ROBOTS_TXT_PATH,
  type BotTokenLists,
} from "bun-backend-starter";

// 保护自定义路由
const protectedHandler = withBotDetection((req) => Response.json({ ok: true }));

// 纯函数分类
const result = classifyUserAgent(req.headers.get("user-agent"), tokens);
// → { isBot: true, kind: "ai-crawler" }
```

分类逻辑本身是纯函数,便于单测;`withBotDetection`、`blockRequestIfBot`、`detectRequestBot` 也对外导出。
