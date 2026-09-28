import { describe, expect, it } from "bun:test";
import { UnauthorizedError } from "@/errors/app-error.js";
import { compose } from "@/middleware/compose.js";
import type { MiddlewareContext } from "@/middleware/middleware-types.js";
import { createLogger } from "@/observability/logger.js";
import {
  buildWebhookSignatureHeader,
  signWebhookPayload,
  verifyWebhookSignature,
} from "@/webhooks/webhook-signature.js";
import {
  readWebhookEvent,
  withWebhookVerification,
} from "@/webhooks/webhook-verification.js";
import { createWebhookDispatcher, createWebhookEvent } from "@/webhooks/webhook-dispatcher.js";
import { WEBHOOK_SIGNATURE_HEADER } from "@/constants/webhook.js";
import type { WebhookEndpoint } from "@/webhooks/webhook-types.js";

const SECRET = "whsec_test_secret" as const;

const endpoint: WebhookEndpoint = {
  id: "ep-1",
  url: "https://hooks.example.com/receive",
  secret: SECRET,
  events: ["user.created"],
};

type Call = { url: string; headers: Record<string, string>; body: string };

function recordingFetch(responses: number[]): {
  fetchImpl: typeof fetch;
  calls: Call[];
} {
  const calls: Call[] = [];
  let index = 0;
  const fn = async (input: unknown, init?: RequestInit): Promise<Response> => {
    const headers = Object.fromEntries(
      new Headers(init?.headers as HeadersInit | undefined).entries(),
    );
    calls.push({ url: String(input), headers, body: String(init?.body ?? "") });
    const status = responses[Math.min(index, responses.length - 1)] ?? 200;
    index += 1;
    return new Response("ok", { status });
  };
  return { fetchImpl: fn as unknown as typeof fetch, calls };
}

function dispatcher(responses: number[], endpoints: WebhookEndpoint[] = [endpoint]) {
  const recorder = recordingFetch(responses);
  const instance = createWebhookDispatcher({
    endpoints,
    fetch: recorder.fetchImpl,
    retries: 2,
    minTimeoutMs: 1,
    maxTimeoutMs: 2,
  });
  return { instance, calls: recorder.calls };
}

describe("webhook signatures", () => {
  const body = JSON.stringify({ hello: "world" });
  const timestamp = 1_700_000_000;

  it("verifies a freshly signed payload", () => {
    const header = buildWebhookSignatureHeader(SECRET, body, timestamp);
    expect(
      verifyWebhookSignature({
        secret: SECRET,
        body,
        header,
        toleranceSeconds: 300,
        nowSeconds: timestamp,
      }),
    ).toBe(true);
  });

  it("rejects a tampered body", () => {
    const header = buildWebhookSignatureHeader(SECRET, body, timestamp);
    expect(
      verifyWebhookSignature({
        secret: SECRET,
        body: `${body} `,
        header,
        nowSeconds: timestamp,
      }),
    ).toBe(false);
  });

  it("rejects a stale timestamp beyond tolerance", () => {
    const header = buildWebhookSignatureHeader(SECRET, body, timestamp);
    expect(
      verifyWebhookSignature({
        secret: SECRET,
        body,
        header,
        toleranceSeconds: 60,
        nowSeconds: timestamp + 3600,
      }),
    ).toBe(false);
  });

  it("rejects malformed headers", () => {
    expect(
      verifyWebhookSignature({ secret: SECRET, body, header: "nonsense" }),
    ).toBe(false);
    expect(
      verifyWebhookSignature({
        secret: SECRET,
        body,
        header: `t=${timestamp},v1=${signWebhookPayload(SECRET, "other", timestamp)}`,
        nowSeconds: timestamp,
      }),
    ).toBe(false);
  });
});

describe("webhook dispatcher", () => {
  it("delivers a signed event to a matching endpoint", async () => {
    const { instance, calls } = dispatcher([200]);
    const event = createWebhookEvent("user.created", { id: "u1" });
    const [delivery] = await instance.dispatch(event);
    expect(delivery.status).toBe("success");
    expect(delivery.attempts).toBe(1);
    expect(calls).toHaveLength(1);
    expect(
      verifyWebhookSignature({
        secret: SECRET,
        body: calls[0]?.body ?? "",
        header: calls[0]?.headers["x-webhook-signature"] ?? null,
        toleranceSeconds: 300,
      }),
    ).toBe(true);
    expect(calls[0]?.headers[WEBHOOK_SIGNATURE_HEADER.toLowerCase()]).toBeDefined();
  });

  it("skips endpoints that do not subscribe to the event", async () => {
    const { instance, calls } = dispatcher([200]);
    const deliveries = await instance.dispatch(
      createWebhookEvent("other.event", {}),
    );
    expect(deliveries).toHaveLength(0);
    expect(calls).toHaveLength(0);
  });

  it("retries retryable failures and then succeeds", async () => {
    const { instance, calls } = dispatcher([500, 200]);
    const [delivery] = await instance.dispatch(createWebhookEvent("user.created", {}));
    expect(delivery.status).toBe("success");
    expect(delivery.attempts).toBe(2);
    expect(calls).toHaveLength(2);
  });

  it("fails after exhausting retries", async () => {
    const { instance } = dispatcher([500]);
    const [delivery] = await instance.dispatch(createWebhookEvent("user.created", {}));
    expect(delivery.status).toBe("failed");
    expect(delivery.attempts).toBe(3);
    expect(delivery.responseStatus).toBe(500);
  });

  it("does not retry client errors", async () => {
    const { instance, calls } = dispatcher([400]);
    const [delivery] = await instance.dispatch(createWebhookEvent("user.created", {}));
    expect(delivery.status).toBe("failed");
    expect(delivery.attempts).toBe(1);
    expect(calls).toHaveLength(1);
  });

  it("blocks private/loopback targets", async () => {
    const { instance, calls } = dispatcher([200], [
      { ...endpoint, url: "https://localhost/hook" },
    ]);
    const [delivery] = await instance.dispatch(createWebhookEvent("user.created", {}));
    expect(delivery.status).toBe("skipped");
    expect(calls).toHaveLength(0);
  });

  it("records deliveries and manages endpoints", async () => {
    const { instance } = dispatcher([200], []);
    await instance.registerEndpoint(endpoint);
    expect(await instance.listEndpoints()).toHaveLength(1);
    await instance.dispatch(createWebhookEvent("user.created", {}));
    expect(await instance.deliveries()).toHaveLength(1);
    expect(await instance.unregisterEndpoint(endpoint.id)).toBe(true);
    expect(await instance.listEndpoints()).toHaveLength(0);
  });
});

describe("withWebhookVerification", () => {
  const timestamp = 1_700_000_000;

  function ctxFor(body: string, header: string | null): MiddlewareContext {
    const req = new Request("http://x.test/hook", {
      method: "POST",
      headers: header === null ? {} : { [WEBHOOK_SIGNATURE_HEADER]: header },
      body,
    });
    return {
      req,
      url: new URL(req.url),
      requestId: "r1",
      logger: createLogger({}, { level: "error", writer: () => {} }),
      cache: {} as MiddlewareContext["cache"],
      auth: {} as MiddlewareContext["auth"],
      storage: {} as MiddlewareContext["storage"],
      state: {},
    };
  }

  it("accepts a valid signature and attaches the event", async () => {
    const event = createWebhookEvent("user.created", { id: "u9" }, { createdAt: "x" });
    const body = JSON.stringify(event);
    const header = buildWebhookSignatureHeader(SECRET, body, timestamp);
    const handler = compose(
      [withWebhookVerification({ secret: SECRET, nowSeconds: () => timestamp })],
      async (ctx) => Response.json(readWebhookEvent(ctx)),
    );
    const res = await handler(ctxFor(body, header));
    expect(res.status).toBe(200);
    expect((await res.json()) as { id: string }).toEqual(event);
  });

  it("rejects an invalid signature", async () => {
    const body = JSON.stringify({ id: "1" });
    const handler = compose(
      [withWebhookVerification({ secret: SECRET, nowSeconds: () => timestamp })],
      async () => new Response("ok"),
    );
    await expect(
      handler(ctxFor(body, "t=1,v1=deadbeef")),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("rejects a missing signature", async () => {
    const handler = compose(
      [withWebhookVerification({ secret: SECRET, nowSeconds: () => timestamp })],
      async () => new Response("ok"),
    );
    await expect(handler(ctxFor("{}", null))).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });
});
