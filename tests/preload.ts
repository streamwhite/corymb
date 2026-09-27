import { afterAll } from "bun:test";
import "./dispose-guard.js";
import { BCRYPT_COST_TEST, ENV_BCRYPT_COST } from "@/constants/bcrypt-cost.js";
import { ENV_LOG_LEVEL } from "@/constants/observability.js";
import { stopTestServer } from "./helpers/test-db.js";

process.env[ENV_BCRYPT_COST] = String(BCRYPT_COST_TEST);
process.env[ENV_LOG_LEVEL] = "error";

afterAll(async () => {
  await stopTestServer();
});
