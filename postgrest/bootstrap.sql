-- PostgREST roles and grants. Run once per environment as a privileged role
-- (e.g. the database owner / superuser) after `bunx <pkg> migrate`.
--
-- Shared PostgreSQL cluster: run this against the project's own database and
-- pass the project-scoped login role anaglyph provisioned, e.g.
--   psql "$DATABASE_URL" \
--     -v authenticator=lab_app_authenticator \
--     -v authenticator_password='<pw>' \
--     -f postgrest/bootstrap.sql
-- Standalone (no anaglyph): omit the variables to use app_authenticator /
-- CHANGE_ME. The script is idempotent — existing roles are left unchanged.

\if :{?authenticator}
\else
  \set authenticator app_authenticator
\endif
\if :{?authenticator_password}
\else
  \set authenticator_password 'CHANGE_ME'
\endif

-- Login role PostgREST connects with. It cannot bypass RLS; it can switch to the
-- roles below based on the `role` claim in the verified JWT. \gexec keeps each
-- statement idempotent (create only when the role is absent).
select format('create role %I noinherit login password %L',
              :'authenticator', :'authenticator_password')
where not exists (select from pg_roles where rolname = :'authenticator')\gexec

select 'create role anon nologin'
where not exists (select from pg_roles where rolname = 'anon')\gexec

select 'create role authenticated nologin'
where not exists (select from pg_roles where rolname = 'authenticated')\gexec

select 'create role service_role nologin bypassrls'
where not exists (select from pg_roles where rolname = 'service_role')\gexec

grant anon, authenticated, service_role to :"authenticator";

-- Schema access.
grant usage on schema app to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;

-- JWT claim helpers used by RLS policies.
grant execute on function auth.uid() to anon, authenticated, service_role;
grant execute on function auth.jwt() to anon, authenticated, service_role;
grant execute on function auth.role() to anon, authenticated, service_role;

-- Existing tables (adjust as your schema grows).
grant select on all tables in schema app to anon;
grant select, insert, update, delete on all tables in schema app to authenticated;
grant all on all tables in schema app to service_role;
grant usage, select on all sequences in schema app to authenticated, service_role;

-- Future tables created by the same owner automatically get these grants.
alter default privileges in schema app
  grant select on tables to anon;
alter default privileges in schema app
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema app
  grant all on tables to service_role;
alter default privileges in schema app
  grant usage, select on sequences to authenticated, service_role;
