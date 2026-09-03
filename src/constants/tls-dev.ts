export const ENV_NODE_ENV = "NODE_ENV" as const;

export const NODE_ENV_DEVELOPMENT = "development" as const;

export const NODE_ENV_PRODUCTION = "production" as const;

export const ENV_TLS_CERT_PATH = "TLS_CERT_PATH" as const;

export const ENV_TLS_KEY_PATH = "TLS_KEY_PATH" as const;

export const DEV_TLS_SUBDIR = "certs" as const;

export const DEV_TLS_CERT_FILENAME = "dev.crt" as const;

export const DEV_TLS_KEY_FILENAME = "dev.key" as const;

/** Self-signed cert validity for local HTTPS (`openssl req`). */
export const DEV_TLS_SELF_SIGNED_DAYS = "825" as const;

export const DEV_TLS_OPENSSL_SUBJECT = "/CN=localhost" as const;
