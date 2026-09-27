-- Application data schema exposed through PostgREST (RLS-enforced).
create schema if not exists app;
--> statement-breakpoint
-- Helper accessors mirroring the Supabase convention; read the verified JWT
-- claims that PostgREST sets for the duration of a request.
create or replace function auth.jwt() returns jsonb language sql stable as
$$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
--> statement-breakpoint
create or replace function auth.uid() returns text language sql stable as
$$
  select auth.jwt() ->> 'sub'
$$;
--> statement-breakpoint
create or replace function auth.role() returns text language sql stable as
$$
  select auth.jwt() ->> 'role'
$$;
