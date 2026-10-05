import { describe, expect, it } from "bun:test";
import { createPostgrestClient } from "@/data/postgrest-client.js";
import { PostgrestError } from "@/data/postgrest-error.js";
import { executePostgrest } from "@/data/postgrest-request.js";
import type { PostgrestConfig } from "@/constants/postgrest.js";

const BASE_URL = "http://postgrest.test" as const;

type Captured = {
  url: URL;
  method: string;
  headers: Headers;
  body: string | null;
};

function capturingFetch(
  responder: (captured: Captured) => Response = () => jsonResponse([]),
): { fetch: typeof fetch; calls: Captured[] } {
  const calls: Captured[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const captured: Captured = {
      url: new URL(String(input)),
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

function clientWith(responder?: (captured: Captured) => Response) {
  const { fetch, calls } = capturingFetch(responder);
  const client = createPostgrestClient({ url: BASE_URL, schema: "app", fetch });
  return { client, calls };
}

describe("postgrest builder methods", () => {
  it("upserts with merge-duplicates and on_conflict", async () => {
    const { client, calls } = clientWith(() => jsonResponse([], { status: 201 }));
    await client.from("todos").upsert({ id: 1 }, { onConflict: "id" });
    expect(calls[0]!.method).toBe("POST");
    expect(calls[0]!.url.searchParams.get("on_conflict")).toBe("id");
    expect(calls[0]!.headers.get("Prefer")).toBe(
      "resolution=merge-duplicates,return=representation",
    );
  });

  it("updates with PATCH and deletes with DELETE", async () => {
    const { client, calls } = clientWith(() => jsonResponse([]));
    await client.from("todos").update({ done: true }).eq("id", 1);
    await client.from("todos").delete().eq("id", 2);
    expect(calls[0]!.method).toBe("PATCH");
    expect(calls[0]!.headers.get("Prefer")).toBe("return=representation");
    expect(calls[1]!.method).toBe("DELETE");
    expect(calls[1]!.url.searchParams.get("id")).toBe("eq.2");
  });

  it("encodes every filter operator", async () => {
    const { client, calls } = clientWith();
    await client
      .from("todos")
      .neq("a", 1)
      .gt("b", 2)
      .gte("c", 3)
      .lt("d", 4)
      .lte("e", 5)
      .like("f", "x%")
      .ilike("g", "y%")
      .is("h", null)
      .in("i", ["p", "q"]);
    const q = calls[0]!.url.searchParams;
    expect(q.get("a")).toBe("neq.1");
    expect(q.get("b")).toBe("gt.2");
    expect(q.get("c")).toBe("gte.3");
    expect(q.get("d")).toBe("lt.4");
    expect(q.get("e")).toBe("lte.5");
    expect(q.get("f")).toBe("like.x%");
    expect(q.get("g")).toBe("ilike.y%");
    expect(q.get("h")).toBe("is.null");
    expect(q.get("i")).toBe("in.(p,q)");
  });

  it("wraps a non-array in() value and quotes reserved values", async () => {
    const { client, calls } = clientWith();
    await client.from("todos").in("status", "open").eq("title", "a b");
    const q = calls[0]!.url.searchParams;
    expect(q.get("status")).toBe("in.(open)");
    expect(q.get("title")).toBe('eq."a b"');
  });

  it("orders ascending by default and descending on request", async () => {
    const { client, calls } = clientWith();
    await client.from("todos").order("a").order("b", { ascending: false });
    expect(calls[0]!.url.searchParams.getAll("order")).toEqual([
      "a.asc",
      "b.desc",
    ]);
  });

  it("maps range() to offset/limit and clamps inverted ranges", async () => {
    const { client, calls } = clientWith();
    await client.from("todos").range(10, 19);
    await client.from("todos").range(5, 3);
    expect(calls[0]!.url.searchParams.get("offset")).toBe("10");
    expect(calls[0]!.url.searchParams.get("limit")).toBe("10");
    expect(calls[1]!.url.searchParams.get("limit")).toBe("0");
  });

  it("adds exact counting and single-row accept", async () => {
    const { client, calls } = clientWith(() => jsonResponse({ id: 1 }));
    await client.from("todos").select("id").count().single();
    expect(calls[0]!.headers.get("Prefer")).toBe("count=exact");
    expect(calls[0]!.headers.get("Accept")).toBe(
      "application/vnd.pgrst.object+json",
    );
  });
});

const CONFIG: PostgrestConfig = {
  url: BASE_URL,
  schema: "app",
  timeoutMs: 1000,
};

const EMPTY_QUERY = new URLSearchParams();

describe("postgrest request execution", () => {
  it("maps transport failures to a status-0 PostgrestError", async () => {
    const fetchImpl = (async () => {
      throw new Error("boom");
    }) as unknown as typeof fetch;
    const err = await executePostgrest(CONFIG, fetchImpl, {
      method: "GET",
      path: "/todos",
      query: EMPTY_QUERY,
      auth: { kind: "anonymous" },
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PostgrestError);
    expect((err as PostgrestError).status).toBe(0);
    expect((err as PostgrestError).message).toContain("boom");
  });

  it("tolerates a 406 PGRST116 as empty data when requested", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ code: "PGRST116", message: "no rows" }), {
        status: 406,
      })) as unknown as typeof fetch;
    const result = await executePostgrest(CONFIG, fetchImpl, {
      method: "GET",
      path: "/todos",
      query: EMPTY_QUERY,
      auth: { kind: "anonymous" },
      tolerateNoRows: true,
    });
    expect(result.data).toBeNull();
    expect(result.status).toBe(406);
  });

  it("returns null data for 204 and reads count from Content-Range", async () => {
    const fetchImpl = (async () =>
      new Response(null, {
        status: 204,
        headers: { "Content-Range": "0-9/42" },
      })) as unknown as typeof fetch;
    const result = await executePostgrest(CONFIG, fetchImpl, {
      method: "DELETE",
      path: "/todos",
      query: EMPTY_QUERY,
      auth: { kind: "anonymous" },
    });
    expect(result.data).toBeNull();
    expect(result.count).toBe(42);
  });

  it("sends the service token for anonymous auth and Content-Profile on writes", async () => {
    const { fetch, calls } = capturingFetch(() => jsonResponse([]));
    await executePostgrest(
      { ...CONFIG, serviceToken: "service-jwt" },
      fetch,
      {
        method: "POST",
        path: "/todos",
        query: EMPTY_QUERY,
        auth: { kind: "anonymous" },
        body: { title: "x" },
        prefer: ["return=representation"],
      },
    );
    expect(calls[0]!.headers.get("Authorization")).toBe("Bearer service-jwt");
    expect(calls[0]!.headers.get("Content-Profile")).toBe("app");
    expect(calls[0]!.headers.get("Prefer")).toBe("return=representation");
  });
});
