-- Better Auth persistence lives in the dedicated `auth` schema (auth exception).
create schema if not exists auth;
--> statement-breakpoint
create table auth."user" ("id" text not null primary key, "name" text not null, "email" text not null unique, "emailVerified" boolean not null default false, "image" text, "createdAt" timestamp not null default now(), "updatedAt" timestamp not null default now(), "username" text unique, "displayUsername" text);
--> statement-breakpoint
create table auth."session" ("id" text not null primary key, "expiresAt" timestamp not null, "token" text not null unique, "createdAt" timestamp not null default now(), "updatedAt" timestamp not null default now(), "ipAddress" text, "userAgent" text, "userId" text not null references auth."user" ("id") on delete cascade);
--> statement-breakpoint
create table auth."account" ("id" text not null primary key, "accountId" text not null, "providerId" text not null, "userId" text not null references auth."user" ("id") on delete cascade, "accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" timestamp, "refreshTokenExpiresAt" timestamp, "scope" text, "password" text, "createdAt" timestamp not null default now(), "updatedAt" timestamp not null default now(), "issuer" text not null default 'local:credential');
--> statement-breakpoint
create table auth."verification" ("id" text not null primary key, "identifier" text not null, "value" text not null, "expiresAt" timestamp not null, "createdAt" timestamp not null default now(), "updatedAt" timestamp not null default now());
--> statement-breakpoint
create table auth."jwks" ("id" text not null primary key, "publicKey" text not null, "privateKey" text not null, "createdAt" timestamp not null default now(), "expiresAt" timestamp, "alg" text, "crv" text);
--> statement-breakpoint
create table auth."passkey" ("id" text not null primary key, "name" text, "publicKey" text not null, "userId" text not null references auth."user" ("id") on delete cascade, "credentialID" text not null, "counter" integer not null, "deviceType" text not null, "backedUp" boolean not null default false, "transports" text, "createdAt" timestamp, "aaguid" text);
--> statement-breakpoint
create index "session_userId_idx" on auth."session" ("userId");
--> statement-breakpoint
create index "account_userId_idx" on auth."account" ("userId");
--> statement-breakpoint
create index "verification_identifier_idx" on auth."verification" ("identifier");
--> statement-breakpoint
create index "passkey_userId_idx" on auth."passkey" ("userId");
--> statement-breakpoint
create index "passkey_credentialID_idx" on auth."passkey" ("credentialID");
