import {
  ENV_NODE_ENV,
  NODE_ENV_DEVELOPMENT,
  NODE_ENV_PRODUCTION,
} from "@/constants/tls-dev.js";

export function isNodeEnvDevelopment(): boolean {
  return process.env[ENV_NODE_ENV] === NODE_ENV_DEVELOPMENT;
}

export function isNodeEnvProduction(): boolean {
  return process.env[ENV_NODE_ENV] === NODE_ENV_PRODUCTION;
}
