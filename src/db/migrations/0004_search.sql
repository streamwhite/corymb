-- Full-text search support. unaccent is a trusted extension (PostgreSQL 13+),
-- so the migration role only needs CREATE on the database.
create extension if not exists unaccent;
--> statement-breakpoint
-- Text search configuration = unaccent + English stemming, so documents and
-- queries normalize the same way ("réact" ~ "react"). For another language,
-- copy the matching pg_catalog config and swap the stemmer dictionary.
do $$
begin
  if not exists (
    select 1 from pg_ts_config c
    join pg_namespace n on n.oid = c.cfgnamespace
    where c.cfgname = 'unaccent_english' and n.nspname = 'app'
  ) then
    execute 'create text search configuration app.unaccent_english (copy = pg_catalog.english)';
  end if;
end
$$;
--> statement-breakpoint
alter text search configuration app.unaccent_english
  alter mapping for asciiword, asciihword, hword_asciipart, word, hword, hword_part
  with public.unaccent, pg_catalog.english_stem;
--> statement-breakpoint
-- Immutable wrapper so unaccent can back generated columns and expression
-- indexes; the built-in unaccent() is only STABLE and PostgreSQL rejects it
-- there.
create or replace function app.immutable_unaccent(text)
returns text language sql immutable parallel safe strict
as $$ select public.unaccent('public.unaccent', $1) $$;
