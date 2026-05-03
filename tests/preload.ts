import { BCRYPT_COST_TEST, ENV_BCRYPT_COST } from "@/constants/bcrypt-cost.js";

process.env[ENV_BCRYPT_COST] = String(BCRYPT_COST_TEST);
