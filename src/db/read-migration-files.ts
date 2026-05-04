import { CryptoHasher } from "bun";
import { readFileSync } from "fs";
import path from "path";

const JOURNAL_REL = ["meta", "_journal.json"] as const;

const STMT_BREAK = "--> statement-breakpoint" as const;

export type MigrationBundle = {
  sql: string[];
  breakpoints: boolean;
  folderMillis: number;
  hash: string;
};

export type JournalFile = {
  entries: Array<{
    idx: number;
    when: number;
    tag: string;
    breakpoints: boolean;
  }>;
};

function readJournal(migrationsFolder: string): JournalFile {
  const journalPath = path.join(migrationsFolder, ...JOURNAL_REL);
  const raw = readFileSync(journalPath, "utf8");
  return JSON.parse(raw) as JournalFile;
}

function sha256Hex(content: string): string {
  const hasher = new CryptoHasher("sha256");
  hasher.update(content);
  return hasher.digest("hex");
}

export function readMigrationFiles(
  migrationsFolder: string,
): MigrationBundle[] {
  const journal = readJournal(migrationsFolder);
  const out: MigrationBundle[] = [];
  for (const entry of journal.entries) {
    const migrationPath = path.join(migrationsFolder, `${entry.tag}.sql`);
    const query = readFileSync(migrationPath, "utf8");
    const sql = query.split(STMT_BREAK).map((s) => s.trim());
    out.push({
      sql,
      breakpoints: entry.breakpoints,
      folderMillis: entry.when,
      hash: sha256Hex(query),
    });
  }
  return out;
}
