export const HEADER_ACCEPT_ENCODING = "Accept-Encoding" as const;

export const HEADER_CONTENT_ENCODING = "Content-Encoding" as const;

export const HEADER_VARY = "Vary" as const;

export const ENV_COMPRESSION_ENABLED = "COMPRESSION_ENABLED" as const;

/** Minimum body size (bytes) worth compressing. */
export const COMPRESSION_MIN_BYTES = 1024 as const;

export const COMPRESSION_DEFAULT_THRESHOLD = COMPRESSION_MIN_BYTES;

/** Algorithms supported by the middleware, in preference order. */
export const COMPRESSION_ALGORITHMS = ["br", "gzip", "deflate", "zstd"] as const;

export type CompressionAlgorithm = (typeof COMPRESSION_ALGORITHMS)[number];

export const ENCODING_GZIP = "gzip" as const;
export const ENCODING_DEFLATE = "deflate" as const;
export const ENCODING_BROTLI = "br" as const;
export const ENCODING_ZSTD = "zstd" as const;

export const ENCODING_IDENTITY = "identity" as const;
