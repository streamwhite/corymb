import {
  COMPRESSION_ALGORITHMS,
  COMPRESSION_DEFAULT_THRESHOLD,
  ENCODING_BROTLI,
  ENCODING_DEFLATE,
  ENCODING_GZIP,
  ENCODING_IDENTITY,
  ENCODING_ZSTD,
  HEADER_ACCEPT_ENCODING,
  HEADER_CONTENT_ENCODING,
  HEADER_VARY,
  type CompressionAlgorithm,
} from "@/constants/compression.js";
import { HTTP_STATUS_NO_CONTENT } from "@/constants/http-status.js";
import type { Middleware } from "@/middleware/middleware-types.js";

export type CompressionOptions = {
  /** Minimum body size in bytes before compressing (default 1024). */
  thresholdBytes?: number;
  /** Algorithms to consider, in preference order. */
  algorithms?: CompressionAlgorithm[];
};

const ENCODING_BY_ALGORITHM: Record<CompressionAlgorithm, string> = {
  br: ENCODING_BROTLI,
  gzip: ENCODING_GZIP,
  deflate: ENCODING_DEFLATE,
  zstd: ENCODING_ZSTD,
};

/** Content types worth compressing (text-like payloads). */
function isCompressible(contentType: string | null): boolean {
  if (contentType === null) {
    return false;
  }
  const type = contentType.toLowerCase();
  // Never buffer streaming responses (SSE) — that would stall the stream.
  if (type.includes("text/event-stream")) {
    return false;
  }
  return (
    type.startsWith("text/") ||
    type.includes("json") ||
    type.includes("xml") ||
    type.includes("javascript") ||
    type.includes("svg") ||
    type.includes("yaml")
  );
}

function parseAcceptEncoding(header: string | null): Set<string> {
  if (header === null) {
    return new Set();
  }
  const encodings = new Set<string>();
  for (const part of header.split(",")) {
    const name = part.trim().split(";")[0]?.trim().toLowerCase();
    if (name !== undefined && name.length > 0) {
      encodings.add(name);
    }
  }
  return encodings;
}

function chooseAlgorithm(
  accepted: Set<string>,
  algorithms: CompressionAlgorithm[],
): CompressionAlgorithm | null {
  for (const algorithm of algorithms) {
    if (accepted.has(ENCODING_BY_ALGORITHM[algorithm])) {
      return algorithm;
    }
  }
  return null;
}

/**
 * Maps our short encoding name to the WHATWG `CompressionStream` format.
 * `zstd` has no stream format in Bun yet, so it uses the sync `Bun` helper.
 */
const STREAM_FORMAT: Partial<Record<CompressionAlgorithm, string>> = {
  br: "brotli",
  gzip: "gzip",
  deflate: "deflate",
};

async function compressWithStream(
  body: Uint8Array,
  algorithm: CompressionAlgorithm,
): Promise<Uint8Array | null> {
  const format = STREAM_FORMAT[algorithm];
  if (format === undefined || typeof CompressionStream === "undefined") {
    return null;
  }
  try {
    const buffer = new ArrayBuffer(body.byteLength);
    new Uint8Array(buffer).set(body);
    const stream = new Blob([buffer])
      .stream()
      .pipeThrough(new CompressionStream(format as CompressionFormat));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}

function toArrayBuffer(body: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(body.byteLength);
  new Uint8Array(buffer).set(body);
  return buffer;
}

function compressSync(
  body: Uint8Array,
  algorithm: CompressionAlgorithm,
): Uint8Array | null {
  try {
    const buffer = toArrayBuffer(body);
    if (algorithm === "gzip") return new Uint8Array(Bun.gzipSync(buffer));
    if (algorithm === "deflate") return new Uint8Array(Bun.deflateSync(buffer));
    if (algorithm === "zstd") {
      return new Uint8Array(Bun.zstdCompressSync(buffer));
    }
  } catch {
    return null;
  }
  return null;
}

function canCompress(res: Response, threshold: number): boolean {
  if (res.status === HTTP_STATUS_NO_CONTENT || res.body === null) {
    return false;
  }
  if (res.headers.has(HEADER_CONTENT_ENCODING)) {
    return false;
  }
  return isCompressible(res.headers.get("Content-Type"));
}

/**
 * Negotiates `Accept-Encoding` and compresses eligible text-like responses with
 * brotli/gzip/deflate/zstd. Skips already-encoded, non-text, empty or `204`
 * responses.
 */
export function withCompression(options: CompressionOptions = {}): Middleware {
  const threshold = options.thresholdBytes ?? COMPRESSION_DEFAULT_THRESHOLD;
  const algorithms = options.algorithms ?? [...COMPRESSION_ALGORITHMS];

  return async (ctx, next) => {
    const res = await next();
    if (!canCompress(res, threshold)) {
      return res;
    }
    const accepted = parseAcceptEncoding(
      ctx.req.headers.get(HEADER_ACCEPT_ENCODING),
    );
    const algorithm = chooseAlgorithm(accepted, algorithms);
    if (algorithm === null) {
      return res;
    }
    const raw = new Uint8Array(await res.clone().arrayBuffer());
    if (raw.byteLength < threshold) {
      return res;
    }
    const compressed =
      (await compressWithStream(raw, algorithm)) ?? compressSync(raw, algorithm);
    if (compressed === null || compressed.byteLength >= raw.byteLength) {
      return res;
    }
    const headers = new Headers(res.headers);
    headers.set(HEADER_CONTENT_ENCODING, ENCODING_BY_ALGORITHM[algorithm]);
    headers.append(HEADER_VARY, HEADER_ACCEPT_ENCODING);
    headers.delete("Content-Length");
    return new Response(compressed as BodyInit, {
      status: res.status,
      statusText: res.statusText,
      headers,
    });
  };
}

export { ENCODING_IDENTITY, ENCODING_BY_ALGORITHM };
