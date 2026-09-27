import { describe, expect, it } from "bun:test";
import { createPostgrestClient } from "@/data/postgrest-client.js";
import { PostgrestError } from "@/data/postgrest-error.js";

const BASE_URL = "http://postgrest.test" as const;

type Captured = {
  url: string;
  method: string;
  headers: Headers;
  body: string | null;
};

function fakeFetch(
  responder: (captured: Captured) => Response,
): { fetch: typeof fetch; calls: Captured[] } {
  const calls: Captured[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const captured: Captured = {
      url: String(input),
      method: init?.method ?? "GET",
      headers: new Headers(init?.headers),
      body: typeof init?.body === "string" ? init.body : null,
    };
    calls.push(captured);
    return responder(captured);
  }) as typeof fetch;
  return { fetch: fetchImpl, calls };
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

function clientWith(responder: (captured: Captured) => Response) {
  const { fetch, calls } = fakeFetch(responder);
  const client = createPostgrestClient({
    url: BASE_URL,
    schema: "app",
    fetch,
  });
  return { client, calls };
}

describe("postgrest client", () => {
  it("builds select queries with filters, order and limit", async () => {
    const { client, calls } = clientWith(() => jsonResponse([]));
    await client
      .from("todos")
      .select("id,title")
      .eq("done", false)
      .gte("priority", 2)
      .in("status", ["open", "doing"])
      .order("created_at", { ascending: false })
      .limit(10);

    expect(calls).toHaveLength(1);
    const url = new URL(calls[0]!.url);
    expect(url.pathname).toBe("/todos");
    expect(url.searchParams.get("select")).toBe("id,title");
    expect(url.searchParams.getAll("done")).toEqual(["eq.false"]);
    expect(url.searchParams.getAll("priority")).toEqual(["gte.2"]);
    expect(url.searchParams.getAll("status")).toEqual(["in.(open,doing)"]);
    expect(url.searchParams.getAll("order")).toEqual(["created_at.desc"]);
    expect(url.searchParams.get("limit")).toBe("10");
    expect(calls[0]!.headers.get("Accept-Profile")).toBe("app");
  });

  it("quotes string filters that contain reserved characters", async () => {
    const { client, calls } = clientWith(() => jsonResponse([]));
    await client.from("todos").eq("title", "a,b(c)");
    const url = new URL(calls[0]!.url);
    expect(url.searchParams.get("title")).toBe('eq."a,b(c)"');
  });

  it("sends inserts as POST with return=representation", async () => {
    const { client, calls } = clientWith(() =>
      jsonResponse([{ id: "1" }], { status: 201 }),
    );
    const result = await client.from("todos").insert({ title: "buy" }).select();
    expect(calls[0]!.method).toBe("POST");
    expect(calls[0]!.headers.get("Prefer")).toContain("return=representation");
    expect(calls[0]!.headers.get("Content-Profile")).toBe("app");
    expect(JSON.parse(calls[0]!.body ?? "null")).toEqual({ title: "buy" });
    expect(result.data).toEqual([{ id: "1" }]);
  });

  it("scopes requests to a user token via as()", async () => {
    const { client, calls } = clientWith(() => jsonResponse([]));
    await client.as({ kind: "token", token: "jwt-123" }).from("todos").select();
    expect(calls[0]!.headers.get("Authorization")).toBe("Bearer jwt-123");
  });

  it("calls rpc functions", async () => {
    const { client, calls } = clientWith(() => jsonResponse({ ok: true }));
    const result = await client.rpc<{ ok: boolean }>("complete_todo", { id: "1" });
    expect(new URL(calls[0]!.url).pathname).toBe("/rpc/complete_todo");
    expect(JSON.parse(calls[0]!.body ?? "null")).toEqual({ id: "1" });
    expect(result.data).toEqual({ ok: true });
  });

  it("throws PostgrestError with parsed details on failure", async () => {
    const { client } = clientWith(
      () =>
        new Response(
          JSON.stringify({ message: "denied", code: "42501", details: "rls" }),
          { status: 403 },
        ),
    );
    let caught: unknown;
    try {
      await client.from("todos").select();
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(PostgrestError);
    expect((caught as PostgrestError).status).toBe(403);
    expect((caught as PostgrestError).code).toBe("42501");
  });

  it("reports health from the root response", async () => {
    const { client } = clientWith(() => jsonResponse({ openapi: "3.0" }));
    expect(await client.health()).toBe(true);
    const { client: down } = clientWith(() => new Response("nope", { status: 500 }));
    expect(await down.health()).toBe(false);
  });
});
