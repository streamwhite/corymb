# Dev TLS (HTTPS)

Self-signed files **`dev.key`** / **`dev.crt`** in this directory are **gitignored**. Generate them once:

```bash
bun run tls:gencert
```

Requires **`openssl`** on your `PATH`. With `NODE_ENV=development` (set by `bun run dev`), the server enables TLS when those files exist.

Override paths anytime with **`TLS_KEY_PATH`** and **`TLS_CERT_PATH`**.
