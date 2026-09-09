# 实时数据(SSE)使用指南

## 接口

`GET /realtime/events` — Server-Sent Events 长连接,实时接收数据变更事件。

- **需要认证**:必须携带 Better Auth 会话 Cookie(浏览器同源自动携带);未认证返回 `401` JSON。
- 响应头:`Content-Type: text/event-stream`、`Cache-Control: no-cache`。
- 事件格式:

| 事件名 | 说明 |
| --- | --- |
| `ready` | 连接建立后立即发送,`data` 为 `{"channel":"realtime:events","retry":3000}` |
| `message` | 数据变更事件,`data` 为 `RealtimeEvent` JSON:`{"type":"...","data":...,"at":<毫秒时间戳>}` |

另含 `retry: 3000`(浏览器断线重连间隔)与 `: ping` 心跳注释(每 15 秒,防代理空闲断连)。

## 发布事件(后端)

任何数据变更后调用 `publishRealtimeEvent` 广播(经 Redis pub/sub 跨实例分发):

```ts
import { publishRealtimeEvent } from "@/realtime/publish.js";
import type { EventBus } from "@/realtime/event-bus.js";

await publishRealtimeEvent(bus /* EventBus */, {
  type: "item.updated",        // 自定义事件类型
  data: { id: "abc", name: "new name" },
  at: Date.now(),
});
```

## 浏览器客户端(推荐:`EventSource`)

同源场景浏览器自动带上会话 Cookie:

```html
<script>
  const es = new EventSource("/realtime/events");

  es.addEventListener("ready", (e) => {
    console.log("connected:", JSON.parse(e.data));
  });

  es.addEventListener("message", (e) => {
    const event = JSON.parse(e.data); // { type, data, at }
    if (event.type === "item.updated") {
      console.log("数据变更:", event.data);
      // 在这里更新 UI(或刷新缓存)
    }
  });

  es.onerror = () => {
    // 浏览器按服务端 retry 值(3s)自动重连;也可手动关闭:
    // es.close();
  };
</script>
```

### 跨域前端

需要后端 CORS 允许该来源,且浏览器凭据开启:

```js
const es = new EventSource("https://api.example.com/realtime/events", {
  withCredentials: true,
});
```

## 客户端示例:`fetch` + 流式读取(可完全控制重连)

`EventSource` 断线会丢失中间事件;若需要"断线后补拉数据",用 `fetch` 自己管理:

```js
async function connectRealtime(onEvent, onStateChange) {
  let closed = false;

  while (!closed) {
    onStateChange("connecting");
    try {
      const res = await fetch("/realtime/events", {
        headers: { accept: "text/event-stream" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      onStateChange("connected");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE 帧以空行分隔
        let sep;
        while ((sep = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);

          let event = "message";
          const dataLines = [];
          for (const line of frame.split("\n")) {
            if (line.startsWith(":")) continue; // 心跳注释
            if (line.startsWith("event:")) event = line.slice(6).trim();
            else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
          }
          const data = dataLines.join("\n");
          if (data) onEvent(event, JSON.parse(data));
        }
      }
    } catch (err) {
      if (closed) return;
      onStateChange("reconnecting");
      await new Promise((r) => setTimeout(r, 3000)); // 与服务端 retry 一致
    }
  }
}

connectRealtime(
  (event, data) => {
    if (event === "message" && data.type === "item.updated") {
      console.log("数据变更:", data.data);
    }
  },
  (state) => console.log("SSE:", state),
);
```

## 服务端 / 调试示例

登录后保存 Cookie,再监听(注意 `-N` 关闭缓冲):

```bash
# 1. 登录(或注册)拿会话 Cookie
curl -sS -c cookies.txt -X POST http://localhost:3000/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"your-password"}'

# 2. 订阅实时事件
curl -sS -N -b cookies.txt http://localhost:3000/realtime/events
```

未认证时返回:

```json
{ "error": "Invalid or expired access token" }
```

## 完整模式:数据变更推送

```ts
// 例如某个更新接口中,写库成功后广播
export async function updateItem(sql: SQL, bus: EventBus, item: Item) {
  await sql`UPDATE items SET name = ${item.name} WHERE id = ${item.id}`;
  await publishRealtimeEvent(bus, {
    type: "item.updated",
    data: item,
    at: Date.now(),
  });
}
```

客户端在 `message` 事件里按 `type` 分发,即可实现"数据库一变,页面即变"。
