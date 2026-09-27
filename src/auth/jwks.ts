import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import type { BetterAuthInstance } from "@/auth/better-auth.js";

export type Jwk = Record<string, unknown>;

export type JwksDocument = {
  keys: Jwk[];
};

function assertJwks(value: unknown): JwksDocument {
  if (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { keys?: unknown }).keys)
  ) {
    return value as JwksDocument;
  }
  throw new Error("Better Auth did not return a valid JWKS document");
}

async function readJwksPayload(auth: BetterAuthInstance): Promise<unknown> {
  const result = await auth.api.getJwks();
  if (result instanceof Response) {
    return result.json();
  }
  return result;
}

/**
 * Public JWKS for PostgREST (`jwt-secret = "@<file>"`). Triggering this also
 * materializes the Better Auth signing key pair on first use.
 */
export async function buildPublicJwks(
  auth: BetterAuthInstance,
): Promise<JwksDocument> {
  return assertJwks(await readJwksPayload(auth));
}

export function writeJwksFile(doc: JwksDocument, outPath: string): void {
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
}
