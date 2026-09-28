# Security & hardening

## Bot detection (User-Agent based)

Built from [`isbot`](https://www.npmjs.com/package/isbot): search engines are
allowed, AI crawlers are blocked (`403`) by default, other bots allowed.

| Classification | Default action |
| --- | --- |
| `search-engine` | allow |
| `ai-crawler` | **block (403)** |
| `tool` (curl/wget/python-requests) | allow |
| `other-bot` | allow |
| `human` (incl. empty UA) | allow |

Applies to all built-in routes and the fallback 404. `/robots.txt` is never
blocked. Custom routes are **not** auto-wrapped.

```ts
import {
  classifyUserAgent, shouldBlockBot, withBotDetection,
  detectRequestBot, blockRequestIfBot, buildRobotsTxt, robotsTxtResponse,
} from "corymb";

const handler = compose([/* ... */], withBotDetection(async (req) => new Response("ok")));
```

Env: `BOT_DETECTION_MODE=block|log|off`, `BOT_BLOCK_EXTRA`, `BOT_ALLOW_EXTRA`
(allow wins). `setBotDetectionModeForTests(mode)` for tests.

## CSRF double-submit (opt-in)

```ts
const app = await createApp({ csrf: {} });            // global; or compose([withCsrf(opts)], handler)
```

Safe requests (`GET`/`HEAD`/`OPTIONS`) receive a non-`HttpOnly` token cookie;
unsafe requests must echo it in `x-csrf-token`. Mismatch → `403 ForbiddenError`
(`"Invalid or missing CSRF token"`). The header must exactly equal the cookie
value (timing-safe compare).

`CsrfOptions = { cookieName?, headerName?, safeMethods?, ttlSeconds?, path?,
secure?, sameSite? }`. Cookie `secure` defaults to the request protocol (may be
wrong behind a TLS-terminating proxy). Constants: `CSRF_COOKIE_NAME`
(`csrf_token`), `CSRF_HEADER_NAME` (`x-csrf-token`), `CSRF_TTL_SECONDS` (86400).
Exports: `generateCsrfToken`, `readCsrfToken`, `withCsrf`.

> Enabling globally also covers `/api/auth/*`; if non-browser clients call those,
> prefer route-level `withCsrf`.

## Brute-force lockout (opt-in)

Per-key failed-attempt tracking; locks after a threshold with `429` +
`Retry-After`.

```ts
const app = await createApp({
  bruteForce: { maxAttempts: 5, windowSeconds: 900, lockSeconds: 900 },
});
```

- Default key: `rateLimitClientKey(req.headers)` (first `X-Forwarded-For`, then
  `X-Real-IP`, else `"unknown"`). Without a trusted proxy header all clients share
  one key.
- Responses with `failureStatuses` (`[401, 403]`) count as failures; status `< 400`
  resets. Applied globally, unrelated 401/403 routes can lock a client out.
- `BruteForceGuard = { check, recordFailure, reset, close }`;
  `createBruteForceGuard(opts)`, `withBruteForce(guard, { keyFn?, failureStatuses? })`.
- Env: `BRUTE_FORCE_MAX_ATTEMPTS` (5), `BRUTE_FORCE_WINDOW_SECONDS` (900),
  `BRUTE_FORCE_LOCK_SECONDS` (900). Redis-backed when `REDIS_URL` is set.

## SSRF checks & safe fetch

```ts
import { checkOutboundUrl, isSafeOutboundUrl, safeFetch, assertSafeOutboundUrl } from "corymb";

isSafeOutboundUrl("https://example.com/hook");                     // true
const r = checkOutboundUrl("https://internal.corp/x", { allowedHosts: ["*.corp"] });
// r.ok === false, r.reason === "host" | "private-address" | "protocol" | "invalid-url"

const res = await safeFetch("https://api.partner.com/x", undefined, {
  allowedHosts: ["api.partner.com"],     // options is the 3rd arg
});
```

`SsrfOptions = { allowedProtocols? (["https:"]), allowedHosts?, allowLoopback?,
allowPrivate? }`. `safeFetch` throws `ValidationError` (400) for unsafe targets.

**Gotchas:** no DNS resolution (a hostname resolving to a private IP passes), no
redirect checking (pass `redirect: "manual"` if needed), no timeout/retry.

## Sanitize helpers

```ts
import { escapeHtml, stripHtml, sanitizeStrings, safeJoinPath, isPathTraversal } from "corymb";

escapeHtml(`<a href="x">`);                 // &lt;a href=&quot;x&quot;&gt;
stripHtml("<b>Bob</b>");                    // "Bob"
sanitizeStrings({ name: "<i>a</i>" });      // { name: "a" } (recurses to depth 6)
safeJoinPath("/srv/root", "../etc/passwd"); // null
isPathTraversal("../secrets");              // true
```

`stripHtml` is not a general sanitizer (only well-formed tags + control chars);
use `escapeHtml` for HTML output. `withValidation(..., { sanitize: true })`
applies `sanitizeStrings` before validating.

Security headers are applied automatically to built-in/JSON responses (see
`04-http-middleware.md`); custom raw `Response` objects are not wrapped.
