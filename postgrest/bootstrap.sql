-- PostgREST roles and grants. Run once per environment as a privileged role
-- (e.g. the database owner / superuser) after `bunx <pkg> migrate`.
--
-- Replace CHANGE_ME with strong credentials before running.

-- Login role PostgREST connects with. It cannot bypass RLS; it can switch to the
-- roles below based on the `role` claim in the verified JWT.
create role app_authenticator noinherit login password 'CHANGE_ME';
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

grant anon, authenticated, service_role to app_authenticator;

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
