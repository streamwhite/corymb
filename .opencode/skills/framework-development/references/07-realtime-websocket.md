# Realtime: SSE & WebSocket

## Realtime SSE events

`GET /realtime/events` (`REALTIME_EVENTS_BASE_PATH`) is an authenticated SSE
stream. Requires a Better Auth session cookie (or bearer); unauthenticated → `401`.

Server publishes, Redis pub/sub fans out across replicas:

```ts
import { publishRealtimeEvent } from "corymb";

await publishRealtimeEvent(app.events, {
  type: "todo.updated",          // your event type
  data: { id: "abc", done: true },
  at: Date.now(),
});
```

Wire format (event name `message`):

```json
{ "type": "todo.updated", "data": { "id": "abc", "done": true }, "at": 1727000000000 }
```

The stream sends a `ready` event immediately (channel + `retry: 3000`), a
`: ping` heartbeat every 15s, and `retry: 3000` for browser reconnection.

Browser client:

```html
<script>
  const es = new EventSource("/realtime/events");           // same-origin → cookie sent
  es.addEventListener("message", (e) => {
    const { type, data } = JSON.parse(e.data);
    if (type === "todo.updated") { /* update UI */ }
  });
</script>
```

For cross-origin, enable CORS for the origin and use
`new EventSource(url, { withCredentials: true })`. To recover missed events after
a disconnect, use `fetch` + a `ReadableStream` reader and manage reconnection
yourself, or re-query state on reconnect.

Types/constants: `RealtimeEvent`, `EventBus`, `REALTIME_EVENTS_CHANNEL`,
`createMemoryEventBus`, plus the SSE helpers in
`references/04-http-middleware.md` (`createSseResponse`, `formatSseEvent`).

## WebSocket endpoints

Register endpoints in `createApp`/`startServer`; each is matched by exact path,
optionally authorized, then upgraded.

```ts
await startServer({
  websocket: [
    {
      path: "/ws/echo",
      authorize: (req) => Boolean(req.headers.get("Authorization")),
      limits: { maxPayloadLength: 1_048_576, idleTimeout: 120 },
      open(ws) { ws.subscribe("room"); },
      message(ws, msg) { ws.publish("room", msg); },
      close(ws) { ws.unsubscribe("room"); },
      drain(ws) { /* backpressure eased */ },
    },
  ],
});
```

- `WebSocketEndpoint = WebSocketRouteHandlers & { path; authorize?; limits? }`.
- `authorize` returning `false` (or throwing) rejects the upgrade with `401`.
- `ws.data` is `WebSocketData = { connectionId, path, auth? }`.
- `WebSocketLimits = { maxPayloadLength?, backpressureLimit?, idleTimeout?, sendPings? }`;
  defaults: 1 MiB payload, 120s idle.
- Helpers: `createWebSocketServer`, `createWebSocketUpgrade`,
  `makeWebSocketData`, `WS_CLOSE_UNAUTHORIZED` (1008), `WS_CLOSE_INTERNAL` (1011).
- `startServer` merges `app.websocketRoutes` last so they keep Bun's `server`
  argument. If you own `Bun.serve`, pass `websocket: app.websocket?.handler` and
  merge `app.websocketRoutes`.
