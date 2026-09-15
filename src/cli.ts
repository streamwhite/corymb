import {
  SIGNAL_SIGINT,
  SIGNAL_SIGTERM,
} from "@/constants/server.js";
import {
  CLI_FORCE_FLAG,
  CLI_INIT_COMMAND,
  CLI_START_COMMAND,
  initProject,
  PACKAGE_NAME,
} from "@/scaffold/init-project.js";
import { startServer } from "@/server/start-server.js";

let isShuttingDown = false;

async function shutdown(
  server: ReturnType<typeof Bun.serve>,
  closeApp: () => Promise<void>,
): Promise<void> {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;
  try {
    await server.stop();
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  }
  try {
    await closeApp();
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  }
  process.exit(process.exitCode ?? 0);
}

async function runStart(): Promise<void> {
  const { server, app } = await startServer();

  console.info(`Server listening on ${server.url.href}`);

  process.once(SIGNAL_SIGINT, () => {
    void shutdown(server, app.close);
  });
  process.once(SIGNAL_SIGTERM, () => {
    void shutdown(server, app.close);
  });
}

function printUsage(): void {
  console.info(`Usage:
  ${PACKAGE_NAME}              Start the built-in server
  ${PACKAGE_NAME} ${CLI_START_COMMAND}        Same as default
  ${PACKAGE_NAME} ${CLI_INIT_COMMAND} <dir>   Scaffold a new consumer project
  ${PACKAGE_NAME} ${CLI_INIT_COMMAND} <dir> ${CLI_FORCE_FLAG}
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
