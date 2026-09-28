# HTTP platform: routes, middleware & helpers

## Routes

Routes are Bun `Serve.Routes`: `{ [path]: { GET?: handler, POST?: handler, ... } }`.
Handlers receive `(req: Request)` (an optional second `server` arg is passed for
upgrades). Pass consumer routes via `createApp({ routes })`; they are merged after
built-ins and win on conflict.

## Middleware

```ts
import { compose, type Middleware } from "bun-backend-starter";

const withTenant: Middleware = (ctx, next) => {
  ctx.state.tenant = ctx.req.headers.get("X-Tenant-Id") ?? "public";
  return next();
};

const handler = compose([withTenant], async (ctx) =>
  Response.json({ tenant: ctx.state.tenant }),
);
```

`Middleware = (ctx: MiddlewareContext, next: NextFunction) => Response | Promise<Response>`.
Short-circuit by returning a `Response` without calling `next()`.

`MiddlewareContext` (readonly): `req`, `url`, `requestId`, `logger`, `cache`,
`auth`, `storage`, optional `data`, mutable `state` bag, optional `response`.
Attach per-request values to `ctx.state`.

Register global middleware with `createApp({ middleware: [...] })` (runs after
built-ins, before access logs). `createMiddlewareRegistry()` assembles named
middleware. `compose`, `createHandler`, `passthrough` are exported.

Built-ins (always on): request-id, error handler, max-URL-length,
request-timeout, compression, access log. CSRF and brute-force are applied when
enabled.

## Request validation

```ts
import { withValidation, readValidated, ValidationError } from "bun-backend-starter";

const parseTodo = (input: unknown) => {
  const { title } = input as { title?: unknown };
  if (typeof title !== "string" || !title.trim()) {
    throw new ValidationError("title is required", { field: "title" });
  }
  return { title: title.trim() };
};

const handler = compose([withValidation(parseTodo)], async (ctx) => {
  const input = readValidated<{ title: string }>(ctx);
  return Response.json(input);
});
```

`withValidation(validator, { target?, stateKey?, sanitize? })`:
`target` is `"json"` (default) or `"query"`; `stateKey` defaults to `"input"`;
`sanitize: true` strips HTML/control chars from strings first. `readValidated(ctx)`
reads `ctx.state.input`. Validators are schema-agnostic (Zod is available);
`validate(validator, input)` / `ValidationError` are exported.

## Cookies

```ts
import {
  parseCookies, readCookieValue, serializeCookie, serializeClearedCookie,
  signCookieValue, verifyCookieValue, readSignedCookie, withCookies,
} from "bun-backend-starter";

const signed = signCookieValue("session-1", secret);
verifyCookieValue(signed, secret);                       // original value or undefined
serializeCookie("sid", signed, { httpOnly: true, secure: true, sameSite: "Lax" });

const handler = compose([withCookies()], async (ctx) =>
  Response.json(ctx.state.cookies ?? {}),
);
```

`CookieOptions = { path?, maxAgeSeconds?, expires?, httpOnly?, sameSite?, secure? }`.
`signCookieValue` appends `value.signature`; `verifyCookieValue` uses a
timing-safe compare. Aliases: `serializeCookieHeader` = `formatSetCookie`.

## Multipart uploads

```ts
import { parseMultipartUpload, isMultipart } from "bun-backend-starter";

const { file, fields } = await parseMultipartUpload(req, { maxBytes: 5_000_000, parseFields: true });
await app.storage.put({ key: file.filename, body: file.bytes, contentType: file.contentType });
```

`ParseUploadOptions = { field? ("file"), maxBytes? (5 MiB), parseFields? (true) }`.
Throws `ValidationError` on bad/size/absent files. The built-in `POST /upload`
uses this plus `app.storage`.

## Streaming & SSE helpers

```ts
import { createSseResponse, streamFromIterable, formatSseEvent } from "bun-backend-starter";

// Imperative SSE:
return createSseResponse((stream) => {
  stream.send({ event: "tick", data: "1" });
  stream.close();
});

// Stream an async iterable:
return streamFromIterable(asyncGenerator());
```

`SseController = { response, send(event), close() }`; `SseEvent = { event?, data, id?, retryMs? }`.
`createStreamResponse(stream, init?)` wraps a `ReadableStream`. Responses using
`text/event-stream` are skipped by compression.

## CORS & compression

- `cors` defaults to `CORS_ORIGINS`; empty disables CORS. Helpers: `applyCors`,
  `corsPreflight`, `isCorsEnabled`, `resolveCorsFromEnv`, `CorsConfig`.
  With `CORS_CREDENTIALS=true`, `*` is rejected.
- Compression is on by default (`withCompression`); it negotiates
  `Accept-Encoding` (brotli/gzip/deflate/zstd) for text-like bodies above
  `COMPRESSION_DEFAULT_THRESHOLD` (1 KiB). Configure `compression: { thresholdBytes }`
  or disable with `compression: false`.

## Rate limiting

```ts
import { withRateLimit, createRateLimiter } from "bun-backend-starter";

"/api/x": { POST: withRateLimit("strict", handler) };                 // shared Redis limiter
const limiter = createRateLimiter({ redisUrl: process.env.REDIS_URL });
"/api/y": { GET: withRateLimit("relaxed", handler, limiter) };
```

Strategies per 60s window: `strict` (10), `standard` (60), `relaxed` (300),
overridable via `RATE_LIMIT_*_MAX`. Client key = first `X-Forwarded-For` hop,
then `X-Real-IP`, else `"unknown"`. Rejections: `429` + `Retry-After`. With
`REDIS_URL` counters are atomic/shared; otherwise in-memory. In tests inject
`createRateLimiter()` via `createApp({ rateLimiter })`.

## Request limits

`withMaxUrlLength(max)` → `414` (`UriTooLongError`); `withRequestTimeout(ms)` →
`408` (`RequestTimeoutError`, does **not** cancel the work). Enabled by default
from `MAX_URL_LENGTH` (2048) / `REQUEST_TIMEOUT_MS` (30000); override with
`createApp({ maxUrlLength, requestTimeoutMs })` or `false` to disable.

## Security headers

Applied automatically to built-in routes, JSON API responses and error
responses: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`,
HSTS on HTTPS, and a CSP for HTML. There is no public middleware or option —
custom routes returning raw `Response` objects are **not** wrapped.
