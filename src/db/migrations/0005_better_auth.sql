-- Drop legacy custom auth tables (replaced by Better Auth schema).
DROP TABLE IF EXISTS email_verifications;
--> statement-breakpoint
DROP TABLE IF EXISTS password_resets;
--> statement-breakpoint
DROP TABLE IF EXISTS sessions;
--> statement-breakpoint
DROP TABLE IF EXISTS users;
--> statement-breakpoint
create table "user" ("id" text not null primary key, "name" text not null, "email" text not null unique, "emailVerified" integer not null, "image" text, "createdAt" date not null, "updatedAt" date not null, "username" text unique, "displayUsername" text);
--> statement-breakpoint
create table "session" ("id" text not null primary key, "expiresAt" date not null, "token" text not null unique, "createdAt" date not null, "updatedAt" date not null, "ipAddress" text, "userAgent" text, "userId" text not null references "user" ("id") on delete cascade);
--> statement-breakpoint
create table "account" ("id" text not null primary key, "accountId" text not null, "providerId" text not null, "userId" text not null references "user" ("id") on delete cascade, "accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" date, "refreshTokenExpiresAt" date, "scope" text, "password" text, "createdAt" date not null, "updatedAt" date not null);
--> statement-breakpoint
create table "verification" ("id" text not null primary key, "identifier" text not null, "value" text not null, "expiresAt" date not null, "createdAt" date not null, "updatedAt" date not null);
--> statement-breakpoint
create table "jwks" ("id" text not null primary key, "publicKey" text not null, "privateKey" text not null, "createdAt" date not null, "expiresAt" date);
--> statement-breakpoint
create index "session_userId_idx" on "session" ("userId");
--> statement-breakpoint
create index "account_userId_idx" on "account" ("userId");
--> statement-breakpoint
create index "verification_identifier_idx" on "verification" ("identifier");
