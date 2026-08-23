-- Better Auth 1.7 adds an "issuer" column to the account table, and
-- "alg" + "crv" columns to the jwks table. Existing rows get defaults.
alter table "account" add column "issuer" text not null default 'local:credential';
--> statement-breakpoint
alter table "jwks" add column "alg" text;
--> statement-breakpoint
alter table "jwks" add column "crv" text;