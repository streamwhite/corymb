-- Two-factor authentication (Better Auth two-factor plugin, OTP + TOTP).
-- Adds the `twoFactorEnabled` flag to users and the `twoFactor` table.
alter table auth."user" add column if not exists "twoFactorEnabled" boolean not null default false;
--> statement-breakpoint
create table if not exists auth."twoFactor" ("id" text not null primary key, "secret" text not null, "backupCodes" text not null, "userId" text not null references auth."user" ("id") on delete cascade, "verified" boolean not null default true, "failedVerificationCount" integer not null default 0, "lockedUntil" timestamp);
--> statement-breakpoint
create index if not exists "twoFactor_userId_idx" on auth."twoFactor" ("userId");
--> statement-breakpoint
create index if not exists "twoFactor_secret_idx" on auth."twoFactor" ("secret");
