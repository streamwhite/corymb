import { createAuthRuntime } from "@/auth/auth-runtime.js";
import { buildPublicJwks, writeJwksFile } from "@/auth/jwks.js";
import { createMemoryCache } from "@/cache/memory-cache.js";
import { loadAppConfig } from "@/config/app-config.js";
import { createNoopMailer } from "@/mail/noop-mailer.js";
import { migrateDatabase } from "@/db/migrate.js";
import { createSeedRuntime } from "@/db/seed-runtime.js";
import { seedDatabase } from "@/db/seed.js";
import {
  CLI_FORCE_FLAG,
  CLI_INIT_COMMAND,
  CLI_JWKS_COMMAND,
  CLI_MIGRATE_COMMAND,
  CLI_MIGRATE_STATUS_COMMAND,
  CLI_SEED_COMMAND,
  CLI_START_COMMAND,
  DEFAULT_JWKS_OUTPUT,
  initProject,
  PACKAGE_NAME,
} from "@/scaffold/init-project.js";
import { createGracefulShutdown } from "@/server/graceful-shutdown.js";
import { startServer } from "@/server/start-server.js";

async function runStart(): Promise<void> {
  loadAppConfig();
  const { server, app } = await startServer();

  app.logger.info("server listening", { url: server.url.href });

  const shutdown = createGracefulShutdown({
    logger: app.logger,
    steps: [
      { name: "http-server", run: () => server.stop() },
      { name: "app", run: () => app.close() },
    ],
  });
  shutdown.installSignalHandlers();
}

async function runMigrate(): Promise<void> {
  await migrateDatabase();
  console.info("Database migrations applied.");
}

async function runSeed(): Promise<void> {
  await migrateDatabase();
  const runtime = await createSeedRuntime();
  try {
    await seedDatabase(runtime.auth);
    console.info("Seed completed.");
  } finally {
    await runtime.close();
  }
}

async function runJwks(args: string[]): Promise<void> {
  const outPath = args[0] ?? DEFAULT_JWKS_OUTPUT;
  const runtime = createAuthRuntime({
    cache: createMemoryCache(),
    mailer: createNoopMailer(),
  });
  try {
    const jwks = await buildPublicJwks(runtime.auth);
    writeJwksFile(jwks, outPath);
    console.info(`Wrote ${String(jwks.keys.length)} public key(s) to ${outPath}`);
  } finally {
    await runtime.close();
  }
}

function printUsage(): void {
  console.info(`Usage:
  ${PACKAGE_NAME}                    Start the built-in server
  ${PACKAGE_NAME} ${CLI_START_COMMAND}              Same as default
  ${PACKAGE_NAME} ${CLI_INIT_COMMAND} <dir>         Scaffold a new consumer project
  ${PACKAGE_NAME} ${CLI_INIT_COMMAND} <dir> ${CLI_FORCE_FLAG}
  ${PACKAGE_NAME} ${CLI_MIGRATE_COMMAND}            Apply SQL migrations to DATABASE_URL
  ${PACKAGE_NAME} ${CLI_MIGRATE_STATUS_COMMAND}     Show migration applied/pending state
  ${PACKAGE_NAME} ${CLI_SEED_COMMAND}               Migrate then seed demo users
  ${PACKAGE_NAME} ${CLI_JWKS_COMMAND} [out]    Export public JWKS for PostgREST (default ${DEFAULT_JWKS_OUTPUT})
`);
}

function runInit(args: string[]): void {
  const force = args.includes(CLI_FORCE_FLAG);
  const positional = args.filter((a) => a !== CLI_FORCE_FLAG);
  const targetDir = positional[0];
  if (targetDir === undefined || targetDir.length === 0) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const result = initProject({ targetDir, force });
  console.info(`Created project in ${result.targetDir}`);
  console.info(`Files: ${result.filesWritten.join(", ")}`);
  console.info(`Next:
  cd ${result.targetDir}
  bun install
  # edit .env (BETTER_AUTH_SECRET) and start Redis
  bun run dev
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === undefined || command === CLI_START_COMMAND) {
    await runStart();
    return;
  }

  if (command === CLI_INIT_COMMAND) {
    runInit(args.slice(1));
    return;
  }

  if (command === CLI_MIGRATE_STATUS_COMMAND) {
    await import("@/db/migrate-status-cli.js");
    return;
  }

  if (command === CLI_MIGRATE_COMMAND) {
    await runMigrate();
    return;
  }

  if (command === CLI_SEED_COMMAND) {
    await runSeed();
    return;
  }

  if (command === CLI_JWKS_COMMAND) {
    await runJwks(args.slice(1));
    return;
  }

  if (command === "--help" || command === "-h") {
    printUsage();
    return;
  }

  console.error(`Unknown command: ${command}`);
  printUsage();
  process.exitCode = 1;
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
