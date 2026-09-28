# Audit & idempotency

## Audit events

`app.audit({ action, outcome?, actor?, target?, metadata? })` fans out to the
structured-log sink plus any `auditSinks`. Sink failures are logged, never thrown.

```ts
import { AUDIT_ACTIONS } from "bun-backend-starter";

await app.audit({
  action: AUDIT_ACTIONS.dataDeleted,
  outcome: "success",
  actor: { id: userId, ip, userAgent },
  target: { type: "todo", id },
  metadata: { ... },
});
```

- `AUDIT_ACTIONS`: `authSignup`, `authSignin`, `authSignout`,
  `authPasswordReset`, `authSessionRevoked`, `dataCreated`, `dataUpdated`,
  `dataDeleted`. Any string is allowed (`AuditAction = string`).
- `AuditEvent = { action, outcome: "success" | "failure", at, actor?, target?, metadata? }`.
- `AuditSink = (event: AuditEvent) => void | Promise<void>`.

### Sinks

```ts
import {
  createAuditLogger, createLoggerAuditSink, createMemoryAuditSink,
  createFileAuditSink, createQueueAuditSink,
} from "bun-backend-starter";
```

- `createFileAuditSink(path)` — append JSONL to a file.
- `createMemoryAuditSink()` — in-memory (tests).
- `createQueueAuditSink(enqueue)` — push events onto a queue for durable
  processing (e.g. `app.tasks`).
- Configure extra sinks with `createApp({ auditSinks: [...] })`.

### Automatic path rules

```ts
const app = await createApp({
  auditRules: [{ path: "/api/payments", action: "payment.created", targetType: "payment" }],
});
```

`withAudit(handler, { record, rules, resolveActorId?, logger })` wraps a handler;
the outcome is inferred from the status code and the actor IP/user-agent from the
request. Paths match by prefix (`pathname.startsWith(rule.path)`).

## Idempotency keys

Protect retry-prone mutations by listing path prefixes and requiring the
`Idempotency-Key` header. The first request runs and its successful (`2xx`)
response is cached; identical retries replay it (with `Idempotent-Replay: true`),
and reuse with a different body or a concurrent duplicate returns `409`.

```ts
const app = await createApp({
  idempotencyPaths: ["/api/payments"],
  idempotencyTtlSeconds: 86_400,      // default IDEMPOTENCY_TTL_SECONDS (24h)
});
```

- Only `POST`/`PUT`/`PATCH`/`DELETE` on matching prefixes are protected.
- Stored in the cache backend (Redis by default) so replays work across replicas;
  an in-process lock catches same-process concurrency.
- Low-level: `createIdempotencyGuard({ cache, logger, protectedPaths, ttlSeconds? })`
  returns `(req, handler) => Promise<Response>`.
- Constants: `HEADER_IDEMPOTENCY_KEY` (`Idempotency-Key`),
  `HEADER_IDEMPOTENT_REPLAY` (`Idempotent-Replay`),
  `DEFAULT_IDEMPOTENCY_TTL_SECONDS`, `ENV`/`IDEMPOTENCY_TTL_SECONDS`.
